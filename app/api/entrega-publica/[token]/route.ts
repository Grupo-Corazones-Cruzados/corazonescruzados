import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { contenido, COOKIE, enVentana, entregaPorToken, puedeAbrir } from '@/lib/entregas';
import type { Archivo } from '@/lib/enlaces';

export const runtime = 'nodejs';

/**
 * GET /api/entrega-publica/<token> — qué ve quien abre el enlace. Abrirlo NO lo gasta: sin gastar
 * solo se enseña el título y cuántos archivos hay. Si este navegador ya la abrió y está en su
 * ventana, devuelve el contenido.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const e = await entregaPorToken(token);
  const user = await getCurrentUser();
  const u = user ? { userId: String(user.userId) } : null;
  const sesion = user?.email ?? null;
  if (e && enVentana(e, req.cookies.get(COOKIE(e.id))?.value, u)) {
    return NextResponse.json({ data: { motivo: null, abierta: true, sesion, ...contenido(e) } });
  }
  const a = puedeAbrir(e, u);
  if (!a.ok) return NextResponse.json({ data: { motivo: a.motivo, sesion } });
  const archivos = e.archivos as Archivo[];
  return NextResponse.json({
    data: {
      motivo: null, abierta: false, sesion, titulo: e.titulo, vence_en: e.vence_en,
      n_archivos: archivos.length, total: archivos.reduce((s, x) => s + (x.tamano || 0), 0), con_mensaje: !!e.mensaje,
    },
  });
}
