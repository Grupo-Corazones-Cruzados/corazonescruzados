'use server';

import bcrypt from 'bcryptjs';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { evaluarAcceso } from '@/lib/inquilino';
import { verificarCuentaGcc } from '@/lib/cuentaGcc';
import {
  reconocer, claveGccCorrecta, enviarCodigo, codigoCorrecto,
  passkeyIniciar, passkeyTerminar,
} from '@/lib/identidadGcc';
import {
  abrirSesionUsuario,
  abrirSesionOperador,
  cerrarSesion,
  abrirPasoDos,
  leerPasoDos,
  cerrarPasoDos,
  COOKIE_GCC,
  COOKIE_SESION,
} from '@/lib/sesion';

/**
 * Lo que puede pasar al escribir usuario y contraseña. `segundoPaso` NO es una sesión:
 * dice que la contraseña era correcta y que falta la segunda prueba.
 */
export type ResultadoAcceso = {
  error?: string;
  segundoPaso?: { email: string; correoTapado: string; tienePasskey: boolean };
};

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

  /**
   * ⭐ ¿ES UN CLIENTE DE GCC WORLD? SE DESCUBRE, NO SE ELIGE (Fernando, 2026-09-24).
   *
   * Se pregunta por el CORREO a la plataforma. Si ese correo es de una cuenta de cliente
   * de GCC World, entonces —sea la cuenta de origen GCC o una que creó el administrador
   * del inquilino— manda la contraseña de GCC World y **el segundo paso es obligatorio**:
   * «siendo una sola contraseña su acceso».
   *
   * Nadie marca esto en un formulario. Esa fue exactamente la puerta que se cerró el
   * 2026-09-24 por la mañana: cuando el cliente podía declarar que una cuenta era de GCC
   * World, tenía dónde probar contraseñas de la plataforma. Descubrirlo por el correo no
   * da esa capacidad — la cuenta ya existía antes y no la creó él.
   */
  const correoDeLaCuenta = cuenta?.email || (escrito.includes('@') ? escrito : null);
  const gcc = cuenta && correoDeLaCuenta ? await reconocer(correoDeLaCuenta) : null;

  // Una cuenta enlazada a mano por el equipo sigue entrando por GCC World aunque su
  // correo no tenga ficha de cliente (el caso del revisor de Meta, por ejemplo).
  const porGccWorld = Boolean(gcc?.esClienteGcc) || Boolean(cuenta?.origen === 'GCC' && cuenta.enlazadoPor);

  let vale = false;
  let segundoPaso: ResultadoAcceso['segundoPaso'] | null = null;

  if (cuenta && porGccWorld && correoDeLaCuenta) {
    if (gcc?.esClienteGcc) {
      // Cliente de GCC World: su contraseña la comprueba la plataforma, que además dice
      // qué segundos pasos tiene disponibles.
      const r = await claveGccCorrecta(correoDeLaCuenta, clave);
      if (r) {
        vale = true;
        segundoPaso = { email: correoDeLaCuenta, correoTapado: r.correoTapado, tienePasskey: r.tienePasskey };
      }
    } else {
      // Enlazada por el equipo pero sin ficha de cliente: se comprueba igual contra
      // `gcc_world.users`, como se venía haciendo.
      vale = (await verificarCuentaGcc(correoDeLaCuenta, clave)) !== null;
      if (vale)
        segundoPaso = {
          email: correoDeLaCuenta,
          correoTapado: gcc?.correoTapado ?? correoDeLaCuenta,
          tienePasskey: false,
        };
    }
  } else if (cuenta?.origen === 'GCC') {
    // Origen GCC sin enlace del equipo: no entra. Se gasta el mismo tiempo para que el
    // reloj no diga cuáles están enlazadas.
    await bcrypt.compare(clave, HASH_FALSO);
  } else {
    // Cuenta del producto y sin cuenta de cliente en GCC World: su contraseña vive aquí.
    // Se compara siempre, exista o no, para no delatar por el tiempo cuáles existen.
    vale = await bcrypt.compare(clave, cuenta?.claveHash ?? HASH_FALSO);
  }

  if (!cuenta || !vale || !cuenta.activo) {
    // El intento se apunta en la cuenta que se quiso abrir. Si no existe no hay dónde
    // apuntarlo, y tampoco hace falta: no hay contraseña que adivinar.
    if (cuenta && !inquilino.soloLectura) await apuntarFallo(cuenta.id, fallosPrevios);
    return { error: 'Usuario o contraseña incorrectos.' };
  }

  /**
   * ⚠️ AQUÍ TODAVÍA NO HAY SESIÓN. La contraseña era correcta, nada más. Se deja el
   * testigo firmado del primer paso y se le pide a la pantalla el segundo — passkey o
   * código—, que es lo que Fernando quiere para todo cliente de GCC World.
   */
  if (segundoPaso) {
    await abrirPasoDos({
      uid: cuenta.id,
      inquilinoId: inquilino.id,
      slug: inquilino.slug,
      email: segundoPaso.email,
    });
    return { segundoPaso };
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

// ── EL SEGUNDO PASO ──────────────────────────────────────────────────────────
//
// Las dos opciones son las MISMAS que en la pantalla de GCC World, y a propósito: quien
// ya entra a la plataforma no tiene que aprender nada nuevo para entrar a un producto.
//
// ⚠️ Todas empiezan igual: leyendo el testigo del primer paso. Sin él no hay nada que
// completar —y sobre todo, no se puede entrar solo con un código o una passkey sin haber
// pasado por la contraseña—.

/** Quién pasó el primer paso, junto con su inquilino. */
async function continuar(slug: string) {
  const p = await leerPasoDos();
  if (!p || p.slug !== slug) return null;
  const inquilino = await prisma.inquilino.findUnique({
    where: { id: p.inquilinoId },
    include: { suscripcion: true },
  });
  const cuenta = await prisma.usuario.findFirst({
    where: { id: p.uid, inquilinoId: p.inquilinoId, activo: true },
  });
  if (!inquilino || !cuenta || inquilino.slug !== slug) return null;
  return { p, inquilino, cuenta };
}

/** Abre la sesión de verdad. Solo se llega aquí con los dos pasos hechos. */
async function terminarDeEntrar(
  inquilino: { id: number; slug: string; soloLectura: boolean },
  cuenta: { id: number; nombre: string; rol: 'ADMIN' | 'OPERADOR' | 'CONSULTA' },
  evaluable: Parameters<typeof evaluarAcceso>[0],
) {
  if (!inquilino.soloLectura)
    await prisma.usuario.update({
      where: { id: cuenta.id },
      data: { ultimoAcceso: new Date(), intentosFallidos: 0, bloqueadoHasta: null },
    });
  await cerrarPasoDos();
  await abrirSesionUsuario({
    uid: cuenta.id,
    inquilinoId: inquilino.id,
    slug: inquilino.slug,
    nombre: cuenta.nombre,
    rol: cuenta.rol,
  });
  redirect(evaluarAcceso(evaluable) === 'ok' ? `/${inquilino.slug}/panel` : `/${inquilino.slug}/suscripcion`);
}

/** Pide que le manden el código de seis cifras al correo. */
export async function pedirCodigo(slug: string, clave: string): Promise<ResultadoAcceso> {
  const c = await continuar(slug);
  if (!c) return { error: 'La sesión de acceso caducó. Vuelve a escribir tu contraseña.' };
  // Se vuelve a exigir la contraseña para mandar el correo: así el testigo por sí solo no
  // sirve para llenarle el buzón a nadie.
  const enviado = await enviarCodigo(c.p.email, clave);
  if (!enviado) return { error: 'No se pudo enviar el código. Inténtalo otra vez.' };
  return { segundoPaso: { email: c.p.email, correoTapado: enviado, tienePasskey: false } };
}

/** Segundo paso con el código del correo. */
export async function entrarConCodigo(slug: string, codigo: string): Promise<ResultadoAcceso> {
  const c = await continuar(slug);
  if (!c) return { error: 'La sesión de acceso caducó. Vuelve a escribir tu contraseña.' };

  if (!(await codigoCorrecto(c.p.email, codigo))) {
    // Un código equivocado cuenta como intento fallido: si no, el segundo paso sería el
    // único sitio del acceso sin freno, y es de seis cifras.
    if (!c.inquilino.soloLectura) await apuntarFallo(c.cuenta.id, c.cuenta.intentosFallidos);
    return { error: 'Código incorrecto o caducado.' };
  }
  await terminarDeEntrar(c.inquilino, c.cuenta, c.inquilino);
  return {};
}

/** Segundo paso con passkey: lo que el navegador necesita para pedirla. */
export async function passkeyOpciones(slug: string, origen: string) {
  const c = await continuar(slug);
  if (!c) return null;
  return passkeyIniciar(c.p.email, origen);
}

/** Segundo paso con passkey: comprobación. */
export async function entrarConPasskey(
  slug: string,
  origen: string,
  credencial: unknown,
): Promise<ResultadoAcceso> {
  const c = await continuar(slug);
  if (!c) return { error: 'La sesión de acceso caducó. Vuelve a escribir tu contraseña.' };

  if (!(await passkeyTerminar(c.p.email, origen, credencial))) {
    if (!c.inquilino.soloLectura) await apuntarFallo(c.cuenta.id, c.cuenta.intentosFallidos);
    return { error: 'No se pudo comprobar la passkey.' };
  }
  await terminarDeEntrar(c.inquilino, c.cuenta, c.inquilino);
  return {};
}

export async function salir(slug: string) {
  await cerrarSesion(COOKIE_SESION);
  await cerrarPasoDos();
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
