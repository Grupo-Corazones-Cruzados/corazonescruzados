import { conUsuario, idNumerico } from '@/lib/experiencias-personales-ruta';
import { asignarArchivo, eliminarArchivo, renombrarArchivo } from '@/lib/experiencias-personales';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string; fileId: string }> };

/**
 * PATCH { nombre } — renombra el archivo en Drive.
 * PATCH { eventoId|null } — lo asigna a un evento (lo mueve de carpeta en Drive).
 * ⚠️ Se distingue por la PRESENCIA de `nombre`: sin esta rama, un renombrado (que no trae
 * `eventoId`) se leería como «eventoId = null» y movería el archivo a «Sin evento».
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id, fileId } = await params;
  const b = await req.json().catch(() => ({}));
  if (b && 'nombre' in b) {
    return conUsuario('Archivo personal (renombrar)', (userId) => renombrarArchivo(userId, idNumerico(id), fileId, b.nombre));
  }
  const eventoId = b?.eventoId == null ? null : idNumerico(String(b.eventoId));
  return conUsuario('Archivo personal (asignar)', (userId) => asignarArchivo(userId, idNumerico(id), fileId, eventoId));
}

/** DELETE — a la papelera de Drive. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id, fileId } = await params;
  return conUsuario('Archivo personal (eliminar)', (userId) => eliminarArchivo(userId, idNumerico(id), fileId));
}
