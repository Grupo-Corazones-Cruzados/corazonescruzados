import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import { getCurrentUser } from '@/lib/auth/jwt';
import { appVigente, nombreApk } from '@/lib/herramientas/apps';
import { abrir } from '@/lib/media/drive';

export const dynamic = 'force-dynamic';

/** GET — el APK vigente, desde el Drive de la empresa. Solo con sesión. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Inicia sesión para descargar la app' }, { status: 401 });
  const { slug } = await ctx.params;
  const app = await appVigente(slug);
  if (!app) return NextResponse.json({ error: 'Esta app aún no tiene una versión publicada' }, { status: 404 });
  try {
    const { stream } = await abrir(app.drive_id);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Length': String(app.tamano),
        'Content-Disposition': `attachment; filename="${nombreApk(app)}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (e: any) {
    console.error('[apps] apk', slug, e?.message);
    return NextResponse.json({ error: 'No se pudo leer el paquete' }, { status: 502 });
  }
}
