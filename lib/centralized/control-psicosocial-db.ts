import { createHash, randomBytes } from 'node:crypto';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { enviarDatosFcm } from '@/lib/push/fcm';
import { enviarAvisoApns, type EntornoApns } from '@/lib/push/apns';
import { enviarPush } from '@/lib/push';
import { avisarUsuarios } from '@/lib/push/avisos';
import { createNotification } from '@/lib/notifications';
import {
  DIAS_HISTORIAL, INTERVALO_AUXILIO_S, INTERVALO_NORMAL_S, RUTA_CONTROL_PSICOSOCIAL, VERSION_CONSENTIMIENTO, ZONA_HORARIA,
  distanciaM, type FilaRastreo, type FuncionCp, type Lugar, type RecorridoMiembro,
} from '@/lib/centralized/control-psicosocial';

/**
 * CONTROL PSICOSOCIAL — datos y permisos. Las reglas se fuerzan aquí, no en las rutas.
 *
 * MIEMBRO = `role` admin o member Y `member_id`. Solo `member_id` no basta: un candidato
 * (role client) también lo tiene, para su hoja de vida.
 *
 * QUIÉN VE QUÉ (Fernando, 2026-11-04/05): todo miembro ve a todos los que aceptaron compartir, incluido
 * el administrador, con su recorrido, y queda registrado. Nadie puede activar el rastreo de otro. Los
 * puntos de reunión los ven todos y solo los administradores los crean, cambian o borran.
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
    if (funcion === 'ubicacion' && activo) {
      await c.query(`UPDATE gcc_world.cp_miembros SET ubicacion_version = $2 WHERE user_id = $1`, [userId, VERSION_CONSENTIMIENTO]);
    }
    await c.query(
      `INSERT INTO gcc_world.cp_consentimientos (user_id, funcion, accion, version, plataforma) VALUES ($1, $2, $3, $4, $5)`,
      [userId, funcion, activo ? 'otorgado' : 'retirado', VERSION_CONSENTIMIENTO, plataforma],
    );
    // Apagar la ubicación borra el recorrido. Lo registrado durante un auxilio queda con él.
    if (funcion === 'ubicacion' && !activo) {
      await c.query(`DELETE FROM gcc_world.cp_posiciones WHERE user_id = $1 AND alerta_id IS NULL`, [userId]);
      await c.query(`DELETE FROM gcc_world.cp_visitas WHERE user_id = $1`, [userId]);
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
  pool.query(
    `DELETE FROM gcc_world.cp_visitas WHERE salida_en IS NOT NULL AND salida_en < NOW() - make_interval(days => $1)`,
    [DIAS_HISTORIAL],
  ).catch((e: any) => console.error('Purga de visitas:', e?.message));
}

/** `consentida: false` le dice al teléfono que debe parar: nada se guarda sin consentimiento. */
export async function guardarPosiciones(m: Miembro, puntos: Punto[]) {
  const { rows: [e] } = await pool.query(
    `SELECT c.ubicacion_activa, c.voz_activa, c.ubicacion_version,
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
    // Una llegada que falla no puede costar la posición, que ya está guardada.
    if (e.ubicacion_version >= VERSION_CONSENTIMIENTO) {
      await detectarLlegadas(m.userId, puntos).catch((err: any) => console.error('Llegadas:', err?.message));
    }
  }
  purgarSiToca();
  return {
    consentida: true, voz: e.voz_activa, alerta_id: e.alerta_id as number | null,
    intervalo_s: e.alerta_id ? INTERVALO_AUXILIO_S : INTERVALO_NORMAL_S,
  };
}

/* ── Puntos de reunión ────────────────────────────────────────────────────── */

/** Lo inválido devuelve `null`: la ruta responde 400. */
export function datosDeLugar(b: any): Omit<Lugar, 'id'> | null {
  const nombre = String(b?.nombre ?? '').trim();
  const lat = Number(b?.lat); const lng = Number(b?.lng); const radio_m = Number(b?.radio_m);
  if (!nombre || nombre.length > 80) return null;
  if (b?.lat == null || b?.lng == null || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (!Number.isInteger(radio_m) || radio_m < 30 || radio_m > 5000) return null;
  return { nombre, lat, lng, radio_m };
}

export async function crearLugar(userId: string, d: Omit<Lugar, 'id'>): Promise<number> {
  const { rows: [r] } = await pool.query(
    `INSERT INTO gcc_world.cp_lugares (nombre, lat, lng, radio_m, creado_por) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [d.nombre, d.lat, d.lng, d.radio_m, userId]);
  return r.id;
}

export async function editarLugar(id: number, d: Omit<Lugar, 'id'>): Promise<boolean> {
  const r = await pool.query(
    `UPDATE gcc_world.cp_lugares SET nombre = $2, lat = $3, lng = $4, radio_m = $5, actualizado_en = NOW() WHERE id = $1`,
    [id, d.nombre, d.lat, d.lng, d.radio_m]);
  return r.rowCount > 0;
}

export async function borrarLugar(id: number): Promise<boolean> {
  return (await pool.query(`DELETE FROM gcc_world.cp_lugares WHERE id = $1`, [id])).rowCount > 0;
}

/** Salir exige alejarse más de lo que pide entrar: si no, el error del GPS en el borde abre y cierra. */
const MARGEN_SALIDA_M = 50;
/** Volver antes de esto es la misma estancia (el GPS saltó, o salió un momento): no se avisa otra vez. */
const MINUTOS_MISMA_VISITA = 30;

/**
 * Las llegadas se detectan AQUÍ y no en el teléfono: valen igual en iPhone y Android, y un lugar
 * nuevo funciona sin instalar nada. A cambio, una llegada se conoce cuando llega un punto.
 */
export async function detectarLlegadas(userId: string, puntos: Punto[]) {
  const { rows: lugares } = await pool.query(`SELECT id, nombre, lat, lng, radio_m FROM gcc_world.cp_lugares`);
  if (!lugares.length) return;
  const { rows: abiertas } = await pool.query(
    `SELECT lugar_id, llegada_en FROM gcc_world.cp_visitas WHERE user_id = $1 AND salida_en IS NULL`, [userId]);
  const dentro = new Map<number, Date>(abiertas.map((v: any) => [v.lugar_id, new Date(v.llegada_en)]));
  const llegadas: { lugar: string; en: Date }[] = [];

  for (const p of [...puntos].sort((a, b) => a.en.getTime() - b.en.getTime())) {
    for (const l of lugares as Lugar[]) {
      const d = distanciaM(p.lat, p.lng, l.lat, l.lng);
      const desde = dentro.get(l.id);
      if (desde) {
        if (p.en > desde && d > l.radio_m + Math.max(MARGEN_SALIDA_M, p.precision ?? 0)) {
          await pool.query(
            `UPDATE gcc_world.cp_visitas SET salida_en = $3 WHERE user_id = $1 AND lugar_id = $2 AND salida_en IS NULL`,
            [userId, l.id, p.en.toISOString()]);
          dentro.delete(l.id);
        }
        continue;
      }
      // Un punto impreciso no basta para decir que llegó.
      if (d > l.radio_m || (p.precision ?? 0) > Math.max(l.radio_m, 100)) continue;
      const { rows: [reabierta] } = await pool.query(
        `UPDATE gcc_world.cp_visitas v SET salida_en = NULL
          WHERE v.id = (SELECT id FROM gcc_world.cp_visitas
                         WHERE user_id = $1 AND lugar_id = $2 ORDER BY llegada_en DESC LIMIT 1)
            AND v.salida_en > $3::timestamptz - make_interval(mins => $4)
          RETURNING v.llegada_en`,
        [userId, l.id, p.en.toISOString(), MINUTOS_MISMA_VISITA]);
      if (reabierta) { dentro.set(l.id, new Date(reabierta.llegada_en)); continue; }
      const { rows: [nueva] } = await pool.query(
        `INSERT INTO gcc_world.cp_visitas (user_id, lugar_id, llegada_en) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, lugar_id) WHERE salida_en IS NULL DO NOTHING RETURNING id`,
        [userId, l.id, p.en.toISOString()]);
      dentro.set(l.id, p.en);
      if (nueva) llegadas.push({ lugar: l.nombre, en: p.en });
    }
  }
  if (llegadas.length) await avisarLlegadas(userId, llegadas);
}

/** A diferencia del auxilio, esto sí respeta lo que cada uno apagó en Configuración → Notificaciones. */
async function avisarLlegadas(userId: string, llegadas: { lugar: string; en: Date }[]) {
  const { rows } = await pool.query(`SELECT u.id FROM gcc_world.users u WHERE ${ES_MIEMBRO} AND u.id <> $1`, [userId]);
  const ids: string[] = rows.map((r: any) => r.id);
  if (!ids.length) return;
  const nombre = await nombreDe(userId);
  const ruta = `${RUTA_CONTROL_PSICOSOCIAL}?miembro=${userId}`;
  for (const { lugar, en } of llegadas) {
    const titulo = `${nombre} llegó a ${lugar}`;
    const cuerpo = `A las ${en.toLocaleTimeString('es-EC', { timeZone: ZONA_HORARIA, hour: '2-digit', minute: '2-digit' })}.`;
    await Promise.all(ids.map((id) => createNotification(id, { type: 'cp_llegada', title: titulo, message: cuerpo, link: ruta }, { push: false })
      .catch((e: any) => console.error('Llegada a la campana:', e?.message))));
    await avisarUsuarios(ids, { clase: 'cp_llegada', titulo, cuerpo, ruta, hilo: 'cp-llegadas' });
  }
}

/* ── Lo que enseña la pantalla ─────────────────────────────────────────────── */

const FILA = `
  SELECT u.id AS user_id, ${NOMBRE} AS nombre,
         COALESCE(c.ubicacion_activa, false) AS ubicacion_activa, COALESCE(c.voz_activa, false) AS voz_activa,
         p.lat, p.lng, p.precision_m, p.bateria, p.registrada_en, a.id AS alerta_id,
         (SELECT l.nombre FROM gcc_world.cp_visitas v JOIN gcc_world.cp_lugares l ON l.id = v.lugar_id
           WHERE v.user_id = u.id AND v.salida_en IS NULL ORDER BY v.llegada_en DESC LIMIT 1) AS lugar_actual
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

/**
 * Lo que enseña el mapa. `soloMio`: lo que el teléfono pregunta al abrirse para alinearse con el
 * servidor; ahí nadie está mirando a nadie, así que no devuelve a otros ni registra consultas.
 */
export async function estadoRastreo(m: Miembro, soloMio = false) {
  const { rows: filas } = await pool.query(
    soloMio ? `${FILA} AND u.id = $1` : `${FILA} ORDER BY a.id IS NULL, nombre`,
    soloMio ? [m.userId] : [],
  );
  if (!soloMio) {
    await registrarAccesos(m.userId, (filas as FilaRastreo[])
      .filter((f) => f.user_id !== m.userId && f.lat != null).map((f) => f.user_id));
  }
  const { rows: accesos } = await pool.query(
    `SELECT ${NOMBRE} AS nombre, ac.creado_en
       FROM gcc_world.cp_accesos ac
       JOIN gcc_world.users u ON u.id = ac.quien
       LEFT JOIN gcc_world.members m ON m.id = u.member_id
      WHERE ac.a_quien = $1 ORDER BY ac.creado_en DESC LIMIT 20`,
    [m.userId],
  );
  const yo = (filas as FilaRastreo[]).find((f) => f.user_id === m.userId);
  const { rows: [version] } = await pool.query(`SELECT ubicacion_version FROM gcc_world.cp_miembros WHERE user_id = $1`, [m.userId]);
  const { rows: lugares } = soloMio ? { rows: [] } : await pool.query(
    `SELECT id, nombre, lat, lng, radio_m FROM gcc_world.cp_lugares ORDER BY nombre`);
  return {
    user_id: m.userId,
    es_admin: m.isAdmin,
    ubicacion_activa: !!yo?.ubicacion_activa,
    // Aceptó un texto anterior: sigue compartiendo lo que aceptó, y se le pide revisar el nuevo.
    ubicacion_al_dia: (version?.ubicacion_version ?? 0) >= VERSION_CONSENTIMIENTO,
    voz_activa: !!yo?.voz_activa,
    mi_alerta_id: yo?.alerta_id ?? null,
    filas,
    accesos,
    lugares,
  };
}

/** Separa dos puntos por debajo de esto y solo engorda la línea: el GPS nunca está quieto del todo. */
const METROS_ENTRE_PUNTOS = 40;
/** Un punto con más error que esto dibuja saltos que nadie hizo. */
const PRECISION_MAXIMA_M = 150;

/** El recorrido de cada miembro en un día. Solo de quien aceptó enseñarlo (versión 3 en adelante). */
export async function recorridosDelDia(m: Miembro, dia: string): Promise<RecorridoMiembro[]> {
  const { rows: gente } = await pool.query(
    `SELECT u.id AS user_id, ${NOMBRE} AS nombre
       FROM gcc_world.users u
       LEFT JOIN gcc_world.members m ON m.id = u.member_id
       JOIN gcc_world.cp_miembros c ON c.user_id = u.id
      WHERE ${ES_MIEMBRO} AND c.ubicacion_activa AND c.ubicacion_version >= $1`,
    [VERSION_CONSENTIMIENTO]);
  if (!gente.length) return [];
  const ids = gente.map((g: any) => g.user_id);
  const rango = `($2::date::timestamp AT TIME ZONE '${ZONA_HORARIA}')`;
  const { rows: puntos } = await pool.query(
    `SELECT user_id, lat, lng, precision_m, registrada_en FROM gcc_world.cp_posiciones
      WHERE user_id = ANY($1::uuid[])
        AND registrada_en >= ${rango} AND registrada_en < ${rango} + INTERVAL '1 day'
      ORDER BY user_id, registrada_en`,
    [ids, dia]);
  const { rows: visitas } = await pool.query(
    `SELECT v.user_id, l.nombre AS lugar, v.llegada_en, v.salida_en
       FROM gcc_world.cp_visitas v JOIN gcc_world.cp_lugares l ON l.id = v.lugar_id
      WHERE v.user_id = ANY($1::uuid[])
        AND v.llegada_en < ${rango} + INTERVAL '1 day' AND (v.salida_en IS NULL OR v.salida_en >= ${rango})
      ORDER BY v.llegada_en`,
    [ids, dia]);

  const salida: RecorridoMiembro[] = gente.map((g: any) => {
    const crudos = puntos.filter((p: any) => p.user_id === g.user_id && (p.precision_m == null || p.precision_m <= PRECISION_MAXIMA_M));
    const finos: RecorridoMiembro['puntos'] = [];
    crudos.forEach((p: any, i: number) => {
      const u = finos[finos.length - 1];
      if (!u || i === crudos.length - 1 || distanciaM(u.lat, u.lng, p.lat, p.lng) >= METROS_ENTRE_PUNTOS) {
        finos.push({ lat: p.lat, lng: p.lng, en: new Date(p.registrada_en).toISOString() });
      }
    });
    return {
      user_id: g.user_id,
      nombre: g.nombre,
      puntos: finos,
      visitas: visitas.filter((v: any) => v.user_id === g.user_id)
        .map((v: any) => ({ lugar: v.lugar, llegada_en: v.llegada_en, salida_en: v.salida_en })),
    };
  });
  await registrarAccesos(m.userId, salida.filter((r) => r.user_id !== m.userId && r.puntos.length).map((r) => r.user_id));
  return salida;
}

/** La pantalla refresca cada pocos segundos: una misma consulta cuenta una vez cada media hora. */
async function registrarAccesos(quien: string, aQuienes: string[]) {
  if (!aQuienes.length) return;
  await pool.query(
    `INSERT INTO gcc_world.cp_accesos (quien, a_quien)
     SELECT $1::uuid, x FROM UNNEST($2::uuid[]) AS x
      WHERE NOT EXISTS (
        SELECT 1 FROM gcc_world.cp_accesos ac
         WHERE ac.quien = $1::uuid AND ac.a_quien = x AND ac.creado_en > NOW() - INTERVAL '30 minutes')`,
    [quien, aQuienes],
  );
}

/** Detalle de un miembro. Mirar a otro queda registrado. */
export async function detalleMiembro(m: Miembro, objetivo: string) {
  const { rows: [fila] } = await pool.query(`${FILA} AND u.id = $1`, [objetivo]);
  if (!fila) return null;
  if (objetivo !== m.userId && fila.lat != null) await registrarAccesos(m.userId, [objetivo]);
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
