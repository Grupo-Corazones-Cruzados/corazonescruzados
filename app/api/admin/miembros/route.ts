import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// GET /api/admin/miembros - List all members
export async function GET() {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Verify user is admin
    const userResult = await query(
      `SELECT rol FROM user_profiles WHERE id = $1`,
      [tokenData.userId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].rol !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const result = await query(
      `SELECT m.*, f.nombre as fuente_nombre, pa.nombre as paso_nombre, ps.nombre as piso_nombre
       FROM miembros m
       LEFT JOIN fuentes f ON m.id_fuente = f.id
       LEFT JOIN pasos pa ON m.id_paso = pa.id
       LEFT JOIN pisos ps ON m.id_piso = ps.id
       ORDER BY m.nombre ASC`
    );

    // Fetch sistemas for all miembros
    const sistemasResult = await query(
      `SELECT ms.id_miembro, s.id, s.nombre
       FROM miembros_sistemas ms
       JOIN sistemas s ON ms.id_sistema = s.id
       ORDER BY s.secuencia ASC, s.id ASC`
    );

    // Group sistemas by miembro
    const sistemasByMiembro: Record<number, { id: number; nombre: string }[]> = {};
    for (const row of sistemasResult.rows) {
      if (!sistemasByMiembro[row.id_miembro]) {
        sistemasByMiembro[row.id_miembro] = [];
      }
      sistemasByMiembro[row.id_miembro].push({ id: row.id, nombre: row.nombre });
    }

    const miembros = result.rows.map((m: any) => ({
      ...m,
      sistemas: sistemasByMiembro[m.id] || [],
    }));

    return NextResponse.json({ miembros });
  } catch (error) {
    console.error("Error fetching miembros:", error);
    return NextResponse.json(
      { error: "Error al cargar miembros" },
      { status: 500 }
    );
  }
}

// POST /api/admin/miembros - Create new member
export async function POST(request: NextRequest) {
  try {
    const tokenData = await getCurrentUser();
    if (!tokenData) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Verify user is admin
    const userResult = await query(
      `SELECT rol FROM user_profiles WHERE id = $1`,
      [tokenData.userId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].rol !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const body = await request.json();
    const { nombre, puesto, descripcion, foto, costo, correo, celular, id_fuente, id_paso, id_piso } = body;

    if (!nombre?.trim() || !puesto?.trim()) {
      return NextResponse.json(
        { error: "Nombre y puesto son requeridos" },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO miembros (nombre, puesto, descripcion, foto, costo, correo, celular, id_fuente, id_paso, id_piso)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        nombre.trim(),
        puesto.trim(),
        descripcion || null,
        foto || null,
        costo || 0,
        correo || null,
        celular || null,
        id_fuente || null,
        id_paso || null,
        id_piso || null,
      ]
    );

    return NextResponse.json({ miembro: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error("Error creating miembro:", error);
    return NextResponse.json(
      { error: "Error al crear miembro" },
      { status: 500 }
    );
  }
}
