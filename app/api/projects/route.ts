import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/projects - List projects with role-based filtering
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
        p.*,
        json_build_object('id', c.id, 'nombre', c.nombre, 'correo_electronico', c.correo_electronico) as cliente,
        json_build_object('id', m.id, 'nombre', m.nombre, 'foto', m.foto) as miembro_asignado
      FROM projects p
      LEFT JOIN clientes c ON p.id_cliente = c.id
      LEFT JOIN miembros m ON p.id_miembro_asignado = m.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Role-based filtering
    if (rol === "cliente") {
      // Get client ID from email
      const clientResult = await query(
        "SELECT id FROM clientes WHERE correo_electronico = $1",
        [tokenData.email]
      );
      if (clientResult.rows.length > 0) {
        sql += ` AND p.id_cliente = $${paramIndex}`;
        params.push(clientResult.rows[0].id);
        paramIndex++;
      } else {
        return NextResponse.json({ projects: [] });
      }
    } else if (rol === "miembro" && id_miembro) {
      // Members see published projects or assigned to them
      sql += ` AND (p.estado = 'publicado' OR p.id_miembro_asignado = $${paramIndex})`;
      params.push(id_miembro);
      paramIndex++;
    }

    // Apply filters
    if (estado && estado !== "todos") {
      sql += ` AND p.estado = $${paramIndex}`;
      params.push(estado);
      paramIndex++;
    }

    if (search) {
      sql += ` AND (p.titulo ILIKE $${paramIndex} OR p.descripcion ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    sql += " ORDER BY p.created_at DESC";

    const result = await query(sql, params);

    return NextResponse.json({ projects: result.rows });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json({ error: "Error al cargar los proyectos" }, { status: 500 });
  }
}

// POST /api/projects - Create a new project
export async function POST(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { id_cliente, titulo, descripcion, presupuesto_min, presupuesto_max, fecha_limite } = body;

    if (!id_cliente || !titulo) {
      return NextResponse.json(
        { error: "Cliente y título son requeridos" },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO projects (id_cliente, titulo, descripcion, presupuesto_min, presupuesto_max, fecha_limite, estado)
       VALUES ($1, $2, $3, $4, $5, $6, 'publicado')
       RETURNING *`,
      [id_cliente, titulo, descripcion, presupuesto_min, presupuesto_max, fecha_limite]
    );

    return NextResponse.json({ project: result.rows[0] });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json({ error: "Error al crear el proyecto" }, { status: 500 });
  }
}
