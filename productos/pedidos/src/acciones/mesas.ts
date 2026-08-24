'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { contextoEscritura } from '@/lib/inquilino';
import { PEDIDOS_ABIERTOS } from '@/lib/pedidos';

export type Resultado = { ok: true; id?: number } | { ok: false; error: string };
const refrescar = (slug: string) => revalidatePath(`/${slug}`, 'layout');

// ── Zonas (Salón, Terraza, Barra) ───────────────────────────────────────────
export async function guardarZona(slug: string, id: number | null, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const nombre = String(datos.get('nombre') || '').trim();
  if (nombre.length < 2) return { ok: false, error: 'Escribe el nombre de la zona.' };

  const repetida = await prisma.zona.findFirst({
    where: { inquilinoId: ctx.inquilino.id, nombre, id: id ? { not: id } : undefined },
    select: { id: true },
  });
  if (repetida) return { ok: false, error: `Ya existe una zona llamada «${nombre}».` };

  if (id) {
    const propia = await prisma.zona.findFirst({ where: { id, inquilinoId: ctx.inquilino.id }, select: { id: true } });
    if (!propia) return { ok: false, error: 'La zona no existe.' };
    await prisma.zona.update({ where: { id }, data: { nombre } });
  } else {
    const cuantas = await prisma.zona.count({ where: { inquilinoId: ctx.inquilino.id } });
    await prisma.zona.create({ data: { inquilinoId: ctx.inquilino.id, nombre, orden: cuantas } });
  }
  refrescar(slug);
  return { ok: true };
}

export async function eliminarZona(slug: string, id: number): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  // Se comprueba ANTES: la cascada del esquema se llevaría las mesas y con ellas
  // pedidos que todavía hacen falta.
  const conMesas = await prisma.mesa.count({ where: { zonaId: id, inquilinoId: ctx.inquilino.id } });
  if (conMesas) return { ok: false, error: `Esta zona tiene ${conMesas} mesa(s). Muévelas o elimínalas antes.` };

  const r = await prisma.zona.deleteMany({ where: { id, inquilinoId: ctx.inquilino.id } });
  if (!r.count) return { ok: false, error: 'La zona no existe.' };
  refrescar(slug);
  return { ok: true };
}

// ── Mesas ───────────────────────────────────────────────────────────────────
export async function guardarMesa(slug: string, id: number | null, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const nombre = String(datos.get('nombre') || '').trim();
  const zonaId = Number(datos.get('zonaId') || 0);
  const capacidadTxt = String(datos.get('capacidad') || '').trim();
  if (!nombre) return { ok: false, error: 'Escribe el nombre o número de la mesa.' };

  const zona = await prisma.zona.findFirst({ where: { id: zonaId, inquilinoId: ctx.inquilino.id }, select: { id: true } });
  if (!zona) return { ok: false, error: 'Elige una zona de este negocio.' };

  const repetida = await prisma.mesa.findFirst({
    where: { zonaId, nombre, id: id ? { not: id } : undefined },
    select: { id: true },
  });
  if (repetida) return { ok: false, error: `Esa zona ya tiene una mesa «${nombre}».` };

  const comun = { nombre, zonaId, capacidad: capacidadTxt ? Number(capacidadTxt) : null };

  if (id) {
    const propia = await prisma.mesa.findFirst({ where: { id, inquilinoId: ctx.inquilino.id }, select: { id: true } });
    if (!propia) return { ok: false, error: 'La mesa no existe.' };
    await prisma.mesa.update({ where: { id }, data: comun });
  } else {
    const cuantas = await prisma.mesa.count({ where: { zonaId } });
    await prisma.mesa.create({ data: { ...comun, inquilinoId: ctx.inquilino.id, orden: cuantas } });
  }
  refrescar(slug);
  return { ok: true };
}

export async function eliminarMesa(slug: string, id: number): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'administrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const conPedidos = await prisma.pedido.count({ where: { mesaId: id, inquilinoId: ctx.inquilino.id } });
  if (conPedidos)
    return { ok: false, error: `Esta mesa tiene ${conPedidos} pedido(s) en el histórico y no se puede eliminar sin perderlos.` };

  const r = await prisma.mesa.deleteMany({ where: { id, inquilinoId: ctx.inquilino.id } });
  if (!r.count) return { ok: false, error: 'La mesa no existe.' };
  refrescar(slug);
  return { ok: true };
}

/**
 * El mesero declara que una mesa espera atención. Es el estado que NO se puede
 * deducir de nada: no hay pedido todavía, y ese es justo el problema que resuelve.
 */
export async function cambiarEstadoMesa(
  slug: string,
  id: number,
  estado: 'LIBRE' | 'ESPERANDO_ATENCION' | 'OCUPADA',
): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'operar-mesas');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const mesa = await prisma.mesa.findFirst({
    where: { id, inquilinoId: ctx.inquilino.id },
    select: { id: true },
  });
  if (!mesa) return { ok: false, error: 'La mesa no existe.' };

  // Con un pedido abierto la mesa está ocupada, y decir otra cosa sería mentir en
  // el panel: primero se cobra o se anula.
  const abierto = await prisma.pedido.findFirst({
    where: { mesaId: id, estado: { in: PEDIDOS_ABIERTOS } },
    select: { id: true },
  });
  if (abierto && estado !== 'OCUPADA')
    return { ok: false, error: 'Esta mesa tiene un pedido abierto. Cóbralo o anúlalo antes de liberarla.' };

  await prisma.mesa.update({ where: { id }, data: { estado, desde: new Date() } });
  refrescar(slug);
  return { ok: true };
}

// ── Reservas de mesa ────────────────────────────────────────────────────────
/**
 * Dos reservas no pueden pisarse en la misma mesa. Tocarse en el extremo NO es
 * pisarse: quien reserva de 20:00 a 22:00 deja la mesa libre para las 22:00.
 */
async function haySolape(mesaId: number, desde: Date, hasta: Date, excluir?: number) {
  return prisma.reservaMesa.findFirst({
    where: {
      mesaId,
      estado: 'PENDIENTE',
      id: excluir ? { not: excluir } : undefined,
      desde: { lt: hasta },
      hasta: { gt: desde },
    },
    select: { id: true, cliente: true },
  });
}

export async function guardarReservaMesa(
  slug: string,
  id: number | null,
  datos: FormData,
): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'reservar-mesas');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const mesaId = Number(datos.get('mesaId') || 0);
  const cliente = String(datos.get('cliente') || '').trim();
  const telefono = String(datos.get('telefono') || '').trim();
  const personas = String(datos.get('personas') || '').trim();
  const notas = String(datos.get('notas') || '').trim();
  const desde = new Date(String(datos.get('desde') || ''));
  const minutos = Number(datos.get('minutos') || 90);

  if (cliente.length < 2) return { ok: false, error: 'Escribe a nombre de quién es la reserva.' };
  if (Number.isNaN(desde.getTime())) return { ok: false, error: 'La fecha y la hora no son válidas.' };
  if (minutos < 15 || minutos > 480) return { ok: false, error: 'La duración va de 15 minutos a 8 horas.' };
  const hasta = new Date(desde.getTime() + minutos * 60000);

  const mesa = await prisma.mesa.findFirst({ where: { id: mesaId, inquilinoId: ctx.inquilino.id }, select: { id: true } });
  if (!mesa) return { ok: false, error: 'Esa mesa no existe en este negocio.' };

  const choque = await haySolape(mesaId, desde, hasta, id ?? undefined);
  if (choque) return { ok: false, error: `Esa mesa ya está reservada para ${choque.cliente} a esa hora.` };

  const comun = { mesaId, cliente, telefono: telefono || null, personas: personas ? Number(personas) : null, desde, hasta, notas: notas || null };

  if (id) {
    const propia = await prisma.reservaMesa.findFirst({ where: { id, inquilinoId: ctx.inquilino.id }, select: { id: true } });
    if (!propia) return { ok: false, error: 'La reserva no existe.' };
    await prisma.reservaMesa.update({ where: { id }, data: comun });
  } else {
    await prisma.reservaMesa.create({ data: { ...comun, inquilinoId: ctx.inquilino.id } });
  }
  refrescar(slug);
  return { ok: true };
}

export async function cambiarEstadoReserva(
  slug: string,
  id: number,
  estado: 'PENDIENTE' | 'CUMPLIDA' | 'CANCELADA' | 'NO_PRESENTADO',
): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'reservar-mesas');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const r = await prisma.reservaMesa.updateMany({
    where: { id, inquilinoId: ctx.inquilino.id },
    data: { estado },
  });
  if (!r.count) return { ok: false, error: 'La reserva no existe.' };
  refrescar(slug);
  return { ok: true };
}
