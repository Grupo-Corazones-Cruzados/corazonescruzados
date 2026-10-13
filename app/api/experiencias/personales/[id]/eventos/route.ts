import { conUsuario, idNumerico } from '@/lib/experiencias-personales-ruta';
import { crearEvento, validarEvento } from '@/lib/experiencias-personales';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  return conUsuario('Evento personal (crear)', async (userId) => ({ id: await crearEvento(userId, idNumerico(id), validarEvento(body)) }));
}
