'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Building2, Hand, Utensils, BellRing, Receipt, CalendarClock, Users } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, EstadoVacio, Insignia, RailFiltro, Tarjeta } from '@/componentes/ui';
import { cambiarEstadoMesa } from '@/acciones/mesas';
import { abrirPedido } from '@/acciones/pedidos';
import { ETIQUETA_MESA, TONO_MESA, ETIQUETA_PEDIDO, TONO_PEDIDO, minutosDesde, textoEspera } from '@/lib/pedidos';
import { dinero } from '@/lib/formato';
import { cn } from '@/lib/utils';
import type { EstadoMesa, EstadoPedido } from '@/generated/prisma/enums';

type PedidoVista = {
  id: number;
  numero: number;
  estado: EstadoPedido;
  total: number;
  platos: number;
  pendientes: number;
};
type ReservaVista = { id: number; cliente: string; desde: string; personas: number | null };
export type MesaVista = {
  id: number;
  nombre: string;
  capacidad: number | null;
  estado: EstadoMesa;
  desde: string;
  pedido: PedidoVista | null;
  reservas: ReservaVista[];
};
export type ZonaVista = { id: number; nombre: string; mesas: MesaVista[] };

type Filtro = 'todas' | 'libre' | 'esperando' | 'preparacion' | 'listo' | 'cobrar';

/**
 * La situación real de una mesa no es su columna `estado` a secas: una mesa
 * ocupada cuyo pedido ya salió de cocina está «esperando que le sirvan», y eso es
 * lo que el mesero necesita ver de un vistazo. Se combina el estado de la mesa con
 * el de su pedido.
 */
function situacion(m: MesaVista): Filtro {
  if (m.estado === 'ESPERANDO_ATENCION') return 'esperando';
  if (!m.pedido) return 'libre';
  if (m.pedido.estado === 'LISTO') return 'listo';
  if (m.pedido.estado === 'SERVIDO') return 'cobrar';
  return 'preparacion';
}

const FILTROS: { clave: Filtro; etiqueta: string; icono: React.ComponentType<{ className?: string }> }[] = [
  { clave: 'todas', etiqueta: 'Todas', icono: Building2 },
  { clave: 'esperando', etiqueta: 'Esperan atención', icono: Hand },
  { clave: 'preparacion', etiqueta: 'En cocina', icono: Utensils },
  { clave: 'listo', etiqueta: 'Listo para servir', icono: BellRing },
  { clave: 'cobrar', etiqueta: 'Por cobrar', icono: Receipt },
  { clave: 'libre', etiqueta: 'Libres', icono: Building2 },
];

const TONO_SITUACION: Record<Filtro, 'exito' | 'aviso' | 'info' | 'neutro' | 'error'> = {
  todas: 'neutro',
  libre: 'exito',
  esperando: 'aviso',
  preparacion: 'info',
  listo: 'aviso',
  cobrar: 'exito',
};

const ETIQUETA_SITUACION: Record<Filtro, string> = {
  todas: '',
  libre: 'Libre',
  esperando: 'Esperando atención',
  preparacion: 'En cocina',
  listo: 'Listo para servir',
  cobrar: 'Por cobrar',
};

export default function PanelCliente({
  slug,
  negocio,
  moneda,
  zonas,
  puedeOperar,
  puedeTomarPedidos,
}: {
  slug: string;
  negocio: string;
  moneda: string;
  zonas: ZonaVista[];
  puedeOperar: boolean;
  puedeTomarPedidos: boolean;
}) {
  const router = useRouter();
  const [zonaSel, setZonaSel] = useState<string>('todas');
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [enCurso, arranca] = useTransition();

  const todas = useMemo(() => zonas.flatMap((z) => z.mesas), [zonas]);
  const cuenta = (f: Filtro, lista = todas) =>
    f === 'todas' ? lista.length : lista.filter((m) => situacion(m) === f).length;

  const mesasZona = zonaSel === 'todas' ? todas : (zonas.find((z) => String(z.id) === zonaSel)?.mesas ?? []);
  const visibles = mesasZona.filter((m) => filtro === 'todas' || situacion(m) === filtro);

  const reservasHoy = useMemo(
    () =>
      todas
        .flatMap((m) => m.reservas.map((r) => ({ ...r, mesa: m.nombre })))
        .sort((a, b) => a.desde.localeCompare(b.desde)),
    [todas],
  );

  const accion = (fn: () => Promise<{ ok: boolean; error?: string; id?: number }>, exito: string, irAPedido = false) =>
    arranca(async () => {
      const r = await fn();
      if (!r.ok) {
        toast.error(r.error ?? 'No se pudo completar la acción');
        return;
      }
      toast.success(exito);
      // Cuando se navega NO se refresca: refrescar invalida el árbol ACTUAL, que es
      // justo el que se está abandonando, y el destino es dinámico —llega recién
      // hecho igual—. (Sospeché que además cancelaba el salto; lo medí y NO era
      // cierto: el salto ocurría y quien llegaba tarde era mi comprobación.)
      if (irAPedido && r.id) router.push(`/${slug}/pedido/${r.id}`);
      else router.refresh();
    });

  if (!zonas.length) {
    return (
      <>
        <CabeceraPagina titulo={negocio} descripcion="Mesas" />
        <EstadoVacio
          icono={Building2}
          titulo="Todavía no hay mesas"
          detalle="Crea una zona (Salón, Terraza…) y sus mesas en Configuración; el tablero se llena solo."
          accion={
            <Link href={`/${slug}/configuracion`}>
              <Boton>Ir a Configuración</Boton>
            </Link>
          }
        />
      </>
    );
  }

  return (
    <>
      <CabeceraPagina
        titulo={negocio}
        descripcion="Tablero de mesas"
        acciones={
          <div className="flex flex-wrap items-center gap-2">
            <Insignia tono="aviso">{cuenta('esperando')} esperan atención</Insignia>
            <Insignia tono="info">{cuenta('preparacion')} en cocina</Insignia>
            <Insignia tono="aviso">{cuenta('listo')} listo para servir</Insignia>
            <Insignia tono="exito">{cuenta('cobrar')} por cobrar</Insignia>
          </div>
        }
      />

      <div className="border-b border-borde bg-tarjeta px-4 pb-3 sm:px-6">
        <div className="desplaza flex gap-2 overflow-x-auto">
          {FILTROS.map((f) => (
            <button
              key={f.clave}
              onClick={() => setFiltro(f.clave)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors foco-visible',
                filtro === f.clave
                  ? 'bg-acento text-acento-contraste'
                  : 'border border-borde bg-tarjeta text-tenue hover:bg-realce',
              )}
            >
              <f.icono className="h-3.5 w-3.5" />
              {f.etiqueta}
              <span className="opacity-70">{cuenta(f.clave, mesasZona)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 p-4 sm:p-6 xl:flex-row">
        <RailFiltro
          titulo="Zonas"
          opciones={[
            { valor: 'todas', etiqueta: 'Todo el local', icono: Building2, conteo: todas.length },
            ...zonas.map((z) => ({
              valor: String(z.id),
              etiqueta: z.nombre,
              icono: Building2,
              conteo: z.mesas.length,
            })),
          ]}
          activo={zonaSel}
          alElegir={setZonaSel}
        />

        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-4">
            {visibles.map((m) => {
              const s = situacion(m);
              const espera = minutosDesde(new Date(m.desde));
              const proxima = m.reservas[0];
              return (
                <Tarjeta key={m.id} className="flex flex-col overflow-hidden">
                  <div className="flex items-start justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold">{m.nombre}</p>
                      {m.capacidad && (
                        <p className="flex items-center gap-1 text-[11px] text-tenue">
                          <Users className="h-3 w-3" /> {m.capacidad}
                        </p>
                      )}
                    </div>
                    <Insignia tono={TONO_SITUACION[s]}>{ETIQUETA_SITUACION[s]}</Insignia>
                  </div>

                  <div className="min-h-[52px] px-3 text-[12px]">
                    {m.pedido ? (
                      <>
                        <p className="text-texto">
                          Pedido #{m.pedido.numero} · {m.pedido.platos}{' '}
                          {m.pedido.platos === 1 ? 'plato' : 'platos'}
                          {m.pedido.pendientes > 0 && (
                            <span className="text-aviso"> · {m.pedido.pendientes} en cocina</span>
                          )}
                        </p>
                        <p className="font-semibold text-acento">{dinero(m.pedido.total, moneda)}</p>
                      </>
                    ) : s === 'esperando' ? (
                      <p className="font-semibold text-aviso">Lleva {textoEspera(espera)} esperando</p>
                    ) : proxima ? (
                      <p className="text-tenue">
                        Reservada {format(new Date(proxima.desde), 'HH:mm')} · {proxima.cliente}
                      </p>
                    ) : (
                      <p className="text-tenue">Libre desde hace {textoEspera(espera)}</p>
                    )}
                  </div>

                  <div className="mt-auto flex gap-1 border-t border-borde p-2">
                    {m.pedido ? (
                      <Link href={`/${slug}/pedido/${m.pedido.id}`} className="flex-1">
                        <Boton tamano="sm" className="w-full">
                          Abrir pedido
                        </Boton>
                      </Link>
                    ) : (
                      <>
                        {puedeTomarPedidos && (
                          <Boton
                            tamano="sm"
                            className="flex-1"
                            disabled={enCurso}
                            onClick={() => {
                              const d = new FormData();
                              d.set('mesaId', String(m.id));
                              accion(() => abrirPedido(slug, d), 'Pedido abierto', true);
                            }}
                          >
                            Tomar pedido
                          </Boton>
                        )}
                        {puedeOperar && (
                          <Boton
                            tamano="sm"
                            variante="secundario"
                            title={
                              s === 'esperando'
                                ? 'Quitar la marca de espera'
                                : 'Marcar que esta mesa espera atención'
                            }
                            disabled={enCurso}
                            onClick={() =>
                              accion(
                                () =>
                                  cambiarEstadoMesa(
                                    slug,
                                    m.id,
                                    s === 'esperando' ? 'LIBRE' : 'ESPERANDO_ATENCION',
                                  ),
                                s === 'esperando' ? 'Marca retirada' : 'Mesa marcada: espera atención',
                              )
                            }
                          >
                            <Hand className="h-4 w-4" />
                          </Boton>
                        )}
                      </>
                    )}
                  </div>
                </Tarjeta>
              );
            })}
          </div>
          {!visibles.length && <EstadoVacio titulo="Ninguna mesa en esta situación" icono={Building2} />}
        </div>

        <div className="xl:w-72 xl:shrink-0">
          <div className="mb-2 flex items-center gap-2 px-1">
            <CalendarClock className="h-4 w-4 text-acento" />
            <h2 className="text-[10px] font-semibold uppercase tracking-wider text-tenue">
              Reservas de hoy {reservasHoy.length > 0 && `(${reservasHoy.length})`}
            </h2>
          </div>
          {reservasHoy.length === 0 ? (
            <Tarjeta className="p-6 text-center">
              <CalendarClock className="mx-auto mb-2 h-8 w-8 text-borde" />
              <p className="text-[12px] text-tenue">Sin reservas para hoy</p>
            </Tarjeta>
          ) : (
            <div className="desplaza max-h-[calc(100vh-220px)] space-y-2 overflow-y-auto">
              {reservasHoy.map((r) => (
                <Tarjeta key={r.id} className="flex items-center gap-3 p-3">
                  <div className="flex h-9 w-12 shrink-0 items-center justify-center rounded bg-acento-suave text-[12px] font-bold text-acento">
                    {format(new Date(r.desde), 'HH:mm')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold">{r.cliente}</p>
                    <p className="truncate text-[11px] text-tenue">
                      {r.mesa}
                      {r.personas ? ` · ${r.personas} personas` : ''}
                    </p>
                  </div>
                </Tarjeta>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
