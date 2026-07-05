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
import {
  Inbox, Clock, CheckCircle2, CircleCheck, XCircle, Search, Plus, FileText, ChevronLeft, ChevronRight,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const STATUS_TABS = [
  { value: 'all', label: 'Todos', Icon: Inbox },
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

const PER_PAGE = 15;

type SelectedDates = string[];

const emptyForm = {
  title: '', description: '', service_id: '', member_id: '', client_id: '',
  client_email: '', client_mode: 'select' as 'select' | 'email',
  deadline: '', estimated_hours: '', estimated_cost: '',
};

export default function TicketsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Create ticket state
  const [modal, setModal] = useState(false);
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
    if (tab !== 'all') params.set('status', tab);
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
  useEffect(() => { setPage(1); }, [tab, search]);

  const openCreateModal = async () => {
    if (user?.role === 'member' && user.member_id) {
      setForm(prev => ({ ...prev, member_id: String(user.member_id) }));
    }
    setModal(true);
    const [sRes, mRes, cRes] = await Promise.all([
      fetch('/api/services').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/members/list').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/clients').then(r => r.json()).catch(() => ({ data: [] })),
    ]);
    setServices(sRes.data || []);
    setMembers(mRes.data || []);
    const clientList = cRes.data || [];
    setClients(clientList);
    if (user?.role === 'client' && user.email) {
      const match = clientList.find((c: any) => c.email === user.email);
      if (match) setForm(prev => ({ ...prev, client_id: String(match.id) }));
    }
  };

  const handleCreate = async () => {
    if (!form.title.trim()) { toast.error('El título es requerido'); return; }
    if (!form.deadline) { toast.error('La fecha límite es requerida'); return; }
    if (user?.role === 'member' && selectedDates.length === 0) {
      toast.error('Debes indicar al menos un día de trabajo'); return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description || undefined,
          service_id: form.service_id ? Number(form.service_id) : undefined,
          member_id: form.member_id ? Number(form.member_id) : undefined,
          client_id: form.client_id ? Number(form.client_id) : undefined,
          client_email: form.client_email?.trim() || undefined,
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
            {STATUS_TABS.map((s) => (
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
            <button onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover transition-colors shrink-0"
              style={mf}>
              <Plus className="w-4 h-4" /> Nuevo ticket
            </button>
          </div>

          <PixelDataTable
            columns={[
              { key: 'id', header: 'ID', render: (t: any) => <span className="tabular-nums text-digi-muted">#{t.id}</span>, width: '60px' },
              { key: 'title', header: 'Título', render: (t: any) => <span className="text-[13px] font-medium text-digi-text" style={mf}>{t.title}</span> },
              { key: 'status', header: 'Estado', width: '120px', render: (t: any) => (
                <PixelBadge variant={STATUS_VARIANT[t.status] || 'default'}>{STATUS_LABEL[t.status] || t.status}</PixelBadge>
              ) },
              { key: 'client', header: 'Cliente', render: (t: any) => <span className="text-[12px] text-digi-text" style={mf}>{t.client_name || '—'}</span> },
              { key: 'final_cost', header: 'Costo', width: '100px', render: (t: any) => {
                const v = t.invoice_total ?? t.estimated_cost;
                return <span className="text-[12px] text-digi-text tabular-nums" style={mf}>{v != null && v !== '' ? `$${Number(v).toFixed(2)}` : '—'}</span>;
              } },
              { key: 'deadline', header: 'Límite', width: '110px', render: (t: any) => (
                <span className="text-[12px] text-digi-muted" style={mf}>{t.deadline ? new Date(t.deadline).toLocaleDateString('es-EC') : '—'}</span>
              ) },
              { key: 'invoice', header: 'Factura', width: '90px', render: (t: any) => {
                if (!t.invoice_id) return <span className="text-digi-muted/50 text-[12px]">—</span>;
                return (
                  <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    <FileText className="w-3.5 h-3.5 text-green-600" />
                    {t.invoice_sri_status === 'authorized' && (
                      <button onClick={() => window.open(`/api/invoices/${t.invoice_id}/pdf`, '_blank')}
                        className="px-1.5 py-0.5 text-[10px] border border-green-500/40 rounded text-green-700 hover:bg-green-50 transition-colors" style={mf}>PDF</button>
                    )}
                  </div>
                );
              } },
            ]}
            data={tickets}
            onRowClick={(t: any) => router.push(`/dashboard/tickets/${t.id}`)}
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
      </div>

      {/* Create Ticket Modal */}
      <PixelModal open={modal} onClose={() => setModal(false)} title="Nuevo ticket" size="lg">
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

          <PixelSelect label="Servicio" value={form.service_id}
            onChange={(e) => setForm({ ...form, service_id: e.target.value })}
            options={services.map((s: any) => ({ value: String(s.id), label: `${s.name}${s.base_price ? ` ($${s.base_price})` : ''}` }))}
            placeholder="-- Seleccionar servicio --" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PixelSelect label="Miembro asignado" value={form.member_id}
              onChange={(e) => setForm({ ...form, member_id: e.target.value })}
              options={members.map((m: any) => ({ value: String(m.id), label: m.name }))}
              placeholder="-- Sin asignar --" disabled={user?.role === 'member'} />
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Cliente</label>
                {user?.role !== 'client' && (
                  <button type="button" onClick={() => setForm(prev => ({
                    ...prev, client_mode: prev.client_mode === 'select' ? 'email' : 'select', client_id: '', client_email: '',
                  }))}
                    className="text-[11px] text-digi-muted hover:text-accent border border-digi-border rounded px-1.5 py-0.5 transition-colors" style={mf}>
                    {form.client_mode === 'select' ? 'Escribir email' : 'Seleccionar'}
                  </button>
                )}
              </div>
              {form.client_mode === 'select' ? (
                <PixelSelect value={form.client_id}
                  onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                  options={clients.map((c: any) => ({ value: String(c.id), label: c.name || c.email }))}
                  placeholder="-- Sin cliente --" disabled={user?.role === 'client'} />
              ) : (
                <input type="email" value={form.client_email}
                  onChange={(e) => setForm({ ...form, client_email: e.target.value })}
                  placeholder="correo@cliente.com"
                  className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none" style={mf} />
              )}
            </div>
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
