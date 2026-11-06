'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlarmClock, ListChecks, Loader2, Video } from 'lucide-react';
import { BTN_ICONO_FILA } from '@/components/ui/Button';
import PixelModal from '@/components/ui/PixelModal';
import { effStatus, fmtShort, porCaducar, relative, type Attach, type Pedir, type Reminder } from '@/components/recordatorios/comun';
import { AccionesDetalle, ContenidoDetalle } from '@/components/recordatorios/DetalleRecordatorio';
import FormRecordatorio from '@/components/recordatorios/FormRecordatorio';
import { useRecordatorios } from '@/components/recordatorios/useRecordatorios';
import { cabeceras } from './api';

const CADA_MS = 60_000;

/** Dentro de las apps no hay cookie: la sesión del Espacio de trabajo va en una cabecera. */
const pedir: Pedir = (url, init) => fetch(url, { ...init, headers: cabeceras((init?.headers as Record<string, string>) || {}) });

/** Por la misma razón, un enlace no sirve para descargar: se trae el archivo y se entrega desde aquí. */
async function descargar(idRecordatorio: number, a: Attach) {
  const r = await pedir(`/api/reminders/${idRecordatorio}/attachments/${a.id}`);
  if (!r.ok) throw new Error('No se pudo descargar');
  const url = URL.createObjectURL(await r.blob());
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = a.filename || 'archivo';
  enlace.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function Fila({ r, alElegir }: { r: Reminder; alElegir: () => void }) {
  const vencido = effStatus(r) === 'expired';
  const total = r.tasks?.length || 0;
  return (
    <li>
      <button type="button" onClick={alElegir} className="w-full flex items-start gap-1.5 rounded-md px-2 py-1.5 text-left hover:bg-black/[0.03]">
        {r.source === 'meeting' && <Video className="shrink-0 mt-[2px] w-3.5 h-3.5 text-accent" />}
        <span className="flex-1 min-w-0">
          <span className="block text-[12.5px] text-digi-text truncate" title={r.title}>{r.title}</span>
          <span className="flex items-center gap-1.5 text-[11px] text-digi-muted tabular-nums">
            <span className={vencido ? 'text-red-400' : ''}>{!r.remind_at ? 'Sin fecha' : vencido ? fmtShort(r.remind_at) : `${fmtShort(r.remind_at)} · ${relative(r.remind_at)}`}</span>
            {total > 0 && <span className="inline-flex items-center gap-1"><ListChecks className="w-3 h-3" />{r.tasks.filter((t) => t.done).length}/{total}</span>}
          </span>
        </span>
      </button>
    </li>
  );
}

/**
 * LOS RECORDATORIOS, debajo de los servidores: los pendientes, de lo que caduca antes a lo que caduca
 * después. Detalle, tareas, completar, editar y descargar son los del módulo, no una copia.
 */
export default function PanelRecordatorios({ plegado }: { plegado: boolean }) {
  const { list, loading, errorLista, fetchList, selLoading, detail, selectReminder, cerrarDetalle, form, openEdit, cerrarForm, alGuardar, del, setStatus, toggleDetailTask } = useRecordatorios(pedir);
  const [listaAbierta, setListaAbierta] = useState(false);
  const { proximos, vencidos } = useMemo(() => porCaducar(list), [list]);
  const total = proximos.length + vencidos.length;
  const [errorDescarga, setErrorDescarga] = useState('');

  useEffect(() => {
    const traer = () => { if (document.visibilityState !== 'hidden') fetchList(); };
    const t = setInterval(traer, CADA_MS);
    document.addEventListener('visibilitychange', traer);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', traer); };
  }, [fetchList]);

  const alDescargar = (id: number) => (a: Attach) => { setErrorDescarga(''); descargar(id, a).catch((e) => setErrorDescarga(e.message)); };

  const lista = (
    <>
      {loading && <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-digi-muted" /></div>}
      {!loading && errorLista && <p className="px-2 py-2 text-[12px] text-red-400">{errorLista}</p>}
      {!loading && !errorLista && !total && <p className="px-2 py-2 text-[12px] text-digi-muted">Sin recordatorios pendientes</p>}
      <ul>{proximos.map((r) => <Fila key={r.id} r={r} alElegir={() => selectReminder(r)} />)}</ul>
      {!!vencidos.length && (
        <>
          <p className="px-2 pt-2 pb-1 text-[10.5px] font-semibold uppercase tracking-wide text-digi-muted">Vencidos · {vencidos.length}</p>
          <ul>{vencidos.map((r) => <Fila key={r.id} r={r} alElegir={() => selectReminder(r)} />)}</ul>
        </>
      )}
    </>
  );

  const ventanas = (
    <>
      <PixelModal open={!!detail} onClose={() => { setErrorDescarga(''); cerrarDetalle(); }} title={detail?.title || 'Recordatorio'} size="md"
        pie={detail && <AccionesDetalle detail={detail} alEliminar={del} alEditar={openEdit} alCambiarEstado={setStatus} />}>
        {detail && (
          <div className="p-4 space-y-3">
            <ContenidoDetalle detail={detail} cargando={selLoading} enPanel={false} alMarcarTarea={toggleDetailTask} alDescargar={alDescargar(detail.id)} />
            {errorDescarga && <p className="text-[12px] text-red-400">{errorDescarga}</p>}
          </div>
        )}
      </PixelModal>
      <FormRecordatorio abierto={form.abierto} datos={form.datos} onClose={cerrarForm} onGuardado={alGuardar} onEliminar={del} pedir={pedir} alDescargar={form.datos ? alDescargar(form.datos.id) : undefined} />
    </>
  );

  if (plegado) {
    return (
      <>
        <button type="button" onClick={() => setListaAbierta(true)} aria-label={`Recordatorios: ${total} pendientes`} title="Recordatorios" className={BTN_ICONO_FILA}>
          <AlarmClock className="w-4 h-4" />
        </button>
        {!!total && <span className="text-[10.5px] font-semibold tabular-nums text-accent">{total}</span>}
        <PixelModal open={listaAbierta} onClose={() => setListaAbierta(false)} title="Recordatorios" size="md">{lista}</PixelModal>
        {ventanas}
      </>
    );
  }
  return (
    <section aria-label="Recordatorios" className="shrink-0 h-[46%] min-h-[220px] flex flex-col border-t border-digi-border">
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 min-h-9">
        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-digi-muted">Recordatorios</p>
        {!!total && <span className="text-[11px] tabular-nums text-digi-muted">{total}</span>}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-1.5 pb-1.5">{lista}</div>
      {ventanas}
    </section>
  );
}
