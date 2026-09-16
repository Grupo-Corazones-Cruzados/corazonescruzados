import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { leerSesionUsuario, type SesionUsuario } from '@/lib/sesion';
import { puede, type Capacidad, INICIO_DE_ROL } from '@/lib/permisos';

/**
 * EL ÚNICO SITIO donde se decide a qué inquilino pertenece una petición, si puede
 * entrar y si puede hacer lo que va a hacer. Ninguna página construye ese filtro
 * por su cuenta: el día que una lo olvide, una institución vería las
 * planificaciones de otra.
 */

export function hoySinHora() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export type EstadoAcceso = 'ok' | 'suspendido' | 'sin-pago' | 'vencido';

/**
 * LA PUERTA: sin la mensualidad al día, la aplicación no se abre.
 * Salvo el inquilino del grupo (`cortesia`): su acceso es completo y no pasa por
 * la suscripción (Fernando, 2026-09-16). Suspenderlo sí lo cierra.
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

async function cargarInquilino(slug: string, sesion: SesionUsuario) {
  const inquilino = await prisma.inquilino.findUnique({
    where: { id: sesion.inquilinoId },
    include: { suscripcion: { include: { plan: true } } },
  });
  if (!inquilino || inquilino.slug !== slug) return null;
  return { inquilino, acceso: evaluarAcceso(inquilino) };
}

export type Inquilino = NonNullable<Awaited<ReturnType<typeof cargarInquilino>>>['inquilino'];
export type Contexto = { inquilino: Inquilino; sesion: SesionUsuario; acceso: EstadoAcceso };

/** Contexto de una página. Corta antes de devolver datos. */
export async function exigirContexto(slug: string, capacidad: Capacidad = 'ver'): Promise<Contexto> {
  const sesion = await leerSesionUsuario();
  if (!sesion || sesion.slug !== slug) redirect(`/${slug}/acceso`);

  const cargado = await cargarInquilino(slug, sesion);
  if (!cargado) redirect(`/${slug}/acceso`);
  if (cargado.acceso !== 'ok') redirect(`/${slug}/suscripcion`);
  // A quien no le corresponde una pantalla se le manda a la SUYA, no a un error.
  if (!puede(sesion.rol, capacidad)) redirect(`/${slug}/${INICIO_DE_ROL[sesion.rol]}`);

  return { ...cargado, sesion };
}

/** Igual, pero sin exigir mensualidad: la usa la pantalla de suscripción. */
export async function exigirSesionDeLaInstitucion(slug: string) {
  const sesion = await leerSesionUsuario();
  if (!sesion || sesion.slug !== slug) redirect(`/${slug}/acceso`);
  const cargado = await cargarInquilino(slug, sesion);
  if (!cargado) redirect(`/${slug}/acceso`);
  return { ...cargado, sesion };
}

/** Contexto para leer desde una ruta de API: null en vez de redirigir. */
export async function contextoApi(slug: string, capacidad: Capacidad = 'ver'): Promise<Contexto | null> {
  const sesion = await leerSesionUsuario();
  if (!sesion || sesion.slug !== slug) return null;
  const cargado = await cargarInquilino(slug, sesion);
  if (!cargado || cargado.acceso !== 'ok' || !puede(sesion.rol, capacidad)) return null;
  return { ...cargado, sesion };
}

/**
 * Contexto para ESCRIBIR. Distingue tres negativas —sin sesión, sin permiso y
 * escaparate— porque a quien está delante le sirve saber cuál. Toda acción que
 * guarde algo pasa por aquí.
 */
export type PermisoEscritura = { ok: true; ctx: Contexto } | { ok: false; error: string };

const MENSAJE_ESCAPARATE =
  'Esto es una demostración: puedes recorrer la aplicación entera y abrir cualquier formulario, pero los cambios no se guardan para que los datos sigan aquí para el siguiente visitante.';

export async function contextoEscritura(slug: string, capacidad: Capacidad): Promise<PermisoEscritura> {
  const ctx = await contextoApi(slug, capacidad);
  if (!ctx) return { ok: false, error: 'No tienes permiso para hacer este cambio.' };
  if (ctx.inquilino.soloLectura) return { ok: false, error: MENSAJE_ESCAPARATE };
  return { ok: true, ctx };
}

/**
 * ¿Puede esta sesión CAMBIAR esta planificación? La ve cualquiera de la
 * institución; la cambia su dueño o el administrador. La regla vive aquí, en un
 * solo sitio, para que generar, configurar y borrar digan lo mismo.
 */
export function esDuenoOAdmin(sesion: SesionUsuario, planificacion: { usuarioId: number }) {
  return sesion.rol === 'ADMIN' || planificacion.usuarioId === sesion.uid;
}
