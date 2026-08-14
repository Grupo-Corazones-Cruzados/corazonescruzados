import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { resolveWorkspaceEmail } from '@/lib/workspace/account';
import { isGoogleWorkspaceConfigured, updateGoogleProfile } from '@/lib/integrations/google-workspace';
import { normalizarRed, REDES, type Red } from '@/lib/members/redes';

/**
 * Los cuatro campos de redes guardan una **URL de perfil**, no un `@usuario`.
 * La conversión y la comprobación viven en `lib/members/redes.ts`, que es la única
 * puerta: el formulario avisa mientras se escribe y aquí se corta lo que llegue por
 * otro camino. Un enlace mal formado en el CV público es un botón que no lleva a
 * ninguna parte delante de un reclutador.
 */
function redesDelCuerpo(body: any): { valores: Record<Red, string | null>; error: string | null } {
  const valores = {} as Record<Red, string | null>;
  for (const red of ['youtube', 'tiktok', 'instagram', 'facebook'] as Red[]) {
    const { url, error } = normalizarRed(red, body[`${red}_handle`]);
    if (error) return { valores, error: `${REDES[red].etiqueta}: ${error}` };
    valores[red] = url;
  }
  return { valores, error: null };
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    await pool.query(`
      ALTER TABLE gcc_world.users ADD COLUMN IF NOT EXISTS youtube_handle TEXT;
      ALTER TABLE gcc_world.users ADD COLUMN IF NOT EXISTS tiktok_handle TEXT;
      ALTER TABLE gcc_world.users ADD COLUMN IF NOT EXISTS instagram_handle TEXT;
      ALTER TABLE gcc_world.users ADD COLUMN IF NOT EXISTS facebook_handle TEXT;
    `);

    const body = await req.json();
    const { first_name, last_name, phone, avatar_url } = body;
    const { valores: redes, error: errorRedes } = redesDelCuerpo(body);
    if (errorRedes) return NextResponse.json({ error: errorRedes }, { status: 400 });

    await pool.query(
      `UPDATE gcc_world.users
       SET first_name = $1, last_name = $2, phone = $3, avatar_url = $4,
           youtube_handle = $5, tiktok_handle = $6, instagram_handle = $7, facebook_handle = $8,
           updated_at = NOW()
       WHERE id = $9`,
      [first_name || null, last_name || null, phone || null, avatar_url || null,
       redes.youtube, redes.tiktok, redes.instagram, redes.facebook, user.userId]
    );

    // Refleja nombre/teléfono en el perfil de Google (si tiene cuenta corporativa).
    try {
      const we = await resolveWorkspaceEmail(user.userId);
      if (we && isGoogleWorkspaceConfigured()) {
        await updateGoogleProfile(we, {
          givenName: first_name || '',
          familyName: last_name || '',
          phone: phone || '',
        });
      }
    } catch (e: any) {
      console.error('Sync perfil → Google falló:', e?.response?.data ? JSON.stringify(e.response.data) : e?.message);
    }

    return NextResponse.json({ message: 'Perfil actualizado' });
  } catch (err: any) {
    console.error('Profile update error:', err.message);
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}
