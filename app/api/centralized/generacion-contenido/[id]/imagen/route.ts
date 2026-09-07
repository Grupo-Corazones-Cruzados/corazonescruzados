import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { getLamina } from '@/lib/centralized/generacion-contenido-db';
import { generarImagenLamina } from '@/lib/centralized/generacion-contenido-ia';

// UNA lámina por petición: cada imagen es la llamada más lenta de todo el sistema, y la que
// más veces se pasa del plazo de espera. La pantalla las va pidiendo en fila.
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  try {
    const { id } = await params;
    const { lamina_id } = await req.json();
    const lamina = await getLamina(Number(lamina_id), user.userId, user.role === 'admin');
    if (!lamina || Number(lamina.contenido_id) !== Number(id)) {
      return NextResponse.json({ error: 'Lámina no encontrada' }, { status: 404 });
    }
    const url = await generarImagenLamina(lamina);
    return NextResponse.json({ data: { id: lamina.id, imagen_url: url } });
  } catch (err: any) {
    console.error('Generación de contenido imagen error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
