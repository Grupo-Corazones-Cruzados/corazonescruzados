import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { ensureBillingClientsTable, CONSUMIDOR_FINAL_RUC, MAX_DATOS_FACTURACION } from '@/lib/billing-clients';
import { clienteFacturacionEsMio } from '@/lib/pertenencia';

/**
 * Añade un juego de datos de facturación al cliente `[id]` (hasta `MAX_DATOS_FACTURACION`
 * contando los suyos). Es una fila de `billing_clients` con `titular_id` = el cliente: ver
 * `lib/billing-clients.ts`. Devuelve el id del juego nuevo.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'admin' && user.role !== 'member')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await ensureBillingClientsTable();
    const { id } = await params;
    // Un miembro, solo en sus clientes (Fernando, 2026-11-09).
    if (!(await clienteFacturacionEsMio(user, id))) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });

    const { rows: [t] } = await pool.query(
      `SELECT t.id, t.ruc, t.portal_client_id,
              (SELECT COUNT(*) FROM gcc_world.billing_clients h WHERE h.titular_id = t.id)::int AS extra
         FROM gcc_world.billing_clients b
         JOIN gcc_world.billing_clients t ON t.id = COALESCE(b.titular_id, b.id)
        WHERE b.id = $1`, [Number(id) || 0]);
    if (!t) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    if (t.ruc === CONSUMIDOR_FINAL_RUC) return NextResponse.json({ error: 'Consumidor Final no lleva otros datos de facturación' }, { status: 400 });
    if (t.extra + 1 >= MAX_DATOS_FACTURACION) {
      return NextResponse.json({ error: `Un cliente puede tener hasta ${MAX_DATOS_FACTURACION} datos de facturación` }, { status: 400 });
    }

    const b = await req.json();
    const idType = String(b.id_type || '04');
    const ruc = String(b.ruc || '').trim();
    const name = String(b.name || '').trim();
    if (idType === '07') return NextResponse.json({ error: 'Consumidor Final se elige al facturar; no se guarda como datos del cliente' }, { status: 400 });
    if (!ruc) return NextResponse.json({ error: 'La identificación es requerida' }, { status: 400 });
    if (!name) return NextResponse.json({ error: 'El nombre / razón social es requerido' }, { status: 400 });

    const { rows: [otro] } = await pool.query(
      `SELECT COALESCE(t.name, b.name) AS cliente
         FROM gcc_world.billing_clients b
         LEFT JOIN gcc_world.billing_clients t ON t.id = b.titular_id
        WHERE b.ruc = $1 LIMIT 1`, [ruc]);
    if (otro) return NextResponse.json({ error: `Esa identificación ya está registrada en el cliente «${otro.cliente}»` }, { status: 409 });

    const { rows: [n] } = await pool.query(
      `INSERT INTO gcc_world.billing_clients (id_type, ruc, name, email, phone, address, country, portal_client_id, titular_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [idType, ruc, name, String(b.email || '').trim() || null, String(b.phone || '').trim() || null,
       String(b.address || '').trim() || null, String(b.country || '').trim() || null, t.portal_client_id, t.id],
    );
    if (b.predeterminado === true) {
      await pool.query(`UPDATE gcc_world.billing_clients SET dato_predeterminado_id = $1, updated_at = NOW() WHERE id = $2`, [n.id, t.id]);
    }
    return NextResponse.json({ data: { id: n.id } });
  } catch (err: any) {
    if (err.code === '23505') return NextResponse.json({ error: 'Ya existe un cliente con esa identificación' }, { status: 409 });
    console.error('Billing client datos create error:', err.message);
    return NextResponse.json({ error: 'Error al guardar los datos de facturación' }, { status: 500 });
  }
}
