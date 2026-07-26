import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { describeTable, readRows, insertRow, updateRow, deleteRow, FuentesError } from '@/lib/admin/fuentes';

export const dynamic = 'force-dynamic';

/** Todas las operaciones de Fuentes son solo para admin. */
async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') throw new FuentesError('No autorizado', 403);
  return user;
}

/** Traduce los errores esperados (`FuentesError`) a su código; el resto, 500 genérico. */
function fail(err: any, fallback: string) {
  if (err instanceof FuentesError) return NextResponse.json({ error: err.message }, { status: err.status });
  console.error('Fuentes:', err?.message);
  // Errores de Postgres (violación de FK, único, not-null…): el mensaje es útil.
  if (err?.code && /^[0-9A-Z]{5}$/.test(err.code)) {
    return NextResponse.json({ error: err.detail || err.message || fallback }, { status: 400 });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}

/** GET — estructura de la tabla + página de filas (`?page=&pageSize=&search=`). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  try {
    await requireAdmin();
    const { table } = await params;
    const sp = req.nextUrl.searchParams;
    const [schema, data] = await Promise.all([
      describeTable(table),
      readRows(table, {
        page: Number(sp.get('page')) || 1,
        pageSize: Number(sp.get('pageSize')) || 50,
        search: sp.get('search') || '',
      }),
    ]);
    return NextResponse.json({ data: { table, ...schema, ...data } });
  } catch (err: any) {
    return fail(err, 'No se pudo leer la tabla.');
  }
}

/** POST — crea un registro. Body: `{ values: { columna: valor } }`. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  try {
    await requireAdmin();
    const { table } = await params;
    const b = await req.json();
    return NextResponse.json({ data: await insertRow(table, b?.values || {}) });
  } catch (err: any) {
    return fail(err, 'No se pudo crear el registro.');
  }
}

/** PATCH — edita un registro. Body: `{ pk: { id: 1 }, values: { … } }`. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  try {
    await requireAdmin();
    const { table } = await params;
    const b = await req.json();
    return NextResponse.json({ data: await updateRow(table, b?.pk || {}, b?.values || {}) });
  } catch (err: any) {
    return fail(err, 'No se pudo guardar el registro.');
  }
}

/** DELETE — elimina un registro. Body: `{ pk: { id: 1 } }`. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  try {
    await requireAdmin();
    const { table } = await params;
    const b = await req.json();
    await deleteRow(table, b?.pk || {});
    return NextResponse.json({ data: { ok: true } });
  } catch (err: any) {
    return fail(err, 'No se pudo eliminar el registro.');
  }
}
