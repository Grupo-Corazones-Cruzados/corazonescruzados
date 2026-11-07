import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { asegurarCookieDeEquipo, identidadDeEquipo } from '@/lib/registro/limite';

/**
 * LAS SESIONES DEL AGENTE (Fernando, 2026-11-06): quien entra sin cuenta tiene hasta 3 sesiones en
 * total, contadas por IP o navegador, que no se renuevan: después debe iniciar sesión. Con sesión
 * iniciada no cuentan. Cada sesión tiene hasta 500 000 tokens y guarda su conversación, porque el agente
 * la retoma y sigue iterando.
 */

export const MAX_SESIONES = 3;
export const MAX_TOKENS_SESION = 500_000;
/** Freno general: rotar de IP y borrar cookies no puede consumir sin fin. */
export const MAX_TOKENS_DIA = 10_000_000;

export type Mensaje = { rol: 'usuario' | 'agente'; texto: string };

export type Presupuesto = {
  tipo: 'proyecto' | 'ticket';
  titulo: string;
  descripcion: string;
  requerimientos: { titulo: string; descripcion: string }[];
  dias: number | null;
  acciones: string[];
  precio_min: number;
  precio_max: number;
  talentos: string[];
};

let tabla: Promise<void> | null = null;
export function asegurarTablaPresupuestos(): Promise<void> {
  tabla ??= pool.query(
    `CREATE TABLE IF NOT EXISTS gcc_world.presupuesto_sesiones (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       dispositivo TEXT NOT NULL,
       user_id TEXT,
       ip_hash TEXT,
       solucion TEXT NOT NULL,
       mensajes JSONB NOT NULL DEFAULT '[]',
       items JSONB NOT NULL DEFAULT '[]',
       presupuesto JSONB,
       tokens INT NOT NULL DEFAULT 0,
       ocupada_hasta TIMESTAMPTZ,
       solicitud JSONB,
       busquedas INT NOT NULL DEFAULT 0,
       enviada_tipo TEXT,
       enviada_id BIGINT,
       creada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       actualizada TIMESTAMPTZ NOT NULL DEFAULT NOW()
     );
     ALTER TABLE gcc_world.presupuesto_sesiones ADD COLUMN IF NOT EXISTS user_id TEXT;
     CREATE INDEX IF NOT EXISTS presupuesto_sesiones_usuario ON gcc_world.presupuesto_sesiones (user_id);
     CREATE INDEX IF NOT EXISTS presupuesto_sesiones_dispositivo ON gcc_world.presupuesto_sesiones (dispositivo);
     CREATE INDEX IF NOT EXISTS presupuesto_sesiones_ip ON gcc_world.presupuesto_sesiones (ip_hash);`,
  ).then(() => undefined).catch((e: unknown) => { tabla = null; throw e; });
  return tabla as Promise<void>;
}

/** Lo que el navegador puede ver de una sesión: nunca los ítems del modelo ni el código. */
export function sesionPublica(r: any) {
  return {
    id: r.id,
    mensajes: r.mensajes as Mensaje[],
    presupuesto: (r.presupuesto ?? null) as Presupuesto | null,
    tokens: Number(r.tokens),
    maxTokens: MAX_TOKENS_SESION,
    deCuenta: !!r.user_id,
    enviada: r.enviada_tipo ? { tipo: r.enviada_tipo as string, id: Number(r.enviada_id) } : null,
  };
}

/**
 * La sesión anónima es del navegador y la de una cuenta, solo de esa cuenta: en un equipo compartido,
 * la conversación de quien inició sesión no queda a la vista de quien venga después.
 */
const PERTENECE = (usuario: string, dispositivo: string) =>
  `((user_id IS NOT NULL AND user_id = ${usuario}::text) OR (user_id IS NULL AND ${dispositivo}::text IS NOT NULL AND dispositivo = ${dispositivo}::text))`;

/** Las sesiones de este equipo y cuántas le quedan. */
export async function sesionesDelEquipo(solucion: string) {
  await asegurarTablaPresupuestos();
  const { ipHash, dispositivo, libre } = await identidadDeEquipo();
  const usuario = await getCurrentUser();
  const { rows } = await pool.query(
    `SELECT * FROM gcc_world.presupuesto_sesiones
      WHERE solucion = $1 AND ${PERTENECE('$2', '$3')}
      ORDER BY creada`,
    [solucion, usuario?.userId ?? null, dispositivo],
  );
  const { rows: [c] } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM gcc_world.presupuesto_sesiones
      WHERE user_id IS NULL AND (ip_hash = $1 OR ($2::text IS NOT NULL AND dispositivo = $2))`,
    [ipHash, dispositivo],
  );
  return { sesiones: rows.map(sesionPublica), usadas: c.n as number, maximo: MAX_SESIONES, libre: libre || !!usuario, conSesion: !!usuario };
}

export type ErrorSesion = { error: string; estado: number };

export async function crearSesion(solucion: string): Promise<{ sesion: any } | ErrorSesion> {
  await asegurarTablaPresupuestos();
  const { usadas, libre } = await sesionesDelEquipo(solucion);
  if (!libre && usadas >= MAX_SESIONES) {
    return { error: `Ya usaste las ${MAX_SESIONES} sesiones disponibles. Inicia sesión como cliente para seguir.`, estado: 429 };
  }
  const { rows: [d] } = await pool.query(
    `SELECT COALESCE(SUM(tokens), 0)::bigint AS t FROM gcc_world.presupuesto_sesiones WHERE actualizada > NOW() - INTERVAL '1 day'`,
  );
  if (Number(d.t) >= MAX_TOKENS_DIA) {
    return { error: 'El agente de presupuestos no está disponible por ahora. Inténtalo mañana.', estado: 503 };
  }
  const dispositivo = await asegurarCookieDeEquipo();
  const { ipHash } = await identidadDeEquipo();
  const usuario = await getCurrentUser();
  const { rows: [r] } = await pool.query(
    `INSERT INTO gcc_world.presupuesto_sesiones (dispositivo, ip_hash, solucion, user_id) VALUES ($1, $2, $3, $4) RETURNING *`,
    [dispositivo, ipHash, solucion, usuario?.userId ?? null],
  );
  return { sesion: r };
}

/** Una sesión, solo si es de esta cuenta o de este navegador: el identificador solo no basta. */
export async function sesionDeEsteEquipo(id: string): Promise<any | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  await asegurarTablaPresupuestos();
  const { dispositivo } = await identidadDeEquipo();
  const usuario = await getCurrentUser();
  const { rows: [r] } = await pool.query(
    `SELECT * FROM gcc_world.presupuesto_sesiones WHERE id = $1 AND ${PERTENECE('$2', '$3')}`,
    [id, usuario?.userId ?? null, dispositivo],
  );
  return r ?? null;
}
