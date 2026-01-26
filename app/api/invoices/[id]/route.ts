import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/invoices/[id] - Get a single invoice with items
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const invoiceId = parseInt(id);

    // Get invoice with relations
    const invoiceResult = await query(
      `SELECT
        i.*,
        json_build_object('id', c.id, 'nombre', c.nombre, 'correo_electronico', c.correo_electronico) as cliente,
        json_build_object('id', m.id, 'nombre', m.nombre) as miembro,
        json_build_object('id', t.id, 'titulo', t.titulo) as ticket,
        json_build_object('id', p.id, 'titulo', p.titulo) as project
      FROM invoices i
      LEFT JOIN clientes c ON i.id_cliente = c.id
      LEFT JOIN miembros m ON i.id_miembro = m.id
      LEFT JOIN tickets t ON i.id_ticket = t.id
      LEFT JOIN projects p ON i.id_project = p.id
      WHERE i.id = $1`,
      [invoiceId]
    );

    if (invoiceResult.rows.length === 0) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }

    // Get items
    const itemsResult = await query(
      `SELECT * FROM invoice_items
       WHERE id_invoice = $1
       ORDER BY created_at ASC`,
      [invoiceId]
    );

    return NextResponse.json({
      invoice: invoiceResult.rows[0],
      items: itemsResult.rows,
    });
  } catch (error) {
    console.error("Error fetching invoice:", error);
    return NextResponse.json({ error: "Error al cargar la factura" }, { status: 500 });
  }
}

// PATCH /api/invoices/[id] - Update an invoice
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const invoiceId = parseInt(id);
    const body = await request.json();

    // Get current invoice for timestamp logic
    const currentInvoice = await query("SELECT * FROM invoices WHERE id = $1", [invoiceId]);
    if (currentInvoice.rows.length === 0) {
      return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 });
    }

    const invoice = currentInvoice.rows[0];

    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const allowedFields = ["estado", "notas", "pdf_url"];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(body[field]);
        paramIndex++;
      }
    }

    // Set timestamps for status changes
    if (body.estado === "enviada" && !invoice.fecha_envio) {
      updates.push(`fecha_envio = $${paramIndex}`);
      values.push(new Date().toISOString());
      paramIndex++;
    }
    if (body.estado === "pagada" && !invoice.fecha_pago) {
      updates.push(`fecha_pago = $${paramIndex}`);
      values.push(new Date().toISOString());
      paramIndex++;
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    values.push(invoiceId);
    const sql = `UPDATE invoices SET ${updates.join(", ")}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`;

    const result = await query(sql, values);

    return NextResponse.json({ invoice: result.rows[0] });
  } catch (error) {
    console.error("Error updating invoice:", error);
    return NextResponse.json({ error: "Error al actualizar la factura" }, { status: 500 });
  }
}
