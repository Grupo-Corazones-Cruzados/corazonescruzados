import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { appVigente } from '@/lib/herramientas/apps';

export const dynamic = 'force-dynamic';

/** GET — la versión vigente de una app para el teléfono (`lib/herramientas/apps.ts`). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { slug } = await ctx.params;
  const app = await appVigente(slug);
  if (!app) return NextResponse.json({ data: null });
  return NextResponse.json({
    data: { version_name: app.version_name, version_code: app.version_code, tamano: app.tamano, sha256: app.sha256, publicada_en: app.publicada_en },
  });
}
