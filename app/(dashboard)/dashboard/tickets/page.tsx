'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import PageHeader from '@/components/ui/PageHeader';
import PixelTabs from '@/components/ui/PixelTabs';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import PixelSelect from '@/components/ui/PixelSelect';

const STATUS_TABS = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'confirmed', label: 'Confirmados' },
  { value: 'completed', label: 'Completados' },
  { value: 'cancelled', label: 'Cancelados' },
];

const STATUS_VARIANT: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  pending: 'warning',
  confirmed: 'info',
  in_progress: 'info',
  completed: 'success',
  cancelled: 'error',
  withdrawn: 'default',
};

const PER_PAGE = 15;

const pf = { fontFamily: "'Silkscreen', cursive" } as const;

// Selected dates as ISO strings (YYYY-MM-DD)
type SelectedDates = string[];

const emptyForm = {
  title: '',
  description: '',
  service_id: '',
  member_id: '',
  client_id: '',
  client_email: '',
  deadline: '',
  estimated_hours: '',
  estimated_cost: '',
};

export default function TicketsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
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
    } catch { setTickets([]); }
  }, [page, tab, search]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);
  useEffect(() => { setPage(1); }, [tab, search]);

  const openCreateModal = async () => {
    // Pre-fill member_id if user is a member
    if (user?.role === 'member' && user.member_id) {
      setForm(prev => ({ ...prev, member_id: String(user.member_id) }));
    }
    setModal(true);
    // Fetch services, members, clients in parallel
    const [sRes, mRes, cRes] = await Promise.all([
      fetch('/api/services').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/members/list').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/clients').then(r => r.json()).catch(() => ({ data: [] })),
    ]);
    setServices(sRes.data || []);
    setMembers(mRes.data || []);
    const clientList = cRes.data || [];
    setClients(clientList);
    // Pre-fill client_id if user is a client (match by email)
    if (user?.role === 'client' && user.email) {
      const match = clientList.find((c: any) => c.email === user.email);
      if (match) setForm(prev => ({ ...prev, client_id: String(match.id) }));
    }
  };

  const handleCreate = async () => {
    if (!form.title.trim()) {
      toast.error('El titulo es requerido');
      return;
    }
    if (!form.deadline) {
      toast.error('La fecha limite es requerida');
      return;
    }
    // Members must include at least one work day
    if (user?.role === 'member' && selectedDates.length === 0) {
      toast.error('Debes indicar al menos un dia de trabajo');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error');
      }
      toast.success('Ticket creado exitosamente');
      setModal(false);
      setForm(emptyForm);
      setSelectedDates([]);
      fetchTickets();
    } catch (err: any) {
      toast.error(err.message || 'Error al crear ticket');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Tickets"
        description="Gestiona tus tickets de servicio"
        action={
          <button onClick={openCreateModal} className="pixel-btn pixel-btn-primary">
            + Nuevo Ticket
          </button>
        }
      />

      <div className="mb-4">
        <input
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none w-full max-w-xs"
          style={{ fontFamily: "'JetBrains Mono', monospace" }}
        />
      </div>

      <PixelTabs tabs={STATUS_TABS} active={tab} onChange={setTab} />

      <PixelDataTable
        columns={[
          { key: 'id', header: 'ID', render: (t: any) => `#${t.id}`, width: '60px' },
          { key: 'title', header: 'Titulo', render: (t: any) => t.title },
          { key: 'status', header: 'Estado', render: (t: any) => (
            <PixelBadge variant={STATUS_VARIANT[t.status] || 'default'}>{t.status}</PixelBadge>
          )},
          { key: 'client', header: 'Cliente', render: (t: any) => t.client_name || '-' },
          { key: 'member', header: 'Miembro', render: (t: any) => t.member_name || '-' },
          { key: 'deadline', header: 'Limite', render: (t: any) => t.deadline ? new Date(t.deadline).toLocaleDateString() : '-' },
        ]}
        data={tickets}
        onRowClick={(t: any) => router.push(`/dashboard/tickets/${t.id}`)}
        page={page}
        totalPages={Math.ceil(total / PER_PAGE)}
        onPageChange={setPage}
        emptyTitle="Sin tickets"
        emptyDesc="No hay tickets registrados aun."
      />

      {/* Create Ticket Modal */}
      <PixelModal open={modal} onClose={() => setModal(false)} title="Nuevo Ticket" size="lg">
        <div className="space-y-3">
          <PixelInput
            label="Titulo *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ej: Desarrollo de landing page"
            required
          />

          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-accent-glow opacity-70" style={pf}>Descripcion</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="Describe el trabajo a realizar..."
              className="w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none resize-none"
              style={{ fontFamily: "'JetBrains Mono', monospace" }}
            />
          </div>

          <PixelSelect
            label="Servicio"
            value={form.service_id}
            onChange={(e) => setForm({ ...form, service_id: e.target.value })}
            options={services.map((s: any) => ({ value: String(s.id), label: `${s.name}${s.base_price ? ` ($${s.base_price})` : ''}` }))}
            placeholder="-- Seleccionar servicio --"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PixelSelect
              label="Miembro asignado"
              value={form.member_id}
              onChange={(e) => setForm({ ...form, member_id: e.target.value })}
              options={members.map((m: any) => ({ value: String(m.id), label: m.name }))}
              placeholder="-- Sin asignar --"
              disabled={user?.role === 'member'}
            />
            <PixelSelect
              label="Cliente"
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}
              options={clients.map((c: any) => ({ value: String(c.id), label: c.name || c.email }))}
              placeholder="-- Sin cliente --"
              disabled={user?.role === 'client'}
            />
          </div>

          <PixelInput
            label="Email del cliente (notificacion)"
            type="email"
            value={form.client_email}
            onChange={(e) => setForm({ ...form, client_email: e.target.value })}
            placeholder="correo@ejemplo.com"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <PixelInput
              label="Fecha limite *"
              type="date"
              value={form.deadline}
              onChange={(e) => {
                const newDeadline = e.target.value;
                setForm({ ...form, deadline: newDeadline });
                // Remove selected dates beyond new deadline
                if (newDeadline) {
                  setSelectedDates(prev => prev.filter(d => d <= newDeadline));
                }
              }}
              required
            />
            <PixelInput
              label="Horas estimadas"
              type="number"
              value={form.estimated_hours}
              onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })}
              placeholder="0"
            />
            <PixelInput
              label="Costo estimado (USD)"
              type="number"
              value={form.estimated_cost}
              onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })}
              placeholder="0.00"
            />
          </div>

          {/* Time slots button */}
          {(user?.role === 'member' || user?.role === 'admin') && (
            <div className="flex items-center justify-between">
              <div>
                <label className="text-[10px] text-accent-glow opacity-70" style={pf}>
                  Dias de trabajo {user?.role === 'member' ? '*' : ''}
                </label>
                {!form.deadline && (
                  <p className="text-[9px] text-amber-400 mt-0.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    Primero elige la fecha limite
                  </p>
                )}
                {form.deadline && selectedDates.length > 0 && (
                  <p className="text-[9px] text-digi-muted mt-0.5" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    {selectedDates.length} dia(s) seleccionados
                  </p>
                )}
              </div>
              <button type="button"
                onClick={() => {
                  // Clear dates that are beyond the new deadline
                  setSelectedDates(prev => prev.filter(d => d <= form.deadline));
                  setSlotsModal(true);
                }}
                disabled={!form.deadline}
                className="text-[9px] text-accent-glow border border-accent/30 px-3 py-1 hover:bg-accent/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" style={pf}>
                {selectedDates.length > 0 ? 'Editar dias' : 'Seleccionar dias'}
              </button>
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={creating || !form.title.trim()}
            className="pixel-btn pixel-btn-primary w-full disabled:opacity-50"
          >
            {creating ? 'Creando...' : 'Crear Ticket'}
          </button>
        </div>
      </PixelModal>

      {/* Calendar Modal */}
      <PixelModal open={slotsModal} onClose={() => setSlotsModal(false)} title="Seleccionar Dias de Trabajo">
        {(() => {
          const { year, month } = calMonth;
          const firstDay = new Date(year, month, 1).getDay();
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const today = new Date().toISOString().split('T')[0];
          const deadline = form.deadline || '';
          const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
          const dayNames = ['Do','Lu','Ma','Mi','Ju','Vi','Sa'];

          const toggleDate = (dateStr: string) => {
            setSelectedDates(prev =>
              prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr].sort()
            );
          };

          const prevMonth = () => setCalMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 });
          const nextMonth = () => setCalMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 });

          const cells: (number | null)[] = [];
          for (let i = 0; i < firstDay; i++) cells.push(null);
          for (let d = 1; d <= daysInMonth; d++) cells.push(d);

          return (
            <div className="space-y-3">
              {/* Month nav */}
              <div className="flex items-center justify-between">
                <button onClick={prevMonth} className="px-2 py-1 text-digi-muted hover:text-accent-glow border border-digi-border hover:border-accent/30 transition-colors text-[10px]" style={pf}>&lt;</button>
                <span className="text-xs text-white" style={pf}>{monthNames[month]} {year}</span>
                <button onClick={nextMonth} className="px-2 py-1 text-digi-muted hover:text-accent-glow border border-digi-border hover:border-accent/30 transition-colors text-[10px]" style={pf}>&gt;</button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1">
                {dayNames.map(d => (
                  <div key={d} className="text-center text-[8px] text-digi-muted py-1" style={pf}>{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 gap-1">
                {cells.map((day, i) => {
                  if (day === null) return <div key={`e${i}`} />;
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isSelected = selectedDates.includes(dateStr);
                  const isOutOfRange = dateStr < today || (!!deadline && dateStr > deadline);
                  return (
                    <button
                      key={dateStr}
                      onClick={() => !isOutOfRange && toggleDate(dateStr)}
                      disabled={isOutOfRange}
                      className={`py-1.5 text-[10px] text-center border transition-colors ${
                        isSelected
                          ? 'bg-accent/30 border-accent text-white'
                          : isOutOfRange
                            ? 'border-transparent text-digi-muted/30 cursor-default'
                            : 'border-digi-border/30 text-digi-text hover:border-accent/50 hover:bg-accent/10'
                      }`}
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              {/* Selected summary */}
              {selectedDates.length > 0 && (
                <div className="border-t border-digi-border/30 pt-2">
                  <p className="text-[9px] text-digi-muted mb-1" style={pf}>{selectedDates.length} dia(s) seleccionados:</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedDates.map(d => (
                      <span key={d} className="text-[9px] px-1.5 py-0.5 bg-accent/20 border border-accent/30 text-accent-glow flex items-center gap-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {new Date(d + 'T12:00:00').toLocaleDateString('es', { day: '2-digit', month: 'short' })}
                        <button onClick={() => toggleDate(d)} className="text-red-400 hover:text-red-300 text-[8px]">x</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={() => setSlotsModal(false)} className="pixel-btn pixel-btn-primary w-full">
                Confirmar ({selectedDates.length} dias)
              </button>
            </div>
          );
        })()}
      </PixelModal>
    </div>
  );
}
