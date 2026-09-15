import type { TipoComida, DiaSemana } from '@/generated/prisma/enums';
import { prisma } from '@/lib/db';
import { aDia, diaSemanaDe, type Dia } from '@/lib/fechas';
import { calcularFechaFin, sirveEl } from '@/lib/servicios';
import { feriadosDelNegocio } from '@/lib/servicios-db';
import { RESTRICCIONES_DESPACHO } from '@/lib/catalogo';

/**
 * EL DÍA DE DESPACHO. Una sola función decide QUIÉN recibe comida un día dado y
 * con qué —dirección efectiva, motorizado efectivo, restricciones que chocan con
 * el menú—, y de ahí salen las etiquetas, las hojas de ruta, el tablero y los
 * reportes. Cuatro pantallas que calculen esto por su cuenta serían cuatro
 * respuestas distintas a «¿a quién le llevo hoy?».
 */

export type Entrega = {
  cliente: {
    id: number;
    nombre: string;
    celular: string;
    direccion: string;
    edificio: string | null;
    piso: string | null;
    referencias: string | null;
    colorIdentificador: string | null;
    numeroDireccion: 1 | 2;
  };
  /** Las comidas que recibe ese día (las del servicio ∩ las que ofrece el negocio). */
  comidas: TipoComida[];
  /** Restricciones de cocina que CHOCAN con el menú de ese día, por comida. */
  restriccionesCocina: Partial<Record<TipoComida, string[]>>;
  /** Todas sus restricciones de cocina, por si no hay menú cargado. */
  restriccionesTodas: string[];
  restriccionesDespacho: string[];
  motorizado: { id: number; nombre: string; celular: string | null; color: string | null } | null;
};

export type DiaDeDespacho = {
  dia: Dia;
  diaSemana: DiaSemana;
  esFeriado: { nombre: string; esLaborable: boolean } | null;
  entregas: Entrega[];
  cancelados: { id: number; nombre: string; motivo: string | null }[];
  menus: { tipoComida: TipoComida; descripcion: string | null; alimentos: { id: number; nombre: string }[] }[];
};

export async function calcularDia(
  inquilino: { id: number; tiposComida: TipoComida[] },
  dia: Dia,
): Promise<DiaDeDespacho> {
  const diaSemana = diaSemanaDe(dia);
  const fecha = new Date(`${dia}T00:00:00.000Z`);

  const [feriados, feriadoHoy, menus, clientes] = await Promise.all([
    feriadosDelNegocio(inquilino.id),
    prisma.feriado.findUnique({ where: { inquilinoId_fecha: { inquilinoId: inquilino.id, fecha } } }),
    prisma.menu.findMany({
      where: { inquilinoId: inquilino.id, fecha },
      include: { alimentos: { include: { alimento: { select: { id: true, nombre: true } } } } },
    }),
    prisma.cliente.findMany({
      where: {
        inquilinoId: inquilino.id,
        estado: 'ACTIVO',
        servicios: { some: { estado: 'ACTIVO', diasSemana: { has: diaSemana } } },
      },
      include: {
        motorizado: true,
        motorizado2: true,
        restricciones: { include: { alimento: { select: { nombre: true } } } },
        servicios: {
          where: { estado: 'ACTIVO' },
          take: 1,
          include: { cancelaciones: { where: { activa: true }, select: { fecha: true, motivo: true } } },
        },
      },
      orderBy: { nombre: 'asc' },
    }),
  ]);

  const menuPorComida = new Map<TipoComida, Set<number>>();
  for (const m of menus) menuPorComida.set(m.tipoComida, new Set(m.alimentos.map((a) => a.alimentoId)));

  const entregas: Entrega[] = [];
  const cancelados: DiaDeDespacho['cancelados'] = [];

  for (const c of clientes) {
    const s = c.servicios[0];
    if (!s) continue;
    const canceladas = new Set(s.cancelaciones.map((x) => aDia(x.fecha)));
    const fin = calcularFechaFin(s, feriados, canceladas);

    if (canceladas.has(dia)) {
      const motivo = s.cancelaciones.find((x) => aDia(x.fecha) === dia)?.motivo ?? null;
      // Solo cuenta como cancelado si ese día le tocaba: cancelar un sábado sin servicio no es noticia.
      if (dia >= aDia(s.fechaInicio) && dia <= fin) cancelados.push({ id: c.id, nombre: c.nombre, motivo });
      continue;
    }
    if (!sirveEl(s, dia, feriados, canceladas, fin)) continue;

    const comidas = s.tiposComida.filter((t) => inquilino.tiposComida.includes(t));
    if (!comidas.length) continue;

    const usaDir2 = c.diasDireccion2.includes(diaSemana) && !!c.direccion2;
    const motorizado = usaDir2 && c.motorizado2 ? c.motorizado2 : c.motorizado;

    const restriccionesCocina: Entrega['restriccionesCocina'] = {};
    for (const comida of comidas) {
      const ids = menuPorComida.get(comida);
      if (!ids) continue;
      const chocan = c.restricciones
        .filter((r) => ids.has(r.alimentoId) && (r.tiposComida.length === 0 || r.tiposComida.includes(comida)))
        .map((r) => r.alimento.nombre);
      if (chocan.length) restriccionesCocina[comida] = chocan;
    }

    entregas.push({
      cliente: {
        id: c.id,
        nombre: c.nombre,
        celular: c.celular,
        direccion: usaDir2 ? c.direccion2! : c.direccion,
        edificio: usaDir2 ? c.edificio2 : c.edificio,
        piso: usaDir2 ? c.piso2 : c.piso,
        referencias: usaDir2 ? c.referencias2 : c.referencias,
        colorIdentificador: usaDir2 ? c.colorIdentificador2 : c.colorIdentificador,
        numeroDireccion: usaDir2 ? 2 : 1,
      },
      comidas,
      restriccionesCocina,
      restriccionesTodas: c.restricciones.map((r) => r.alimento.nombre),
      restriccionesDespacho: RESTRICCIONES_DESPACHO.filter(([k]) => c[k]).map(([, et]) => et),
      motorizado: motorizado
        ? { id: motorizado.id, nombre: motorizado.nombre, celular: motorizado.celular, color: motorizado.color }
        : null,
    });
  }

  return {
    dia,
    diaSemana,
    esFeriado: feriadoHoy ? { nombre: feriadoHoy.nombre, esLaborable: feriadoHoy.esLaborable } : null,
    entregas,
    cancelados,
    menus: menus.map((m) => ({
      tipoComida: m.tipoComida,
      descripcion: m.descripcion,
      alimentos: m.alimentos.map((a) => a.alimento),
    })),
  };
}

/** Las entregas agrupadas por motorizado (los sin asignar, al final). */
export function porMotorizado(entregas: Entrega[]) {
  const grupos = new Map<number | 0, { motorizado: Entrega['motorizado']; entregas: Entrega[] }>();
  for (const e of entregas) {
    const k = e.motorizado?.id ?? 0;
    if (!grupos.has(k)) grupos.set(k, { motorizado: e.motorizado, entregas: [] });
    grupos.get(k)!.entregas.push(e);
  }
  return [...grupos.values()].sort((a, b) => {
    if (!a.motorizado) return 1;
    if (!b.motorizado) return -1;
    return a.motorizado.nombre.localeCompare(b.motorizado.nombre);
  });
}
