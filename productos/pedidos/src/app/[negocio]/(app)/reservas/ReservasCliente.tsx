'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Pencil, CalendarClock, Check, X, UserX, Save } from 'lucide-react';
import { CabeceraPagina, MenuFila, type AccionMenu } from '@/componentes/Navegacion';
import { Boton, Campo, Entrada, AreaTexto, Selector, Tarjeta, Insignia, PanelLateral, EstadoVacio, PasoDia, PieAcciones, Tabla, BOTON_PRIMARIO } from '@/componentes/ui';
import Link from 'next/link';
import { diaConNombre, horaCorta } from '@/lib/formato';
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
  zona,
  dia,
  reservas,
  mesas,
}: {
  slug: string;
  /** Zona horaria del negocio (horas iguales en servidor y navegador). */
  zona: string;
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
      ? [{ etiqueta: 'Llegó', icono: Check, deshabilitado: enCurso, alPulsar: () => cambiar(r.id, 'CUMPLIDA', 'Cumplida.') }]
      : []),
    ...(r.estado !== 'NO_PRESENTADO'
      ? [{ etiqueta: 'No vino', icono: UserX, deshabilitado: enCurso, alPulsar: () => cambiar(r.id, 'NO_PRESENTADO', 'No vino.') }]
      : []),
    { etiqueta: 'Editar', icono: Pencil, alPulsar: () => setPanel(r) },
    ...(r.estado !== 'CANCELADA'
      ? [{ etiqueta: 'Cancelar', icono: X, peligro: true, deshabilitado: enCurso, alPulsar: () => cambiar(r.id, 'CANCELADA', 'Cancelada.') }]
      : []),
  ];

  // Hora de partida razonable: hoy a las 20:00, que es cuando se reserva.
  const inicioPorDefecto = () => {
    const d = new Date(elDia);
    d.setHours(20, 0, 0, 0);
    return aCampoFechaHora(d);
  };

  return (
    <div className="flex flex-1 flex-col">
      <CabeceraPagina
        titulo="Reservas"
        descripcion="Las reservas de mesa del día"
        acciones={
          <Boton icono={Plus} onClick={() => setPanel('nueva')} disabled={!mesas.length}>
            Nueva reserva
          </Boton>
        }
      />

      {/* Alto completo: la tarjeta de la lista llega al pie (regla del panel, 2026-11-08). */}
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-6">
        {/*
          El día es UN control [‹ | fecha | ›] (antes: flechas en la cabecera y una tira de
          siete días que en el teléfono se deslizaba de lado; las dos decían lo mismo).
        */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
          <PasoDia dia={diaTexto} alCambiar={irA} />
          <p className="px-1 text-[13px] font-semibold first-letter:uppercase">
            {diaConNombre(elDia, 'UTC')}
          </p>
          {diaTexto !== hoy && (
            <Boton variante="secundario" className="sm:ml-auto" onClick={() => irA(hoy)}>
              Hoy
            </Boton>
          )}
        </div>

        {/* Registros en TABLA (galería en el teléfono) con el recuento al pie; acciones en «⋯». */}
        <Tarjeta className="flex flex-1 flex-col overflow-hidden">
          {!mesas.length ? (
            <div className="flex flex-1 flex-col justify-center">
              <EstadoVacio
                titulo="No hay mesas"
                accion={<Link href={`/${slug}/configuracion?seccion=mesas`} className={`${BOTON_PRIMARIO} h-9 px-4 text-[13px]`}>Crear mesas</Link>}
              />
            </div>
          ) : !reservas.length ? (
            <div className="flex flex-1 flex-col justify-center">
              <EstadoVacio icono={CalendarClock} titulo="Sin reservas este día" />
            </div>
          ) : (
            <Tabla
              filas={reservas}
              claveFila={(r) => r.id}
              alPulsarFila={(r) => setPanel(r)}
              recuento={`${reservas.length} ${reservas.length === 1 ? 'reserva' : 'reservas'}`}
              columnas={[
                { clave: 'cliente', titulo: 'A nombre de', ancho: '30%', render: (r) => (
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-texto">{r.cliente}</p>
                    {(r.telefono || r.notas) && (
                      <p className="truncate text-[11.5px] text-tenue">{[r.telefono, r.notas].filter(Boolean).join(' · ')}</p>
                    )}
                  </div>
                ) },
                { clave: 'hora', titulo: 'Hora', ancho: '16%', render: (r) => (
                  <span className="font-semibold tabular-nums text-acento">{horaCorta(r.desde, zona)} – {horaCorta(r.hasta, zona)}</span>
                ) },
                { clave: 'mesa', titulo: 'Mesa', ancho: '22%', render: (r) => <span className="truncate">{r.mesa} · {r.zona}</span> },
                { clave: 'personas', titulo: 'Personas', ancho: '12%', alinear: 'der', render: (r) => r.personas ?? '—' },
                { clave: 'estado', titulo: 'Estado', ancho: '14%', render: (r) => (
                  <Insignia tono={TONO_RESERVA[r.estado]}>{ETIQUETA_RESERVA[r.estado]}</Insignia>
                ) },
                { clave: 'acciones', titulo: '', ancho: '56px', alinear: 'der', render: (r) => (
                  <div className="flex justify-end"><MenuFila acciones={accionesDe(r)} /></div>
                ) },
              ]}
            />
          )}
        </Tarjeta>
      </div>

      <PanelLateral
        abierto={panel !== null}
        alCerrar={() => setPanel(null)}
        titulo={panel === 'nueva' ? 'Nueva reserva' : 'Editar reserva'}
        pie={
          <PieAcciones>
            <Boton type="button" variante="secundario" onClick={() => setPanel(null)} disabled={enCurso}>
              Cancelar
            </Boton>
            <Boton form="form-reserva" type="submit" icono={Save} disabled={enCurso}>
              {enCurso ? 'Guardando…' : 'Guardar'}
            </Boton>
          </PieAcciones>
        }
      >
        <form
          id="form-reserva"
          key={panel && panel !== 'nueva' ? panel.id : 'nueva'}
          action={(d) =>
            arranca(async () => {
              const id = panel && panel !== 'nueva' ? panel.id : null;
              const r = await guardarReservaMesa(slug, id, d);
              if (!r.ok) { toast.error(r.error); return; }
              toast.success('Guardado.');
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
          <Campo etiqueta="Duración">
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
        </form>
      </PanelLateral>
    </div>
  );
}
