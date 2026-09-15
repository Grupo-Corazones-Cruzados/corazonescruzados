'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarX2, Info } from 'lucide-react';
import { CabeceraPagina } from '@/componentes/Navegacion';
import { Boton, Tarjeta, Ventanita, Campo, Entrada, EstadoVacio, Insignia, Tabla, RailFiltro } from '@/componentes/ui';
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
  const [pestana, setPestana] = useState<'vigente' | 'anteriores'>('vigente');
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
    toast.success(dia.estado === 'CANCELADO' ? 'Día reactivado' : 'Día cancelado');
    setDia(null); setMotivo(''); router.refresh();
  });

  const tabla = (filas: Cancelacion[]) => (
    <Tabla filas={filas} claveFila={(c) => c.id} vacio={<EstadoVacio icono={CalendarX2} titulo="Sin cancelaciones" />}
      columnas={[
        { clave: 'dia', titulo: 'Día', render: (c) => <span className="first-letter:uppercase">{fechaLarga(c.dia)}</span> },
        { clave: 'motivo', titulo: 'Motivo', render: (c) => c.motivo ?? <span className="text-tenue">—</span> },
        { clave: 'autor', titulo: 'Quién', render: (c) => (c.autor === 'CLIENTE' ? 'Tú' : 'El negocio') },
        { clave: 'estado', titulo: 'Estado', render: (c) => (c.activa ? <Insignia tono="error">Cancelado</Insignia> : <Insignia tono="neutro">Reactivado</Insignia>) },
      ]} />
  );

  return (
    <>
      <CabeceraPagina titulo="Cancelaciones" descripcion="Los días que no quieres recibir comida. No consumen y la fecha de fin se corre." />
      <div className="flex flex-col gap-4 p-4 sm:p-6 lg:flex-row">
        <RailFiltro activo={pestana} alElegir={(v) => setPestana(v as 'vigente' | 'anteriores')} opciones={[
          { valor: 'vigente', etiqueta: 'Servicio vigente', conteo: vigente?.cancelaciones.filter((c) => c.activa).length },
          { valor: 'anteriores', etiqueta: 'Servicios anteriores', conteo: anteriores.length },
        ]} />
        <div className="min-w-0 flex-1 space-y-4">
          {pestana === 'vigente' && (vigente ? (
            <>
              <p className="flex items-start gap-2 rounded border border-borde bg-acento-suave px-3 py-2 text-[12px] text-acento">
                <Info className="mt-px h-4 w-4 shrink-0" />
                <span>Puedes cancelar cualquier día futuro, y el de hoy <strong>antes de las {hora}</strong>. Tu servicio permite <strong>{vigente.resumen.maxCancelaciones}</strong> cancelaciones; llevas <strong>{vigente.resumen.cancelacionesUsadas}</strong>. Pulsa un día para cancelarlo o reactivarlo.</span>
              </p>
              <Tarjeta className="p-4">
                <LeyendaCalendario />
                <div className="mt-3"><CalendarioServicio dias={vigente.calendario} hoy={hoy} alPulsar={(d) => { if (d.dia < hoy) return; setError(null); setMotivo(''); setDia(d); }} /></div>
              </Tarjeta>
              <Tarjeta className="overflow-hidden">{tabla(vigente.cancelaciones)}</Tarjeta>
            </>
          ) : (
            <Tarjeta><EstadoVacio icono={CalendarX2} titulo="No tienes un servicio activo" detalle="Cuando lo tengas, aquí podrás cancelar días." /></Tarjeta>
          ))}
          {pestana === 'anteriores' && <Tarjeta className="overflow-hidden">{tabla(anteriores)}</Tarjeta>}
        </div>
      </div>

      <Ventanita abierto={dia !== null} alCerrar={() => setDia(null)} titulo={dia?.estado === 'CANCELADO' ? 'Reactivar el día' : 'Cancelar el día'}
        pie={<><Boton variante="secundario" onClick={() => setDia(null)} disabled={enCurso}>Volver</Boton><Boton variante={dia?.estado === 'CANCELADO' ? 'primario' : 'peligro'} onClick={accion} disabled={enCurso}>{enCurso ? 'Un momento…' : dia?.estado === 'CANCELADO' ? 'Reactivar' : 'Cancelar el día'}</Boton></>}>
        {dia && (
          <>
            <p className="text-[13px] font-semibold first-letter:uppercase">{fechaLarga(dia.dia)}</p>
            {dia.estado === 'CANCELADO'
              ? <p className="mt-1 text-[13px] text-tenue">Está cancelado. Si lo reactivas, ese día te llega comida y vuelve a contar.</p>
              : <><p className="mt-1 text-[13px] text-tenue">Ese día no te llegará comida y no se te descontará: tu servicio termina un día más tarde.</p>
                <Campo etiqueta="Motivo (opcional)" className="mt-3"><Entrada value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Viaje, almuerzo fuera…" autoFocus /></Campo></>}
            {dia.dia === hoy && <p className="mt-2 text-[12px] text-aviso">Es hoy: solo se puede hasta las {hora}.</p>}
            {error && <div className="mt-3"><Aviso texto={error} /></div>}
          </>
        )}
      </Ventanita>
    </>
  );
}
