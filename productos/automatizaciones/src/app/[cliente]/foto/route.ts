import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { leerSesionUsuario } from '@/lib/sesion';
import { fotoGcc } from '@/lib/cuentaGcc';

export const dynamic = 'force-dynamic';

/**
 * LA FOTO DE QUIEN TIENE LA SESIÓN, tomada de su cuenta de GCC World (2026-11-08). Solo la propia:
 * no recibe a quién, lo saca de la sesión. Privada y en caché una hora.
 */
export async function GET(_: Request, { params }: { params: Promise<{ cliente: string }> }) {
  const { cliente } = await params;
  const sesion = await leerSesionUsuario();
  if (!sesion || sesion.slug !== cliente) return new Response(null, { status: 401 });
  const u = await prisma.usuario.findFirst({
    where: { id: sesion.uid, inquilinoId: sesion.inquilinoId, origen: 'GCC' },
    select: { email: true, usuario: true },
  });
  const foto = u ? await fotoGcc(u.email ?? u.usuario) : null;
  if (!foto) return new Response(null, { status: 404 });

  const cache = { 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff' };
  const m = /^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/.exec(foto);
  if (m) return new Response(new Uint8Array(Buffer.from(m[2], 'base64')), { headers: { 'Content-Type': m[1], ...cache } });
  if (/^https:\/\//.test(foto)) return NextResponse.redirect(foto, { headers: cache });
  return new Response(null, { status: 404 });
}
