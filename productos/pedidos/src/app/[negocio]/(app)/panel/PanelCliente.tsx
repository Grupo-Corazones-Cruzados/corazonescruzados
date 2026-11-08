'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Building2, Hand, CalendarClock, Users } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, BOTON_PRIMARIO, EstadoVacio, Insignia, RailFiltro, SelectorEstado, Tarjeta } from '@/componentes/ui';
import { cambiarEstadoMesa } from '@/acciones/mesas';
import { abrirPedido } from '@/acciones/pedidos';
import { ETIQUETA_MESA, TONO_MESA, ETIQUETA_PEDIDO, TONO_PEDIDO, minutosDesde, textoEspera } from '@/lib/pedidos';
import { dinero, horaCorta } from '@/lib/formato';
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

// Etiquetas cortas: van en un control segmentado de una fila; el nombre largo, en la pista.
const FILTROS: { clave: Filtro; etiqueta: string; pista?: string }[] = [
  { clave: 'todas', etiqueta: 'Todas' },
  { clave: 'esperando', etiqueta: 'Esperan', pista: 'Esperan atención' },
  { clave: 'preparacion', etiqueta: 'En cocina' },
  { clave: 'listo', etiqueta: 'Listas', pista: 'Listo para servir' },
  { clave: 'cobrar', etiqueta: 'Por cobrar' },
  { clave: 'libre', etiqueta: 'Libres' },
];

const TONO_SITUACION: Record<Filtro, 'exito' | 'aviso' | 'info' | 'neutro' | 'error'> = {
  todas: 'neutro',
  libre: 'exito',
  esperando: 'aviso',
  preparacion: 'info',
  listo: 'aviso',
  cobrar: 'exito',
};

// Estados de una palabra (regla de Automatizaciones, 2026-11-08); el matiz va en `title`.
const ETIQUETA_SITUACION: Record<Filtro, string> = {
  todas: '',
  libre: 'Libre',
  esperando: 'Espera',
  preparacion: 'Cocina',
  listo: 'Lista',
  cobrar: 'Cobrar',
};

const PISTA_SITUACION: Record<Filtro, string> = {
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
  zona,
  zonas,
  puedeOperar,
  puedeTomarPedidos,
}: {
  slug: string;
  negocio: string;
  moneda: string;
  /** Zona horaria del negocio: las horas se pintan igual en el servidor y en el navegador. */
  zona: string;
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
      <div className="flex flex-1 flex-col">
        <CabeceraPagina titulo={negocio} descripcion="Tablero de mesas" />
        {/* Un estado vacío a página completa centra su contenido en una tarjeta que llega al pie. */}
        <div className="flex flex-1 flex-col p-4 sm:p-6">
          <Tarjeta className="flex flex-1 flex-col justify-center">
            <EstadoVacio
              icono={Building2}
              titulo="Todavía no hay mesas"
              accion={
                <Link href={`/${slug}/configuracion?seccion=mesas`} className={`${BOTON_PRIMARIO} h-9 px-4 text-[13px]`}>
                  Crear mesas
                </Link>
              }
            />
          </Tarjeta>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      {/*
        Sin el resumen de cuentas en la cabecera: repetía las mismas cifras que el filtro
        de situación lleva en cada opción (un dato no se dice dos veces).
      */}
      <CabeceraPagina titulo={negocio} descripcion="Tablero de mesas" />

      {/* Alto completo: el raíl y la columna llegan al pie (regla del panel, 2026-11-08). */}
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6 lg:flex-row">
        <RailFiltro
          titulo="Zonas"
          opciones={[
            { valor: 'todas', etiqueta: 'Todas', icono: Building2, conteo: todas.length },
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

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <SelectorEstado
            etiqueta="Ver"
            className="w-full lg:w-auto"
            activo={filtro}
            alElegir={(v) => setFiltro(v as Filtro)}
            opciones={FILTROS.map((f) => ({ valor: f.clave, etiqueta: f.etiqueta, pista: f.pista, conteo: cuenta(f.clave, mesasZona) }))}
          />
          <div className="flex flex-1 flex-col gap-4 xl:flex-row">
            <div className="flex min-w-0 flex-1 flex-col gap-3">
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
                        <span title={PISTA_SITUACION[s]}><Insignia tono={TONO_SITUACION[s]}>{ETIQUETA_SITUACION[s]}</Insignia></span>
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
                            Reservada {horaCorta(proxima.desde, zona)} · {proxima.cliente}
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
                                  accion(() => abrirPedido(slug, d), 'Pedido abierto.', true);
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
                                    s === 'esperando' ? 'Marca quitada.' : 'Mesa en espera.',
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
              {!visibles.length && (
                <Tarjeta className="flex flex-1 flex-col justify-center">
                  <EstadoVacio titulo="Ninguna mesa así" icono={Building2} />
                </Tarjeta>
              )}
            </div>

            {/* Las reservas de hoy: una tarjeta que llega al pie, con su propio deslizador. */}
            <Tarjeta className="flex min-h-[180px] flex-col overflow-hidden xl:w-72 xl:shrink-0">
              <div className="flex h-10 shrink-0 items-center gap-2 border-b border-borde px-3">
                <CalendarClock className="h-4 w-4 text-acento" />
                <h2 className="text-[11px] font-semibold uppercase tracking-wider text-tenue">Reservas de hoy</h2>
              </div>
              {reservasHoy.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
                  <CalendarClock className="mb-2 h-8 w-8 text-borde" />
                  <p className="text-[12px] text-tenue">Sin reservas</p>
                </div>
              ) : (
                <div className="desplaza min-h-0 flex-1 divide-y divide-borde overflow-y-auto">
                  {reservasHoy.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                      <div className="flex h-9 w-12 shrink-0 items-center justify-center rounded bg-acento-suave text-[12px] font-bold text-acento">
                        {horaCorta(r.desde, zona)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold">{r.cliente}</p>
                        <p className="truncate text-[11px] text-tenue">
                          {r.mesa}
                          {r.personas ? ` · ${r.personas} personas` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="shrink-0 border-t border-borde bg-realce px-3 py-2 text-[12px] text-tenue">
                {reservasHoy.length} {reservasHoy.length === 1 ? 'reserva' : 'reservas'}
              </div>
            </Tarjeta>
          </div>
        </div>
      </div>
    </div>
  );
}
