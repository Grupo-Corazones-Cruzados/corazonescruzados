import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/member/projects - Get projects where the member has bid, has accepted bid, or is owner
export async function GET(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Get user profile + member id
    const userResult = await query(
      "SELECT id, rol, id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );

    if (userResult.rows.length === 0 || (userResult.rows[0].rol !== "miembro" && userResult.rows[0].rol !== "admin")) {
      return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
    }

    const miembroId = userResult.rows[0].id_miembro;
    if (!miembroId) {
      return NextResponse.json({ error: "No tienes un registro de miembro vinculado" }, { status: 403 });
    }

    // Get projects where member has submitted a bid (any status) OR is the owner
    const result = await query(
      `SELECT DISTINCT
        p.*,
        jsonb_build_object('id', c.id, 'nombre', c.nombre, 'correo_electronico', c.correo_electronico) as cliente,
        jsonb_build_object('id', mp.id, 'nombre', mp.nombre, 'foto', mp.foto, 'puesto', mp.puesto) as miembro_propietario,
        pb_me.id as mi_bid_id,
        pb_me.estado as mi_bid_estado,
        pb_me.precio_ofertado as mi_precio_ofertado,
        pb_me.monto_acordado as mi_monto_acordado,
        pb_me.confirmado_por_miembro as mi_confirmado,
        (SELECT COUNT(*) FROM project_bids WHERE id_project = p.id) as bids_count,
        (SELECT COUNT(*) FROM project_bids WHERE id_project = p.id AND estado = 'aceptada') as accepted_count,
        CASE WHEN p.id_miembro_propietario = $1 THEN true ELSE false END as es_propietario
      FROM projects p
      LEFT JOIN clientes c ON p.id_cliente = c.id
      LEFT JOIN miembros mp ON p.id_miembro_propietario = mp.id
      LEFT JOIN project_bids pb_me ON pb_me.id_project = p.id AND pb_me.id_miembro = $1
      WHERE pb_me.id IS NOT NULL OR p.id_miembro_propietario = $1
      ORDER BY p.updated_at DESC`,
      [miembroId]
    );

    // Compute stats
    const projects = result.rows;

    // Postulaciones: projects where I have a bid
    const postulacionesProjects = projects.filter((p: any) => p.mi_bid_estado === "pendiente");
    const asignadosProjects = projects.filter((p: any) => p.mi_bid_estado === "aceptada" && ["publicado", "planificado", "en_progreso"].includes(p.estado));
    const completadosProjects = projects.filter((p: any) => p.mi_bid_estado === "aceptada" && ["completado", "completado_parcial"].includes(p.estado));
    const rechazadosProjects = projects.filter((p: any) => p.mi_bid_estado === "rechazada");

    // Proyectos propios: where I'm the owner
    const propiosProjects = projects.filter((p: any) => p.es_propietario === true);
    const propiosPrivados = propiosProjects.filter((p: any) => p.visibilidad === "privado");
    const propiosPublicos = propiosProjects.filter((p: any) => p.visibilidad === "publico");

    const stats = {
      total: projects.length,
      postulados: postulacionesProjects.length,
      asignados: asignadosProjects.length,
      completados: completadosProjects.length,
      rechazados: rechazadosProjects.length,
      propios: propiosProjects.length,
      propios_privados: propiosPrivados.length,
      propios_publicos: propiosPublicos.length,
    };

    return NextResponse.json({ projects, stats });
  } catch (error) {
    console.error("Error fetching member projects:", error);
    return NextResponse.json({ error: "Error al cargar los proyectos" }, { status: 500 });
  }
}

// POST /api/member/projects - Create a new project owned by the member
export async function POST(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Get user profile + member id
    const userResult = await query(
      "SELECT id, rol, id_miembro FROM user_profiles WHERE id = $1",
      [tokenData.userId]
    );

    if (userResult.rows.length === 0 || (userResult.rows[0].rol !== "miembro" && userResult.rows[0].rol !== "admin")) {
      return NextResponse.json({ error: "No eres miembro" }, { status: 403 });
    }

    const miembroId = userResult.rows[0].id_miembro;
    if (!miembroId) {
      return NextResponse.json({ error: "No tienes un registro de miembro vinculado" }, { status: 403 });
    }

    const body = await request.json();
    const { titulo, descripcion, visibilidad, presupuesto_min, presupuesto_max, fecha_limite, id_cliente } = body;

    // Validate required fields
    if (!titulo || titulo.trim() === "") {
      return NextResponse.json({ error: "El título es requerido" }, { status: 400 });
    }

    // Validate visibility
    const validVisibilidad = visibilidad === "publico" ? "publico" : "privado";

    // If id_cliente is provided, verify the client exists
    if (id_cliente) {
      const clientCheck = await query("SELECT id FROM clientes WHERE id = $1", [id_cliente]);
      if (clientCheck.rows.length === 0) {
        return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
      }
    }

    // Create the project
    const result = await query(
      `INSERT INTO projects (
        titulo, descripcion, visibilidad, presupuesto_min, presupuesto_max,
        fecha_limite, id_cliente, id_miembro_propietario, tipo_proyecto, estado
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'miembro', 'publicado')
      RETURNING *`,
      [
        titulo.trim(),
        descripcion?.trim() || null,
        validVisibilidad,
        presupuesto_min || null,
        presupuesto_max || null,
        fecha_limite || null,
        id_cliente || null,
        miembroId
      ]
    );

    return NextResponse.json({ project: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Error creating member project:", error);
    return NextResponse.json({ error: "Error al crear el proyecto" }, { status: 500 });
  }
}
