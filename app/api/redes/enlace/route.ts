import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { origenPublico } from '@/lib/integrations/google-oauth';
import { crearIntento, esProveedor, talentosDeUsuario } from '@/lib/redes/talento';
import { configurado } from '@/lib/redes/proveedores';

export const dynamic = 'force-dynamic';

/**
 * POST { talento, proveedor, origen } — prepara una conexión y devuelve la dirección que la empieza. Desde la
 * app esa dirección se abre en el navegador del sistema (Google y Meta no dejan iniciar sesión en un WebView),
 * que no tiene la sesión: por eso el intento queda en la base, de un solo uso y con su dueño.
 */
export async function POST(req: Request) {
  const u = await getCurrentUser();
  if (!u) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const talento = String(b.talento || '');
  const proveedor = String(b.proveedor || '');
  if (!esProveedor(proveedor)) return NextResponse.json({ error: 'Red no válida' }, { status: 400 });
  if (!configurado(proveedor)) return NextResponse.json({ error: 'Esa red aún no está habilitada.' }, { status: 409 });
  if (!(await talentosDeUsuario(u.userId)).includes(talento)) return NextResponse.json({ error: 'Ese talento no es tuyo.' }, { status: 403 });
  const nonce = await crearIntento(u.userId, talento, proveedor, b.origen === 'app' ? 'app' : 'web');
  return NextResponse.json({ url: `${origenPublico(req.headers)}/api/redes/${proveedor}/conectar?n=${nonce}` });
}
