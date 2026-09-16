import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import {
  leerSesionUsuario,
  type SesionCliente,
  type SesionPersonal,
  type SesionUsuario,
} from '@/lib/sesion';
import { puede, type Capacidad, INICIO_DE_ROL } from '@/lib/permisos';

/**
 * EL ÚNICO SITIO donde se decide a qué inquilino pertenece una petición, si puede
 * entrar y si puede hacer lo que va a hacer. Ninguna página construye ese filtro
 * por su cuenta: el día que una lo olvide, un negocio vería los clientes de otro.
 *
 * Hay DOS puertas porque hay dos clases de cuenta: el personal (`exigirContexto`)
 * y el cliente final (`exigirContextoCliente`). Un cliente que escribe una
 * dirección del personal se devuelve a SU portal, y al revés: no se ha equivocado
 * de aplicación, solo de puerta.
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
  /** Acceso del grupo (Fernando, 2026-09-16): completo, sin pasar por la suscripción. */
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
export type Contexto = { inquilino: Inquilino; sesion: SesionPersonal; acceso: EstadoAcceso };
export type ContextoCliente = {
  inquilino: Inquilino;
  sesion: SesionCliente;
  acceso: EstadoAcceso;
  cliente: NonNullable<Awaited<ReturnType<typeof cargarCliente>>>;
};

/** El cliente de la sesión, comprobado contra la base: sigue existiendo y sigue activo. */
async function cargarCliente(sesion: SesionCliente) {
  const c = await prisma.cliente.findFirst({
    where: { id: sesion.cid, inquilinoId: sesion.inquilinoId, estado: 'ACTIVO' },
  });
  return c;
}

// ── Personal ────────────────────────────────────────────────────────────────

/** Contexto de una página del personal. Corta antes de devolver datos. */
export async function exigirContexto(slug: string, capacidad: Capacidad = 'ver'): Promise<Contexto> {
  const sesion = await leerSesionUsuario();
  if (!sesion || sesion.slug !== slug) redirect(`/${slug}/acceso`);
  if (sesion.tipo === 'cliente') redirect(`/${slug}/mi-servicio`);

  const cargado = await cargarInquilino(slug, sesion);
  if (!cargado) redirect(`/${slug}/acceso`);
  if (cargado.acceso !== 'ok') redirect(`/${slug}/suscripcion`);
  // A quien no le corresponde una pantalla se le manda a la SUYA, no a un error.
  if (!puede(sesion.rol, capacidad)) redirect(`/${slug}/${INICIO_DE_ROL[sesion.rol]}`);

  return { ...cargado, sesion };
}

/** Igual, pero sin exigir mensualidad: la usa la pantalla de suscripción. */
export async function exigirSesionDelNegocio(slug: string) {
  const sesion = await leerSesionUsuario();
  if (!sesion || sesion.slug !== slug) redirect(`/${slug}/acceso`);
  const cargado = await cargarInquilino(slug, sesion);
  if (!cargado) redirect(`/${slug}/acceso`);
  return { ...cargado, sesion };
}

/** Contexto del personal para leer desde una ruta de API: null en vez de redirigir. */
export async function contextoApi(slug: string, capacidad: Capacidad = 'ver'): Promise<Contexto | null> {
  const sesion = await leerSesionUsuario();
  if (!sesion || sesion.slug !== slug || sesion.tipo !== 'personal') return null;
  const cargado = await cargarInquilino(slug, sesion);
  if (!cargado || cargado.acceso !== 'ok' || !puede(sesion.rol, capacidad)) return null;
  return { ...cargado, sesion };
}

/**
 * Contexto del personal para ESCRIBIR. Distingue tres negativas —sin sesión, sin
 * permiso y negocio de escaparate— porque a quien está delante le sirve saber cuál.
 * Toda acción del personal que guarde algo pasa por aquí.
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

// ── Cliente final (portal) ──────────────────────────────────────────────────

/** Contexto de una página del portal del cliente. */
export async function exigirContextoCliente(slug: string): Promise<ContextoCliente> {
  const sesion = await leerSesionUsuario();
  if (!sesion || sesion.slug !== slug) redirect(`/${slug}/acceso`);
  if (sesion.tipo === 'personal') redirect(`/${slug}/${INICIO_DE_ROL[sesion.rol]}`);

  const cargado = await cargarInquilino(slug, sesion);
  if (!cargado) redirect(`/${slug}/acceso`);
  // La mensualidad del negocio también cierra el portal: si el negocio no paga,
  // sus clientes tampoco entran. Se les dice con otra pantalla.
  if (cargado.acceso !== 'ok') redirect(`/${slug}/suscripcion`);
  const cliente = await cargarCliente(sesion);
  if (!cliente) redirect(`/${slug}/acceso`);

  return { ...cargado, sesion, cliente };
}

export async function contextoApiCliente(slug: string): Promise<ContextoCliente | null> {
  const sesion = await leerSesionUsuario();
  if (!sesion || sesion.slug !== slug || sesion.tipo !== 'cliente') return null;
  const cargado = await cargarInquilino(slug, sesion);
  if (!cargado || cargado.acceso !== 'ok') return null;
  const cliente = await cargarCliente(sesion);
  if (!cliente) return null;
  return { ...cargado, sesion, cliente };
}

export type PermisoEscrituraCliente = { ok: true; ctx: ContextoCliente } | { ok: false; error: string };

/** Toda acción del PORTAL que guarde algo pasa por aquí. */
export async function contextoEscrituraCliente(slug: string): Promise<PermisoEscrituraCliente> {
  const ctx = await contextoApiCliente(slug);
  if (!ctx) return { ok: false, error: 'Tu sesión ya no es válida. Vuelve a entrar.' };
  if (ctx.inquilino.soloLectura) return { ok: false, error: MENSAJE_ESCAPARATE };
  return { ok: true, ctx };
}
