/**
 * CV público — JSON. Sin sesión, solo con el token.
 *
 * Devuelve **exactamente** lo que se publica: si el teléfono está apagado, la clave
 * no existe. No hay filtrado en el cliente, porque un JSON público se lee igual de
 * fácil que la página.
 *
 * `no-store`: revocar el enlace tiene que notarse ya, no cuando caduque una caché.
 */
import { NextRequest, NextResponse } from 'next/server';
import { cvPublicoDeToken } from '@/lib/members/cv-share';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const cv = await cvPublicoDeToken(token);
    // Un token inválido, revocado o regenerado responde 404, igual que uno inventado:
    // la respuesta no distingue «no existe» de «ya no vale».
    if (!cv) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    return NextResponse.json(cv, {
      headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    });
  } catch (err: any) {
    console.error('CV público GET error:', err.message);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
