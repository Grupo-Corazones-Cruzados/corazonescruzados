import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { acceso, COMPARTIBLES, porToken } from '@/lib/herramientas/accesos';

/**
 * GET /api/herramienta-publica/<token> — qué herramienta abre el enlace, o por qué no.
 * Si no puede entrar, solo se dice el motivo: el título puede ser privado.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const a = await porToken(token);
  const user = await getCurrentUser();
  const r = acceso(a, user ? { userId: String(user.userId) } : null);
  if (!r.ok) return NextResponse.json({ data: { motivo: r.motivo, sesion: user?.email ?? null } });
  return NextResponse.json({
    data: {
      motivo: null, herramienta: a.herramienta, nombre: COMPARTIBLES[a.herramienta].nombre,
      titulo: a.titulo || null, vence_en: a.vence_en, sesion: user?.email ?? null,
    },
  });
}
