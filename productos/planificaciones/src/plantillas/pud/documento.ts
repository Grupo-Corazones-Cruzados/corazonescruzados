import type { Bloque, Celda, DocumentoPud, InstitucionConfig, PlanificacionDoc, SemanaDoc } from '../tipos';
import { ETIQUETA_NIVEL } from '@/lib/catalogo';
import { diaDeMes, fechaCorta, hoyEn } from '@/lib/fechas';
import { lineas } from './estrategias';
import { BIBLIOGRAFIA, COMPETENCIAS, EJES_TRANSVERSALES, INSERCIONES } from './contenido-fijo';

/**
 * EL MODELO DEL DOCUMENTO. Una sola función decide qué va en cada casilla del
 * formato; el PDF, el Word y la vista previa solo lo dibujan. Así los tres dicen
 * lo mismo y un cambio del formato se hace una vez.
 *
 * Lo que se CALCULA y no se guarda (Fernando, 2026-09-15): el número de semanas
 * es la cantidad de planificaciones semanales; el total de periodos es la suma de
 * los periodos de cada semana; la fecha de las firmas es la del día de la
 * descarga; el docente sale del perfil del usuario.
 *
 * LO FIJO Y LO VARIABLE (Fernando, 2026-09-16): los ejes transversales, las
 * competencias y las inserciones curriculares son el formato mismo
 * (`contenido-fijo.ts`); la cabecera, el año lectivo, los logos y el DECE son del
 * negocio; el registro de formato es de cada planificación.
 */

/**
 * LOS COLORES DEL FORMATO SON LOS DEL ORIGINAL, NO LOS DEL TEMA (Fernando, 2026-09-16:
 * «los colores del formato deben ser iguales a los que te pasé en los casos de
 * ejemplo y no pueden ser los del tema del tenant»). Medidos sobre los PDF:
 */
export const COLORES_FORMATO: { barra: string; etiqueta: string; cabeceraTabla: string; borde: string; texto: string; gris: string; acentoCabecera: string; fase: string; dua: { letra: string; color: string }[] } = {
  barra: '#EF1230',
  etiqueta: '#BFBFBF',
  cabeceraTabla: '#D9D9D9',
  borde: '#808080',
  texto: '#000000',
  gris: '#404040',
  acentoCabecera: '#C00000',
  fase: '#002060',
  dua: [
    { letra: 'I', color: '#92D050' },
    { letra: 'R', color: '#7030A0' },
    { letra: 'A', color: '#00B0F0' },
  ],
};

export function armarDocumento(p: { planificacion: PlanificacionDoc; semanas: SemanaDoc[]; institucion: InstitucionConfig; zonaHoraria: string }): DocumentoPud {
  const { planificacion: pl, institucion: inst } = p;
  const semanas = p.semanas.filter((s) => s.estado === 'LISTA');
  const et = (texto: string): Celda => ({ texto, etiqueta: true });
  const v = (texto: string | null | undefined): Celda => ({ texto: texto ?? '' });

  const totalPeriodos = semanas.reduce((a, s) => {
    const n = parseInt(String(s.numeroPeriodos ?? '').replace(/[^\d]/g, ''), 10);
    return a + (Number.isFinite(n) ? n : 0);
  }, 0);

  const datosInformativos: Celda[][] = [
    [et('Área de conocimiento:'), v(pl.materia), et('Ámbito de desarrollo/Aprendizaje:'), v(pl.ambito)],
    [et('Nivel / Subnivel Educativo:'), v(ETIQUETA_NIVEL[pl.nivel]), et('Grado / Curso'), v(pl.gradoCurso), et('Paralelo:'), v(pl.paralelo)],
    [et('Docente /es:'), { texto: pl.docente }, et('Jornada:'), v(pl.jornada)],
    [et('N.º de Unidad de Planificación'), v(String(pl.numeroUnidad)), et('Título de la Unidad de Planificación:'), v(pl.tituloUnidad)],
  ];

  // Una sola fila; la última pareja lleva las dos fechas apiladas, como el formato.
  const tiempo: Celda[][] = [
    [
      et('Números de Semanas:'),
      { texto: String(semanas.length), centrado: true },
      et('Número de Periodos para Evaluación e Imprevistos:'),
      { texto: '', centrado: true },
      et('Total de Periodos:'),
      { texto: totalPeriodos ? String(totalPeriodos) : '', centrado: true },
      et('Inicio de PUD:\nFin de PUD:'),
      v(`${diaDeMes(pl.inicioPud)}\n${diaDeMes(pl.finPud)}`),
    ],
  ];

  // ── Las secciones fijas del formato, numeradas como en el original ─────────
  const previos: Bloque[] = [];
  let n = 3;
  previos.push({
    tipo: 'tabla',
    numero: `${n++}.`,
    titulo: EJES_TRANSVERSALES.titulo,
    anchos: [4, 30, 66],
    filas: [
      [et(''), { texto: 'Ejes - Dimensiones', etiqueta: true, centrado: true }, { texto: 'Actividades de formación', etiqueta: true, centrado: true }],
      ...EJES_TRANSVERSALES.filas.map((f, i) => [{ texto: String(i + 1), centrado: true }, { texto: f.eje }, { texto: '', vinetas: f.actividades }]),
    ],
  });
  previos.push({ tipo: 'lateral', numero: `${n++}.`, titulo: COMPETENCIAS.titulo, columnas: COMPETENCIAS.columnas });
  previos.push({ tipo: 'lateral', numero: `${n++}.`, titulo: INSERCIONES.titulo, columnas: INSERCIONES.columnas });
  previos.push({ tipo: 'tabla', numero: `${n++}.`, titulo: 'OBJETIVOS', anchos: [20, 80], filas: [[et('Objetivos específicos de la unidad:'), v(pl.objetivosUnidad)]] });
  previos.push({ tipo: 'tabla', numero: `${n++}.`, titulo: 'CRITERIOS DE EVALUACIÓN', anchos: [20, 80], filas: [[et('Criterios específicos a evaluarse en la Unidad:'), v(pl.criteriosEvaluacion)]] });
  const numeroPlanificacion = n++;

  const posteriores: Bloque[] = [];
  // La cabecera del original combina celdas: «Especificación de la adaptación a ser aplicada»
  // sobre cuatro columnas y «Evaluación» sobre técnica e instrumento. Las filas van vacías.
  const cab = (texto: string, span = 1): Celda => ({ texto, etiqueta: true, centrado: true, medio: true, span });
  posteriores.push({
    tipo: 'tabla',
    numero: `${n++}.`,
    titulo: 'ADAPTACIONES CURRICULARES (Ajustes razonables grado 3)',
    anchos: [13, 9, 52, 12, 7, 7],
    filas: [
      [cab('Especificación de la necesidad educativa'), cab('Especificación de la adaptación a ser aplicada', 5)],
      [cab(''), cab('Temas / Contenidos'), cab('Estrategias Metodológica'), cab('Recursos'), cab('Evaluación', 2)],
      [cab(''), cab(''), cab(''), cab(''), cab('Técnica'), cab('Instrumento')],
      [v(''), v(''), v(''), v(''), v(''), v('')],
      [v(''), v(''), v(''), v(''), v(''), v('')],
      [v(''), v(''), v(''), v(''), v(''), v('')],
    ],
    altoMinMm: 5,
  });
  // AJUSTES RAZONABLES (Fernando, 2026-09-16): una línea por estudiante con condición
  // especial y por semana; la estrategia la redacta el agente, los indicadores quedan
  // vacíos hasta que se sepa de dónde salen. En el original reinicia la numeración («1.»).
  const filasAjustes: Celda[][] = semanas.flatMap((s) =>
    s.ajustes.map((a) => [
      { texto: `Semana ${s.orden}`, centrado: true, medio: true },
      { texto: a.iniciales, centrado: true, medio: true },
      { texto: a.condicion, centrado: true, medio: true },
      { texto: a.nivelAjuste, centrado: true, medio: true },
      { texto: a.enfoque, medio: true },
      { texto: a.estrategia },
      { texto: a.indicadores },
    ]),
  );
  posteriores.push({
    tipo: 'tabla',
    numero: '1.',
    titulo: 'AJUSTES RAZONABLES',
    anchos: [9, 9, 17, 14, 17, 17, 17],
    filas: [
      [cab('Semana No.'), cab('Estudiante'), cab('Condición Reportada'), cab('Nivel de Ajuste Razonable'), cab('Enfoque'), cab('Estrategia empleada'), cab('Indicadores de Evaluación')],
      ...(filasAjustes.length ? filasAjustes : [[v(''), v(''), v(''), v(''), v(''), v(''), v('')]]),
    ],
    altoMinMm: 8,
  });
  posteriores.push({
    tipo: 'tabla',
    titulo: 'Espacio solo para el DECE',
    anchos: [8, 22, 70],
    filas: [
      [{ texto: 'Responsable DECE', etiqueta: true, centrado: true }, { texto: '', etiqueta: true }, { texto: 'Observaciones por parte del DECE', etiqueta: true, centrado: true }],
      [et('Nombre:'), { texto: pl.deceNombre ?? '', centrado: true }, v('')],
      [et('Firma:'), v(''), v('')],
      [et('Fecha:'), v(''), v('')],
    ],
  });
  // En el original la bibliografía y las observaciones reinician la numeración (2., 3.); las firmas son la 4.
  posteriores.push({ tipo: 'texto', numero: '2.', titulo: 'BIBLIOGRAFÍA', texto: BIBLIOGRAFIA.join('\n') });
  posteriores.push({ tipo: 'lateral-texto', numero: '3.', titulo: 'OBSERVACIONES', texto: '', altoMinMm: 7 });
  const numeroFirmas = 4;

  const hoy = fechaCorta(hoyEn(p.zonaHoraria));
  const firmas = {
    columnas: [
      { titulo: 'Elaborado por', cargo: 'Docente/s:', nombre: pl.elaboradoPor || pl.docente, fecha: hoy },
      { titulo: 'Revisado Por', cargo: `${pl.revisadoCargo || 'Coordinador de área'}:`, nombre: pl.revisadoPor ?? '', fecha: hoy },
      { titulo: 'Aprobado por', cargo: `${pl.aprobadoCargo || 'Rector/Vicerrector'}:`, nombre: pl.aprobadoPor ?? '', fecha: hoy },
    ],
  };

  const r = pl.registro;
  const registro = {
    titulo: r.titulo || `Planificación Curricular Anual ${inst.anioLectivo}`.trim(),
    elaboradoPor: { cargo: r.elaboradoCargo || 'Coordinación Pedagógica', nombre: r.elaboradoNombre ?? '', fecha: r.elaboradoFecha ?? '' },
    aprobadoPor: { cargo: r.aprobadoCargo || 'Dirección General', nombre: r.aprobadoNombre ?? '', fecha: r.aprobadoFecha ?? '' },
  };

  return {
    colorCabecera: COLORES_FORMATO.barra,
    institucion: inst,
    tituloDocumento: 'PLAN UNIDAD DIDÁCTICA',
    datosInformativos,
    tiempo,
    previos,
    numeroPlanificacion,
    semanas,
    posteriores,
    numeroFirmas,
    firmas,
    registro,
  };
}

/** «SEMANA 1: · 26 de mayo · 29 de mayo», la primera casilla de cada fila. */
export function celdaSemana(s: SemanaDoc) {
  return { titulo: `SEMANA ${s.orden}:`, desde: diaDeMes(s.fechaInicio), hasta: diaDeMes(s.fechaFin) };
}

/** Las líneas de un campo «uno por línea». */
export const lineasDe = lineas;
