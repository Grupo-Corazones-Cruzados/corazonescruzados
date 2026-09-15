import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { calcularDia, porMotorizado } from '@/lib/despacho';
import { esDia, fechaLarga, hoyEn } from '@/lib/fechas';
import { ETIQUETA_COMIDA } from '@/lib/catalogo';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Tarjeta, EstadoVacio } from '@/componentes/ui';
import BotonPdf from '@/componentes/BotonPdf';
import FiltroDia from '@/componentes/FiltroDia';
import type { TipoComida } from '@/generated/prisma/enums';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rutas' };

/** La hoja de ruta de cada motorizado: a quién, dónde, con qué particularidad. Una hoja por motorizado al imprimir. */
export default async function PaginaRutas({
  params,
  searchParams,
}: {
  params: Promise<{ negocio: string }>;
  searchParams: Promise<{ dia?: string; comida?: string; motorizado?: string }>;
}) {
  const { negocio } = await params;
  const q = await searchParams;
  const { inquilino } = await exigirContexto(negocio, 'despacho');
  const dia = q.dia && esDia(q.dia) ? q.dia : hoyEn(inquilino.zonaHoraria);
  const comida = q.comida && (inquilino.tiposComida as string[]).includes(q.comida) ? (q.comida as TipoComida) : null;
  const motorizadoId = Number(q.motorizado) || null;

  const [d, motorizados] = await Promise.all([
    calcularDia(inquilino, dia),
    prisma.motorizado.findMany({ where: { inquilinoId: inquilino.id, activo: true }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
  ]);
  const entregas = d.entregas.filter((e) => (!comida || e.comidas.includes(comida)) && (!motorizadoId || e.motorizado?.id === motorizadoId));
  const grupos = porMotorizado(entregas);
  const sinAsignar = grupos.find((g) => !g.motorizado);

  return (
    <>
      <CabeceraPagina titulo="Hojas de ruta" descripcion={`${fechaLarga(dia)} · ${entregas.length} entrega${entregas.length === 1 ? '' : 's'} · ${grupos.filter((g) => g.motorizado).length} motorizado${grupos.filter((g) => g.motorizado).length === 1 ? '' : 's'}`} acciones={<BotonPdf href={`/${negocio}/api/pdf/rutas?${new URLSearchParams({ dia, ...(comida ? { comida } : {}), ...(motorizadoId ? { motorizado: String(motorizadoId) } : {}) })}`} texto="Descargar rutas (PDF)" deshabilitado={!entregas.length} />} />
      <div className="space-y-4 p-4 sm:p-6 print:p-0">
        <div className="print:hidden">
          <FiltroDia base={`/${negocio}/rutas`} dia={dia} comidas={inquilino.tiposComida} comida={comida} motorizados={motorizados} motorizadoId={motorizadoId} />
        </div>
        {sinAsignar && (
          <p className="rounded border border-borde bg-error-suave px-3 py-2 text-[12px] text-error print:hidden">
            {sinAsignar.entregas.length} entrega{sinAsignar.entregas.length === 1 ? '' : 's'} sin motorizado asignado: {sinAsignar.entregas.map((e) => e.cliente.nombre).join(', ')}. Asígnalos en «Motorizados» o en la ficha del cliente.
          </p>
        )}
        {entregas.length === 0 ? (
          <Tarjeta><EstadoVacio titulo="No hay entregas ese día" /></Tarjeta>
        ) : (
          grupos.map((g, i) => (
            <Tarjeta key={g.motorizado?.id ?? 'sin'} className={`overflow-hidden ${i > 0 ? 'print:break-before-page' : ''}`}>
              <div className="flex flex-wrap items-center gap-3 border-b border-borde px-4 py-3 print:border-black">
                {g.motorizado?.color && <span className="h-4 w-4 rounded-full border border-borde" style={{ background: g.motorizado.color }} />}
                <div className="min-w-0 flex-1">
                  <h2 className="text-[15px] font-semibold">{g.motorizado?.nombre ?? 'Sin motorizado asignado'}</h2>
                  <p className="text-[12px] text-tenue">{fechaLarga(dia)}{g.motorizado?.celular ? ` · ${g.motorizado.celular}` : ''} · {g.entregas.length} entrega{g.entregas.length === 1 ? '' : 's'}</p>
                </div>
                <span className="hidden text-[11px] text-tenue print:block">{inquilino.nombre}</span>
              </div>
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b border-borde text-left text-[10px] uppercase tracking-wide text-tenue print:border-black">
                    <th className="w-8 px-3 py-2">#</th>
                    <th className="px-3 py-2">Cliente</th>
                    <th className="px-3 py-2">Dirección</th>
                    <th className="px-3 py-2">Comidas</th>
                    <th className="px-3 py-2">Particularidades</th>
                    <th className="w-14 px-3 py-2 print:table-cell">Entregado</th>
                  </tr>
                </thead>
                <tbody>
                  {g.entregas.map((e, n) => (
                    <tr key={e.cliente.id} className="border-b border-borde align-top last:border-0 print:border-gray-400">
                      <td className="px-3 py-2 font-semibold text-tenue">{n + 1}</td>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-1.5">
                          {e.cliente.colorIdentificador && <span className="h-2.5 w-2.5 rounded-full border border-borde" style={{ background: e.cliente.colorIdentificador }} />}
                          <span className="font-semibold">{e.cliente.nombre}</span>
                        </span>
                        <span className="block text-tenue">{e.cliente.celular}</span>
                      </td>
                      <td className="px-3 py-2">
                        {e.cliente.direccion}
                        {(e.cliente.edificio || e.cliente.piso) && <span className="block text-tenue">{[e.cliente.edificio && `Edif. ${e.cliente.edificio}`, e.cliente.piso && `Piso ${e.cliente.piso}`].filter(Boolean).join(' · ')}</span>}
                        {e.cliente.referencias && <span className="block italic text-tenue">Ref.: {e.cliente.referencias}</span>}
                        {e.cliente.numeroDireccion === 2 && <span className="mt-0.5 inline-block rounded bg-realce px-1.5 text-[10px] font-semibold">Dirección 2</span>}
                      </td>
                      <td className="px-3 py-2">{(comida ? [comida] : e.comidas).map((c) => ETIQUETA_COMIDA[c]).join(', ')}</td>
                      <td className="px-3 py-2">{e.restriccionesDespacho.length ? e.restriccionesDespacho.join(', ') : <span className="text-tenue">—</span>}</td>
                      <td className="px-3 py-2"><span className="inline-block h-4 w-4 rounded border border-borde print:border-black" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Tarjeta>
          ))
        )}
      </div>
    </>
  );
}
