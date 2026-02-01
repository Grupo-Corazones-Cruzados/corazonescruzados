import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";
import { sendSessionScheduledToMember } from "@/lib/email";

// GET /api/packages/[id]/sessions - List sessions for a package
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const purchaseId = parseInt(id);

    if (isNaN(purchaseId)) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    // Verify user has access to this package (either client or member)
    const purchaseResult = await query(
      `SELECT pp.id, pp.id_cliente, pp.id_miembro, up.id_miembro as user_member_id
       FROM package_purchases pp
       JOIN user_profiles up ON up.id = $2
       WHERE pp.id = $1 AND (pp.id_cliente = $2 OR pp.id_miembro = up.id_miembro)`,
      [purchaseId, tokenData.userId]
    );

    if (purchaseResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Paquete no encontrado" },
        { status: 404 }
      );
    }

    // Get sessions
    const sessionsResult = await query(
      `SELECT * FROM package_sessions
       WHERE id_purchase = $1
       ORDER BY fecha ASC, hora_inicio ASC`,
      [purchaseId]
    );

    return NextResponse.json({ sessions: sessionsResult.rows });
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return NextResponse.json(
      { error: "Error al cargar las sesiones" },
      { status: 500 }
    );
  }
}

// POST /api/packages/[id]/sessions - Client schedules a new session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const purchaseId = parseInt(id);
    const body = await request.json();
    const { fecha, hora_inicio, hora_fin, notas } = body;

    if (isNaN(purchaseId)) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    if (!fecha || !hora_inicio || !hora_fin) {
      return NextResponse.json(
        { error: "Fecha, hora de inicio y hora de fin son requeridas" },
        { status: 400 }
      );
    }

    // Verify client owns this package and it's approved/in_progress
    const purchaseResult = await query(
      `SELECT pp.*, m.nombre as miembro_nombre, m.correo as miembro_email,
              COALESCE(up_client.nombre || ' ' || COALESCE(up_client.apellido, ''), up_client.email) as cliente_nombre,
              p.nombre as paquete_nombre
       FROM package_purchases pp
       JOIN miembros m ON pp.id_miembro = m.id
       JOIN user_profiles up_client ON pp.id_cliente = up_client.id
       JOIN paquetes p ON pp.id_paquete = p.id
       WHERE pp.id = $1 AND pp.id_cliente = $2`,
      [purchaseId, tokenData.userId]
    );

    if (purchaseResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Paquete no encontrado" },
        { status: 404 }
      );
    }

    const purchase = purchaseResult.rows[0];

    if (
      purchase.estado !== "aprobado" &&
      purchase.estado !== "en_progreso"
    ) {
      return NextResponse.json(
        { error: "Solo puedes agendar sesiones en paquetes aprobados o en progreso" },
        { status: 400 }
      );
    }

    // Calculate duration in hours
    const [startHour, startMin] = hora_inicio.split(":").map(Number);
    const [endHour, endMin] = hora_fin.split(":").map(Number);
    const durationHours =
      (endHour * 60 + endMin - (startHour * 60 + startMin)) / 60;

    if (durationHours <= 0) {
      return NextResponse.json(
        { error: "La hora de fin debe ser posterior a la hora de inicio" },
        { status: 400 }
      );
    }

    // Check if there are enough hours remaining
    const horasRestantes = Number(purchase.horas_totales) - Number(purchase.horas_consumidas);

    // Get pending sessions hours
    const pendingSessionsResult = await query(
      `SELECT COALESCE(SUM(duracion_horas), 0) as horas_pendientes
       FROM package_sessions
       WHERE id_purchase = $1 AND estado = 'programada'`,
      [purchaseId]
    );
    const horasPendientes = Number(pendingSessionsResult.rows[0].horas_pendientes);
    const horasDisponibles = horasRestantes - horasPendientes;

    if (durationHours > horasDisponibles) {
      return NextResponse.json(
        { error: `No hay suficientes horas disponibles. Disponibles: ${horasDisponibles.toFixed(2)}h` },
        { status: 400 }
      );
    }

    // Verify availability on this day
    const sessionDate = new Date(fecha);
    const dayOfWeek = sessionDate.getDay();

    const availabilityResult = await query(
      `SELECT * FROM package_availability
       WHERE id_purchase = $1 AND dia_semana = $2 AND activo = true
       AND hora_inicio <= $3 AND hora_fin >= $4`,
      [purchaseId, dayOfWeek, hora_inicio, hora_fin]
    );

    if (availabilityResult.rows.length === 0) {
      return NextResponse.json(
        { error: "El horario seleccionado no esta disponible" },
        { status: 400 }
      );
    }

    // Check for conflicting sessions
    const conflictResult = await query(
      `SELECT id FROM package_sessions
       WHERE id_purchase = $1 AND fecha = $2 AND estado IN ('programada', 'reprogramada')
       AND ((hora_inicio < $4 AND hora_fin > $3) OR (hora_inicio >= $3 AND hora_inicio < $4))`,
      [purchaseId, fecha, hora_inicio, hora_fin]
    );

    if (conflictResult.rows.length > 0) {
      return NextResponse.json(
        { error: "Ya existe una sesion programada en ese horario" },
        { status: 400 }
      );
    }

    // Create session
    const sessionResult = await query(
      `INSERT INTO package_sessions
       (id_purchase, fecha, hora_inicio, hora_fin, duracion_horas, notas_cliente, estado)
       VALUES ($1, $2, $3, $4, $5, $6, 'programada')
       RETURNING *`,
      [purchaseId, fecha, hora_inicio, hora_fin, durationHours, notas || null]
    );

    const session = sessionResult.rows[0];

    // Send notification to member
    await sendSessionScheduledToMember(
      purchase.miembro_email,
      purchase.miembro_nombre,
      {
        id: session.id,
        fecha: session.fecha,
        hora_inicio: session.hora_inicio,
        hora_fin: session.hora_fin,
        duracion_horas: session.duracion_horas,
      },
      purchase.cliente_nombre,
      purchase.paquete_nombre
    );

    return NextResponse.json({ success: true, session });
  } catch (error) {
    console.error("Error creating session:", error);
    return NextResponse.json(
      { error: "Error al crear la sesion" },
      { status: 500 }
    );
  }
}
