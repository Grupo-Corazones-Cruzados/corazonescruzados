/**
 * Los talentos de un ámbito. Solo administradores.
 *
 * `PUT` y no `POST`/`DELETE` sueltos: la pantalla edita **la lista entera**, así que manda
 * el estado final. Con altas y bajas por separado, un fallo a medio camino deja el cliente
 * y el servidor diciendo cosas distintas.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { fijarTalentos } from '@/lib/ambitos';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  const { talentos } = await req.json();
  if (!Array.isArray(talentos)) {
    return NextResponse.json({ error: 'Se esperaba una lista de talentos' }, { status: 400 });
  }

  // `fijarTalentos` descarta lo que no esté en el catálogo y devuelve lo que quedó, para que
  // la pantalla pinte exactamente lo guardado y no lo que creía haber mandado.
  return NextResponse.json({ data: await fijarTalentos(Number(id), talentos) });
}
