import { conUsuario, idNumerico } from '@/lib/experiencias-personales-ruta';
import { actualizarEvento, eliminarEvento, validarEvento } from '@/lib/experiencias-personales';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string; eventoId: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id, eventoId } = await params;
  const body = await req.json().catch(() => null);
  return conUsuario('Evento personal (editar)', (userId) => actualizarEvento(userId, idNumerico(id), idNumerico(eventoId), validarEvento(body)));
}

/** DELETE — sus archivos vuelven a «sin evento»; no se pierde ninguno. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id, eventoId } = await params;
  return conUsuario('Evento personal (eliminar)', (userId) => eliminarEvento(userId, idNumerico(id), idNumerico(eventoId)));
}
