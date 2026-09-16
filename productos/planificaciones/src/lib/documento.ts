import { prisma } from '@/lib/db';
import { plantillaDe } from '@/plantillas';
import { institucionDe } from '@/plantillas/instituciones';
import type { DocumentoPud, SemanaDoc } from '@/plantillas/tipos';
import { nombreDocente } from '@/lib/catalogo';
import { aDia } from '@/lib/fechas';

/**
 * De la base al modelo del documento. Lo usan la vista previa y el PDF con la
 * misma llamada, así que dicen lo mismo.
 */
export async function cargarDocumento(inquilino: { id: number; slug: string; nombre: string; colorAcento: string; zonaHoraria: string }, planificacionId: number): Promise<{ doc: DocumentoPud; nombreArchivo: string; plantilla: ReturnType<typeof plantillaDe> } | null> {
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
    },
    semanas,
    institucion: institucionDe(inquilino.slug, inquilino.nombre),
    colorAcento: inquilino.colorAcento,
    zonaHoraria: inquilino.zonaHoraria,
  });

  const limpio = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  return { doc, plantilla, nombreArchivo: `pud-${limpio(pl.materia)}-unidad-${pl.numeroUnidad}.pdf` };
}
