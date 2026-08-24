'use server';

import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { leerSesionOperador } from '@/lib/sesion';

export type ResultadoGcc =
  | { ok: true; mensaje?: string; clave?: string; slug?: string }
  | { ok: false; error: string };

async function exigirOperador() {
  return leerSesionOperador();
}

const claveAlAzar = () => randomBytes(9).toString('base64url');

/** Último día del mes 'AAAA-MM', en UTC: es una fecha, no un instante. */
function finDeMes(periodo: string) {
  const [a, m] = periodo.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0));
}

const RESERVADOS = new Set(['gcc', 'api', 'admin', 'acceso', '_next', 'panel', 'agenda']);

const Alta = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'El código necesita al menos 3 caracteres.')
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'El código solo admite minúsculas, números y guiones.'),
  nombre: z.string().trim().min(2, 'Escribe el nombre del alojamiento.'),
  planId: z.coerce.number().int().positive(),
  contactoNombre: z.string().trim().optional().or(z.literal('')),
  contactoEmail: z.string().trim().email('El correo no es válido.').optional().or(z.literal('')),
  contactoTelefono: z.string().trim().optional().or(z.literal('')),
  diasPrueba: z.coerce.number().int().min(0).max(365).default(30),
  usuarioAdmin: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .regex(/^[a-z0-9._-]+$/, 'El usuario solo admite letras, números, punto, guion y guion bajo.')
    .default('admin'),
});

/**
 * Alta de un alojamiento. Crea de una vez el inquilino, su suscripción y la
 * primera cuenta de administrador: un hotel sin nadie que pueda entrar no está
 * dado de alta, está a medias.
 */
export async function crearInquilino(datos: FormData): Promise<ResultadoGcc> {
  if (!(await exigirOperador())) return { ok: false, error: 'Sin sesión de operador.' };

  const leido = Alta.safeParse(Object.fromEntries(datos));
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const d = leido.data;

  // El código es el primer tramo de la dirección: no puede chocar con una ruta
  // de la propia aplicación o el hotel quedaría inaccesible.
  if (RESERVADOS.has(d.slug))
    return { ok: false, error: `«${d.slug}» está reservado por la aplicación. Elige otro código.` };

  const repetido = await prisma.inquilino.findUnique({ where: { slug: d.slug }, select: { id: true } });
  if (repetido) return { ok: false, error: `Ya hay un alojamiento con el código «${d.slug}».` };

  const clave = claveAlAzar();
  const pagadoHasta = d.diasPrueba > 0
    ? new Date(Date.now() + d.diasPrueba * 86_400_000)
    : null;

  await prisma.inquilino.create({
    data: {
      slug: d.slug,
      nombre: d.nombre,
      estado: d.diasPrueba > 0 ? 'PRUEBA' : 'ACTIVO',
      contactoNombre: d.contactoNombre || null,
      contactoEmail: d.contactoEmail || null,
      contactoTelefono: d.contactoTelefono || null,
      suscripcion: {
        create: {
          planId: d.planId,
          estado: d.diasPrueba > 0 ? 'PRUEBA' : 'ACTIVA',
          pagadoHasta: pagadoHasta
            ? new Date(Date.UTC(pagadoHasta.getFullYear(), pagadoHasta.getMonth(), pagadoHasta.getDate()))
            : null,
        },
      },
      usuarios: {
        create: {
          usuario: d.usuarioAdmin,
          nombre: d.contactoNombre || 'Administrador',
          email: d.contactoEmail || null,
          rol: 'ADMIN',
          passwordHash: await bcrypt.hash(clave, 10),
        },
      },
    },
  });

  revalidatePath('/gcc');
  return { ok: true, clave, slug: d.slug, mensaje: `Alojamiento «${d.nombre}» creado.` };
}

/**
 * Registrar el cobro de un mes. Es LA operación del cobro por autoservicio: el
 * cliente paga como sea y aquí queda constancia, y con ella se abre la puerta.
 */
export async function registrarPago(datos: FormData): Promise<ResultadoGcc> {
  const op = await exigirOperador();
  if (!op) return { ok: false, error: 'Sin sesión de operador.' };

  const inquilinoId = Number(datos.get('inquilinoId') || 0);
  const periodo = String(datos.get('periodo') || '').trim();
  const monto = Number(datos.get('monto') || 0);
  const metodo = (String(datos.get('metodo') || 'AUTOSERVICIO') as 'AUTOSERVICIO' | 'TARJETA');
  const referencia = String(datos.get('referencia') || '').trim();

  if (!/^\d{4}-\d{2}$/.test(periodo))
    return { ok: false, error: 'El periodo tiene que ser AAAA-MM (por ejemplo 2026-08).' };
  if (monto < 0) return { ok: false, error: 'El importe no puede ser negativo.' };

  const suscripcion = await prisma.suscripcion.findUnique({
    where: { inquilinoId },
    include: { plan: true },
  });
  if (!suscripcion) return { ok: false, error: 'Ese alojamiento no tiene suscripción.' };

  const yaPagado = await prisma.pagoMensual.findUnique({
    where: { suscripcionId_periodo: { suscripcionId: suscripcion.id, periodo } },
  });
  if (yaPagado && yaPagado.estado === 'PAGADO')
    return { ok: false, error: `El periodo ${periodo} ya está registrado como pagado.` };

  const hasta = finDeMes(periodo);
  // La fecha solo AVANZA: registrar un mes viejo no puede recortar el acceso ya
  // pagado de un mes posterior.
  const nuevaPagadoHasta =
    suscripcion.pagadoHasta && suscripcion.pagadoHasta > hasta ? suscripcion.pagadoHasta : hasta;

  await prisma.$transaction([
    prisma.pagoMensual.upsert({
      where: { suscripcionId_periodo: { suscripcionId: suscripcion.id, periodo } },
      update: {
        estado: 'PAGADO',
        monto,
        metodo,
        referencia: referencia || null,
        pagadoEn: new Date(),
        registradoPor: op.email,
      },
      create: {
        inquilinoId,
        suscripcionId: suscripcion.id,
        periodo,
        monto,
        moneda: suscripcion.plan.moneda,
        metodo,
        estado: 'PAGADO',
        referencia: referencia || null,
        pagadoEn: new Date(),
        registradoPor: op.email,
      },
    }),
    prisma.suscripcion.update({
      where: { id: suscripcion.id },
      data: { estado: 'ACTIVA', pagadoHasta: nuevaPagadoHasta, metodoPago: metodo },
    }),
    prisma.inquilino.update({ where: { id: inquilinoId }, data: { estado: 'ACTIVO' } }),
  ]);

  revalidatePath('/gcc');
  return { ok: true, mensaje: `Periodo ${periodo} registrado como pagado.` };
}

export async function cambiarEstadoInquilino(
  inquilinoId: number,
  estado: 'ACTIVO' | 'SUSPENDIDO',
): Promise<ResultadoGcc> {
  if (!(await exigirOperador())) return { ok: false, error: 'Sin sesión de operador.' };
  await prisma.inquilino.update({ where: { id: inquilinoId }, data: { estado } });
  revalidatePath('/gcc');
  return {
    ok: true,
    mensaje: estado === 'SUSPENDIDO' ? 'Alojamiento suspendido.' : 'Alojamiento reactivado.',
  };
}

export async function cambiarPlan(inquilinoId: number, planId: number): Promise<ResultadoGcc> {
  if (!(await exigirOperador())) return { ok: false, error: 'Sin sesión de operador.' };
  await prisma.suscripcion.update({ where: { inquilinoId }, data: { planId } });
  revalidatePath('/gcc');
  return { ok: true, mensaje: 'Plan cambiado.' };
}

/** Alta y edición de los niveles de la tier list. */
export async function guardarPlan(id: number | null, datos: FormData): Promise<ResultadoGcc> {
  if (!(await exigirOperador())) return { ok: false, error: 'Sin sesión de operador.' };

  const nombre = String(datos.get('nombre') || '').trim();
  const slug = String(datos.get('slug') || '').trim().toLowerCase();
  const precio = Number(datos.get('precioMensual') || 0);
  const descripcion = String(datos.get('descripcion') || '').trim();
  const caracteristicas = String(datos.get('caracteristicas') || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const tope = (c: string) => {
    const v = String(datos.get(c) || '').trim();
    return v === '' ? null : Number(v);
  };

  if (nombre.length < 2) return { ok: false, error: 'Escribe el nombre del plan.' };
  if (!/^[a-z0-9-]+$/.test(slug)) return { ok: false, error: 'El código del plan solo admite minúsculas, números y guiones.' };

  const comun = {
    nombre,
    slug,
    descripcion: descripcion || null,
    precioMensual: precio,
    caracteristicas,
    maxUbicaciones: tope('maxUbicaciones'),
    maxSuites: tope('maxSuites'),
    maxUsuarios: tope('maxUsuarios'),
    activo: datos.get('activo') !== 'false',
  };

  const repetido = await prisma.plan.findFirst({
    where: { slug, id: id ? { not: id } : undefined },
    select: { id: true },
  });
  if (repetido) return { ok: false, error: `Ya existe un plan con el código «${slug}».` };

  if (id) await prisma.plan.update({ where: { id }, data: comun });
  else await prisma.plan.create({ data: comun });

  revalidatePath('/gcc');
  return { ok: true, mensaje: 'Plan guardado.' };
}

export async function restablecerClaveAdmin(inquilinoId: number): Promise<ResultadoGcc> {
  if (!(await exigirOperador())) return { ok: false, error: 'Sin sesión de operador.' };

  const admin = await prisma.usuario.findFirst({
    where: { inquilinoId, rol: 'ADMIN', activo: true },
    orderBy: { id: 'asc' },
  });
  if (!admin) return { ok: false, error: 'Ese alojamiento no tiene administrador activo.' };

  const clave = claveAlAzar();
  await prisma.usuario.update({
    where: { id: admin.id },
    data: { passwordHash: await bcrypt.hash(clave, 10) },
  });
  revalidatePath('/gcc');
  return { ok: true, clave, mensaje: `Contraseña nueva para «${admin.usuario}».` };
}
