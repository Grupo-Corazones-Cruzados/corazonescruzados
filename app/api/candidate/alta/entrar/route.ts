import { NextResponse } from 'next/server';
import { claveValida } from '@/lib/auth/intentos';
import { candidatoPorCorreo, abrirSesionAlta } from '@/lib/auth/alta-candidato';

export const dynamic = 'force-dynamic';

/** POST { correo, clave } — entra al formulario de alta con el correo corporativo y la contraseña temporal. */
export async function POST(req: Request) {
  try {
    const { correo, clave } = await req.json().catch(() => ({}));
    const email = String(correo || '').trim().toLowerCase();
    if (!/^[a-z0-9]+@grupocc\.org$/.test(email) || typeof clave !== 'string' || !clave) {
      return NextResponse.json({ error: 'Escribe tu correo corporativo y la contraseña temporal.' }, { status: 400 });
    }
    const c = await candidatoPorCorreo(email);
    if (c?.profile_completed) {
      return NextResponse.json({ error: 'Esta cuenta ya está creada. Inicia sesión con tu correo corporativo.', completada: true }, { status: 409 });
    }
    const vigente = !!c && !!c.alta_clave_vence && new Date(c.alta_clave_vence) > new Date();
    const ok = await claveValida(email, clave, vigente ? c!.alta_clave_hash : null);
    if (!ok) {
      return NextResponse.json({ error: c && !vigente ? 'La contraseña temporal venció. Pide una nueva al equipo de reclutamiento.' : 'El correo o la contraseña temporal no son correctos.' }, { status: 401 });
    }
    await abrirSesionAlta(c!.id);
    return NextResponse.json({ ok: true, nombre: c!.full_name, correo: email });
  } catch (e: any) {
    // `claveValida` lanza cuando hay demasiados intentos seguidos.
    return NextResponse.json({ error: e?.message || 'No se pudo entrar.' }, { status: 429 });
  }
}
