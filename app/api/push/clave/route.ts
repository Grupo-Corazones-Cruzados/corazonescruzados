import { NextResponse } from 'next/server';
import { clavePublica } from '@/lib/push';

/** Clave pública VAPID para que el navegador se suscriba. Es pública por definición. */
export async function GET() {
  const clave = clavePublica();
  if (!clave) return NextResponse.json({ error: 'Push no configurado' }, { status: 503 });
  return NextResponse.json({ clave });
}
