import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import UnidadesCliente, { type GradoVista, type DocenteVista } from './UnidadesCliente';

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
      include: { materias: { orderBy: [{ orden: 'asc' }, { nombre: 'asc' }], include: { docentes: { include: { usuario: { select: { id: true, nombre: true, profesion: true } } } }, _count: { select: { planificaciones: true } } } } },
    }),
    prisma.usuario.findMany({ where: { inquilinoId: inquilino.id, activo: true }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true, profesion: true, rol: true } }),
  ]);

  const vista: GradoVista[] = grados.map((g) => ({
    id: g.id,
    nombre: g.nombre,
    color: g.color,
    materias: g.materias.map((m) => ({
      id: m.id,
      nombre: m.nombre,
      descripcion: m.descripcion,
      unidades: m.unidades,
      docentes: m.docentes.map((d) => ({ id: d.usuario.id, nombre: [d.usuario.profesion, d.usuario.nombre].filter(Boolean).join(' ') })),
      planificaciones: m._count.planificaciones,
    })),
  }));
  const listaDocentes: DocenteVista[] = docentes.map((d) => ({ id: d.id, nombre: [d.profesion, d.nombre].filter(Boolean).join(' '), rol: d.rol }));

  return <UnidadesCliente slug={institucion} grados={vista} docentes={listaDocentes} gradoId={Number(b.g) || null} materiaId={Number(b.m) || null} soloLectura={inquilino.soloLectura} />;
}
