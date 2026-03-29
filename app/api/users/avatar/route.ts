import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';

const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const form = await req.formData();
    const file = form.get('avatar') as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No se envio ningun archivo' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'La imagen no puede superar 2MB' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const allowed = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
    if (!allowed.includes(ext)) {
      return NextResponse.json({ error: 'Formato no soportado. Usa PNG, JPG, GIF o WebP' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeMap: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      gif: 'image/gif', webp: 'image/webp',
    };
    const dataUri = `data:${mimeMap[ext] || 'image/png'};base64,${buffer.toString('base64')}`;

    await pool.query(
      `UPDATE gcc_world.users SET avatar_url = $1, updated_at = NOW() WHERE id = $2`,
      [dataUri, user.userId]
    );

    return NextResponse.json({ avatar_url: dataUri });
  } catch (err: any) {
    console.error('Avatar upload error:', err.message);
    return NextResponse.json({ error: 'Error al subir imagen' }, { status: 500 });
  }
}
