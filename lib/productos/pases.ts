import { createHash, randomBytes } from 'crypto';
import { pool } from '@/lib/db';

/**
 * PASES DE ENTRADA A UN PRODUCTO (Fernando, 2026-11-08: «al ingresar a un producto del que es dueño no
 * tiene sentido pedirle sesión»). Quien ya entró en GCC World abre su negocio en un producto sin
 * volver a iniciar sesión:
 *   1. La plataforma comprueba que la cuenta tiene ese negocio (`accesosDelUsuario`) y emite un pase:
 *      aleatorio, de UN uso y de 60 s. Solo se guarda su huella (sha256).
 *   2. El navegador lo lleva al producto (`/<slug>/entrar?ticket=…`).
 *   3. El producto lo canjea de servidor a servidor (`/api/productos/identidad`, paso `canjear`) y
 *      recibe el correo; abre la sesión del usuario ACTIVO con ese correo en ese negocio. Si no hay
 *      ninguno, no entra: el correo de contacto del negocio no basta (lo puede cambiar su admin).
 * Un pase usado, caducado o de otro negocio no devuelve nada.
 */
let tabla: Promise<void> | null = null;
function asegurarTabla(): Promise<void> {
  tabla ??= pool
    .query(`CREATE TABLE IF NOT EXISTS gcc_world.producto_pases (
      id SERIAL PRIMARY KEY,
      ticket_hash TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      producto TEXT NOT NULL,
      slug TEXT NOT NULL,
      expira TIMESTAMPTZ NOT NULL,
      usado_en TIMESTAMPTZ,
      creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
    )`)
    .then(() => undefined)
    .catch((e: unknown) => { tabla = null; throw e; });
  return tabla!;
}

const huella = (t: string) => createHash('sha256').update(t).digest('hex');

export async function emitirPase(email: string, producto: string, slug: string): Promise<string> {
  await asegurarTabla();
  const ticket = randomBytes(32).toString('hex');
  await pool.query(
    `INSERT INTO gcc_world.producto_pases (ticket_hash, email, producto, slug, expira)
     VALUES ($1, $2, $3, $4, now() + interval '60 seconds')`,
    [huella(ticket), email.toLowerCase(), producto, slug],
  );
  // Los viejos sobran: se barren al emitir, sin tarea aparte.
  pool.query(`DELETE FROM gcc_world.producto_pases WHERE creado_en < now() - interval '1 day'`).catch(() => {});
  return ticket;
}

/** Marca el pase como usado y devuelve el correo, en una sola sentencia (no se puede canjear dos veces). */
export async function canjearPase(ticket: string, producto: string, slug: string): Promise<string | null> {
  if (!/^[a-f0-9]{64}$/.test(ticket)) return null;
  await asegurarTabla();
  const { rows: [r] } = await pool.query(
    `UPDATE gcc_world.producto_pases SET usado_en = now()
      WHERE ticket_hash = $1 AND producto = $2 AND slug = $3 AND usado_en IS NULL AND expira > now()
      RETURNING email`,
    [huella(ticket), producto, slug],
  );
  return r?.email ?? null;
}
