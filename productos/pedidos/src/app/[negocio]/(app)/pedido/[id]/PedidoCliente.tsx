'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ChevronLeft, Plus, Trash2, ChefHat, BellRing, Receipt, Ban, Minus } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, BotonIcono, Campo, Selector, Tarjeta, Insignia, Confirmar, Ventanita, EstadoVacio } from '@/componentes/ui';
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
import { dinero } from '@/lib/formato';
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

  return (
    <>
      <CabeceraPagina
        titulo={`Mesa ${pedido.mesa}`}
        descripcion={`${pedido.zona} · Pedido #${pedido.numero} · ${format(new Date(pedido.creado), 'HH:mm')}${pedido.mesero ? ` · ${pedido.mesero}` : ''}`}
        acciones={
          <>
            <Insignia tono={TONO_PEDIDO[pedido.estado]}>{ETIQUETA_PEDIDO[pedido.estado]}</Insignia>
            <Link
              href={`/${slug}/panel`}
              className="flex items-center gap-1 text-[13px] text-tenue hover:text-texto"
            >
              <ChevronLeft className="h-4 w-4" /> Mesas
            </Link>
          </>
        }
      />

      <div className="grid gap-4 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Carta */}
        <div className="space-y-3">
          {cerrado ? (
            <Tarjeta className="p-5">
              <p className="text-[13px] text-tenue">
                Este pedido está {ETIQUETA_PEDIDO[pedido.estado].toLowerCase()}. No admite cambios.
              </p>
            </Tarjeta>
          ) : !puedeTomar ? (
            <Tarjeta className="p-5">
              <p className="text-[13px] text-tenue">
                Tu cuenta no toma pedidos. Puedes ver la cuenta y, si eres de cocina, marcar los
                platos que van saliendo.
              </p>
            </Tarjeta>
          ) : !carta.length ? (
            <Tarjeta>
              <EstadoVacio
                titulo="La carta está vacía"
                detalle="Un administrador tiene que crear las categorías y los productos en «Carta»."
              />
            </Tarjeta>
          ) : (
            <>
              <div className="desplaza flex gap-2 overflow-x-auto">
                {carta.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCategoria(c.id)}
                    className={cn(
                      'whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors foco-visible',
                      categoria === c.id
                        ? 'bg-acento text-acento-contraste'
                        : 'border border-borde bg-tarjeta text-tenue hover:bg-realce',
                    )}
                  >
                    {c.nombre}
                  </button>
                ))}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
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
                          accion(() => agregarPlato(slug, d), `${p.nombre} añadido`);
                          setCantidades((c) => ({ ...c, [p.id]: 1 }));
                        }}
                      >
                        Añadir
                      </Boton>
                    </div>
                  </Tarjeta>
                ))}
              </div>
            </>
          )}
        </div>

        {/* La cuenta */}
        <div className="space-y-3">
          <Tarjeta className="overflow-hidden">
            <div className="border-b border-borde px-4 py-2.5">
              <h2 className="text-[12px] font-semibold uppercase tracking-wide text-tenue">
                La cuenta {enCocina > 0 && <span className="text-aviso">· {enCocina} en cocina</span>}
              </h2>
            </div>

            {pedido.items.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12px] text-tenue">
                Todavía no se ha añadido nada.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-borde)]">
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
                        onClick={() => accion(() => marcarPlatoListo(slug, i.id), 'Plato listo')}
                      />
                    )}
                    {puedeTomar && !cerrado && (
                      <BotonIcono
                        icono={Trash2}
                        titulo="Quitar del pedido"
                        className="hover:bg-error-suave hover:text-error"
                        disabled={enCurso}
                        onClick={() => accion(() => quitarPlato(slug, i.id), 'Plato quitado')}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}

            <dl className="space-y-1.5 border-t border-borde px-4 py-3 text-[13px]">
              {aplicaIva && (
                <>
                  <div className="flex justify-between">
                    <dt className="text-tenue">Base imponible</dt>
                    <dd>{dinero(pedido.subtotal, moneda)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-tenue">
                      IVA {pedido.ivaPorcentaje > 0 ? `${pedido.ivaPorcentaje}%` : ''}
                      {precioConIva && <span className="text-[11px]"> (incluido en los precios)</span>}
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

          {!cerrado && (
            <Tarjeta className="space-y-2 p-3">
              {puedeCocinar && enCocina > 0 && (
                <Boton
                  icono={ChefHat}
                  className="w-full"
                  disabled={enCurso}
                  onClick={() => accion(() => marcarPedidoListo(slug, pedido.id), 'Pedido listo para servir')}
                >
                  Marcar todo listo ({enCocina})
                </Boton>
              )}
              {puedeTomar && (
                <Boton
                  variante="secundario"
                  icono={BellRing}
                  className="w-full"
                  disabled={enCurso || pedido.estado !== 'LISTO'}
                  title={
                    pedido.estado === 'EN_PREPARACION'
                      ? 'Todavía quedan platos en cocina'
                      : pedido.estado === 'SERVIDO'
                        ? 'Ya está servido'
                        : undefined
                  }
                  onClick={() => accion(() => marcarServido(slug, pedido.id), 'Pedido servido')}
                >
                  {pedido.estado === 'SERVIDO' ? 'Ya está servido' : 'Marcar como servido'}
                </Boton>
              )}
              {puedeCobrar && (
                <>
                  <Boton
                    icono={Receipt}
                    className="w-full"
                    disabled={enCurso || !pedido.items.length}
                    title={!pedido.items.length ? 'No hay nada que cobrar' : undefined}
                    onClick={() => setCobrando(true)}
                  >
                    Cobrar {dinero(pedido.total, moneda)}
                  </Boton>
                  <Boton
                    variante="fantasma"
                    icono={Ban}
                    className="w-full text-error hover:bg-error-suave hover:text-error"
                    disabled={enCurso}
                    onClick={() => setAnulando(true)}
                  >
                    Anular pedido
                  </Boton>
                </>
              )}
            </Tarjeta>
          )}
        </div>
      </div>

      <Ventanita abierto={cobrando} alCerrar={() => setCobrando(false)} titulo="Cobrar el pedido">
        <form
          action={(d) => {
            d.set('pedidoId', String(pedido.id));
            arranca(async () => {
              const r = await cobrarPedido(slug, d);
              if (!r.ok) {
                toast.error(r.error);
                return;
              }
              toast.success('Pedido cobrado y mesa liberada');
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
          <p className="text-[12px] leading-relaxed text-tenue">
            Al cobrar, el pedido se cierra y la mesa queda libre.
          </p>
          <div className="flex justify-end gap-2 border-t border-borde pt-3">
            <Boton type="button" variante="secundario" onClick={() => setCobrando(false)} disabled={enCurso}>
              Cancelar
            </Boton>
            <Boton type="submit" disabled={enCurso}>
              {enCurso ? 'Cobrando…' : 'Confirmar cobro'}
            </Boton>
          </div>
        </form>
      </Ventanita>

      <Confirmar
        abierto={anulando}
        titulo="Anular el pedido"
        mensaje="El pedido deja de contar y la mesa queda libre. Se guarda como anulado: no desaparece del histórico, para que el turno se pueda cuadrar."
        textoAceptar="Anular"
        ocupado={enCurso}
        alCerrar={() => setAnulando(false)}
        alAceptar={() => {
          setAnulando(false);
          accion(() => anularPedido(slug, pedido.id), 'Pedido anulado', true);
        }}
      />
    </>
  );
}
