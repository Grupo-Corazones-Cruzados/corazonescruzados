import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { talentosDelCatalogo } from '@/lib/talentos/catalogo';

export const dynamic = 'force-dynamic';

/**
 * GET — el catálogo de talentos (`gd_talentos`, el único; ver `lib/talentos/catalogo.ts`), para
 * las opciones de los formularios de tickets y proyectos. Cualquier sesión: el que solicita un
 * ticket puede ser un cliente o un candidato.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  try {
    return NextResponse.json({ data: await talentosDelCatalogo() });
  } catch (err: any) {
    console.error('Catálogo de talentos:', err.message);
    return NextResponse.json({ error: 'No se pudo cargar el catálogo de talentos', data: [] }, { status: 500 });
  }
}
