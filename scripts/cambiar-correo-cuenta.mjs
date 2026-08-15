/**
 * CAMBIAR EL CORREO DE UNA CUENTA, conservando todo lo que tiene detrás.
 *
 *   node scripts/cambiar-correo-cuenta.mjs <viejo> <nuevo>            # ensayo
 *   node scripts/cambiar-correo-cuenta.mjs <viejo> <nuevo> --aplicar  # de verdad
 *
 * ── POR QUÉ NO ROMPE NADA ─────────────────────────────────────────────────────
 * En este esquema **las relaciones cuelgan del `id`**, no del correo: proyectos,
 * tickets, pujas, asignaciones, eventos y notificaciones apuntan al UUID de `users`
 * o al `member_id`. Verificado antes de escribir esto. Cambiar el correo es cambiar
 * una etiqueta, no mover la cuenta.
 *
 * ── QUÉ SE TOCA Y QUÉ NO ──────────────────────────────────────────────────────
 * **Sí** — identidad y autoría: `users.email`, `members.email`, `clients.email`,
 * `subscriptions.created_by`, `subscription_payments.paid_by`, y —por decisión de
 * Fernando (2026-08-15)— `billing_clients.email` y `flow_contacts.email`.
 *
 * ⛔ **NO** — el histórico:
 *   · `invoices.client_email_sri`: ese comprobante **ya está autorizado por el SRI**
 *     con ese correo dentro del XML firmado. Cambiarlo en la base dejaría el sistema
 *     diciendo algo distinto de lo que consta en el comprobante real.
 *   · `flow_campaign_sends.contact_email`: es el registro de un envío que ocurrió, a
 *     una dirección concreta. Un registro que se reescribe deja de ser un registro.
 *
 * ── SEGURIDAD ─────────────────────────────────────────────────────────────────
 * Todo va en UNA transacción y **aborta** si el correo nuevo ya está en uso o si el
 * viejo no existe. Sin `--aplicar` no escribe: enseña el plan y hace `ROLLBACK`.
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const [viejo, nuevo] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const APLICAR = process.argv.includes('--aplicar');

if (!viejo || !nuevo) {
  console.error('Uso: node scripts/cambiar-correo-cuenta.mjs <viejo> <nuevo> [--aplicar]');
  process.exit(1);
}
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nuevo)) {
  console.error('✖ El correo nuevo no tiene forma de correo.');
  process.exit(1);
}

/** Qué se actualiza. El orden no importa: todo va en la misma transacción. */
const CAMBIOS = [
  ['users', 'email', 'la cuenta con la que se entra'],
  ['members', 'email', 'la ficha de miembro'],
  ['clients', 'email', 'el registro de jugador/cliente'],
  ['subscriptions', 'created_by', 'autoría de suscripciones'],
  ['subscription_payments', 'paid_by', 'autoría de pagos'],
  ['billing_clients', 'email', 'ficha de cliente de facturación'],
  ['flow_contacts', 'email', 'contactos en listas de correo'],
];

const INTOCABLES = [
  ['invoices', 'client_email_sri', 'comprobante ya autorizado por el SRI'],
  ['flow_campaign_sends', 'contact_email', 'registro de un envío que ya ocurrió'],
];

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: '-c search_path=gcc_world,public' });

async function main() {
  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');

    const { rows: [u] } = await cli.query(
      `SELECT id, role, member_id, workspace_email FROM gcc_world.users WHERE email = $1`, [viejo]);
    if (!u) throw new Error(`No hay ninguna cuenta con ${viejo}`);

    const { rows: [ocupado] } = await cli.query(
      `SELECT count(*)::int n FROM gcc_world.users WHERE email = $1`, [nuevo]);
    if (ocupado.n) throw new Error(`Ya existe una cuenta con ${nuevo}. Habría que fusionarlas, no renombrar.`);

    console.log(`Cuenta: ${u.id} · rol ${u.role} · miembro ${u.member_id}`);
    console.log(`Buzón corporativo declarado: ${u.workspace_email || '(ninguno)'}`);
    // El código de acceso se manda al correo de la cuenta: si el buzón nuevo no es
    // suyo, el cambio lo deja fuera del sistema. Se avisa, no se bloquea.
    if (u.workspace_email && u.workspace_email !== nuevo) {
      console.log(`⚠️  Ojo: el buzón corporativo (${u.workspace_email}) no coincide con el correo nuevo.`);
    }
    console.log('');

    let total = 0;
    for (const [tabla, columna, para] of CAMBIOS) {
      const { rowCount } = await cli.query(
        `UPDATE gcc_world.${tabla} SET ${columna} = $1 WHERE ${columna} = $2`, [nuevo, viejo]);
      total += rowCount;
      console.log(`  ${rowCount > 0 ? '✔' : '·'} ${String(rowCount).padStart(2)} ${`${tabla}.${columna}`.padEnd(34)} ${para}`);
    }

    console.log('\n  Sin tocar, a propósito:');
    for (const [tabla, columna, porque] of INTOCABLES) {
      const { rows: [r] } = await cli.query(
        `SELECT count(*)::int n FROM gcc_world.${tabla} WHERE ${columna} = $1`, [viejo]);
      console.log(`  ⛔ ${String(r.n).padStart(2)} ${`${tabla}.${columna}`.padEnd(34)} ${porque}`);
    }

    // Comprobación dentro de la transacción: la cuenta sigue siendo LA MISMA fila.
    const { rows: [despues] } = await cli.query(
      `SELECT id, email FROM gcc_world.users WHERE id = $1`, [u.id]);
    if (despues.email !== nuevo) throw new Error('El correo no quedó cambiado; se aborta.');
    if (despues.id !== u.id) throw new Error('Cambió el id de la cuenta; se aborta.');

    if (APLICAR) {
      await cli.query('COMMIT');
      console.log(`\n✅ APLICADO — ${total} filas. La cuenta ${u.id} conserva todo lo que tenía.`);
    } else {
      await cli.query('ROLLBACK');
      console.log(`\n🔎 ENSAYO — ${total} filas se cambiarían. Nada se escribió. Añade --aplicar.`);
    }
  } catch (e) {
    await cli.query('ROLLBACK').catch(() => {});
    console.error(`\n✖ ${e.message}`);
    process.exitCode = 1;
  } finally {
    cli.release();
    await pool.end();
  }
}

main();
