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

/** A partir de cuántos fallos seguidos se cierra la puerta, y por cuánto. */
const FALLOS_PARA_CERRAR = 8;
const MINUTOS_CERRADA = 15;

/**
 * Apunta un intento fallido y, al llegar al tope, cierra la cuenta un rato.
 *
 * Ocho intentos son de sobra para quien se equivoca de contraseña y ridículamente pocos
 * para quien las prueba a máquina. Cerrar 15 minutos no molesta a una persona y le cuesta
 * siglos a un programa.
 *
 * ⚠️ Sí, esto permite que alguien deje a otro fuera 15 minutos a propósito. Es el precio
 * conocido de frenar por cuenta, y es mucho más barato que el otro lado: una contraseña
 * de GCC World adivinada desde aquí.
 */
async function apuntarFallo(id: number, fallosPrevios: number) {
  const fallos = fallosPrevios + 1;
  await prisma.usuario.update({
    where: { id },
    data: {
      intentosFallidos: fallos,
      bloqueadoHasta:
        fallos >= FALLOS_PARA_CERRAR ? new Date(Date.now() + MINUTOS_CERRADA * 60_000) : null,
    },
  });
}

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

  // ⚠️ EL FRENO VA ANTES DE COMPROBAR NADA. Para una cuenta enlazada a GCC World, este
  // formulario comprueba la contraseña de la PLATAFORMA: sin freno sería un sitio cómodo
  // y discreto donde probarlas de mil en mil. Se cuenta por cuenta, no por IP, porque lo
  // que se protege es una cuenta concreta y las IP se cambian gratis.
  const cerradaHasta = cuenta?.bloqueadoHasta ?? null;
  if (cerradaHasta && cerradaHasta > new Date()) {
    const minutos = Math.max(1, Math.ceil((cerradaHasta.getTime() - Date.now()) / 60_000));
    return { error: `Demasiados intentos. Vuelve a probar en ${minutos} minuto(s).` };
  }
  // Cumplido el castigo, se empieza de cero. Si no, el contador seguiría en el tope y el
  // primer error de quien ya esperó sus 15 minutos le costaría otros 15.
  const fallosPrevios = cerradaHasta ? 0 : (cuenta?.intentosFallidos ?? 0);

  let vale = false;
  if (cuenta?.origen === 'GCC') {
    /**
     * ⚠️ SOLO SI LO ENLAZÓ GCC. Una cuenta de origen GCC comprueba la contraseña contra
     * `gcc_world.users`, así que existir no basta: tiene que haberla enlazado el equipo
     * (`enlazadoPor`). El administrador de un inquilino ya no puede crearlas —ver
     * `acciones/usuarios.ts`— y la base lo impide además por restricción; esto es el
     * tercer cerrojo, el que se comprueba en el momento de abrir la puerta.
     */
    if (cuenta.enlazadoPor) {
      // La contraseña NO está aquí: vive en GCC World y allí se comprueba. Así, cuando el
      // cliente la cambie en la plataforma, cambia también su entrada a este producto.
      const correo = cuenta.email || cuenta.usuario;
      vale = (await verificarCuentaGcc(correo, clave)) !== null;
    } else {
      // Se gasta el mismo tiempo que una comprobación de verdad: si se volviera antes,
      // el reloj diría cuáles son las cuentas enlazadas.
      await bcrypt.compare(clave, HASH_FALSO);
    }
  } else {
    // Se compara siempre, exista la cuenta o no, para no delatar por el tiempo de
    // respuesta cuáles existen.
    vale = await bcrypt.compare(clave, cuenta?.claveHash ?? HASH_FALSO);
  }

  if (!cuenta || !vale || !cuenta.activo) {
    // El intento se apunta en la cuenta que se quiso abrir. Si no existe no hay dónde
    // apuntarlo, y tampoco hace falta: no hay contraseña que adivinar.
    if (cuenta && !inquilino.soloLectura) await apuntarFallo(cuenta.id, fallosPrevios);
    return { error: 'Usuario o contraseña incorrectos.' };
  }

  // En un escaparate no se escribe NADA, ni siquiera la hora del último acceso: con
  // visitantes entrando a diario, esa columna sería lo único que cambiaría.
  if (!inquilino.soloLectura)
    await prisma.usuario.update({
      where: { id: cuenta.id },
      // Entrar bien borra el freno: los intentos que cuentan son los seguidos.
      data: { ultimoAcceso: new Date(), intentosFallidos: 0, bloqueadoHasta: null },
    });

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
