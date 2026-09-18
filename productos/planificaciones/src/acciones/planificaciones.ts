'use server';

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { contextoEscritura, esDuenoOAdmin } from '@/lib/inquilino';
import { cupoDeGeneraciones, faltaCupoDeGeneracion, topesDe } from '@/lib/limites';
import { aFechaSql, esDia } from '@/lib/fechas';
import { NIVELES } from '@/lib/catalogo';
import { MAX_ADJUNTOS, MAX_TAMANO, extraerTexto, tipoDe } from '@/lib/adjuntos';
import { generarEnSegundoPlano } from '@/lib/generacion';
import { importarEnSegundoPlano } from '@/lib/importacion';
import { PLANTILLAS } from '@/plantillas';
import { copiarDestrezasDelCatalogo } from '@/lib/destrezas';
import { materiasDelDocente } from '@/lib/horario';

export type Resultado = { ok: true; id?: number } | { ok: false; error: string };

const fecha = (mensaje: string) => z.string().trim().refine(esDia, mensaje);

// ── La planificación (la cabecera del PUD) ──────────────────────────────────

const Alta = z
  .object({
    /// La materia de un grado asignada al docente (módulo «Unidades»).
    materiaGradoId: z.coerce.number().int().positive('Elige la materia.'),
    ambito: z.string().trim().max(120).optional().or(z.literal('')),
    nivel: z.enum(NIVELES as [string, ...string[]]),
    numeroUnidad: z.coerce.number().int('El número de unidad es un entero.').min(1, 'El número de unidad empieza en 1.').max(99),
    tituloUnidad: z.string().trim().min(2, 'Escribe el título de la unidad.').max(200),
    inicioPud: fecha('La fecha de inicio del PUD no es válida.'),
    finPud: fecha('La fecha de fin del PUD no es válida.'),
  })
  .refine((d) => d.finPud >= d.inicioPud, { message: 'El fin del PUD no puede ser antes del inicio.', path: ['finPud'] });

/**
 * Crear una planificación. Es el formulario de «Nueva planificación»: materia,
 * ámbito, nivel, unidad, título e inicio/fin del PUD. Nace con la plantilla por
 * defecto de la institución y con «Elaborado por» = el docente.
 */
export async function crearPlanificacion(slug: string, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'planificar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const leido = Alta.safeParse(Object.fromEntries(datos));
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const d = leido.data;

  // Solo las materias (de un grado) que el administrador le asignó en «Unidades»
  // (Fernando, 2026-09-16); de ahí salen el área y el grado del formato.
  const permitidas = await materiasDelDocente(ctx.inquilino.id, ctx.sesion.uid, ctx.sesion.rol);
  const materia = permitidas.find((m) => m.id === d.materiaGradoId);
  if (!materia) return { ok: false, error: 'Esa materia no está entre las que tienes asignadas. Pide al administrador que te la asigne en Unidades.' };

  const docente = await prisma.usuario.findUnique({ where: { id: ctx.sesion.uid }, select: { nombre: true, profesion: true } });
  const fila = await prisma.planificacion.create({
    data: {
      inquilinoId: ctx.inquilino.id,
      usuarioId: ctx.sesion.uid,
      plantilla: ctx.inquilino.plantillaPorDefecto,
      nivel: d.nivel as never,
      materiaGradoId: materia.id,
      materia: materia.materia,
      gradoCurso: materia.grado,
      // En Preparatoria el ámbito coincide con el área; si no lo escriben, se copia.
      ambito: d.ambito || materia.materia,
      numeroUnidad: d.numeroUnidad,
      tituloUnidad: d.tituloUnidad,
      inicioPud: aFechaSql(d.inicioPud),
      finPud: aFechaSql(d.finPud),
      elaboradoPor: docente ? [docente.profesion, docente.nombre].filter(Boolean).join(' ') : null,
    },
  });
  // Sus destrezas nacen copiadas del catálogo de la materia y el nivel: desde ahí
  // el docente las edita sin tocar las de nadie más.
  await copiarDestrezasDelCatalogo({ planificacionId: fila.id, inquilinoId: ctx.inquilino.id, nivel: fila.nivel, materia: fila.materia });
  revalidatePath(`/${slug}/planificaciones`);
  return { ok: true, id: fila.id };
}

/**
 * IMPORTAR UN FORMATO YA HECHO (Fernando, 2026-09-17): el docente elige la materia
 * (de las asignadas) y sube el PDF o Word de un PUD suyo; la planificación nace
 * LEYENDO con lo mínimo y el agente, fuera de la petición, transcribe la cabecera
 * y cada semana. Lo que el formato no traiga se completa con lo de la materia.
 */
export async function importarFormato(slug: string, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'planificar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const materiaGradoId = Number(datos.get('materiaGradoId'));
  const permitidas = await materiasDelDocente(ctx.inquilino.id, ctx.sesion.uid, ctx.sesion.rol);
  const materia = permitidas.find((m) => m.id === materiaGradoId);
  if (!materia) return { ok: false, error: 'Elige una de las materias que tienes asignadas.' };

  const archivo = datos.get('archivo');
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, error: 'Adjunta el PDF o el Word del formato.' };
  if (archivo.size > MAX_TAMANO) return { ok: false, error: 'El archivo pasa de 10 MB.' };
  const tipo = tipoDe(archivo);
  if (tipo !== 'application/pdf' && tipo !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return { ok: false, error: 'Tiene que ser un PDF o un Word (.docx).' };
  let texto: string;
  try {
    texto = (await extraerTexto(Buffer.from(await archivo.arrayBuffer()), tipo)).replace(/\u0000/g, '').trim();
  } catch (e) {
    return { ok: false, error: `No se pudo leer el archivo: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (texto.length < 200) return { ok: false, error: 'El archivo no tiene texto legible (¿es un PDF escaneado?). Hace falta el PDF o el Word original.' };
  if (!/SEMANA\s*\d/i.test(texto)) return { ok: false, error: 'En el archivo no aparece ninguna «SEMANA N»: tiene que ser un formato PUD como el de la aplicación.' };

  // Las semanas importadas cuentan contra el tope como cualquier otra; si no queda cupo, ni se empieza.
  const sinCupo = await faltaCupoDeGeneracion(ctx.inquilino, topesDe(ctx.inquilino).generaciones);
  if (sinCupo) return { ok: false, error: sinCupo };
  const cupo = await cupoDeGeneraciones(ctx.inquilino, topesDe(ctx.inquilino).generaciones);

  const docente = await prisma.usuario.findUnique({ where: { id: ctx.sesion.uid }, select: { nombre: true, profesion: true } });
  const hoy = new Date().toISOString().slice(0, 10);
  const fila = await prisma.planificacion.create({
    data: {
      inquilinoId: ctx.inquilino.id,
      usuarioId: ctx.sesion.uid,
      plantilla: ctx.inquilino.plantillaPorDefecto,
      nivel: 'PREPARATORIA',
      materiaGradoId: materia.id,
      materia: materia.materia,
      gradoCurso: materia.grado,
      ambito: materia.materia,
      numeroUnidad: 1,
      tituloUnidad: `Leyendo «${archivo.name}»…`,
      inicioPud: aFechaSql(hoy),
      finPud: aFechaSql(hoy),
      elaboradoPor: docente ? [docente.profesion, docente.nombre].filter(Boolean).join(' ') : null,
      importacionEstado: 'LEYENDO',
      importacionArchivo: archivo.name.slice(0, 200),
    },
  });
  await copiarDestrezasDelCatalogo({ planificacionId: fila.id, inquilinoId: ctx.inquilino.id, nivel: fila.nivel, materia: fila.materia });
  after(() => importarEnSegundoPlano(fila.id, texto, cupo.quedan));
  revalidatePath(`/${slug}/planificaciones`);
  return { ok: true, id: fila.id };
}

const Configuracion = z
  .object({
    plantilla: z.string().trim(),
    materia: z.string().trim().min(2, 'Escribe el nombre de la materia.').max(120),
    ambito: z.string().trim().min(2, 'Escribe el ámbito de desarrollo/aprendizaje.').max(120),
    nivel: z.enum(NIVELES as [string, ...string[]]),
    numeroUnidad: z.coerce.number().int().min(1).max(99),
    tituloUnidad: z.string().trim().min(2, 'Escribe el título de la unidad.').max(200),
    inicioPud: fecha('La fecha de inicio del PUD no es válida.'),
    finPud: fecha('La fecha de fin del PUD no es válida.'),
    gradoCurso: z.string().trim().max(80).optional().or(z.literal('')),
    paralelo: z.string().trim().max(20).optional().or(z.literal('')),
    jornada: z.string().trim().max(40).optional().or(z.literal('')),
    objetivosUnidad: z.string().trim().max(4000).optional().or(z.literal('')),
    criteriosEvaluacion: z.string().trim().max(4000).optional().or(z.literal('')),
    elaboradoPor: z.string().trim().max(200).optional().or(z.literal('')),
    revisadoPor: z.string().trim().max(200).optional().or(z.literal('')),
    revisadoCargo: z.string().trim().max(80).optional().or(z.literal('')),
    aprobadoPor: z.string().trim().max(200).optional().or(z.literal('')),
    aprobadoCargo: z.string().trim().max(80).optional().or(z.literal('')),
    registroTitulo: z.string().trim().max(200).optional().or(z.literal('')),
    registroElaboradoCargo: z.string().trim().max(120).optional().or(z.literal('')),
    registroElaboradoNombre: z.string().trim().max(200).optional().or(z.literal('')),
    registroElaboradoFecha: z.string().trim().max(40).optional().or(z.literal('')),
    registroAprobadoCargo: z.string().trim().max(120).optional().or(z.literal('')),
    registroAprobadoNombre: z.string().trim().max(200).optional().or(z.literal('')),
    registroAprobadoFecha: z.string().trim().max(40).optional().or(z.literal('')),
    deceNombre: z.string().trim().max(160).optional().or(z.literal('')),
  })
  .refine((d) => d.finPud >= d.inicioPud, { message: 'El fin del PUD no puede ser antes del inicio.', path: ['finPud'] });

/** «Configurar»: plantilla, datos del formato y firmas. Solo el dueño o el administrador. */
export async function configurarPlanificacion(slug: string, id: number, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'planificar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const pl = await prisma.planificacion.findFirst({ where: { id, inquilinoId: ctx.inquilino.id } });
  if (!pl) return { ok: false, error: 'La planificación no existe.' };
  if (!esDuenoOAdmin(ctx.sesion, pl)) return { ok: false, error: 'Solo quien creó la planificación (o el administrador) puede configurarla.' };

  const leido = Configuracion.safeParse(Object.fromEntries(datos));
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const d = leido.data;
  if (!PLANTILLAS[d.plantilla]) return { ok: false, error: 'Esa plantilla no existe.' };

  await prisma.planificacion.update({
    where: { id },
    data: {
      plantilla: d.plantilla,
      materia: d.materia,
      ambito: d.ambito,
      nivel: d.nivel as never,
      numeroUnidad: d.numeroUnidad,
      tituloUnidad: d.tituloUnidad,
      inicioPud: aFechaSql(d.inicioPud),
      finPud: aFechaSql(d.finPud),
      gradoCurso: d.gradoCurso || null,
      paralelo: d.paralelo || null,
      jornada: d.jornada || null,
      objetivosUnidad: d.objetivosUnidad || null,
      criteriosEvaluacion: d.criteriosEvaluacion || null,
      elaboradoPor: d.elaboradoPor || null,
      revisadoPor: d.revisadoPor || null,
      revisadoCargo: d.revisadoCargo || null,
      aprobadoPor: d.aprobadoPor || null,
      aprobadoCargo: d.aprobadoCargo || null,
      registroTitulo: d.registroTitulo || null,
      registroElaboradoCargo: d.registroElaboradoCargo || null,
      registroElaboradoNombre: d.registroElaboradoNombre || null,
      registroElaboradoFecha: d.registroElaboradoFecha || null,
      registroAprobadoCargo: d.registroAprobadoCargo || null,
      registroAprobadoNombre: d.registroAprobadoNombre || null,
      registroAprobadoFecha: d.registroAprobadoFecha || null,
      deceNombre: d.deceNombre || null,
    },
  });
  revalidatePath(`/${slug}/planificaciones`);
  return { ok: true, id };
}

export async function eliminarPlanificacion(slug: string, id: number): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'planificar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;
  const pl = await prisma.planificacion.findFirst({ where: { id, inquilinoId: ctx.inquilino.id } });
  if (!pl) return { ok: false, error: 'La planificación no existe.' };
  if (!esDuenoOAdmin(ctx.sesion, pl)) return { ok: false, error: 'Solo quien creó la planificación (o el administrador) puede eliminarla.' };
  await prisma.planificacion.delete({ where: { id } });
  revalidatePath(`/${slug}/planificaciones`);
  return { ok: true };
}

// ── La planificación semanal (la solicitud al agente) ───────────────────────

const Solicitud = z.object({
  indicaciones: z.string().trim().max(20_000, 'Las indicaciones son demasiado largas.'),
  fechaInicio: z.string().trim().optional().or(z.literal('')),
  fechaFin: z.string().trim().optional().or(z.literal('')),
  adjuntos: z.array(z.coerce.number().int().positive()).max(MAX_ADJUNTOS, `Como mucho ${MAX_ADJUNTOS} archivos.`),
});

/**
 * Crear una solicitud de planificación semanal y mandarla al agente. La fila
 * nace PENDIENTE y se redacta en segundo plano (`after`): el docente vuelve a la
 * pantalla y la ve pasar a «Redactando…» y a «Lista».
 *
 * Aquí se comprueba el tope de generaciones por semana de la institución.
 */
export async function crearSemana(slug: string, planificacionId: number, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'planificar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;

  const pl = await prisma.planificacion.findFirst({ where: { id: planificacionId, inquilinoId: ctx.inquilino.id } });
  if (!pl) return { ok: false, error: 'La planificación no existe.' };
  if (!esDuenoOAdmin(ctx.sesion, pl)) return { ok: false, error: 'Solo quien creó la planificación (o el administrador) puede añadirle semanas.' };

  const leido = Solicitud.safeParse({
    indicaciones: datos.get('indicaciones') ?? '',
    fechaInicio: datos.get('fechaInicio') ?? '',
    fechaFin: datos.get('fechaFin') ?? '',
    adjuntos: datos.getAll('adjuntos').map(String).filter(Boolean),
  });
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const d = leido.data;
  if (d.fechaInicio && !esDia(d.fechaInicio)) return { ok: false, error: 'La fecha de inicio de la semana no es válida.' };
  if (d.fechaFin && !esDia(d.fechaFin)) return { ok: false, error: 'La fecha de fin de la semana no es válida.' };
  if (d.fechaInicio && d.fechaFin && d.fechaFin < d.fechaInicio) return { ok: false, error: 'El fin de la semana no puede ser antes del inicio.' };
  if (!d.indicaciones && !d.adjuntos.length) return { ok: false, error: 'Cuéntale al agente qué quieres para esta semana (por micrófono o escrito), o adjunta un archivo.' };

  const sinCupo = await faltaCupoDeGeneracion(ctx.inquilino, topesDe(ctx.inquilino).generaciones);
  if (sinCupo) return { ok: false, error: sinCupo };

  // Los adjuntos tienen que ser de quien pide, y estar sueltos todavía.
  if (d.adjuntos.length) {
    const propios = await prisma.adjunto.count({ where: { id: { in: d.adjuntos }, usuarioId: ctx.sesion.uid, inquilinoId: ctx.inquilino.id, semanaId: null } });
    if (propios !== d.adjuntos.length) return { ok: false, error: 'Alguno de los adjuntos ya no está disponible. Vuelve a añadirlo.' };
  }

  const ultimo = await prisma.planificacionSemanal.aggregate({ where: { planificacionId }, _max: { orden: true } });
  const semana = await prisma.planificacionSemanal.create({
    data: {
      inquilinoId: ctx.inquilino.id,
      planificacionId,
      usuarioId: ctx.sesion.uid,
      orden: (ultimo._max.orden ?? 0) + 1,
      indicaciones: d.indicaciones,
      fechaInicio: d.fechaInicio ? aFechaSql(d.fechaInicio) : null,
      fechaFin: d.fechaFin ? aFechaSql(d.fechaFin) : null,
      adjuntos: d.adjuntos.length ? { connect: d.adjuntos.map((id) => ({ id })) } : undefined,
    },
  });

  after(() => generarEnSegundoPlano(semana.id));
  revalidatePath(`/${slug}/planificaciones`);
  return { ok: true, id: semana.id };
}

/** Volver a pedir la semana al agente (tras un error, o porque no convenció). Cuenta contra el tope. */
export async function regenerarSemana(slug: string, id: number, datos?: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'planificar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;
  const s = await prisma.planificacionSemanal.findFirst({ where: { id, inquilinoId: ctx.inquilino.id }, include: { planificacion: true } });
  if (!s) return { ok: false, error: 'La semana no existe.' };
  if (!esDuenoOAdmin(ctx.sesion, s.planificacion)) return { ok: false, error: 'Solo quien creó la planificación (o el administrador) puede regenerarla.' };
  if (s.estado === 'GENERANDO' || s.estado === 'PENDIENTE') return { ok: false, error: 'Esa semana ya se está redactando.' };

  // Un reintento tras un ERROR no cuenta (la primera no consumió); una regeneración de una LISTA sí.
  if (s.estado === 'LISTA') {
    const sinCupo = await faltaCupoDeGeneracion(ctx.inquilino, topesDe(ctx.inquilino).generaciones);
    if (sinCupo) return { ok: false, error: sinCupo };
  }
  const indicaciones = String(datos?.get('indicaciones') ?? s.indicaciones).trim().slice(0, 20_000);
  await prisma.planificacionSemanal.update({ where: { id }, data: { estado: 'PENDIENTE', error: null, indicaciones, creado: s.estado === 'LISTA' ? new Date() : s.creado } });
  after(() => generarEnSegundoPlano(id));
  revalidatePath(`/${slug}/planificaciones`);
  return { ok: true, id };
}

const Campos = z.object({
  fechaInicio: fecha('La fecha de inicio no es válida.'),
  fechaFin: fecha('La fecha de fin no es válida.'),
  tema: z.string().trim().max(500),
  numeroPeriodos: z.string().trim().max(40),
  objetivosTema: z.string().trim().max(4000),
  estrategias: z.string().trim().max(20_000),
  recursos: z.string().trim().max(4000),
  tecnica: z.string().trim().max(1000),
  instrumento: z.string().trim().max(1000),
  destrezas: z.array(z.coerce.number().int().positive()).max(4),
});

/** Corregir a mano los campos que redactó el agente, y elegir otras destrezas. */
export async function editarSemana(slug: string, id: number, datos: FormData): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'planificar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;
  const s = await prisma.planificacionSemanal.findFirst({ where: { id, inquilinoId: ctx.inquilino.id }, include: { planificacion: true } });
  if (!s) return { ok: false, error: 'La semana no existe.' };
  if (!esDuenoOAdmin(ctx.sesion, s.planificacion)) return { ok: false, error: 'Solo quien creó la planificación (o el administrador) puede corregirla.' };

  const leido = Campos.safeParse({ ...Object.fromEntries(datos), destrezas: datos.getAll('destrezas').map(String).filter(Boolean) });
  if (!leido.success) return { ok: false, error: leido.error.issues[0].message };
  const d = leido.data;
  if (d.fechaFin < d.fechaInicio) return { ok: false, error: 'El fin de la semana no puede ser antes del inicio.' };

  // Solo destrezas del nivel y que la institución pueda usar.
  const validas = d.destrezas.length ? await prisma.destreza.findMany({ where: { id: { in: d.destrezas }, planificacionId: s.planificacionId }, select: { id: true } }) : [];
  const orden = new Map(d.destrezas.map((x, i) => [x, i]));

  // Las estrategias de los ajustes razonables se corrigen en el mismo formulario (`ajuste-<id>`).
  const ajustes = [...datos.entries()]
    .filter(([k]) => /^ajuste-\d+$/.test(k))
    .map(([k, v]) => ({ id: Number(k.slice(7)), estrategia: String(v).trim() }))
    .filter((a) => a.estrategia);

  await prisma.$transaction([
    prisma.planificacionDestreza.deleteMany({ where: { semanaId: id } }),
    ...ajustes.map((a) => prisma.ajusteRazonable.updateMany({ where: { id: a.id, semanaId: id }, data: { estrategia: a.estrategia } })),
    prisma.planificacionSemanal.update({
      where: { id },
      data: {
        estado: 'LISTA',
        fechaInicio: aFechaSql(d.fechaInicio),
        fechaFin: aFechaSql(d.fechaFin),
        tema: d.tema,
        numeroPeriodos: d.numeroPeriodos,
        objetivosTema: d.objetivosTema,
        estrategias: d.estrategias,
        recursos: d.recursos,
        tecnica: d.tecnica,
        instrumento: d.instrumento,
        destrezas: { create: validas.map((v) => ({ destrezaId: v.id, orden: orden.get(v.id) ?? 0 })) },
      },
    }),
  ]);
  revalidatePath(`/${slug}/planificaciones`);
  return { ok: true, id };
}

/** Borrar una semana y renumerar las que siguen, para que el formato no salte del 2 al 4. */
export async function eliminarSemana(slug: string, id: number): Promise<Resultado> {
  const permiso = await contextoEscritura(slug, 'planificar');
  if (!permiso.ok) return { ok: false, error: permiso.error };
  const { ctx } = permiso;
  const s = await prisma.planificacionSemanal.findFirst({ where: { id, inquilinoId: ctx.inquilino.id }, include: { planificacion: true } });
  if (!s) return { ok: false, error: 'La semana no existe.' };
  if (!esDuenoOAdmin(ctx.sesion, s.planificacion)) return { ok: false, error: 'Solo quien creó la planificación (o el administrador) puede eliminarla.' };

  await prisma.$transaction(async (tx) => {
    await tx.planificacionSemanal.delete({ where: { id } });
    const siguientes = await tx.planificacionSemanal.findMany({ where: { planificacionId: s.planificacionId, orden: { gt: s.orden } }, orderBy: { orden: 'asc' } });
    // De menor a mayor para no chocar con el índice único (planificacion, orden).
    for (const sig of siguientes) await tx.planificacionSemanal.update({ where: { id: sig.id }, data: { orden: sig.orden - 1 } });
  });
  revalidatePath(`/${slug}/planificaciones`);
  return { ok: true };
}
