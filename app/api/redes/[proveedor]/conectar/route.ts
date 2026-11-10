import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { origenPublico } from '@/lib/integrations/google-oauth';
import { esProveedor, leerIntento } from '@/lib/redes/talento';
import { configurado, urlAutorizacion } from '@/lib/redes/proveedores';
import { paginaResultado } from '../resultado';

export const dynamic = 'force-dynamic';

/** GET ?n= — de aquí sale hacia la red. El intento no se gasta aún: se gasta al volver. */
export async function GET(req: Request, { params }: { params: Promise<{ proveedor: string }> }) {
  const { proveedor } = await params;
  const nonce = new URL(req.url).searchParams.get('n') || '';
  if (!esProveedor(proveedor) || !configurado(proveedor)) return paginaResultado(req, null, 'Esa red aún no está habilitada.');
  const intento = await leerIntento(nonce);
  if (!intento || intento.red !== proveedor) return paginaResultado(req, null, 'La conexión caducó. Vuelve a intentarlo.');
  // Si este navegador tiene una sesión, tiene que ser la de quien empezó.
  const u = await getCurrentUser();
  if (u && u.userId !== intento.user_id) return paginaResultado(req, intento.origen, 'La conexión se empezó con otra cuenta.');
  return NextResponse.redirect(urlAutorizacion(proveedor, `${origenPublico(req.headers)}/api/redes/${proveedor}/callback`, nonce));
}
