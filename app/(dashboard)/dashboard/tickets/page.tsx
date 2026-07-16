'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import PixelSelect from '@/components/ui/PixelSelect';
import PageHeader from '@/components/ui/PageHeader';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { fmt2 } from '@/lib/format';
import { accessRoleOf } from '@/lib/dashboard/access';
import AssigneePicker from '@/components/tickets/AssigneePicker';
import MultiSelectSearch from '@/components/ui/MultiSelectSearch';
import { TALENTOS } from '@/lib/centralized/talentos';
import {
  Inbox, Clock, CheckCircle2, CircleCheck, XCircle, Search, Plus, FileText, ChevronLeft, ChevronRight,
  X, ArrowRight, Ticket as TicketIcon, DoorOpen,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const STATUS_TABS = [
  { value: 'all', label: 'Todos', Icon: Inbox },
  { value: 'open', label: 'Abiertos', Icon: DoorOpen },
  { value: 'pending', label: 'Pendientes', Icon: Clock },
  { value: 'confirmed', label: 'Confirmados', Icon: CircleCheck },
  { value: 'completed', label: 'Completados', Icon: CheckCircle2 },
  { value: 'cancelled', label: 'Cancelados', Icon: XCircle },
];

const STATUS_VARIANT: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  pending: 'warning', confirmed: 'info', in_progress: 'info',
  completed: 'success', cancelled: 'error', withdrawn: 'default',
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente', confirmed: 'Confirmado', in_progress: 'En progreso',
  completed: 'Completado', cancelled: 'Cancelado', withdrawn: 'Retirado',
};
// Punto de color por variante para mostrar el estado sin columna dedicada.
const STATUS_DOT: Record<string, string> = {
  success: 'bg-green-500', warning: 'bg-amber-500', error: 'bg-red-500', info: 'bg-accent', default: 'bg-digi-muted',
};

const PER_PAGE = 15;

type SelectedDates = string[];

const emptyForm = {
  title: '', description: '', service_id: '', member_id: '', client_id: '',
  client_email: '', client_mode: 'select' as 'select' | 'email',
  deadline: '', estimated_hours: '', estimated_cost: '',
  open_for_proposals: false,
  // Solicitar: modo de asignación. invite=elijo miembro · proposals=abierto a propuestas ·
  // talent=abierto por talento (miembro con el talento requerido lo toma de inmediato).
  request_option: 'invite' as 'invite' | 'proposals' | 'talent',
  required_talents: [] as string[],
};

const TALENT_OPTIONS = TALENTOS.map((t) => ({ value: t, label: t }));

const REQUEST_OPTIONS: { value: 'proposals' | 'talent' | 'invite'; label: string; hint: string }[] = [
  { value: 'proposals', label: 'Dejar abierto a propuestas', hint: 'Cualquier miembro propone; tú eliges a quién aceptar.' },
  { value: 'talent', label: 'Permitir que un miembro se haga responsable', hint: 'Visible a miembros con el talento requerido; el primero con ese talento lo toma de inmediato.' },
  { value: 'invite', label: 'Invitar a miembro responsable', hint: 'Asignas directamente a un miembro específico.' },
];

export default function TicketsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tab, setTab] = useState('all');
  const [selected, setSelected] = useState<any>(null);
  const [selDetail, setSelDetail] = useState<any>(null);
  const [selLoading, setSelLoading] = useState(false);

  const selectTicket = async (t: any) => {
    setSelected(t); setSelDetail(null); setSelLoading(true);
    try {
      const res = await fetch(`/api/tickets/${t.id}`);
      const data = await res.json();
      setSelDetail(data.data || null);
    } catch { setSelDetail(null); }
    finally { setSelLoading(false); }
  };
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Create ticket state. `createMode`: 'create' = Nuevo ticket (yo soy el miembro asignado);
  // 'request' = Solicitar ticket (yo soy el cliente; elijo miembro o lo dejo a propuestas).
  const [modal, setModal] = useState(false);
  const [createMode, setCreateMode] = useState<'create' | 'request'>('create');
  const [form, setForm] = useState(emptyForm);
  const [selectedDates, setSelectedDates] = useState<SelectedDates>([]);
  const [slotsModal, setSlotsModal] = useState(false);
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() }; });
  const [creating, setCreating] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);

  const fetchTickets = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: String(PER_PAGE) });
    if (tab === 'open') params.set('open', '1');
    else if (tab !== 'all') params.set('status', tab);
    if (search) params.set('search', search);
    try {
      const res = await fetch(`/api/tickets?${params}`);
      const data = await res.json();
      setTickets(data.data || []);
      setTotal(data.total || 0);
      setCounts(data.counts || {});
    } catch { setTickets([]); }
  }, [page, tab, search]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);
  useEffect(() => { setPage(1); setSelected(null); setSelDetail(null); }, [tab, search]);

  const openCreateModal = async (mode: 'create' | 'request') => {
    setCreateMode(mode);
    setSelectedDates([]);
    // Nuevo ticket: el miembro asignado es la sesión (candidato/miembro/admin con member_id).
    const base = { ...emptyForm };
    if (mode === 'create' && user?.member_id) base.member_id = String(user.member_id);
    setForm(base);
    setModal(true);
    const [sRes, mRes, cRes] = await Promise.all([
      // "Nuevo ticket": los servicios elegibles son MIS servicios ACTIVOS (de mis talentos).
      (mode === 'create' && user?.member_id
        ? fetch(`/api/members/${user.member_id}/services?active=1`)
        : fetch('/api/services')).then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/members/list').then(r => r.json()).catch(() => ({ data: [] })),
      // Nuevo: clientes ASOCIADOS a mi sesión; Solicitar: no usa lista (cliente = mi cuenta).
      mode === 'create'
        ? fetch('/api/clients?mine=1').then(r => r.json()).catch(() => ({ data: [] }))
        : Promise.resolve({ data: [] }),
    ]);
    setServices(sRes.data || []);
    setMembers(mRes.data || []);
    setClients(cRes.data || []);
  };

  const handleCreate = async () => {
    if (!form.title.trim()) { toast.error('El título es requerido'); return; }
    if (!form.deadline) { toast.error('La fecha límite es requerida'); return; }
    // Los días de trabajo solo aplican al CREAR un ticket propio (yo soy el miembro),
    // no al solicitarlo (yo soy el cliente).
    if (createMode === 'create' && user?.role === 'member' && selectedDates.length === 0) {
      toast.error('Debes indicar al menos un día de trabajo'); return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: createMode,
          open_for_proposals: createMode === 'request' && form.request_option === 'proposals',
          open_for_talent: createMode === 'request' && form.request_option === 'talent',
          required_talents: createMode === 'request' && form.request_option === 'talent' ? form.required_talents : undefined,
          title: form.title,
          description: form.description || undefined,
          service_id: form.service_id ? Number(form.service_id) : undefined,
          // En 'request' el miembro sale del buscador (o queda abierto a propuestas);
          // en 'create' el miembro es la sesión.
          member_id: form.member_id ? Number(form.member_id) : undefined,
          // En 'request' el cliente lo resuelve el backend (mi cuenta cliente).
          client_id: createMode === 'create' && form.client_id ? Number(form.client_id) : undefined,
          client_email: createMode === 'create' ? (form.client_email?.trim() || undefined) : undefined,
          deadline: form.deadline || undefined,
          estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : undefined,
          estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : undefined,
          time_slots: selectedDates.length > 0 ? selectedDates.map(d => ({ date: d })) : undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      toast.success('Ticket creado exitosamente');
      setModal(false); setForm(emptyForm); setSelectedDates([]);
      fetchTickets();
    } catch (err: any) {
      toast.error(err.message || 'Error al crear ticket');
    } finally {
      setCreating(false);
    }
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  const RailItem = ({ active, Icon, label, count, onClick }: any) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors border-l-2 ${
        active ? 'bg-accent-light border-accent text-accent' : 'border-transparent text-digi-text hover:bg-black/[0.03]'
      }`}
    >
      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-accent' : 'text-digi-muted'}`} />
      <span className="flex-1 min-w-0 text-[12.5px] font-medium truncate" style={mf}>{label}</span>
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${active ? 'bg-accent/15 text-accent' : 'bg-black/[0.05] text-digi-muted'}`}>{count ?? 0}</span>
    </button>
  );

  return (
    <div>
      <PageHeader title="Tickets" description="Solicitudes de trabajo y soporte" />

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* ── Left rail: estado ── */}
        <aside className="w-full lg:w-[220px] shrink-0 bg-digi-card border border-digi-border rounded-lg p-2">
          <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide px-2 pt-1 pb-2" style={df}>Estado</p>
          <div className="space-y-0.5">
            {STATUS_TABS.filter((s) => s.value !== 'open' || accessRoleOf(user) !== 'client').map((s) => (
              <RailItem key={s.value} active={tab === s.value} Icon={s.Icon} label={s.label}
                count={counts[s.value]} onClick={() => setTab(s.value)} />
            ))}
          </div>
        </aside>

        {/* ── Right region: command bar + table ── */}
        <div className="flex-1 min-w-0 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-0">
              <Search className="w-4 h-4 text-digi-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por título..."
                className="field-control w-full pl-8 pr-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none"
                style={mf}
              />
            </div>
            {/* Solicitar ticket: para TODOS (yo soy el cliente). */}
            <button onClick={() => openCreateModal('request')}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-accent text-accent text-sm font-medium rounded hover:bg-accent-light transition-colors shrink-0"
              style={mf}>
              <Plus className="w-4 h-4" /> Solicitar ticket
            </button>
            {/* Nuevo ticket: solo candidato/miembro/admin (yo soy el miembro asignado). */}
            {accessRoleOf(user) !== 'client' && (
              <button onClick={() => openCreateModal('create')}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover transition-colors shrink-0"
                style={mf}>
                <Plus className="w-4 h-4" /> Nuevo ticket
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
            <div className="min-w-0">
          <PixelDataTable
            singleLine
            columns={[
              { key: 'id', header: 'ID', render: (t: any) => <span className="tabular-nums text-digi-muted">#{t.id}</span>, width: '56px' },
              { key: 'title', header: 'Título', render: (t: any) => (
                <span className="flex items-center gap-2 min-w-0">
                  <span title={STATUS_LABEL[t.status] || t.status} className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[STATUS_VARIANT[t.status] || 'default']}`} />
                  <span className={`truncate text-[13px] font-medium ${selected?.id === t.id ? 'text-accent' : 'text-digi-text'}`} style={mf}>{t.title}</span>
                </span>
              ) },
              { key: 'client', header: 'Cliente', width: '160px', hideOnMobile: true, render: (t: any) => <span className="text-[12px] text-digi-text" style={mf}>{t.client_name || '—'}</span> },
              { key: 'final_cost', header: 'Costo', width: '100px', hideOnMobile: true, render: (t: any) => {
                const v = t.invoice_total ?? t.estimated_cost;
                return <span className="text-[12px] text-digi-text tabular-nums" style={mf}>{v != null && v !== '' ? `$${fmt2(Number(v))}` : '—'}</span>;
              } },
              { key: 'deadline', header: 'Límite', width: '110px', render: (t: any) => (
                <span className="text-[12px] text-digi-muted" style={mf}>{t.deadline ? new Date(t.deadline).toLocaleDateString('es-EC') : '—'}</span>
              ) },
            ]}
            data={tickets}
            onRowClick={(t: any) => selectTicket(t)}
            emptyTitle="Sin tickets"
            emptyDesc="No hay tickets en este estado."
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3">
              <span className="text-[12px] text-digi-muted" style={mf}>Página {page} de {totalPages} · {total} tickets</span>
              <div className="flex gap-1.5">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-digi-border rounded text-[12px] text-digi-text hover:border-accent hover:text-accent disabled:opacity-40 disabled:pointer-events-none transition-colors" style={mf}>
                  <ChevronLeft className="w-3.5 h-3.5" /> Anterior
                </button>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-digi-border rounded text-[12px] text-digi-text hover:border-accent hover:text-accent disabled:opacity-40 disabled:pointer-events-none transition-colors" style={mf}>
                  Siguiente <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
            </div>

            {/* ── Detail preview panel ── */}
            <aside className="w-full xl:w-[340px]">
              {!selected ? (
                <div className="bg-digi-card border border-digi-border rounded-lg p-6 text-center lg:sticky lg:top-4">
                  <div className="w-10 h-10 rounded-lg bg-black/[0.03] flex items-center justify-center mx-auto mb-2">
                    <TicketIcon className="w-5 h-5 text-digi-muted" />
                  </div>
                  <p className="text-[12px] text-digi-muted" style={mf}>Selecciona un ticket para ver un resumen.</p>
                </div>
              ) : (
                <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm overflow-hidden lg:sticky lg:top-4">
                  <div className="flex items-start gap-3 p-4 border-b border-digi-border">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[14px] font-semibold text-digi-text leading-tight" style={mf}>{selected.title}</h3>
                      <p className="text-[11px] text-digi-muted mt-0.5" style={mf}>Ticket #{selected.id}</p>
                    </div>
                    <button onClick={() => setSelected(null)} className="text-digi-muted hover:text-digi-text shrink-0" aria-label="Cerrar"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="p-4 space-y-2.5">
                    {[
                      ['Estado', <PixelBadge key="s" variant={STATUS_VARIANT[selected.status] || 'default'}>{STATUS_LABEL[selected.status] || selected.status}</PixelBadge>],
                      ['Cliente', selected.client_name || '—'],
                      ['Costo', (() => { const v = selected.invoice_total ?? selected.estimated_cost; return v != null && v !== '' ? `$${fmt2(Number(v))}` : '—'; })()],
                      ['Límite', selected.deadline ? new Date(selected.deadline).toLocaleDateString('es-EC') : '—'],
                    ].map(([k, v]) => (
                      <div key={k as string} className="flex items-center justify-between gap-3 text-[12px]">
                        <span className="text-digi-muted" style={mf}>{k}</span>
                        <span className="text-digi-text text-right" style={mf}>{v}</span>
                      </div>
                    ))}

                    {/* Presupuesto / avance */}
                    {(() => {
                      const est = Number(selDetail?.estimated_cost) || 0;
                      const total = Number(selDetail?.actions_total) || 0;
                      if (est <= 0) return null;
                      const pct = Math.min(100, Math.round((total / est) * 100));
                      return (
                        <div className="pt-2 border-t border-digi-border">
                          <div className="flex items-center justify-between text-[11px] mb-1" style={mf}>
                            <span className="text-digi-muted">Presupuesto</span>
                            <span className="text-digi-text tabular-nums">${fmt2(total)} / ${fmt2(est)} · {pct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-digi-border/60 overflow-hidden"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} /></div>
                        </div>
                      );
                    })()}

                    {/* Días de trabajo */}
                    {selLoading ? (
                      <p className="text-[11px] text-digi-muted pt-1" style={mf}>Cargando…</p>
                    ) : (selDetail?.time_slots?.length > 0) && (
                      <div className="pt-2 border-t border-digi-border">
                        <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide mb-1.5" style={mf}>Días de trabajo</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selDetail.time_slots.map((s: any, i: number) => (
                            <span key={i} className="text-[11px] px-2 py-0.5 rounded bg-digi-darker border border-digi-border text-digi-text" style={mf}>
                              {new Date(String(s.date).split('T')[0] + 'T12:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Acciones */}
                    {selDetail?.actions?.length > 0 && (
                      <div className="pt-2 border-t border-digi-border">
                        <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide mb-1.5" style={mf}>Acciones ({selDetail.actions.length})</p>
                        <div className="space-y-1">
                          {selDetail.actions.map((a: any) => (
                            <div key={a.id} className="flex items-center gap-2 text-[12px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                              <span className="flex-1 truncate text-digi-text" style={mf}>{a.description}</span>
                              <span className="text-digi-text tabular-nums shrink-0" style={mf}>${fmt2(Number(a.cost))}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 pt-1">
                      <button onClick={() => router.push(`/dashboard/tickets/${selected.id}`)} className={`${BTN_PRIMARY} w-full`}>
                        Ver detalle <ArrowRight className="w-4 h-4" />
                      </button>
                      {selected.invoice_id && (
                        <button onClick={() => router.push(`/dashboard/invoices/${selected.invoice_id}`)} className={`${BTN_SECONDARY} w-full`}>
                          <FileText className="w-4 h-4" /> Ver factura
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>

      {/* Create Ticket Modal */}
      <PixelModal open={modal} onClose={() => setModal(false)} title={createMode === 'request' ? 'Solicitar ticket' : 'Nuevo ticket'} size="lg">
        <div className="space-y-3">
          <PixelInput label="Título *" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ej: Desarrollo de landing page" required />

          <div className="flex flex-col gap-1">
            <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Descripción</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3}
              placeholder="Describe el trabajo a realizar..."
              className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none resize-none" style={mf} />
          </div>

          {/* Servicio: solo al crear un ticket propio, no al solicitarlo. */}
          {createMode === 'create' && (
            <PixelSelect label="Servicio" value={form.service_id}
              onChange={(e) => setForm({ ...form, service_id: e.target.value })}
              options={services.map((s: any) => ({ value: String(s.id), label: `${s.name}${s.base_price ? ` ($${s.base_price})` : ''}` }))}
              placeholder="-- Seleccionar servicio --" />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Miembro asignado */}
            {createMode === 'request' ? (
              <div className="sm:col-span-2">
                <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Opciones</label>
                <div className="border border-digi-border rounded-lg p-2 space-y-1">
                  {REQUEST_OPTIONS.map((o) => {
                    const active = form.request_option === o.value;
                    return (
                      <label key={o.value} className={`flex items-start gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${active ? 'bg-accent-light' : 'hover:bg-black/[0.03]'}`} style={mf}>
                        <input type="radio" name="request_option" checked={active}
                          onChange={() => setForm({ ...form, request_option: o.value, member_id: '', required_talents: [], open_for_proposals: o.value === 'proposals' })}
                          className="mt-0.5 accent-accent" />
                        <span className="min-w-0">
                          <span className="text-[12.5px] font-medium text-digi-text">{o.label}</span>
                          <span className="block text-[10.5px] text-digi-muted">{o.hint}</span>
                        </span>
                      </label>
                    );
                  })}
                  {form.request_option === 'invite' && (
                    <div className="pt-1">
                      <AssigneePicker value={form.member_id} onChange={(id) => setForm({ ...form, member_id: id })} />
                    </div>
                  )}
                  {form.request_option === 'talent' && (
                    <div className="pt-1">
                      <MultiSelectSearch options={TALENT_OPTIONS} selected={form.required_talents}
                        onChange={(vals) => setForm({ ...form, required_talents: vals })}
                        placeholder="Talentos requeridos para la tarea…" />
                      {form.required_talents.length === 0 && <p className="text-[10.5px] text-amber-600 mt-1" style={mf}>Elige al menos un talento requerido.</p>}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Nuevo ticket: el miembro asignado SIEMPRE es el usuario de la sesión
              // (candidato/miembro/admin). Se muestra de solo lectura.
              <div>
                <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Miembro asignado</label>
                <div className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-muted rounded" style={mf}>
                  Tú — {user?.first_name || user?.email?.split('@')[0] || 'tu cuenta'}
                </div>
              </div>
            )}

            {/* Cliente */}
            {createMode === 'request' ? (
              <div>
                <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Cliente</label>
                <div className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-muted rounded" style={mf}>
                  Tú — {user?.email || 'tu cuenta cliente'}
                </div>
                <p className="text-[10.5px] text-digi-muted/80 mt-1" style={mf}>Se usará (o creará) tu cuenta de tipo cliente para esta solicitud.</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Cliente</label>
                  <button type="button" onClick={() => setForm(prev => ({
                    ...prev, client_mode: prev.client_mode === 'select' ? 'email' : 'select', client_id: '', client_email: '',
                  }))}
                    className="text-[11px] text-digi-muted hover:text-accent border border-digi-border rounded px-1.5 py-0.5 transition-colors" style={mf}>
                    {form.client_mode === 'select' ? 'Invitar por email' : 'Seleccionar'}
                  </button>
                </div>
                {form.client_mode === 'select' ? (
                  <PixelSelect value={form.client_id}
                    onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                    options={clients.map((c: any) => ({ value: String(c.id), label: c.name || c.email }))}
                    placeholder="-- Sin cliente --" />
                ) : (
                  <input type="email" value={form.client_email}
                    onChange={(e) => setForm({ ...form, client_email: e.target.value })}
                    placeholder="correo@cliente.com"
                    className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none" style={mf} />
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <PixelInput label="Fecha límite *" type="date" value={form.deadline}
              onChange={(e) => {
                const newDeadline = e.target.value;
                setForm({ ...form, deadline: newDeadline });
                if (newDeadline) setSelectedDates(prev => prev.filter(d => d <= newDeadline));
              }} required />
            <PixelInput label="Horas estimadas" type="number" value={form.estimated_hours}
              onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })} placeholder="0" />
            <PixelInput label="Costo estimado (USD)" type="number" value={form.estimated_cost}
              onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })} placeholder="0.00" />
          </div>

          {/* Time slots */}
          {(user?.role === 'member' || user?.role === 'admin') && (
            <div className="flex items-center justify-between gap-3">
              <div>
                <label className="field-label text-[10px] text-accent-glow opacity-70 block" style={df}>
                  Días de trabajo {user?.role === 'member' ? '*' : ''}
                </label>
                {!form.deadline && <p className="text-[11px] text-amber-600 mt-0.5" style={mf}>Primero elige la fecha límite</p>}
                {form.deadline && selectedDates.length > 0 && (
                  <p className="text-[11px] text-digi-muted mt-0.5" style={mf}>{selectedDates.length} día(s) seleccionados</p>
                )}
              </div>
              <button type="button"
                onClick={() => { setSelectedDates(prev => prev.filter(d => d <= form.deadline)); setSlotsModal(true); }}
                disabled={!form.deadline}
                className="text-[12px] text-digi-text border border-digi-border rounded px-3 py-1.5 hover:border-accent hover:text-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0" style={mf}>
                {selectedDates.length > 0 ? 'Editar días' : 'Seleccionar días'}
              </button>
            </div>
          )}

          <button onClick={handleCreate} disabled={creating || !form.title.trim()}
            className="pixel-btn pixel-btn-primary w-full disabled:opacity-50">
            {creating ? 'Creando...' : 'Crear ticket'}
          </button>
        </div>
      </PixelModal>

      {/* Calendar Modal */}
      <PixelModal open={slotsModal} onClose={() => setSlotsModal(false)} title="Seleccionar días de trabajo">
        {(() => {
          const { year, month } = calMonth;
          const firstDay = new Date(year, month, 1).getDay();
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const today = new Date().toISOString().split('T')[0];
          const deadline = form.deadline || '';
          const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
          const dayNames = ['Do','Lu','Ma','Mi','Ju','Vi','Sa'];

          const toggleDate = (dateStr: string) => setSelectedDates(prev =>
            prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr].sort());
          const prevMonth = () => setCalMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 });
          const nextMonth = () => setCalMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 });

          const cells: (number | null)[] = [];
          for (let i = 0; i < firstDay; i++) cells.push(null);
          for (let d = 1; d <= daysInMonth; d++) cells.push(d);

          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <button onClick={prevMonth} className="p-1.5 text-digi-muted hover:text-accent border border-digi-border rounded hover:border-accent transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                <span className="text-[13px] font-semibold text-digi-text" style={mf}>{monthNames[month]} {year}</span>
                <button onClick={nextMonth} className="p-1.5 text-digi-muted hover:text-accent border border-digi-border rounded hover:border-accent transition-colors"><ChevronRight className="w-4 h-4" /></button>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {dayNames.map(d => <div key={d} className="text-center text-[10px] text-digi-muted py-1 font-medium" style={mf}>{d}</div>)}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {cells.map((day, i) => {
                  if (day === null) return <div key={`e${i}`} />;
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isSelected = selectedDates.includes(dateStr);
                  const isOutOfRange = dateStr < today || (!!deadline && dateStr > deadline);
                  return (
                    <button key={dateStr} onClick={() => !isOutOfRange && toggleDate(dateStr)} disabled={isOutOfRange}
                      className={`py-1.5 text-[12px] text-center rounded border transition-colors ${
                        isSelected ? 'bg-accent border-accent text-white font-medium'
                          : isOutOfRange ? 'border-transparent text-digi-muted/30 cursor-default'
                            : 'border-digi-border/60 text-digi-text hover:border-accent hover:bg-accent-light'
                      }`} style={mf}>
                      {day}
                    </button>
                  );
                })}
              </div>

              {selectedDates.length > 0 && (
                <div className="border-t border-digi-border pt-2">
                  <p className="text-[11px] text-digi-muted mb-1.5" style={mf}>{selectedDates.length} día(s) seleccionados:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDates.map(d => (
                      <span key={d} className="text-[11px] px-2 py-0.5 rounded bg-accent-light border border-accent/30 text-accent flex items-center gap-1" style={mf}>
                        {new Date(d + 'T12:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                        <button onClick={() => toggleDate(d)} className="text-digi-muted hover:text-red-500">×</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={() => setSlotsModal(false)} className="pixel-btn pixel-btn-primary w-full">
                Confirmar ({selectedDates.length} días)
              </button>
            </div>
          );
        })()}
      </PixelModal>
    </div>
  );
}
