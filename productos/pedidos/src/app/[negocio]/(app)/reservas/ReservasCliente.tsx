'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { addDays, format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Pencil, CalendarClock, Check, X, UserX, AlertCircle } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, BotonIcono, Campo, Entrada, AreaTexto, Selector, Tarjeta, Insignia, PanelLateral, EstadoVacio } from '@/componentes/ui';
import { guardarReservaMesa, cambiarEstadoReserva } from '@/acciones/mesas';
import { ETIQUETA_RESERVA, TONO_RESERVA } from '@/lib/pedidos';
import { aCampoFecha, aCampoFechaHora } from '@/lib/fechas';
import { cn } from '@/lib/utils';
import type { EstadoReservaMesa } from '@/generated/prisma/enums';

export type ReservaVista = {
  id: number;
  mesaId: number;
  mesa: string;
  zona: string;
  cliente: string;
  telefono: string | null;
  personas: number | null;
  desde: string;
  hasta: string;
  estado: EstadoReservaMesa;
  notas: string | null;
};
export type MesaOpcion = { id: number; nombre: string; zona: string; capacidad: number | null };

const DURACIONES = [45, 60, 90, 120, 180];

export default function ReservasCliente({
  slug,
  dia,
  reservas,
  mesas,
}: {
  slug: string;
  dia: string;
  reservas: ReservaVista[];
  mesas: MesaOpcion[];
}) {
  const router = useRouter();
  const elDia = new Date(dia);
  const [panel, setPanel] = useState<ReservaVista | null | 'nueva'>(null);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();

  const irA = (d: Date) => router.push(`/${slug}/reservas?dia=${aCampoFecha(d)}`);
  const tira = Array.from({ length: 7 }, (_, i) => addDays(elDia, i - 2));

  const cambiar = (id: number, estado: EstadoReservaMesa, texto: string) =>
    arranca(async () => {
      const r = await cambiarEstadoReserva(slug, id, estado);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(texto);
      router.refresh();
    });

  // Hora de partida razonable: hoy a las 20:00, que es cuando se reserva.
  const inicioPorDefecto = () => {
    const d = new Date(elDia);
    d.setHours(20, 0, 0, 0);
    return aCampoFechaHora(d);
  };

  return (
    <>
      <CabeceraPagina
        titulo={format(elDia, "EEEE d 'de' MMMM", { locale: es }).replace(/^\w/, (c) => c.toUpperCase())}
        descripcion="Reservas de mesa"
        acciones={
          <>
            <div className="flex items-center gap-1">
              <BotonIcono icono={ChevronLeft} titulo="Día anterior" onClick={() => irA(addDays(elDia, -1))} />
              <Boton variante="secundario" onClick={() => irA(new Date())}>
                Hoy
              </Boton>
              <BotonIcono icono={ChevronRight} titulo="Día siguiente" onClick={() => irA(addDays(elDia, 1))} />
            </div>
            <Boton icono={Plus} onClick={() => setPanel('nueva')} disabled={!mesas.length}>
              Nueva reserva
            </Boton>
          </>
        }
      />

      <div className="desplaza flex gap-2 overflow-x-auto border-b border-borde bg-tarjeta px-4 py-3 sm:px-6">
        {tira.map((d) => {
          const sel = isSameDay(d, elDia);
          return (
            <button
              key={d.toISOString()}
              onClick={() => irA(d)}
              className={cn(
                'flex w-14 shrink-0 flex-col items-center rounded-md border px-2 py-1.5 transition-colors foco-visible',
                sel ? 'border-acento bg-acento text-acento-contraste' : 'border-borde bg-tarjeta hover:bg-realce',
              )}
            >
              <span className="text-[10px] uppercase opacity-80">{format(d, 'EEE', { locale: es })}</span>
              <span className="text-[15px] font-semibold">{format(d, 'd')}</span>
            </button>
          );
        })}
      </div>

      <div className="p-4 sm:p-6">
        {!mesas.length ? (
          <EstadoVacio titulo="No hay mesas" detalle="Crea las mesas en Configuración antes de reservar." />
        ) : !reservas.length ? (
          <EstadoVacio icono={CalendarClock} titulo="Sin reservas este día" />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {reservas.map((r) => (
              <Tarjeta key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold">{r.cliente}</p>
                    <p className="text-[12px] text-tenue">
                      Mesa {r.mesa} · {r.zona}
                      {r.personas ? ` · ${r.personas} personas` : ''}
                    </p>
                  </div>
                  <Insignia tono={TONO_RESERVA[r.estado]}>{ETIQUETA_RESERVA[r.estado]}</Insignia>
                </div>
                <p className="mt-2 text-[15px] font-semibold text-acento">
                  {format(new Date(r.desde), 'HH:mm')} – {format(new Date(r.hasta), 'HH:mm')}
                </p>
                {r.telefono && <p className="text-[12px] text-tenue">{r.telefono}</p>}
                {r.notas && <p className="mt-1 text-[12px] text-tenue">{r.notas}</p>}

                <div className="mt-3 flex flex-wrap gap-1 border-t border-borde pt-3">
                  <Boton
                    tamano="sm"
                    variante="secundario"
                    icono={Check}
                    disabled={enCurso || r.estado === 'CUMPLIDA'}
                    onClick={() => cambiar(r.id, 'CUMPLIDA', 'Reserva cumplida')}
                  >
                    Llegó
                  </Boton>
                  <Boton
                    tamano="sm"
                    variante="secundario"
                    icono={UserX}
                    disabled={enCurso || r.estado === 'NO_PRESENTADO'}
                    onClick={() => cambiar(r.id, 'NO_PRESENTADO', 'Marcada como no presentada')}
                  >
                    No vino
                  </Boton>
                  <Boton
                    tamano="sm"
                    variante="fantasma"
                    icono={X}
                    disabled={enCurso || r.estado === 'CANCELADA'}
                    onClick={() => cambiar(r.id, 'CANCELADA', 'Reserva cancelada')}
                  >
                    Cancelar
                  </Boton>
                  <BotonIcono icono={Pencil} titulo="Editar" onClick={() => setPanel(r)} />
                </div>
              </Tarjeta>
            ))}
          </div>
        )}
      </div>

      <PanelLateral
        abierto={panel !== null}
        alCerrar={() => {
          setPanel(null);
          setError(null);
        }}
        titulo={panel === 'nueva' ? 'Nueva reserva' : 'Editar reserva'}
      >
        <form
          action={(d) =>
            arranca(async () => {
              setError(null);
              const id = panel && panel !== 'nueva' ? panel.id : null;
              const r = await guardarReservaMesa(slug, id, d);
              if (!r.ok) return setError(r.error);
              toast.success('Reserva guardada');
              setPanel(null);
              router.refresh();
            })
          }
          className="space-y-4"
        >
          <Campo etiqueta="Mesa" requerido>
            <Selector name="mesaId" required defaultValue={panel && panel !== 'nueva' ? panel.mesaId : ''}>
              {mesas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.zona} · Mesa {m.nombre}
                  {m.capacidad ? ` (${m.capacidad} personas)` : ''}
                </option>
              ))}
            </Selector>
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="A nombre de" requerido>
              <Entrada name="cliente" required defaultValue={panel && panel !== 'nueva' ? panel.cliente : ''} />
            </Campo>
            <Campo etiqueta="Teléfono">
              <Entrada name="telefono" inputMode="tel" defaultValue={panel && panel !== 'nueva' ? panel.telefono ?? '' : ''} />
            </Campo>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo etiqueta="Personas">
              <Entrada name="personas" type="number" min="1" defaultValue={panel && panel !== 'nueva' ? panel.personas ?? '' : ''} />
            </Campo>
            <Campo etiqueta="Fecha y hora" requerido className="sm:col-span-2">
              <Entrada
                name="desde"
                type="datetime-local"
                required
                defaultValue={panel && panel !== 'nueva' ? aCampoFechaHora(new Date(panel.desde)) : inicioPorDefecto()}
              />
            </Campo>
          </div>
          <Campo etiqueta="Duración prevista">
            <Selector
              name="minutos"
              defaultValue={
                panel && panel !== 'nueva'
                  ? String(Math.round((new Date(panel.hasta).getTime() - new Date(panel.desde).getTime()) / 60000))
                  : '90'
              }
            >
              {DURACIONES.map((m) => (
                <option key={m} value={m}>
                  {m < 60 ? `${m} minutos` : m === 60 ? '1 hora' : `${m / 60} horas`}
                </option>
              ))}
            </Selector>
          </Campo>
          <Campo etiqueta="Notas">
            <AreaTexto name="notas" rows={2} defaultValue={panel && panel !== 'nueva' ? panel.notas ?? '' : ''} />
          </Campo>
          {error && (
            <p role="alert" className="flex items-start gap-2 rounded border border-borde bg-error-suave px-3 py-2 text-[12px] text-error">
              <AlertCircle className="mt-px h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-borde pt-4">
            <Boton type="button" variante="secundario" onClick={() => setPanel(null)} disabled={enCurso}>
              Cancelar
            </Boton>
            <Boton type="submit" disabled={enCurso}>
              {enCurso ? 'Guardando…' : 'Guardar'}
            </Boton>
          </div>
        </form>
      </PanelLateral>
    </>
  );
}
