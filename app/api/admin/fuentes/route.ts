import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { listTables } from '@/lib/admin/fuentes';

export const dynamic = 'force-dynamic';

/** GET — todas las tablas del schema con su número de filas (solo admin). */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    return NextResponse.json({ data: await listTables() });
  } catch (err: any) {
    console.error('Fuentes tables:', err.message);
    return NextResponse.json({ error: 'No se pudieron listar las tablas.' }, { status: 500 });
  }
}
