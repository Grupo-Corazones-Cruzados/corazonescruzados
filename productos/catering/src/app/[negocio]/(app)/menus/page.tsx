import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { calcularDia } from '@/lib/despacho';
import { aDia, esDia, hoyEn, sumarDias } from '@/lib/fechas';
import MenusCliente from './MenusCliente';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Menús' };

export default async function PaginaMenus({
  params,
  searchParams,
}: {
  params: Promise<{ negocio: string }>;
  searchParams: Promise<{ dia?: string }>;
}) {
  const { negocio } = await params;
  const q = await searchParams;
  const { inquilino } = await exigirContexto(negocio, 'cocina');
  const hoy = hoyEn(inquilino.zonaHoraria);
  const dia = q.dia && esDia(q.dia) ? q.dia : hoy;

  const [diaCalc, alimentos, clientes, recientes] = await Promise.all([
    calcularDia(inquilino, dia),
    prisma.alimento.findMany({ where: { inquilinoId: inquilino.id, activo: true }, orderBy: [{ categoria: 'asc' }, { nombre: 'asc' }], select: { id: true, nombre: true, categoria: true } }),
    // Las restricciones de quienes reciben comida ESE día, para avisar «quién no come esto» al armar el menú.
    prisma.cliente.findMany({
      where: { inquilinoId: inquilino.id, estado: 'ACTIVO', restricciones: { some: {} } },
      select: { id: true, nombre: true, restricciones: { select: { alimentoId: true, tiposComida: true } } },
    }),
    prisma.menu.findMany({
      where: { inquilinoId: inquilino.id, fecha: { gte: new Date(`${sumarDias(dia, -14)}T00:00:00.000Z`), lte: new Date(`${sumarDias(dia, 14)}T00:00:00.000Z`) } },
      select: { fecha: true, tipoComida: true },
    }),
  ]);
  const entregan = new Set(diaCalc.entregas.map((e) => e.cliente.id));
  const comidasDe = new Map(diaCalc.entregas.map((e) => [e.cliente.id, e.comidas]));

  return (
    <MenusCliente
      slug={negocio}
      dia={dia}
      hoy={hoy}
      comidas={inquilino.tiposComida}
      esFeriado={diaCalc.esFeriado}
      entregas={diaCalc.entregas.length}
      menus={diaCalc.menus.map((m) => ({ tipoComida: m.tipoComida, descripcion: m.descripcion, alimentoIds: m.alimentos.map((a) => a.id) }))}
      menuIds={Object.fromEntries((await prisma.menu.findMany({ where: { inquilinoId: inquilino.id, fecha: new Date(`${dia}T00:00:00.000Z`) }, select: { id: true, tipoComida: true } })).map((m) => [m.tipoComida, m.id]))}
      alimentos={alimentos}
      clientesDelDia={clientes.filter((c) => entregan.has(c.id)).map((c) => ({ id: c.id, nombre: c.nombre, comidas: comidasDe.get(c.id) ?? [], restricciones: c.restricciones }))}
      diasConMenu={[...new Set(recientes.map((m) => aDia(m.fecha)))]}
    />
  );
}
