/**
 * LOS COBROS POR TRANSFERENCIA QUE ESPERAN CONFIRMACIÓN.
 *
 * Lo consulta la página de detalle de cada cosa (proyecto, ticket, suscripción, producto)
 * para enseñar el aviso y el botón de confirmar. Sin `tipo`/`id` devuelve **todos**, que es
 * lo que evita que un cobro se quede olvidado en un detalle que nadie abre.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { autorizarCompartir, SinAcceso } from '@/lib/pagos/acceso';
import { cobrosEnEspera, todosLosCobrosEnEspera } from '@/lib/pagos/intentos';

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const tipo = sp.get('tipo');
    const id = sp.get('id');

    if (tipo && id) {
      await autorizarCompartir(id, tipo as any);
      return NextResponse.json({ data: await cobrosEnEspera(tipo, id) });
    }

    // La lista completa es solo para el admin: son cobros de todo el mundo.
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ data: await todosLosCobrosEnEspera() });
  } catch (err: any) {
    if (err instanceof SinAcceso) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
