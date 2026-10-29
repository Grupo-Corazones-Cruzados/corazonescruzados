import { NextResponse } from 'next/server';
import { estadoRegistro } from '@/lib/registro/limite';

/**
 * ¿Puede este equipo crear un registro (postulación o cuenta de cliente) ahora? Lo leen las
 * tarjetas de la portada para avisar de la pausa de 24 horas. Ver `lib/registro/limite.ts`.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json(await estadoRegistro(), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    // Si no se puede saber, NO se bloquea en las tarjetas: el servidor vuelve a comprobarlo al
    // registrar, que es donde de verdad manda.
    console.error('[registro/estado]', (e as Error).message);
    return NextResponse.json({ bloqueado: false, hasta: null, libre: false, error: true });
  }
}
