import { pool } from '@/lib/db';
import { acceso as accesoEnlace, estadoDe, nuevoToken } from '@/lib/enlaces';

/**
 * ⇒ ACCESO PÚBLICO A UNA HERRAMIENTA (Fernando, 2026-10-27).
 *
 * Un miembro comparte una herramienta con alguien de fuera con un enlace con token, «como
 * cuando se comparte un enlace para subir archivos»: mismo formulario (`PanelCompartirEnlace`),
 * vigencia por tiempo y, si se quiere, atado a la cuenta de GCC World de un cliente.
 *
 * Diferencia con el enlace de un solo uso: NO se gasta. Sirve todas las veces que haga falta
 * hasta que vence o se cierra a mano. Estados: vigente · cerrado · vencido (calculado con
 * `vence_en`, sin cron, igual que el enlace).
 *
 * Solo se comparten las herramientas de `COMPARTIBLES`: las que corren enteras en el
 * navegador, así quien entra con el token no llega a nada del servidor ni del Drive.
 */

export const COMPARTIBLES: Record<string, { nombre: string }> = {
  'formatos-excel': { nombre: 'Formatos de impresión para Excel' },
};

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.grupocc.org').replace(/\/$/, '');
export const urlAcceso = (token: string) => `${APP_URL}/herramienta/${token}`;

export { estadoDe, nuevoToken };

let asegurando: Promise<void> | null = null;
export function asegurarTablaAccesos(): Promise<void> {
  if (asegurando) return asegurando;
  const p = pool
    .query(`
      CREATE TABLE IF NOT EXISTS gcc_world.herramienta_accesos (
        id SERIAL PRIMARY KEY,
        token VARCHAR(64) NOT NULL UNIQUE,
        herramienta TEXT NOT NULL,
        titulo TEXT NOT NULL DEFAULT '',
        client_id BIGINT,
        exige_cuenta BOOLEAN NOT NULL DEFAULT FALSE,
        estado TEXT NOT NULL DEFAULT 'vigente',
        vence_en TIMESTAMPTZ NOT NULL,
        enviado_a TEXT,
        creado_por UUID NOT NULL,
        creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        usos INT NOT NULL DEFAULT 0,
        ultimo_uso TIMESTAMPTZ,
        cerrado_en TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS herramienta_accesos_creado_por_idx ON gcc_world.herramienta_accesos(creado_por);
    `)
    .then(() => undefined)
    .catch((e: unknown) => { asegurando = null; throw e; });
  asegurando = p;
  return p;
}

export async function porToken(token: string) {
  await asegurarTablaAccesos();
  const { rows: [a] } = await pool.query(
    `SELECT a.*, c.user_id AS cliente_user_id, COALESCE(c.name, c.full_name) AS cliente_nombre
       FROM gcc_world.herramienta_accesos a
       LEFT JOIN gcc_world.clients c ON c.id = a.client_id
      WHERE a.token = $1`,
    [token],
  );
  return a ?? null;
}

/**
 * ¿Puede usar la herramienta quien tiene esta sesión? Las mismas reglas que el enlace de un
 * solo uso (vigente, y la cuenta del cliente si la pide); aquí nunca sale «usado».
 */
export function acceso(a: any, user: { userId: string } | null) {
  if (a && !COMPARTIBLES[a.herramienta]) return { ok: false as const, motivo: 'no_existe' as const };
  return accesoEnlace(a, user);
}
