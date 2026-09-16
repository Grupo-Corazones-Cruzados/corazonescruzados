import { prisma } from '@/lib/db';
import { correrAgente, iaConfigurada, type HerramientaFuncion, type UsoIA } from '@/lib/ia';
import { buscarFragmentos } from '@/lib/adjuntos';
import { plantillaDe } from '@/plantillas';
import type { SalidaSemana } from '@/plantillas/pud/esquema';
import { ETIQUETA_NIVEL } from '@/lib/catalogo';
import { destrezasDe } from '@/lib/destrezas';
import { periodosDe, ETIQUETA_DIA } from '@/lib/horario';
import { estudiantesConCondicion } from '@/lib/estudiantes';
import { aDia, aFechaSql, esDia, sumarDias } from '@/lib/fechas';

/**
 * LA GENERACIÓN DE UNA SEMANA. Se llama fuera de la petición (`after()`), así que
 * el docente no espera con el formulario abierto: la fila nace PENDIENTE, pasa a
 * GENERANDO y termina LISTA o ERROR, y la pantalla la va consultando.
 *
 * Todo lo que el agente necesita se arma aquí: la unidad, las semanas ya hechas
 * (para que continúe y no repita), las destrezas disponibles de esa materia y
 * nivel, los adjuntos (con sus fragmentos más cercanos a las indicaciones) y las
 * indicaciones del docente. Las destrezas que devuelve se validan contra la
 * tabla: un código que no existe se descarta, nunca se inventa una fila.
 */
export async function generarSemana(semanaId: number): Promise<void> {
  const semana = await prisma.planificacionSemanal.findUnique({
    where: { id: semanaId },
    include: {
      planificacion: { include: { usuario: true, inquilino: true } },
      adjuntos: { select: { id: true, nombre: true, fragmentos: true } },
    },
  });
  if (!semana || semana.estado === 'LISTA') return;
  const marcarError = (error: string, uso?: unknown) =>
    prisma.planificacionSemanal.update({ where: { id: semanaId }, data: { estado: 'ERROR', error, uso: uso as never } });

  if (!iaConfigurada()) {
    await marcarError('El servicio de redacción no está configurado (falta la clave de OpenAI). Avisa al Grupo Corazones Cruzados.');
    return;
  }
  await prisma.planificacionSemanal.update({ where: { id: semanaId }, data: { estado: 'GENERANDO', error: null } });

  const pl = semana.planificacion;
  const plantilla = plantillaDe(pl.plantilla);

  // Las destrezas de ESTA planificación (Fernando, 2026-09-16): el agente elige una
  // de ellas según lo que dictó el docente. Si no hay ninguna, no elige ninguna.
  const destrezas = await destrezasDe(pl.id);

  const anteriores = await prisma.planificacionSemanal.findMany({
    where: { planificacionId: pl.id, estado: 'LISTA', id: { not: semanaId } },
    orderBy: { orden: 'asc' },
    include: { destrezas: { include: { destreza: { select: { codigo: true } } } } },
  });

  // Semana propuesta: la que sigue a la última, o la primera del PUD.
  const ultima = anteriores.filter((s) => s.fechaFin).sort((a, b) => b.fechaFin!.getTime() - a.fechaFin!.getTime())[0];
  const inicioPropuesto = semana.fechaInicio
    ? aDia(semana.fechaInicio)
    : ultima?.fechaFin
      ? siguienteLunes(aDia(ultima.fechaFin))
      : aDia(pl.inicioPud);
  const finPropuesto = semana.fechaFin ? aDia(semana.fechaFin) : sumarDias(inicioPropuesto, 4);

  // El número de periodos SALE DEL HORARIO del docente (Fernando, 2026-09-16): las
  // horas que da de esa materia en la semana. No lo deduce el agente.
  const periodos = pl.materiaGradoId ? await periodosDe(pl.usuarioId, pl.materiaGradoId) : { horas: 0, sesiones: [] };
  const numeroPeriodos = periodos.horas > 0 ? `${periodos.horas} ${periodos.horas === 1 ? 'hora' : 'horas'}` : '1 hora';

  // Los estudiantes con condición especial del grado (módulo «Estudiantes»): por
  // cada uno, una línea de «Ajustes razonables» de esta semana (Fernando, 2026-09-16).
  const estudiantes = await estudiantesConCondicion(pl.materiaGradoId);

  const adjuntoIds = semana.adjuntos.map((a) => a.id);
  let fragmentosCercanos: { adjunto: string; texto: string }[] = [];
  if (adjuntoIds.length) {
    try {
      fragmentosCercanos = (await buscarFragmentos(adjuntoIds, `${pl.materia}. ${semana.indicaciones}`, 6)).map((f) => ({ adjunto: f.adjunto, texto: f.texto }));
    } catch (e: any) {
      console.error('[generacion] fragmentos', e?.message);
    }
  }

  const herramientas: HerramientaFuncion[] = adjuntoIds.length
    ? [
        {
          name: 'buscar_en_adjuntos',
          description: 'Busca en los archivos que adjuntó el docente los fragmentos más relacionados con una consulta (páginas, fichas, contenidos, vocabulario). Devuelve hasta 6 fragmentos con el nombre del archivo.',
          parameters: { type: 'object', additionalProperties: false, required: ['consulta'], properties: { consulta: { type: 'string', description: 'Qué se busca, en una frase concreta.' } } },
          ejecutar: async (args) => {
            const r = await buscarFragmentos(adjuntoIds, String(args.consulta ?? ''), 6);
            return r.length ? r.map((f, i) => `[${i + 1}] (${f.adjunto}, fragmento ${f.orden + 1})\n${f.texto}`).join('\n\n') : 'No hay fragmentos relacionados en los adjuntos.';
          },
        },
      ]
    : [];

  const encargo = plantilla.encargo({
    institucion: pl.inquilino.nombre,
    nivel: ETIQUETA_NIVEL[pl.nivel],
    materia: pl.materia,
    ambito: pl.ambito,
    gradoCurso: pl.gradoCurso,
    tituloUnidad: pl.tituloUnidad,
    numeroUnidad: pl.numeroUnidad,
    inicioPud: aDia(pl.inicioPud),
    finPud: aDia(pl.finPud),
    objetivosUnidad: pl.objetivosUnidad,
    criteriosEvaluacion: pl.criteriosEvaluacion,
    numeroSemana: semana.orden,
    semanaPropuesta: { inicio: inicioPropuesto, fin: finPropuesto },
    periodos: periodos.horas > 0 ? { horas: periodos.horas, sesiones: periodos.sesiones.map((s) => ({ numero: s.numero, dia: ETIQUETA_DIA[s.dia].toLowerCase(), hora: `${String(s.hora).padStart(2, '0')}:00` })) } : null,
    semanasAnteriores: anteriores.map((s) => ({
      orden: s.orden,
      tema: s.tema,
      fechaInicio: s.fechaInicio ? aDia(s.fechaInicio) : null,
      fechaFin: s.fechaFin ? aDia(s.fechaFin) : null,
      destrezas: s.destrezas.map((d) => d.destreza.codigo),
      objetivos: s.objetivosTema,
    })),
    destrezas: destrezas.map((d) => ({ codigo: d.codigo, descripcion: d.descripcion })),
    adjuntos: semana.adjuntos.map((a) => ({ nombre: a.nombre, fragmentos: a.fragmentos })),
    fragmentosCercanos,
    estudiantes: estudiantes.map((e) => ({ iniciales: e.iniciales ?? '', condicion: e.condicion ?? '', nivelAjuste: e.nivelAjuste ?? '', enfoque: e.enfoque ?? '' })),
    indicaciones: semana.indicaciones,
  });

  const r = await correrAgente<SalidaSemana>({
    sistema: plantilla.sistema(),
    encargo,
    esquema: plantilla.esquema,
    herramientas,
    busquedaWeb: true,
    esfuerzo: 'medium',
    maxSalida: 20_000,
    claveCache: `planificaciones-${plantilla.clave}`,
  });

  if (!r.ok) {
    await marcarError(r.error, r.uso);
    return;
  }
  let s = r.salida;
  let uso = r.uso;

  // El agente tiende a saltarse la activación de la última sesión. Se comprueba
  // que cada fase cubra todas las sesiones y, si falta alguna, se le pide UNA vez
  // que complete su propia respuesta (el ejemplo 9 de la docente numera 1., 2., 3.
  // en las tres fases; Fernando, 2026-09-16).
  const faltan = sesionesQueFaltan(s, periodos.horas);
  if (faltan.length) {
    const r2 = await correrAgente<SalidaSemana>({
      sistema: plantilla.sistema(),
      encargo: `${encargo}\n\nTU RESPUESTA ANTERIOR (JSON):\n${JSON.stringify(s)}\n\nESTÁ INCOMPLETA: ${faltan.join('; ')}. Devuelve el MISMO JSON completo, añadiendo las actividades que faltan con su número de sesión al inicio («3. …») y sin cambiar lo demás.`,
      esquema: plantilla.esquema,
      herramientas,
      busquedaWeb: false,
      esfuerzo: 'low',
      maxSalida: 20_000,
      claveCache: `planificaciones-${plantilla.clave}`,
    });
    if (r2.ok) {
      s = r2.salida;
      uso = sumarUso(r.uso, r2.uso);
    }
  }

  // Validar las destrezas contra la tabla: el agente elige, no inventa.
  const porCodigo = new Map(destrezas.map((d) => [d.codigo.trim().toUpperCase(), d]));
  const elegidas = [...new Set(s.destrezas.map((c) => c.trim().toUpperCase()))]
    .map((c) => porCodigo.get(c) ?? porCodigo.get(c.replace(/\.$/, '')) ?? porCodigo.get(`${c}.`))
    .filter((d): d is NonNullable<typeof d> => Boolean(d))
    // UNA destreza por semana (Fernando, 2026-09-16).
    .slice(0, 1);

  const fechaInicio = esDia(s.fechaInicio) ? s.fechaInicio : inicioPropuesto;
  let fechaFin = esDia(s.fechaFin) ? s.fechaFin : finPropuesto;
  if (fechaFin < fechaInicio) fechaFin = sumarDias(fechaInicio, 4);

  // Los ajustes razonables se casan por iniciales (y, si el agente las cambió, por posición).
  const devueltos = s.ajustesRazonables ?? [];
  const ajustes = estudiantes
    .map((e, i) => {
      const norm = (x: string) => x.replace(/[\s.]/g, '').toUpperCase();
      const a = devueltos.find((x) => norm(x.iniciales) === norm(e.iniciales ?? '')) ?? devueltos[i];
      return a?.estrategia?.trim() ? { estudianteId: e.id, estrategia: a.estrategia.trim(), orden: i } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const columnas = plantilla.aColumnas(s);
  await prisma.$transaction([
    prisma.planificacionDestreza.deleteMany({ where: { semanaId } }),
    prisma.ajusteRazonable.deleteMany({ where: { semanaId } }),
    prisma.planificacionSemanal.update({
      where: { id: semanaId },
      data: {
        estado: 'LISTA',
        error: null,
        fechaInicio: aFechaSql(fechaInicio),
        fechaFin: aFechaSql(fechaFin),
        ...columnas,
        numeroPeriodos,
        referencias: (s.referencias ?? []).slice(0, 12) as never,
        uso: uso as never,
        generadaEn: new Date(),
        destrezas: { create: elegidas.map((d, i) => ({ destrezaId: d.id, orden: i })) },
        ajustes: { create: ajustes },
      },
    }),
  ]);
}

/** Las fases que no cubren todas las sesiones («ACTIVACIÓN no tiene la sesión 3»). Con una sola sesión no se numera y no hay nada que comprobar. */
function sesionesQueFaltan(s: SalidaSemana, horas: number): string[] {
  if (horas <= 1) return [];
  const fases: [string, string[]][] = [
    ['ACTIVACIÓN', s.estrategias.activacion],
    ['CONSTRUCCIÓN', s.estrategias.construccion],
    ['CONSOLIDACIÓN', s.estrategias.consolidacion],
  ];
  const faltan: string[] = [];
  for (const [nombre, actividades] of fases) {
    const texto = actividades.join('\n');
    const sinSesion = [];
    for (let k = 1; k <= horas; k++) if (!new RegExp(`(^|\\n)${k}\\. `).test(texto)) sinSesion.push(k);
    if (sinSesion.length) faltan.push(`en ${nombre} falta${sinSesion.length > 1 ? 'n' : ''} la${sinSesion.length > 1 ? 's' : ''} sesi${sinSesion.length > 1 ? 'ones' : 'ón'} ${sinSesion.join(', ')}`);
  }
  return faltan;
}

function sumarUso(a: UsoIA, b: UsoIA): UsoIA {
  return {
    ...a,
    tokensEntrada: a.tokensEntrada + b.tokensEntrada,
    tokensSalida: a.tokensSalida + b.tokensSalida,
    tokensCache: a.tokensCache + b.tokensCache,
    busquedasWeb: a.busquedasWeb + b.busquedasWeb,
    llamadasHerramientas: a.llamadasHerramientas + b.llamadasHerramientas,
    vueltas: a.vueltas + b.vueltas,
    duracionMs: a.duracionMs + b.duracionMs,
  };
}

/** El lunes siguiente a un día (si el día es viernes 29, el lunes 1). */
function siguienteLunes(dia: string) {
  const ds = aFechaSql(dia).getUTCDay(); // 0 domingo … 6 sábado
  const hastaLunes = ds === 0 ? 1 : 8 - ds;
  return sumarDias(dia, hastaLunes);
}

/**
 * Se dispara sin esperar. Un fallo inesperado (no de la API: de código) queda en
 * la fila como ERROR con su mensaje, para que no parezca que sigue redactando.
 */
export function generarEnSegundoPlano(semanaId: number) {
  return generarSemana(semanaId).catch(async (e) => {
    console.error('[generacion]', semanaId, e);
    await prisma.planificacionSemanal
      .update({ where: { id: semanaId }, data: { estado: 'ERROR', error: `Fallo inesperado: ${e?.message ?? e}` } })
      .catch(() => {});
  });
}
