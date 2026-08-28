/**
 * VER LA PLATAFORMA CON LOS OJOS DE OTRO USUARIO.
 *
 * ── PARA QUÉ ──────────────────────────────────────────────────────────────────────────
 * Comprobar qué ve de verdad un cliente o un miembro sin pedirle su contraseña. Nació de
 * una tarde entera con Peter Tours: «pulso mi flujo y no me sale el botón de configurar».
 * Desde una cuenta de administrador no había forma de verlo — el panel salía a la derecha
 * porque la pantalla era ancha— y el fallo solo existía en la suya.
 *
 * ── LAS TRES REGLAS QUE LO HACEN SEGURO ───────────────────────────────────────────────
 *
 *  1. **Solo la empieza un administrador**, y se comprueba contra la BASE, no contra el
 *     token: un token puede ser viejo y venir de antes de que a alguien se le quitara el
 *     rol.
 *
 *  2. **Mientras dura, el administrador NO es administrador.** El token nuevo lleva el rol
 *     del usuario suplantado. Pierde de verdad sus permisos en todas las rutas — que es lo
 *     único que hace que «ver como otro» sea ver lo que el otro ve, con sus botones que
 *     faltan y sus 403. Y de paso cierra el paso a encadenar suplantaciones: para empezar
 *     una hace falta rol de admin, y ya no lo tiene.
 *
 *  3. **Queda registrado** en `gcc_world.suplantaciones`, al entrar y al salir. No es un
 *     extra: durante ese rato lo que se escriba queda firmado por otra persona, y tiene
 *     que poder distinguirse después. Ver la migración 058.
 *
 * `DELETE` devuelve al administrador a su cuenta. Puede llamarlo una sesión SIN rol de
 * admin —justo la que acaba de crearse— porque su permiso no está en el rol sino en el
 * `suplantadoPor` que lleva firmado el token.
 */

import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser, createToken, setAuthCookie, type UserRole } from '@/lib/auth/jwt';
import { getClientIp, hashIp } from '@/lib/world/session';

/** El usuario de la sesión, tal como está HOY en la base. El token puede haber envejecido. */
async function usuarioReal(id: string) {
  const { rows: [u] } = await pool.query(
    `SELECT id, email, role, first_name, last_name FROM gcc_world.users WHERE id = $1`, [id],
  );
  return u ?? null;
}

/**
 * A quién se puede suplantar. Devuelve como mucho 20, y **solo buscando**: volcar el
 * listado entero de cuentas en un desplegable invita a entrar en la de cualquiera por
 * curiosidad. Se elige a alguien concreto, no se navega por la gente.
 */
export async function GET(req: Request) {
  const sesion = await getCurrentUser();
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const yo = await usuarioReal(sesion.userId);
  if (yo?.role !== 'admin') return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  const busca = (new URL(req.url).searchParams.get('busca') ?? '').trim();
  if (busca.length < 2) return NextResponse.json({ data: [] });

  const { rows } = await pool.query(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.avatar_url, u.role, c.account_type
       FROM gcc_world.users u
       LEFT JOIN gcc_world.clients c ON c.user_id = u.id
      WHERE u.id <> $1
        AND (u.email ILIKE '%'||$2||'%'
             OR COALESCE(u.first_name,'') ILIKE '%'||$2||'%'
             OR COALESCE(u.last_name,'')  ILIKE '%'||$2||'%')
      ORDER BY u.first_name NULLS LAST, u.email
      LIMIT 20`,
    [sesion.userId, busca],
  );
  return NextResponse.json({ data: rows });
}

/** Empieza la vista como otro usuario. */
export async function POST(req: Request) {
  const sesion = await getCurrentUser();
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  // Regla 1: se comprueba contra la base. Y si YA está suplantando, su rol no es admin y
  // aquí se queda: no se encadenan vistas.
  const admin = await usuarioReal(sesion.userId);
  if (admin?.role !== 'admin' || sesion.suplantadoPor) {
    return NextResponse.json({ error: 'Solo un administrador puede ver la plataforma como otro usuario.' }, { status: 403 });
  }

  const { usuario_id } = await req.json();
  if (!usuario_id) return NextResponse.json({ error: 'Falta el usuario' }, { status: 400 });
  if (usuario_id === admin.id) {
    return NextResponse.json({ error: 'Esa ya es tu cuenta.' }, { status: 400 });
  }

  const destino = await usuarioReal(usuario_id);
  if (!destino) return NextResponse.json({ error: 'Ese usuario no existe' }, { status: 404 });

  // Regla 3: se anota ANTES de entregar la sesión. Si algo falla después, queda el intento
  // registrado — y un intento registrado de más es mejor que un acceso sin rastro.
  await pool.query(
    `INSERT INTO gcc_world.suplantaciones (admin_id, admin_email, usuario_id, usuario_email, usuario_rol, ip_hash)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [admin.id, admin.email, destino.id, destino.email, destino.role, hashIp(await getClientIp())],
  );

  // Regla 2: el rol es el DEL DESTINO. Quien mira deja de ser administrador.
  await setAuthCookie(await createToken({
    userId: destino.id,
    email: destino.email,
    role: destino.role as UserRole,
    suplantadoPor: admin.id,
    suplantadoPorEmail: admin.email,
  }));

  return NextResponse.json({
    ok: true,
    usuario: { id: destino.id, email: destino.email, nombre: [destino.first_name, destino.last_name].filter(Boolean).join(' ') || destino.email, rol: destino.role },
  });
}

/** Vuelve a la cuenta del administrador. */
export async function DELETE() {
  const sesion = await getCurrentUser();
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  // ⚠️ El permiso para volver NO es el rol —ahora mismo es el del usuario suplantado— sino
  // el `suplantadoPor` que va firmado dentro del token. Nadie puede fabricarlo.
  if (!sesion.suplantadoPor) {
    return NextResponse.json({ error: 'Esta sesión no es una vista de otro usuario.' }, { status: 400 });
  }

  const admin = await usuarioReal(sesion.suplantadoPor);
  if (admin?.role !== 'admin') {
    // Le quitaron el rol mientras miraba. No se le devuelve una sesión de administrador:
    // se cierra la sesión y que vuelva a entrar.
    return NextResponse.json({ error: 'Tu cuenta ya no es de administrador. Cierra sesión y vuelve a entrar.' }, { status: 403 });
  }

  await pool.query(
    `UPDATE gcc_world.suplantaciones SET terminada_en = NOW()
      WHERE admin_id = $1 AND usuario_id = $2 AND terminada_en IS NULL`,
    [admin.id, sesion.userId],
  );

  await setAuthCookie(await createToken({ userId: admin.id, email: admin.email, role: admin.role as UserRole }));
  return NextResponse.json({ ok: true });
}
