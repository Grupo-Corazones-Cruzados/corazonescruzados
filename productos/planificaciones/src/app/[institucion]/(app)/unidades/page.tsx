import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import UnidadesCliente, { type GradoVista, type DocenteVista } from './UnidadesCliente';
import { destrezasDeMateria } from '@/lib/destrezas';
import type { DestrezaVista } from '@/componentes/PanelDestrezas';
import { fileIdDe, nombresImagenes } from '@/lib/mediaGcc';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Unidades' };

export default async function PaginaUnidades({ params, searchParams }: { params: Promise<{ institucion: string }>; searchParams: Promise<{ g?: string; m?: string }> }) {
  const { institucion } = await params;
  const b = await searchParams;
  const { inquilino } = await exigirContexto(institucion, 'administrar');

  const [grados, docentes] = await Promise.all([
    prisma.grado.findMany({
      where: { inquilinoId: inquilino.id },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      include: { materias: { orderBy: [{ orden: 'asc' }, { nombre: 'asc' }], include: { docentes: { include: { usuario: { select: { id: true, nombre: true, profesion: true } } } }, objetivos: { orderBy: { orden: 'asc' } }, _count: { select: { planificaciones: true, destrezas: true } } } } },
    }),
    prisma.usuario.findMany({ where: { inquilinoId: inquilino.id, activo: true }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true, profesion: true, rol: true } }),
  ]);

  const vista: GradoVista[] = grados.map((g) => ({
    id: g.id,
    nombre: g.nombre,
    nivel: g.nivel,
    color: g.color,
    importacionEstado: g.importacionEstado,
    importacionError: g.importacionError,
    importacionArchivo: g.importacionArchivo,
    importacionAtascada: g.importacionEstado === 'LEYENDO' && (!g.importacionInicio || Date.now() - g.importacionInicio.getTime() > 15 * 60_000),
    materias: g.materias.map((m) => ({
      id: m.id,
      nombre: m.nombre,
      descripcion: m.descripcion,
      unidades: m.unidades,
      docentes: m.docentes.map((d) => ({ id: d.usuario.id, nombre: [d.usuario.profesion, d.usuario.nombre].filter(Boolean).join(' ') })),
      planificaciones: m._count.planificaciones,
      objetivos: m.objetivos.map((o) => ({ codigo: o.codigo, descripcion: o.descripcion })),
      destrezas: m._count.destrezas,
    })),
  }));
  const listaDocentes: DocenteVista[] = docentes.map((d) => ({ id: d.id, nombre: [d.profesion, d.nombre].filter(Boolean).join(' '), rol: d.rol }));

  // Las destrezas solo de la materia elegida (pueden llevar iconos incrustados).
  const materiaId = Number(b.m) || null;
  const filas = materiaId && vista.some((g) => g.materias.some((m) => m.id === materiaId)) ? await destrezasDeMateria(materiaId) : [];
  // Nombre en Drive de cada imagen, para poder renombrarla desde el formulario.
  const nombres = await nombresImagenes(filas.map((d) => d.imagenUrl));
  const destrezas: DestrezaVista[] = filas.map((d) => {
    const fid = fileIdDe(d.imagenUrl);
    return { id: d.id, codigo: d.codigo, descripcion: d.descripcion, imagenUrl: d.imagenUrl, imagenNombre: fid ? nombres[fid] ?? null : null, criterio: d.criterio, indicador: d.indicador, activa: d.activa };
  });
  return <UnidadesCliente slug={institucion} grados={vista} docentes={listaDocentes} gradoId={Number(b.g) || null} materiaId={materiaId} destrezas={destrezas} soloLectura={inquilino.soloLectura} />;
}
