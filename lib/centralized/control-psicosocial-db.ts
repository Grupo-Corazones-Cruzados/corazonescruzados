import { createHash, randomBytes } from 'node:crypto';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { enviarDatosFcm } from '@/lib/push/fcm';
import { enviarAvisoApns, type EntornoApns } from '@/lib/push/apns';
import { enviarPush } from '@/lib/push';
import { createNotification } from '@/lib/notifications';
import {
  DIAS_HISTORIAL, INTERVALO_AUXILIO_S, INTERVALO_NORMAL_S, RUTA_CONTROL_PSICOSOCIAL,
  VERSION_CONSENTIMIENTO, type FilaRastreo, type FuncionCp,
} from '@/lib/centralized/control-psicosocial';

/**
 * CONTROL PSICOSOCIAL — datos y permisos. Las reglas se fuerzan aquí, no en las rutas.
 *
 * MIEMBRO = `role` admin o member Y `member_id`. Solo `member_id` no basta: un candidato
 * (role client) también lo tiene, para su hoja de vida.
 *
 * QUIÉN VE QUÉ: cada uno, lo suyo; el admin, a todos los que aceptaron; cualquier miembro, a quien
 * tiene un auxilio abierto. Nadie puede activar el rastreo de otro.
 */

const NOMBRE = `COALESCE(NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''), m.name, u.email)`;
const ES_MIEMBRO = `u.role IN ('admin', 'member') AND u.member_id IS NOT NULL`;

export type Miembro = { userId: string; isAdmin: boolean; suplantado: boolean; dispositivoId: number | null };

/** La persona de la sesión, si es miembro. Lo que lee la pantalla. */
export async function miembroDeSesion(): Promise<Miembro | null> {
  const s = await getCurrentUser();
  if (!s || !['admin', 'member'].includes(s.role)) return null;
  const { rows } = await pool.query(`SELECT 1 FROM gcc_world.users u WHERE u.id = $1 AND ${ES_MIEMBRO}`, [s.userId]);
  if (!rows.length) return null;
  return { userId: s.userId, isAdmin: s.role === 'admin', suplantado: !!s.suplantadoPor, dispositivoId: null };
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/** El teléfono (con su llave) o, si no la trae, la sesión. Lo que escribe posiciones y alertas. */
export async function miembroDeLlamada(req: Request): Promise<Miembro | null> {
  const token = req.headers.get('x-cp-dispositivo');
  if (!token) return miembroDeSesion();
  const { rows: [d] } = await pool.query(
    `UPDATE gcc_world.cp_dispositivos d SET ultimo_contacto = NOW()
       FROM gcc_world.users u
      WHERE d.token_hash = $1 AND d.revocado_en IS NULL AND u.id = d.user_id AND ${ES_MIEMBRO}
      RETURNING d.id, d.user_id, u.role`,
    [hash(token)],
  );
  return d ? { userId: d.user_id, isAdmin: d.role === 'admin', suplantado: false, dispositivoId: d.id } : null;
}

/* ── Consentimiento y dispositivo ─────────────────────────────────────────── */

export async function fijarConsentimiento(userId: string, funcion: FuncionCp, activo: boolean, plataforma: string | null) {
  const columna = funcion === 'ubicacion' ? 'ubicacion_activa' : 'voz_activa';
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(
      `INSERT INTO gcc_world.cp_miembros (user_id, ${columna}) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET ${columna} = EXCLUDED.${columna}, actualizado_en = NOW()`,
      [userId, activo],
    );
    await c.query(
      `INSERT INTO gcc_world.cp_consentimientos (user_id, funcion, accion, version, plataforma) VALUES ($1, $2, $3, $4, $5)`,
      [userId, funcion, activo ? 'otorgado' : 'retirado', VERSION_CONSENTIMIENTO, plataforma],
    );
    // Apagar la ubicación borra el recorrido. Lo registrado durante un auxilio queda con él.
    if (funcion === 'ubicacion' && !activo) {
      await c.query(`DELETE FROM gcc_world.cp_posiciones WHERE user_id = $1 AND alerta_id IS NULL`, [userId]);
    }
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

/** La llave se devuelve solo aquí; en la base queda su hash. */
export async function crearDispositivo(userId: string, plataforma: 'android' | 'ios'): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await pool.query(
    `INSERT INTO gcc_world.cp_dispositivos (user_id, token_hash, plataforma) VALUES ($1, $2, $3)`,
    [userId, hash(token), plataforma],
  );
  return token;
}

export async function revocarDispositivo(id: number) {
  await pool.query(`UPDATE gcc_world.cp_dispositivos SET revocado_en = NOW() WHERE id = $1 AND revocado_en IS NULL`, [id]);
}

/* ── Posiciones ───────────────────────────────────────────────────────────── */

export type Punto = { lat: number; lng: number; precision: number | null; bateria: number | null; en: Date };

/** Convierte lo recibido en puntos válidos; lo inválido o con fecha imposible se descarta. */
export function validarPuntos(lista: unknown): Punto[] {
  if (!Array.isArray(lista)) return [];
  const puntos: Punto[] = [];
  for (const p of lista.slice(0, 100) as any[]) {
    const lat = Number(p?.lat); const lng = Number(p?.lng);
    const en = p?.en ? new Date(p.en) : new Date();
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    if (Number.isNaN(en.getTime()) || en.getTime() > Date.now() + 5 * 60_000) continue;
    const precision = Number(p?.precision); const bateria = Number(p?.bateria);
    puntos.push({
      lat, lng, en,
      precision: Number.isFinite(precision) && precision >= 0 ? precision : null,
      bateria: Number.isInteger(bateria) && bateria >= 0 && bateria <= 100 ? bateria : null,
    });
  }
  return puntos;
}

let ultimaPurga = 0;
function purgarSiToca() {
  if (Date.now() - ultimaPurga < 3_600_000) return;
  ultimaPurga = Date.now();
  pool.query(
    `DELETE FROM gcc_world.cp_posiciones WHERE alerta_id IS NULL AND registrada_en < NOW() - make_interval(days => $1)`,
    [DIAS_HISTORIAL],
  ).catch((e: any) => console.error('Purga de posiciones:', e?.message));
}

/** `consentida: false` le dice al teléfono que debe parar: nada se guarda sin consentimiento. */
export async function guardarPosiciones(m: Miembro, puntos: Punto[]) {
  const { rows: [e] } = await pool.query(
    `SELECT c.ubicacion_activa, c.voz_activa,
            (SELECT a.id FROM gcc_world.cp_alertas a WHERE a.user_id = $1 AND a.estado = 'activa') AS alerta_id
       FROM gcc_world.cp_miembros c WHERE c.user_id = $1`,
    [m.userId],
  );
  if (!e?.ubicacion_activa) return { consentida: false, voz: !!e?.voz_activa, intervalo_s: INTERVALO_NORMAL_S, alerta_id: null };
  if (puntos.length) {
    await pool.query(
      `INSERT INTO gcc_world.cp_posiciones (user_id, dispositivo_id, alerta_id, lat, lng, precision_m, bateria, registrada_en)
       SELECT $1::uuid, $2::int, $3::int, * FROM UNNEST($4::float8[], $5::float8[], $6::real[], $7::smallint[], $8::timestamptz[])`,
      [m.userId, m.dispositivoId, e.alerta_id, puntos.map((p) => p.lat), puntos.map((p) => p.lng),
        puntos.map((p) => p.precision), puntos.map((p) => p.bateria), puntos.map((p) => p.en.toISOString())],
    );
  }
  purgarSiToca();
  return {
    consentida: true, voz: e.voz_activa, alerta_id: e.alerta_id as number | null,
    intervalo_s: e.alerta_id ? INTERVALO_AUXILIO_S : INTERVALO_NORMAL_S,
  };
}

/* ── Lo que enseña la pantalla ─────────────────────────────────────────────── */

const FILA = `
  SELECT u.id AS user_id, ${NOMBRE} AS nombre,
         COALESCE(c.ubicacion_activa, false) AS ubicacion_activa, COALESCE(c.voz_activa, false) AS voz_activa,
         p.lat, p.lng, p.precision_m, p.bateria, p.registrada_en, a.id AS alerta_id
    FROM gcc_world.users u
    LEFT JOIN gcc_world.members m ON m.id = u.member_id
    LEFT JOIN gcc_world.cp_miembros c ON c.user_id = u.id
    LEFT JOIN gcc_world.cp_alertas a ON a.user_id = u.id AND a.estado = 'activa'
    LEFT JOIN LATERAL (
      SELECT lat, lng, precision_m, bateria, registrada_en FROM gcc_world.cp_posiciones x
       -- Quien retiró el consentimiento ya no enseña posición, salvo la de su auxilio abierto.
       WHERE x.user_id = u.id AND (c.ubicacion_activa OR x.alerta_id = a.id)
       ORDER BY x.registrada_en DESC LIMIT 1
    ) p ON true
   WHERE ${ES_MIEMBRO}`;

export async function estadoRastreo(m: Miembro) {
  const { rows: filas } = await pool.query(
    m.isAdmin
      ? `${FILA} ORDER BY a.id IS NULL, nombre`
      : `${FILA} AND (u.id = $1 OR a.id IS NOT NULL) ORDER BY a.id IS NULL, nombre`,
    m.isAdmin ? [] : [m.userId],
  );
  const { rows: accesos } = await pool.query(
    `SELECT ${NOMBRE} AS nombre, ac.creado_en
       FROM gcc_world.cp_accesos ac
       JOIN gcc_world.users u ON u.id = ac.quien
       LEFT JOIN gcc_world.members m ON m.id = u.member_id
      WHERE ac.a_quien = $1 ORDER BY ac.creado_en DESC LIMIT 20`,
    [m.userId],
  );
  const yo = (filas as FilaRastreo[]).find((f) => f.user_id === m.userId);
  return {
    user_id: m.userId,
    es_admin: m.isAdmin,
    ubicacion_activa: !!yo?.ubicacion_activa,
    voz_activa: !!yo?.voz_activa,
    mi_alerta_id: yo?.alerta_id ?? null,
    filas,
    accesos,
  };
}

/** Detalle de un miembro, si quien pregunta puede verlo. Mirar a otro queda registrado. */
export async function detalleMiembro(m: Miembro, objetivo: string) {
  const { rows: [fila] } = await pool.query(`${FILA} AND u.id = $1`, [objetivo]);
  if (!fila) return null;
  if (objetivo !== m.userId && !m.isAdmin && !fila.alerta_id) return null;
  if (objetivo !== m.userId) {
    // El panel refresca cada pocos segundos: una misma consulta cuenta una vez cada media hora.
    await pool.query(
      `INSERT INTO gcc_world.cp_accesos (quien, a_quien)
       SELECT $1::uuid, $2::uuid WHERE NOT EXISTS (
         SELECT 1 FROM gcc_world.cp_accesos
          WHERE quien = $1::uuid AND a_quien = $2::uuid AND creado_en > NOW() - INTERVAL '30 minutes')`,
      [m.userId, objetivo],
    );
  }
  const { rows: recorrido } = fila.alerta_id
    ? await pool.query(
      `SELECT lat, lng, precision_m, registrada_en FROM gcc_world.cp_posiciones
        WHERE alerta_id = $1 ORDER BY registrada_en DESC LIMIT 100`, [fila.alerta_id])
    : { rows: [] };
  const { rows: [alerta] } = fila.alerta_id
    ? await pool.query(`SELECT id, origen, lat, lng, creada_en FROM gcc_world.cp_alertas WHERE id = $1`, [fila.alerta_id])
    : { rows: [null] };
  return { ...fila, alerta: alerta ?? null, recorrido };
}

/* ── Auxilio ──────────────────────────────────────────────────────────────── */

/**
 * Esta vía NO pasa por `avisarUsuarios`: aquel se salta a quien apagó una clase de avisos, y un
 * auxilio tiene que llegar a todos. Android recibe el `tipo=aviso` de siempre (una APK antigua
 * también lo enseña) con `urgente=1`, que la nueva pinta en su canal de emergencia.
 */
async function avisarATodos(excepto: string, titulo: string, cuerpo: string, ruta: string, urgente: boolean) {
  const { rows: personas } = await pool.query(
    `SELECT u.id FROM gcc_world.users u WHERE ${ES_MIEMBRO} AND u.id <> $1`, [excepto]);
  const ids: string[] = personas.map((p: any) => p.id);
  if (!ids.length) return { destinatarios: 0, con_telefono: 0 };
  const { rows: tokens } = await pool.query(
    `SELECT user_id, token, kind, entorno FROM gcc_world.push_devices
      WHERE user_id = ANY($1::uuid[]) AND kind IN ('fcm', 'apns')`, [ids]);
  await Promise.all([
    enviarDatosFcm(tokens.filter((t: any) => t.kind === 'fcm').map((t: any) => t.token), {
      tipo: 'aviso', titulo, cuerpo, ruta, ...(urgente ? { urgente: '1' } : {}),
    }),
    enviarAvisoApns(
      tokens.filter((t: any) => t.kind === 'apns')
        .map((t: any) => ({ token: t.token, entorno: (t.entorno || 'production') as EntornoApns })),
      { titulo, cuerpo, ruta, urgente },
    ),
    ...ids.map((id) => enviarPush(id, { titulo, cuerpo, url: ruta, insistir: urgente }, 3600)
      .catch((e: any) => console.error('Auxilio al navegador:', e?.message))),
    ...ids.map((id) => createNotification(id, { type: 'auxilio', title: titulo, message: cuerpo, link: ruta }, { push: false })
      .catch((e: any) => console.error('Auxilio a la campana:', e?.message))),
  ]);
  return { destinatarios: ids.length, con_telefono: new Set(tokens.map((t: any) => t.user_id)).size };
}

async function nombreDe(userId: string): Promise<string> {
  const { rows: [r] } = await pool.query(
    `SELECT ${NOMBRE} AS nombre FROM gcc_world.users u LEFT JOIN gcc_world.members m ON m.id = u.member_id WHERE u.id = $1`,
    [userId]);
  return r?.nombre || 'Un miembro';
}

/** Repetirlo con uno abierto no vuelve a avisar: devuelve el que ya existe. */
export async function pedirAuxilio(m: Miembro, origen: 'boton' | 'voz', lat: number | null, lng: number | null) {
  const { rows: [nueva] } = await pool.query(
    `INSERT INTO gcc_world.cp_alertas (user_id, origen, lat, lng) VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) WHERE estado = 'activa' DO NOTHING RETURNING id`,
    [m.userId, origen, lat, lng],
  );
  if (!nueva) {
    const { rows: [ya] } = await pool.query(
      `SELECT id FROM gcc_world.cp_alertas WHERE user_id = $1 AND estado = 'activa'`, [m.userId]);
    return { id: ya?.id as number, repetida: true, destinatarios: 0, con_telefono: 0 };
  }
  // Se espera al envío: si Railway reinicia, un `after()` se llevaría el aviso por delante.
  const ruta = `${RUTA_CONTROL_PSICOSOCIAL}?miembro=${m.userId}`;
  const r = await avisarATodos(m.userId, `Auxilio: ${await nombreDe(m.userId)}`,
    'Está pidiendo auxilio. Toca para ver dónde está.', ruta, true);
  return { id: nueva.id as number, repetida: false, ...r };
}

/** Solo quien lo pidió o el admin. */
export async function cerrarAuxilio(m: Miembro, id: number, motivo: 'resuelta' | 'falsa') {
  const { rows: [a] } = await pool.query(
    `UPDATE gcc_world.cp_alertas SET estado = 'cerrada', motivo = $3, cerrada_en = NOW(), cerrada_por = $2
      WHERE id = $1 AND estado = 'activa' AND (user_id = $2 OR $4::boolean) RETURNING user_id`,
    [id, m.userId, motivo, m.isAdmin],
  );
  if (!a) return false;
  await avisarATodos(a.user_id, `Auxilio cerrado: ${await nombreDe(a.user_id)}`,
    motivo === 'falsa' ? 'Fue una falsa alarma.' : 'La situación quedó resuelta.', RUTA_CONTROL_PSICOSOCIAL, false);
  return true;
}
