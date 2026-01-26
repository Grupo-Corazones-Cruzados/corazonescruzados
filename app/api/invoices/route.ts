import { NextRequest, NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/invoices - List invoices with role-based filtering
export async function GET(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";
    const estado = searchParams.get("estado") || "";

    // Get user profile to check role
    const userResult = await query(
      "SELECT rol, id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    const { rol, id_miembro } = userResult.rows[0];

    let sql = `
      SELECT
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
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Role-based filtering
    if (rol === "miembro" && id_miembro) {
      sql += ` AND i.id_miembro = $${paramIndex}`;
      params.push(id_miembro);
      paramIndex++;
    } else if (rol === "cliente") {
      // Get client ID from email
      const clientResult = await query(
        "SELECT id FROM clientes WHERE correo_electronico = $1",
        [tokenData.email]
      );
      if (clientResult.rows.length > 0) {
        sql += ` AND i.id_cliente = $${paramIndex}`;
        params.push(clientResult.rows[0].id);
        paramIndex++;
      } else {
        return NextResponse.json({ invoices: [] });
      }
    }

    // Apply filters
    if (estado && estado !== "todos") {
      sql += ` AND i.estado = $${paramIndex}`;
      params.push(estado);
      paramIndex++;
    }

    if (search) {
      sql += ` AND i.numero_factura ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    sql += " ORDER BY i.created_at DESC";

    const result = await query(sql, params);

    return NextResponse.json({ invoices: result.rows });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json({ error: "Error al cargar las facturas" }, { status: 500 });
  }
}

// POST /api/invoices - Create a new invoice
export async function POST(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { id_cliente, id_miembro, id_ticket, id_project, subtotal, notas, items } = body;

    if (!id_cliente || !subtotal) {
      return NextResponse.json(
        { error: "Cliente y subtotal son requeridos" },
        { status: 400 }
      );
    }

    const result = await transaction(async (client) => {
      // Create invoice
      const invoiceResult = await client.query(
        `INSERT INTO invoices (id_cliente, id_miembro, id_ticket, id_project, subtotal, impuestos, notas, estado)
         VALUES ($1, $2, $3, $4, $5, 0, $6, 'pendiente')
         RETURNING *`,
        [id_cliente, id_miembro || null, id_ticket || null, id_project || null, subtotal, notas || null]
      );

      const invoice = invoiceResult.rows[0];

      // Create items
      if (items && items.length > 0) {
        for (const item of items) {
          await client.query(
            `INSERT INTO invoice_items (id_invoice, descripcion, cantidad, precio_unitario)
             VALUES ($1, $2, $3, $4)`,
            [invoice.id, item.descripcion, item.cantidad, item.precio_unitario]
          );
        }
      }

      return invoice;
    });

    return NextResponse.json({ invoice: result });
  } catch (error) {
    console.error("Error creating invoice:", error);
    return NextResponse.json({ error: "Error al crear la factura" }, { status: 500 });
  }
}
