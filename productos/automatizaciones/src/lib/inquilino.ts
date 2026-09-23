import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { leerSesionUsuario, type SesionUsuario } from '@/lib/sesion';
import type { Rol, TipoAutomatizacion } from '@/generated/prisma/enums';

/**
 * EL ÚNICO SITIO donde se decide a qué inquilino pertenece una petición, QUÉ PRODUCTOS
 * tiene contratados y si puede hacer lo que va a hacer. Ninguna página construye ese
 * filtro por su cuenta: el día que una lo olvide, un cliente vería las conversaciones de
 * otro —y aquí eso son conversaciones de WhatsApp con personas reales.
 *
 * ── ⭐ LO QUE SE VENDE ES EL TIPO DE FLUJO, NO LA APLICACIÓN ──────────────────────
 * Fernando lo corrigió el 2026-09-23: *«automatizaciones no es un producto como tal, sino
 * los tipos de flujos son los productos»*. Así que hay **tres productos** —Agente de IA,
 * Campañas de Correo y Campañas de WhatsApp— y esta aplicación es donde se usan los tres.
 *
 * Eso cambia la puerta de sitio: ya no se pregunta «¿este cliente está al día?» sino
 * **«¿este cliente tiene ESTE producto al día?»**. Un cliente puede tener el agente pagado
 * y las campañas no, y entonces ve conversaciones y no ve campañas — sin errores, sin
 * botones apagados: la sección sencillamente no está.
 *
 * ── LOS ROLES SÍ SON UNA ESCALERA ────────────────────────────────────────────────
 *   CONSULTA  — mira las conversaciones y los informes. No escribe.
 *   OPERADOR  — además atiende: toma una conversación, apaga el bot, contesta a mano,
 *               edita listas y lanza campañas.
 *   ADMIN     — además gobierna: conecta el número, crea usuarios y ve la suscripción.
 * Por eso no hay `lib/permisos.ts` con capacidades: basta con pedir «al menos X».
 */

export const PRODUCTOS = ['AGENTE_IA', 'CORREO', 'WHATSAPP'] as const;

export const NOMBRE_PRODUCTO: Record<TipoAutomatizacion, string> = {
  AGENTE_IA: 'Agente de IA',
  CORREO: 'Campañas de Correo',
  WHATSAPP: 'Campañas de WhatsApp',
};

const ESCALA: Record<Rol, number> = { CONSULTA: 0, OPERADOR: 1, ADMIN: 2 };

export function alMenos(rol: Rol, minimo: Rol) {
  return ESCALA[rol] >= ESCALA[minimo];
}

export function hoySinHora() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** `sin-contratar` es distinto de `sin-pago`: uno nunca lo compró, el otro no lo ha pagado. */
export type EstadoAcceso = 'ok' | 'suspendido' | 'sin-contratar' | 'sin-pago' | 'vencido';

type SuscripcionMinima = {
  producto: TipoAutomatizacion;
  estado: string;
  pagadoHasta: Date | null;
};

/**
 * LA PUERTA, para UN producto.
 *
 * ⚠️ `cortesia` pasa por encima de todo lo que no sea una suspensión. Es el acceso del
 * grupo: Fernando entra a su inquilino **sin suscripción y sin topes** (lo pidió así el
 * 2026-09-23), y por eso ni siquiera se mira si hay fila de suscripción.
 */
export function evaluarProducto(
  inq: { estado: string; cortesia?: boolean; suscripciones: SuscripcionMinima[] },
  producto: TipoAutomatizacion,
): EstadoAcceso {
  if (inq.estado === 'SUSPENDIDO') return 'suspendido';
  if (inq.cortesia) return 'ok';

  const s = inq.suscripciones.find((x) => x.producto === producto);
  if (!s) return 'sin-contratar';
  if (s.estado === 'CANCELADA') return 'suspendido';
  if (!s.pagadoHasta) return 'sin-pago';
  return s.pagadoHasta >= hoySinHora() ? 'ok' : 'vencido';
}

/** Los productos que este cliente puede usar ahora mismo. */
export function productosAbiertos(inq: {
  estado: string;
  cortesia?: boolean;
  suscripciones: SuscripcionMinima[];
}): TipoAutomatizacion[] {
  return PRODUCTOS.filter((p) => evaluarProducto(inq, p) === 'ok');
}

/**
 * EL TOPE DE CUENTAS con tres productos contratados.
 *
 * Las cuentas son del CLIENTE, no de un producto: la misma persona atiende el WhatsApp y
 * manda las campañas. Así que con varios planes contratados **manda el más generoso**, no
 * la suma (sumar regalaría cuentas por contratar productos) ni el menor (castigaría por
 * contratar de más). NULO en cualquiera de ellos = sin límite, y la cortesía tampoco topa.
 */
export function topeUsuarios(inq: {
  cortesia?: boolean;
  suscripciones: { estado: string; pagadoHasta: Date | null; producto: TipoAutomatizacion; plan: { maxUsuarios: number | null } }[];
  estado: string;
}): number | null {
  if (inq.cortesia) return null;
  const vigentes = inq.suscripciones.filter((s) => evaluarProducto(inq, s.producto) === 'ok');
  if (vigentes.length === 0) return 0;
  if (vigentes.some((s) => s.plan.maxUsuarios === null)) return null;
  return Math.max(...vigentes.map((s) => s.plan.maxUsuarios as number));
}

async function cargarContexto(slug: string, sesion: SesionUsuario) {
  const inquilino = await prisma.inquilino.findUnique({
    where: { id: sesion.inquilinoId },
    include: { suscripciones: { include: { plan: true } } },
  });
  if (!inquilino || inquilino.slug !== slug) return null;
  return { inquilino, sesion, abiertos: productosAbiertos(inquilino) };
}

export type Contexto = NonNullable<Awaited<ReturnType<typeof cargarContexto>>>;

/**
 * Contexto de una página del cliente. Corta antes de devolver datos.
 *
 * `producto` dice a cuál pertenece la pantalla. Sin él, la pantalla es transversal
 * (panel, usuarios, configuración) y basta con tener **algo** contratado: un cliente sin
 * ningún producto al día no tiene nada que hacer dentro.
 */
export async function exigirContexto(
  slug: string,
  minimo: Rol = 'CONSULTA',
  producto?: TipoAutomatizacion,
) {
  const sesion = await leerSesionUsuario();
  if (!sesion || sesion.slug !== slug) redirect(`/${slug}/acceso`);

  const ctx = await cargarContexto(slug, sesion);
  if (!ctx) redirect(`/${slug}/acceso`);

  // ⚠️ La suscripción se mira ANTES que el rol: si no, a un operador con todo vencido se
  // le mandaría al panel, que también está cerrado.
  const puedeEntrar = producto
    ? evaluarProducto(ctx.inquilino, producto) === 'ok'
    : ctx.abiertos.length > 0;
  if (!puedeEntrar) redirect(`/${slug}/suscripcion`);

  if (!alMenos(sesion.rol, minimo)) redirect(`/${slug}/panel`);

  return ctx;
}

/**
 * Igual, pero sin exigir nada contratado. La usan dos pantallas y solo dos:
 *  · `/suscripcion` — donde se ve qué hay contratado y qué falta;
 *  · la salida de sesión.
 * Si la usara una tercera, la puerta dejaría de ser una puerta.
 */
export async function exigirSesionDelCliente(slug: string) {
  const sesion = await leerSesionUsuario();
  if (!sesion || sesion.slug !== slug) redirect(`/${slug}/acceso`);
  const ctx = await cargarContexto(slug, sesion);
  if (!ctx) redirect(`/${slug}/acceso`);
  return ctx;
}

/** Contexto para leer desde una ruta de API: null en vez de redirigir. */
export async function contextoApi(
  slug: string,
  minimo: Rol = 'CONSULTA',
  producto?: TipoAutomatizacion,
) {
  const sesion = await leerSesionUsuario();
  if (!sesion || sesion.slug !== slug) return null;
  const ctx = await cargarContexto(slug, sesion);
  if (!ctx) return null;
  const puedeEntrar = producto
    ? evaluarProducto(ctx.inquilino, producto) === 'ok'
    : ctx.abiertos.length > 0;
  if (!puedeEntrar || !alMenos(sesion.rol, minimo)) return null;
  return ctx;
}

/**
 * Contexto para ESCRIBIR. Distingue tres negativas que no son la misma cosa —sin sesión o
 * sin permiso, producto no contratado, y cliente de escaparate— porque a quien está
 * delante le sirve saber cuál de las tres es. Toda acción que guarde algo pasa por aquí.
 */
export type PermisoEscritura = { ok: true; ctx: Contexto } | { ok: false; error: string };

export async function contextoEscritura(
  slug: string,
  minimo: Rol = 'OPERADOR',
  producto?: TipoAutomatizacion,
): Promise<PermisoEscritura> {
  const ctx = await contextoApi(slug, minimo, producto);
  if (!ctx) {
    // Si la sesión vale pero el producto no está al día, se dice ESO, no «no tienes
    // permiso»: son problemas distintos y se arreglan en sitios distintos.
    const suelto = await contextoApi(slug, minimo);
    if (suelto && producto)
      return {
        ok: false,
        error: `Tu cuenta no tiene «${NOMBRE_PRODUCTO[producto]}» al día. Míralo en Suscripción.`,
      };
    return { ok: false, error: 'No tienes permiso para hacer este cambio.' };
  }
  if (ctx.inquilino.soloLectura)
    return {
      ok: false,
      error:
        'Esto es una demostración: puedes recorrer la aplicación entera y abrir cualquier formulario, pero los cambios no se guardan para que los datos sigan aquí para el siguiente visitante.',
    };
  return { ok: true, ctx };
}
