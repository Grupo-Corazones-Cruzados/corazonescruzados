'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConsultaMedia, PANTALLA_XL } from '@/lib/hooks/useConsultaMedia';
import { toast } from 'sonner';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import PixelSelect from '@/components/ui/PixelSelect';
import PageHeader from '@/components/ui/PageHeader';
import FilterRail from '@/components/ui/FilterRail';
import BrandLoader from '@/components/ui/BrandLoader';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import BarraLista from '@/components/ui/BarraLista';
import {
  Inbox, Clock, CheckCircle2, AlertTriangle, Plus,
  ListChecks, Video, AlarmClock,
  RefreshCw, Sparkles, CalendarDays, CalendarClock, Radio, ArrowRight,
} from 'lucide-react';
import PanelHastaElPie from '@/components/ui/PanelHastaElPie';
import PanelDetalle from '@/components/ui/PanelDetalle';
import { effStatus, fmtShort, STATUS_LABEL, STATUS_VARIANT, type Reminder } from '@/components/recordatorios/comun';
import { useRecordatorios } from '@/components/recordatorios/useRecordatorios';
import { AccionesDetalle, ContenidoDetalle } from '@/components/recordatorios/DetalleRecordatorio';
import FormRecordatorio from '@/components/recordatorios/FormRecordatorio';

const mf = { fontFamily: 'var(--font-body)' } as const;

/** Reunión de Meet candidata a generar recordatorio (GET /api/reminders/meetings). */
type MeetCandidate = {
  recordName: string; meetingCode: string | null; meetingUrl: string | null;
  startTime: string | null; endTime: string | null; minutes: number | null;
  title: string; kind: 'scheduled' | 'instant'; calendarEventId: string | null;
  state: 'ready' | 'no-transcript' | 'generated'; reminderId: number | null;
};

const DAY_OPTIONS = [
  { value: '2', label: 'Últimos 2 días' },
  { value: '7', label: 'Últimos 7 días' },
  { value: '30', label: 'Últimos 30 días' },
];

const SCAN_NOTE: Record<string, string> = {
  'google-not-configured': 'Google Workspace no está configurado en el servidor, no se pueden leer las reuniones.',
  'no-workspace-email': 'Tu usuario no tiene una cuenta corporativa @grupocc.org vinculada, que es la que guarda las reuniones de Meet.',
};

// «Todos» va al final, bajo «Completados» (Fernando, 2026-10-05).
const STATUS_TABS = [
  { value: 'active', label: 'Pendientes', Icon: Clock },
  { value: 'expired', label: 'Vencidos', Icon: AlertTriangle },
  { value: 'done', label: 'Completados', Icon: CheckCircle2 },
  { value: 'all', label: 'Todos', Icon: Inbox },
];

/** "29 jul, 17:59 · 47 min" para una reunión de Meet. */
function fmtMeetingWhen(c: { endTime: string | null; minutes: number | null }): string {
  if (!c.endTime) return '—';
  const when = new Date(c.endTime).toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  return c.minutes != null ? `${when} · ${c.minutes} min` : when;
}
export default function RecordatoriosPage() {
  /**
   * ⚠️ EL MODAL DE TELÉFONO **NO SE MONTA** EN ESCRITORIO, y no es una optimización.
   *
   * Antes iba envuelto en `<div className="xl:hidden">`: invisible en pantalla grande,
   * pero montado. Y un `<dialog>` montado al que se le llama `showModal()` **deja inerte
   * el resto de la página** aunque no se vea — así que al abrir una ficha en escritorio
   * dejaban de funcionar TODOS los botones, sin nada que mirar. (Fernando, 2026-09-23:
   * «como si algo lo estuviese tapando, algo invisible y el mouse no hace nada».)
   *
   * Aquí no se elige un aspecto, se elige QUÉ SE MONTA: o el panel lateral o el modal.
   * Eso se decide en JavaScript, no con una clase.
   */
  const enTelefono = !useConsultaMedia(PANTALLA_XL);

  const {
    list, loading, fetchList, selected, selLoading, detail, selectReminder, cerrarDetalle,
    form, openCreate, openEdit, cerrarForm, alGuardar, del, setStatus, toggleDetailTask,
  } = useRecordatorios();
  // Abre en «Pendientes», que es lo que hay que atender (Fernando, 2026-10-05).
  const [tab, setTab] = useState('active');
  const [search, setSearch] = useState('');

  const [pendingOpen, setPendingOpen] = useState<number | null>(null);

  // Modal "Buscar reuniones" (generación MANUAL desde una reunión de Meet).
  const [meetModal, setMeetModal] = useState(false);
  const [meetDays, setMeetDays] = useState('7');
  const [meetLoading, setMeetLoading] = useState(false);
  const [meetList, setMeetList] = useState<MeetCandidate[]>([]);
  const [meetNote, setMeetNote] = useState<string | null>(null);
  const [meetScanned, setMeetScanned] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);

  // Enlace profundo desde la reunión (?open=<id>) → selecciona ese recordatorio en el panel.
  useEffect(() => {
    const openId = new URLSearchParams(window.location.search).get('open');
    if (openId) setPendingOpen(Number(openId));
  }, []);
  useEffect(() => {
    if (pendingOpen == null || list.length === 0) return;
    const found = list.find((r) => r.id === pendingOpen);
    if (found) { selectReminder(found); setPendingOpen(null); }
  }, [pendingOpen, list, selectReminder]);

  // Lista filtrada por estado efectivo + búsqueda; y conteos por estado.
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: list.length, active: 0, expired: 0, done: 0 };
    for (const r of list) c[effStatus(r)]++;
    return c;
  }, [list]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((r) => {
      if (tab !== 'all' && effStatus(r) !== tab) return false;
      if (q && !r.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [list, tab, search]);

  // ── Buscar reuniones de Meet y generar el recordatorio a mano ──
  const loadMeetings = useCallback(async (days: string) => {
    setMeetLoading(true);
    try {
      const r = await fetch(`/api/reminders/meetings?days=${days}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error al buscar reuniones');
      setMeetList(d.data || []);
      setMeetNote(d.note || null);
      setMeetScanned(true);
    } catch (e: any) {
      toast.error(e.message || 'Error al buscar reuniones');
    } finally { setMeetLoading(false); }
  }, []);

  const openMeetings = () => {
    setMeetModal(true);
    if (!meetScanned) loadMeetings(meetDays);
  };

  const changeMeetDays = (days: string) => { setMeetDays(days); loadMeetings(days); };

  const generateFromMeeting = async (c: MeetCandidate) => {
    setGenerating(c.recordName);
    try {
      const r = await fetch('/api/reminders/meetings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordName: c.recordName }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Error al generar el recordatorio');
      toast.success(d.data.alreadyExisted ? 'Esa reunión ya tenía recordatorio' : `Recordatorio creado: ${d.data.title}`);
      setMeetList(prev => prev.map(m => m.recordName === c.recordName
        ? { ...m, state: 'generated', reminderId: d.data.reminderId } : m));
      await fetchList();
    } catch (e: any) {
      toast.error(e.message || 'Error al generar el recordatorio');
    } finally { setGenerating(null); }
  };

  // Abre el recordatorio ya generado de una reunión (cierra el modal y lo selecciona).
  const openGenerated = (reminderId: number) => {
    setMeetModal(false);
    setPendingOpen(reminderId);
  };

  const detailStatus = detail ? effStatus(detail) : 'active';
  const accionesDetalle = !detail ? null : <AccionesDetalle detail={detail} alEliminar={del} alEditar={openEdit} alCambiarEstado={setStatus} />;
  const contenidoDetalle = (enPanel: boolean) => !detail ? null : <ContenidoDetalle detail={detail} cargando={selLoading} enPanel={enPanel} alMarcarTarea={toggleDetailTask} />;
  /** En el panel del teléfono, todo seguido, como antes. */
  const cuerpoDetalle = !detail ? null : (
  <div className="p-4 space-y-3">
    {contenidoDetalle(false)}
  </div>
  );

  return (
    <div>
      <PageHeader title="Recordatorios" description="Recordatorios con tareas y adjuntos" />

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* ── Left rail: estado ── */}
        <FilterRail
          title="Estado"
          items={STATUS_TABS.map((s) => ({ value: s.value, label: s.label, Icon: s.Icon, count: counts[s.value] }))}
          value={tab}
          onChange={setTab}
        />

        {/* ── Right region: command bar + table + detail ── */}
        <div className="flex-1 min-w-0 w-full">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
            <div className="min-w-0">
              {/* ⇒ EL PANEL DE DETALLE EMPIEZA ARRIBA (Fernando, 2026-10-29): la barra va dentro de
                  la columna de la lista. */}
              <BarraLista
                busqueda={search}
                onBusqueda={setSearch}
                placeholder="Buscar por título..."
                acciones={[
                  { label: 'Buscar reuniones', icon: Video, onClick: openMeetings, tipo: 'secundaria', hint: 'Buscar reuniones de Meet y generar su recordatorio' },
                  { label: 'Nuevo recordatorio', icon: Plus, onClick: openCreate, tipo: 'primaria' },
                ]}
              />
              {loading ? (
                <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando…" /></div>
              ) : (
              <PixelDataTable
            unidad={['recordatorio', 'recordatorios']}
                singleLine
                columns={[
                  { key: 'title', header: 'Recordatorio', render: (r: Reminder) => (
                    <span className="flex items-center gap-2 min-w-0">
                      {r.source === 'meeting' && <Video className="w-3.5 h-3.5 text-accent shrink-0" />}
                      <span className={`truncate text-[13px] font-medium ${selected?.id === r.id ? 'text-accent' : effStatus(r) === 'done' ? 'text-digi-muted line-through' : 'text-digi-text'}`} style={mf}>{r.title}</span>
                    </span>
                  ) },
                  { key: 'remind_at', header: 'Fecha', width: '120px', render: (r: Reminder) => (
                    <span className="text-[12px] text-digi-muted" style={mf}>{fmtShort(r.remind_at)}</span>
                  ) },
                  { key: 'tasks', header: 'Tareas', width: '90px', hideOnMobile: true, render: (r: Reminder) => {
                    const total = (r.tasks || []).length;
                    if (!total) return <span className="text-[12px] text-digi-muted/50" style={mf}>—</span>;
                    const done = (r.tasks || []).filter(t => t.done).length;
                    return <span className="inline-flex items-center gap-1 text-[12px] text-digi-muted tabular-nums" style={mf}><ListChecks className="w-3.5 h-3.5" /> {done}/{total}</span>;
                  } },
                ]}
                data={filtered}
                onRowClick={(r: Reminder) => selectReminder(r)}
                emptyTitle="Sin recordatorios"
                emptyDesc="No hay recordatorios en este estado."
                /* ── El recordatorio, contado para un teléfono ───────────────────────
                   La tabla recorta el título a media columna («Desarrollar Fase 1 el
                   Videoju…»), y un recordatorio del que no se lee el título no sirve
                   de nada: es TODO lo que tiene. Aquí ocupa el ancho y hasta dos
                   líneas, y debajo van la fecha y las tareas con su nombre. */
                tarjetaMovil={(r: Reminder) => {
                  const est = effStatus(r);
                  const tareas = r.tasks || [];
                  const hechas = tareas.filter((t) => t.done).length;
                  return (
                    <>
                      <div className="flex items-start gap-2">
                        {r.source === 'meeting' && <Video className="w-4 h-4 text-accent shrink-0 mt-0.5" />}
                        <span className={`flex-1 min-w-0 text-[13.5px] font-medium leading-snug ${est === 'done' ? 'text-digi-muted line-through' : 'text-digi-text'}`} style={mf}>
                          {r.title}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 text-[12px] text-digi-muted" style={mf}>
                        <span className="inline-flex items-center gap-1"><CalendarClock className="w-3.5 h-3.5" /> {fmtShort(r.remind_at)}</span>
                        {tareas.length > 0 && (
                          <span className="inline-flex items-center gap-1 tabular-nums"><ListChecks className="w-3.5 h-3.5" /> {hechas}/{tareas.length}</span>
                        )}
                        <span className="ml-auto"><PixelBadge variant={STATUS_VARIANT[est] || 'default'}>{STATUS_LABEL[est]}</PixelBadge></span>
                      </div>
                    </>
                  );
                }}
              />
              )}
            </div>

            {/* ── Detalle ─────────────────────────────────────────────────────────
                En escritorio es la tercera columna. En TELÉFONO el <aside> caía por
                debajo de la lista entera —a más de 1.500 px—, así que tocar una fila
                **no producía ningún cambio visible**: el detalle existía fuera de la
                pantalla. Aquí el mismo contenido se abre como panel a pantalla
                completa, que es el estándar del proyecto para lo que no cabe al lado. */}
            <aside className="hidden xl:block w-full xl:w-[360px]">
              {/* Fernando, 2026-10-29: la tarjeta del panel derecho llega hasta el pie aunque tenga poco; lo que no quepa se desplaza dentro. */}
              {!detail ? (
                <PanelHastaElPie desdeAncho={1280} className="bg-digi-card border border-digi-border rounded-lg p-6 text-center flex flex-col items-center justify-center">
                  <div className="w-10 h-10 rounded-lg bg-black/[0.03] flex items-center justify-center mx-auto mb-2">
                    <AlarmClock className="w-5 h-5 text-digi-muted" />
                  </div>
                  <p className="text-[12px] text-digi-muted" style={mf}>Selecciona un recordatorio para ver su detalle.</p>
                </PanelHastaElPie>
              ) : (
                /* Tres franjas: cabecera y acciones fijas; la lista de tareas se desplaza sola. */
                <PanelDetalle
                  titulo={
                    <span className="flex items-center gap-1.5">
                      {detail.source === 'meeting' && <Video className="w-4 h-4 text-accent shrink-0" />}
                      <span className={detailStatus === 'done' ? 'line-through text-digi-muted' : ''}>{detail.title}</span>
                    </span>
                  }
                  subtitulo={detail.source === 'meeting' ? 'Generado de una reunión' : (detail?.source === 'voz' ? 'Dictado a Gumdramon' : 'Recordatorio manual')}
                  onCerrar={cerrarDetalle}
                  pie={accionesDetalle}
                >
                  {contenidoDetalle(true)}
                </PanelDetalle>
              )}
            </aside>
          </div>
        </div>
      </div>

      {/* El detalle en teléfono. En escritorio NO se monta: ver `enTelefono`. */}
      {enTelefono && (
        <PixelModal
          open={!!detail}
          onClose={cerrarDetalle}
          title={detail?.title || 'Recordatorio'}
          size="md"
          pie={accionesDetalle}
        >
          {cuerpoDetalle}
        </PixelModal>
      )}

      {/* Modal: reuniones de Meet → generar recordatorio a mano */}
      <PixelModal open={meetModal} onClose={() => setMeetModal(false)} title="Reuniones recientes de Meet" size="lg" busy={!!generating}>
        <div className="space-y-3">
          <p className="text-[12px] text-digi-muted leading-relaxed" style={mf}>
            Tus reuniones de Google Meet, incluidas las <span className="text-digi-text font-medium">iniciadas sin agendar</span>.
            Genera el recordatorio con su transcripción cuando quieras: la IA saca el título, las tareas y la fecha de seguimiento.
          </p>

          <div className="flex items-center gap-2">
            <div className="w-48 shrink-0">
              <PixelSelect
                options={DAY_OPTIONS}
                value={meetDays}
                onChange={(e) => changeMeetDays(e.target.value)}
                disabled={meetLoading || !!generating}
              />
            </div>
            <button onClick={() => loadMeetings(meetDays)} disabled={meetLoading || !!generating} className={BTN_SECONDARY}>
              <RefreshCw className={`w-4 h-4 ${meetLoading ? 'animate-spin' : ''}`} /> Actualizar
            </button>
          </div>

          {meetNote && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-md border border-amber-500/40 bg-amber-500/10">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-px" />
              <p className="text-[12px] text-digi-text" style={mf}>{SCAN_NOTE[meetNote] || meetNote}</p>
            </div>
          )}

          {meetLoading ? (
            <div className="flex justify-center py-10"><BrandLoader size="lg" label="Buscando reuniones…" /></div>
          ) : meetList.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-10 h-10 rounded-lg bg-black/[0.03] flex items-center justify-center mx-auto mb-2">
                <Video className="w-5 h-5 text-digi-muted" />
              </div>
              <p className="text-[12px] text-digi-muted" style={mf}>
                {meetScanned && !meetNote ? 'No se encontraron reuniones en este periodo.' : 'Sin reuniones para mostrar.'}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {meetList.map((c) => (
                <div key={c.recordName} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-digi-border bg-digi-darker/40">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-digi-text truncate flex items-center gap-1.5" style={mf}>
                      <span className="shrink-0 inline-flex" title={c.kind === 'scheduled' ? 'Agendada en Mi día' : 'Iniciada sin agendar'}>
                        {c.kind === 'scheduled'
                          ? <CalendarDays className="w-3.5 h-3.5 text-accent" />
                          : <Radio className="w-3.5 h-3.5 text-accent" />}
                      </span>
                      {c.title}
                    </p>
                    <p className="text-[11px] text-digi-muted truncate" style={mf}>
                      {fmtMeetingWhen(c)}{c.meetingCode ? ` · ${c.meetingCode}` : ''}
                    </p>
                  </div>

                  <div className="shrink-0">
                    {c.state === 'generated' ? (
                      <button onClick={() => c.reminderId && openGenerated(c.reminderId)} disabled={!c.reminderId}
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline disabled:opacity-50" style={mf}>
                        <CheckCircle2 className="w-3.5 h-3.5" /> Ya generado <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : c.state === 'no-transcript' ? (
                      <PixelBadge variant="default">Sin transcripción</PixelBadge>
                    ) : (
                      <button onClick={() => generateFromMeeting(c)} disabled={!!generating}
                        className={`${BTN_PRIMARY} px-2.5 py-1.5 text-[12px]`}>
                        {generating === c.recordName
                          ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Generando…</>
                          : <><Sparkles className="w-3.5 h-3.5" /> Generar</>}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="text-[11px] text-digi-muted leading-relaxed pt-2 border-t border-digi-border" style={mf}>
            <span className="text-digi-text font-medium">Sin transcripción</span> = la reunión se hizo con la
            transcripción desactivada, o Google todavía no la ha liberado (puede tardar más de 15 minutos
            después de terminar). Vuelve a Actualizar más tarde.
          </p>
        </div>
      </PixelModal>

      {/* Modal crear / editar */}
      <FormRecordatorio abierto={form.abierto} datos={form.datos} onClose={cerrarForm} onGuardado={alGuardar} onEliminar={del} />
    </div>
  );
}
