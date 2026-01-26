import { NextRequest, NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// POST /api/invoices/generate-from-project - Generate invoice from a project
export async function POST(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: "ID del proyecto es requerido" }, { status: 400 });
    }

    // Fetch project
    const projectResult = await query(
      `SELECT id, titulo, id_cliente, id_miembro_asignado
       FROM projects
       WHERE id = $1`,
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }

    const project = projectResult.rows[0];

    // Fetch completed requirements
    const requirementsResult = await query(
      `SELECT id, titulo, costo
       FROM project_requirements
       WHERE id_project = $1 AND completado = true AND costo > 0`,
      [projectId]
    );

    // Build invoice items
    const items: { descripcion: string; cantidad: number; precio_unitario: number }[] = [];

    for (const req of requirementsResult.rows) {
      items.push({
        descripcion: req.titulo,
        cantidad: 1,
        precio_unitario: req.costo,
      });
    }

    // Calculate subtotal
    const subtotal = items.reduce(
      (sum, item) => sum + item.cantidad * item.precio_unitario,
      0
    );

    const result = await transaction(async (client) => {
      // Create invoice
      const invoiceResult = await client.query(
        `INSERT INTO invoices (id_cliente, id_miembro, id_project, subtotal, impuestos, estado)
         VALUES ($1, $2, $3, $4, 0, 'pendiente')
         RETURNING *`,
        [project.id_cliente, project.id_miembro_asignado, projectId, subtotal]
      );

      const invoice = invoiceResult.rows[0];

      // Create invoice items
      for (const item of items) {
        await client.query(
          `INSERT INTO invoice_items (id_invoice, descripcion, cantidad, precio_unitario)
           VALUES ($1, $2, $3, $4)`,
          [invoice.id, item.descripcion, item.cantidad, item.precio_unitario]
        );
      }

      return invoice;
    });

    return NextResponse.json({ invoice: result });
  } catch (error) {
    console.error("Error generating invoice from project:", error);
    return NextResponse.json({ error: "Error al generar la factura" }, { status: 500 });
  }
}
