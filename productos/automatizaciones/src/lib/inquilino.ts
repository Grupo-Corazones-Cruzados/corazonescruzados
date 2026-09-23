import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { leerSesionUsuario, type SesionUsuario } from '@/lib/sesion';
import type { Rol } from '@/generated/prisma/enums';

/**
 * EL ÚNICO SITIO donde se decide a qué inquilino pertenece una petición, si puede
 * entrar y si puede hacer lo que va a hacer. Ninguna página construye ese filtro por
 * su cuenta: el día que una lo olvide, un cliente vería las conversaciones de otro —y
 * aquí eso son conversaciones de WhatsApp con personas reales.
 *
 * ── LOS ROLES AQUÍ SÍ SON UNA ESCALERA ───────────────────────────────────────────
 * A diferencia de Pedidos (donde un cocinero no es un mesero con menos permisos), en
 * Automatizaciones los tres papeles se ordenan de verdad:
 *
 *   CONSULTA  — mira las conversaciones y los informes. No escribe.
 *   OPERADOR  — además atiende: toma una conversación, apaga el bot, contesta a mano,
 *               edita listas y lanza campañas. Es el trabajo del día a día.
 *   ADMIN     — además gobierna: conecta el número, cambia las instrucciones del
 *               agente, crea usuarios y gestiona la suscripción.
 *
 * Por eso no hay `lib/permisos.ts` con capacidades: basta con pedir «al menos X».
 */

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

/** LA PUERTA: sin la mensualidad al día, la aplicación no se abre. */
export function evaluarAcceso(inq: {
  estado: string;
  /** Acceso del grupo: completo, sin pasar por la suscripción. */
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

async function cargarContexto(slug: string, sesion: SesionUsuario) {
  const inquilino = await prisma.inquilino.findUnique({
    where: { id: sesion.inquilinoId },
    include: { suscripcion: { include: { plan: true } } },
  });
  if (!inquilino || inquilino.slug !== slug) return null;
  return { inquilino, sesion, acceso: evaluarAcceso(inquilino) };
}

export type Contexto = NonNullable<Awaited<ReturnType<typeof cargarContexto>>>;

/** Contexto de una página del cliente. Corta antes de devolver datos. */
export async function exigirContexto(slug: string, minimo: Rol = 'CONSULTA') {
  const sesion = await leerSesionUsuario();
  if (!sesion || sesion.slug !== slug) redirect(`/${slug}/acceso`);

  const ctx = await cargarContexto(slug, sesion);
  if (!ctx) redirect(`/${slug}/acceso`);
  // ⚠️ La suscripción se mira ANTES que el rol: si no, a un operador con la
  // mensualidad vencida se le mandaría al panel, que también está cerrado.
  if (ctx.acceso !== 'ok') redirect(`/${slug}/suscripcion`);
  // A quien no le corresponde una pantalla se le manda a la SUYA, no a un error.
  if (!alMenos(sesion.rol, minimo)) redirect(`/${slug}/panel`);

  return ctx;
}

/**
 * Igual, pero sin exigir mensualidad. La usan dos pantallas y solo dos:
 *  · `/suscripcion` — donde se ve y se arregla el impago;
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
  if (!ctx || ctx.acceso !== 'ok' || !alMenos(sesion.rol, minimo)) return null;
  return ctx;
}

/**
 * Contexto para ESCRIBIR. Distingue tres negativas que no son la misma cosa —sin
 * sesión, sin permiso y cliente de escaparate— porque a quien está delante le sirve
 * saber cuál de las tres es. Toda acción que guarde algo pasa por aquí.
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
