'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Trash2, ChefHat, BellRing, Receipt, Ban, Minus, MapPin, Hash, Clock, UserRound, Users } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, BotonIcono, Campo, Selector, Tarjeta, Insignia, Confirmar, Ventanita, EstadoVacio, RailFiltro, type Detalle } from '@/componentes/ui';
import {
  agregarPlato,
  quitarPlato,
  marcarPedidoListo,
  marcarPlatoListo,
  marcarServido,
  cobrarPedido,
  anularPedido,
} from '@/acciones/pedidos';
import { ETIQUETA_PEDIDO, TONO_PEDIDO, ETIQUETA_PAGO } from '@/lib/pedidos';
import { dinero, horaCorta } from '@/lib/formato';
import { cn } from '@/lib/utils';
import type { EstadoPedido, EstadoItem, MetodoPagoPedido } from '@/generated/prisma/enums';

export type ItemVista = {
  id: number;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  notas: string | null;
  estado: EstadoItem;
};
export type PedidoVista = {
  id: number;
  numero: number;
  estado: EstadoPedido;
  mesa: string;
  zona: string;
  mesero: string | null;
  comensales: number | null;
  subtotal: number;
  iva: number;
  ivaPorcentaje: number;
  total: number;
  metodoPago: MetodoPagoPedido | null;
  creado: string;
  items: ItemVista[];
};
export type CategoriaVista = {
  id: number;
  nombre: string;
  productos: { id: number; nombre: string; descripcion: string | null; precio: number }[];
};

export default function PedidoCliente({
  slug,
  moneda,
  zona,
  pedido,
  carta,
  puedeTomar,
  puedeCobrar,
  puedeCocinar,
  precioConIva,
  aplicaIva,
}: {
  slug: string;
  moneda: string;
  /** Zona horaria del negocio (horas iguales en servidor y navegador). */
  zona: string;
  pedido: PedidoVista;
  carta: CategoriaVista[];
  puedeTomar: boolean;
  puedeCobrar: boolean;
  puedeCocinar: boolean;
  precioConIva: boolean;
  aplicaIva: boolean;
}) {
  const router = useRouter();
  const [enCurso, arranca] = useTransition();
  const [categoria, setCategoria] = useState<number | null>(carta[0]?.id ?? null);
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const [cobrando, setCobrando] = useState(false);
  const [anulando, setAnulando] = useState(false);

  const cerrado = pedido.estado === 'COBRADO' || pedido.estado === 'ANULADO';
  const enCocina = pedido.items.filter((i) => i.estado === 'PENDIENTE').length;

  const accion = (fn: () => Promise<{ ok: boolean; error?: string }>, exito: string, volver = false) =>
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
      if (volver) router.push(`/${slug}/panel`);
      else router.refresh();
    });

  const cantidadDe = (id: number) => cantidades[id] ?? 1;
  const cambiarCantidad = (id: number, d: number) =>
    setCantidades((c) => ({ ...c, [id]: Math.max(1, Math.min(99, cantidadDe(id) + d)) }));

  const productosVisibles = carta.find((c) => c.id === categoria)?.productos ?? [];

  // Lo que antes iba en una línea bajo el título va en la burbuja (i).
  const detalles: Detalle[] = [
    { icono: Hash, etiqueta: 'Pedido', valor: `#${pedido.numero}` },
    { icono: MapPin, etiqueta: 'Zona', valor: pedido.zona },
    { icono: Clock, etiqueta: 'Abierto a las', valor: horaCorta(pedido.creado, zona) },
    ...(pedido.mesero ? [{ icono: UserRound, etiqueta: 'Atiende', valor: pedido.mesero }] : []),
    ...(pedido.comensales ? [{ icono: Users, etiqueta: 'Comensales', valor: String(pedido.comensales) }] : []),
  ];

  return (
    <div className="flex flex-1 flex-col">
      {/*
        Las acciones del pedido viven en la cabecera: en el teléfono las principales
        (marcar listo, servido, cobrar) van a la barra de abajo, sin tener que bajar por
        toda la carta para cobrar, y «Anular» —destructiva— va al «⋯». Solo se enseña la
        que hoy se puede hacer: «Servido» aparece cuando la cocina terminó.
      */}
      <CabeceraPagina
        titulo={`Mesa ${pedido.mesa}`}
        volver={{ href: `/${slug}/panel`, etiqueta: 'Volver a las mesas' }}
        extra={<Insignia tono={TONO_PEDIDO[pedido.estado]}>{ETIQUETA_PEDIDO[pedido.estado]}</Insignia>}
        detalles={detalles}
        menu={
          !cerrado && puedeCobrar
            ? [{ etiqueta: 'Anular pedido', icono: Ban, peligro: true, deshabilitado: enCurso, alPulsar: () => setAnulando(true) }]
            : undefined
        }
        acciones={
          !cerrado && (puedeCocinar && enCocina > 0 || puedeTomar && pedido.estado === 'LISTO' || puedeCobrar) ? (
            <>
              {puedeCocinar && enCocina > 0 && (
                <Boton
                  variante="secundario"
                  icono={ChefHat}
                  disabled={enCurso}
                  onClick={() => accion(() => marcarPedidoListo(slug, pedido.id), 'Pedido listo.')}
                >
                  Todo listo ({enCocina})
                </Boton>
              )}
              {puedeTomar && pedido.estado === 'LISTO' && (
                <Boton
                  variante="secundario"
                  icono={BellRing}
                  disabled={enCurso}
                  onClick={() => accion(() => marcarServido(slug, pedido.id), 'Pedido servido.')}
                >
                  Servido
                </Boton>
              )}
              {puedeCobrar && (
                <Boton
                  icono={Receipt}
                  disabled={enCurso || !pedido.items.length}
                  title={!pedido.items.length ? 'No hay nada que cobrar' : undefined}
                  onClick={() => setCobrando(true)}
                >
                  Cobrar {dinero(pedido.total, moneda)}
                </Boton>
              )}
            </>
          ) : undefined
        }
      />

      {/* Alto completo: la carta y la cuenta llegan al pie (regla del panel, 2026-11-08). */}
      <div className="grid flex-1 gap-4 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Carta */}
        <div className="flex min-w-0 flex-col gap-3">
          {cerrado ? (
            <Tarjeta className="flex flex-1 flex-col justify-center">
              <EstadoVacio icono={Receipt} titulo={`Pedido ${ETIQUETA_PEDIDO[pedido.estado].toLowerCase()}`} />
            </Tarjeta>
          ) : !puedeTomar ? (
            <Tarjeta className="flex flex-1 flex-col justify-center">
              <EstadoVacio icono={ChefHat} titulo="Tu cuenta no toma pedidos" />
            </Tarjeta>
          ) : !carta.length ? (
            <Tarjeta className="flex flex-1 flex-col justify-center">
              <EstadoVacio titulo="La carta está vacía" />
            </Tarjeta>
          ) : (
            <>
              {/* Las categorías son SECCIONES de la carta: el raíl, que en el teléfono no se desliza. */}
              <div className="flex flex-1 flex-col gap-3 lg:flex-row">
                <RailFiltro
                  titulo="Carta"
                  opciones={carta.map((c) => ({ valor: String(c.id), etiqueta: c.nombre, conteo: c.productos.length }))}
                  activo={String(categoria ?? '')}
                  alElegir={(v) => setCategoria(Number(v))}
                />

                <div className="grid min-w-0 flex-1 content-start gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  {productosVisibles.map((p) => (
                    <Tarjeta key={p.id} className="flex items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold">{p.nombre}</p>
                        {p.descripcion && (
                          <p className="truncate text-[11px] text-tenue">{p.descripcion}</p>
                        )}
                        <p className="text-[12px] font-semibold text-acento">{dinero(p.precio, moneda)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <BotonIcono icono={Minus} titulo="Menos" onClick={() => cambiarCantidad(p.id, -1)} />
                        <span className="w-5 text-center text-[13px] font-semibold">{cantidadDe(p.id)}</span>
                        <BotonIcono icono={Plus} titulo="Más" onClick={() => cambiarCantidad(p.id, 1)} />
                        <Boton
                          tamano="sm"
                          disabled={enCurso}
                          onClick={() => {
                            const d = new FormData();
                            d.set('pedidoId', String(pedido.id));
                            d.set('productoId', String(p.id));
                            d.set('cantidad', String(cantidadDe(p.id)));
                            accion(() => agregarPlato(slug, d), 'Añadido.');
                            setCantidades((c) => ({ ...c, [p.id]: 1 }));
                          }}
                        >
                          Añadir
                        </Boton>
                      </div>
                    </Tarjeta>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* La cuenta: la lista crece hasta el pie y los totales quedan abajo. */}
        <div className="flex min-w-0 flex-col">
          <Tarjeta className="flex flex-1 flex-col overflow-hidden">
            <div className="shrink-0 border-b border-borde px-4 py-2.5">
              <h2 className="text-[12px] font-semibold uppercase tracking-wide text-tenue">
                La cuenta {enCocina > 0 && <span className="text-aviso">· {enCocina} en cocina</span>}
              </h2>
            </div>

            {pedido.items.length === 0 ? (
              <p className="flex flex-1 items-center justify-center px-4 py-6 text-center text-[12px] text-tenue">
                Sin platos
              </p>
            ) : (
              <ul className="desplaza min-h-0 flex-1 divide-y divide-borde overflow-y-auto">
                {pedido.items.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 px-4 py-2.5">
                    <span
                      className={cn(
                        'h-2 w-2 shrink-0 rounded-full',
                        i.estado === 'LISTO' ? 'bg-exito' : 'bg-aviso',
                      )}
                      title={i.estado === 'LISTO' ? 'Listo' : 'En cocina'}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px]">
                        <span className="font-semibold">{i.cantidad}×</span> {i.nombre}
                      </p>
                      {i.notas && <p className="truncate text-[11px] text-tenue">{i.notas}</p>}
                    </div>
                    <span className="shrink-0 text-[13px] font-semibold">
                      {dinero(i.precioUnitario * i.cantidad, moneda)}
                    </span>
                    {puedeCocinar && i.estado === 'PENDIENTE' && !cerrado && (
                      <BotonIcono
                        icono={ChefHat}
                        titulo="Marcar este plato como listo"
                        disabled={enCurso}
                        onClick={() => accion(() => marcarPlatoListo(slug, i.id), 'Plato listo.')}
                      />
                    )}
                    {puedeTomar && !cerrado && (
                      <BotonIcono
                        icono={Trash2}
                        titulo="Quitar del pedido"
                        className="hover:bg-error-suave hover:text-error"
                        disabled={enCurso}
                        onClick={() => accion(() => quitarPlato(slug, i.id), 'Quitado.')}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}

            <dl className="shrink-0 space-y-1.5 border-t border-borde px-4 py-3 text-[13px]">
              {aplicaIva && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-tenue">Base imponible</dt>
                    <dd>{dinero(pedido.subtotal, moneda)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-tenue">
                      IVA {pedido.ivaPorcentaje > 0 ? `${pedido.ivaPorcentaje}%` : ''}
                      {precioConIva && <span className="text-[11px]"> incluido</span>}
                    </dt>
                    <dd>{dinero(pedido.iva, moneda)}</dd>
                  </div>
                </>
              )}
              <div className="flex justify-between border-t border-borde pt-2 text-[15px]">
                <dt className="font-semibold">Total</dt>
                <dd className="font-bold text-acento">{dinero(pedido.total, moneda)}</dd>
              </div>
              {pedido.metodoPago && (
                <p className="pt-1 text-[11px] text-tenue">
                  Cobrado en {ETIQUETA_PAGO[pedido.metodoPago].toLowerCase()}
                </p>
              )}
            </dl>
          </Tarjeta>

        </div>
      </div>

      <Ventanita
        abierto={cobrando}
        alCerrar={() => setCobrando(false)}
        titulo="Cobrar el pedido"
        pie={
          <>
            <Boton type="button" variante="secundario" onClick={() => setCobrando(false)} disabled={enCurso}>
              Cancelar
            </Boton>
            <Boton form="form-cobro" type="submit" icono={Receipt} disabled={enCurso}>
              {enCurso ? 'Cobrando…' : 'Cobrar'}
            </Boton>
          </>
        }
      >
        <form
          id="form-cobro"
          action={(d) => {
            d.set('pedidoId', String(pedido.id));
            arranca(async () => {
              const r = await cobrarPedido(slug, d);
              if (!r.ok) {
                toast.error(r.error);
                return;
              }
              toast.success('Cobrado.');
              setCobrando(false);
              router.push(`/${slug}/panel`);
            });
          }}
          className="space-y-4"
        >
          <p className="text-center text-[24px] font-bold text-acento">{dinero(pedido.total, moneda)}</p>
          <Campo etiqueta="Método de pago" requerido>
            <Selector name="metodoPago" defaultValue="EFECTIVO" autoFocus>
              {(Object.keys(ETIQUETA_PAGO) as MetodoPagoPedido[]).map((m) => (
                <option key={m} value={m}>
                  {ETIQUETA_PAGO[m]}
                </option>
              ))}
            </Selector>
          </Campo>
        </form>
      </Ventanita>

      <Confirmar
        abierto={anulando}
        titulo="Anular el pedido"
        mensaje="La mesa queda libre y el pedido se guarda como anulado."
        textoAceptar="Anular"
        ocupado={enCurso}
        alCerrar={() => setAnulando(false)}
        alAceptar={() => {
          setAnulando(false);
          accion(() => anularPedido(slug, pedido.id), 'Anulado.', true);
        }}
      />
    </div>
  );
}
