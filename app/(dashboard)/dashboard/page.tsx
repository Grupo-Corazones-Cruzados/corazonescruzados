'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelModal from '@/components/ui/PixelModal';
import { fmt2 } from '@/lib/format';
import {
  Ticket, FolderKanban, Users, TrendingUp, TrendingDown, PiggyBank,
  Download, Plus, X, type LucideIcon,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

interface Stats { open_tickets: number; active_projects: number; users?: number; active_members?: number; clients?: number; }
interface FinanceMonth { id: number; year: number; month: number; total_income: string; total_expense: string; total_savings: string; }
interface FinanceItem { id?: number; type: 'income' | 'expense'; description: string; amount: string; }

export default function DashboardHome() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === 'admin';
  const isClient = user?.role === 'client';
  const [stats, setStats] = useState<Stats | null>(null);
  const [months, setMonths] = useState<FinanceMonth[]>([]);

  useEffect(() => { if (isClient) router.replace('/dashboard/marketplace'); }, [isClient, router]);

  // Detail modal
  const [detailMonth, setDetailMonth] = useState<FinanceMonth | null>(null);
  const [incomeItems, setIncomeItems] = useState<FinanceItem[]>([]);
  const [expenseItems, setExpenseItems] = useState<FinanceItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => { fetch('/api/admin/stats').then(r => r.json()).then(setStats).catch(() => {}); }, []);

  const fetchMonths = useCallback(async () => {
    try {
      const res = await fetch('/api/finance');
      const data = await res.json();
      setMonths(data.data || []);
    } catch {}
  }, []);

  useEffect(() => { fetchMonths(); }, [fetchMonths]);

  const globalIncome = months.reduce((s, m) => s + Number(m.total_income || 0), 0);
  const globalExpense = months.reduce((s, m) => s + Number(m.total_expense || 0), 0);
  const globalSavings = months.reduce((s, m) => s + Number(m.total_savings || 0), 0);

  const openDetail = async (m: FinanceMonth) => {
    setDetailMonth(m);
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/finance/${m.id}`);
      const data = await res.json();
      const items: FinanceItem[] = data.data?.items || [];
      setIncomeItems(items.filter(i => i.type === 'income').length > 0 ? items.filter(i => i.type === 'income') : [{ type: 'income', description: '', amount: '' }]);
      setExpenseItems(items.filter(i => i.type === 'expense').length > 0 ? items.filter(i => i.type === 'expense') : [{ type: 'expense', description: '', amount: '' }]);
    } catch { toast.error('Error al cargar detalle'); }
    finally { setLoadingDetail(false); }
  };

  const saveDetail = async () => {
    if (!detailMonth) return;
    setSaving(true);
    try {
      const allItems = [
        ...incomeItems.filter(i => i.description.trim() || Number(i.amount)),
        ...expenseItems.filter(i => i.description.trim() || Number(i.amount)),
      ];
      const res = await fetch(`/api/finance/${detailMonth.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: allItems }),
      });
      if (!res.ok) throw new Error();
      toast.success('Estado mensual guardado');
      setDetailMonth(null); fetchMonths();
    } catch { toast.error('Error al guardar'); }
    finally { setSaving(false); }
  };

  const detailIncome = incomeItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const detailExpense = expenseItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const detailSavings = detailIncome - detailExpense;
  const priorSavings = detailMonth
    ? months.filter(m => m.year < detailMonth.year || (m.year === detailMonth.year && m.month < detailMonth.month)).reduce((s, m) => s + Number(m.total_savings || 0), 0)
    : 0;
  const cumulativeSavings = priorSavings + detailSavings;

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';
  const name = user?.first_name || user?.email?.split('@')[0] || '';

  const money = (n: number) => `$${fmt2(n)}`;

  return (
    <div>
      {/* Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-digi-text" style={mf}>{greet}{name ? `, ${name}` : ''}</h1>
        <p className="text-[13px] text-digi-muted mt-0.5" style={mf}>Este es el resumen de GCC World.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-8">
        <StatCard Icon={Ticket} label="Tickets abiertos" value={stats?.open_tickets} tone="accent" />
        <StatCard Icon={FolderKanban} label="Proyectos activos" value={stats?.active_projects} tone="accent" />
        {isAdmin && <StatCard Icon={Users} label="Clientes" value={stats?.clients} tone="accent" />}
        <StatCard Icon={TrendingUp} label="Total ingresos" value={money(globalIncome)} tone="green" />
        <StatCard Icon={TrendingDown} label="Total egresos" value={money(globalExpense)} tone="red" />
        <StatCard Icon={PiggyBank} label="Total ahorro" value={money(globalSavings)} tone={globalSavings >= 0 ? 'accent' : 'red'} />
      </div>

      {/* Finance */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold text-digi-text" style={mf}>Estado financiero mensual</h2>
        {months.length > 0 && !isClient && (
          <button onClick={() => window.open('/api/finance/pdf', '_blank')}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-digi-border rounded text-sm font-medium text-digi-text hover:border-accent hover:text-accent transition-colors" style={mf}>
            <Download className="w-4 h-4" /> Reporte global
          </button>
        )}
      </div>

      <PixelDataTable
        data={months}
        onRowClick={isClient ? undefined : (m: any) => openDetail(m)}
        emptyTitle="Sin registros"
        emptyDesc="No hay estados financieros aún."
        columns={[
          { key: 'period', header: 'Periodo', render: (m: any) => <span className="text-[13px] font-medium text-digi-text" style={mf}>{MONTH_NAMES[m.month - 1]} {m.year}</span> },
          { key: 'income', header: 'Ingresos', render: (m: any) => <span className="text-[12px] text-green-600 tabular-nums" style={mf}>{money(Number(m.total_income || 0))}</span> },
          { key: 'expense', header: 'Egresos', render: (m: any) => <span className="text-[12px] text-red-600 tabular-nums" style={mf}>{money(Number(m.total_expense || 0))}</span> },
          { key: 'savings', header: 'Ahorro', render: (m: any) => { const s = Number(m.total_savings || 0); return <span className={`text-[12px] tabular-nums font-medium ${s >= 0 ? 'text-accent' : 'text-red-600'}`} style={mf}>{money(s)}</span>; } },
          ...(!isClient ? [{ key: 'pdf', header: '', width: '60px', render: (m: any) => (
            <button onClick={(e: React.MouseEvent) => { e.stopPropagation(); window.open(`/api/finance/${m.id}/pdf`, '_blank'); }}
              className="px-1.5 py-0.5 text-[11px] border border-green-500/40 rounded text-green-700 hover:bg-green-50 transition-colors" style={mf}>PDF</button>
          ) }] : []),
        ]}
      />

      {/* Detail Modal */}
      <PixelModal open={!!detailMonth} onClose={() => !saving && setDetailMonth(null)}
        title={detailMonth ? `${MONTH_NAMES[detailMonth.month - 1]} ${detailMonth.year}` : ''} size="lg">
        {loadingDetail ? (
          <p className="text-center text-digi-muted py-8 text-[13px]" style={mf}>Cargando...</p>
        ) : (
          <div className="max-h-[75vh] overflow-y-auto pr-1 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Ingresos */}
              <div className="rounded-lg border border-digi-border overflow-hidden">
                <div className="flex items-center justify-between px-3.5 py-2.5 bg-black/[0.02] border-b border-digi-border">
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-digi-text" style={mf}><TrendingUp className="w-4 h-4 text-green-600" /> Ingresos</span>
                  <span className="text-[14px] font-semibold text-green-700 tabular-nums" style={mf}>{money(detailIncome)}</span>
                </div>
                <div className="p-3 space-y-2">
                  {incomeItems.length === 0 && !isAdmin && <p className="text-[12px] text-digi-muted text-center py-2" style={mf}>Sin ingresos registrados.</p>}
                  {incomeItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={item.description} onChange={e => { if (!isAdmin) return; const n = [...incomeItems]; n[i] = { ...n[i], description: e.target.value }; setIncomeItems(n); }}
                        placeholder="Descripción" readOnly={!isAdmin}
                        className="field-control flex-1 min-w-0 px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                      <input value={item.amount} onChange={e => { if (!isAdmin) return; const n = [...incomeItems]; n[i] = { ...n[i], amount: e.target.value }; setIncomeItems(n); }}
                        type="number" min="0" step="0.01" placeholder="0.00" readOnly={!isAdmin}
                        className="field-control w-28 shrink-0 px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none text-right" style={mf} />
                      {isAdmin && <button onClick={() => setIncomeItems(prev => prev.filter((_, idx) => idx !== i))} aria-label="Quitar" className="w-7 h-7 flex items-center justify-center rounded text-digi-muted hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"><X className="w-4 h-4" /></button>}
                    </div>
                  ))}
                  {isAdmin && (
                    <button onClick={() => setIncomeItems(prev => [...prev, { type: 'income', description: '', amount: '' }])}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2 border border-dashed border-digi-border rounded-lg text-[12px] font-medium text-digi-muted hover:border-accent hover:text-accent transition-colors" style={mf}>
                      <Plus className="w-3.5 h-3.5" /> Agregar ingreso
                    </button>
                  )}
                </div>
              </div>

              {/* Egresos */}
              <div className="rounded-lg border border-digi-border overflow-hidden">
                <div className="flex items-center justify-between px-3.5 py-2.5 bg-black/[0.02] border-b border-digi-border">
                  <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-digi-text" style={mf}><TrendingDown className="w-4 h-4 text-red-600" /> Egresos</span>
                  <span className="text-[14px] font-semibold text-red-600 tabular-nums" style={mf}>{money(detailExpense)}</span>
                </div>
                <div className="p-3 space-y-2">
                  {expenseItems.length === 0 && !isAdmin && <p className="text-[12px] text-digi-muted text-center py-2" style={mf}>Sin egresos registrados.</p>}
                  {expenseItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={item.description} onChange={e => { if (!isAdmin) return; const n = [...expenseItems]; n[i] = { ...n[i], description: e.target.value }; setExpenseItems(n); }}
                        placeholder="Descripción" readOnly={!isAdmin}
                        className="field-control flex-1 min-w-0 px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                      <input value={item.amount} onChange={e => { if (!isAdmin) return; const n = [...expenseItems]; n[i] = { ...n[i], amount: e.target.value }; setExpenseItems(n); }}
                        type="number" min="0" step="0.01" placeholder="0.00" readOnly={!isAdmin}
                        className="field-control w-28 shrink-0 px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none text-right" style={mf} />
                      {isAdmin && <button onClick={() => setExpenseItems(prev => prev.filter((_, idx) => idx !== i))} aria-label="Quitar" className="w-7 h-7 flex items-center justify-center rounded text-digi-muted hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"><X className="w-4 h-4" /></button>}
                    </div>
                  ))}
                  {isAdmin && (
                    <button onClick={() => setExpenseItems(prev => [...prev, { type: 'expense', description: '', amount: '' }])}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-2 border border-dashed border-digi-border rounded-lg text-[12px] font-medium text-digi-muted hover:border-accent hover:text-accent transition-colors" style={mf}>
                      <Plus className="w-3.5 h-3.5" /> Agregar egreso
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Resumen de ahorro */}
            <div className="rounded-lg border border-digi-border p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold text-digi-text" style={mf}>Ahorro del mes</p>
                  <p className="text-[11px] text-digi-muted" style={mf}>Ingresos − egresos de {detailMonth ? `${MONTH_NAMES[detailMonth.month - 1]} ${detailMonth.year}` : 'el mes'}</p>
                </div>
                <span className={`text-2xl font-bold tabular-nums ${detailSavings >= 0 ? 'text-accent' : 'text-red-600'}`} style={mf}>{money(detailSavings)}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-digi-darker border border-digi-border text-[12px]" style={mf}>
                  <span className="text-digi-muted">A la fecha (mes anterior)</span>
                  <span className={`font-medium tabular-nums ${priorSavings >= 0 ? 'text-digi-text' : 'text-red-600'}`}>{money(priorSavings)}</span>
                </div>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-accent-light border border-accent/30 text-[12px]" style={mf}>
                  <span className="text-accent">Ahorro global (a la fecha)</span>
                  <span className="text-accent font-semibold tabular-nums">{money(cumulativeSavings)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center pt-3 border-t border-digi-border">
              <button onClick={() => detailMonth && window.open(`/api/finance/${detailMonth.id}/pdf`, '_blank')}
                className="inline-flex items-center gap-1.5 px-3 py-2 border border-digi-border rounded text-sm font-medium text-digi-text hover:border-accent hover:text-accent transition-colors" style={mf}>
                <Download className="w-4 h-4" /> PDF
              </button>
              <div className="flex gap-2">
                <button onClick={() => setDetailMonth(null)} className="pixel-btn pixel-btn-secondary text-sm">{isAdmin ? 'Cancelar' : 'Cerrar'}</button>
                {isAdmin && (
                  <button onClick={saveDetail} disabled={saving} className="pixel-btn pixel-btn-primary text-sm disabled:opacity-50">
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </PixelModal>
    </div>
  );
}

function StatCard({ Icon, label, value, tone }: { Icon: LucideIcon; label: string; value?: number | string; tone: 'accent' | 'green' | 'red' }) {
  const chip = tone === 'green' ? 'bg-green-50 text-green-600' : tone === 'red' ? 'bg-red-50 text-red-600' : 'bg-accent-light text-accent';
  return (
    <div className="bg-digi-card border border-digi-border rounded-lg p-4 shadow-sm flex items-center gap-3">
      <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${chip}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-digi-muted truncate" style={mf}>{label}</p>
        {value !== undefined ? (
          <p className="text-xl font-semibold text-digi-text leading-tight tabular-nums" style={mf}>{value}</p>
        ) : (
          <div className="h-6 w-16 bg-digi-border/40 animate-pulse rounded mt-1" />
        )}
      </div>
    </div>
  );
}
