import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { cupoDeGeneraciones, cupoDeCuentas, topesDe } from '@/lib/limites';
import { instante } from '@/lib/fechas';
import PanelCliente, { type DatosPanel } from './PanelCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Inicio' };

export default async function PaginaPanel({ params }: { params: Promise<{ institucion: string }> }) {
  const { institucion } = await params;
  const { inquilino, sesion } = await exigirContexto(institucion);
  const topes = topesDe(inquilino);

  const [planificaciones, semanasListas, semanasEnCurso, usuarios, listaPl, recientes, cupo, cuentas] = await Promise.all([
    prisma.planificacion.count({ where: { inquilinoId: inquilino.id } }),
    prisma.planificacionSemanal.count({ where: { inquilinoId: inquilino.id, estado: 'LISTA' } }),
    prisma.planificacionSemanal.count({ where: { inquilinoId: inquilino.id, estado: { in: ['PENDIENTE', 'GENERANDO'] } } }),
    prisma.usuario.findMany({
      where: { inquilinoId: inquilino.id },
      select: { id: true, nombre: true, profesion: true, _count: { select: { planificaciones: true, semanas: { where: { estado: 'LISTA' } } } }, planificaciones: { select: { materia: true }, distinct: ['materia'] } },
      orderBy: { nombre: 'asc' },
    }),
    prisma.planificacion.findMany({ where: { inquilinoId: inquilino.id }, select: { id: true, materia: true, nivel: true, _count: { select: { semanas: { where: { estado: 'LISTA' } } } } } }),
    prisma.planificacionSemanal.findMany({
      where: { inquilinoId: inquilino.id },
      orderBy: { creado: 'desc' },
      take: 8,
      include: { usuario: { select: { nombre: true } }, planificacion: { select: { id: true, materia: true } } },
    }),
    cupoDeGeneraciones(inquilino, topes.generaciones),
    cupoDeCuentas(inquilino.id, topes.cuentas),
  ]);

  // Por materia y nivel: planificaciones y semanas, sumadas aquí (dos groupBy no se cruzan bien).
  const porMateria = new Map<string, DatosPanel['materias'][number]>();
  for (const p of listaPl) {
    const k = `${p.materia}|${p.nivel}`;
    const m = porMateria.get(k) ?? { materia: p.materia, nivel: p.nivel, planificaciones: 0, semanas: 0 };
    m.planificaciones++;
    m.semanas += p._count.semanas;
    porMateria.set(k, m);
  }

  const datos: DatosPanel = {
    slug: institucion,
    nombre: sesion.nombre,
    planificaciones,
    semanasListas,
    semanasEnCurso,
    cupo: { tope: cupo.tope, usadas: cupo.usadas, quedan: cupo.quedan },
    cuentas: { tope: cuentas.tope, usadas: cuentas.usadas },
    docentes: usuarios
      .filter((u) => u._count.planificaciones > 0 || u._count.semanas > 0)
      .map((u) => ({ id: u.id, nombre: [u.profesion, u.nombre].filter(Boolean).join(' '), planificaciones: u._count.planificaciones, semanas: u._count.semanas, materias: u.planificaciones.map((p) => p.materia) })),
    materias: [...porMateria.values()].sort((a, b) => b.planificaciones - a.planificaciones),
    recientes: recientes.map((s) => ({ id: s.id, cuando: instante(s.creado, inquilino.zonaHoraria), docente: s.usuario.nombre, planificacionId: s.planificacion.id, materia: s.planificacion.materia, orden: s.orden, tema: s.tema, estado: s.estado })),
  };

  return <PanelCliente d={datos} />;
}
