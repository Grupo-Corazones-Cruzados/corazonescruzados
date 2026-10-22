import { NextRequest, NextResponse } from 'next/server';
import { usuarioDeHerramientas } from '@/lib/herramientas/acceso';
import { appVigente } from '@/lib/herramientas/apps';

export const dynamic = 'force-dynamic';

/** GET — la versión vigente de una app para el teléfono (`lib/herramientas/apps.ts`). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const acceso = await usuarioDeHerramientas();
  if (acceso.error) return acceso.error;
  const { slug } = await ctx.params;
  const app = await appVigente(slug);
  if (!app) return NextResponse.json({ data: null });
  return NextResponse.json({
    data: { version_name: app.version_name, version_code: app.version_code, tamano: app.tamano, sha256: app.sha256, publicada_en: app.publicada_en },
  });
}
