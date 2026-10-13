import { conUsuario, idNumerico } from '@/lib/experiencias-personales-ruta';
import { abrirSubidaArchivo } from '@/lib/experiencias-personales';
import { origenPublico } from '@/lib/integrations/google-oauth';

export const dynamic = 'force-dynamic';

/**
 * POST { eventoId|null, nombre, mime, tamano } → { url } de una sesión de subida
 * reanudable de Google Drive. El navegador sube los bytes DIRECTO a esa URL: el archivo
 * no pasa por este servidor.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => ({}));
  const origin = req.headers.get('origin') || origenPublico(req.headers);
  return conUsuario('Experiencia personal (subida)', async (userId) => ({
    url: await abrirSubidaArchivo(userId, idNumerico(id), {
      eventoId: b?.eventoId == null ? null : idNumerico(String(b.eventoId)),
      nombre: b?.nombre, mime: String(b?.mime || ''), tamano: Number(b?.tamano), origin,
    }),
  }));
}
