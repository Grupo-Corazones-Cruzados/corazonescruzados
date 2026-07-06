/**
 * Fusiona la cuenta lfgonzalezm0@grupocc.org en la cuenta admin lfgonzalezm0@outlook.com.
 *
 * Estrategia (elegida por el usuario): CONSERVAR el miembro 1 ("Luis Fernando
 * González Muyulema"), que ya tiene todo el trabajo. Se re-enlaza el usuario admin
 * (outlook) al miembro 1, se reasignan los registros a NIVEL DE USUARIO del usuario
 * grupocc → usuario outlook, y se borran el usuario grupocc y el miembro 2 (vacío).
 * Los registros a nivel de MIEMBRO no se tocan (siguen en el miembro 1).
 *
 * Idempotente-ish y transaccional: todo o nada. Hace un backup JSON antes.
 *
 * Uso: node --env-file=.env scripts/merge-account-grupocc-into-outlook.cjs
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const OLD_USER = '779ee818-9c34-4ed8-9210-65e82e5eda90'; // grupocc
const NEW_USER = '3fdb4891-6a51-456f-aa6f-f3b03b4a9555'; // outlook (admin)
const KEEP_MEMBER = 1;   // Luis Fernando González Muyulema (grupocc member) — se conserva
const DROP_MEMBER = 2;   // Fernando González (outlook member, vacío) — se elimina

// Columnas a nivel de USUARIO que apuntan al usuario viejo → reasignar al nuevo.
const USER_REASSIGN = [
  ['cart_items', 'user_id'], ['clients', 'user_id'], ['notifications', 'user_id'],
  ['orders', 'user_id'], ['package_purchases', 'user_id'],
  ['project_cancellation_votes', 'user_id'], ['support_replies', 'user_id'],
  ['support_tickets', 'user_id'], ['tickets', 'user_id'], ['user_api_keys', 'user_id'],
  ['member_calendar_events', 'created_by'], ['email_campaigns', 'created_by'],
  ['email_lists', 'created_by'], ['recruitment_events', 'created_by'],
  ['subscriptions', 'created_by'], ['ticket_actions', 'created_by'],
  ['whatsapp_campaigns', 'created_by'], ['projects', 'created_by_user_id'],
];
// Filas atadas a la sesión/credenciales del usuario viejo → borrar (transitorias).
const USER_DELETE = [['verification_tokens', 'user_id']];

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    // ---- Backup ----
    const backup = { at: new Date().toISOString(), users: [], members: [], reassign: {} };
    backup.users = (await client.query(`SELECT * FROM gcc_world.users WHERE id IN ($1,$2)`, [OLD_USER, NEW_USER])).rows;
    backup.members = (await client.query(`SELECT * FROM gcc_world.members WHERE id IN ($1,$2)`, [KEEP_MEMBER, DROP_MEMBER])).rows;
    for (const [t, c] of [...USER_REASSIGN, ...USER_DELETE]) {
      const r = await client.query(`SELECT * FROM gcc_world.${t} WHERE ${c} = $1`, [OLD_USER]);
      if (r.rows.length) backup.reassign[`${t}.${c}`] = r.rows;
    }
    const outDir = process.env.BACKUP_DIR || '.';
    const file = path.join(outDir, `merge-backup-${Date.now()}.json`);
    fs.writeFileSync(file, JSON.stringify(backup, null, 2));
    console.log(`Backup escrito en: ${file}`);

    // ---- Merge (transacción) ----
    await client.query('BEGIN');

    let moved = 0;
    for (const [t, c] of USER_REASSIGN) {
      const r = await client.query(`UPDATE gcc_world.${t} SET ${c} = $1 WHERE ${c} = $2`, [NEW_USER, OLD_USER]);
      if (r.rowCount) { console.log(`  reasignado ${t}.${c}: ${r.rowCount}`); moved += r.rowCount; }
    }
    for (const [t, c] of USER_DELETE) {
      const r = await client.query(`DELETE FROM gcc_world.${t} WHERE ${c} = $1`, [OLD_USER]);
      if (r.rowCount) console.log(`  borrado ${t}.${c}: ${r.rowCount}`);
    }

    // Re-enlaza el admin (outlook) al miembro que se conserva.
    await client.query(`UPDATE gcc_world.users SET member_id = $1 WHERE id = $2`, [KEEP_MEMBER, NEW_USER]);
    console.log(`  usuario outlook → member_id ${KEEP_MEMBER}`);

    // Borra el usuario grupocc y el miembro vacío.
    const du = await client.query(`DELETE FROM gcc_world.users WHERE id = $1`, [OLD_USER]);
    console.log(`  usuario grupocc borrado: ${du.rowCount}`);
    const dm = await client.query(`DELETE FROM gcc_world.members WHERE id = $1`, [DROP_MEMBER]);
    console.log(`  miembro ${DROP_MEMBER} borrado: ${dm.rowCount}`);

    await client.query('COMMIT');
    console.log(`\nOK. Filas de usuario reasignadas: ${moved}. Fusión completada.`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('ERROR, rollback:', e.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}
main();
