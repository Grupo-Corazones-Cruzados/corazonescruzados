import { pool } from '@/lib/db';

/**
 * "Fuentes" — explorador genérico de las tablas de la base (schema `gcc_world`) para el
 * administrador: ver, crear, editar y eliminar registros de CUALQUIER tabla sin pasar
 * por un cliente SQL. Es una herramienta de último recurso; el día a día se hace desde
 * los módulos del dashboard.
 *
 * SEGURIDAD — este archivo construye SQL con nombres dinámicos, así que:
 *  1. La tabla SIEMPRE se valida contra `information_schema.tables` (solo tablas reales
 *     del schema `gcc_world`); un nombre que no exista se rechaza antes de tocar SQL.
 *  2. Las columnas SIEMPRE se validan contra `information_schema.columns` de esa tabla.
 *  3. Los identificadores validados se citan con `q()`; los VALORES nunca se interpolan,
 *     van siempre como parámetros ($1, $2…).
 *  4. Solo se emiten SELECT / INSERT / UPDATE / DELETE. Nada de DDL.
 * Todas las rutas que lo usan exigen `role === 'admin'`.
 */

const SCHEMA = 'gcc_world';

/** Cita un identificador ya validado. */
const q = (id: string) => `"${id.replace(/"/g, '""')}"`;

export interface ColumnInfo {
  name: string;
  dataType: string;
  /** Tipo interno de Postgres (`int4`, `_text`, `jsonb`…). */
  udt: string;
  nullable: boolean;
  hasDefault: boolean;
  /** Identidad/generada: la pone la base, no se pide al crear. */
  generated: boolean;
  maxLength: number | null;
  isPrimaryKey: boolean;
}

export interface TableInfo {
  name: string;
  rows: number;
}

export class FuentesError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Todas las tablas del schema con su número EXACTO de filas (una sola consulta). */
export async function listTables(): Promise<TableInfo[]> {
  const { rows } = await pool.query(
    `SELECT table_name AS name,
            COALESCE((xpath('/row/c/text()', xml_count))[1]::text::int, 0) AS rows
       FROM (
         SELECT table_name,
                query_to_xml(format('SELECT COUNT(*) AS c FROM %I.%I', table_schema, table_name),
                             false, true, '') AS xml_count
           FROM information_schema.tables
          WHERE table_schema = $1 AND table_type = 'BASE TABLE'
       ) t
      ORDER BY table_name`,
    [SCHEMA],
  );
  return rows;
}

/** Valida que la tabla exista en el schema. Lanza `FuentesError` si no. */
async function assertTable(table: string): Promise<void> {
  if (!table || table.length > 63) throw new FuentesError('Tabla inválida.', 400);
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.tables
      WHERE table_schema = $1 AND table_name = $2 AND table_type = 'BASE TABLE'`,
    [SCHEMA, table],
  );
  if (!rows.length) throw new FuentesError('Esa tabla no existe.', 404);
}

/** Columnas de la tabla + cuáles forman la clave primaria. */
export async function describeTable(table: string): Promise<{ columns: ColumnInfo[]; primaryKey: string[] }> {
  await assertTable(table);

  const [{ rows: cols }, { rows: pks }] = await Promise.all([
    pool.query(
      `SELECT column_name, data_type, udt_name, is_nullable, column_default,
              character_maximum_length, is_identity, is_generated
         FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position`,
      [SCHEMA, table],
    ),
    pool.query(
      `SELECT a.attname AS name
         FROM pg_index i
         JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indrelid = format('%I.%I', $1::text, $2::text)::regclass AND i.indisprimary
        ORDER BY a.attnum`,
      [SCHEMA, table],
    ),
  ]);

  const primaryKey: string[] = pks.map((r: { name: string }) => r.name);
  const columns: ColumnInfo[] = cols.map((c: any) => ({
    name: c.column_name,
    dataType: c.data_type,
    udt: c.udt_name,
    nullable: c.is_nullable === 'YES',
    hasDefault: c.column_default !== null,
    generated: c.is_identity === 'YES' || c.is_generated === 'ALWAYS',
    maxLength: c.character_maximum_length,
    isPrimaryKey: primaryKey.includes(c.column_name),
  }));

  return { columns, primaryKey };
}

/** Convierte el valor recibido en JSON al tipo que espera la columna. */
function coerce(value: unknown, col: ColumnInfo): unknown {
  if (value === null || value === undefined) return null;

  const isArray = col.udt.startsWith('_');
  const isJson = col.udt === 'json' || col.udt === 'jsonb';
  const isBool = col.udt === 'bool';
  const isNumber = ['int2', 'int4', 'int8', 'float4', 'float8', 'numeric'].includes(col.udt);

  // Cadena vacía → NULL, salvo en columnas de texto (donde '' es un valor legítimo).
  if (value === '' && !['text', 'varchar', 'bpchar', 'name'].includes(col.udt)) return null;

  if (isArray) {
    if (Array.isArray(value)) return value;
    const s = String(value).trim();
    if (!s) return [];
    if (s.startsWith('[')) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed;
      } catch { /* cae al split de abajo */ }
    }
    return s.split(/[\n,]/).map((v) => v.trim()).filter(Boolean);
  }

  if (isJson) {
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(String(value));
    } catch {
      throw new FuentesError(`El campo "${col.name}" debe ser JSON válido.`);
    }
  }

  if (isBool) {
    if (typeof value === 'boolean') return value;
    const s = String(value).toLowerCase();
    if (['true', 't', '1', 'sí', 'si'].includes(s)) return true;
    if (['false', 'f', '0', 'no'].includes(s)) return false;
    throw new FuentesError(`El campo "${col.name}" debe ser verdadero o falso.`);
  }

  if (isNumber) {
    const n = Number(value);
    if (Number.isNaN(n)) throw new FuentesError(`El campo "${col.name}" debe ser un número.`);
    return n;
  }

  return typeof value === 'object' ? JSON.stringify(value) : value;
}

/** Filas de la tabla, paginadas, con búsqueda de texto libre sobre la fila completa. */
export async function readRows(
  table: string,
  opts: { page?: number; pageSize?: number; search?: string } = {},
): Promise<{ rows: Record<string, unknown>[]; total: number; page: number; pageSize: number }> {
  const { columns, primaryKey } = await describeTable(table);

  const page = Math.max(1, Math.floor(opts.page || 1));
  const pageSize = Math.min(200, Math.max(1, Math.floor(opts.pageSize || 50)));
  const search = (opts.search || '').trim();

  // Búsqueda: se castea la FILA entera a texto, así sirve para cualquier tabla sin
  // saber sus columnas (`t::text ILIKE '%algo%'`).
  const where = search ? 'WHERE t::text ILIKE $1' : '';
  const params: unknown[] = search ? [`%${search}%`] : [];

  // Orden: por la clave primaria (los registros nuevos primero); si no hay, la 1ª columna.
  const orderCol = primaryKey[0] || columns[0]?.name;
  const orderBy = orderCol ? `ORDER BY t.${q(orderCol)} DESC` : '';

  const from = `FROM ${q(SCHEMA)}.${q(table)} AS t`;

  const { rows: countRows } = await pool.query(`SELECT COUNT(*)::int AS total ${from} ${where}`, params);
  const total: number = countRows[0]?.total ?? 0;

  const { rows } = await pool.query(
    `SELECT t.* ${from} ${where} ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, pageSize, (page - 1) * pageSize],
  );

  return { rows, total, page, pageSize };
}

/** Construye `WHERE pk1=$n AND pk2=$m` a partir de la clave primaria recibida. */
function pkClause(
  pk: Record<string, unknown>,
  primaryKey: string[],
  columns: ColumnInfo[],
  startIndex: number,
): { sql: string; values: unknown[] } {
  if (!primaryKey.length) {
    throw new FuentesError('Esta tabla no tiene clave primaria: solo se puede consultar.', 400);
  }
  const values: unknown[] = [];
  const parts = primaryKey.map((name) => {
    if (!(name in pk)) throw new FuentesError(`Falta la clave "${name}" del registro.`);
    const col = columns.find((c) => c.name === name)!;
    values.push(coerce(pk[name], col));
    return `${q(name)} = $${startIndex + values.length - 1}`;
  });
  return { sql: parts.join(' AND '), values };
}

/** Alta de un registro. `values` = { columna: valor } (se ignoran las desconocidas). */
export async function insertRow(table: string, values: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { columns } = await describeTable(table);

  const cols: string[] = [];
  const params: unknown[] = [];
  for (const col of columns) {
    if (col.generated) continue;                    // la pone la base
    if (!(col.name in values)) continue;
    const v = coerce(values[col.name], col);
    // Columna con default y valor vacío → dejar que aplique el default.
    if (v === null && col.hasDefault) continue;
    cols.push(col.name);
    params.push(v);
  }
  if (!cols.length) throw new FuentesError('No hay ningún dato que guardar.');

  const { rows } = await pool.query(
    `INSERT INTO ${q(SCHEMA)}.${q(table)} (${cols.map(q).join(', ')})
     VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})
     RETURNING *`,
    params,
  );
  return rows[0];
}

/**
 * Edición de un registro. La clave primaria NO se modifica (se usa para localizarlo):
 * evita cambios de identidad accidentales que romperían las referencias.
 */
export async function updateRow(
  table: string,
  pk: Record<string, unknown>,
  values: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { columns, primaryKey } = await describeTable(table);

  const sets: string[] = [];
  const params: unknown[] = [];
  for (const col of columns) {
    if (col.generated || col.isPrimaryKey) continue;
    if (!(col.name in values)) continue;
    params.push(coerce(values[col.name], col));
    sets.push(`${q(col.name)} = $${params.length}`);
  }
  if (!sets.length) throw new FuentesError('No hay ningún cambio que guardar.');

  const where = pkClause(pk, primaryKey, columns, params.length + 1);
  const { rows } = await pool.query(
    `UPDATE ${q(SCHEMA)}.${q(table)} SET ${sets.join(', ')} WHERE ${where.sql} RETURNING *`,
    [...params, ...where.values],
  );
  if (!rows.length) throw new FuentesError('No se encontró el registro.', 404);
  return rows[0];
}

/** Baja de un registro por su clave primaria. */
export async function deleteRow(table: string, pk: Record<string, unknown>): Promise<void> {
  const { columns, primaryKey } = await describeTable(table);
  const where = pkClause(pk, primaryKey, columns, 1);
  const res = await pool.query(
    `DELETE FROM ${q(SCHEMA)}.${q(table)} WHERE ${where.sql}`,
    where.values,
  );
  if (!res.rowCount) throw new FuentesError('No se encontró el registro.', 404);
}
