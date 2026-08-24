import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { leerSesionUsuario, alMenos, type SesionUsuario } from '@/lib/sesion';
import type { RolUsuario } from '@/generated/prisma/enums';

/**
 * EL ÚNICO SITIO donde se decide a qué inquilino pertenece una petición y si
 * puede entrar. Ninguna página construye ese filtro por su cuenta: si lo hiciera,
 * el día que una lo olvide un hotel vería los datos de otro.
 */

export type Contexto = Awaited<ReturnType<typeof cargarContexto>>;

/** Hoy a medianoche, para comparar con una columna `date` sin arrastrar la hora. */
export function hoySinHora() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export type EstadoAcceso = 'ok' | 'suspendido' | 'sin-pago' | 'vencido';

/**
 * LA PUERTA. Fernando: «cada cliente que adquiera este producto y tenga pagada su
 * mensualidad podrá acceder a la aplicación». Así que esto no es un informe que
 * se pinta en una pantalla: es lo que decide si la aplicación se abre.
 */
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

/**
 * Contexto de una página del hotel. Si no hay sesión, si la sesión es de OTRO
 * hotel o si la mensualidad no está al día, corta aquí y no devuelve datos.
 */
export async function exigirContexto(slug: string, minimo: RolUsuario = 'CONSULTA') {
  const sesion = await leerSesionUsuario();
  if (!sesion || sesion.slug !== slug) redirect(`/${slug}/acceso`);

  const ctx = await cargarContexto(slug, sesion);
  if (!ctx) redirect(`/${slug}/acceso`);
  if (ctx.acceso !== 'ok') redirect(`/${slug}/suscripcion`);
  if (!alMenos(sesion.rol, minimo)) redirect(`/${slug}/panel`);

  return ctx;
}

/** Igual, pero sin exigir mensualidad: la usa la propia pantalla de suscripción. */
export async function exigirSesionDelHotel(slug: string) {
  const sesion = await leerSesionUsuario();
  if (!sesion || sesion.slug !== slug) redirect(`/${slug}/acceso`);
  const ctx = await cargarContexto(slug, sesion);
  if (!ctx) redirect(`/${slug}/acceso`);
  return ctx;
}

/**
 * Contexto para ESCRIBIR. Distingue tres negativas que no son la misma cosa —sin
 * sesión, sin permiso, y alojamiento de escaparate— porque a quien está delante
 * le sirve saber cuál de las tres es.
 *
 * Toda acción que guarde algo del inquilino pasa por aquí. Es el único sitio donde
 * se decide, para que añadir una pantalla nueva no signifique acordarse de una
 * comprobación.
 */
export type PermisoEscritura =
  | { ok: true; ctx: NonNullable<Awaited<ReturnType<typeof contextoApi>>> }
  | { ok: false; error: string };

export async function contextoEscritura(
  slug: string,
  minimo: RolUsuario = 'GERENTE',
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

/** Contexto para las rutas de API: devuelve null en vez de redirigir. */
export async function contextoApi(slug: string, minimo: RolUsuario = 'CONSULTA') {
  const sesion = await leerSesionUsuario();
  if (!sesion || sesion.slug !== slug) return null;
  const ctx = await cargarContexto(slug, sesion);
  if (!ctx || ctx.acceso !== 'ok' || !alMenos(sesion.rol, minimo)) return null;
  return ctx;
}
