import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/packages/[id]/available-slots - Get available slots for a specific date
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

    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get("fecha");

    if (isNaN(purchaseId)) {
      return NextResponse.json({ error: "ID invalido" }, { status: 400 });
    }

    if (!fecha) {
      return NextResponse.json(
        { error: "La fecha es requerida" },
        { status: 400 }
      );
    }

    // Verify user has access to this package
    const purchaseResult = await query(
      `SELECT pp.id, pp.id_cliente, pp.id_miembro, pp.horas_totales, pp.horas_consumidas,
              up.id_miembro as user_member_id
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

    const purchase = purchaseResult.rows[0];

    // Get day of week for the requested date
    const requestedDate = new Date(fecha);
    const dayOfWeek = requestedDate.getDay();

    // Get availability for this day
    const availabilityResult = await query(
      `SELECT * FROM package_availability
       WHERE id_purchase = $1 AND dia_semana = $2 AND activo = true
       ORDER BY hora_inicio`,
      [purchaseId, dayOfWeek]
    );

    if (availabilityResult.rows.length === 0) {
      return NextResponse.json({ slots: [], message: "No hay disponibilidad para este dia" });
    }

    // Get existing sessions for this date
    const sessionsResult = await query(
      `SELECT hora_inicio, hora_fin FROM package_sessions
       WHERE id_purchase = $1 AND fecha = $2 AND estado IN ('programada', 'reprogramada')`,
      [purchaseId, fecha]
    );

    const existingSessions = sessionsResult.rows;

    // Generate available slots (30-minute increments)
    const slots: { hora_inicio: string; hora_fin: string; disponible: boolean }[] = [];

    for (const availability of availabilityResult.rows) {
      const startTime = availability.hora_inicio;
      const endTime = availability.hora_fin;

      // Parse times
      const [startHour, startMin] = startTime.split(":").map(Number);
      const [endHour, endMin] = endTime.split(":").map(Number);

      let currentHour = startHour;
      let currentMin = startMin;

      // Generate 30-minute slots
      while (
        currentHour * 60 + currentMin + 30 <=
        endHour * 60 + endMin
      ) {
        const slotStart = `${currentHour.toString().padStart(2, "0")}:${currentMin.toString().padStart(2, "0")}`;

        // Move forward 30 minutes
        currentMin += 30;
        if (currentMin >= 60) {
          currentHour += 1;
          currentMin -= 60;
        }

        const slotEnd = `${currentHour.toString().padStart(2, "0")}:${currentMin.toString().padStart(2, "0")}`;

        // Check if slot conflicts with existing sessions
        const isOccupied = existingSessions.some((session) => {
          const sessionStart = session.hora_inicio;
          const sessionEnd = session.hora_fin;

          // Check for overlap
          return (
            (slotStart >= sessionStart && slotStart < sessionEnd) ||
            (slotEnd > sessionStart && slotEnd <= sessionEnd) ||
            (slotStart <= sessionStart && slotEnd >= sessionEnd)
          );
        });

        slots.push({
          hora_inicio: slotStart,
          hora_fin: slotEnd,
          disponible: !isOccupied,
        });
      }
    }

    // Calculate remaining available hours
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

    return NextResponse.json({
      slots,
      horasDisponibles,
      horasRestantes,
      horasPendientes,
    });
  } catch (error) {
    console.error("Error fetching available slots:", error);
    return NextResponse.json(
      { error: "Error al cargar los slots disponibles" },
      { status: 500 }
    );
  }
}
