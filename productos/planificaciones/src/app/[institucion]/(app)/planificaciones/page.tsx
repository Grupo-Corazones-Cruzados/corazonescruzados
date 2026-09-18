import { exigirContexto, esDuenoOAdmin } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { cupoDeGeneraciones, topesDe } from '@/lib/limites';
import { cargarDocumento } from '@/lib/documento';
import { listaDePlantillas } from '@/plantillas';
import { VistaPrevia } from '@/plantillas/pud/VistaPrevia';
import { aDia } from '@/lib/fechas';
import { destrezasDe } from '@/lib/destrezas';
import { materiasDelDocente } from '@/lib/horario';
import PlanificacionesCliente, { type PlanificacionVista, type SemanaVista } from './PlanificacionesCliente';
import type { DestrezaVista } from '@/componentes/PanelDestrezas';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Planificaciones' };

type Busqueda = { quien?: string; q?: string; p?: string; s?: string; vista?: string; nueva?: string };

/**
 * EL MÓDULO ENTERO EN UNA PÁGINA (Fernando, 2026-09-15): a la izquierda las
 * planificaciones (las mías o las de todos), en el medio las semanas de la
 * elegida y a la derecha los campos de la semana o la vista previa del formato
 * con todas las semanas. «Configurar» solo con una planificación elegida.
 *
 * El estado de la selección va en la dirección (?p=&s=&vista=), así la página
 * se puede enlazar desde el tablero y sobrevive a un `router.refresh()`.
 */
export default async function PaginaPlanificaciones({ params, searchParams }: { params: Promise<{ institucion: string }>; searchParams: Promise<Busqueda> }) {
  const { institucion } = await params;
  const b = await searchParams;
  const { inquilino, sesion } = await exigirContexto(institucion, 'planificar');

  const todas = b.quien === 'todas';
  const q = (b.q ?? '').trim();
  const lista = await prisma.planificacion.findMany({
    where: {
      inquilinoId: inquilino.id,
      ...(todas ? {} : { usuarioId: sesion.uid }),
      ...(q ? { OR: [{ materia: { contains: q, mode: 'insensitive' } }, { tituloUnidad: { contains: q, mode: 'insensitive' } }, { usuario: { nombre: { contains: q, mode: 'insensitive' } } }] } : {}),
    },
    orderBy: { actualizado: 'desc' },
    include: { usuario: { select: { id: true, nombre: true, profesion: true } }, _count: { select: { semanas: true } } },
    take: 200,
  });

  const planificaciones: PlanificacionVista[] = lista.map((p) => ({
    id: p.id,
    plantilla: p.plantilla,
    nivel: p.nivel,
    materia: p.materia,
    ambito: p.ambito,
    numeroUnidad: p.numeroUnidad,
    tituloUnidad: p.tituloUnidad,
    inicioPud: aDia(p.inicioPud),
    finPud: aDia(p.finPud),
    gradoCurso: p.gradoCurso,
    paralelo: p.paralelo,
    jornada: p.jornada,
    objetivosUnidad: p.objetivosUnidad,
    criteriosEvaluacion: p.criteriosEvaluacion,
    elaboradoPor: p.elaboradoPor,
    revisadoPor: p.revisadoPor,
    revisadoCargo: p.revisadoCargo,
    aprobadoPor: p.aprobadoPor,
    aprobadoCargo: p.aprobadoCargo,
    registroTitulo: p.registroTitulo,
    registroElaboradoCargo: p.registroElaboradoCargo,
    registroElaboradoNombre: p.registroElaboradoNombre,
    registroElaboradoFecha: p.registroElaboradoFecha,
    registroAprobadoCargo: p.registroAprobadoCargo,
    registroAprobadoNombre: p.registroAprobadoNombre,
    registroAprobadoFecha: p.registroAprobadoFecha,
    deceNombre: p.deceNombre,
    importacionEstado: p.importacionEstado,
    importacionError: p.importacionError,
    importacionArchivo: p.importacionArchivo,
    docente: [p.usuario.profesion, p.usuario.nombre].filter(Boolean).join(' '),
    usuarioId: p.usuario.id,
    semanas: p._count.semanas,
    actualizado: p.actualizado.toISOString(),
    puedoCambiar: esDuenoOAdmin(sesion, p),
  }));

  // La planificación elegida (por la dirección, o la primera de la lista).
  const pId = Number(b.p) || planificaciones[0]?.id || null;
  const elegida = pId ? planificaciones.find((p) => p.id === pId) ?? null : null;
  // Si la dirección apunta a una que no está en la lista (p. ej. de otro docente con «mías»), se carga igual.
  let extra: PlanificacionVista | null = null;
  if (pId && !elegida) {
    const p = await prisma.planificacion.findFirst({ where: { id: pId, inquilinoId: inquilino.id }, include: { usuario: { select: { id: true, nombre: true, profesion: true } }, _count: { select: { semanas: true } } } });
    if (p)
      extra = {
        id: p.id, plantilla: p.plantilla, nivel: p.nivel, materia: p.materia, ambito: p.ambito, numeroUnidad: p.numeroUnidad, tituloUnidad: p.tituloUnidad,
        inicioPud: aDia(p.inicioPud), finPud: aDia(p.finPud), gradoCurso: p.gradoCurso, paralelo: p.paralelo, jornada: p.jornada,
        objetivosUnidad: p.objetivosUnidad, criteriosEvaluacion: p.criteriosEvaluacion, elaboradoPor: p.elaboradoPor, revisadoPor: p.revisadoPor,
        revisadoCargo: p.revisadoCargo, aprobadoPor: p.aprobadoPor, aprobadoCargo: p.aprobadoCargo,
        registroTitulo: p.registroTitulo, registroElaboradoCargo: p.registroElaboradoCargo, registroElaboradoNombre: p.registroElaboradoNombre, registroElaboradoFecha: p.registroElaboradoFecha, registroAprobadoCargo: p.registroAprobadoCargo, registroAprobadoNombre: p.registroAprobadoNombre, registroAprobadoFecha: p.registroAprobadoFecha, deceNombre: p.deceNombre,
        importacionEstado: p.importacionEstado, importacionError: p.importacionError, importacionArchivo: p.importacionArchivo,
        docente: [p.usuario.profesion, p.usuario.nombre].filter(Boolean).join(' '), usuarioId: p.usuario.id, semanas: p._count.semanas,
        actualizado: p.actualizado.toISOString(), puedoCambiar: esDuenoOAdmin(sesion, p),
      };
  }
  const actual = elegida ?? extra;

  let semanas: SemanaVista[] = [];
  let destrezasCatalogo: DestrezaVista[] = [];
  let vistaPrevia: React.ReactNode = null;
  if (actual) {
    const filas = await prisma.planificacionSemanal.findMany({
      where: { planificacionId: actual.id, inquilinoId: inquilino.id },
      orderBy: { orden: 'asc' },
      include: { destrezas: { orderBy: { orden: 'asc' }, include: { destreza: true } }, ajustes: { orderBy: { orden: 'asc' }, include: { estudiante: { select: { nombre: true, iniciales: true, condicion: true } } } }, adjuntos: { select: { id: true, nombre: true, fragmentos: true } }, usuario: { select: { nombre: true } } },
    });
    semanas = filas.map((s) => ({
      id: s.id,
      orden: s.orden,
      estado: s.estado,
      error: s.error,
      indicaciones: s.indicaciones,
      fechaInicio: s.fechaInicio ? aDia(s.fechaInicio) : null,
      fechaFin: s.fechaFin ? aDia(s.fechaFin) : null,
      tema: s.tema,
      numeroPeriodos: s.numeroPeriodos,
      objetivosTema: s.objetivosTema,
      estrategias: s.estrategias,
      recursos: s.recursos,
      tecnica: s.tecnica,
      instrumento: s.instrumento,
      referencias: (s.referencias as { titulo: string; url: string; uso: string }[] | null) ?? [],
      uso: (s.uso as Record<string, number> | null) ?? null,
      destrezas: s.destrezas.map((d) => ({ id: d.destreza.id, codigo: d.destreza.codigo, descripcion: d.destreza.descripcion, imagenUrl: d.destreza.imagenUrl })),
      ajustes: s.ajustes.map((a) => ({ id: a.id, estudiante: a.estudiante.nombre, iniciales: a.estudiante.iniciales ?? '', condicion: a.estudiante.condicion ?? '', estrategia: a.estrategia })),
      adjuntos: s.adjuntos,
      docente: s.usuario.nombre,
      creado: s.creado.toISOString(),
      generadaEn: s.generadaEn?.toISOString() ?? null,
    }));

    // Las destrezas de ESTA planificación (Fernando, 2026-09-16): las que el agente
    // puede elegir y las que se editan desde el botón «Destrezas».
    const cat = await destrezasDe(actual.id);
    destrezasCatalogo = cat.map((d) => ({ id: d.id, codigo: d.codigo, descripcion: d.descripcion, imagenUrl: d.imagenUrl, criterio: d.criterio, indicador: d.indicador, activa: d.activa, materia: d.materia }));

    if (b.vista === 'previa') {
      const cargado = await cargarDocumento(inquilino, actual.id);
      if (cargado) vistaPrevia = <VistaPrevia doc={cargado.doc} />;
    }
  }

  const materias = await prisma.materia.findMany({ orderBy: [{ nivel: 'asc' }, { orden: 'asc' }] });
  const materiasDocente = await materiasDelDocente(inquilino.id, sesion.uid, sesion.rol);
  const cupo = await cupoDeGeneraciones(inquilino, topesDe(inquilino).generaciones);

  return (
    <PlanificacionesCliente
      slug={institucion}
      yoSoy={sesion.uid}
      soyAdmin={sesion.rol === 'ADMIN'}
      todas={todas}
      q={q}
      planificaciones={planificaciones}
      actual={actual}
      semanas={semanas}
      semanaId={Number(b.s) || null}
      vista={b.vista === 'previa' ? 'previa' : 'campos'}
      abrirNueva={b.nueva === '1'}
      destrezasCatalogo={destrezasCatalogo}
      materias={materias.map((m) => ({ nivel: m.nivel, nombre: m.nombre, ambito: m.ambito }))}
      materiasDocente={materiasDocente}
      plantillas={listaDePlantillas()}
      plantillaPorDefecto={inquilino.plantillaPorDefecto}
      cupo={{ tope: cupo.tope, usadas: cupo.usadas, quedan: cupo.quedan }}
      soloLectura={inquilino.soloLectura}
      vistaPrevia={vistaPrevia}
    />
  );
}
