import { pool } from '@/lib/db';

/**
 * Clientes de facturación: identidad de cliente centrada en su identificación SRI
 * (`ruc`/cédula/pasaporte). La tabla `billing_clients` guarda los datos editables del
 * cliente + sus datos de facturación; las facturas se asocian por `client_ruc`.
 * "Consumidor Final" es el registro con ruc `9999999999999`.
 *
 * Nota: `gcc_world.clients` es la tabla del PORTAL (auth/passkeys/gamificación) y es un
 * concepto distinto; aquí no se toca.
 */

let _init = false;

export async function ensureBillingClientsTable() {
  if (_init) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gcc_world.billing_clients (
      id SERIAL PRIMARY KEY,
      id_type VARCHAR(2) NOT NULL DEFAULT '07',
      ruc VARCHAR(30) NOT NULL UNIQUE,
      name VARCHAR(300) NOT NULL,
      email VARCHAR(255),
      phone VARCHAR(30),
      address TEXT,
      notes TEXT,
      aliases TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await pool.query(`ALTER TABLE gcc_world.billing_clients ADD COLUMN IF NOT EXISTS aliases TEXT[] NOT NULL DEFAULT '{}'`);
  await pool.query(`ALTER TABLE gcc_world.billing_clients ADD COLUMN IF NOT EXISTS country VARCHAR(100)`);

  // Siembra idempotente desde las facturas existentes (no sobrescribe ediciones).
  // Excluye identificaciones que ya son alias de algún cliente (fusionadas) para no recrearlas.
  await pool.query(`
    INSERT INTO gcc_world.billing_clients (id_type, ruc, name, email, phone, address)
    SELECT DISTINCT ON (client_ruc)
      COALESCE(NULLIF(client_id_type, ''),
        CASE WHEN client_ruc = '9999999999999' THEN '07'
             WHEN length(client_ruc) = 13 AND client_ruc ~ '^[0-9]+$' THEN '04'
             WHEN length(client_ruc) = 10 AND client_ruc ~ '^[0-9]+$' THEN '05'
             ELSE '06' END),
      client_ruc,
      COALESCE(NULLIF(client_name_sri, ''), 'CLIENTE SIN NOMBRE'),
      NULLIF(client_email_sri, ''),
      NULLIF(client_phone_sri, ''),
      NULLIF(client_address_sri, '')
    FROM gcc_world.invoices
    WHERE client_ruc IS NOT NULL AND client_ruc <> ''
      AND client_ruc NOT IN (
        SELECT unnest(aliases) FROM gcc_world.billing_clients WHERE array_length(aliases, 1) > 0
      )
    ORDER BY client_ruc, created_at DESC
    ON CONFLICT (ruc) DO NOTHING
  `);

  // Asegurar el registro Consumidor Final.
  await pool.query(`
    INSERT INTO gcc_world.billing_clients (id_type, ruc, name)
    VALUES ('07', '9999999999999', 'CONSUMIDOR FINAL')
    ON CONFLICT (ruc) DO NOTHING
  `);

  _init = true;
}

export const CONSUMIDOR_FINAL_RUC = '9999999999999';

export const ID_TYPE_LABEL: Record<string, string> = {
  '04': 'RUC', '05': 'Cédula', '06': 'Pasaporte', '07': 'Consumidor Final', '08': 'ID Exterior',
};

/** Deriva el origen (proyecto/ticket/suscripción) de una factura para los botones de redirección. */
export function invoiceOrigin(inv: { source_type: string | null; source_id: string | null; project_id: string | null }):
  { type: 'project' | 'ticket' | 'subscription' | null; id: string | null } {
  if (inv.source_type === 'ticket' && inv.source_id) return { type: 'ticket', id: String(inv.source_id) };
  if (inv.source_type === 'subscription' && inv.source_id) return { type: 'subscription', id: String(inv.source_id).split('-')[0] };
  if (inv.project_id) return { type: 'project', id: String(inv.project_id) };
  return { type: null, id: null };
}
