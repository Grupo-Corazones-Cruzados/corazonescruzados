import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { listTables } from '@/lib/admin/fuentes';
import { getRelations } from '@/lib/admin/fuentes-graph';

export const dynamic = 'force-dynamic';

/**
 * GET — tablas del schema con su número de filas (solo admin).
 * Con `?relations=1` devuelve además las relaciones entre tablas (vista Universo).
 * Va como parámetro y no como subruta para no chocar con `/api/admin/fuentes/[table]`.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

    if (req.nextUrl.searchParams.get('relations')) {
      const [tables, relations] = await Promise.all([listTables(), getRelations()]);
      return NextResponse.json({ data: { tables, relations } });
    }
    return NextResponse.json({ data: await listTables() });
  } catch (err: any) {
    console.error('Fuentes tables:', err.message);
    return NextResponse.json({ error: 'No se pudieron listar las tablas.' }, { status: 500 });
  }
}
