import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/projects/[id]/bids - Get bids for a project
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const projectId = parseInt(id);

    const result = await query(
      `SELECT pb.*, json_build_object('id', m.id, 'nombre', m.nombre, 'foto', m.foto, 'puesto', m.puesto) as miembro
       FROM project_bids pb
       LEFT JOIN miembros m ON pb.id_miembro = m.id
       WHERE pb.id_project = $1
       ORDER BY pb.created_at DESC`,
      [projectId]
    );

    return NextResponse.json({ bids: result.rows });
  } catch (error) {
    console.error("Error fetching bids:", error);
    return NextResponse.json({ error: "Error al cargar las postulaciones" }, { status: 500 });
  }
}

// POST /api/projects/[id]/bids - Submit a bid
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const projectId = parseInt(id);
    const body = await request.json();
    const { id_miembro, propuesta, precio_ofertado, tiempo_estimado_dias, imagenes } = body;

    if (!id_miembro || !propuesta || !precio_ofertado) {
      return NextResponse.json(
        { error: "Miembro, propuesta y precio ofertado son requeridos" },
        { status: 400 }
      );
    }

    // Check project is still accepting bids (publicado or en_progreso+republicado)
    const projectCheck = await query(
      "SELECT estado, republicado FROM projects WHERE id = $1",
      [projectId]
    );
    if (projectCheck.rows.length === 0) {
      return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
    }
    const isAcceptingBids = projectCheck.rows[0].estado === "publicado" ||
      (projectCheck.rows[0].estado === "en_progreso" && projectCheck.rows[0].republicado === true);
    if (!isAcceptingBids) {
      return NextResponse.json(
        { error: "Este proyecto ya no acepta postulaciones" },
        { status: 400 }
      );
    }

    // Check if member is restricted from projects
    const miembroCheck = await query(
      "SELECT restringido_proyectos FROM miembros WHERE id = $1",
      [id_miembro]
    );
    if (miembroCheck.rows.length > 0 && miembroCheck.rows[0].restringido_proyectos) {
      return NextResponse.json(
        { error: "Tu cuenta está restringida para proyectos. Contacta al administrador." },
        { status: 403 }
      );
    }

    // Check if member already submitted a bid
    const existingBid = await query(
      "SELECT id FROM project_bids WHERE id_project = $1 AND id_miembro = $2",
      [projectId, id_miembro]
    );

    if (existingBid.rows.length > 0) {
      return NextResponse.json(
        { error: "Ya has enviado una postulación para este proyecto" },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO project_bids (id_project, id_miembro, propuesta, precio_ofertado, tiempo_estimado_dias, estado, imagenes)
       VALUES ($1, $2, $3, $4, $5, 'pendiente', $6::jsonb)
       RETURNING *`,
      [projectId, id_miembro, propuesta, precio_ofertado, tiempo_estimado_dias, JSON.stringify(imagenes || [])]
    );

    return NextResponse.json({ bid: result.rows[0] });
  } catch (error) {
    console.error("Error creating bid:", error);
    return NextResponse.json({ error: "Error al enviar la postulación" }, { status: 500 });
  }
}

// PATCH /api/projects/[id]/bids - Accept a bid
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await context.params;
    const projectId = parseInt(id);
    const body = await request.json();
    const { bidId, action, monto_acordado } = body;

    if (!bidId || !action) {
      return NextResponse.json(
        { error: "ID de postulación y acción son requeridos" },
        { status: 400 }
      );
    }

    if (action === "accept") {
      if (monto_acordado === undefined || monto_acordado === null) {
        return NextResponse.json(
          { error: "Monto acordado es requerido al aceptar" },
          { status: 400 }
        );
      }

      // Verify project is still accepting bids (publicado or en_progreso+republicado)
      const projectCheck = await query(
        "SELECT estado, republicado FROM projects WHERE id = $1",
        [projectId]
      );
      if (projectCheck.rows.length === 0) {
        return NextResponse.json({ error: "Proyecto no encontrado" }, { status: 404 });
      }
      const canAcceptBids = projectCheck.rows[0].estado === "publicado" ||
        (projectCheck.rows[0].estado === "en_progreso" && projectCheck.rows[0].republicado === true);
      if (!canAcceptBids) {
        return NextResponse.json(
          { error: "El proyecto ya no acepta postulaciones" },
          { status: 400 }
        );
      }

      // Accept this bid with monto_acordado — do NOT reject other bids or change project state
      await query(
        "UPDATE project_bids SET estado = 'aceptada', monto_acordado = $1, fecha_aceptacion = NOW() WHERE id = $2",
        [monto_acordado, bidId]
      );

      return NextResponse.json({ success: true });
    } else if (action === "reject") {
      await query("UPDATE project_bids SET estado = 'rechazada' WHERE id = $1", [bidId]);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Acción no válida" }, { status: 400 });
  } catch (error) {
    console.error("Error updating bid:", error);
    return NextResponse.json({ error: "Error al actualizar la postulación" }, { status: 500 });
  }
}
