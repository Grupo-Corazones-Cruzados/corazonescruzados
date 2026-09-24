import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { leerSesionUsuario, type SesionUsuario } from '@/lib/sesion';
import type { Rol, TipoAutomatizacion } from '@/generated/prisma/enums';
import { estadoSuscripcionGcc, accesoSegunGcc, type EstadoSuscripcionGcc } from '@/lib/suscripcionGcc';

/**
 * EL ÚNICO SITIO donde se decide a qué inquilino pertenece una petición, QUÉ PRODUCTOS
 * tiene contratados y si puede hacer lo que va a hacer. Ninguna página construye ese
 * filtro por su cuenta: el día que una lo olvide, un cliente vería las conversaciones de
 * otro —y aquí eso son conversaciones de WhatsApp con personas reales.
 *
 * ── ⭐ SE VENDE UNO, SE USAN TRES ────────────────────────────────────────────────
 * Fernando lo fijó el 2026-09-23: *«déjalo a $5 dólares mensuales este producto nuevo para
 * que pueda acceder a las 3 cosas […] el producto total vale $5 mensuales»*. Así que la
 * puerta es **una sola**: o el cliente está al día, o no.
 *
 * Pero dentro siguen siendo **tres cosas distintas** —agente de IA, campañas de correo y
 * campañas de WhatsApp—, y qué secciones ve un cliente depende de **qué tiene montado**,
 * no de qué pagó. Quien solo tiene un agente no necesita ver «Campañas»: no es que no
 * pueda, es que no tiene ninguna. Enseñar una sección vacía de algo que nunca se ha usado
 * no informa, ocupa.
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

export type EstadoAcceso = 'ok' | 'suspendido' | 'sin-pago' | 'vencido';

/**
 * LA PUERTA. Sin la mensualidad al día, la aplicación no se abre.
 *
 * ⚠️ `cortesia` pasa por encima de todo lo que no sea una suspensión. Es el acceso del
 * grupo: Fernando entra a su inquilino **sin suscripción y sin topes** (lo pidió así el
 * 2026-09-23), y por eso ni siquiera se mira la fecha de pago.
 */
export function evaluarAcceso(inq: {
  estado: string;
  cortesia?: boolean;
  suscripcion: { estado: string; pagadoHasta: Date | null } | null;
}): EstadoAcceso {
  if (inq.estado === 'SUSPENDIDO') return 'suspendido';
  if (inq.cortesia) return 'ok';
  const s = inq.suscripcion;
  if (!s || s.estado === 'CANCELADA') return 'suspendido';
  if (!s.pagadoHasta) return 'sin-pago';
  return s.pagadoHasta >= hoySinHora() ? 'ok' : 'vencido';
}

/**
 * EL TOPE DE CUENTAS. Lo dice el plan; la cortesía no topa.
 * NULO es «sin límite», NO «cero» — es la confusión que deja a un cliente sin poder crear
 * nada, así que tiene su propia comprobación.
 */
export function topeUsuarios(inq: {
  cortesia?: boolean;
  suscripcion: { plan: { maxUsuarios: number | null } } | null;
}): number | null {
  if (inq.cortesia) return null;
  return inq.suscripcion?.plan.maxUsuarios ?? null;
}

async function cargarContexto(slug: string, sesion: SesionUsuario) {
  const inquilino = await prisma.inquilino.findUnique({
    where: { id: sesion.inquilinoId },
    include: { suscripcion: { include: { plan: true } } },
  });
  if (!inquilino || inquilino.slug !== slug) return null;

  /**
   * ⭐ SI EL CLIENTE ESTÁ ENLAZADO A UNA SUSCRIPCIÓN DE LA PLATAFORMA, MANDA ELLA.
   *
   * Es lo que hace que «pagar aquí o en el módulo de suscripciones sea lo mismo»
   * (Fernando, 2026-09-23): no hay dos estados que sincronizar, hay uno que se lee. Un
   * pago registrado en la plataforma abre la puerta aquí en el acto, sin que nadie tenga
   * que acordarse de copiar nada.
   *
   * Y el mes de espera vive ahí: se bloquea **un mes después** del último periodo pagado,
   * no el día del corte.
   */
  const suscripcionGcc: EstadoSuscripcionGcc | null = inquilino.gccSuscripcionId
    ? await estadoSuscripcionGcc(inquilino.gccSuscripcionId)
    : null;

  // QUÉ TIENE MONTADO, que es lo que decide las secciones. No es lo que pagó —el producto
  // se vende entero— sino lo que ha llegado a usar: un cliente con solo un agente no
  // necesita ver «Campañas», porque no tiene ninguna.
  const tipos = await prisma.automatizacion.findMany({
    where: { inquilinoId: inquilino.id },
    select: { tipo: true },
    distinct: ['tipo'],
  });
  return { inquilino, sesion, montados: tipos.map((t) => t.tipo), suscripcionGcc };
}

/**
 * La puerta, teniendo en cuenta de dónde viene la verdad.
 *
 * La cortesía y la suspensión siguen mandando sobre todo lo demás: son decisiones de GCC,
 * no del estado de un cobro.
 */
export function accesoDelContexto(ctx: {
  inquilino: { estado: string; cortesia: boolean; suscripcion: { estado: string; pagadoHasta: Date | null } | null };
  suscripcionGcc: EstadoSuscripcionGcc | null;
}): EstadoAcceso {
  if (ctx.inquilino.estado === 'SUSPENDIDO') return 'suspendido';
  if (ctx.inquilino.cortesia) return 'ok';
  if (ctx.suscripcionGcc) return accesoSegunGcc(ctx.suscripcionGcc);
  return evaluarAcceso(ctx.inquilino);
}

export type Contexto = NonNullable<Awaited<ReturnType<typeof cargarContexto>>>;

/**
 * Contexto de una página del cliente. Corta antes de devolver datos.
 *
 */
export async function exigirContexto(slug: string, minimo: Rol = 'CONSULTA') {
  const sesion = await leerSesionUsuario();
  if (!sesion || sesion.slug !== slug) redirect(`/${slug}/acceso`);

  const ctx = await cargarContexto(slug, sesion);
  if (!ctx) redirect(`/${slug}/acceso`);

  // ⚠️ La suscripción se mira ANTES que el rol: si no, a un operador con la mensualidad
  // vencida se le mandaría al panel, que también está cerrado.
  /**
   * ⚠️ AQUÍ NO SE PUEDE MANDAR A `/configuracion`. Esa pantalla vive dentro de `(app)`, así
   * que exige acceso —y además ser ADMIN—: un cliente bloqueado entraría en un bucle
   * infinito entre las dos. `/suscripcion` está FUERA del grupo a propósito: es la única
   * que se puede ver sin tener nada al día, porque es donde se arregla justamente eso.
   */
  if (accesoDelContexto(ctx) !== 'ok') redirect(`/${slug}/suscripcion`);
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
export async function contextoApi(slug: string, minimo: Rol = 'CONSULTA') {
  const sesion = await leerSesionUsuario();
  if (!sesion || sesion.slug !== slug) return null;
  const ctx = await cargarContexto(slug, sesion);
  if (!ctx || accesoDelContexto(ctx) !== 'ok' || !alMenos(sesion.rol, minimo)) return null;
  return ctx;
}

/**
 * Contexto para ESCRIBIR. Distingue dos negativas que no son la misma cosa —sin sesión o
 * sin permiso, y cliente de escaparate— porque a quien está delante le sirve saber cuál de
 * las dos es. Toda acción que guarde algo pasa por aquí.
 */
export type PermisoEscritura = { ok: true; ctx: Contexto } | { ok: false; error: string };

export async function contextoEscritura(
  slug: string,
  minimo: Rol = 'OPERADOR',
): Promise<PermisoEscritura> {
  const ctx = await contextoApi(slug, minimo);
  if (!ctx) return { ok: false, error: 'No tienes permiso para hacer este cambio.' };
  if (ctx.inquilino.soloLectura)
    return {
      ok: false,
      error:
        'Esto es una demostración: puedes recorrer la aplicación entera y abrir cualquier formulario, pero los cambios no se guardan para que los datos sigan aquí para el siguiente visitante.',
    };
  return { ok: true, ctx };
}
