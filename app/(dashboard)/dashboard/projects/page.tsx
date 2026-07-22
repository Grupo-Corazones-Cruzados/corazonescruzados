'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import PageHeader from '@/components/ui/PageHeader';
import AssigneePicker from '@/components/tickets/AssigneePicker';
import MultiSelectSearch from '@/components/ui/MultiSelectSearch';
import { TALENTOS } from '@/lib/centralized/talentos';

const TALENT_OPTIONS = TALENTOS.map((t) => ({ value: t, label: t }));
const REQUEST_OPTIONS: { value: 'proposals' | 'talent' | 'invite'; label: string; hint: string }[] = [
  { value: 'proposals', label: 'Dejar abierto a propuestas', hint: 'Cualquier miembro propone; tú eliges a quién aceptar.' },
  { value: 'talent', label: 'Permitir que un miembro se haga responsable', hint: 'Un miembro con el talento requerido se hace responsable de inmediato; luego puede tomar requerimientos o abrir el proyecto a propuestas.' },
  { value: 'invite', label: 'Invitar a miembro responsable', hint: 'Invitas directamente a un miembro específico a liderar.' },
];
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { accessRoleOf } from '@/lib/dashboard/access';
import { fmt2 } from '@/lib/format';
import {
  FolderKanban, UserRound, Mail, FileEdit, DoorOpen, Loader, Eye, CheckCircle2,
  Search, Plus, FileText, ChevronLeft, ChevronRight, X, ArrowRight, Check, Calculator,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const STATUS_TABS = [
  { value: 'all', label: 'Todos', Icon: FolderKanban },
  { value: 'cotizacion', label: 'Cotizaciones', Icon: Calculator },
  { value: 'draft', label: 'Borrador', Icon: FileEdit },
  { value: 'open', label: 'Abiertos', Icon: DoorOpen },
  { value: 'in_progress', label: 'En progreso', Icon: Loader },
  { value: 'in_review', label: 'En revisión', Icon: Eye },
  { value: 'completed', label: 'Completados', Icon: CheckCircle2 },
];

const STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  cotizacion: 'info', draft: 'default', open: 'info', in_progress: 'warning',
  in_review: 'info', completed: 'success', closed: 'success', cancelled: 'error',
};
const STATUS_LABEL: Record<string, string> = {
  cotizacion: 'Cotización', draft: 'Borrador', open: 'Abierto', in_progress: 'En progreso',
  in_review: 'En revisión', completed: 'Completado', closed: 'Cerrado', cancelled: 'Cancelado',
};
// Punto de color por variante para mostrar el estado sin columna dedicada.
const STATUS_DOT: Record<string, string> = {
  success: 'bg-green-500', warning: 'bg-amber-500', error: 'bg-red-500', info: 'bg-accent', default: 'bg-digi-muted',
};

const PER_PAGE = 15;

export default function ProjectsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tab, setTab] = useState('all');
  const [selected, setSelected] = useState<any>(null);
  const [selDetail, setSelDetail] = useState<any>(null);
  const [selLoading, setSelLoading] = useState(false);

  const selectProject = async (p: any) => {
    setSelected(p); setSelDetail(null); setSelLoading(true);
    try {
      const res = await fetch(`/api/projects/${p.id}`);
      const data = await res.json();
      setSelDetail(data.data || null);
    } catch { setSelDetail(null); }
    finally { setSelLoading(false); }
  };
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  // Create/Request modal
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState<'create' | 'request'>('create');
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createBudgetMin, setCreateBudgetMin] = useState('');
  const [createBudgetMax, setCreateBudgetMax] = useState('');
  const [createDeadline, setCreateDeadline] = useState('');
  const [creating, setCreating] = useState(false);
  // create: selección de cliente (uno de mis clientes o invitar por email)
  const [clientMode, setClientMode] = useState<'existing' | 'email'>('existing');
  const [createClientId, setCreateClientId] = useState('');
  const [createClientEmail, setCreateClientEmail] = useState('');
  // Solicitar: casilla OBLIGATORIA para crear/usar la cuenta de cliente del solicitante.
  const [confirmClientAccount, setConfirmClientAccount] = useState(false);
  const [myClients, setMyClients] = useState<any[]>([]);
  // request: responsable sugerido o abierto a propuestas
  const [createMemberId, setCreateMemberId] = useState('');
  const [openProposals, setOpenProposals] = useState(false);
  const [requestOption, setRequestOption] = useState<'invite' | 'proposals' | 'talent'>('invite');
  const [requiredTalents, setRequiredTalents] = useState<string[]>([]);

  const canCreateOwn = accessRoleOf(user) !== 'client'; // candidato/miembro/admin

  const openCreateModal = (mode: 'create' | 'request') => {
    setCreateMode(mode);
    setCreateTitle(''); setCreateDesc(''); setCreateBudgetMin(''); setCreateBudgetMax(''); setCreateDeadline('');
    setCreateClientId(''); setCreateClientEmail(''); setClientMode('existing'); setConfirmClientAccount(false);
    setCreateMemberId(''); setOpenProposals(false); setRequestOption('invite'); setRequiredTalents([]);
    setShowCreate(true);
    if (mode === 'create') {
      fetch('/api/clients?mine=1').then((r) => r.json()).then((d) => setMyClients(d.data || [])).catch(() => setMyClients([]));
    }
  };

  // Edit modal
  const [editProject, setEditProject] = useState<any>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBudgetMin, setEditBudgetMin] = useState('');
  const [editBudgetMax, setEditBudgetMax] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [saving, setSaving] = useState(false);

  // Scope items (rail top section) depend on role.
  const scopeItems = user?.role === 'member'
    ? [{ value: 'mine', label: 'Mis proyectos', Icon: UserRound }, { value: 'invited', label: 'Invitado', Icon: Mail }]
    : user?.role === 'client'
    ? [{ value: 'mine', label: 'Mis proyectos', Icon: UserRound }]
    : [];

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: String(PER_PAGE) });
    if (tab !== 'all') params.set('status', tab);
    if (search) params.set('search', search);
    try {
      const res = await fetch(`/api/projects?${params}`);
      const data = await res.json();
      setProjects(data.data || []);
      setTotal(data.total || 0);
      setCounts(data.counts || {});
    } catch { setProjects([]); }
  }, [page, tab, search]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(1); setSelected(null); setSelDetail(null); }, [tab, search]);

  const createProject = async () => {
    if (!createTitle.trim()) return;
    // Cliente OBLIGATORIO al crear; casilla obligatoria al solicitar.
    if (createMode === 'create') {
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createClientEmail.trim());
      if (clientMode === 'existing' && !createClientId) { toast.error('Selecciona un cliente o usa un correo'); return; }
      if (clientMode === 'email' && !emailOk) { toast.error('Ingresa un correo de cliente válido'); return; }
    }
    if (createMode === 'request' && !confirmClientAccount) {
      toast.error('Marca la casilla para crear/usar tu cuenta de cliente'); return;
    }
    setCreating(true);
    try {
      const payload: any = {
        mode: createMode,
        title: createTitle, description: createDesc || null,
        budget_min: createBudgetMin ? Number(createBudgetMin) : null,
        budget_max: createBudgetMax ? Number(createBudgetMax) : null,
        deadline: createDeadline || null,
      };
      if (createMode === 'create') {
        if (clientMode === 'existing') payload.client_id = createClientId || null;
        else payload.client_email = createClientEmail || null;
      } else {
        payload.open_for_proposals = requestOption === 'proposals';
        payload.open_for_talent = requestOption === 'talent';
        payload.required_talents = requestOption === 'talent' ? requiredTalents : undefined;
        payload.member_id = requestOption === 'invite' ? (createMemberId || null) : null;
      }
      const res = await fetch('/api/projects', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { toast.error((await res.json()).error || 'Error'); return; }
      const { data } = await res.json();
      toast.success(createMode === 'request' ? 'Solicitud de proyecto creada' : 'Proyecto creado');
      setShowCreate(false);
      router.push(`/dashboard/projects/${data.id}`);
    } catch { toast.error('Error al crear'); }
    finally { setCreating(false); }
  };

  const saveEdit = async () => {
    if (!editProject || !editTitle.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/projects/${editProject.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          budget_min: editBudgetMin ? Number(editBudgetMin) : null,
          budget_max: editBudgetMax ? Number(editBudgetMax) : null,
          deadline: editDeadline || null,
        }),
      });
      toast.success('Proyecto actualizado');
      setEditProject(null);
      fetchData();
    } catch { toast.error('Error'); }
    finally { setSaving(false); }
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
      {count !== undefined && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${active ? 'bg-accent/15 text-accent' : 'bg-black/[0.05] text-digi-muted'}`}>{count}</span>
      )}
    </button>
  );

  return (
    <div>
      <PageHeader title="Proyectos" description="Proyectos, propuestas y su facturación" />

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* ── Left rail: alcance + estado ── */}
        <aside className="w-full lg:w-[220px] shrink-0 bg-digi-card border border-digi-border rounded-lg p-2">
          {scopeItems.length > 0 && (
            <>
              <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide px-2 pt-1 pb-2" style={df}>Alcance</p>
              <div className="space-y-0.5 mb-1.5">
                {scopeItems.map((s) => (
                  <RailItem key={s.value} active={tab === s.value} Icon={s.Icon} label={s.label}
                    count={counts[s.value]} onClick={() => setTab(s.value)} />
                ))}
              </div>
              <div className="h-px bg-digi-border/60 my-1 mx-2" />
            </>
          )}
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
            {/* Solicitar proyecto: para TODOS (yo soy el cliente). */}
            <button onClick={() => openCreateModal('request')} className={`${BTN_SECONDARY} shrink-0`}>
              <Plus className="w-4 h-4" /> Solicitar proyecto
            </button>
            {/* Nuevo proyecto: solo candidato/miembro/admin (yo soy el responsable). */}
            {canCreateOwn && (
              <button onClick={() => openCreateModal('create')} className={`${BTN_PRIMARY} shrink-0`}>
                <Plus className="w-4 h-4" /> Nuevo proyecto
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
            <div className="min-w-0">
          <PixelDataTable
            singleLine
            columns={[
              { key: 'id', header: 'ID', render: (p: any) => <span className="tabular-nums text-digi-muted">#{p.id}</span>, width: '56px' },
              { key: 'title', header: 'Título', render: (p: any) => (
                <span className="flex items-center gap-2 min-w-0">
                  <span title={STATUS_LABEL[p.status] || p.status} className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[STATUS_V[p.status] || 'default']}`} />
                  <span className={`truncate text-[13px] font-medium ${selected?.id === p.id ? 'text-accent' : 'text-digi-text'}`} style={mf}>{p.title}</span>
                </span>
              ) },
              { key: 'client', header: 'Cliente', width: '150px', hideOnMobile: true, render: (p: any) => <span className="text-[12px] text-digi-text" style={mf}>{p.client_name || '—'}</span> },
              { key: 'budget', header: 'Presupuesto', width: '130px', hideOnMobile: true, render: (p: any) => (
                <span className="text-[12px] text-digi-text tabular-nums" style={mf}>{p.budget_min ? `$${p.budget_min}${p.budget_max ? `–${p.budget_max}` : ''}` : '—'}</span>
              ) },
              { key: 'final_cost', header: 'Costo final', width: '110px', hideOnMobile: true, render: (p: any) => (
                <span className="text-[12px] text-digi-text tabular-nums" style={mf}>{p.final_cost ? `$${fmt2(Number(p.final_cost))}` : '—'}</span>
              ) },
              { key: 'deadline', header: 'Límite', width: '110px', render: (p: any) => (
                <span className="text-[12px] text-digi-muted" style={mf}>{p.deadline ? new Date(p.deadline).toLocaleDateString('es-EC') : '—'}</span>
              ) },
            ]}
            data={projects}
            onRowClick={(p: any) => selectProject(p)}
            emptyTitle="Sin proyectos"
            emptyDesc="No hay proyectos en este ámbito."
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3">
              <span className="text-[12px] text-digi-muted" style={mf}>Página {page} de {totalPages} · {total} proyectos</span>
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
                    <FolderKanban className="w-5 h-5 text-digi-muted" />
                  </div>
                  <p className="text-[12px] text-digi-muted" style={mf}>Selecciona un proyecto para ver un resumen.</p>
                </div>
              ) : (
                <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm overflow-hidden lg:sticky lg:top-4">
                  <div className="flex items-start gap-3 p-4 border-b border-digi-border">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[14px] font-semibold text-digi-text leading-tight" style={mf}>{selected.title}</h3>
                      <p className="text-[11px] text-digi-muted mt-0.5" style={mf}>Proyecto #{selected.id}</p>
                    </div>
                    <button onClick={() => setSelected(null)} className="text-digi-muted hover:text-digi-text shrink-0" aria-label="Cerrar"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="p-4 space-y-2.5">
                    {[
                      ['Estado', <PixelBadge key="s" variant={STATUS_V[selected.status] || 'default'}>{STATUS_LABEL[selected.status] || selected.status}</PixelBadge>],
                      ['Cliente', selected.client_name || '—'],
                      ['Presupuesto', selected.budget_min ? `$${selected.budget_min}${selected.budget_max ? `–${selected.budget_max}` : ''}` : '—'],
                      ['Costo final', selected.final_cost ? `$${fmt2(Number(selected.final_cost))}` : '—'],
                      ['Límite', selected.deadline ? new Date(selected.deadline).toLocaleDateString('es-EC') : '—'],
                    ].map(([k, v]) => (
                      <div key={k as string} className="flex items-center justify-between gap-3 text-[12px]">
                        <span className="text-digi-muted" style={mf}>{k}</span>
                        <span className="text-digi-text text-right" style={mf}>{v}</span>
                      </div>
                    ))}

                    {/* Requerimientos (compacto) */}
                    {(() => {
                      const reqs = selDetail?.requirements || [];
                      if (selLoading) return <p className="text-[11px] text-digi-muted pt-1" style={mf}>Cargando requerimientos…</p>;
                      if (reqs.length === 0) return null;
                      const done = reqs.filter((r: any) => r.is_completed).length;
                      return (
                        <div className="pt-2 border-t border-digi-border">
                          <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide mb-1.5" style={mf}>Requerimientos ({done}/{reqs.length})</p>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex-1 h-1.5 rounded-full bg-digi-border/60 overflow-hidden"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${reqs.length ? Math.round((done / reqs.length) * 100) : 0}%` }} /></div>
                            <span className="text-[11px] text-digi-muted tabular-nums" style={mf}>{reqs.length ? Math.round((done / reqs.length) * 100) : 0}%</span>
                          </div>
                          <div className="space-y-1">
                            {reqs.map((r: any) => {
                              const acc = (r.assignments || []).find((a: any) => a.status === 'accepted');
                              return (
                                <div key={r.id} className="flex items-center gap-2 text-[12px]">
                                  <span className={`w-3.5 h-3.5 rounded-[4px] shrink-0 flex items-center justify-center ${r.is_completed ? 'bg-accent text-white' : 'border border-digi-border'}`}>
                                    {r.is_completed && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                                  </span>
                                  <span className={`flex-1 truncate ${r.is_completed ? 'text-digi-muted line-through' : 'text-digi-text'}`} style={mf}>{r.title}</span>
                                  {acc && (
                                    acc.photo_url ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={acc.photo_url} alt="" title={acc.member_name} className="w-5 h-5 rounded-full border border-digi-border object-cover shrink-0" />
                                    ) : (
                                      <span title={acc.member_name} className="w-5 h-5 rounded-full border border-accent/20 bg-accent-light flex items-center justify-center text-[10px] font-semibold text-accent shrink-0" style={mf}>{(acc.member_name || '?')[0].toUpperCase()}</span>
                                    )
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    <div className="space-y-2 pt-1">
                      <button onClick={() => router.push(`/dashboard/projects/${selected.id}`)} className={`${BTN_PRIMARY} w-full`}>
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

      {/* Create/Request Modal */}
      <PixelModal open={showCreate} onClose={() => setShowCreate(false)} title={createMode === 'request' ? 'Solicitar proyecto' : 'Nuevo proyecto'}>
        <div className="space-y-3">
          <p className="text-[11.5px] text-digi-muted" style={mf}>
            {createMode === 'request'
              ? 'Solicitas un proyecto como cliente. Puedes sugerir un responsable (queda invitado a aceptar) o dejarlo abierto a propuestas.'
              : 'Creas un proyecto del que serás el responsable. Elige el cliente entre los tuyos o invítalo por email.'}
          </p>

          <PixelInput label="Título *" value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="Nombre del proyecto" />
          <div className="flex flex-col gap-1">
            <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Descripción</label>
            <textarea value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} rows={3} placeholder="Descripción del proyecto..."
              className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none resize-none" style={mf} />
          </div>

          {createMode === 'create' ? (
            /* ── Cliente (mis clientes o usar un correo) ── */
            <div className="flex flex-col gap-1.5">
              <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Cliente <span className="text-accent">*</span></label>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setClientMode('existing')}
                  className={`flex-1 px-2.5 py-1.5 rounded text-[12px] border transition-colors ${clientMode === 'existing' ? 'border-accent text-accent bg-accent-light' : 'border-digi-border text-digi-muted'}`} style={mf}>Mis clientes</button>
                <button type="button" onClick={() => setClientMode('email')}
                  className={`flex-1 px-2.5 py-1.5 rounded text-[12px] border transition-colors ${clientMode === 'email' ? 'border-accent text-accent bg-accent-light' : 'border-digi-border text-digi-muted'}`} style={mf}>Usar un correo</button>
              </div>
              {clientMode === 'existing' ? (
                <select value={createClientId} onChange={(e) => setCreateClientId(e.target.value)}
                  className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border rounded text-sm text-digi-text focus:border-accent focus:outline-none" style={mf}>
                  <option value="">-- Elige un cliente --</option>
                  {myClients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.email ? ` — ${c.email}` : ''}{c.status && c.status !== 'activo' ? ' · sin cuenta' : ''}</option>)}
                </select>
              ) : (
                <>
                  <PixelInput label="" value={createClientEmail} onChange={(e) => setCreateClientEmail(e.target.value)} placeholder="cliente@email.com" />
                  <p className="text-[10.5px] text-digi-muted" style={mf}>Si el correo no tiene cuenta, se registra y se le invita a crearla.</p>
                </>
              )}
            </div>
          ) : (
            /* ── Opciones de asignación ── */
            <div className="flex flex-col gap-1.5">
              <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Opciones</label>
              <div className="border border-digi-border rounded-lg p-2 space-y-1">
                {REQUEST_OPTIONS.map((o) => {
                  const active = requestOption === o.value;
                  return (
                    <label key={o.value} className={`flex items-start gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${active ? 'bg-accent-light' : 'hover:bg-black/[0.03]'}`} style={mf}>
                      <input type="radio" name="proj_request_option" checked={active}
                        onChange={() => { setRequestOption(o.value); setCreateMemberId(''); setRequiredTalents([]); setOpenProposals(o.value === 'proposals'); }}
                        className="mt-0.5 accent-accent" />
                      <span className="min-w-0">
                        <span className="text-[12.5px] font-medium text-digi-text">{o.label}</span>
                        <span className="block text-[10.5px] text-digi-muted">{o.hint}</span>
                      </span>
                    </label>
                  );
                })}
                {requestOption === 'invite' && (
                  <div className="pt-1"><AssigneePicker value={createMemberId} onChange={setCreateMemberId} /></div>
                )}
                {requestOption === 'talent' && (
                  <div className="pt-1">
                    <MultiSelectSearch options={TALENT_OPTIONS} selected={requiredTalents} onChange={setRequiredTalents} placeholder="Talentos requeridos para liderar…" />
                    {requiredTalents.length === 0 && <p className="text-[10.5px] text-amber-600 mt-1" style={mf}>Elige al menos un talento requerido.</p>}
                  </div>
                )}
              </div>
              <label className="flex items-start gap-2 mt-1 cursor-pointer" style={mf}>
                <input type="checkbox" checked={confirmClientAccount}
                  onChange={(e) => setConfirmClientAccount(e.target.checked)}
                  className="mt-0.5 accent-accent" />
                <span className="text-[11px] text-digi-text">Crear/usar mi cuenta de tipo cliente para esta solicitud <span className="text-accent">*</span></span>
              </label>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <PixelInput label="Presupuesto mín ($)" type="number" value={createBudgetMin} onChange={(e) => setCreateBudgetMin(e.target.value)} placeholder="0" />
            <PixelInput label="Presupuesto máx ($)" type="number" value={createBudgetMax} onChange={(e) => setCreateBudgetMax(e.target.value)} placeholder="0" />
          </div>
          <PixelInput label="Límite" type="date" value={createDeadline} onChange={(e) => setCreateDeadline(e.target.value)} />

          <button onClick={createProject} disabled={creating || !createTitle.trim()} className="pixel-btn pixel-btn-primary w-full disabled:opacity-50">
            {creating ? '...' : createMode === 'request' ? 'Solicitar proyecto' : 'Crear proyecto'}
          </button>
        </div>
      </PixelModal>

      {/* Edit Modal */}
      <PixelModal open={!!editProject} onClose={() => setEditProject(null)} title="Editar proyecto" size="sm">
        <div className="space-y-3">
          <PixelInput label="Título" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <PixelInput label="Presupuesto mín ($)" type="number" value={editBudgetMin} onChange={(e) => setEditBudgetMin(e.target.value)} placeholder="0" />
            <PixelInput label="Presupuesto máx ($)" type="number" value={editBudgetMax} onChange={(e) => setEditBudgetMax(e.target.value)} placeholder="0" />
          </div>
          <PixelInput label="Límite" type="date" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} />
          <button onClick={saveEdit} disabled={saving || !editTitle.trim()} className="pixel-btn pixel-btn-primary w-full disabled:opacity-50">
            {saving ? '...' : 'Guardar'}
          </button>
        </div>
      </PixelModal>
    </div>
  );
}
