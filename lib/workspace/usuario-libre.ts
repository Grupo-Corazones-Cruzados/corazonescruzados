import { pool } from '@/lib/db';
import { direccionEnGoogle, isGoogleWorkspaceConfigured } from '@/lib/integrations/google-workspace';
import { buildUsernameBase, isValidUsername, splitBaseCounter, usernameToEmail, type NameParts } from './username';

/**
 * EL PRIMER USUARIO CORPORATIVO LIBRE (Fernando, 2026-11-12). De los dos nombres y los dos apellidos sale la base
 * (`lfgonzalezm`) y el contador empieza en 0: si `lfgonzalezm0` ya existe —en la plataforma o en Google, como usuario
 * o como grupo—, se prueba `lfgonzalezm1`, y así. `desde` permite empezar por un usuario que el aprobador escribió.
 */
export async function usuarioLibre(nombres: NameParts, desde?: string | null): Promise<string> {
  const { base, start } = desde ? splitBaseCounter(desde) : { base: buildUsernameBase(nombres), start: 0 };
  if (!isValidUsername(`${base}0`)) throw new Error('No se pudo formar el usuario con esos nombres.');
  // Las columnas nacen con la primera aprobación; en una base nueva todavía no existen.
  await pool.query(`ALTER TABLE gcc_world.clients ADD COLUMN IF NOT EXISTS workspace_username text, ADD COLUMN IF NOT EXISTS workspace_email text`);
  const enGoogle = isGoogleWorkspaceConfigured();
  for (let n = start; n < start + 200; n++) {
    const usuario = `${base}${n}`;
    const correo = usernameToEmail(usuario);
    const { rowCount } = await pool.query(
      `SELECT 1 FROM gcc_world.clients WHERE workspace_username = $1 OR LOWER(workspace_email) = $2
       UNION SELECT 1 FROM gcc_world.users WHERE LOWER(email) = $2 LIMIT 1`,
      [usuario, correo],
    );
    if (rowCount) continue;
    if (enGoogle && (await direccionEnGoogle(correo))) continue;
    return usuario;
  }
  throw new Error('No hay un usuario libre para esos nombres.');
}
