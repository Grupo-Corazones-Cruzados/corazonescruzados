/**
 * Los talentos de un ámbito. Solo administradores.
 *
 * `PUT` y no `POST`/`DELETE` sueltos: la pantalla edita **la lista entera**, así que manda
 * el estado final. Con altas y bajas por separado, un fallo a medio camino deja el cliente
 * y el servidor diciendo cosas distintas.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { fijarTalentos, talentosOcupados } from '@/lib/ambitos';

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

  try {
    // `fijarTalentos` descarta lo que no esté en el catálogo y devuelve lo que quedó, para
    // que la pantalla pinte exactamente lo guardado y no lo que creía haber mandado.
    return NextResponse.json({ data: await fijarTalentos(Number(id), talentos) });
  } catch (e: any) {
    /**
     * ⚠️ EL CHOQUE CONTRA «UN TALENTO, UN ÁMBITO» SE EXPLICA, NO SE DEJA REVENTAR.
     *
     * La regla vive en la base (índice único `ambito_talentos_talento_unico`, migración
     * 042), que es donde tiene que estar: una restricción que solo vive en el formulario se
     * salta con una llamada como esta. Pero al saltarla, Postgres devuelve un `23505` y sin
     * este `catch` el usuario vería un 500 pelado — «algo falló», sin saber el qué.
     *
     * Con el nombre del ámbito que lo tiene, la corrección es evidente.
     */
    if (e?.code === '23505') {
      const cogidos = await talentosOcupados(Number(id));
      const choca = talentos.map((t: any) => t?.talento).find((t: string) => cogidos[t]);
      return NextResponse.json({
        error: choca
          ? `«${choca}» ya pertenece al ámbito «${cogidos[choca]}». Un talento solo puede estar en uno.`
          : 'Ese talento ya pertenece a otro ámbito. Un talento solo puede estar en uno.',
      }, { status: 409 });
    }
    throw e;
  }
}
