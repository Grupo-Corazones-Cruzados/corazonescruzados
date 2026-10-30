'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import PixelModal from '@/components/ui/PixelModal';
import PixelConfirm from '@/components/ui/PixelConfirm';
import AutoGrowTextarea from '@/components/ui/AutoGrowTextarea';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import ThoughtCharts, { type DayBucket, type MonthBucket } from '@/components/pensamientos/ThoughtCharts';
import { DIMENSION_LABEL, DIMENSION_COLOR } from '@/lib/centralized/apoyo';
import { DIMENSION_ICON } from '@/components/centralized/dimensionIcons';
import { intensityOf } from '@/lib/centralized/pensamientos';
import { useAuth } from '@/components/providers/AuthProvider';
import { BrainCircuit, Plus, LineChart, CalendarDays, Pencil, Megaphone, Globe, Trash2 } from 'lucide-react';
import { useAltoHastaElPie } from '@/lib/hooks/useAltoHastaElPie';
import PixelDataTable from '@/components/ui/PixelDataTable';
import TablaVaciaHastaElPie from '@/components/ui/TablaVaciaHastaElPie';
import PanelDetalle from '@/components/ui/PanelDetalle';
import PanelHastaElPie from '@/components/ui/PanelHastaElPie';
import { useConsultaMedia, PANTALLA_XL } from '@/lib/hooks/useConsultaMedia';

const mf = { fontFamily: 'var(--font-body)' } as const;
/** Valor del `<select>` del teléfono para el filtro «En la página de inicio». */
const INICIO = '__inicio';
const df = { fontFamily: 'var(--font-display)' } as const;
const nf = new Intl.NumberFormat('es-ES');

interface Thought {
  id: number; content: string; charCount: number;
  category: string | null; day: string; createdAt: string; updatedAt: string;
}
interface Stats { days: DayBucket[]; months: MonthBucket[]; totals: { count: number; chars: number; uncategorized: number }; lastRun: any }

const fmtDayLong = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
};
/** La misma fecha sin el año, para las fichas del teléfono: «mié, 02 sept». */
const fmtDayCorto = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: 'short' });
};
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Guayaquil' });
const todayLocal = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil' }).format(new Date()); // YYYY-MM-DD

/**
 * Módulo "Pensamientos": cuaderno personal de captura rápida para miembros y candidatos.
 *
 * Izquierda: las fechas en las que se escribió, con su conteo. Derecha: el compositor
 * (siempre visible, para que capturar sea inmediato) y los pensamientos del día elegido.
 * El botón "Gráficos" abre el modal con la evolución y el desglose por tipo.
 *
 * Los pensamientos son PRIVADOS: cada petición resuelve el sujeto del usuario logueado y
 * el servidor filtra por fila; no hay forma de pedir los de otra persona desde aquí.
 */
export default function PensamientosPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  // Ids de los pensamientos publicados en la landing (solo los devuelve el API al admin).
  // Hasta `publicadosMax` (30) desde el 2026-10-30; antes, uno solo.
  const [publicados, setPublicados] = useState<number[]>([]);
  const [publicadosMax, setPublicadosMax] = useState(30);
  const [days, setDays] = useState<DayBucket[]>([]);
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  // Filtro «En la página de inicio» (Fernando, 2026-10-30): solo los publicados en la landing.
  // Excluye la fecha: elegir un día lo quita, y elegirlo quita el día.
  const [soloInicio, setSoloInicio] = useState(false);
  const elegirDia = (d: string | null) => { setSoloInicio(false); setSelectedDay(d); };
  const elegirInicio = () => { setSelectedDay(null); setSoloInicio(true); };
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{ id: number; content: string } | null>(null);
  // ⭐ TABLA + PANEL DERECHO (Fernando, 2026-10-30: «el diseño de tabla […] al elegir una fila en
  // un panel derecho poder ver todo el detalle del pensamiento elegido»). Mismo patrón que
  // Plataformas: desde 1280 px el panel está al lado y enseña siempre uno; por debajo, el
  // detalle se abre como panel lateral.
  const [elegido, setElegido] = useState<Thought | null>(null);
  const enVentana = !useConsultaMedia(PANTALLA_XL);
  const [confirm, setConfirm] = useState<{ text: string; onOk: () => void } | null>(null);
  const [chartsOpen, setChartsOpen] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  // Fernando, 2026-10-29: en escritorio el raíl de fechas y el centro llegan hasta el pie
  // aunque haya poco; lo que no quepa se desplaza dentro de cada uno, no la página.
  // Vista de computadora desde 768 px (antes 1024): Fernando trabaja en una ventana de ~1000 px y
  // veía la del teléfono (2026-10-30: «solo tenemos la vista de teléfono»).
  const railFechas = useAltoHastaElPie<HTMLElement>({ desdeAncho: 768, minimo: 320 });
  const centro = useAltoHastaElPie<HTMLDivElement>({ desdeAncho: 768, minimo: 320 });

  const load = useCallback(async (day?: string | null, inicio = false) => {
    setLoading(true);
    try {
      const qs = inicio ? '?publicados=1' : day ? `?day=${day}` : '';
      const res = await fetch(`/api/pensamientos${qs}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');
      setDays(j.data.days || []);
      setThoughts(j.data.thoughts || []);
      setPublicados(j.data.publishedIds ?? []);
      if (j.data.publicadosMax) setPublicadosMax(j.data.publicadosMax);
    } catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(selectedDay, soloInicio); }, [load, selectedDay, soloInicio]);

  // El elegido sigue a la lista: si cambia (otro día, se borró, se editó) se refresca o pasa al
  // primero. En la ventana lateral no se elige solo: se abre al tocar una fila.
  useEffect(() => {
    setElegido((e) => {
      const mismo = e ? thoughts.find((t) => t.id === e.id) : undefined;
      if (mismo) return mismo;
      return enVentana ? null : thoughts[0] ?? null;
    });
  }, [thoughts, enVentana]);

  /**
   * Publica un pensamiento en la página de inicio (o lo retira). Se pide confirmación al
   * publicar porque el texto pasa a ser PÚBLICO: lo ve cualquiera que abra la landing, sin
   * necesidad de tener cuenta. Caben `publicadosMax`; el servidor lo vigila igualmente.
   */
  const toggleFeatured = (t: Thought) => {
    const quitar = publicados.includes(t.id);
    const apply = async () => {
      setConfirm(null);
      try {
        const res = await fetch('/api/pensamientos/destacado', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: t.id, publicar: !quitar }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || 'Error');
        setPublicados((ids) => (quitar ? ids.filter((x) => x !== t.id) : [...ids, t.id]));
        // Con el filtro «En la página de inicio», el que se retira sale de la lista.
        if (quitar && soloInicio) setThoughts((ts) => ts.filter((x) => x.id !== t.id));
        toast.success(quitar ? 'Ya no se muestra en la página de inicio.' : 'Publicado en la página de inicio.');
      } catch (e: any) { toast.error(e.message); }
    };
    if (quitar) return apply();
    if (publicados.length >= publicadosMax) {
      toast.error(`Ya hay ${publicadosMax} pensamientos en la página de inicio. Retira uno para publicar este.`);
      return;
    }
    setConfirm({
      text: `Este pensamiento se mostrará en la página de inicio, donde puede leerlo cualquiera que entre al sitio, tenga cuenta o no. Llevas ${publicados.length} de ${publicadosMax} publicados. ¿Publicarlo?`,
      onOk: apply,
    });
  };

  const openCharts = async () => {
    setChartsOpen(true);
    try {
      const res = await fetch('/api/pensamientos/stats');
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');
      setStats(j.data);
    } catch (e: any) { toast.error(e.message); }
  };

  const save = async () => {
    const content = draft.trim();
    if (!content) return;
    setSaving(true);
    try {
      const res = await fetch('/api/pensamientos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');
      setDraft('');
      // Al guardar, saltamos al día de hoy para que el pensamiento recién escrito se vea.
      const today = todayLocal();
      if (soloInicio) elegirDia(null); // un pensamiento nuevo no está publicado: a «Recientes»
      else if (selectedDay && selectedDay !== today) setSelectedDay(today);
      else await load(selectedDay);
      taRef.current?.focus();
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const content = editing.content.trim();
    if (!content) return;
    try {
      const res = await fetch(`/api/pensamientos/${editing.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');
      setEditing(null);
      await load(selectedDay, soloInicio);
      toast.success('Pensamiento actualizado. La IA lo volverá a etiquetar esta noche.');
    } catch (e: any) { toast.error(e.message); }
  };

  const remove = (t: Thought) => setConfirm({
    text: '¿Eliminar este pensamiento? No se puede deshacer.',
    onOk: async () => {
      try {
        const res = await fetch(`/api/pensamientos/${t.id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json()).error || 'Error');
        await load(selectedDay, soloInicio);
      } catch (e: any) { toast.error(e.message); }
    },
  });

  // Ctrl/Cmd + Enter guarda: la captura no debería obligar a soltar el teclado.
  const onKey = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); save(); }
  };

  const totals = useMemo(() => days.reduce((a, d) => ({ count: a.count + d.count, chars: a.chars + d.chars }), { count: 0, chars: 0 }), [days]);
  const draftIntensity = intensityOf(draft.trim().length);

  return (
    <div className="flex flex-col md:flex-row gap-4 items-start">
      {/* ── Panel de fechas ─────────────────────────────────────────────────────────
          En escritorio es una columna. En TELÉFONO era la misma columna apilada arriba:
          17 fechas × 35 px = **600 px que hay que recorrer enteros antes de poder
          escribir**, y lo primero de este módulo es escribir («la captura tiene que ser
          inmediata», dice el compositor). Luego fue una tira de fichas que se deslizaba
          en horizontal: ocupaba una línea, pero de 19 fechas se veían dos y el resto había
          que adivinarlo. Ahora (Fernando, 2026-10-23: nada se desliza de lado escondiendo
          opciones) es un <select> nativo a todo el ancho: una línea, y la lista entera a
          un toque. */}
      <select aria-label="Fecha" value={soloInicio ? INICIO : selectedDay ?? ''}
        onChange={(e) => (e.target.value === INICIO ? elegirInicio() : elegirDia(e.target.value || null))}
        className="md:hidden field-control field-select h-11 w-full px-3 bg-digi-card border border-digi-border rounded-md text-[13.5px] text-digi-text appearance-none cursor-pointer" style={mf}>
        <option value="">Recientes{totals.count > 0 ? ` · ${totals.count}` : ''}</option>
        {isAdmin && <option value={INICIO}>En la página de inicio · {publicados.length}</option>}
        {days.map((d) => <option key={d.day} value={d.day}>{fmtDayCorto(d.day)} · {d.count}</option>)}
      </select>
      <aside ref={railFechas.ref} style={railFechas.style} className="hidden md:flex md:flex-col w-[230px] shrink-0 bg-digi-card border border-digi-border rounded-lg p-2">
        <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide px-2 pt-1 pb-2" style={df}>Fechas</p>

        {/* Escritorio: la columna de siempre */}
        <div className={`space-y-0.5 overflow-y-auto ${railFechas.style ? 'flex-1 min-h-0' : 'max-h-[70vh]'}`}>
          <BotonRail activo={selectedDay === null && !soloInicio} onClick={() => elegirDia(null)} icono={CalendarDays} texto="Recientes" cuenta={totals.count} />
          {/* «En la página de inicio» (2026-10-30): los publicados en la landing, hasta 30. Solo el
              admin: es quien publica. La cuenta dice cuántos de los 10 caben ya usados. */}
          {isAdmin && (
            <BotonRail
              activo={soloInicio} onClick={elegirInicio} icono={Globe} texto="En la página de inicio"
              cuenta={publicados.length} titulo={`${publicados.length} de ${publicadosMax} publicados`}
            />
          )}
          {days.length > 0 && <div className="mx-2 my-1.5 border-t border-digi-border" aria-hidden />}

          {days.map((d) => (
            <BotonRail key={d.day} activo={selectedDay === d.day} onClick={() => elegirDia(d.day)} texto={fmtDayLong(d.day)} cuenta={d.count} />
          ))}
          {days.length === 0 && !loading && (
            <p className="px-3 py-3 text-[11.5px] text-digi-muted/60" style={mf}>Todavía no has escrito nada.</p>
          )}
        </div>
      </aside>

      {/* Centro: compositor + pensamientos del día */}
      {/* Desde lg mide hasta el pie: arriba fijos el título y el compositor, y la lista de
          pensamientos se desplaza dentro (Fernando, 2026-10-29). */}
      <div ref={centro.ref} style={centro.style} className={`flex-1 min-w-0 w-full ${centro.style ? 'flex flex-col overflow-y-auto' : ''}`}>
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <BrainCircuit className="w-4 h-4 text-accent shrink-0" />
          <p className="text-[13px] font-semibold text-digi-text" style={df}>
            {soloInicio ? 'En la página de inicio' : selectedDay ? fmtDayLong(selectedDay) : 'Pensamientos recientes'}
          </p>
          <button className={`${BTN_SECONDARY} ml-auto h-11 md:h-auto shrink-0`} onClick={openCharts} style={mf}>
            <LineChart className="w-4 h-4" /> Gráficos
          </button>
        </div>

        {/* Compositor: siempre visible, la captura tiene que ser inmediata */}
        <div className="bg-digi-card border border-digi-border rounded-lg p-3 mb-3 shrink-0">
          <AutoGrowTextarea
            ref={taRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            minRows={4}
            placeholder="Escribe un pensamiento… puede ser una línea o una lectura larga."
            className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border rounded-md text-[13px] text-digi-text placeholder:text-digi-muted/50 focus:outline-none"
            style={mf}
          />
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {draft.trim().length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-digi-muted tabular-nums" style={mf}>
                <span style={{ color: draftIntensity.color }}>{draftIntensity.label}</span> · {nf.format(draft.trim().length)} caracteres
              </span>
            )}
            <button className={`${BTN_PRIMARY} ml-auto h-11 md:h-auto`} onClick={save} disabled={saving || !draft.trim()} style={mf} title="⌘/Ctrl + Enter">
              <Plus className="w-4 h-4" /> Guardar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
          <div className="min-w-0">
            {loading && thoughts.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-digi-muted" style={mf}>Cargando…</p>
            ) : (
              <TablaVaciaHastaElPie vacia={thoughts.length === 0}>
                <PixelDataTable
                  unidad={['pensamiento', 'pensamientos']}
                  singleLine
                  tablaDesde="md"
                  data={thoughts}
                  onRowClick={(t: Thought) => setElegido(t)}
                  rowClassName={(t: Thought) => (!enVentana && elegido?.id === t.id ? 'bg-accent/5' : '')}
                  emptyTitle={soloInicio ? 'Ningún pensamiento en la página de inicio' : `Sin pensamientos ${selectedDay ? 'este día' : 'todavía'}`}
                  emptyDesc={soloInicio ? 'Publica uno desde su detalle.' : 'Escribe arriba para empezar.'}
                  columns={[
                    { key: 'cuando', header: selectedDay ? 'Hora' : 'Fecha', width: selectedDay ? '70px' : '150px', render: (t: Thought) => (
                      <span className="text-[12px] text-digi-muted tabular-nums" style={mf}>
                        {selectedDay ? fmtTime(t.createdAt) : `${fmtDayCorto(t.day)} · ${fmtTime(t.createdAt)}`}
                      </span>
                    ) },
                    { key: 'texto', header: 'Pensamiento', render: (t: Thought) => (
                      <span className="flex items-center gap-1.5 min-w-0">
                        {publicados.includes(t.id) && <Globe className="w-3.5 h-3.5 text-accent shrink-0" aria-label="En la página de inicio" />}
                        <span className={`truncate text-[13px] ${!enVentana && elegido?.id === t.id ? 'text-accent font-medium' : 'text-digi-text'}`} style={mf}>{t.content}</span>
                      </span>
                    ) },
                    { key: 'dimension', header: 'Dimensión', width: '120px', hideOnMobile: true, render: (t: Thought) => <Dimension categoria={t.category} /> },
                    { key: 'intensidad', header: 'Intensidad', width: '96px', hideOnMobile: true, render: (t: Thought) => <Intensidad chars={t.charCount} /> },
                  ]}
                  tarjetaMovil={(t: Thought) => (
                    <div style={mf}>
                      <div className="flex items-center gap-2 mb-1 text-[11.5px] text-digi-muted tabular-nums">
                        <span>{selectedDay ? fmtTime(t.createdAt) : `${fmtDayCorto(t.day)} · ${fmtTime(t.createdAt)}`}</span>
                        <Intensidad chars={t.charCount} />
                        <Dimension categoria={t.category} />
                        {publicados.includes(t.id) && <Globe className="w-3.5 h-3.5 text-accent" aria-label="En la página de inicio" />}
                      </div>
                      <p className="text-[13px] text-digi-text line-clamp-2">{t.content}</p>
                    </div>
                  )}
                />
              </TablaVaciaHastaElPie>
            )}
          </div>

          {!enVentana && (
            <aside className="w-full xl:w-[360px]">
              {elegido ? (
                <DetallePensamiento
                  key={elegido.id} t={elegido}
                  publicado={publicados.includes(elegido.id)} puedePublicar={isAdmin}
                  onPublicar={() => toggleFeatured(elegido)}
                  onEditar={() => setEditing({ id: elegido.id, content: elegido.content })}
                  onEliminar={() => remove(elegido)}
                />
              ) : (
                <PanelHastaElPie desdeAncho={1280} className="bg-digi-card border border-digi-border rounded-lg p-6 text-center flex flex-col justify-center">
                  <BrainCircuit className="w-5 h-5 text-digi-muted mx-auto mb-2" />
                  <p className="text-[12px] text-digi-muted" style={mf}>Elige un pensamiento para leerlo entero.</p>
                </PanelHastaElPie>
              )}
            </aside>
          )}
        </div>
      </div>

      {/* El detalle por debajo de 1280 px: el mismo, en el panel lateral. En escritorio no se monta. */}
      {enVentana && (
        <PixelModal open={!!elegido} onClose={() => setElegido(null)} title="Pensamiento" size="md"
          pie={elegido && <AccionesPensamiento publicado={publicados.includes(elegido.id)} puedePublicar={isAdmin}
            onPublicar={() => toggleFeatured(elegido)}
            onEditar={() => setEditing({ id: elegido.id, content: elegido.content })}
            onEliminar={() => remove(elegido)} />}>
          {elegido && <CuerpoPensamiento t={elegido} publicado={publicados.includes(elegido.id)} />}
        </PixelModal>
      )}

      {/* Editar: en el panel lateral, nunca en la fila (regla «nada de edición inline»). */}
      <PixelModal open={!!editing} onClose={() => setEditing(null)} title="Editar pensamiento" size="md"
        pie={<>
          <button className={BTN_SECONDARY} onClick={() => setEditing(null)} style={mf}>Cancelar</button>
          <button className={BTN_PRIMARY} onClick={saveEdit} disabled={!editing?.content.trim()} style={mf}>Guardar</button>
        </>}>
        {editing && (
          <AutoGrowTextarea
            value={editing.content} onChange={(e) => setEditing({ id: editing.id, content: e.target.value })} minRows={10}
            className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border rounded-md text-[13px] text-digi-text leading-relaxed focus:outline-none"
            style={mf}
          />
        )}
      </PixelModal>

      <PixelModal open={chartsOpen} onClose={() => setChartsOpen(false)} title="Tus pensamientos en gráficos" size="lg">
        {stats
          ? <ThoughtCharts days={stats.days} months={stats.months} totals={stats.totals} />
          : <p className="py-10 text-center text-[13px] text-digi-muted" style={mf}>Cargando…</p>}
      </PixelModal>

      <PixelConfirm
        open={!!confirm}
        message={confirm?.text || ''}
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => { const c = confirm; setConfirm(null); c?.onOk(); }}
      />
    </div>
  );
}

/**
 * La dimensión del pensamiento: su icono y su nombre en el color de la dimensión (el mismo de los
 * gráficos). Sin cápsula con relleno ni borde (Fernando, 2026-10-29).
 */
function Dimension({ categoria }: { categoria: string | null }) {
  const Icon = categoria ? DIMENSION_ICON[categoria] : null;
  if (!categoria || !Icon) return <span className="text-[11.5px] text-digi-muted/60" style={mf}>Sin etiquetar</span>;
  return (
    <span className="inline-flex items-center gap-1 text-[12px] font-medium" style={{ ...mf, color: DIMENSION_COLOR[categoria] }}>
      <Icon className="w-3.5 h-3.5 shrink-0" /> {DIMENSION_LABEL[categoria]}
    </span>
  );
}

/** «Breve / Media / Profunda…», en el color de su intensidad. */
function Intensidad({ chars }: { chars: number }) {
  const i = intensityOf(chars);
  return <span className="text-[12px] font-medium" style={{ ...mf, color: i.color }}>{i.label}</span>;
}

/** Lo que se lee del pensamiento: sus datos y el texto ENTERO. Lo comparten el panel y la ventana. */
function CuerpoPensamiento({ t, publicado }: { t: Thought; publicado: boolean }) {
  const filas: [string, React.ReactNode][] = [
    ['Fecha', `${fmtDayLong(t.day)} · ${fmtTime(t.createdAt)}`],
    ['Dimensión', <Dimension key="d" categoria={t.category} />],
    ['Intensidad', <Intensidad key="i" chars={t.charCount} />],
    ['Caracteres', nf.format(t.charCount)],
    ...(publicado ? [['Página de inicio', <span key="p" className="inline-flex items-center gap-1 text-accent"><Globe className="w-3.5 h-3.5" /> Publicado</span>] as [string, React.ReactNode]] : []),
  ];
  return (
    <div className="space-y-4">
      <dl className="divide-y divide-digi-border border-y border-digi-border" style={mf}>
        {filas.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 py-2">
            <dt className="text-[11.5px] text-digi-muted shrink-0">{k}</dt>
            <dd className="text-[12.5px] text-digi-text text-right min-w-0">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[13.5px] text-digi-text whitespace-pre-wrap leading-relaxed" style={mf}>{t.content}</p>
    </div>
  );
}

/** Publicar (solo el admin), editar y eliminar: fijos al pie del panel. */
function AccionesPensamiento({ publicado, puedePublicar, onPublicar, onEditar, onEliminar }: {
  publicado: boolean; puedePublicar: boolean; onPublicar: () => void; onEditar: () => void; onEliminar: () => void;
}) {
  return (
    <div className="flex items-center gap-2 w-full">
      <button className={BTN_DANGER} onClick={onEliminar} style={mf} title="Eliminar pensamiento" aria-label="Eliminar pensamiento">
        <Trash2 className="w-4 h-4" />
      </button>
      <div className="flex-1" />
      {puedePublicar && (
        <button className={BTN_SECONDARY} onClick={onPublicar} style={mf}>
          <Megaphone className="w-4 h-4" /> {publicado ? 'Quitar del inicio' : 'Publicar'}
        </button>
      )}
      <button className={BTN_PRIMARY} onClick={onEditar} style={mf}><Pencil className="w-4 h-4" /> Editar</button>
    </div>
  );
}

/** El panel de la derecha (desde 1280 px), con `PanelDetalle`: cabecera, texto que se desplaza y acciones fijas. */
function DetallePensamiento({ t, publicado, puedePublicar, onPublicar, onEditar, onEliminar }: {
  t: Thought; publicado: boolean; puedePublicar: boolean; onPublicar: () => void; onEditar: () => void; onEliminar: () => void;
}) {
  return (
    <PanelDetalle titulo="Pensamiento" subtitulo={`${fmtDayLong(t.day)} · ${fmtTime(t.createdAt)}`} icono={BrainCircuit}
      pie={<AccionesPensamiento publicado={publicado} puedePublicar={puedePublicar} onPublicar={onPublicar} onEditar={onEditar} onEliminar={onEliminar} />}>
      <CuerpoPensamiento t={t} publicado={publicado} />
    </PanelDetalle>
  );
}

/**
 * Una entrada del raíl de fechas: «Recientes», «En la página de inicio» o un día. La elegida, con
 * el realce del raíl (fondo de acento suave + raya a la izquierda). La cuenta va como TEXTO, sin
 * cápsula de color (Diseño.md: cifras e indicadores sin relleno).
 */
function BotonRail({
  activo, onClick, texto, cuenta, icono: Icono, titulo,
}: {
  activo: boolean; onClick: () => void; texto: string; cuenta?: number;
  icono?: React.ComponentType<{ className?: string }>; titulo?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={titulo}
      aria-current={activo ? 'true' : undefined}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors border-l-2 ${
        activo ? 'bg-accent-light border-accent text-accent' : 'border-transparent text-digi-text hover:bg-black/[0.03]'
      }`}
    >
      {Icono && <Icono className={`w-4 h-4 shrink-0 ${activo ? 'text-accent' : 'text-digi-muted'}`} />}
      <span className="flex-1 min-w-0 text-[12.5px] font-medium truncate" style={mf}>{texto}</span>
      {!!cuenta && (
        <span className={`text-[11px] font-semibold tabular-nums ${activo ? 'text-accent' : 'text-digi-muted'}`} style={mf}>{cuenta}</span>
      )}
    </button>
  );
}
