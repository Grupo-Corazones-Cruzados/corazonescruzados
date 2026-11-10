import { getCurrentUser } from '@/lib/auth/jwt';
import { origenPublico } from '@/lib/integrations/google-oauth';
import { esProveedor, gastarIntento, guardarCuentaTalento, REDES_TALENTO } from '@/lib/redes/talento';
import { canjear } from '@/lib/redes/proveedores';
import { paginaResultado } from '../resultado';

export const dynamic = 'force-dynamic';

/** GET — la red vuelve aquí con `code` y `state` (o con `error` si se canceló). */
export async function GET(req: Request, { params }: { params: Promise<{ proveedor: string }> }) {
  const { proveedor } = await params;
  const url = new URL(req.url);
  const intento = await gastarIntento(url.searchParams.get('state') || '');
  if (!esProveedor(proveedor) || !intento || intento.red !== proveedor) return paginaResultado(req, null, 'La conexión caducó. Vuelve a intentarlo.');
  if (url.searchParams.get('error')) return paginaResultado(req, intento.origen, 'Cancelaste la conexión.');
  const u = await getCurrentUser();
  if (u && u.userId !== intento.user_id) return paginaResultado(req, intento.origen, 'La conexión se empezó con otra cuenta.');
  try {
    const cuentas = await canjear(proveedor, url.searchParams.get('code') || '', `${origenPublico(req.headers)}/api/redes/${proveedor}/callback`);
    for (const c of cuentas) await guardarCuentaTalento({ userId: intento.user_id, talento: intento.talento, ...c });
    const nombres = cuentas.map((c) => `${REDES_TALENTO.find((r) => r.red === c.red)?.etiqueta}: ${c.nombre}`).join(' · ');
    const sinIg = proveedor === 'meta' && !cuentas.some((c) => c.red === 'instagram') ? '. La página no tiene una cuenta profesional de Instagram enlazada.' : '';
    return paginaResultado(req, intento.origen, `${intento.talento} · ${nombres} conectado${sinIg}`, true);
  } catch (e: any) {
    console.error(`Conectar ${proveedor}:`, e?.message);
    return paginaResultado(req, intento.origen, `No se pudo conectar: ${String(e?.message || 'error desconocido')}`);
  }
}
