import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/jwt';
import { resolveSubject } from '@/lib/centralized/subject';
import { googleOAuthConfigurado, leerConexion, tokenDeAcceso, desconectar, GoogleReconectar, GOOGLE_SCOPES } from '@/lib/integrations/google-oauth';
import { cuota, type Cuota } from '@/lib/integrations/google-drive';

export const dynamic = 'force-dynamic';

/**
 * GET — estado de la conexión de Google del usuario + el espacio de su Drive.
 * `estado: 'revocada'` ⇒ la pantalla ofrece «Reconectar».
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const puede = !!(await resolveSubject(user));
  const configurado = googleOAuthConfigurado();
  try {
    const c = await leerConexion(user.userId);
    let espacio: Cuota | null = null;
    let estado = c?.estado ?? null;
    if (c && estado === 'activa') {
      try {
        espacio = await cuota(await tokenDeAcceso(user.userId));
      } catch (e) {
        if (e instanceof GoogleReconectar) estado = 'revocada';
        else throw e;
      }
    }
    const faltan = c ? GOOGLE_SCOPES.filter((s) => s.startsWith('https://') && !c.scopes.includes(s)) : [];
    return NextResponse.json({
      data: {
        puede, configurado,
        conexion: c ? { email: c.email, estado, conectadaEn: c.conectadaEn, scopes: c.scopes, faltan } : null,
        espacio,
      },
    });
  } catch (e: any) {
    console.error('Google conexión (estado):', e?.message);
    return NextResponse.json({ error: 'No se pudo leer la conexión con Google.' }, { status: 500 });
  }
}

/** DELETE — desconecta (revoca en Google). Los archivos siguen en su Drive. */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    await desconectar(user.userId);
    return NextResponse.json({ data: null });
  } catch (e: any) {
    console.error('Google conexión (desconectar):', e?.message);
    return NextResponse.json({ error: 'No se pudo desconectar.' }, { status: 500 });
  }
}
