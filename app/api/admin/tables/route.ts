import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/jwt";

// Column type definition
interface ColumnDef {
  name: string;
  type: string;
  editable: boolean;
  label: string;
  required?: boolean;
  foreignKey?: string;
}

interface TableDef {
  name: string;
  primaryKey: string;
  columns: ColumnDef[];
  orderBy: string;
}

// Tables that can be managed
const ALLOWED_TABLES: Record<string, TableDef> = {
  modulos: {
    name: "Módulos",
    primaryKey: "id",
    columns: [
      { name: "id", type: "number", editable: false, label: "ID" },
      { name: "nombre", type: "text", editable: true, required: true, label: "Nombre" },
      { name: "descripcion", type: "text", editable: true, label: "Descripción" },
      { name: "icono", type: "text", editable: true, label: "Icono" },
      { name: "ruta", type: "text", editable: true, required: true, label: "Ruta" },
      { name: "orden", type: "number", editable: true, label: "Orden" },
      { name: "requiere_verificacion", type: "boolean", editable: true, label: "Requiere Verificación" },
      { name: "roles_permitidos", type: "array", editable: true, label: "Roles Permitidos" },
    ],
    orderBy: "orden ASC, id ASC",
  },
  fuentes: {
    name: "Áreas / Fuentes",
    primaryKey: "id",
    columns: [
      { name: "id", type: "number", editable: false, label: "ID" },
      { name: "nombre", type: "text", editable: true, required: true, label: "Nombre" },
      { name: "descripcion", type: "text", editable: true, label: "Descripción" },
      { name: "color", type: "text", editable: true, label: "Color" },
      { name: "icono", type: "text", editable: true, label: "Icono" },
    ],
    orderBy: "nombre ASC",
  },
  acciones: {
    name: "Acciones",
    primaryKey: "id",
    columns: [
      { name: "id", type: "number", editable: false, label: "ID" },
      { name: "nombre", type: "text", editable: true, required: true, label: "Nombre" },
      { name: "id_fuente", type: "number", editable: true, label: "Fuente", foreignKey: "fuentes" },
      { name: "id_miembro", type: "number", editable: true, label: "Miembro", foreignKey: "miembros" },
    ],
    orderBy: "id_fuente ASC, nombre ASC",
  },
  secciones_modulo: {
    name: "Secciones de Módulos",
    primaryKey: "id",
    columns: [
      { name: "id", type: "number", editable: false, label: "ID" },
      { name: "id_modulo", type: "number", editable: true, required: true, label: "Módulo", foreignKey: "modulos" },
      { name: "nombre", type: "text", editable: true, required: true, label: "Nombre" },
      { name: "href", type: "text", editable: true, required: true, label: "Href" },
      { name: "icono", type: "text", editable: true, label: "Icono" },
      { name: "orden", type: "number", editable: true, label: "Orden" },
    ],
    orderBy: "id_modulo ASC, orden ASC",
  },
};

type TableName = "modulos" | "fuentes" | "acciones" | "secciones_modulo";

// GET /api/admin/tables - List tables or get table data
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const tableName = searchParams.get("table") as TableName | null;
    const search = searchParams.get("search") || "";

    // If no table specified, return list of available tables
    if (!tableName) {
      const tables = Object.entries(ALLOWED_TABLES).map(([key, value]) => ({
        id: key,
        name: value.name,
        columns: value.columns,
      }));
      return NextResponse.json({ tables });
    }

    // Validate table name
    if (!ALLOWED_TABLES[tableName]) {
      return NextResponse.json({ error: "Tabla no válida" }, { status: 400 });
    }

    const tableConfig = ALLOWED_TABLES[tableName];

    // Build query with optional search
    let sql = `SELECT * FROM ${tableName}`;
    const params: string[] = [];

    if (search) {
      const searchableColumns = tableConfig.columns
        .filter((c) => c.type === "text")
        .map((c) => c.name);

      if (searchableColumns.length > 0) {
        const searchConditions = searchableColumns
          .map((col, i) => `${col}::text ILIKE $${i + 1}`)
          .join(" OR ");
        sql += ` WHERE ${searchConditions}`;
        searchableColumns.forEach(() => params.push(`%${search}%`));
      }
    }

    sql += ` ORDER BY ${tableConfig.orderBy}`;

    const result = await query(sql, params);

    // Fetch lookup data for foreign keys
    const lookups: Record<string, { id: number; nombre: string }[]> = {};
    const foreignKeyColumns = tableConfig.columns.filter((c) => c.foreignKey);

    for (const col of foreignKeyColumns) {
      if (col.foreignKey === "fuentes") {
        const fuentesResult = await query(`SELECT id, nombre FROM fuentes ORDER BY nombre ASC`);
        lookups.fuentes = fuentesResult.rows;
      } else if (col.foreignKey === "miembros") {
        const miembrosResult = await query(`SELECT id, nombre FROM miembros ORDER BY nombre ASC`);
        lookups.miembros = miembrosResult.rows;
      } else if (col.foreignKey === "modulos") {
        const modulosResult = await query(`SELECT id, nombre FROM modulos ORDER BY orden ASC, nombre ASC`);
        lookups.modulos = modulosResult.rows;
      }
    }

    return NextResponse.json({
      table: tableName,
      config: tableConfig,
      rows: result.rows,
      total: result.rows.length,
      lookups,
    });
  } catch (error) {
    console.error("Error fetching table data:", error);
    return NextResponse.json(
      { error: "Error al cargar datos" },
      { status: 500 }
    );
  }
}

// POST /api/admin/tables - Create new record
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
    const { table, data } = body;

    if (!table || !ALLOWED_TABLES[table as TableName]) {
      return NextResponse.json({ error: "Tabla no válida" }, { status: 400 });
    }

    const tableConfig = ALLOWED_TABLES[table as TableName];

    // Filter only editable columns
    const editableColumns = tableConfig.columns.filter((c) => c.editable);
    const columns: string[] = [];
    const values: unknown[] = [];
    const placeholders: string[] = [];

    editableColumns.forEach((col, index) => {
      if (data[col.name] !== undefined) {
        columns.push(col.name);
        // Handle array type
        if (col.type === "array") {
          values.push(Array.isArray(data[col.name]) ? data[col.name] : []);
        } else {
          values.push(data[col.name]);
        }
        placeholders.push(`$${index + 1}`);
      }
    });

    if (columns.length === 0) {
      return NextResponse.json({ error: "No hay datos para insertar" }, { status: 400 });
    }

    // Rebuild placeholders with correct indices
    const finalPlaceholders = columns.map((_, i) => `$${i + 1}`);

    const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${finalPlaceholders.join(", ")}) RETURNING *`;
    const result = await query(sql, values);

    return NextResponse.json({
      success: true,
      row: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating record:", error);
    return NextResponse.json(
      { error: "Error al crear registro" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/tables - Update record
export async function PATCH(request: NextRequest) {
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
    const { table, id, data } = body;

    if (!table || !ALLOWED_TABLES[table as TableName]) {
      return NextResponse.json({ error: "Tabla no válida" }, { status: 400 });
    }

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const tableConfig = ALLOWED_TABLES[table as TableName];

    // Build SET clause
    const editableColumns = tableConfig.columns.filter((c) => c.editable);
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    editableColumns.forEach((col) => {
      if (data[col.name] !== undefined) {
        setClauses.push(`${col.name} = $${paramIndex}`);
        // Handle array type
        if (col.type === "array") {
          values.push(Array.isArray(data[col.name]) ? data[col.name] : []);
        } else {
          values.push(data[col.name]);
        }
        paramIndex++;
      }
    });

    if (setClauses.length === 0) {
      return NextResponse.json({ error: "No hay datos para actualizar" }, { status: 400 });
    }

    values.push(id);
    const sql = `UPDATE ${table} SET ${setClauses.join(", ")} WHERE ${tableConfig.primaryKey} = $${paramIndex} RETURNING *`;
    const result = await query(sql, values);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      row: result.rows[0],
    });
  } catch (error) {
    console.error("Error updating record:", error);
    return NextResponse.json(
      { error: "Error al actualizar registro" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/tables - Delete record
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const table = searchParams.get("table") as TableName | null;
    const id = searchParams.get("id");

    if (!table || !ALLOWED_TABLES[table]) {
      return NextResponse.json({ error: "Tabla no válida" }, { status: 400 });
    }

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const tableConfig = ALLOWED_TABLES[table];

    const sql = `DELETE FROM ${table} WHERE ${tableConfig.primaryKey} = $1 RETURNING *`;
    const result = await query(sql, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      deleted: result.rows[0],
    });
  } catch (error) {
    console.error("Error deleting record:", error);
    const errorMessage = error instanceof Error ? error.message : "";
    if (errorMessage.includes("foreign key") || errorMessage.includes("violates")) {
      return NextResponse.json(
        { error: "No se puede eliminar: hay registros que dependen de este" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Error al eliminar registro" },
      { status: 500 }
    );
  }
}
