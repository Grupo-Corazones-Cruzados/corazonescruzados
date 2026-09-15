'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { contextoEscritura, contextoEscrituraCliente, type Contexto, type ContextoCliente } from '@/lib/inquilino';
import { DIAS_SEMANA } from '@/lib/catalogo';
import { aDia, aFechaSql, diaSemanaDe, esDia, horaEn, hoyEn, type Dia } from '@/lib/fechas';
import { calcularFechaFin, resumirServicio } from '@/lib/servicios';
import { feriadosDelNegocio } from '@/lib/servicios-db';
import type { TipoComida, DiaSemana } from '@/generated/prisma/enums';

export type ResultadoServicio = { ok: true; id?: number } | { ok: false; error: string };

const Alta = z.object({
  clienteId: z.coerce.number().int().positive(),
  diasTotales: z.coerce.number().int().min(1, 'Los días tienen que ser al menos 1.').max(365),
  fechaInicio: z.string().refine(esDia, 'La fecha de inicio no es válida.'),
  porcentajeCancelacion: z.coerce.number().int().min(0).max(100),
  notas: z.string().trim().max(500).optional().or(z.literal('')),
});

type Listas = { error: string; comidas?: never; dias?: never } | { error?: never; comidas: TipoComida[]; dias: DiaSemana[] };

function leerListas(ctx: Contexto, datos: FormData): Listas {
  const comidas = datos.getAll('tiposComida').map(String).filter((t) => (ctx.inquilino.tiposComida as string[]).includes(t)) as TipoComida[];
  const dias = datos.getAll('diasSemana').map(String).filter((d) => (DIAS_SEMANA as string[]).includes(d)) as DiaSemana[];
  if (!comidas.length) return { error: 'Elige al menos una comida.' };
  if (!dias.length) return { error: 'Elige al menos un día de la semana.' };
  return { comidas, dias };
}

const revalidar = (slug: string, clienteId: number) => {
  revalidatePath(`/${slug}/servicios`);
  revalidatePath(`/${slug}/clientes/${clienteId}`);
  revalidatePath(`/${slug}/panel`);
};

/** Vender un servicio a un cliente. Solo uno vigente por cliente. */
export async function crearServicio(slug: string, datos: FormData): Promise<ResultadoServicio> {
  const permiso = await contextoEscritura(slug, 'servicios');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const leido = Alta.safeParse(Object.fromEntries(datos));
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const d = leido.data;
  const listas = leerListas(ctx, datos);
  if (listas.error !== undefined) return { ok: false, error: listas.error };

  const cliente = await prisma.cliente.findFirst({ where: { id: d.clienteId, inquilinoId: ctx.inquilino.id } });
  if (!cliente) return { ok: false, error: 'El cliente no existe.' };
  if (cliente.estado !== 'ACTIVO') return { ok: false, error: 'Solo se puede vender un servicio a un cliente activo.' };

  const vigente = await prisma.servicio.findFirst({
    where: { clienteId: d.clienteId, estado: { in: ['ACTIVO', 'SUSPENDIDO'] } },
    select: { id: true },
  });
  if (vigente) return { ok: false, error: 'Este cliente ya tiene un servicio vigente. Cuando venza, renuévalo.' };

  const s = await prisma.servicio.create({
    data: {
      inquilinoId: ctx.inquilino.id,
      clienteId: d.clienteId,
      diasTotales: d.diasTotales,
      fechaInicio: aFechaSql(d.fechaInicio),
      tiposComida: listas.comidas,
      diasSemana: listas.dias,
      porcentajeCancelacion: d.porcentajeCancelacion,
      notas: d.notas || null,
    },
  });
  revalidar(slug, d.clienteId);
  return { ok: true, id: s.id };
}

export async function editarServicio(slug: string, id: number, datos: FormData): Promise<ResultadoServicio> {
  const permiso = await contextoEscritura(slug, 'servicios');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const s = await prisma.servicio.findFirst({ where: { id, inquilinoId: ctx.inquilino.id } });
  if (!s) return { ok: false, error: 'El servicio no existe.' };
  if (s.estado === 'VENCIDO') return { ok: false, error: 'Un servicio vencido no se edita: renuévalo.' };

  const leido = Alta.omit({ clienteId: true }).safeParse(Object.fromEntries(datos));
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const d = leido.data;
  const listas = leerListas(ctx, datos);
  if (listas.error !== undefined) return { ok: false, error: listas.error };

  await prisma.servicio.update({
    where: { id },
    data: {
      diasTotales: d.diasTotales,
      fechaInicio: aFechaSql(d.fechaInicio),
      tiposComida: listas.comidas,
      diasSemana: listas.dias,
      porcentajeCancelacion: d.porcentajeCancelacion,
      notas: d.notas || null,
    },
  });
  revalidar(slug, s.clienteId);
  return { ok: true };
}

/** Suspender / reanudar: el servicio sigue vigente pero no se sirve mientras está suspendido. */
export async function cambiarEstadoServicio(slug: string, id: number, estado: 'ACTIVO' | 'SUSPENDIDO'): Promise<ResultadoServicio> {
  const permiso = await contextoEscritura(slug, 'servicios');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;
  const s = await prisma.servicio.findFirst({ where: { id, inquilinoId: ctx.inquilino.id } });
  if (!s) return { ok: false, error: 'El servicio no existe.' };
  if (s.estado === 'VENCIDO') return { ok: false, error: 'Un servicio vencido no se puede reanudar: renuévalo.' };
  await prisma.servicio.update({ where: { id }, data: { estado } });
  revalidar(slug, s.clienteId);
  return { ok: true };
}

/** Cerrar antes de tiempo: queda VENCIDO hoy, con su histórico. */
export async function cerrarServicio(slug: string, id: number): Promise<ResultadoServicio> {
  const permiso = await contextoEscritura(slug, 'servicios');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;
  const s = await prisma.servicio.findFirst({ where: { id, inquilinoId: ctx.inquilino.id } });
  if (!s) return { ok: false, error: 'El servicio no existe.' };
  if (s.estado === 'VENCIDO') return { ok: false, error: 'Ese servicio ya está vencido.' };
  await prisma.servicio.update({
    where: { id },
    data: { estado: 'VENCIDO', terminoEn: aFechaSql(hoyEn(ctx.inquilino.zonaHoraria)) },
  });
  revalidar(slug, s.clienteId);
  return { ok: true };
}

/**
 * Renovar: crea un servicio NUEVO con los mismos ajustes (o los que se cambien) y
 * deja el anterior VENCIDO con su histórico intacto. Renovar «encima» del viejo
 * —como hacía el proyecto de referencia— borraba lo consumido y las cancelaciones.
 */
export async function renovarServicio(slug: string, id: number, datos: FormData): Promise<ResultadoServicio> {
  const permiso = await contextoEscritura(slug, 'servicios');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const viejo = await prisma.servicio.findFirst({ where: { id, inquilinoId: ctx.inquilino.id }, include: { cliente: true } });
  if (!viejo) return { ok: false, error: 'El servicio no existe.' };
  if (viejo.cliente.estado !== 'ACTIVO') return { ok: false, error: 'El cliente no está activo.' };

  const leido = Alta.omit({ clienteId: true }).safeParse(Object.fromEntries(datos));
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const d = leido.data;
  const listas = leerListas(ctx, datos);
  if (listas.error !== undefined) return { ok: false, error: listas.error };

  const hoy = hoyEn(ctx.inquilino.zonaHoraria);
  const nuevo = await prisma.$transaction(async (tx) => {
    if (viejo.estado !== 'VENCIDO')
      await tx.servicio.update({ where: { id: viejo.id }, data: { estado: 'VENCIDO', terminoEn: aFechaSql(hoy) } });
    return tx.servicio.create({
      data: {
        inquilinoId: ctx.inquilino.id,
        clienteId: viejo.clienteId,
        diasTotales: d.diasTotales,
        fechaInicio: aFechaSql(d.fechaInicio),
        tiposComida: listas.comidas as never,
        diasSemana: listas.dias as never,
        porcentajeCancelacion: d.porcentajeCancelacion,
        renovaciones: viejo.renovaciones + 1,
        notas: d.notas || null,
      },
    });
  });
  revalidar(slug, viejo.clienteId);
  return { ok: true, id: nuevo.id };
}

// ── Cancelar y reactivar un día ─────────────────────────────────────────────

/**
 * La regla horaria del cliente: un día futuro siempre; hoy, solo antes de la hora
 * límite del negocio; un día pasado, nunca. El PERSONAL se la salta: si el
 * cliente llamó por teléfono a las 9, alguien tiene que poder anotarlo.
 */
function fueraDeHora(inq: { zonaHoraria: string; horaLimiteCancelacion: number }, dia: Dia): string | null {
  const hoy = hoyEn(inq.zonaHoraria);
  if (dia > hoy) return null;
  if (dia < hoy) return 'No se puede cambiar un día que ya pasó.';
  if (horaEn(inq.zonaHoraria) < inq.horaLimiteCancelacion) return null;
  const h = String(inq.horaLimiteCancelacion).padStart(2, '0');
  return `Los cambios para hoy solo se pueden hacer antes de las ${h}:00.`;
}

async function cancelarDiaDe(
  inquilino: Contexto['inquilino'],
  servicioId: number,
  dia: string,
  motivo: string,
  autor: 'CLIENTE' | 'PERSONAL',
  clienteId?: number,
): Promise<ResultadoServicio> {
  if (!esDia(dia)) return { ok: false, error: 'La fecha no es válida.' };
  const s = await prisma.servicio.findFirst({
    where: { id: servicioId, inquilinoId: inquilino.id, ...(clienteId ? { clienteId } : {}) },
    include: { cancelaciones: true },
  });
  if (!s) return { ok: false, error: 'El servicio no existe.' };
  if (s.estado !== 'ACTIVO') return { ok: false, error: 'Solo se cancelan días de un servicio activo.' };

  if (autor === 'CLIENTE') {
    const fuera = fueraDeHora(inquilino, dia);
    if (fuera) return { ok: false, error: fuera };
  }

  const feriados = await feriadosDelNegocio(inquilino.id);
  const canceladas = new Set(s.cancelaciones.filter((c) => c.activa).map((c) => aDia(c.fecha)));
  if (canceladas.has(dia)) return { ok: false, error: 'Ese día ya está cancelado.' };

  // Tiene que ser un día en el que de verdad le toca comida: cancelar un
  // sábado sin servicio no es una cancelación, es un malentendido.
  const fin = calcularFechaFin(s, feriados, canceladas);
  if (dia < aDia(s.fechaInicio) || dia > fin) return { ok: false, error: 'Ese día está fuera del servicio.' };
  if (!s.diasSemana.includes(diaSemanaDe(dia))) return { ok: false, error: 'Ese día de la semana no tiene servicio.' };
  if (feriados.has(dia)) return { ok: false, error: 'Ese día es feriado: no hay servicio y no consume.' };

  const r = resumirServicio(s, hoyEn(inquilino.zonaHoraria), feriados, canceladas);
  if (r.cancelacionesUsadas >= r.maxCancelaciones)
    return {
      ok: false,
      error: `Se alcanzó el tope de cancelaciones: ${r.maxCancelaciones} de ${s.diasTotales} días (${s.porcentajeCancelacion} %).`,
    };

  const fecha = aFechaSql(dia);
  const texto = motivo.trim() || null;
  await prisma.cancelacion.upsert({
    where: { servicioId_fecha: { servicioId: s.id, fecha } },
    update: { activa: true, motivo: texto, autor, reactivadaEn: null, reactivadaPor: null },
    create: { inquilinoId: inquilino.id, servicioId: s.id, clienteId: s.clienteId, fecha, motivo: texto, autor },
  });
  return { ok: true };
}

async function reactivarDiaDe(
  inquilino: Contexto['inquilino'],
  cancelacionId: number,
  autor: 'CLIENTE' | 'PERSONAL',
  clienteId?: number,
): Promise<ResultadoServicio> {
  const c = await prisma.cancelacion.findFirst({
    where: { id: cancelacionId, inquilinoId: inquilino.id, ...(clienteId ? { clienteId } : {}) },
  });
  if (!c) return { ok: false, error: 'La cancelación no existe.' };
  if (!c.activa) return { ok: false, error: 'Ese día ya estaba reactivado.' };
  if (autor === 'CLIENTE') {
    const fuera = fueraDeHora(inquilino, aDia(c.fecha));
    if (fuera) return { ok: false, error: fuera };
  }
  await prisma.cancelacion.update({
    where: { id: c.id },
    data: { activa: false, reactivadaEn: new Date(), reactivadaPor: autor },
  });
  return { ok: true };
}

export async function cancelarDia(slug: string, servicioId: number, dia: string, motivo: string): Promise<ResultadoServicio> {
  const permiso = await contextoEscritura(slug, 'servicios');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const r = await cancelarDiaDe(permiso.ctx.inquilino, servicioId, dia, motivo, 'PERSONAL');
  if (r.ok) revalidatePath(`/${slug}`, 'layout');
  return r;
}

export async function reactivarDia(slug: string, cancelacionId: number): Promise<ResultadoServicio> {
  const permiso = await contextoEscritura(slug, 'servicios');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const r = await reactivarDiaDe(permiso.ctx.inquilino, cancelacionId, 'PERSONAL');
  if (r.ok) revalidatePath(`/${slug}`, 'layout');
  return r;
}

export async function cancelarMiDia(slug: string, servicioId: number, dia: string, motivo: string): Promise<ResultadoServicio> {
  const permiso = await contextoEscrituraCliente(slug);
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const ctx: ContextoCliente = permiso.ctx;
  const r = await cancelarDiaDe(ctx.inquilino, servicioId, dia, motivo, 'CLIENTE', ctx.cliente.id);
  if (r.ok) { revalidatePath(`/${slug}/cancelaciones`); revalidatePath(`/${slug}/mi-servicio`); }
  return r;
}

export async function reactivarMiDia(slug: string, cancelacionId: number): Promise<ResultadoServicio> {
  const permiso = await contextoEscrituraCliente(slug);
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const ctx: ContextoCliente = permiso.ctx;
  const r = await reactivarDiaDe(ctx.inquilino, cancelacionId, 'CLIENTE', ctx.cliente.id);
  if (r.ok) { revalidatePath(`/${slug}/cancelaciones`); revalidatePath(`/${slug}/mi-servicio`); }
  return r;
}
