'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelModal from '@/components/ui/PixelModal';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

const ROLE_LABELS: Record<string, string> = { admin: 'Administrador', member: 'Miembro', client: 'Cliente' };
const ROLE_VARIANTS: Record<string, 'info' | 'success' | 'default'> = { admin: 'info', member: 'success', client: 'default' };
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

interface Stats { open_tickets: number; active_projects: number; users?: number; active_members?: number; clients?: number; }
interface FinanceMonth { id: number; year: number; month: number; total_income: string; total_expense: string; total_savings: string; }
interface FinanceItem { id?: number; type: 'income' | 'expense'; description: string; amount: string; }

export default function DashboardHome() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [stats, setStats] = useState<Stats | null>(null);
  const [months, setMonths] = useState<FinanceMonth[]>([]);

  // Detail modal
  const [detailMonth, setDetailMonth] = useState<FinanceMonth | null>(null);
  const [incomeItems, setIncomeItems] = useState<FinanceItem[]>([]);
  const [expenseItems, setExpenseItems] = useState<FinanceItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetch('/api/admin/stats').then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  const fetchMonths = useCallback(async () => {
    try {
      const res = await fetch('/api/finance');
      const data = await res.json();
      setMonths(data.data || []);
    } catch {}
  }, [isAdmin]);

  useEffect(() => { fetchMonths(); }, [fetchMonths]);

  // Totals across all months
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
      setIncomeItems(items.filter(i => i.type === 'income').length > 0
        ? items.filter(i => i.type === 'income')
        : [{ type: 'income', description: '', amount: '' }]);
      setExpenseItems(items.filter(i => i.type === 'expense').length > 0
        ? items.filter(i => i.type === 'expense')
        : [{ type: 'expense', description: '', amount: '' }]);
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
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: allItems }),
      });
      if (!res.ok) throw new Error();
      toast.success('Estado mensual guardado');
      setDetailMonth(null);
      fetchMonths();
    } catch { toast.error('Error al guardar'); }
    finally { setSaving(false); }
  };

  // Detail totals
  const detailIncome = incomeItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const detailExpense = expenseItems.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const detailSavings = detailIncome - detailExpense;

  const greeting = user?.first_name ? `Hola, ${user.first_name}` : 'Bienvenido';

  return (
    <div className="max-w-5xl">
      {/* Welcome */}
      <div className="flex items-center gap-3 mb-8">
        <div>
          <h1 className="pixel-heading text-xl text-white">{greeting}</h1>
          <p className="text-xs text-digi-muted mt-1" style={mf}>Panel de control de GCC World</p>
        </div>
        {user?.role && (
          <PixelBadge variant={ROLE_VARIANTS[user.role] || 'default'}>{ROLE_LABELS[user.role] || user.role}</PixelBadge>
        )}
      </div>

      {/* Stats + Finance indicators */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <StatCard label="Tickets Abiertos" value={stats?.open_tickets} />
        <StatCard label="Proyectos Activos" value={stats?.active_projects} />
        <StatCard label="Total Ingresos" value={`$${globalIncome.toFixed(2)}`} color="text-green-400" />
        <StatCard label="Total Egresos" value={`$${globalExpense.toFixed(2)}`} color="text-red-400" />
        <StatCard label="Total Ahorro" value={`$${globalSavings.toFixed(2)}`} color={globalSavings >= 0 ? 'text-accent-glow' : 'text-red-400'} />
        {isAdmin && <StatCard label="Clientes" value={stats?.clients} />}
      </div>

      {/* Finance Table - visible to all, editable by admin */}
      <>
        <div className="flex items-center justify-between mb-3">
          <h2 className="pixel-heading text-sm text-white">Estado Financiero Mensual</h2>
          {months.length > 0 && (
            <button onClick={() => window.open('/api/finance/pdf', '_blank')}
              className="px-3 py-1.5 text-[9px] text-green-400 border border-green-500/30 hover:bg-green-900/20 transition-colors" style={pf}>
              Descargar Reporte Global
            </button>
          )}
        </div>
          <PixelDataTable
            columns={[
              { key: 'period', header: 'Periodo', render: (m: any) => (
                <span className="text-white">{MONTH_NAMES[m.month - 1]} {m.year}</span>
              )},
              { key: 'income', header: 'Ingresos', render: (m: any) => (
                <span className="text-green-400" style={mf}>${Number(m.total_income || 0).toFixed(2)}</span>
              )},
              { key: 'expense', header: 'Egresos', render: (m: any) => (
                <span className="text-red-400" style={mf}>${Number(m.total_expense || 0).toFixed(2)}</span>
              )},
              { key: 'savings', header: 'Ahorro', render: (m: any) => {
                const s = Number(m.total_savings || 0);
                return <span className={s >= 0 ? 'text-accent-glow' : 'text-red-400'} style={mf}>${s.toFixed(2)}</span>;
              }},
              { key: 'pdf', header: '', width: '50px', render: (m: any) => (
                <button onClick={(e) => { e.stopPropagation(); window.open(`/api/finance/${m.id}/pdf`, '_blank'); }}
                  className="px-1.5 py-0.5 text-[7px] border border-green-700/50 text-green-400 hover:bg-green-900/20 transition-colors" style={pf}>PDF</button>
              )},
            ]}
            data={months}
            onRowClick={(m: any) => openDetail(m)}
            emptyTitle="Sin registros"
            emptyDesc="No hay estados financieros aun."
          />
      </>

      {/* Detail Modal */}
      <PixelModal open={!!detailMonth} onClose={() => !saving && setDetailMonth(null)}
        title={detailMonth ? `${MONTH_NAMES[detailMonth.month - 1]} ${detailMonth.year}` : ''} size="lg">
        {loadingDetail ? (
          <p className="text-center text-digi-muted py-8 text-xs" style={mf}>Cargando...</p>
        ) : (
          <div className="max-h-[75vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Ingresos */}
              <div className="space-y-2">
                <h4 className="text-[9px] text-green-400 border-b border-digi-border pb-1" style={pf}>Ingresos</h4>
                {incomeItems.map((item, i) => (
                  <div key={i} className="flex gap-1">
                    <input value={item.description} onChange={e => {
                      if (!isAdmin) return;
                      const n = [...incomeItems]; n[i] = { ...n[i], description: e.target.value }; setIncomeItems(n);
                    }} placeholder="Descripcion" readOnly={!isAdmin}
                      className="flex-1 px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                    <input value={item.amount} onChange={e => {
                      if (!isAdmin) return;
                      const n = [...incomeItems]; n[i] = { ...n[i], amount: e.target.value }; setIncomeItems(n);
                    }} type="number" min="0" step="0.01" placeholder="0.00" readOnly={!isAdmin}
                      className="w-24 px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none text-right" style={mf} />
                    {isAdmin && <button onClick={() => setIncomeItems(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-red-400/60 hover:text-red-400 text-[8px] px-1" style={pf}>X</button>}
                  </div>
                ))}
                {isAdmin && <button onClick={() => setIncomeItems(prev => [...prev, { type: 'income', description: '', amount: '' }])}
                  className="text-[8px] text-green-400/70 border border-green-500/30 px-2 py-0.5 hover:bg-green-900/10 transition-colors" style={pf}>+ Ingreso</button>}
                <div className="flex justify-between px-2 py-1.5 border-2 border-digi-border text-[10px]" style={mf}>
                  <span className="text-digi-muted">Total Ingresos:</span>
                  <span className="text-green-400 font-bold">${detailIncome.toFixed(2)}</span>
                </div>
              </div>

              {/* Egresos */}
              <div className="space-y-2">
                <h4 className="text-[9px] text-red-400 border-b border-digi-border pb-1" style={pf}>Egresos</h4>
                {expenseItems.map((item, i) => (
                  <div key={i} className="flex gap-1">
                    <input value={item.description} onChange={e => {
                      if (!isAdmin) return;
                      const n = [...expenseItems]; n[i] = { ...n[i], description: e.target.value }; setExpenseItems(n);
                    }} placeholder="Descripcion" readOnly={!isAdmin}
                      className="flex-1 px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                    <input value={item.amount} onChange={e => {
                      if (!isAdmin) return;
                      const n = [...expenseItems]; n[i] = { ...n[i], amount: e.target.value }; setExpenseItems(n);
                    }} type="number" min="0" step="0.01" placeholder="0.00" readOnly={!isAdmin}
                      className="w-24 px-2 py-1 bg-digi-darker border border-digi-border text-[10px] text-digi-text focus:border-accent focus:outline-none text-right" style={mf} />
                    {isAdmin && <button onClick={() => setExpenseItems(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-red-400/60 hover:text-red-400 text-[8px] px-1" style={pf}>X</button>}
                  </div>
                ))}
                {isAdmin && <button onClick={() => setExpenseItems(prev => [...prev, { type: 'expense', description: '', amount: '' }])}
                  className="text-[8px] text-red-400/70 border border-red-500/30 px-2 py-0.5 hover:bg-red-900/10 transition-colors" style={pf}>+ Egreso</button>}
                <div className="flex justify-between px-2 py-1.5 border-2 border-digi-border text-[10px]" style={mf}>
                  <span className="text-digi-muted">Total Egresos:</span>
                  <span className="text-red-400 font-bold">${detailExpense.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Savings summary */}
            <div className={`mt-4 flex justify-between px-3 py-2 border-2 text-xs ${
              detailSavings >= 0 ? 'border-accent/50 text-accent-glow' : 'border-red-500/50 text-red-400'
            }`} style={mf}>
              <span className="font-bold" style={pf}>Ahorro:</span>
              <span className="font-bold">${detailSavings.toFixed(2)}</span>
            </div>

            {/* Actions */}
            <div className="flex justify-between pt-3 mt-3 border-t border-digi-border">
              <button onClick={() => detailMonth && window.open(`/api/finance/${detailMonth.id}/pdf`, '_blank')}
                className="px-3 py-2 text-[9px] text-green-400 border border-green-500/30 hover:bg-green-900/20 transition-colors" style={pf}>
                Descargar PDF
              </button>
              <div className="flex gap-2">
              <button onClick={() => setDetailMonth(null)} className="px-4 py-2 text-[9px] border-2 border-digi-border text-digi-muted hover:text-white transition-colors" style={pf}>{isAdmin ? 'Cancelar' : 'Cerrar'}</button>
              {isAdmin && (
                <button onClick={saveDetail} disabled={saving} className="pixel-btn-primary px-4 py-2 text-[9px] disabled:opacity-50" style={pf}>
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

function StatCard({ label, value, color }: { label: string; value?: number | string; color?: string }) {
  return (
    <div className="pixel-card py-4 px-4">
      <p className="text-[8px] text-digi-muted mb-2" style={pf}>{label}</p>
      {value !== undefined ? (
        <p className={`text-lg font-bold ${color || 'text-white'}`} style={mf}>{value}</p>
      ) : (
        <div className="h-7 w-12 bg-digi-border/30 animate-pulse" />
      )}
    </div>
  );
}
