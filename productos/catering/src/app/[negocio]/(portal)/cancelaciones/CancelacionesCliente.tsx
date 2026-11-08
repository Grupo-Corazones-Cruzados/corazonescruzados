'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarX2, Info, CalendarCheck, History } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, Tarjeta, Ventanita, Campo, Entrada, EstadoVacio, Insignia, Tabla, Secciones, useSeccion, type OpcionRail } from '@/componentes/ui';
import { Aviso } from '@/componentes/campos';
import { CalendarioServicio, LeyendaCalendario } from '@/componentes/CalendarioServicio';
import { fechaLarga } from '@/lib/fechas';
import type { ResumenServicio, DiaCalendario } from '@/lib/servicios';
import { cancelarMiDia, reactivarMiDia } from '@/acciones/servicios';
import type { Autor } from '@/generated/prisma/enums';

type Cancelacion = { id: number; dia: string; motivo: string | null; activa: boolean; autor: Autor };

export default function CancelacionesCliente({ slug, hoy, horaLimite, vigente, anteriores }: {
  slug: string; hoy: string; horaLimite: number;
  vigente: { id: number; resumen: ResumenServicio; calendario: DiaCalendario[]; cancelaciones: Cancelacion[] } | null;
  anteriores: Cancelacion[];
}) {
  const router = useRouter();
  const opciones: OpcionRail[] = [
    { valor: 'vigente', etiqueta: 'Servicio vigente', icono: CalendarCheck, conteo: vigente?.cancelaciones.filter((c) => c.activa).length },
    { valor: 'anteriores', etiqueta: 'Anteriores', icono: History, conteo: anteriores.length },
  ];
  // La sección en `?seccion=` (portada en el teléfono), como Configuración.
  const s = useSeccion(opciones);
  const pestana = s.activo as 'vigente' | 'anteriores';
  const [dia, setDia] = useState<DiaCalendario | null>(null);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enCurso, arranca] = useTransition();
  const hora = `${String(horaLimite).padStart(2, '0')}:00`;

  const accion = () => arranca(async () => {
    if (!dia || !vigente) return;
    setError(null);
    const r = dia.estado === 'CANCELADO' ? await reactivarMiDia(slug, dia.cancelacionId!) : await cancelarMiDia(slug, vigente.id, dia.dia, motivo);
    if (!r.ok) return setError(r.error);
    toast.success(dia.estado === 'CANCELADO' ? 'Reactivado.' : 'Cancelado.');
    setDia(null); setMotivo(''); router.refresh();
  });

  const tabla = (filas: Cancelacion[]) => (
    <Tabla filas={filas} claveFila={(c) => c.id}
      recuento={`${filas.length} ${filas.length === 1 ? 'cancelación' : 'cancelaciones'}`}
      vacio={<div className="flex flex-1 items-center justify-center"><EstadoVacio icono={CalendarX2} titulo="Sin cancelaciones" /></div>}
      columnas={[
        { clave: 'dia', titulo: 'Día', render: (c) => <span className="first-letter:uppercase">{fechaLarga(c.dia)}</span> },
        { clave: 'motivo', titulo: 'Motivo', render: (c) => c.motivo ?? <span className="text-tenue">—</span> },
        { clave: 'autor', titulo: 'Quién', render: (c) => (c.autor === 'CLIENTE' ? 'Tú' : 'El negocio') },
        { clave: 'estado', titulo: 'Estado', render: (c) => (c.activa ? <Insignia tono="error">Cancelado</Insignia> : <Insignia tono="neutro">Reactivado</Insignia>) },
      ]} />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <CabeceraPagina titulo="Cancelaciones" descripcion="Los días que no quieres recibir comida. No consumen y la fecha de fin se corre."
        tituloTelefono={s.enUrl ? s.etiqueta : undefined}
        volverTelefono={s.enUrl ? { href: s.hrefPortada, etiqueta: 'Volver a Cancelaciones' } : undefined} />
      {/* Raíl + panel derecho que llega hasta abajo (`Secciones`); en el teléfono, portada. */}
      <Secciones opciones={opciones} seccion={s}>
          {pestana === 'vigente' && (vigente ? (
            <div className="flex flex-1 flex-col">
              <div className="space-y-3 p-4 sm:p-5">
                <p className="flex items-start gap-2 text-[12.5px] text-tenue" title="Pulsa un día para cancelarlo o reactivarlo">
                  <Info className="mt-px h-4 w-4 shrink-0 text-acento" />
                  <span>Hoy, hasta las <strong className="text-texto">{hora}</strong>. Llevas <strong className="text-texto">{vigente.resumen.cancelacionesUsadas} de {vigente.resumen.maxCancelaciones}</strong>.</span>
                </p>
                <Tarjeta className="p-4">
                  <LeyendaCalendario />
                  <div className="mt-3"><CalendarioServicio dias={vigente.calendario} hoy={hoy} alPulsar={(d) => { if (d.dia < hoy) return; setError(null); setMotivo(''); setDia(d); }} /></div>
                </Tarjeta>
              </div>
              <div className="flex flex-1 flex-col border-t border-borde">{tabla(vigente.cancelaciones)}</div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center"><EstadoVacio icono={CalendarX2} titulo="Sin servicio activo" /></div>
          ))}
          {pestana === 'anteriores' && <div className="flex flex-1 flex-col">{tabla(anteriores)}</div>}
      </Secciones>

      <Ventanita abierto={dia !== null} alCerrar={() => setDia(null)} titulo={dia?.estado === 'CANCELADO' ? 'Reactivar el día' : 'Cancelar el día'}
        pie={<><Boton variante="secundario" onClick={() => setDia(null)} disabled={enCurso}>Volver</Boton><Boton variante={dia?.estado === 'CANCELADO' ? 'primario' : 'peligro'} onClick={accion} disabled={enCurso}>{enCurso ? 'Un momento…' : dia?.estado === 'CANCELADO' ? 'Reactivar' : 'Cancelar el día'}</Boton></>}>
        {dia && (
          <>
            <p className="text-[13px] font-semibold first-letter:uppercase">{fechaLarga(dia.dia)}</p>
            {dia.estado === 'CANCELADO'
              ? <p className="mt-1 text-[13px] text-tenue">Ese día vuelve a llegarte comida.</p>
              : <><p className="mt-1 text-[13px] text-tenue">Ese día no te llega comida y tu servicio termina un día más tarde.</p>
                <Campo etiqueta="Motivo (opcional)" className="mt-3"><Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Viaje, almuerzo fuera…" autoFocus /></Campo></>}
            {dia.dia === hoy && <p className="mt-2 text-[12px] text-aviso">Es hoy: solo se puede hasta las {hora}.</p>}
            {error && <div className="mt-3"><Aviso texto={error} /></div>}
          </>
        )}
      </Ventanita>
    </div>
  );
}
