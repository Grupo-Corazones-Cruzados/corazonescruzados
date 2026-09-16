import { prisma } from '@/lib/db';
import { plantillaDe } from '@/plantillas';
import type { DocumentoPud, InstitucionConfig, SemanaDoc } from '@/plantillas/tipos';
import { nombreDocente } from '@/lib/catalogo';
import { aDia } from '@/lib/fechas';

type InquilinoDoc = {
  id: number;
  nombre: string;
  zonaHoraria: string;
  cabeceraLinea1: string | null;
  cabeceraLinea2: string | null;
  cabeceraLinea3: string | null;
  anioLectivo: string | null;
  logoInstitucionUrl: string | null;
  logoOrganizacionUrl: string | null;
  logoOpcionalUrl: string | null;
  deceResponsable: string | null;
};

/**
 * Lo que el negocio lleva impreso en el formato, desde la fila del inquilino
 * (módulo «Negocio»). Si no ha rellenado la cabecera, va su nombre en grande.
 */
export function institucionDe(inq: InquilinoDoc): InstitucionConfig {
  const cabecera = [
    inq.cabeceraLinea1 ? { texto: inq.cabeceraLinea1, estilo: 'normal' as const } : null,
    inq.cabeceraLinea2 ? { texto: inq.cabeceraLinea2, estilo: 'grande' as const } : null,
    inq.cabeceraLinea3 ? { texto: inq.cabeceraLinea3, estilo: 'acento' as const } : null,
  ].filter((l): l is NonNullable<typeof l> => l !== null);
  return {
    cabecera: cabecera.length ? cabecera : [{ texto: inq.nombre, estilo: 'grande' }],
    anioLectivo: inq.anioLectivo ?? '',
    logos: [inq.logoInstitucionUrl, inq.logoOrganizacionUrl, inq.logoOpcionalUrl].filter((l): l is string => Boolean(l)),
    deceResponsable: inq.deceResponsable ?? '',
  };
}

/**
 * De la base al modelo del documento. Lo usan la vista previa, el PDF y el Word
 * con la misma llamada, así que dicen lo mismo.
 */
export async function cargarDocumento(inquilino: InquilinoDoc, planificacionId: number): Promise<{ doc: DocumentoPud; nombreArchivo: string; plantilla: ReturnType<typeof plantillaDe> } | null> {
  const pl = await prisma.planificacion.findFirst({
    where: { id: planificacionId, inquilinoId: inquilino.id },
    include: {
      usuario: { select: { nombre: true, profesion: true } },
      semanas: { orderBy: { orden: 'asc' }, include: { destrezas: { orderBy: { orden: 'asc' }, include: { destreza: true } } } },
    },
  });
  if (!pl) return null;

  const plantilla = plantillaDe(pl.plantilla);
  const semanas: SemanaDoc[] = pl.semanas.map((s) => ({
    orden: s.orden,
    estado: s.estado,
    fechaInicio: s.fechaInicio ? aDia(s.fechaInicio) : null,
    fechaFin: s.fechaFin ? aDia(s.fechaFin) : null,
    tema: s.tema,
    numeroPeriodos: s.numeroPeriodos,
    objetivosTema: s.objetivosTema,
    estrategias: s.estrategias,
    recursos: s.recursos,
    tecnica: s.tecnica,
    instrumento: s.instrumento,
    destrezas: s.destrezas.map((d) => ({ codigo: d.destreza.codigo, descripcion: d.destreza.descripcion, imagenUrl: d.destreza.imagenUrl })),
  }));

  const doc = plantilla.documento({
    planificacion: {
      nivel: pl.nivel,
      materia: pl.materia,
      ambito: pl.ambito,
      numeroUnidad: pl.numeroUnidad,
      tituloUnidad: pl.tituloUnidad,
      inicioPud: aDia(pl.inicioPud),
      finPud: aDia(pl.finPud),
      gradoCurso: pl.gradoCurso,
      paralelo: pl.paralelo,
      jornada: pl.jornada,
      objetivosUnidad: pl.objetivosUnidad,
      criteriosEvaluacion: pl.criteriosEvaluacion,
      elaboradoPor: pl.elaboradoPor,
      revisadoPor: pl.revisadoPor,
      revisadoCargo: pl.revisadoCargo,
      aprobadoPor: pl.aprobadoPor,
      aprobadoCargo: pl.aprobadoCargo,
      docente: nombreDocente(pl.usuario),
      registro: {
        titulo: pl.registroTitulo,
        elaboradoCargo: pl.registroElaboradoCargo,
        elaboradoNombre: pl.registroElaboradoNombre,
        elaboradoFecha: pl.registroElaboradoFecha,
        aprobadoCargo: pl.registroAprobadoCargo,
        aprobadoNombre: pl.registroAprobadoNombre,
        aprobadoFecha: pl.registroAprobadoFecha,
      },
    },
    semanas,
    institucion: institucionDe(inquilino),
    zonaHoraria: inquilino.zonaHoraria,
  });

  const limpio = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return { doc, plantilla, nombreArchivo: `pud-${limpio(pl.materia)}-unidad-${pl.numeroUnidad}` };
}
