import { conUsuario } from '@/lib/experiencias-personales-ruta';
import { listar, crear, validarExperiencia } from '@/lib/experiencias-personales';

export const dynamic = 'force-dynamic';

/** GET — experiencias personales del usuario. POST — crea una (y su carpeta en Drive). */
export async function GET() {
  return conUsuario('Experiencias personales (lista)', async (userId) => ({ experiencias: await listar(userId) }));
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  return conUsuario('Experiencias personales (crear)', async (userId) => ({ id: await crear(userId, validarExperiencia(body)) }));
}
