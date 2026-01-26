import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/invoices/[id]/items - Get items for an invoice
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const invoiceId = parseInt(id);

    const result = await query(
      `SELECT * FROM invoice_items
       WHERE id_invoice = $1
       ORDER BY created_at ASC`,
      [invoiceId]
    );

    return NextResponse.json({ items: result.rows });
  } catch (error) {
    console.error("Error fetching invoice items:", error);
    return NextResponse.json({ error: "Error al cargar los items" }, { status: 500 });
  }
}

// POST /api/invoices/[id]/items - Add an item to an invoice
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const invoiceId = parseInt(id);
    const body = await request.json();
    const { descripcion, cantidad, precio_unitario } = body;

    if (!descripcion || !cantidad || !precio_unitario) {
      return NextResponse.json(
        { error: "Descripción, cantidad y precio unitario son requeridos" },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO invoice_items (id_invoice, descripcion, cantidad, precio_unitario)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [invoiceId, descripcion, cantidad, precio_unitario]
    );

    // Update invoice subtotal
    const subtotalResult = await query(
      `SELECT SUM(subtotal) as new_subtotal FROM invoice_items WHERE id_invoice = $1`,
      [invoiceId]
    );

    await query(
      `UPDATE invoices SET subtotal = $1, updated_at = NOW() WHERE id = $2`,
      [subtotalResult.rows[0].new_subtotal || 0, invoiceId]
    );

    return NextResponse.json({ item: result.rows[0] });
  } catch (error) {
    console.error("Error creating invoice item:", error);
    return NextResponse.json({ error: "Error al crear el item" }, { status: 500 });
  }
}

// DELETE /api/invoices/[id]/items - Delete an item
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const invoiceId = parseInt(id);
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("itemId");

    if (!itemId) {
      return NextResponse.json({ error: "ID del item es requerido" }, { status: 400 });
    }

    await query("DELETE FROM invoice_items WHERE id = $1", [parseInt(itemId)]);

    // Update invoice subtotal
    const subtotalResult = await query(
      `SELECT SUM(subtotal) as new_subtotal FROM invoice_items WHERE id_invoice = $1`,
      [invoiceId]
    );

    await query(
      `UPDATE invoices SET subtotal = $1, updated_at = NOW() WHERE id = $2`,
      [subtotalResult.rows[0].new_subtotal || 0, invoiceId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting invoice item:", error);
    return NextResponse.json({ error: "Error al eliminar el item" }, { status: 500 });
  }
}
