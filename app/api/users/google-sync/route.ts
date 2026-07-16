import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/jwt';
import { NextResponse } from 'next/server';
import { uploadImage, cloudinaryConfigured } from '@/lib/cloudinary';
import { resolveWorkspaceEmail } from '@/lib/workspace/account';
import { isGoogleWorkspaceConfigured, getGoogleProfile } from '@/lib/integrations/google-workspace';

/**
 * "Sincronizar con Google": trae el nombre, teléfono y foto del perfil de Google del
 * usuario a la app. Requiere que el usuario tenga cuenta corporativa (`workspace_email`).
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    if (!isGoogleWorkspaceConfigured()) {
      return NextResponse.json({ error: 'Google Workspace no está configurado' }, { status: 400 });
    }
    const we = await resolveWorkspaceEmail(user.userId);
    if (!we) {
      return NextResponse.json({ error: 'Tu cuenta no tiene una cuenta de Google asociada' }, { status: 400 });
    }

    const g = await getGoogleProfile(we);

    // Foto: si Google tiene una, se sube al almacenamiento de la app y se usa como avatar.
    let avatarUrl: string | null = null;
    if (g.photoBase64Std) {
      const dataUri = `data:${g.photoMime || 'image/jpeg'};base64,${g.photoBase64Std}`;
      avatarUrl = cloudinaryConfigured()
        ? await uploadImage(dataUri, 'corazones-cruzados/avatars')
        : dataUri;
    }

    await pool.query(
      `UPDATE gcc_world.users
          SET first_name = COALESCE($1, first_name),
              last_name  = COALESCE($2, last_name),
              phone      = COALESCE($3, phone),
              avatar_url = COALESCE($4, avatar_url),
              updated_at = NOW()
        WHERE id = $5`,
      [g.givenName, g.familyName, g.phone, avatarUrl, user.userId],
    );

    return NextResponse.json({
      ok: true,
      first_name: g.givenName,
      last_name: g.familyName,
      phone: g.phone,
      avatar_url: avatarUrl,
      photoSynced: !!avatarUrl,
    });
  } catch (err: any) {
    console.error('Google sync error:', err?.response?.data ? JSON.stringify(err.response.data) : err.message);
    return NextResponse.json({ error: 'Error al sincronizar con Google' }, { status: 500 });
  }
}
