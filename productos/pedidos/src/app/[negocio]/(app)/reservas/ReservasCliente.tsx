'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, Pencil, CalendarClock, Check, X, UserX, AlertCircle } from 'lucide-react';
import { CabeceraPagina, AccionesTarjeta, type AccionMenu } from '@/componentes/Navegacion';
import { Boton, Campo, Entrada, AreaTexto, Selector, Tarjeta, Insignia, PanelLateral, EstadoVacio, PasoDia } from '@/componentes/ui';
import { guardarReservaMesa, cambiarEstadoReserva } from '@/acciones/mesas';
import { ETIQUETA_RESERVA, TONO_RESERVA } from '@/lib/pedidos';
import { aCampoFecha, aCampoFechaHora } from '@/lib/fechas';
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
  // El día llega como el instante de su medianoche en el servidor; lo que importa es la
  // FECHA (AAAA-MM-DD), que es lo que entiende el paso de día y lo que viaja en la URL.
  const diaTexto = dia.slice(0, 10);
  const elDia = new Date(`${diaTexto}T12:00:00`);
  const hoy = aCampoFecha(new Date());
  const [panel, setPanel] = useState<ReservaVista | null | 'nueva'>(null);
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();

  const irA = (d: string) => router.push(`/${slug}/reservas?dia=${d}`);

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

  // Las acciones de cada reserva: botones en escritorio, «⋯» en el teléfono. La que ya
  // es su estado no se ofrece (no hace nada); cancelar es la destructiva y va al final.
  const accionesDe = (r: ReservaVista): AccionMenu[] => [
    ...(r.estado !== 'CUMPLIDA'
      ? [{ etiqueta: 'Llegó', icono: Check, deshabilitado: enCurso, alPulsar: () => cambiar(r.id, 'CUMPLIDA', 'Reserva cumplida') }]
      : []),
    ...(r.estado !== 'NO_PRESENTADO'
      ? [{ etiqueta: 'No vino', icono: UserX, deshabilitado: enCurso, alPulsar: () => cambiar(r.id, 'NO_PRESENTADO', 'Marcada como no presentada') }]
      : []),
    { etiqueta: 'Editar', icono: Pencil, alPulsar: () => setPanel(r) },
    ...(r.estado !== 'CANCELADA'
      ? [{ etiqueta: 'Cancelar', icono: X, peligro: true, deshabilitado: enCurso, alPulsar: () => cambiar(r.id, 'CANCELADA', 'Reserva cancelada') }]
      : []),
  ];

  // Hora de partida razonable: hoy a las 20:00, que es cuando se reserva.
  const inicioPorDefecto = () => {
    const d = new Date(elDia);
    d.setHours(20, 0, 0, 0);
    return aCampoFechaHora(d);
  };

  return (
    <>
      <CabeceraPagina
        titulo="Reservas"
        descripcion="Las reservas de mesa del día"
        acciones={
          <Boton icono={Plus} onClick={() => setPanel('nueva')} disabled={!mesas.length}>
            Nueva reserva
          </Boton>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        {/*
          El día es UN control [‹ | fecha | ›] (antes: flechas en la cabecera y una tira de
          siete días que en el teléfono se deslizaba de lado; las dos decían lo mismo).
        */}
        <Tarjeta className="flex flex-col gap-2 p-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <PasoDia dia={diaTexto} alCambiar={irA} />
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 px-1">
            <p className="text-[13px] font-semibold first-letter:uppercase">
              {format(elDia, "EEEE d 'de' MMMM", { locale: es })}
            </p>
            {reservas.length > 0 && (
              <span className="text-[12px] text-tenue">
                · {reservas.length} reserva{reservas.length === 1 ? '' : 's'}
              </span>
            )}
            {diaTexto !== hoy && (
              <Boton variante="fantasma" tamano="sm" className="ml-auto" onClick={() => irA(hoy)}>
                Hoy
              </Boton>
            )}
          </div>
        </Tarjeta>

        {!mesas.length ? (
          <EstadoVacio titulo="No hay mesas" detalle="Crea las mesas en Configuración antes de reservar." />
        ) : !reservas.length ? (
          <EstadoVacio icono={CalendarClock} titulo="Sin reservas este día" />
        ) : (
          // Los botones de cada reserva van en su cabecera, en una fila: tarjetas anchas desde lg.
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {reservas.map((r) => (
              <Tarjeta key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold">{r.cliente}</p>
                    <p className="text-[12px] text-tenue">
                      Mesa {r.mesa} · {r.zona}
                      {r.personas ? ` · ${r.personas} personas` : ''}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <AccionesTarjeta acciones={accionesDe(r)} />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="text-[15px] font-semibold text-acento">
                    {format(new Date(r.desde), 'HH:mm')} – {format(new Date(r.hasta), 'HH:mm')}
                  </p>
                  <Insignia tono={TONO_RESERVA[r.estado]}>{ETIQUETA_RESERVA[r.estado]}</Insignia>
                </div>
                {r.telefono && (
                  <a href={`tel:${r.telefono}`} className="text-[12px] text-tenue hover:text-acento">
                    {r.telefono}
                  </a>
                )}
                {r.notas && <p className="mt-1 text-[12px] text-tenue">{r.notas}</p>}
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
