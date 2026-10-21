import { NextRequest, NextResponse } from 'next/server';
import { appVigente } from '@/lib/herramientas/apps';

export const dynamic = 'force-dynamic';

/** GET — pública: la app la consulta al abrirse para avisar de que hay una versión nueva. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const app = await appVigente(slug);
  if (!app) return NextResponse.json({ error: 'No existe' }, { status: 404 });
  return NextResponse.json({ version_code: app.version_code, version_name: app.version_name });
}
