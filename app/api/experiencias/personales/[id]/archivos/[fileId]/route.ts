import { conUsuario, idNumerico } from '@/lib/experiencias-personales-ruta';
import { asignarArchivo, eliminarArchivo } from '@/lib/experiencias-personales';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string; fileId: string }> };

/** PATCH { eventoId|null } — asigna el archivo a un evento (lo mueve de carpeta en Drive). */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id, fileId } = await params;
  const b = await req.json().catch(() => ({}));
  const eventoId = b?.eventoId == null ? null : idNumerico(String(b.eventoId));
  return conUsuario('Archivo personal (asignar)', (userId) => asignarArchivo(userId, idNumerico(id), fileId, eventoId));
}

/** DELETE — a la papelera de Drive. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id, fileId } = await params;
  return conUsuario('Archivo personal (eliminar)', (userId) => eliminarArchivo(userId, idNumerico(id), fileId));
}
