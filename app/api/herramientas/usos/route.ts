import { NextResponse, type NextRequest } from 'next/server';
import { usuarioDeHerramientas } from '@/lib/herramientas/acceso';
import { HERRAMIENTAS } from '@/lib/herramientas/catalogo';
import { listarUsos, registrarUso } from '@/lib/herramientas/usos';

export const dynamic = 'force-dynamic';

const valida = (id: unknown): id is string => typeof id === 'string' && HERRAMIENTAS.some((h) => h.id === id);

/** GET ?herramienta=<id> — el historial de esa herramienta (los propios; el admin, todos). */
export async function GET(req: NextRequest) {
  const acceso = await usuarioDeHerramientas();
  if (acceso.error) return acceso.error;
  const herramienta = req.nextUrl.searchParams.get('herramienta');
  if (!valida(herramienta)) return NextResponse.json({ error: 'Herramienta no válida' }, { status: 400 });
  const data = await listarUsos(herramienta, acceso.user.userId, acceso.rol === 'admin');
  return NextResponse.json({ data, deTodos: acceso.rol === 'admin' });
}

/** POST { herramienta, titulo, detalle } — anota un uso (solo el registro, nunca el resultado). */
export async function POST(req: NextRequest) {
  const acceso = await usuarioDeHerramientas();
  if (acceso.error) return acceso.error;
  const c = await req.json().catch(() => ({}));
  if (!valida(c.herramienta)) return NextResponse.json({ error: 'Herramienta no válida' }, { status: 400 });
  const titulo = String(c.titulo ?? '').trim();
  if (!titulo) return NextResponse.json({ error: 'Falta el título' }, { status: 400 });
  // Solo textos cortos: el detalle es un resumen del uso, no un sitio donde guardar datos.
  const detalle: Record<string, string> = {};
  for (const [k, v] of Object.entries(c.detalle && typeof c.detalle === 'object' ? c.detalle : {}).slice(0, 12))
    detalle[String(k).slice(0, 40)] = String(v).slice(0, 200);
  await registrarUso(acceso.user.userId, c.herramienta, titulo, detalle);
  return NextResponse.json({ ok: true });
}
