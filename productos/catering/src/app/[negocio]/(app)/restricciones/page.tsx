import Link from 'next/link';
import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { calcularDia } from '@/lib/despacho';
import { esDia, fechaLarga, hoyEn } from '@/lib/fechas';
import { ETIQUETA_COMIDA, ETIQUETA_CATEGORIA } from '@/lib/catalogo';
import { puede } from '@/lib/permisos';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Tarjeta, EstadoVacio, Insignia } from '@/componentes/ui';
import FiltroDia from '@/componentes/FiltroDia';
import BotonImprimir from '@/componentes/BotonImprimir';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Restricciones' };

/**
 * Dos lecturas de las restricciones de cocina:
 *  1. Las que CHOCAN con el menú de un día — simples (un alimento) y compuestas
 *     (dos o más), que es como la cocina organiza las excepciones.
 *  2. Todas las restricciones de los clientes activos, por alimento.
 */
export default async function PaginaRestricciones({
  params,
  searchParams,
}: {
  params: Promise<{ negocio: string }>;
  searchParams: Promise<{ dia?: string }>;
}) {
  const { negocio } = await params;
  const q = await searchParams;
  const { inquilino, sesion } = await exigirContexto(negocio, 'cocina');
  const dia = q.dia && esDia(q.dia) ? q.dia : hoyEn(inquilino.zonaHoraria);
  const veClientes = puede(sesion.rol, 'clientes');

  const [d, todas] = await Promise.all([
    calcularDia(inquilino, dia),
    prisma.clienteRestriccion.findMany({
      where: { cliente: { inquilinoId: inquilino.id, estado: 'ACTIVO' } },
      include: { alimento: { select: { id: true, nombre: true, categoria: true } }, cliente: { select: { id: true, nombre: true } } },
    }),
  ]);

  // Choques con el menú del día, por cliente y comida.
  const choques = d.entregas.flatMap((e) =>
    Object.entries(e.restriccionesCocina).map(([comida, sin]) => ({ cliente: e.cliente, comida: comida as keyof typeof ETIQUETA_COMIDA, sin })),
  );
  const simples = choques.filter((c) => c.sin.length === 1);
  const compuestas = choques.filter((c) => c.sin.length > 1);
  const simplesPorAlimento = new Map<string, typeof simples>();
  for (const s of simples) simplesPorAlimento.set(s.sin[0], [...(simplesPorAlimento.get(s.sin[0]) ?? []), s]);

  const porAlimento = new Map<number, { nombre: string; categoria: string; clientes: { id: number; nombre: string }[] }>();
  for (const r of todas) {
    const x = porAlimento.get(r.alimentoId) ?? { nombre: r.alimento.nombre, categoria: ETIQUETA_CATEGORIA[r.alimento.categoria], clientes: [] };
    x.clientes.push(r.cliente);
    porAlimento.set(r.alimentoId, x);
  }
  const Nombre = ({ c }: { c: { id: number; nombre: string } }) =>
    veClientes ? <Link href={`/${negocio}/clientes/${c.id}`} className="font-semibold hover:text-acento">{c.nombre}</Link> : <span className="font-semibold">{c.nombre}</span>;

  return (
    <>
      <CabeceraPagina titulo="Restricciones" descripcion={`Quién no come qué, con el menú del ${fechaLarga(dia)}`} acciones={<BotonImprimir />} />
      <div className="space-y-4 p-4 sm:p-6 print:p-0">
        <div className="print:hidden"><FiltroDia base={`/${negocio}/restricciones`} dia={dia} /></div>
        {!d.menus.length && (
          <p className="rounded border border-borde bg-aviso-suave px-3 py-2 text-[12px] text-aviso print:hidden">
            Ese día no tiene menú cargado, así que no hay choques que calcular. <Link href={`/${negocio}/menus?dia=${dia}`} className="font-semibold underline underline-offset-2">Cargar el menú</Link>
          </p>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          <Tarjeta className="p-4">
            <h2 className="text-[14px] font-semibold">Simples <Insignia tono="aviso">{simples.length}</Insignia></h2>
            <p className="text-[12px] text-tenue">Una sola sustitución en el plato: se agrupan por alimento para cocinar la variante de una vez.</p>
            {simples.length === 0 ? <EstadoVacio titulo="Ninguna" /> : (
              <div className="mt-3 space-y-3">
                {[...simplesPorAlimento.entries()].sort((a, b) => b[1].length - a[1].length).map(([alimento, lista]) => (
                  <div key={alimento} className="rounded border border-borde p-3">
                    <p className="text-[13px] font-semibold text-error">Sin {alimento.toLowerCase()} <span className="font-normal text-tenue">· {lista.length}</span></p>
                    <ul className="mt-1 text-[12px]">
                      {lista.map((s) => <li key={`${s.cliente.id}-${s.comida}`}><Nombre c={s.cliente} /> <span className="text-tenue">· {ETIQUETA_COMIDA[s.comida].toLowerCase()}</span></li>)}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Tarjeta>
          <Tarjeta className="p-4">
            <h2 className="text-[14px] font-semibold">Compuestas <Insignia tono="error">{compuestas.length}</Insignia></h2>
            <p className="text-[12px] text-tenue">Dos o más sustituciones: cada plato se arma aparte.</p>
            {compuestas.length === 0 ? <EstadoVacio titulo="Ninguna" /> : (
              <ul className="mt-3 divide-y divide-borde">
                {compuestas.map((c) => (
                  <li key={`${c.cliente.id}-${c.comida}`} className="py-2 text-[12px]">
                    <Nombre c={c.cliente} /> <span className="text-tenue">· {ETIQUETA_COMIDA[c.comida].toLowerCase()}</span>
                    <span className="mt-0.5 block text-error">sin {c.sin.map((s) => s.toLowerCase()).join(', ')}</span>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </div>
        <Tarjeta className="p-4">
          <h2 className="text-[14px] font-semibold">Todas las restricciones de los clientes activos</h2>
          <p className="text-[12px] text-tenue">Por alimento, tenga o no que ver con el menú de hoy. Sirve para planificar la semana.</p>
          {porAlimento.size === 0 ? <EstadoVacio titulo="Ningún cliente activo tiene restricciones" /> : (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {[...porAlimento.values()].sort((a, b) => b.clientes.length - a.clientes.length).map((a) => (
                <div key={a.nombre} className="rounded border border-borde p-3">
                  <p className="text-[13px] font-semibold">{a.nombre} <span className="text-[11px] font-normal text-tenue">· {a.categoria}</span></p>
                  <p className="mt-1 text-[12px] text-tenue">{a.clientes.map((c) => c.nombre).join(', ')}</p>
                </div>
              ))}
            </div>
          )}
        </Tarjeta>
      </div>
    </>
  );
}
