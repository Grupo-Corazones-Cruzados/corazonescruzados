import type { Bloque, Celda, DocumentoPud, InstitucionConfig, PlanificacionDoc, SemanaDoc } from '../tipos';
import { ETIQUETA_NIVEL } from '@/lib/catalogo';
import { diaDeMes, fechaCorta, hoyEn } from '@/lib/fechas';
import { lineas } from './estrategias';

/**
 * EL MODELO DEL DOCUMENTO. Una sola función decide qué va en cada casilla del
 * formato; el PDF y la vista previa solo lo dibujan. Así los dos dicen lo mismo
 * y un cambio del formato se hace una vez.
 *
 * Lo que se CALCULA y no se guarda (Fernando, 2026-09-15): el número de semanas
 * es la cantidad de planificaciones semanales; el total de periodos es la suma de
 * los periodos de cada semana; la fecha de las firmas es la del día de la
 * descarga; el docente sale del perfil del usuario.
 */
export function armarDocumento(p: {
  planificacion: PlanificacionDoc;
  semanas: SemanaDoc[];
  institucion: InstitucionConfig;
  colorAcento: string;
  zonaHoraria: string;
}): DocumentoPud {
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

  const previos: Bloque[] = [];
  let n = 3;
  if (inst.ejesTransversales) {
    previos.push({
      tipo: 'tabla',
      numero: `${n++}.`,
      titulo: inst.ejesTransversales.titulo,
      anchos: [4, 30, 66],
      filas: [
        [et(''), et('Ejes - Dimensiones'), et('Actividades de formación')],
        ...inst.ejesTransversales.filas.map((f, i) => [{ texto: String(i + 1), centrado: true }, { texto: f.eje }, { texto: '', vinetas: f.actividades }]),
      ],
    });
  }
  if (inst.competencias)
    previos.push({ tipo: 'tabla', numero: `${n++}.`, titulo: inst.competencias.titulo, filas: [inst.competencias.columnas.map((c) => ({ texto: c, etiqueta: true, centrado: true }))] });
  if (inst.inserciones)
    previos.push({ tipo: 'tabla', numero: `${n++}.`, titulo: inst.inserciones.titulo, filas: [inst.inserciones.columnas.map((c) => ({ texto: c, etiqueta: true, centrado: true }))] });
  previos.push({
    tipo: 'tabla',
    numero: `${n++}.`,
    titulo: 'OBJETIVOS',
    anchos: [20, 80],
    filas: [[et('Objetivos específicos de la unidad:'), v(pl.objetivosUnidad)]],
  });
  previos.push({
    tipo: 'tabla',
    numero: `${n++}.`,
    titulo: 'CRITERIOS DE EVALUACIÓN',
    anchos: [20, 80],
    filas: [[et('Criterios específicos a evaluarse en la Unidad:'), v(pl.criteriosEvaluacion)]],
  });
  const numeroPlanificacion = n++;

  const posteriores: Bloque[] = [];
  if (inst.adaptaciones) {
    posteriores.push({
      tipo: 'tabla',
      numero: `${n++}.`,
      titulo: 'ADAPTACIONES CURRICULARES (Ajustes razonables)',
      anchos: [16, 14, 34, 16, 10, 10],
      filas: [
        [et('Especificación de la necesidad educativa'), et('Temas / Contenidos'), et('Estrategias Metodológica'), et('Recursos'), et('Técnica'), et('Instrumento')],
        [v(''), v(''), v(''), v(''), v(''), v('')],
      ],
    });
  }
  if (inst.dece) {
    posteriores.push({
      tipo: 'tabla',
      titulo: 'Espacio solo para el DECE',
      anchos: [15, 35, 50],
      filas: [
        [et('Responsable DECE'), et(''), et('Observaciones por parte del DECE')],
        [et('Nombre:'), v(inst.dece.responsable), v('')],
        [et('Firma:'), v(''), v('')],
        [et('Fecha:'), v(''), v('')],
      ],
    });
  }
  posteriores.push({ tipo: 'texto', numero: `${n++}.`, titulo: 'BIBLIOGRAFÍA', texto: inst.bibliografia.join('\n') });
  posteriores.push({ tipo: 'texto', numero: `${n++}.`, titulo: 'OBSERVACIONES', texto: '' });
  const numeroFirmas = n++;

  const hoy = fechaCorta(hoyEn(p.zonaHoraria));
  const firmas = {
    columnas: [
      { titulo: 'Elaborado por', cargo: 'Docente/s:', nombre: pl.elaboradoPor || pl.docente, fecha: hoy },
      { titulo: 'Revisado Por', cargo: `${pl.revisadoCargo || 'Coordinador de área'}:`, nombre: pl.revisadoPor ?? '', fecha: hoy },
      { titulo: 'Aprobado por', cargo: `${pl.aprobadoCargo || 'Rector/Vicerrector'}:`, nombre: pl.aprobadoPor ?? '', fecha: hoy },
    ],
  };

  return {
    colorCabecera: inst.colorCabecera ?? p.colorAcento,
    institucion: inst,
    tituloDocumento: inst.tituloDocumento,
    datosInformativos,
    tiempo,
    previos,
    numeroPlanificacion,
    semanas,
    posteriores,
    numeroFirmas,
    firmas,
    registro: inst.registroFormato,
  };
}

/** «SEMANA 1: · 26 de mayo · 29 de mayo», la primera casilla de cada fila. */
export function celdaSemana(s: SemanaDoc) {
  return { titulo: `SEMANA ${s.orden}:`, desde: diaDeMes(s.fechaInicio), hasta: diaDeMes(s.fechaFin) };
}

/** Las líneas de un campo «uno por línea». */
export const lineasDe = lineas;
