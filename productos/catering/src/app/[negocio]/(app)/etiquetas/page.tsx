import Link from 'next/link';
import { ChefHat } from 'lucide-react';
import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { calcularDia, porMotorizado } from '@/lib/despacho';
import { esDia, fechaLarga, hoyEn } from '@/lib/fechas';
import { ETIQUETA_COMIDA } from '@/lib/catalogo';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Etiqueta } from '@/componentes/Etiqueta';
import { Tarjeta, EstadoVacio, Insignia } from '@/componentes/ui';
import BotonPdf from '@/componentes/BotonPdf';
import FiltroDia from '@/componentes/FiltroDia';
import type { TipoComida } from '@/generated/prisma/enums';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Etiquetas' };

/**
 * Las etiquetas del día: una por cliente y comida, agrupadas por motorizado para
 * que la cocina las apile como se van a repartir. Salen de la misma función que
 * el panel y las rutas: si el panel dijo 34, aquí hay 34.
 */
export default async function PaginaEtiquetas({
  params,
  searchParams,
}: {
  params: Promise<{ negocio: string }>;
  searchParams: Promise<{ dia?: string; comida?: string; motorizado?: string }>;
}) {
  const { negocio } = await params;
  const q = await searchParams;
  const { inquilino } = await exigirContexto(negocio, 'cocina');
  const dia = q.dia && esDia(q.dia) ? q.dia : hoyEn(inquilino.zonaHoraria);
  const comida = q.comida && (inquilino.tiposComida as string[]).includes(q.comida) ? (q.comida as TipoComida) : null;
  const motorizadoId = Number(q.motorizado) || null;

  const [d, motorizados] = await Promise.all([
    calcularDia(inquilino, dia),
    prisma.motorizado.findMany({ where: { inquilinoId: inquilino.id, activo: true }, orderBy: { nombre: 'asc' }, select: { id: true, nombre: true } }),
  ]);

  const entregas = d.entregas.filter((e) => (!comida || e.comidas.includes(comida)) && (!motorizadoId || e.motorizado?.id === motorizadoId));
  const grupos = porMotorizado(entregas);
  const total = entregas.reduce((a, e) => a + (comida ? 1 : e.comidas.length), 0);
  const consulta = new URLSearchParams({ dia, ...(comida ? { comida } : {}), ...(motorizadoId ? { motorizado: String(motorizadoId) } : {}) }).toString();
  const sinMenu = inquilino.tiposComida.filter((t) => !d.menus.some((m) => m.tipoComida === t) && entregas.some((e) => e.comidas.includes(t)));

  return (
    <>
      <CabeceraPagina
        titulo="Etiquetas"
        descripcion={`${fechaLarga(dia)} · ${total} etiqueta${total === 1 ? '' : 's'}`}
        acciones={<BotonPdf href={`/${negocio}/api/pdf/etiquetas?${consulta}`} texto="Descargar etiquetas (PDF)" deshabilitado={!entregas.length} />}
      />
      <div className="space-y-4 p-4 sm:p-6 print:p-0">
        <div className="print:hidden">
          <FiltroDia
            base={`/${negocio}/etiquetas`}
            dia={dia}
            comidas={inquilino.tiposComida}
            comida={comida}
            motorizados={motorizados}
            motorizadoId={motorizadoId}
          />
        </div>
        {d.esFeriado && !d.esFeriado.esLaborable && (
          <p className="rounded border border-borde bg-aviso-suave px-3 py-2 text-[12px] text-aviso print:hidden">Hoy es {d.esFeriado.nombre}: no hay servicio.</p>
        )}
        {sinMenu.length > 0 && (
          <p className="flex flex-wrap items-center gap-2 rounded border border-borde bg-aviso-suave px-3 py-2 text-[12px] text-aviso print:hidden">
            <ChefHat className="h-4 w-4" /> Sin menú cargado para {sinMenu.map((t) => ETIQUETA_COMIDA[t].toLowerCase()).join(' y ')}: las etiquetas no pueden avisar las restricciones de cocina.
            <Link href={`/${negocio}/menus?dia=${dia}`} className="font-semibold underline underline-offset-2">Cargar el menú</Link>
          </p>
        )}
        {entregas.length === 0 ? (
          <Tarjeta><EstadoVacio titulo="No hay entregas ese día" detalle="Nadie tiene servicio ese día con esos filtros, o está cancelado o es feriado." /></Tarjeta>
        ) : (
          grupos.map((g, i) => (
            <section key={g.motorizado?.id ?? 'sin'} className={i > 0 ? 'print:break-before-page' : ''}>
              <div className="mb-2 flex items-center gap-2 border-b border-borde pb-1.5 print:border-black">
                {g.motorizado?.color && <span className="h-4 w-4 rounded-full border border-borde" style={{ background: g.motorizado.color }} />}
                <h2 className="text-[14px] font-semibold">{g.motorizado?.nombre ?? 'Sin motorizado asignado'}</h2>
                <Insignia tono="neutro">{g.entregas.reduce((a, e) => a + (comida ? 1 : e.comidas.length), 0)} etiquetas</Insignia>
              </div>
              <div className="flex flex-wrap gap-3 print:gap-1">
                {g.entregas.flatMap((e) => (comida ? [comida] : e.comidas).map((c) => <Etiqueta key={`${e.cliente.id}-${c}`} entrega={e} comida={c} />))}
              </div>
            </section>
          ))
        )}
        {d.cancelados.length > 0 && (
          <p className="text-[12px] text-tenue print:hidden">Cancelaron ese día: {d.cancelados.map((c) => c.nombre).join(', ')}.</p>
        )}
      </div>
    </>
  );
}
