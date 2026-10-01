import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { cloudinaryConfigured, uploadImage } from '@/lib/cloudinary';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 8 * 1024 * 1024;
const TIPOS = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

/**
 * POST — sube una imagen pegada o arrastrada al documento y devuelve su URL. Va a Cloudinary
 * y no en base64 dentro del HTML: el documento se guarda entero en cada pulsación pausada, y
 * con las imágenes dentro cada guardado arrastraría megas.
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    if (!cloudinaryConfigured()) {
      return NextResponse.json({ error: 'El almacén de imágenes no está configurado.' }, { status: 503 });
    }
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Falta la imagen' }, { status: 400 });
    if (!TIPOS.has(file.type)) return NextResponse.json({ error: 'Formato no admitido (PNG, JPG, WebP o GIF).' }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'La imagen pasa de 8 MB.' }, { status: 413 });

    const b64 = Buffer.from(await file.arrayBuffer()).toString('base64');
    const url = await uploadImage(`data:${file.type};base64,${b64}`, 'corazones-cruzados/prompts');
    return NextResponse.json({ data: { url } });
  } catch (err: any) {
    console.error('Prompts imagen:', err.message);
    return NextResponse.json({ error: 'No se pudo subir la imagen.' }, { status: 500 });
  }
}
