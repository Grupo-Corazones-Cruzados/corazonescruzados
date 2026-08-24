'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { contextoEscritura, type Contexto } from '@/lib/inquilino';
import { calcularCuenta, estadoSegunItems, PEDIDOS_ABIERTOS } from '@/lib/pedidos';

export type Resultado = { ok: true; id?: number } | { ok: false; error: string };

/** Hoy como fecha (sin hora) en la zona del negocio: el día del correlativo. */
function diaDelNegocio(zonaHoraria: string) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return new Date(`${f}T00:00:00.000Z`);
}

/**
 * Recalcula la cuenta del pedido desde sus platos y guarda el estado que le
 * corresponde. **Se llama después de CADA cambio de líneas**: mantener el total a
 * mano en dos sitios es la forma de que un día no cuadren.
 */
async function recalcular(pedidoId: number, ctx: Contexto) {
  const pedido = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    include: { items: true },
  });
  if (!pedido) return;

  const cuenta = calcularCuenta(
    pedido.items.map((i) => ({ precioUnitario: Number(i.precioUnitario), cantidad: i.cantidad })),
    {
      aplicaIva: ctx.inquilino.aplicaIva,
      ivaPorcentaje: Number(ctx.inquilino.ivaPorcentaje),
      precioConIva: ctx.inquilino.precioConIva,
    },
  );

  await prisma.pedido.update({
    where: { id: pedidoId },
    data: {
      subtotal: cuenta.subtotal,
      iva: cuenta.iva,
      total: cuenta.total,
      ivaPorcentaje: cuenta.ivaPorcentaje,
      estado: estadoSegunItems(pedido.items, pedido.estado),
    },
  });
}

const refrescar = (slug: string) => revalidatePath(`/${slug}`, 'layout');

// ── Abrir un pedido ─────────────────────────────────────────────────────────
export async function abrirPedido(slug: string, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'tomar-pedidos');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const mesaId = Number(datos.get('mesaId') || 0);
  const comensales = String(datos.get('comensales') || '').trim();

  const mesa = await prisma.mesa.findFirst({
    where: { id: mesaId, inquilinoId: ctx.inquilino.id },
    select: { id: true, nombre: true },
  });
  if (!mesa) return { ok: false, error: 'Esa mesa no existe en este negocio.' };

  // Una mesa no puede tener dos pedidos abiertos: si ya hay uno, se le añade.
  const abierto = await prisma.pedido.findFirst({
    where: { mesaId, estado: { in: PEDIDOS_ABIERTOS } },
    select: { id: true },
  });
  if (abierto) return { ok: true, id: abierto.id };

  const dia = diaDelNegocio(ctx.inquilino.zonaHoraria);
  const ultimo = await prisma.pedido.findFirst({
    where: { inquilinoId: ctx.inquilino.id, dia },
    orderBy: { numero: 'desc' },
    select: { numero: true },
  });

  const creado = await prisma.pedido.create({
    data: {
      inquilinoId: ctx.inquilino.id,
      mesaId,
      numero: (ultimo?.numero ?? 0) + 1,
      dia,
      meseroId: ctx.sesion.uid,
      comensales: comensales ? Number(comensales) : null,
      ivaPorcentaje: ctx.inquilino.aplicaIva ? Number(ctx.inquilino.ivaPorcentaje) : 0,
    },
    select: { id: true },
  });

  // Abrir el pedido ocupa la mesa: es el mismo hecho contado una vez.
  await prisma.mesa.update({
    where: { id: mesaId },
    data: { estado: 'OCUPADA', desde: new Date() },
  });

  refrescar(slug);
  return { ok: true, id: creado.id };
}

// ── Líneas del pedido ───────────────────────────────────────────────────────
const Linea = z.object({
  pedidoId: z.coerce.number().int().positive(),
  productoId: z.coerce.number().int().positive(),
  cantidad: z.coerce.number().int().min(1).max(99).default(1),
  notas: z.string().trim().max(200).optional().or(z.literal('')),
});

export async function agregarPlato(slug: string, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'tomar-pedidos');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const leido = Linea.safeParse(Object.fromEntries(datos));
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const d = leido.data;

  const pedido = await prisma.pedido.findFirst({
    where: { id: d.pedidoId, inquilinoId: ctx.inquilino.id },
    select: { id: true, estado: true },
  });
  if (!pedido) return { ok: false, error: 'El pedido no existe.' };
  if (!PEDIDOS_ABIERTOS.includes(pedido.estado))
    return { ok: false, error: 'Este pedido ya está cerrado: no se le pueden añadir platos.' };

  const producto = await prisma.producto.findFirst({
    where: { id: d.productoId, inquilinoId: ctx.inquilino.id },
  });
  if (!producto) return { ok: false, error: 'Ese producto no existe en el catálogo.' };
  if (!producto.disponible) return { ok: false, error: `«${producto.nombre}» está marcado como agotado.` };

  // El nombre y el precio se COPIAN: si mañana sube la carta, la cuenta de hoy
  // sigue diciendo lo que se cobró.
  await prisma.pedidoItem.create({
    data: {
      pedidoId: d.pedidoId,
      productoId: producto.id,
      nombre: producto.nombre,
      precioUnitario: producto.precio,
      cantidad: d.cantidad,
      notas: d.notas || null,
    },
  });

  await recalcular(d.pedidoId, ctx);
  refrescar(slug);
  return { ok: true, id: d.pedidoId };
}

export async function quitarPlato(slug: string, itemId: number): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'tomar-pedidos');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const item = await prisma.pedidoItem.findFirst({
    where: { id: itemId, pedido: { inquilinoId: ctx.inquilino.id } },
    select: { id: true, pedidoId: true, pedido: { select: { estado: true } } },
  });
  if (!item) return { ok: false, error: 'Ese plato no existe.' };
  if (!PEDIDOS_ABIERTOS.includes(item.pedido.estado))
    return { ok: false, error: 'El pedido ya está cerrado.' };

  await prisma.pedidoItem.delete({ where: { id: itemId } });
  await recalcular(item.pedidoId, ctx);
  refrescar(slug);
  return { ok: true, id: item.pedidoId };
}

// ── Cocina ──────────────────────────────────────────────────────────────────
/** El cocinero marca un plato que sale. */
export async function marcarPlatoListo(slug: string, itemId: number): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'cocinar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const item = await prisma.pedidoItem.findFirst({
    where: { id: itemId, pedido: { inquilinoId: ctx.inquilino.id } },
    select: { id: true, pedidoId: true, estado: true },
  });
  if (!item) return { ok: false, error: 'Ese plato no existe.' };
  if (item.estado === 'LISTO') return { ok: true, id: item.pedidoId };

  await prisma.pedidoItem.update({
    where: { id: itemId },
    data: { estado: 'LISTO', listoEn: new Date() },
  });
  await recalcular(item.pedidoId, ctx);
  await marcarHoraListo(item.pedidoId);
  refrescar(slug);
  return { ok: true, id: item.pedidoId };
}

/** Y el botón que usa de verdad: «todo este pedido, listo». */
export async function marcarPedidoListo(slug: string, pedidoId: number): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'cocinar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const pedido = await prisma.pedido.findFirst({
    where: { id: pedidoId, inquilinoId: ctx.inquilino.id },
    select: { id: true, estado: true },
  });
  if (!pedido) return { ok: false, error: 'El pedido no existe.' };
  if (!PEDIDOS_ABIERTOS.includes(pedido.estado))
    return { ok: false, error: 'El pedido ya está cerrado.' };

  await prisma.pedidoItem.updateMany({
    where: { pedidoId, estado: 'PENDIENTE' },
    data: { estado: 'LISTO', listoEn: new Date() },
  });
  await recalcular(pedidoId, ctx);
  await marcarHoraListo(pedidoId);
  refrescar(slug);
  return { ok: true, id: pedidoId };
}

/** Solo la primera vez: es la hora en la que la cocina terminó. */
async function marcarHoraListo(pedidoId: number) {
  const p = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: { estado: true, listoEn: true },
  });
  if (p && p.estado === 'LISTO' && !p.listoEn)
    await prisma.pedido.update({ where: { id: pedidoId }, data: { listoEn: new Date() } });
}

// ── Servir y cobrar ─────────────────────────────────────────────────────────
export async function marcarServido(slug: string, pedidoId: number): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'tomar-pedidos');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const pedido = await prisma.pedido.findFirst({
    where: { id: pedidoId, inquilinoId: ctx.inquilino.id },
    select: { id: true, estado: true },
  });
  if (!pedido) return { ok: false, error: 'El pedido no existe.' };
  if (pedido.estado === 'COBRADO' || pedido.estado === 'ANULADO')
    return { ok: false, error: 'El pedido ya está cerrado.' };
  if (pedido.estado === 'EN_PREPARACION')
    return { ok: false, error: 'Todavía quedan platos en cocina.' };

  await prisma.pedido.update({
    where: { id: pedidoId },
    data: { estado: 'SERVIDO', servidoEn: new Date() },
  });
  refrescar(slug);
  return { ok: true, id: pedidoId };
}

export async function cobrarPedido(slug: string, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'cobrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const pedidoId = Number(datos.get('pedidoId') || 0);
  const metodo = String(datos.get('metodoPago') || '');
  if (!['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'OTRO'].includes(metodo))
    return { ok: false, error: 'Elige un método de pago.' };

  const pedido = await prisma.pedido.findFirst({
    where: { id: pedidoId, inquilinoId: ctx.inquilino.id },
    include: { items: { select: { id: true } } },
  });
  if (!pedido) return { ok: false, error: 'El pedido no existe.' };
  if (pedido.estado === 'COBRADO') return { ok: false, error: 'Este pedido ya está cobrado.' };
  if (pedido.estado === 'ANULADO') return { ok: false, error: 'Este pedido está anulado.' };
  if (!pedido.items.length) return { ok: false, error: 'No se puede cobrar un pedido sin platos.' };

  await prisma.$transaction([
    prisma.pedido.update({
      where: { id: pedidoId },
      data: {
        estado: 'COBRADO',
        metodoPago: metodo as 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA' | 'OTRO',
        cerradoEn: new Date(),
        servidoEn: pedido.servidoEn ?? new Date(),
      },
    }),
    // Cobrar libera la mesa: es lo que ocurre de verdad cuando el cliente paga.
    prisma.mesa.update({
      where: { id: pedido.mesaId },
      data: { estado: 'LIBRE', desde: new Date() },
    }),
  ]);

  refrescar(slug);
  return { ok: true, id: pedidoId };
}

export async function anularPedido(slug: string, pedidoId: number): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'cobrar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const pedido = await prisma.pedido.findFirst({
    where: { id: pedidoId, inquilinoId: ctx.inquilino.id },
    select: { id: true, mesaId: true, estado: true },
  });
  if (!pedido) return { ok: false, error: 'El pedido no existe.' };
  if (pedido.estado === 'COBRADO')
    return { ok: false, error: 'Un pedido ya cobrado no se anula: eso sería reescribir la caja.' };

  await prisma.$transaction([
    prisma.pedido.update({
      where: { id: pedidoId },
      data: { estado: 'ANULADO', cerradoEn: new Date() },
    }),
    prisma.mesa.update({ where: { id: pedido.mesaId }, data: { estado: 'LIBRE', desde: new Date() } }),
  ]);

  refrescar(slug);
  return { ok: true, id: pedidoId };
}
