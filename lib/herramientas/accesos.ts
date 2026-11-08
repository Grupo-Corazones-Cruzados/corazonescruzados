import { pool } from '@/lib/db';
import { estadoDe, nuevoToken, type Acceso } from '@/lib/enlaces';
import { HERRAMIENTAS } from '@/lib/herramientas/catalogo';

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
 * ⇒ TODAS LAS QUE TIENEN SENTIDO FUERA (Fernando, 2026-11-08: «por cada herramienta dejemos una
 * forma de compartir… a través de un token temporal que incluso pueda llevar validación de
 * cuenta»). Las marcadas `compartible` en el catálogo: Formatos de Excel y QR corren en el
 * navegador; Convertir y Transcribir llaman a su API con el token en `x-acceso-herramienta`
 * (`lib/herramientas/acceso.ts › usuarioOAcceso`), que solo abre ESA herramienta y cuenta el uso.
 * No se comparten las de un solo uso (ya son un enlace para alguien de fuera y escriben en el
 * Drive), el Descargador (es una app que se instala) ni Espacio y Gumdramon (llegan a la máquina).
 *
 * VALIDACIÓN (sin columnas nuevas): `exige_cuenta` falso → basta el enlace; verdadero sin
 * `client_id` → cualquier cuenta de GCC World con sesión; verdadero con `client_id` → solo la
 * cuenta de ese cliente.
 */

export const COMPARTIBLES: Record<string, { nombre: string }> = Object.fromEntries(
  HERRAMIENTAS.filter((h) => h.compartible).map((h) => [h.id, { nombre: h.name }]),
);

export type Validacion = 'ninguna' | 'cuenta' | 'cliente';
export const validacionDe = (a: { exige_cuenta: boolean; client_id: number | null }): Validacion =>
  !a.exige_cuenta ? 'ninguna' : a.client_id ? 'cliente' : 'cuenta';

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
 * ¿Puede usar la herramienta quien tiene esta sesión? Vigente y, según la validación, con
 * sesión de cualquier cuenta o con la del cliente. Aquí nunca sale «usado»: no se gasta.
 */
export function acceso(a: any, user: { userId: string } | null): Acceso {
  if (!a || !COMPARTIBLES[a.herramienta]) return { ok: false, motivo: 'no_existe' };
  const estado = estadoDe(a);
  if (estado !== 'vigente') return { ok: false, motivo: estado };
  if (a.exige_cuenta) {
    if (!user) return { ok: false, motivo: 'necesita_sesion' };
    if (a.client_id && (!a.cliente_user_id || String(a.cliente_user_id) !== String(user.userId))) {
      return { ok: false, motivo: 'otra_cuenta' };
    }
  }
  return { ok: true };
}

/** Anota un uso del acceso (se llama cuando la herramienta terminó, no al abrir la página). */
export async function contarUso(id: number) {
  await pool.query(`UPDATE gcc_world.herramienta_accesos SET usos = usos + 1, ultimo_uso = NOW() WHERE id = $1`, [id]);
}
