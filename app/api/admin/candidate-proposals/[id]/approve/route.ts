import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { after } from 'next/server';
import { randomInt } from 'crypto';
import { hashPassword } from '@/lib/auth/password';
import { usuarioLibre } from '@/lib/workspace/usuario-libre';
import { crearGrupoReenvio, borrarGrupo } from '@/lib/integrations/google-workspace';
import { emitirCredencialAlta } from '@/lib/candidatos/credencial';
import { avisarReclutamiento } from '@/lib/avisos/reclutamiento';
import { generateClientToken } from '@/lib/world/session';
import { sendCandidateApprovalEmail } from '@/lib/integrations/email';
import { splitBaseCounter, isValidUsername } from '@/lib/workspace/username';

/** Devuelve el primer usuario libre `base{n}` (revisa clients + users). */
async function resolveFreeUsername(desired: string): Promise<string | null> {
  const { base, start } = splitBaseCounter(desired);
  if (!base) return null;
  for (let n = start; n < start + 1000; n++) {
    const candidate = `${base}${n}`;
    if (!isValidUsername(candidate)) continue;
    const taken = await pool.query(
      `SELECT 1 FROM gcc_world.clients WHERE workspace_username = $1
       UNION SELECT 1 FROM gcc_world.users WHERE LOWER(email) = $2 LIMIT 1`,
      [candidate, `${candidate}@grupocc.org`],
    );
    if (taken.rowCount === 0) return candidate;
  }
  return null;
}

// GET — el correo corporativo que se creará al aprobar, para enseñarlo antes (Fernando, 2026-11-13). Es el primero
// libre según los nombres; si entre tanto otro lo ocupa, el POST vuelve a buscar y usa el siguiente.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  const { id } = await params;
  const { rows: [p] } = await pool.query(`SELECT * FROM gcc_world.candidate_proposals WHERE id = $1 LIMIT 1`, [id]);
  if (!p) return NextResponse.json({ error: 'Postulación no encontrada' }, { status: 404 });
  if (!p.primer_nombre) return NextResponse.json({ usuario: null });
  try {
    const usuario = await usuarioLibre({ firstName: p.primer_nombre, secondName: p.segundo_nombre, firstSurname: p.primer_apellido, secondSurname: p.segundo_apellido });
    return NextResponse.json({ usuario, correo: `${usuario}@grupocc.org` });
  } catch (e: any) {
    return NextResponse.json({ error: `No se pudo calcular el usuario corporativo: ${e?.message || 'error'}` }, { status: 502 });
  }
}

// POST — aprueba una postulación: deja la fila de candidato en gcc_world.clients
// APROBADA pero SIN contraseña (queda como una solicitud aprobada) y le envía el
// correo de aprobación. El candidato define su contraseña + datos al continuar su
// postulación (`complete-profile`); hasta entonces NO puede iniciar sesión (el login
// exige `password_hash`).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const { id } = await params;

    const body = await req.json().catch(() => ({}));
    const desiredUsername = String(body?.username || '').trim().toLowerCase();

    const pr = await pool.query(
      `SELECT * FROM gcc_world.candidate_proposals WHERE id = $1 LIMIT 1`,
      [id],
    );
    const proposal = pr.rows[0];
    if (!proposal) {
      return NextResponse.json({ error: 'Postulación no encontrada' }, { status: 404 });
    }
    if (proposal.status === 'approved') {
      return NextResponse.json({ error: 'Esta postulación ya fue aprobada' }, { status: 409 });
    }

    const cleanEmail = String(proposal.email).trim().toLowerCase();
    const clientToken = generateClientToken();

    // ⇒ EL FLUJO NUEVO (Fernando, 2026-11-12): con los dos nombres y los dos apellidos de la postulación se genera el
    // correo corporativo, se crea como grupo de Google que reenvía al correo personal, y a ESA dirección le llega la
    // credencial (correo + contraseña temporal) para el formulario de alta. Desde ahí el correo personal no se usa.
    if (proposal.primer_nombre && proposal.primer_apellido) {
      // El usuario es AUTOMÁTICO (Fernando, 2026-11-13: «el usuario no debe poner el nombre de usuario»): sale de
      // los nombres y, si ya existe, sube el número. Lo que mande el navegador no cuenta.
      return aprobarConCorreoCorporativo(proposal, null, user);
    }

    // Columnas de cuenta de candidato (idempotente).
    await pool.query(
      `ALTER TABLE gcc_world.clients
         ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'candidate',
         ADD COLUMN IF NOT EXISTS approved boolean DEFAULT false,
         ADD COLUMN IF NOT EXISTS profile_completed boolean DEFAULT false,
         ADD COLUMN IF NOT EXISTS workspace_username text,
         ADD COLUMN IF NOT EXISTS workspace_email text`,
    );

    // Usuario corporativo definido por el aprobador (nomenclatura). Se garantiza único
    // (contador). La cuenta de Google se crea después, al completar la cuenta el candidato.
    let workspaceUsername: string | null = null;
    if (desiredUsername) {
      if (!isValidUsername(splitBaseCounter(desiredUsername).base + '0')) {
        return NextResponse.json({ error: 'Nombre de usuario inválido' }, { status: 400 });
      }
      workspaceUsername = await resolveFreeUsername(desiredUsername);
      if (!workspaceUsername) {
        return NextResponse.json({ error: 'No se pudo asignar un usuario libre' }, { status: 409 });
      }
    }
    const workspaceEmail = workspaceUsername ? `${workspaceUsername}@grupocc.org` : null;

    // Crea o actualiza la fila del candidato (sin personaje aún). Queda APROBADA, con
    // correo verificado, SIN contraseña (password_hash intacto/null) y profile_completed=false.
    // No se toca `password_hash`: si por algún caso ya tuviera una, se conserva; si es
    // fila nueva, queda NULL → el candidato no puede iniciar sesión hasta completar su cuenta.
    const existing = await pool.query(
      `SELECT id FROM gcc_world.clients WHERE LOWER(email) = $1 LIMIT 1`,
      [cleanEmail],
    );
    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE gcc_world.clients
            SET email_verified = true, approved = true,
                account_type = 'candidate', profile_completed = false,
                client_token = $1, ip_hash = COALESCE($2, ip_hash),
                workspace_username = COALESCE($4, workspace_username),
                workspace_email = COALESCE($5, workspace_email)
          WHERE id = $3`,
        [clientToken, proposal.ip_hash, existing.rows[0].id, workspaceUsername, workspaceEmail],
      );
    } else {
      await pool.query(
        `INSERT INTO gcc_world.clients
            (name, email, alias, email_verified, approved,
             account_type, profile_completed, client_token, ip_hash, last_seen_at,
             workspace_username, workspace_email)
         VALUES ($1, $1, 'Candidato', true, true, 'candidate', false, $2, $3, NOW(), $4, $5)`,
        [cleanEmail, clientToken, proposal.ip_hash, workspaceUsername, workspaceEmail],
      );
    }

    // Marca la postulación como aprobada.
    await pool.query(
      `UPDATE gcc_world.candidate_proposals
          SET status = 'approved', decided_at = NOW(), decided_by = $1
        WHERE id = $2`,
      [user.email ?? 'admin', proposal.id],
    );
    after(() => avisarReclutamiento('postulacion_decidida', {
      titulo: 'Postulación aprobada',
      mensaje: `${cleanEmail} · la aprobó ${user.email}.`,
      consulta: 'tab=solicitudes',
      excluirUserId: user.userId,
    }));

    // Correo de aprobación (sin contraseña: el candidato la define al continuar).
    try {
      await sendCandidateApprovalEmail(cleanEmail, clientToken);
    } catch (e) {
      console.error('Approval email failed:', e);
      return NextResponse.json(
        { ok: true, emailSent: false, error: 'Aprobado, pero no se pudo enviar el correo.' },
        { status: 200 },
      );
    }

    return NextResponse.json({ ok: true, emailSent: true, username: workspaceUsername, workspaceEmail });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    console.error('Approve proposal error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Contraseña temporal legible: sin letras que se confunden (l/1, O/0). */
function claveTemporal(): string {
  const letras = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 10 }, () => letras[randomInt(letras.length)]).join('');
}

const SIN_PERMISO = /unauthorized_client|insufficient|forbidden|not authorized|403/i;

async function aprobarConCorreoCorporativo(proposal: any, desde: string | null, user: { email?: string | null; userId: string }) {
  const personal = String(proposal.email).trim().toLowerCase();
  const nombres = {
    firstName: proposal.primer_nombre, secondName: proposal.segundo_nombre,
    firstSurname: proposal.primer_apellido, secondSurname: proposal.segundo_apellido,
  };
  const nombreCompleto = [proposal.primer_nombre, proposal.segundo_nombre, proposal.primer_apellido, proposal.segundo_apellido].filter(Boolean).join(' ');
  const errorGoogle = (e: any, texto: string) => NextResponse.json({ error: SIN_PERMISO.test(e?.message || '')
    ? 'Falta autorizar en la consola de Google los permisos de grupos para crear el correo corporativo.'
    : `${texto}: ${e?.message || 'error'}` }, { status: 502 });

  let usuario: string;
  try { usuario = await usuarioLibre(nombres, desde); }
  catch (e: any) { return errorGoogle(e, 'No se pudo generar el usuario corporativo'); }
  const correo = `${usuario}@grupocc.org`;

  // 1. Google primero: si no se puede crear la dirección, no se aprueba nada.
  try { await crearGrupoReenvio({ email: correo, nombre: nombreCompleto, correoPersonal: personal }); }
  catch (e: any) { console.error('[candidatos] crear grupo', correo, e?.message); return errorGoogle(e, `Google no creó ${correo}`); }

  // 2. La cuenta del candidato, aprobada y sin contraseña: solo la temporal, que vence en 7 días (se guarda su hash).
  const clave = claveTemporal();
  const vence = new Date(Date.now() + 7 * 24 * 3600_000);
  try {
    await pool.query(`ALTER TABLE gcc_world.clients
      ADD COLUMN IF NOT EXISTS account_type text DEFAULT 'candidate', ADD COLUMN IF NOT EXISTS approved boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS profile_completed boolean DEFAULT false, ADD COLUMN IF NOT EXISTS workspace_username text,
      ADD COLUMN IF NOT EXISTS workspace_email text, ADD COLUMN IF NOT EXISTS workspace_tipo text,
      ADD COLUMN IF NOT EXISTS alta_clave_hash text, ADD COLUMN IF NOT EXISTS alta_clave_vence timestamptz,
      ADD COLUMN IF NOT EXISTS full_name text`);
    const claveHash = await hashPassword(clave);
    // `name` es varchar y `full_name` text: el mismo parámetro en los dos va con `::text`, o Postgres no sabe de qué
    // tipo es («inconsistent types deduced for parameter», 2026-11-13: la aprobación fallaba en silencio).
    const { rows: [existe] } = await pool.query(`SELECT id FROM gcc_world.clients WHERE LOWER(email) = $1 LIMIT 1`, [personal]);
    if (existe) {
      await pool.query(
        `UPDATE gcc_world.clients SET email_verified = true, approved = true, account_type = 'candidate', profile_completed = false,
                workspace_username = $2, workspace_email = $3, workspace_tipo = 'grupo', alta_clave_hash = $4, alta_clave_vence = $5,
                full_name = $6::text, name = $6::text, client_token = $7
          WHERE id = $1`,
        [existe.id, usuario, correo, claveHash, vence, nombreCompleto, generateClientToken()],
      );
    } else {
      await pool.query(
        `INSERT INTO gcc_world.clients (name, full_name, email, alias, email_verified, approved, account_type, profile_completed,
            client_token, ip_hash, last_seen_at, workspace_username, workspace_email, workspace_tipo, alta_clave_hash, alta_clave_vence)
         VALUES ($1::text, $1::text, $2, 'Candidato', true, true, 'candidate', false, $3, $4, NOW(), $5, $6, 'grupo', $7, $8)`,
        [nombreCompleto, personal, generateClientToken(), proposal.ip_hash, usuario, correo, claveHash, vence],
      );
    }
    await pool.query(
      `UPDATE gcc_world.candidate_proposals SET status = 'approved', decided_at = NOW(), decided_by = $1 WHERE id = $2`,
      [user.email ?? 'admin', proposal.id],
    );
  } catch (e: any) {
    await borrarGrupo(correo).catch(() => {});
    throw e;
  }

  after(() => avisarReclutamiento('postulacion_decidida', {
    titulo: 'Postulación aprobada',
    mensaje: `${nombreCompleto} · ${correo} · la aprobó ${user.email}.`,
    consulta: 'tab=solicitudes',
    excluirUserId: user.userId,
  }));

  // 3. La credencial, al correo PERSONAL (ver `lib/candidatos/credencial.ts`).
  try {
    const { rows: [cl] } = await pool.query(`SELECT id FROM gcc_world.clients WHERE LOWER(email) = $1 LIMIT 1`, [personal]);
    await emitirCredencialAlta(cl.id, proposal.primer_nombre);
  } catch (e: any) {
    console.error('[candidatos] credencial', correo, e?.message);
    return NextResponse.json({ ok: true, emailSent: false, username: usuario, workspaceEmail: correo,
      error: `Aprobado y creado ${correo}, pero no se pudo enviar la credencial.` });
  }
  return NextResponse.json({ ok: true, emailSent: true, username: usuario, workspaceEmail: correo });
}
