import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { ensureBillingClientsTable, getBillingForClient } from '@/lib/billing-clients';

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'member')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await ensureBillingClientsTable();

    // `?portal_client_id=` → la cuenta de facturación (1 por cliente) para PRELLENAR el modal.
    const portalClientId = new URL(req.url).searchParams.get('portal_client_id');
    if (portalClientId) {
      const bc = await getBillingForClient(portalClientId);
      return NextResponse.json({ data: bc || null });
    }

    const search = (new URL(req.url).searchParams.get('search') || '').trim();
    const params: any[] = [];
    let where = '';
    if (search) {
      params.push(`%${search}%`);
      where = `WHERE bc.name ILIKE $1 OR bc.ruc ILIKE $1 OR bc.email ILIKE $1`;
    }

    const { rows } = await pool.query(
      `SELECT bc.id, bc.id_type, bc.ruc, bc.name, bc.email, bc.phone, bc.address, bc.notes, bc.aliases, bc.country,
              COALESCE(s.facturas, 0) AS facturas,
              COALESCE(s.total, 0) AS total,
              COALESCE(s.autorizadas, 0) AS autorizadas,
              to_char(s.ultima, 'YYYY-MM-DD') AS ultima
         FROM gcc_world.billing_clients bc
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::int AS facturas,
                  COALESCE(SUM(total) FILTER (WHERE status <> 'cancelled'), 0)::numeric AS total,
                  COUNT(*) FILTER (WHERE sri_status = 'authorized')::int AS autorizadas,
                  MAX(created_at) AS ultima
             FROM gcc_world.invoices i
            WHERE i.client_ruc = bc.ruc OR i.client_ruc = ANY(bc.aliases)
         ) s ON true
         ${where}
         ORDER BY LOWER(bc.name) ASC`,
      params
    );

    const data = rows.map((r: any) => ({
      id: r.id, id_type: r.id_type, ruc: r.ruc, name: r.name, email: r.email,
      phone: r.phone, address: r.address, notes: r.notes, aliases: r.aliases || [], country: r.country,
      facturas: Number(r.facturas), total: Number(r.total), autorizadas: Number(r.autorizadas),
      ultima: r.ultima || null,
      is_consumidor_final: r.ruc === '9999999999999',
    }));

    return NextResponse.json({ data });
  } catch (err: any) {
    console.error('Billing clients list error:', err.message);
    return NextResponse.json({ data: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'member')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await ensureBillingClientsTable();

    const b = await req.json();
    const idType = String(b.id_type || '07');
    const isCF = idType === '07';
    const ruc = isCF ? '9999999999999' : String(b.ruc || '').trim();
    const name = isCF ? 'CONSUMIDOR FINAL' : String(b.name || '').trim();
    if (!isCF && !ruc) return NextResponse.json({ error: 'La identificación es requerida' }, { status: 400 });
    if (!isCF && !name) return NextResponse.json({ error: 'El nombre / razón social es requerido' }, { status: 400 });

    const { rows: [exists] } = await pool.query(`SELECT id FROM gcc_world.billing_clients WHERE ruc = $1`, [ruc]);
    if (exists) return NextResponse.json({ error: 'Ya existe un cliente con esa identificación' }, { status: 409 });

    const { rows: [c] } = await pool.query(
      `INSERT INTO gcc_world.billing_clients (id_type, ruc, name, email, phone, address, notes, country)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [idType, ruc, name, String(b.email || '').trim() || null, String(b.phone || '').trim() || null,
       String(b.address || '').trim() || null, String(b.notes || '').trim() || null, String(b.country || '').trim() || null]
    );

    // Reflejar en la tabla del portal `clients` (lista unificada) para que aparezca en los
    // selectores de tickets/proyectos. Consumidor Final no se refleja.
    if (!isCF) {
      try {
        const normRuc = ruc.replace(/[^0-9A-Za-z]/g, '');
        const { rows: [existing] } = await pool.query(
          `SELECT id FROM gcc_world.clients
            WHERE LOWER(name) = LOWER($1)
               OR ($2 <> '' AND ruc IS NOT NULL AND regexp_replace(ruc,'[^0-9A-Za-z]','','g') = $2)
            LIMIT 1`,
          [name, normRuc]
        );
        let portalId = existing?.id;
        if (!portalId) {
          const ins = await pool.query(
            `INSERT INTO gcc_world.clients (name, email, ruc, address, phone) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
            [name, String(b.email || '').trim() || null, ruc || null, String(b.address || '').trim() || null, String(b.phone || '').trim() || null]
          ).catch((e: any) => {
            if (e.code === '23505') return pool.query(`INSERT INTO gcc_world.clients (name, ruc, address) VALUES ($1,$2,$3) RETURNING id`, [name, ruc || null, String(b.address || '').trim() || null]);
            throw e;
          });
          portalId = ins.rows[0]?.id;
        }
        if (portalId) await pool.query(`UPDATE gcc_world.billing_clients SET portal_client_id = $1 WHERE id = $2`, [portalId, c.id]);
      } catch (mirrorErr: any) { console.error('Mirror billing_client → clients error:', mirrorErr.message); }
    }

    return NextResponse.json({ data: { id: c.id } });
  } catch (err: any) {
    console.error('Billing client create error:', err.message);
    return NextResponse.json({ error: 'Error al crear el cliente' }, { status: 500 });
  }
}
