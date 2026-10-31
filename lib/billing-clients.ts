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
  // Unificación con la tabla del portal `clients`: ruc/id_type pueden ser null (clientes del
  // portal sin datos de facturación) y `portal_client_id` enlaza con su registro en `clients`.
  await pool.query(`ALTER TABLE gcc_world.billing_clients ALTER COLUMN ruc DROP NOT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE gcc_world.billing_clients ALTER COLUMN id_type DROP NOT NULL`).catch(() => {});
  await pool.query(`ALTER TABLE gcc_world.billing_clients ADD COLUMN IF NOT EXISTS portal_client_id INT`);
  // Hasta 3 juegos de datos de facturación por cliente (Fernando, 2026-10-31): ver
  // `MAX_DATOS_FACTURACION`. Los extra son filas con `titular_id` = la fila del cliente.
  await pool.query(`ALTER TABLE gcc_world.billing_clients ADD COLUMN IF NOT EXISTS titular_id INT`);
  await pool.query(`ALTER TABLE gcc_world.billing_clients ADD COLUMN IF NOT EXISTS dato_predeterminado_id INT`);
  await pool.query(`CREATE INDEX IF NOT EXISTS billing_clients_titular_idx ON gcc_world.billing_clients (titular_id)`);

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

  // Siembra idempotente desde la tabla del portal `clients` (lista unificada): trae los
  // clientes del portal que aún no estén representados (por enlace, ruc o nombre). Así un
  // cliente creado en tickets/proyectos aparece también en el módulo de Clientes.
  await pool.query(`
    INSERT INTO gcc_world.billing_clients (id_type, ruc, name, email, portal_client_id)
    SELECT CASE
             WHEN regexp_replace(COALESCE(c.ruc,''), '[^0-9A-Za-z]', '', 'g') ~ '^[0-9]{13}$' THEN '04'
             WHEN regexp_replace(COALESCE(c.ruc,''), '[^0-9A-Za-z]', '', 'g') ~ '^[0-9]{10}$' THEN '05'
             WHEN regexp_replace(COALESCE(c.ruc,''), '[^0-9A-Za-z]', '', 'g') <> '' THEN '06'
             ELSE NULL END,
           NULLIF(regexp_replace(COALESCE(c.ruc,''), '[^0-9A-Za-z]', '', 'g'), ''),
           c.name, c.email, c.id
      FROM gcc_world.clients c
     WHERE c.name IS NOT NULL AND c.name <> ''
       AND NOT EXISTS (
         SELECT 1 FROM gcc_world.billing_clients bc
          WHERE bc.portal_client_id = c.id
             OR LOWER(bc.name) = LOWER(c.name)
             OR (bc.ruc IS NOT NULL AND bc.ruc <> ''
                 AND regexp_replace(bc.ruc, '[^0-9A-Za-z]', '', 'g') = regexp_replace(COALESCE(c.ruc,''), '[^0-9A-Za-z]', '', 'g')
                 AND regexp_replace(COALESCE(c.ruc,''), '[^0-9A-Za-z]', '', 'g') <> '')
       )
  `);

  // Dirección inversa: billing_clients → clients (enlaza/crea y copia correos faltantes).
  try { await reconcileClientsAndBilling(); } catch (e: any) { console.error('reconcileClientsAndBilling error:', e.message); }

  // Los datos extra van con el cliente de portal de su titular: es por ese enlace como
  // ticket, proyecto y cobro encuentran «los datos de este cliente».
  await pool.query(`
    UPDATE gcc_world.billing_clients h SET portal_client_id = t.portal_client_id
      FROM gcc_world.billing_clients t
     WHERE h.titular_id = t.id AND h.portal_client_id IS DISTINCT FROM t.portal_client_id
  `);

  _init = true;
}

/**
 * QUÉ FACTURAS CUENTAN EN EL MÓDULO DE CLIENTES — definición única (2026-08-23, Fernando).
 *
 * Textual: *«haz que cuente solo facturas completadas o pendientes, pero no anuladas»*.
 * Completada = `paid`; pendiente = `pending`.
 *
 * Se quedan fuera dos estados, y por el mismo motivo: **no son documentos vivos**.
 *  · `cancelled` (anulada en el SRI, `sri_status = 'voided'`) — lo que él pidió excluir.
 *  · `failed` (el SRI la **rechazó**, `sri_status = 'rejected'`) — nunca llegó a existir como
 *    factura, así que contarla como consumo del cliente sería inventar facturación.
 *
 * ⚠️ Es una constante y no un `status <> 'cancelled'` suelto **porque se usa en tres sitios**
 * —cuántas, cuánto y la fecha de la última— y ya se había desincronizado: el total excluía
 * las anuladas, pero el contador y la fecha las incluían, así que un cliente con su única
 * factura anulada salía con «0 facturas» y una fecha de última factura.
 *
 * El DETALLE del cliente sigue listando TODAS sus facturas, incluidas las anuladas: ahí se
 * va a mirar qué pasó con cada una.
 */
export const ESTADOS_FACTURA_QUE_CUENTAN = ['paid', 'pending'] as const;

/** El mismo criterio, para incrustarlo en SQL. `i` es el alias de `gcc_world.invoices`. */
export const SQL_FACTURA_CUENTA = `status = ANY(ARRAY['paid','pending'])`;

export function facturaCuenta(inv: { status: string | null }): boolean {
  return (ESTADOS_FACTURA_QUE_CUENTAN as readonly string[]).includes(inv.status ?? '');
}

export const CONSUMIDOR_FINAL_RUC = '9999999999999';

/**
 * Reconcilia `billing_clients` → `clients` (dirección que faltaba): por cada cuenta de
 * facturación sin `portal_client_id`, enlaza a un cliente existente (por correo o RUC) o
 * crea uno nuevo (`status='inactivo'`); y copia a `clients.email` el correo de su cuenta de
 * facturación cuando el cliente no tiene correo. Así el selector de clientes (tabla `clients`)
 * muestra los mismos clientes que el módulo de facturación, con sus correos. Idempotente.
 */
export async function reconcileClientsAndBilling(): Promise<void> {
  // 1) billing_clients sin portal → enlazar o crear un `clients`
  // Los datos extra de un cliente (`titular_id`) no son clientes: se enlazan con el de su titular.
  const { rows: unlinked } = await pool.query(
    `SELECT id, name, email, ruc FROM gcc_world.billing_clients
      WHERE portal_client_id IS NULL AND titular_id IS NULL AND COALESCE(ruc, '') <> '${CONSUMIDOR_FINAL_RUC}'`,
  );
  for (const bc of unlinked) {
    const email = (bc.email || '').trim().toLowerCase() || null;
    const ruc = (bc.ruc || '').trim() || null;
    let clientId: number | null = null;

    if (email) {
      const r = await pool.query(`SELECT id FROM gcc_world.clients WHERE LOWER(email) = $1 LIMIT 1`, [email]);
      if (r.rows[0]) clientId = Number(r.rows[0].id);
    }
    if (!clientId && ruc) {
      const r = await pool.query(
        `SELECT id FROM gcc_world.clients
          WHERE COALESCE(ruc,'') <> ''
            AND regexp_replace(ruc,'[^0-9A-Za-z]','','g') = regexp_replace($1,'[^0-9A-Za-z]','','g')
          LIMIT 1`, [ruc],
      );
      if (r.rows[0]) clientId = Number(r.rows[0].id);
    }
    if (!clientId) {
      try {
        const ins = await pool.query(
          `INSERT INTO gcc_world.clients (name, email, ruc, status, created_at, updated_at)
           VALUES ($1, $2, $3, 'inactivo', NOW(), NOW()) RETURNING id`,
          [bc.name || email || 'Cliente', email, ruc],
        );
        clientId = Number(ins.rows[0].id);
      } catch {
        // Conflicto de email UNIQUE → crea sin correo (queda ligado por RUC/nombre).
        const ins = await pool.query(
          `INSERT INTO gcc_world.clients (name, ruc, status, created_at, updated_at)
           VALUES ($1, $2, 'inactivo', NOW(), NOW()) RETURNING id`,
          [bc.name || 'Cliente', ruc],
        );
        clientId = Number(ins.rows[0].id);
      }
    }
    if (clientId) {
      await pool.query(`UPDATE gcc_world.billing_clients SET portal_client_id = $1 WHERE id = $2`, [clientId, bc.id]).catch(() => undefined);
    }
  }

  // 2) clients sin correo → copiar el correo de su cuenta de facturación enlazada (si no colisiona)
  const { rows: noEmail } = await pool.query(
    `SELECT c.id, LOWER(bc.email) AS bemail
       FROM gcc_world.clients c
       JOIN gcc_world.billing_clients bc ON bc.portal_client_id = c.id
      WHERE (c.email IS NULL OR c.email = '') AND bc.email IS NOT NULL AND bc.email <> ''`,
  );
  for (const row of noEmail) {
    const clash = await pool.query(`SELECT 1 FROM gcc_world.clients WHERE LOWER(email) = $1 AND id <> $2 LIMIT 1`, [row.bemail, row.id]);
    if (!clash.rows[0]) {
      await pool.query(`UPDATE gcc_world.clients SET email = $1, updated_at = NOW() WHERE id = $2`, [row.bemail, row.id]).catch(() => undefined);
    }
  }
}

export type BillingData = {
  id_type?: string | null;
  ruc?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
};

/**
 * ¿Se puede FACTURAR con esta cuenta tal cual? (Fernando, 2026-09-29).
 *
 * El formulario de «Completar y facturar» ya no deja editar los datos del comprador: salen
 * de la cuenta de facturación elegida. Por eso una cuenta a medias no se ofrece — si no, se
 * emitiría una factura sin dirección o con una cédula mal escrita que el SRI devuelve.
 * Una sola definición para la lista y para la API que factura.
 *   · tipo 04 (RUC) con 13 dígitos · 05 (cédula) con 10 · 06 (pasaporte) y 08 (identificación
 *     del exterior) con algo escrito. El 08 faltaba y dejó fuera a los clientes de fuera del país
 *     (IS-CR, Costa Rica: ya facturado antes); el XML lo emite con `9999999999999` + la real.
 *   · razón social, dirección y correo
 *   · consumidor final NO: se elige aparte, como opción propia.
 */
export function cuentaFacturable(bc: { id_type?: string | null; ruc?: string | null; name?: string | null; address?: string | null; email?: string | null } | null | undefined): boolean {
  if (!bc) return false;
  const ruc = String(bc.ruc || '').trim();
  const tipo = String(bc.id_type || '');
  const idOk = tipo === '04' ? /^\d{13}$/.test(ruc)
    : tipo === '05' ? /^\d{10}$/.test(ruc)
    : tipo === '06' || tipo === '08' ? ruc.length > 0
    : false;
  return idOk && ruc !== CONSUMIDOR_FINAL_RUC
    && !!String(bc.name || '').trim()
    && !!String(bc.address || '').trim()
    && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(bc.email || '').trim());
}

/**
 * VARIOS DATOS DE FACTURACIÓN POR CLIENTE — hasta 3 (Fernando, 2026-10-31: «por cada cliente
 * se puedan guardar varios datos de facturación hasta 3 máximo, y cuando se vaya a facturar,
 * en todas partes, poder elegirlos mediante un selector, que se escoja por defecto lo
 * preregistrado»). Deroga el «una cuenta por cliente» del 2026-08-25.
 *
 * La fila del cliente (`titular_id IS NULL`) es la que sale en el módulo de Clientes y guarda
 * su primer juego de datos. Los otros dos son filas de `billing_clients` con `titular_id` =
 * esa fila: así cada juego tiene su id, y ticket, proyecto y suscripción facturan con
 * `billing_client_id` igual que antes. Las facturas de cualquiera de los tres cuentan para el
 * cliente (`SQL_RUCS_DEL_CLIENTE`). `dato_predeterminado_id` del titular dice cuál se propone
 * al facturar; sin él, el suyo propio.
 */
export const MAX_DATOS_FACTURACION = 3;

/** Las facturas del cliente `bc` (alias de la fila titular): las de sus tres juegos y sus alias. */
export const SQL_RUCS_DEL_CLIENTE = (bc: string, i: string) => `(${i}.client_ruc = ${bc}.ruc OR ${i}.client_ruc = ANY(${bc}.aliases)
  OR ${i}.client_ruc IN (SELECT h.ruc FROM gcc_world.billing_clients h WHERE h.titular_id = ${bc}.id AND h.ruc IS NOT NULL))`;

/** El titular y sus datos extra, el predeterminado primero. `titularId` es la fila del cliente. */
export async function getDatosDelTitular(titularId: number | string): Promise<any[]> {
  const { rows } = await pool.query(
    `SELECT h.*, (h.id = COALESCE(t.dato_predeterminado_id, t.id)) AS predeterminada
       FROM gcc_world.billing_clients t
       JOIN gcc_world.billing_clients h ON h.id = t.id OR h.titular_id = t.id
      WHERE t.id = $1
      ORDER BY (h.id = COALESCE(t.dato_predeterminado_id, t.id)) DESC, (h.titular_id IS NULL) DESC, h.id`,
    [titularId],
  );
  return rows;
}

/** La fila titular del cliente de portal `clientId` (si hubiera dos, la más antigua), o null. */
async function titularDeCliente(clientId: number | string): Promise<any | null> {
  const { rows } = await pool.query(
    `SELECT * FROM gcc_world.billing_clients WHERE portal_client_id = $1 AND titular_id IS NULL ORDER BY id LIMIT 1`,
    [clientId],
  );
  return rows[0] || null;
}

/** Los juegos de datos del cliente de portal `clientId`, el predeterminado primero. */
export async function getDatosFacturacionCliente(clientId: number | string): Promise<any[]> {
  await ensureBillingClientsTable();
  const t = await titularDeCliente(clientId);
  return t ? getDatosDelTitular(t.id) : [];
}

/** Los datos que se proponen al facturar al cliente de portal `clientId`, o null. */
export async function getBillingForClient(clientId: number | string): Promise<any | null> {
  return (await getDatosFacturacionCliente(clientId))[0] || null;
}

/**
 * Guarda los datos con los que se acaba de facturar al cliente de portal `clientId` (el cobro
 * en línea y la factura manual, donde se escriben a mano). Con varios juegos por cliente:
 *   · si la identificación es la de uno de sus juegos, se actualiza ese;
 *   · si es nueva y le queda hueco (menos de `MAX_DATOS_FACTURACION`), se añade como otro juego;
 *   · si ya tiene los tres, no se toca nada: la factura sale igual con lo escrito.
 * Un cliente sin identificación todavía la recibe en su propia fila. Devuelve el id de la
 * fila guardada, o null. El UNIQUE de `ruc` se respeta: una identificación de otro cliente no
 * se le roba.
 */
export async function upsertBillingForClient(clientId: number | string, data: BillingData): Promise<number | null> {
  await ensureBillingClientsTable();
  const ruc = (data.ruc || '').trim() || null;
  const idType = data.id_type || (ruc === CONSUMIDOR_FINAL_RUC ? '07' : (ruc ? null : '07'));
  const name = (data.name || '').trim() || 'CLIENTE SIN NOMBRE';
  const email = (data.email || '').trim() || null;
  const phone = (data.phone || '').trim() || null;
  const address = (data.address || '').trim() || null;
  // Facturar a consumidor final no es un juego de datos del cliente.
  if (ruc === CONSUMIDOR_FINAL_RUC) return null;

  const titular = await titularDeCliente(clientId);
  if (titular) {
    const datos = await getDatosDelTitular(titular.id);
    const mismo = ruc ? datos.find((d) => d.ruc === ruc) : null;
    // Sin identificación propia, la fila del cliente se completa con esta.
    const destino = mismo || (!String(titular.ruc || '').trim() ? titular : null);
    if (destino) {
      let setRuc = ruc;
      if (ruc && !mismo) {
        const clash = await pool.query(`SELECT 1 FROM gcc_world.billing_clients WHERE ruc = $1 AND id <> $2 LIMIT 1`, [ruc, destino.id]);
        if (clash.rows[0]) setRuc = null; // el ruc ya es de otra cuenta → no lo tocamos
      }
      await pool.query(
        `UPDATE gcc_world.billing_clients
            SET id_type = $1, ruc = COALESCE($2, ruc), name = $3, email = $4, phone = $5, address = $6, updated_at = NOW()
          WHERE id = $7`,
        [idType, setRuc, name, email, phone, address, destino.id],
      );
      return Number(destino.id);
    }
    if (!ruc || datos.length >= MAX_DATOS_FACTURACION) return null;
    const clash = await pool.query(`SELECT 1 FROM gcc_world.billing_clients WHERE ruc = $1 LIMIT 1`, [ruc]);
    if (clash.rows[0]) return null;
    const ins = await pool.query(
      `INSERT INTO gcc_world.billing_clients (id_type, ruc, name, email, phone, address, portal_client_id, titular_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [idType, ruc, name, email, phone, address, clientId, titular.id],
    );
    return Number(ins.rows[0].id);
  }

  // Sin cuenta aún: si existe una fila con ese ruc sin dueño, se enlaza; si es de otro, se crea sin ruc.
  if (ruc) {
    const byRuc = await pool.query(`SELECT id, portal_client_id, titular_id FROM gcc_world.billing_clients WHERE ruc = $1 LIMIT 1`, [ruc]);
    if (byRuc.rows[0]) {
      if (byRuc.rows[0].portal_client_id == null && byRuc.rows[0].titular_id == null) {
        const id = Number(byRuc.rows[0].id);
        await pool.query(
          `UPDATE gcc_world.billing_clients SET portal_client_id = $1, id_type = $2, name = $3, email = $4, phone = $5, address = $6, updated_at = NOW() WHERE id = $7`,
          [clientId, idType, name, email, phone, address, id],
        );
        return id;
      }
      const ins = await pool.query(
        `INSERT INTO gcc_world.billing_clients (id_type, ruc, name, email, phone, address, portal_client_id) VALUES ($1, NULL, $2, $3, $4, $5, $6) RETURNING id`,
        [idType, name, email, phone, address, clientId],
      );
      return Number(ins.rows[0].id);
    }
  }

  const ins = await pool.query(
    `INSERT INTO gcc_world.billing_clients (id_type, ruc, name, email, phone, address, portal_client_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [idType, ruc, name, email, phone, address, clientId],
  );
  return Number(ins.rows[0].id);
}

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
