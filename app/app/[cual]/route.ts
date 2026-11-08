import { NextResponse, type NextRequest } from 'next/server';

/**
 * ARRANQUE DE LAS APPS DE ESCRITORIO (Fernando, 2026-11-08: «lo mismo voy a querer en la MacBook»).
 * En la Mac las apps son apps web de Safari («Añadir al Dock»), y cada una guarda sus cookies aparte.
 * Abrir `/app/world` o `/app/miembros` deja en ESA app la cookie `gcc_app` que en el teléfono escribe
 * la app nativa (`MainActivity`, `VistaPrincipal`), y entra: a partir de ahí se comporta como GCC World
 * o GCC Miembros (`lib/sitio/appDeTelefono.ts`). En un navegador normal no se enlaza desde ningún sitio.
 */
const APPS: Record<string, string> = { world: 'progreso', miembros: 'centralizado' };

export async function GET(request: NextRequest, ctx: { params: Promise<{ cual: string }> }) {
  // Detrás del proxy de Railway `request.url` lleva el anfitrión interno: la base pública va primero.
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const base = process.env.NEXT_PUBLIC_APP_URL || (host ? `${proto}://${host}` : new URL(request.url).origin);
  const app = APPS[(await ctx.params).cual];
  if (!app) return NextResponse.redirect(new URL('/', base));
  const res = NextResponse.redirect(new URL('/dashboard', base));
  res.cookies.set('gcc_app', app, { path: '/', maxAge: 60 * 60 * 24 * 365, secure: true, sameSite: 'lax' });
  return res;
}
