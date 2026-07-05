import { pool } from '@/lib/db';

/**
 * Garantiza que un usuario **admin** tenga un perfil de miembro enlazado (`users.member_id`),
 * para habilitarle las secciones de miembro (CV, Portafolio, Disponibilidad, Calendario).
 * NO cambia el rol: el admin sigue siendo admin (el acceso admin depende de `role`).
 *
 * Estrategia idempotente y defensiva:
 *  1. Si ya está enlazado → devuelve su `member_id`.
 *  2. Si existe un miembro con el mismo email → lo **enlaza** (sin insertar).
 *  3. Si no → **crea** un miembro mínimo (inactivo, para no aparecer como ciudadano/asignable),
 *     rellenando cualquier columna NOT NULL sin default con un valor seguro por tipo.
 * Cualquier fallo se traga (devuelve null): nunca debe romper la sesión.
 */
export async function ensureAdminMember(userId: number | string, email: string | null, name: string): Promise<number | null> {
  try {
    const u = await pool.query(`SELECT member_id FROM gcc_world.users WHERE id = $1`, [userId]);
    const existing = u.rows[0]?.member_id;
    if (existing) return Number(existing);

    const cleanEmail = String(email || '').trim().toLowerCase();
    const displayName = (name || '').trim() || cleanEmail || 'Administrador';

    // 2) enlazar a un miembro existente por email
    if (cleanEmail) {
      const m = await pool.query(`SELECT id FROM gcc_world.members WHERE LOWER(email) = $1 LIMIT 1`, [cleanEmail]);
      if (m.rows[0]) {
        await pool.query(`UPDATE gcc_world.users SET member_id = $1 WHERE id = $2`, [m.rows[0].id, userId]);
        return Number(m.rows[0].id);
      }
    }

    // 3) crear un miembro mínimo, rellenando columnas NOT NULL sin default
    const cols = await pool.query(
      `SELECT column_name, is_nullable, column_default, data_type
         FROM information_schema.columns
        WHERE table_schema = 'gcc_world' AND table_name = 'members'`,
    );
    const provided: Record<string, any> = {
      name: displayName,
      is_active: false, // inactivo: no aparece como ciudadano del mundo ni en pools de asignación
    };
    if (cleanEmail) provided.email = cleanEmail;

    for (const c of cols.rows as Array<{ column_name: string; is_nullable: string; column_default: string | null; data_type: string }>) {
      const col = c.column_name;
      if (col === 'id' || col in provided) continue;
      const required = c.is_nullable === 'NO' && c.column_default === null;
      if (!required) continue;
      const t = String(c.data_type).toLowerCase();
      if (/int|numeric|double|real|decimal|money/.test(t)) provided[col] = 0;
      else if (/bool/.test(t)) provided[col] = false;
      else if (/timestamp|date|time/.test(t)) provided[col] = new Date();
      else if (/json/.test(t)) provided[col] = '{}';
      else if (/char|text/.test(t)) provided[col] = '';
      // enum/array/otros: se omite; si es NOT NULL sin default, el INSERT fallará y se traga abajo
    }

    const keys = Object.keys(provided);
    const values = keys.map((k) => provided[k]);
    const placeholders = keys.map((_, i) => `$${i + 1}`);
    const ins = await pool.query(
      `INSERT INTO gcc_world.members (${keys.map((k) => `"${k}"`).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING id`,
      values,
    );
    const newId = ins.rows[0].id;
    await pool.query(`UPDATE gcc_world.users SET member_id = $1 WHERE id = $2`, [newId, userId]);
    return Number(newId);
  } catch (err: any) {
    console.error('ensureAdminMember failed:', err?.message);
    return null;
  }
}
