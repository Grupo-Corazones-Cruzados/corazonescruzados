'use client';

import { useCallback, useEffect, useState } from 'react';
import { useConsultaMedia, PANTALLA_XL } from '@/lib/hooks/useConsultaMedia';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PageHeader from '@/components/ui/PageHeader';
import PixelModal from '@/components/ui/PixelModal';
import FilterRail, { type FilterRailItem } from '@/components/ui/FilterRail';
import Button, { BTN_PRIMARY } from '@/components/ui/Button';
import { useAuth } from '@/components/providers/AuthProvider';
import { LifeBuoy, DoorOpen, Loader, CheckCircle2, Archive, X, ArrowRight, Plus, Search, MessageSquare } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

const STATUS_TABS = [
  { value: 'all', label: 'Todos', Icon: LifeBuoy },
  { value: 'open', label: 'Abiertos', Icon: DoorOpen },
  { value: 'in_progress', label: 'En proceso', Icon: Loader },
  { value: 'resolved', label: 'Resueltos', Icon: CheckCircle2 },
  { value: 'closed', label: 'Cerrados', Icon: Archive },
];

const TYPE_LABELS: Record<string, string> = { bug: 'Error', feature: 'Sugerencia', question: 'Pregunta', other: 'Otro' };
const STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  open: 'warning', in_progress: 'info', resolved: 'success', closed: 'default',
};
const STATUS_LABEL: Record<string, string> = {
  open: 'Abierto', in_progress: 'En proceso', resolved: 'Resuelto', closed: 'Cerrado',
};
const STATUS_DOT: Record<string, string> = {
  success: 'bg-green-500', warning: 'bg-amber-500', error: 'bg-red-500', info: 'bg-accent', default: 'bg-digi-muted',
};

const TYPE_OPTIONS = [
  { value: 'bug', label: 'Error' },
  { value: 'feature', label: 'Sugerencia' },
  { value: 'question', label: 'Pregunta' },
  { value: 'other', label: 'Otro' },
];

const emptyForm = { type: 'bug', subject: '', message: '' };

export default function SupportPage() {
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

  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tickets, setTickets] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);

  // Alta de ticket: panel lateral derecho con overlay (estándar de formularios).
  const [form, setForm] = useState<typeof emptyForm | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams();
    if (tab !== 'all') params.set('status', tab);
    if (search) params.set('search', search);
    try {
      const res = await fetch(`/api/support?${params}`);
      const data = await res.json();
      setTickets(data.data || []);
      setCounts(data.counts || {});
    } catch { setTickets([]); }
  }, [tab, search]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setSelected(null); }, [tab, search]);

  const railItems: FilterRailItem<string>[] = STATUS_TABS.map((s) => ({
    value: s.value, label: s.label, Icon: s.Icon, count: counts[s.value] ?? 0,
  }));

  const create = async () => {
    if (!form) return;
    if (!form.subject.trim()) return toast.error('Ponle un asunto al ticket.');
    if (!form.message.trim()) return toast.error('Cuéntanos qué ocurre.');
    setSaving(true);
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');
      toast.success('Ticket enviado. Te responderemos por aquí.');
      setForm(null);
      setTab('all');
      fetchData();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  /** El cuerpo del resumen, una sola vez: columna en escritorio, panel en teléfono. */
  const cuerpoResumen = !selected ? null : (
  <div className="p-4 space-y-2.5">
    {[
      ['Estado', <PixelBadge key="s" variant={STATUS_V[selected.status] || 'default'}>{STATUS_LABEL[selected.status] || selected.status}</PixelBadge>],
      ['Tipo', TYPE_LABELS[selected.type] || selected.type],
      ['Respuestas', String(selected.reply_count || 0)],
      ['Fecha', new Date(selected.created_at).toLocaleDateString('es-EC')],
    ].map(([k, v]) => (
      <div key={k as string} className="flex items-center justify-between gap-3 text-[12px]">
        <span className="text-digi-muted" style={mf}>{k}</span>
        <span className="text-digi-text text-right" style={mf}>{v}</span>
      </div>
    ))}
    {selected.message && <p className="text-[12px] text-digi-text leading-relaxed line-clamp-3" style={mf}>{selected.message}</p>}
    <button onClick={() => router.push(`/dashboard/support/${selected.id}`)} className={`${BTN_PRIMARY} w-full mt-1`}>
      Ver ticket <ArrowRight className="w-4 h-4" />
    </button>
  </div>
  );

  return (
    <div>
      <PageHeader
        title="Soporte"
        description={isAdmin ? 'Todos los tickets de soporte y su seguimiento' : 'Tus tickets de soporte y su estado'}
      />

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* ── Left rail: estado (mismo componente y misma posición que Tickets) ── */}
        <FilterRail title="Estado" items={railItems} value={tab} onChange={setTab} />

        {/* ── Right region: command bar + list · panel ── */}
        <div className="flex-1 min-w-0 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-digi-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por asunto..."
                className="field-control w-full pl-8 pr-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none"
                style={mf}
              />
            </div>
            <button
              onClick={() => setForm({ ...emptyForm })}
              className="inline-flex items-center justify-center gap-1.5 h-11 sm:h-auto px-3 sm:py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover transition-colors shrink-0"
              style={mf}
            >
              <Plus className="w-4 h-4" /> Nuevo ticket
            </button>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
            <div className="min-w-0">
              <PixelDataTable
                singleLine
                data={tickets}
                onRowClick={(t: any) => setSelected(t)}
                emptyTitle="Sin tickets"
                emptyDesc={isAdmin
                  ? 'No hay tickets de soporte en este estado.'
                  : 'No tienes tickets en este estado. Abre uno con "Nuevo ticket".'}
                columns={[
                  { key: 'id', header: 'ID', width: '56px', render: (t: any) => <span className="tabular-nums text-digi-muted">#{t.id}</span> },
                  { key: 'subject', header: 'Asunto', render: (t: any) => (
                    <span className="flex items-center gap-2 min-w-0">
                      <span title={STATUS_LABEL[t.status] || t.status} className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[STATUS_V[t.status] || 'default']}`} />
                      <span className={`truncate text-[13px] font-medium ${selected?.id === t.id ? 'text-accent' : 'text-digi-text'}`} style={mf}>{t.subject}</span>
                    </span>
                  ) },
                  { key: 'type', header: 'Tipo', width: '130px', hideOnMobile: true, render: (t: any) => <span className="text-[12px] text-digi-muted" style={mf}>{TYPE_LABELS[t.type] || t.type}</span> },
                  { key: 'replies', header: 'Respuestas', width: '100px', hideOnMobile: true, render: (t: any) => <span className="text-[12px] text-digi-muted tabular-nums" style={mf}>{t.reply_count || 0}</span> },
                  { key: 'date', header: 'Fecha', width: '110px', hideOnMobile: true, render: (t: any) => <span className="text-[12px] text-digi-muted" style={mf}>{new Date(t.created_at).toLocaleDateString('es-EC')}</span> },
                ]}
                /* En la tabla el asunto se recorta y el tipo, las respuestas y la fecha
                   están ocultos (`hideOnMobile`) — o sea, en un teléfono la fila decía
                   media frase y nada más. Aquí cabe todo. */
                tarjetaMovil={(t: any) => (
                  <>
                    <div className="flex items-start gap-2">
                      <span title={STATUS_LABEL[t.status] || t.status} className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${STATUS_DOT[STATUS_V[t.status] || 'default']}`} />
                      <span className="flex-1 min-w-0 text-[13.5px] font-medium text-digi-text leading-snug" style={mf}>{t.subject}</span>
                      <span className="shrink-0"><PixelBadge variant={STATUS_V[t.status] || 'default'}>{STATUS_LABEL[t.status] || t.status}</PixelBadge></span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 pl-4 text-[12px] text-digi-muted" style={mf}>
                      <span className="tabular-nums">#{t.id}</span>
                      <span>{TYPE_LABELS[t.type] || t.type}</span>
                      <span className="inline-flex items-center gap-1 tabular-nums"><MessageSquare className="w-3.5 h-3.5" /> {t.reply_count || 0}</span>
                      <span className="ml-auto">{new Date(t.created_at).toLocaleDateString('es-EC')}</span>
                    </div>
                  </>
                )}
              />
            </div>

            {/* ── Resumen ──────────────────────────────────────────────────────────
                En teléfono caía bajo la lista entera, así que tocar una fila no
                producía ningún cambio visible. Ahí se abre a pantalla completa. */}
            <aside className="hidden xl:block w-full xl:w-[340px]">
              {!selected ? (
                <div className="bg-digi-card border border-digi-border rounded-lg p-6 text-center lg:sticky lg:top-4">
                  <div className="w-10 h-10 rounded-lg bg-black/[0.03] flex items-center justify-center mx-auto mb-2">
                    <LifeBuoy className="w-5 h-5 text-digi-muted" />
                  </div>
                  <p className="text-[12px] text-digi-muted" style={mf}>Selecciona un ticket para ver un resumen.</p>
                </div>
              ) : (
                <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm overflow-hidden lg:sticky lg:top-4">
                  <div className="flex items-start gap-3 p-4 border-b border-digi-border">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[14px] font-semibold text-digi-text leading-tight" style={mf}>{selected.subject}</h3>
                      <p className="text-[11px] text-digi-muted mt-0.5" style={mf}>Ticket #{selected.id}</p>
                    </div>
                    <button onClick={() => setSelected(null)} className="text-digi-muted hover:text-digi-text shrink-0" aria-label="Cerrar"><X className="w-4 h-4" /></button>
                  </div>
                  {cuerpoResumen}
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>

      {/* El detalle en teléfono. En escritorio NO se monta: ver `enTelefono`. */}
      {enTelefono && (
        <PixelModal
          open={!!selected}
          onClose={() => setSelected(null)}
          title={selected ? `#${selected.id} · ${selected.subject}` : 'Ticket'}
          size="md"
        >
          {cuerpoResumen}
        </PixelModal>
      )}

      {/* ── Nuevo ticket (panel lateral derecho) ── */}
      {form && (
        <PixelModal open onClose={() => !saving && setForm(null)} title="Nuevo ticket de soporte" size="md" busy={saving}>
          <div className="space-y-3.5">
            <div className="flex flex-col gap-1">
              <label className="field-label text-[12px] font-semibold text-digi-text" style={mf} htmlFor="s-type">Tipo</label>
              <select
                id="s-type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="field-control field-select w-full px-3 py-2 bg-digi-darker border border-digi-border rounded text-[13px] text-digi-text focus:border-accent focus:outline-none appearance-none cursor-pointer"
                style={mf}
              >
                {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="field-label text-[12px] font-semibold text-digi-text" style={mf} htmlFor="s-subject">Asunto</label>
              <input
                id="s-subject"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                maxLength={200}
                placeholder="Resume el problema en una línea"
                className="field-control w-full px-3 py-2 bg-digi-darker border border-digi-border rounded text-[13px] text-digi-text placeholder:text-digi-muted/60 focus:border-accent focus:outline-none"
                style={mf}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="field-label text-[12px] font-semibold text-digi-text" style={mf} htmlFor="s-message">Descripción</label>
              <textarea
                id="s-message"
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                rows={6}
                maxLength={5000}
                placeholder="Qué pasó, qué esperabas y en qué parte del sistema."
                className="field-control w-full px-3 py-2 bg-digi-darker border border-digi-border rounded text-[13px] text-digi-text placeholder:text-digi-muted/60 focus:border-accent focus:outline-none resize-y"
                style={mf}
              />
              <span className="text-[11px] text-digi-muted" style={mf}>
                El equipo de soporte responderá en este mismo ticket; verás su estado en la lista.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-digi-border">
              <Button variant="secondary" className="h-11 sm:h-auto" onClick={() => setForm(null)} disabled={saving}>Cancelar</Button>
              <Button className="h-11 sm:h-auto" onClick={create} disabled={saving}>{saving ? 'Enviando...' : 'Enviar ticket'}</Button>
            </div>
          </div>
        </PixelModal>
      )}
    </div>
  );
}
