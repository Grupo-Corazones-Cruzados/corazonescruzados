import { getCurrentUser } from '@/lib/auth/jwt';
import { uploadImage, cloudinaryConfigured } from '@/lib/cloudinary';
import { createCaptura, listCapturas } from '@/lib/centralized/percepcion-db';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MAX_FOTOS = 12;
const MAX_SIZE = 8 * 1024 * 1024; // 8MB por foto
const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };

/** Solo miembros/admin. Devuelve {user, isAdmin} o null. */
async function guard() {
  const user = await getCurrentUser();
  if (!user || !['admin', 'member'].includes(user.role)) return null;
  return { userId: Number(user.userId), isAdmin: user.role === 'admin' };
}

export async function GET() {
  const g = await guard();
  if (!g) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const data = await listCapturas(g.userId, g.isAdmin);
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if (!g) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    const form = await req.formData();
    const files = form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) return NextResponse.json({ error: 'Sube al menos una foto del entorno' }, { status: 400 });
    if (files.length > MAX_FOTOS) return NextResponse.json({ error: `Máximo ${MAX_FOTOS} fotos por captura` }, { status: 400 });

    const num = (v: FormDataEntryValue | null) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
    const lat = num(form.get('lat'));
    const lng = num(form.get('lng'));
    const accuracy = num(form.get('accuracy'));
    const direccion = (form.get('direccion') as string | null)?.slice(0, 300) || null;
    const notas = (form.get('notas') as string | null)?.slice(0, 1000) || null;

    // Sube cada foto a Cloudinary (o guarda base64 como fallback si no está configurado).
    const urls: string[] = [];
    for (const file of files) {
      if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Cada foto debe pesar menos de 8MB' }, { status: 400 });
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const mime = MIME[ext] || file.type || 'image/jpeg';
      const buffer = Buffer.from(await file.arrayBuffer());
      const dataUri = `data:${mime};base64,${buffer.toString('base64')}`;
      const url = cloudinaryConfigured()
        ? await uploadImage(dataUri, 'corazones-cruzados/percepcion-social')
        : dataUri;
      urls.push(url);
    }

    const { id } = await createCaptura(g.userId, { lat, lng, accuracy, direccion, notas }, urls);
    return NextResponse.json({ id }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
