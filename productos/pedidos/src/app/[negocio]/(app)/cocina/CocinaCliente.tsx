'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ChefHat, Check, RefreshCw, Clock } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, EstadoVacio, Insignia, Tarjeta } from '@/componentes/ui';
import { marcarPedidoListo, marcarPlatoListo } from '@/acciones/pedidos';
import { minutosDesde, textoEspera } from '@/lib/pedidos';
import { cn } from '@/lib/utils';
import type { EstadoItem, EstadoPedido } from '@/generated/prisma/enums';

export type ComandaVista = {
  id: number;
  numero: number;
  mesa: string;
  zona: string;
  creado: string;
  estado: EstadoPedido;
  items: { id: number; nombre: string; cantidad: number; notas: string | null; estado: EstadoItem }[];
};

/**
 * La cocina. Está pensada para mirarse de lejos y tocarse con las manos ocupadas:
 * el número de mesa manda, los platos son grandes y cada comanda dice cuánto lleva
 * esperando. Nada de tablas ni de menús.
 */
export default function CocinaCliente({ slug, comandas }: { slug: string; comandas: ComandaVista[] }) {
  const router = useRouter();
  const [enCurso, arranca] = useTransition();

  const accion = (fn: () => Promise<{ ok: boolean; error?: string }>, exito: string) =>
    arranca(async () => {
      const r = await fn();
      if (!r.ok) {
        toast.error(r.error ?? 'No se pudo completar la acción');
        return;
      }
      toast.success(exito);
      router.refresh();
    });

  const pendientes = comandas.filter((c) => c.items.some((i) => i.estado === 'PENDIENTE'));
  const servidas = comandas.filter((c) => !c.items.some((i) => i.estado === 'PENDIENTE'));

  return (
    <>
      <CabeceraPagina
        titulo="Cocina"
        descripcion={
          pendientes.length
            ? `${pendientes.length} ${pendientes.length === 1 ? 'comanda pendiente' : 'comandas pendientes'}`
            : 'Todo al día'
        }
        acciones={
          <Boton variante="secundario" icono={RefreshCw} onClick={() => router.refresh()} disabled={enCurso}>
            Actualizar
          </Boton>
        }
      />

      <div className="p-4 sm:p-6">
        {!pendientes.length && !servidas.length ? (
          <EstadoVacio
            icono={ChefHat}
            titulo="No hay nada en cocina"
            detalle="Cuando un mesero tome un pedido, aparecerá aquí."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {[...pendientes, ...servidas].map((c) => {
              const espera = minutosDesde(new Date(c.creado));
              const quedan = c.items.filter((i) => i.estado === 'PENDIENTE').length;
              // Media hora esperando es una comanda que se ha quedado atrás.
              const urgente = quedan > 0 && espera >= 30;
              return (
                <Tarjeta
                  key={c.id}
                  className={cn('flex flex-col overflow-hidden', urgente && 'border-error')}
                >
                  <div
                    className={cn(
                      'flex items-center justify-between gap-2 px-4 py-3',
                      quedan ? 'bg-acento text-acento-contraste' : 'bg-realce',
                    )}
                  >
                    <div>
                      <p className="text-[18px] font-bold leading-none">Mesa {c.mesa}</p>
                      <p className="mt-1 text-[11px] opacity-80">
                        #{c.numero} · {c.zona}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={cn('flex items-center gap-1 text-[12px] font-semibold', urgente && !quedan && 'text-error')}>
                        <Clock className="h-3.5 w-3.5" />
                        {textoEspera(espera)}
                      </p>
                      <p className="text-[11px] opacity-80">{format(new Date(c.creado), 'HH:mm')}</p>
                    </div>
                  </div>

                  <ul className="flex-1 divide-y divide-[var(--color-borde)]">
                    {c.items.map((i) => (
                      <li key={i.id} className="flex items-center gap-3 px-4 py-3">
                        <span className="text-[18px] font-bold text-acento">{i.cantidad}×</span>
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              'truncate text-[14px]',
                              i.estado === 'LISTO' ? 'text-tenue line-through' : 'font-semibold',
                            )}
                          >
                            {i.nombre}
                          </p>
                          {i.notas && <p className="truncate text-[12px] text-aviso">{i.notas}</p>}
                        </div>
                        {i.estado === 'PENDIENTE' ? (
                          <Boton
                            tamano="sm"
                            variante="secundario"
                            icono={Check}
                            disabled={enCurso}
                            onClick={() => accion(() => marcarPlatoListo(slug, i.id), 'Plato listo')}
                          >
                            Listo
                          </Boton>
                        ) : (
                          <Insignia tono="exito">Listo</Insignia>
                        )}
                      </li>
                    ))}
                  </ul>

                  <div className="border-t border-borde p-2">
                    {quedan > 0 ? (
                      <Boton
                        icono={ChefHat}
                        className="w-full"
                        disabled={enCurso}
                        onClick={() => accion(() => marcarPedidoListo(slug, c.id), `Mesa ${c.mesa}: todo listo`)}
                      >
                        Todo listo ({quedan})
                      </Boton>
                    ) : (
                      <p className="py-1 text-center text-[12px] font-semibold text-exito">
                        Servido a la sala
                      </p>
                    )}
                  </div>
                </Tarjeta>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
