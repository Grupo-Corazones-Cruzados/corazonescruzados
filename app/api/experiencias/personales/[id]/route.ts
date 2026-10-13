import { conUsuario, idNumerico } from '@/lib/experiencias-personales-ruta';
import { detalle, actualizar, eliminar, validarExperiencia } from '@/lib/experiencias-personales';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** GET — la experiencia, sus eventos y los archivos de su carpeta de Drive (en vivo). */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return conUsuario('Experiencia personal (detalle)', (userId) => detalle(userId, idNumerico(id)));
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  return conUsuario('Experiencia personal (editar)', (userId) => actualizar(userId, idNumerico(id), validarExperiencia(body)));
}

/** DELETE — la carpeta va a la papelera de Drive (recuperable 30 días). */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return conUsuario('Experiencia personal (eliminar)', (userId) => eliminar(userId, idNumerico(id)));
}
