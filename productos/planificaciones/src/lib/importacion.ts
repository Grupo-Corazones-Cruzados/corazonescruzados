import { prisma } from '@/lib/db';
import { correrAgente } from '@/lib/ia';
import { aFechaSql, esDia, sumarDias } from '@/lib/fechas';
import { NIVELES } from '@/lib/catalogo';
import { serializarEstrategias } from '@/plantillas/pud/estrategias';
import { ESQUEMA_IMPORTACION, SISTEMA_IMPORTACION, type SalidaImportacion } from '@/plantillas/pud/importar';
import type { Nivel } from '@/generated/prisma/enums';

/**
 * IMPORTAR UN FORMATO YA HECHO (Fernando, 2026-09-17). La acción crea la
 * planificación en LEYENDO con el texto del archivo y llama a esto fuera de la
 * petición (`after()`): el agente transcribe la cabecera y cada fila «SEMANA N»
 * y aquí se vuelcan a la planificación y a sus semanas (LISTA, sin generar). Las
 * destrezas que el formato trae y la planificación no tiene se añaden a su
 * conjunto, con la descripción del formato. Las semanas importadas cuentan
 * contra el tope semanal como cualquier otra: si no alcanza, se importan las
 * que quepan y se dice cuántas quedaron fuera.
 */
export async function importarFormato(planificacionId: number, texto: string, cupoRestante: number | null): Promise<void> {
  const pl = await prisma.planificacion.findUnique({ where: { id: planificacionId }, include: { destrezas: true } });
  if (!pl) return;
  const fallar = (error: string) => prisma.planificacion.update({ where: { id: planificacionId }, data: { importacionEstado: 'ERROR', importacionError: error } });

  const r = await correrAgente<SalidaImportacion>({
    sistema: SISTEMA_IMPORTACION,
    encargo: `TEXTO DEL FORMATO (${pl.importacionArchivo ?? 'archivo'}):\n\n${texto}\n\nTranscríbelo al JSON pedido.`,
    esquema: ESQUEMA_IMPORTACION,
    esfuerzo: 'low',
    maxSalida: 60_000,
    claveCache: 'planificaciones-importar',
  });
  if (!r.ok) return void (await fallar(r.error));
  const s = r.salida;
  if (!s.semanas.length) return void (await fallar('El agente no encontró ninguna fila «SEMANA N» en el archivo. Comprueba que sea un formato PUD como el de la aplicación.'));

  const c = s.cabecera;
  const hoy = new Date().toISOString().slice(0, 10);
  const inicioPud = esDia(c.inicioPud) ? c.inicioPud : esDia(s.semanas[0].fechaInicio) ? s.semanas[0].fechaInicio : hoy;
  let finPud = esDia(c.finPud) ? c.finPud : esDia(s.semanas.at(-1)!.fechaFin) ? s.semanas.at(-1)!.fechaFin : sumarDias(inicioPud, 34);
  if (finPud < inicioPud) finPud = sumarDias(inicioPud, 34);
  const nivel: Nivel = (NIVELES as string[]).includes(c.nivel) ? (c.nivel as Nivel) : pl.nivel;
  const o = (t: string) => (t && t.trim() ? t.trim() : null);

  // Las destrezas del formato que la planificación no tenga se añaden a su conjunto.
  const norm = (x: string) => x.trim().toUpperCase().replace(/\.$/, '');
  const conocidas = new Map(pl.destrezas.map((d) => [norm(d.codigo), d.id]));
  let orden = pl.destrezas.length;
  for (const sem of s.semanas) {
    for (const d of sem.destrezas) {
      const codigo = d.codigo.trim();
      if (!codigo || conocidas.has(norm(codigo))) continue;
      const nueva = await prisma.destreza.create({ data: { inquilinoId: pl.inquilinoId, planificacionId: pl.id, nivel, materia: pl.materia, codigo, descripcion: d.descripcion.trim() || codigo, orden: orden++ } });
      conocidas.set(norm(codigo), nueva.id);
    }
  }

  // LOS AJUSTES RAZONABLES DEL FORMATO (Fernando, 2026-09-17: «la sección de ajustes
  // razonables no se exportó»): cada fila es un estudiante del grado con condición
  // especial; si no existe uno con esas iniciales, se crea con los datos del formato
  // (el nombre completo lo pone luego el docente en «Estudiantes»).
  const gradoId = pl.materiaGradoId ? (await prisma.materiaGrado.findUnique({ where: { id: pl.materiaGradoId }, select: { gradoId: true } }))?.gradoId ?? null : null;
  const estudiantePorIniciales = new Map<string, number>();
  if (gradoId) {
    const existentes = await prisma.estudiante.findMany({ where: { gradoId, condicionEspecial: true }, select: { id: true, iniciales: true } });
    for (const e of existentes) if (e.iniciales) estudiantePorIniciales.set(norm(e.iniciales), e.id);
    for (const sem of s.semanas) {
      for (const a of sem.ajustes ?? []) {
        const ini = a.iniciales.trim();
        if (!ini || estudiantePorIniciales.has(norm(ini))) continue;
        const nuevo = await prisma.estudiante.create({
          data: { inquilinoId: pl.inquilinoId, gradoId, nombre: ini, condicionEspecial: true, iniciales: ini.slice(0, 20), condicion: o(a.condicion)?.slice(0, 200) ?? null, nivelAjuste: o(a.nivelAjuste)?.slice(0, 80) ?? null, enfoque: o(a.enfoque) },
        });
        estudiantePorIniciales.set(norm(ini), nuevo.id);
      }
    }
  }

  // Cuántas caben en el cupo de la semana (las importadas cuentan como cualquier otra).
  const caben = cupoRestante === null ? s.semanas.length : Math.max(0, Math.min(s.semanas.length, cupoRestante));
  const fueraDeCupo = s.semanas.length - caben;
  let anterior: string | null = null;
  const semanas = s.semanas.slice(0, caben).map((sem, i) => {
    const fechaInicio = esDia(sem.fechaInicio) ? sem.fechaInicio : anterior ? sumarDias(anterior, 3) : inicioPud;
    let fechaFin = esDia(sem.fechaFin) ? sem.fechaFin : sumarDias(fechaInicio, 4);
    if (fechaFin < fechaInicio) fechaFin = sumarDias(fechaInicio, 4);
    anterior = fechaFin;
    const ids = [...new Set(sem.destrezas.map((d) => conocidas.get(norm(d.codigo))).filter((x): x is number => typeof x === 'number'))];
    return {
      inquilinoId: pl.inquilinoId,
      planificacionId: pl.id,
      usuarioId: pl.usuarioId,
      orden: i + 1,
      estado: 'LISTA' as const,
      indicaciones: `Importada del formato «${pl.importacionArchivo ?? 'archivo'}» (semana ${i + 1} del original).`,
      fechaInicio: aFechaSql(fechaInicio),
      fechaFin: aFechaSql(fechaFin),
      tema: sem.tema.trim(),
      numeroPeriodos: o(sem.numeroPeriodos),
      objetivosTema: sem.objetivosTema.trim(),
      estrategias: serializarEstrategias(sem.estrategias),
      recursos: sem.recursos.map((x) => x.trim()).filter(Boolean).join('\n'),
      tecnica: sem.tecnica.map((x) => x.trim()).filter(Boolean).join('\n'),
      instrumento: sem.instrumento.map((x) => x.trim()).filter(Boolean).join('\n'),
      uso: r.uso as never,
      generadaEn: new Date(),
      destrezas: { create: ids.map((destrezaId, k) => ({ destrezaId, orden: k })) },
      ajustes: {
        create: (sem.ajustes ?? [])
          .map((a, k) => ({ estudianteId: estudiantePorIniciales.get(norm(a.iniciales.trim())), estrategia: a.estrategia.trim(), indicadores: o(a.indicadores), orden: k }))
          .filter((a): a is { estudianteId: number; estrategia: string; indicadores: string | null; orden: number } => typeof a.estudianteId === 'number' && a.estrategia.length > 0),
      },
    };
  });

  await prisma.$transaction([
    prisma.planificacion.update({
      where: { id: pl.id },
      data: {
        nivel,
        ambito: o(c.ambito) ?? pl.ambito,
        numeroUnidad: Number.isInteger(c.numeroUnidad) && c.numeroUnidad > 0 && c.numeroUnidad < 100 ? c.numeroUnidad : pl.numeroUnidad,
        tituloUnidad: o(c.tituloUnidad) ?? pl.tituloUnidad,
        inicioPud: aFechaSql(inicioPud),
        finPud: aFechaSql(finPud),
        gradoCurso: pl.gradoCurso ?? o(c.gradoCurso),
        paralelo: o(c.paralelo),
        jornada: o(c.jornada),
        objetivosUnidad: o(c.objetivosUnidad),
        criteriosEvaluacion: o(c.criteriosEvaluacion),
        elaboradoPor: o(c.elaboradoPor) ?? pl.elaboradoPor,
        revisadoPor: o(c.revisadoPor),
        revisadoCargo: o(c.revisadoCargo) ?? pl.revisadoCargo,
        aprobadoPor: o(c.aprobadoPor),
        aprobadoCargo: o(c.aprobadoCargo) ?? pl.aprobadoCargo,
        deceNombre: o(c.deceNombre),
        importacionEstado: null,
        importacionError: fueraDeCupo > 0 ? `Se importaron ${caben} de ${s.semanas.length} semanas: el tope semanal del plan no dio para más. Las otras ${fueraDeCupo} puedes crearlas la semana que viene.` : null,
      },
    }),
    ...semanas.map((data) => prisma.planificacionSemanal.create({ data })),
  ]);
}

export function importarEnSegundoPlano(planificacionId: number, texto: string, cupoRestante: number | null) {
  return importarFormato(planificacionId, texto, cupoRestante).catch(async (e) => {
    console.error('[importacion]', planificacionId, e);
    await prisma.planificacion.update({ where: { id: planificacionId }, data: { importacionEstado: 'ERROR', importacionError: `Fallo inesperado: ${e?.message ?? e}` } }).catch(() => {});
  });
}
