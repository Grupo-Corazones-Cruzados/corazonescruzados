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

const emptyForm = {
  title: '',
  description: '',
  service_id: '',
  member_id: '',
  client_id: '',
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
    setModal(true);
    // Fetch services, members, clients in parallel
    const [sRes, mRes, cRes] = await Promise.all([
      fetch('/api/services').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/members/list').then(r => r.json()).catch(() => ({ data: [] })),
      fetch('/api/clients').then(r => r.json()).catch(() => ({ data: [] })),
    ]);
    setServices(sRes.data || []);
    setMembers(mRes.data || []);
    setClients(cRes.data || []);
  };

  const handleCreate = async () => {
    if (!form.title.trim()) {
      toast.error('El titulo es requerido');
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
          deadline: form.deadline || undefined,
          estimated_hours: form.estimated_hours ? Number(form.estimated_hours) : undefined,
          estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Error');
      }
      toast.success('Ticket creado exitosamente');
      setModal(false);
      setForm(emptyForm);
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

          {(user?.role === 'admin' || user?.role === 'member') && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PixelSelect
                label="Miembro asignado"
                value={form.member_id}
                onChange={(e) => setForm({ ...form, member_id: e.target.value })}
                options={members.map((m: any) => ({ value: String(m.id), label: m.name }))}
                placeholder="-- Sin asignar --"
              />
              <PixelSelect
                label="Cliente"
                value={form.client_id}
                onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                options={clients.map((c: any) => ({ value: String(c.id), label: c.name || c.email }))}
                placeholder="-- Sin cliente --"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <PixelInput
              label="Fecha limite"
              type="date"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
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

          <button
            onClick={handleCreate}
            disabled={creating || !form.title.trim()}
            className="pixel-btn pixel-btn-primary w-full disabled:opacity-50"
          >
            {creating ? 'Creando...' : 'Crear Ticket'}
          </button>
        </div>
      </PixelModal>
    </div>
  );
}
