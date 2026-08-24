import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { leerSesionUsuario, type SesionUsuario } from '@/lib/sesion';
import { puede, type Capacidad } from '@/lib/permisos';

/**
 * EL ÚNICO SITIO donde se decide a qué inquilino pertenece una petición, si puede
 * entrar y si puede hacer lo que va a hacer. Ninguna página construye ese filtro
 * por su cuenta: el día que una lo olvide, un negocio vería los pedidos de otro.
 */

export function hoySinHora() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export type EstadoAcceso = 'ok' | 'suspendido' | 'sin-pago' | 'vencido';

/** LA PUERTA: sin la mensualidad al día, la aplicación no se abre. */
export function evaluarAcceso(inq: {
  estado: string;
  suscripcion: { estado: string; pagadoHasta: Date | null } | null;
}): EstadoAcceso {
  if (inq.estado === 'SUSPENDIDO') return 'suspendido';
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

/** Contexto de una página del negocio. Corta antes de devolver datos. */
export async function exigirContexto(slug: string, capacidad: Capacidad = 'ver') {
  const sesion = await leerSesionUsuario();
  if (!sesion || sesion.slug !== slug) redirect(`/${slug}/acceso`);

  const ctx = await cargarContexto(slug, sesion);
  if (!ctx) redirect(`/${slug}/acceso`);
  if (ctx.acceso !== 'ok') redirect(`/${slug}/suscripcion`);
  // A quien no le corresponde una pantalla se le manda a la SUYA, no a un error:
  // un cocinero que abre «Cobros» no se ha equivocado de aplicación.
  if (!puede(sesion.rol, capacidad)) redirect(`/${slug}/panel`);

  return ctx;
}

/** Igual, pero sin exigir mensualidad: la usa la pantalla de suscripción. */
export async function exigirSesionDelNegocio(slug: string) {
  const sesion = await leerSesionUsuario();
  if (!sesion || sesion.slug !== slug) redirect(`/${slug}/acceso`);
  const ctx = await cargarContexto(slug, sesion);
  if (!ctx) redirect(`/${slug}/acceso`);
  return ctx;
}

/** Contexto para leer desde una ruta de API: null en vez de redirigir. */
export async function contextoApi(slug: string, capacidad: Capacidad = 'ver') {
  const sesion = await leerSesionUsuario();
  if (!sesion || sesion.slug !== slug) return null;
  const ctx = await cargarContexto(slug, sesion);
  if (!ctx || ctx.acceso !== 'ok' || !puede(sesion.rol, capacidad)) return null;
  return ctx;
}

/**
 * Contexto para ESCRIBIR. Distingue tres negativas que no son la misma cosa —sin
 * sesión, sin permiso y negocio de escaparate— porque a quien está delante le
 * sirve saber cuál de las tres es. Toda acción que guarde algo pasa por aquí.
 */
export type PermisoEscritura = { ok: true; ctx: Contexto } | { ok: false; error: string };

export async function contextoEscritura(
  slug: string,
  capacidad: Capacidad,
): Promise<PermisoEscritura> {
  const ctx = await contextoApi(slug, capacidad);
  if (!ctx) return { ok: false, error: 'No tienes permiso para hacer este cambio.' };
  if (ctx.inquilino.soloLectura)
    return {
      ok: false,
      error:
        'Esto es una demostración: puedes recorrer la aplicación entera y abrir cualquier formulario, pero los cambios no se guardan para que los datos sigan aquí para el siguiente visitante.',
    };
  return { ok: true, ctx };
}
