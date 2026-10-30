import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { ensureFinanceTables, SQL_INGRESO_FACTURADO, SQL_RENGLON_BLOQUEADO, NOMBRE_ADICIONAL, recalcMonth } from '@/lib/finance';

// GET: fetch month detail with items (admin and member only)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    if (user.role === 'client') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    await ensureFinanceTables();

    const { rows: [month] } = await pool.query(`SELECT * FROM gcc_world.finance_months WHERE id = $1`, [id]);
    if (!month) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { rows: items } = await pool.query(
      `SELECT fi.*, ${SQL_INGRESO_FACTURADO} AS facturado, ${SQL_RENGLON_BLOQUEADO} AS bloqueado FROM gcc_world.finance_items fi WHERE fi.month_id = $1 ORDER BY fi.type, fi.sort_order, fi.id`, [id]
    );

    return NextResponse.json({ data: { ...month, items } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PUT: guarda los ADICIONALES del mes (Fernando, 2026-10-30) — y SOLO ellos. Los ingresos y egresos
 * del SRI no se tocan desde aquí: ni se editan, ni se borran, ni se añaden.
 *
 * Cuerpo: `{ adicionales: [{ type: 'income' | 'expense', description, amount }] }`. Reemplaza los
 * adicionales del mes por esa lista, en una transacción. Sin `adicionales` responde 409: es una
 * pestaña con la versión anterior, que mandaba el mes entero en `items` y aquí lo duplicaría.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    const { adicionales } = await req.json();

    if (!Array.isArray(adicionales)) {
      return NextResponse.json({ error: 'La página está desactualizada: recárgala y vuelve a guardar.' }, { status: 409 });
    }
    await ensureFinanceTables();

    const { rows: [month] } = await pool.query(`SELECT id FROM gcc_world.finance_months WHERE id = $1`, [id]);
    if (!month) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Los adicionales escritos ANTES de la regla de una palabra («Sueldo Helen») se aceptan tal cual
    // mientras no se cambie su nombre.
    const { rows: previos } = await pool.query(
      `SELECT description FROM gcc_world.finance_items WHERE month_id = $1 AND adicional`, [id]
    );
    const nombresPrevios = new Set(previos.map((r: any) => r.description));

    const filas: { type: 'income' | 'expense'; description: string; amount: number }[] = [];
    for (const a of adicionales) {
      const description = String(a?.description ?? '').trim();
      const amount = Math.round((Number(a?.amount) || 0) * 100) / 100;
      if (!description && !amount) continue;
      if (a?.type !== 'income' && a?.type !== 'expense') {
        return NextResponse.json({ error: 'Cada adicional es un ingreso o un egreso.' }, { status: 400 });
      }
      if (!NOMBRE_ADICIONAL.test(description) && !nombresPrevios.has(description)) {
        return NextResponse.json({ error: `«${description || 'sin nombre'}»: el nombre de un adicional es una sola palabra.` }, { status: 400 });
      }
      if (!(amount > 0)) {
        return NextResponse.json({ error: `«${description}»: el importe tiene que ser mayor que cero.` }, { status: 400 });
      }
      filas.push({ type: a.type, description, amount });
    }

    // Borrar y volver a insertar en UNA transacción, con su propio cliente (con `pool.query` el
    // BEGIN se queda en otra conexión y el ROLLBACK no deshace nada).
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      await cliente.query(`DELETE FROM gcc_world.finance_items WHERE month_id = $1 AND adicional`, [id]);
      for (let i = 0; i < filas.length; i++) {
        await cliente.query(
          `INSERT INTO gcc_world.finance_items (month_id, type, description, amount, sort_order, adicional) VALUES ($1, $2, $3, $4, $5, TRUE)`,
          [id, filas[i].type, filas[i].description, filas[i].amount, i]
        );
      }
      await cliente.query('COMMIT');
    } catch (e) {
      await cliente.query('ROLLBACK');
      throw e;
    } finally {
      cliente.release();
    }
    await recalcMonth(Number(id));

    const { rows: [m] } = await pool.query(`SELECT * FROM gcc_world.finance_months WHERE id = $1`, [id]);
    return NextResponse.json({ data: m });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: remove a month and its items
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id } = await params;
    await ensureFinanceTables();

    // Borrar el mes se llevaría por delante sus renglones bloqueados: un mes con alguno no se borra.
    const { rows: [b] } = await pool.query(
      `SELECT count(*)::int AS n FROM gcc_world.finance_items fi WHERE fi.month_id = $1 AND ${SQL_RENGLON_BLOQUEADO}`, [id]
    );
    if (b?.n > 0) return NextResponse.json({ error: 'Este mes tiene ingresos o egresos del SRI: no se puede borrar.' }, { status: 409 });

    await pool.query(`DELETE FROM gcc_world.finance_months WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
