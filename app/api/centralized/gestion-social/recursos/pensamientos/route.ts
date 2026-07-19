import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { canAccessSystem } from '@/lib/centralized/system-access';
import { listThoughtsOfSubject, countByCategory } from '@/lib/centralized/pensamientos-db';
import { CATEGORIES_SET } from '@/lib/centralized/pensamientos';

export const dynamic = 'force-dynamic';

/**
 * GET — pensamientos de OTRA persona, para el panel "Gestión Social · Recursos".
 *
 * ⚠️ Esta ruta expone contenido PRIVADO: los pensamientos solo los lee su autor salvo aquí,
 * donde la organización accede a ellos por política interna. Por eso NO basta con
 * `['admin','member']`: se exige acceso real al sistema `gestion-social`
 * (`canAccessSystem`, misma regla piso/paso que filtra la lista de sistemas).
 *
 * `?kind=member|candidate&id=<id>` y, opcionalmente, `?categoria=mental|corporal|social|laboral`.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  if (!(await canAccessSystem(user.userId, user.role, 'gestion-social'))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  try {
    const sp = req.nextUrl.searchParams;
    const kind = sp.get('kind') === 'candidate' ? 'candidate' : sp.get('kind') === 'member' ? 'member' : null;
    const id = sp.get('id');
    if (!kind || !id) return NextResponse.json({ error: 'Falta el sujeto.' }, { status: 400 });

    const cat = sp.get('categoria');
    const categoria = cat && CATEGORIES_SET.has(cat) ? cat : undefined;

    const [thoughts, counts] = await Promise.all([
      listThoughtsOfSubject({ kind, id }, categoria),
      countByCategory({ kind, id }),
    ]);
    return NextResponse.json({ data: { thoughts, counts } });
  } catch (err: any) {
    console.error('Recursos pensamientos:', err.message);
    return NextResponse.json({ error: 'No se pudieron cargar los pensamientos.' }, { status: 500 });
  }
}
