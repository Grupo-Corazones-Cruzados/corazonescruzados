import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { pool } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { candidatoDeLaSesionAlta, completarCuentaCorporativa } from '@/lib/auth/alta-candidato';
import { ensureAdminMember } from '@/lib/ensure-admin-member';
import { TALENTOS, TALENTOS_SET } from '@/lib/centralized/talentos';
import { IDIOMAS, ESTADOS, JORNADAS, MODALIDADES, DIAS_SEMANA } from '@/lib/perfil/opciones';
import { prepararHorario } from '@/lib/perfil/horario';
import { guardarEmisor } from '@/lib/facturacion-emisores';

export const dynamic = 'force-dynamic';

/**
 * EL FORMULARIO DE ALTA DEL CANDIDATO APROBADO, COMPLETO Y OBLIGATORIO (Fernando, 2026-11-14): «que ese formulario
 * solicite todos los datos asociados al CV, disponibilidad o al perfil del usuario de forma obligatoria para poder
 * ingresar a la plataforma… incluso foto; a excepción de facturación, que es opcional».
 *
 * Se guarda TODO donde lo leen Configuración y el CV público, no en otra parte (antes el teléfono quedaba en
 * `clients` y el perfil lo lee de `users`, así que no aparecía):
 *  · `users`: nombre, apellido, teléfono y foto (`avatar_url`).
 *  · `member_cv_profiles` (por `member_id`): biografía, talentos con su educación y experiencia, ubicación,
 *    idiomas, aspiración salarial y disponibilidad laboral (`job_*`).
 *  · `member_schedules`: el horario semanal.
 *  · `sri_emisores`: la cuenta de emisor, solo si dio su RUC (opcional).
 * La cuenta solo queda utilizable al final, cuando se pone su contraseña y se marca `profile_completed`: si algo falla
 * a mitad, el candidato vuelve a enviar el formulario y nadie entra con el perfil a medias.
 */

const MAX_FOTO = 600_000; // caracteres del data: URL (la foto llega ya reducida a 400 px en el navegador)

/** GET — el candidato de la sesión de alta, con sus nombres de la postulación y las listas del formulario. */
export async function GET() {
  const c = await candidatoDeLaSesionAlta();
  if (!c) return NextResponse.json({ error: 'Ingresa con tu correo corporativo y la contraseña temporal.' }, { status: 401 });
  const { rows: [p] } = await pool.query(
    `SELECT primer_nombre, segundo_nombre, primer_apellido, segundo_apellido FROM gcc_world.candidate_proposals
      WHERE LOWER(email) = LOWER($1) ORDER BY id DESC LIMIT 1`, [c.personal]);
  return NextResponse.json({
    nombre: c.full_name, correo: c.workspace_email,
    nombres: p ? [p.primer_nombre, p.segundo_nombre].filter(Boolean).join(' ') : '',
    apellidos: p ? [p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ') : '',
    talentos: TALENTOS,
  });
}

type Fallo = { error: string };
const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const anio = (v: unknown) => { const n = Number(v); return Number.isInteger(n) && n >= 1950 && n <= 2100 ? n : null; };

/** Valida y limpia todo el formulario. Devuelve el perfil listo para guardar o el primer error, en palabras. */
function leerFormulario(b: any): { ok: true; d: any } | ({ ok: false } & Fallo) {
  const mal = (error: string) => ({ ok: false as const, error });
  const d: any = {};
  if (typeof b.password !== 'string' || b.password.length < 8) return mal('La contraseña debe tener al menos 8 caracteres.');
  d.password = b.password;
  if (typeof b.foto !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(b.foto)) return mal('Sube tu foto de perfil.');
  if (b.foto.length > MAX_FOTO) return mal('La foto es demasiado grande. Prueba con otra.');
  d.foto = b.foto;
  d.nombre = texto(b.nombre, 80); d.apellido = texto(b.apellido, 80);
  if (!d.nombre || !d.apellido) return mal('Escribe tu nombre y tu apellido.');
  d.telefono = texto(b.telefono, 30);
  if (!/^\+?[0-9 ()-]{7,30}$/.test(d.telefono)) return mal('Escribe un teléfono válido, con el código del país.');
  d.ubicacion = texto(b.ubicacion, 120);
  if (!d.ubicacion) return mal('Escribe tu ubicación (ciudad y país).');
  d.salarioMin = Number(b.salarioMin); d.salarioMax = Number(b.salarioMax);
  if (!(d.salarioMin > 0) || !(d.salarioMax >= d.salarioMin) || d.salarioMax > 1_000_000) return mal('Escribe tu aspiración salarial: «hasta» no puede ser menor que «desde».');
  d.idiomas = Array.isArray(b.idiomas) ? Array.from(new Set(b.idiomas.filter((x: unknown) => IDIOMAS.includes(String(x))))).slice(0, 20) : [];
  if (!d.idiomas.length) return mal('Elige al menos un idioma.');
  d.bio = texto(b.bio, 2000);
  if (d.bio.length < 30) return mal('Escribe tu biografía (al menos 30 caracteres).');

  // Los talentos son OPCIONALES (Fernando, 2026-11-14: «si no tiene talento registrado, déjalo que pueda avanzar»);
  // el que se elige sí lleva su educación y su experiencia.
  const talentos = Array.isArray(b.talentos) ? b.talentos.slice(0, 10) : [];
  d.talentos = [];
  for (const t of talentos) {
    const key = String(t?.key || '');
    if (!TALENTOS_SET.has(key)) return mal(`El talento «${key}» no está en la lista.`);
    const edu = (Array.isArray(t.education) ? t.education : []).slice(0, 10).map((e: any) => ({
      institution: texto(e?.institution, 150), degree: texto(e?.degree, 150), field: texto(e?.field, 150),
      start_year: anio(e?.start_year), end_year: anio(e?.end_year),
    }));
    const exp = (Array.isArray(t.experience) ? t.experience : []).slice(0, 10).map((e: any) => ({
      company: texto(e?.company, 150), position: texto(e?.position, 150), description: texto(e?.description, 1000),
      start_year: anio(e?.start_year), end_year: anio(e?.end_year),
    }));
    if (!edu.length || edu.some((e: any) => !e.institution || !e.degree || !e.start_year)) return mal(`En «${key}», completa la educación: institución, título y año de inicio.`);
    if (!exp.length || exp.some((e: any) => !e.company || !e.position || !e.start_year)) return mal(`En «${key}», completa la experiencia: empresa, cargo y año de inicio.`);
    if ([...edu, ...exp].some((e: any) => e.end_year && e.end_year < e.start_year)) return mal(`En «${key}», el año de fin no puede ser anterior al de inicio.`);
    d.talentos.push({ key, education: edu, experience: exp, skills: [] });
  }

  d.jobStatus = String(b.jobStatus || '');
  if (!ESTADOS.some((e) => e.v === d.jobStatus)) return mal('Elige cuándo puedes empezar.');
  d.jobDesde = d.jobStatus === 'from_date' ? texto(b.jobDesde, 10) : null;
  if (d.jobStatus === 'from_date' && !/^\d{4}-\d{2}-\d{2}$/.test(d.jobDesde || '')) return mal('Elige la fecha desde la que puedes empezar.');
  d.jornada = String(b.jornada || ''); d.modalidad = String(b.modalidad || '');
  if (!JORNADAS.some((j) => j.v === d.jornada)) return mal('Elige la jornada.');
  if (!MODALIDADES.some((m) => m.v === d.modalidad)) return mal('Elige la modalidad.');

  const hora = (v: unknown) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null);
  d.horario = DIAS_SEMANA.map((dia) => {
    const x = b.horario?.[dia.k];
    return { activo: !!x?.active, inicio: hora(x?.start) || '09:00', fin: hora(x?.end) || '18:00' };
  });
  if (!d.horario.some((h: any) => h.activo)) return mal('Marca al menos un día en tu horario.');
  if (d.horario.some((h: any) => h.activo && h.fin <= h.inicio)) return mal('En el horario, la hora de fin debe ser posterior a la de inicio.');
  // Facturación OPCIONAL: si trae RUC, se registra como en Configuración ▸ Facturación (`guardarEmisor` lo valida entero).
  d.facturacion = b.facturacion && typeof b.facturacion === 'object' && String(b.facturacion.ruc || '').trim() ? b.facturacion : null;
  return { ok: true, d };
}

/** POST — el formulario entero. Crea la cuenta solo si TODO está completo. */
export async function POST(req: Request) {
  const c = await candidatoDeLaSesionAlta();
  if (!c) return NextResponse.json({ error: 'La sesión del formulario venció. Ingresa otra vez con la contraseña temporal.' }, { status: 401 });
  const r = leerFormulario(await req.json().catch(() => ({})));
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  const d = r.d;
  const correo = String(c.workspace_email).trim().toLowerCase();

  try {
    // 1. La fila de `users` con su perfil, todavía SIN una contraseña que sirva (una al azar): hasta el paso 4 no entra.
    await pool.query(`ALTER TABLE gcc_world.users ADD COLUMN IF NOT EXISTS workspace_email text`);
    const { rows: [u] } = await pool.query(`SELECT id FROM gcc_world.users WHERE LOWER(email) = $1 LIMIT 1`, [correo]);
    let userId: string;
    if (u) {
      userId = u.id;
      await pool.query(`UPDATE gcc_world.users SET first_name = $2, last_name = $3, phone = $4, avatar_url = $5, updated_at = NOW() WHERE id = $1`,
        [userId, d.nombre, d.apellido, d.telefono, d.foto]);
    } else {
      const { rows: [n] } = await pool.query(
        `INSERT INTO gcc_world.users (email, password_hash, role, is_verified, first_name, last_name, phone, avatar_url, workspace_email)
         VALUES ($1, $2, 'client', true, $3, $4, $5, $6, $1) RETURNING id`,
        [correo, await hashPassword(randomBytes(32).toString('hex')), d.nombre, d.apellido, d.telefono, d.foto]);
      userId = n.id;
    }
    await pool.query(`UPDATE gcc_world.clients SET user_id = $1, phone = $2, full_name = $3 WHERE id = $4`,
      [userId, d.telefono, `${d.nombre} ${d.apellido}`, c.id]);

    // 1-bis. Su cuenta de emisor, si dio el RUC. Si el SRI no lo aceptaría, se avisa y no se sigue.
    if (d.facturacion) {
      const f = d.facturacion;
      const g = await guardarEmisor(userId, { ruc: f.ruc, razonSocial: f.razonSocial, nombreComercial: f.nombreComercial,
        dirMatriz: f.dirMatriz, regimen: f.regimen, obligadoContabilidad: f.obligadoContabilidad === true,
        cobraIva: f.cobraIva === true, tarifaIva: f.tarifaIva });
      if (!g.ok) return NextResponse.json({ error: `Facturación: ${g.error}` }, { status: 400 });
    }

    // 2. Su ficha de miembro (la que piden el CV y la disponibilidad), como hace el panel al entrar.
    const memberId = await ensureAdminMember(userId, correo, `${d.nombre} ${d.apellido}`);
    if (!memberId) throw new Error('No se pudo crear la ficha del candidato.');

    // 3. El CV, la disponibilidad laboral y el horario.
    await pool.query(
      `INSERT INTO gcc_world.member_cv_profiles (member_id, bio, education, experience, talents, location, languages,
              salary_min, salary_max, job_status, job_available_from, job_workday, job_mode)
       VALUES ($1, $2, '[]'::jsonb, '[]'::jsonb, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (member_id) DO UPDATE SET bio = EXCLUDED.bio, talents = EXCLUDED.talents, location = EXCLUDED.location,
              languages = EXCLUDED.languages, salary_min = EXCLUDED.salary_min, salary_max = EXCLUDED.salary_max,
              job_status = EXCLUDED.job_status, job_available_from = EXCLUDED.job_available_from,
              job_workday = EXCLUDED.job_workday, job_mode = EXCLUDED.job_mode, updated_at = NOW()`,
      [memberId, d.bio, JSON.stringify(d.talentos), d.ubicacion, d.idiomas, d.salarioMin, d.salarioMax,
        d.jobStatus, d.jobDesde, d.jornada, d.modalidad]);
    await prepararHorario();
    await pool.query(`DELETE FROM gcc_world.member_schedules WHERE member_id = $1`, [memberId]);
    for (let i = 0; i < d.horario.length; i++) {
      const h = d.horario[i];
      await pool.query(`INSERT INTO gcc_world.member_schedules (member_id, day_of_week, is_active, start_time, end_time) VALUES ($1, $2, $3, $4, $5)`,
        [memberId, i + 1, h.activo, h.inicio, h.fin]);
    }

    // 4. Ahora sí: su contraseña, la cuenta completa y la sesión del panel.
    await completarCuentaCorporativa(c, await hashPassword(d.password));
  } catch (e: any) {
    console.error('[alta] completar', correo, e?.message);
    return NextResponse.json({ error: 'No se pudo crear tu cuenta. Vuelve a intentarlo en un momento.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, destino: '/dashboard' });
}
