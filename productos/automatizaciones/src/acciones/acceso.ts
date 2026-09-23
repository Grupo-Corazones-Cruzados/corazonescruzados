'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { evaluarAcceso } from '@/lib/inquilino';
import { verificarCuentaGcc } from '@/lib/cuentaGcc';
import {
  abrirSesionUsuario,
  abrirSesionOperador,
  cerrarSesion,
  COOKIE_GCC,
  COOKIE_SESION,
} from '@/lib/sesion';

export type ResultadoAcceso = { error?: string };

/** Un hash que no puede salir de `bcrypt.hash`: sirve para gastar el mismo tiempo. */
const HASH_FALSO = '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin';

/**
 * ENTRAR A UN CLIENTE. Una sola pantalla y una sola casilla para las DOS clases de
 * cuenta que puede tener (Fernando, 2026-09-23):
 *
 *  · La cuenta de cliente de **GCC World** (`origen = GCC`): se escribe el correo y la
 *    contraseña de siempre, y se comprueban contra `gcc_world.users`. Es como entra
 *    Diego Castillo (Peter Tours), que ya tenía cuenta antes de que esto fuera un
 *    producto.
 *  · Una cuenta **del producto** (`origen = PRODUCTO`): la crea el administrador del
 *    cliente para su gente, y su contraseña sí vive en este esquema.
 *
 * ── POR QUÉ UNA SOLA CASILLA Y NO UN SELECTOR ───────────────────────────────────
 * Un desplegable «¿qué tipo de cuenta tienes?» le pide al usuario que sepa algo que es
 * asunto nuestro. La fila ya dice de qué origen es; basta con buscarla. Lo que se
 * escribe es «usuario o correo», y la fila encontrada decide contra qué se comprueba.
 *
 * El mensaje de error es DELIBERADAMENTE el mismo en todos los casos: distinguir
 * «ese usuario no existe» de «esa contraseña no es» le dice a quien prueba cuáles de
 * sus intentos son cuentas reales.
 */
export async function entrar(slug: string, datos: FormData): Promise<ResultadoAcceso> {
  const escrito = String(datos.get('usuario') || '').trim().toLowerCase();
  const clave = String(datos.get('clave') || '');
  if (!escrito || !clave) return { error: 'Escribe tu usuario y tu contraseña.' };

  const inquilino = await prisma.inquilino.findUnique({
    where: { slug },
    include: { suscripcion: true },
  });
  if (!inquilino) return { error: 'Ese cliente no existe.' };

  // Se busca por `usuario` o por `email`: para las cuentas de GCC las dos cosas son el
  // correo, y para las del producto el correo es opcional.
  const cuenta = await prisma.usuario.findFirst({
    where: {
      inquilinoId: inquilino.id,
      OR: [{ usuario: escrito }, { email: escrito }],
    },
  });

  let vale = false;
  if (cuenta?.origen === 'GCC') {
    // La contraseña NO está aquí: vive en GCC World y allí se comprueba. Así, cuando el
    // cliente la cambie en la plataforma, cambia también su entrada a este producto.
    const correo = cuenta.email || cuenta.usuario;
    vale = (await verificarCuentaGcc(correo, clave)) !== null;
  } else {
    // Se compara siempre, exista la cuenta o no, para no delatar por el tiempo de
    // respuesta cuáles existen.
    vale = await bcrypt.compare(clave, cuenta?.claveHash ?? HASH_FALSO);
  }

  if (!cuenta || !vale || !cuenta.activo) {
    return { error: 'Usuario o contraseña incorrectos.' };
  }

  // En un escaparate no se escribe NADA, ni siquiera la hora del último acceso: con
  // visitantes entrando a diario, esa columna sería lo único que cambiaría.
  if (!inquilino.soloLectura)
    await prisma.usuario.update({ where: { id: cuenta.id }, data: { ultimoAcceso: new Date() } });

  await abrirSesionUsuario({
    uid: cuenta.id,
    inquilinoId: inquilino.id,
    slug: inquilino.slug,
    nombre: cuenta.nombre,
    rol: cuenta.rol,
  });

  // Se mira la mensualidad AQUÍ, no solo en el armazón. El armazón ya redirige igual,
  // pero entonces el navegador encadena un salto de más (/acceso → /panel →
  // /suscripcion). Con esto va directo, y no se pide una pantalla que ya se sabe que
  // no se va a poder dar.
  redirect(evaluarAcceso(inquilino) === 'ok' ? `/${slug}/panel` : `/${slug}/suscripcion`);
}

export async function salir(slug: string) {
  await cerrarSesion(COOKIE_SESION);
  redirect(`/${slug}/acceso`);
}

export async function entrarOperador(datos: FormData): Promise<ResultadoAcceso> {
  const email = String(datos.get('email') || '').trim().toLowerCase();
  const clave = String(datos.get('clave') || '');
  if (!email || !clave) return { error: 'Escribe tu correo y tu contraseña.' };

  const op = await prisma.operadorGcc.findUnique({ where: { email } });
  const vale = await bcrypt.compare(clave, op?.claveHash ?? HASH_FALSO);
  if (!op || !vale || !op.activo) return { error: 'Correo o contraseña incorrectos.' };

  await prisma.operadorGcc.update({ where: { id: op.id }, data: { ultimoAcceso: new Date() } });
  await abrirSesionOperador({ oid: op.id, nombre: op.nombre, email: op.email });
  redirect('/gcc');
}

export async function salirOperador() {
  await cerrarSesion(COOKIE_GCC);
  redirect('/gcc/acceso');
}
