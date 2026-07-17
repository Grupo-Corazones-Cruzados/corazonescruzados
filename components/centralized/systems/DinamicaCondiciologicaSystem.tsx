'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Atom, Plus, Trash2, Check, Wrench } from 'lucide-react';
import PixelConfirm from '@/components/ui/PixelConfirm';
import { FACTORES, causaLabel, type FactorKey } from '@/lib/centralized/condiciologia';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;
const INPUT = 'w-full px-2.5 py-1.5 bg-white border border-digi-border rounded-md text-[13px] text-digi-text placeholder-digi-muted focus:border-accent focus:outline-none';

async function mutate(url: string, method: string, body?: any) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || 'Error de servidor');
  return d;
}
const API = '/api/centralized/dinamica/variables';

type Variable = { id: number; factor: string; causa: string; nombre: string; herramienta_monitoreo: string };

export default function DinamicaCondiciologicaSystem({ isAdmin }: { system?: any; isAdmin?: boolean }) {
  const [variables, setVariables] = useState<Variable[]>([]);
  const [factorSel, setFactorSel] = useState<FactorKey>('mental');
  const [selVarId, setSelVarId] = useState<number | null>(null);
  const [nuevo, setNuevo] = useState<Record<string, string>>({});
  const [confirmDel, setConfirmDel] = useState<Variable | null>(null);

  const factor = useMemo(() => FACTORES.find((f) => f.key === factorSel)!, [factorSel]);
  const selVar = useMemo(() => variables.find((v) => v.id === selVarId) || null, [variables, selVarId]);

  const load = useCallback(async () => {
    try { const d = await fetch(API).then((r) => r.json()); setVariables(d.data || []); } catch { /* noop */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const countByFactor = (k: string) => variables.filter((v) => v.factor === k).length;

  const add = async (causa: string) => {
    const nombre = (nuevo[causa] || '').trim();
    if (!nombre) return;
    try { await mutate(API, 'POST', { factor: factorSel, causa, nombre }); setNuevo((n) => ({ ...n, [causa]: '' })); await load(); }
    catch (e: any) { toast.error(e.message); }
  };
  const del = async (v: Variable) => {
    try { await mutate(API, 'DELETE', { id: v.id }); if (selVarId === v.id) setSelVarId(null); await load(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100dvh-130px)]">
      {/* ── Panel de factores ── */}
      <aside className="w-full lg:w-[200px] shrink-0 max-h-[40vh] lg:max-h-none bg-digi-card border border-digi-border rounded-xl flex flex-col overflow-hidden">
        <div className="px-3 py-2.5 border-b border-digi-border flex items-center gap-1.5">
          <Atom className="w-4 h-4 text-accent" />
          <span className="text-[12px] font-semibold text-digi-text" style={df}>Factores</span>
        </div>
        <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
          {FACTORES.map((f) => (
            <button key={f.key} onClick={() => { setFactorSel(f.key); setSelVarId(null); }} className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors ${factorSel === f.key ? 'bg-accent-light border border-accent/30' : 'hover:bg-black/[0.03] border border-transparent'}`}>
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: f.color }} />
              <span className="text-[12.5px] font-medium text-digi-text flex-1" style={mf}>{f.label}</span>
              <span className="text-[10.5px] text-digi-muted" style={mf}>{countByFactor(f.key)}</span>
            </button>
          ))}
        </div>
        <div className="p-2.5 border-t border-digi-border">
          <p className="text-[10px] text-digi-muted leading-snug" style={mf}>Cada factor tiene causas; cada causa agrupa variables que describen las condiciones.</p>
        </div>
      </aside>

      {/* ── Variables por causa ── */}
      <div className="flex-1 min-w-0 min-h-[45vh] lg:min-h-0 bg-digi-card border border-digi-border rounded-xl flex flex-col overflow-hidden">
        <div className="px-3 py-2.5 border-b border-digi-border flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ background: factor.color }} />
          <span className="text-[13px] font-semibold text-digi-text" style={df}>Factor {factor.label}</span>
          <span className="text-[11px] text-digi-muted" style={mf}>· {factor.causas.length} causas</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {factor.causas.map((causa) => {
            const list = variables.filter((v) => v.factor === factorSel && v.causa === causa.key);
            return (
              <div key={causa.key}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[11.5px] font-semibold text-digi-text uppercase tracking-wide" style={df}>{causa.label}</span>
                  <span className="text-[10.5px] text-digi-muted" style={mf}>({list.length})</span>
                  <span className="flex-1 h-px bg-digi-border" />
                </div>
                <div className="space-y-1 mb-1.5">
                  {list.map((v) => (
                    <div key={v.id} onClick={() => setSelVarId(v.id)} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer border transition-colors ${selVarId === v.id ? 'bg-accent-light border-accent/30' : 'bg-black/[0.02] border-digi-border hover:border-accent/40'}`}>
                      <span className="text-[12px] text-digi-text flex-1 truncate" style={mf}>{v.nombre}</span>
                      {v.herramienta_monitoreo && <span className="inline-flex items-center gap-1 text-[10px] text-digi-muted" style={mf}><Wrench className="w-3 h-3" /> {v.herramienta_monitoreo.slice(0, 24)}</span>}
                    </div>
                  ))}
                  {list.length === 0 && <p className="text-[11px] text-digi-muted px-1" style={mf}>Sin variables en esta causa.</p>}
                </div>
                <div className="flex gap-1.5">
                  <input className={`${INPUT} flex-1`} value={nuevo[causa.key] || ''} onChange={(e) => setNuevo((n) => ({ ...n, [causa.key]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') add(causa.key); }} placeholder={`Nueva variable de ${causa.label.toLowerCase()}…`} />
                  <button onClick={() => add(causa.key)} className="px-2 py-1.5 border border-digi-border rounded-md text-digi-text hover:border-accent hover:text-accent"><Plus className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Editor de variable ── */}
      <aside className="w-full lg:w-[300px] shrink-0 max-h-[50vh] lg:max-h-none bg-digi-card border border-digi-border rounded-xl flex flex-col overflow-hidden">
        {selVar ? (
          <VariableEditor key={selVar.id} variable={selVar} onSaved={load} onDelete={() => setConfirmDel(selVar)} />
        ) : (
          <div className="flex-1 flex items-center justify-center p-6">
            <p className="text-[12px] text-digi-muted text-center" style={mf}>Selecciona una variable para editar su nombre y herramienta de monitoreo.</p>
          </div>
        )}
      </aside>

      <PixelConfirm
        open={!!confirmDel}
        title="Eliminar variable"
        message={confirmDel ? `¿Eliminar la variable "${confirmDel.nombre}"? Podría estar en uso en condiciones.` : ''}
        confirmLabel="Eliminar" danger
        onConfirm={() => { if (confirmDel) del(confirmDel); setConfirmDel(null); }}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}

function VariableEditor({ variable, onSaved, onDelete }: { variable: Variable; onSaved: () => void; onDelete: () => void }) {
  const [nombre, setNombre] = useState(variable.nombre);
  const [herramienta, setHerramienta] = useState(variable.herramienta_monitoreo);

  const save = async () => {
    if (!nombre.trim()) { toast.error('El nombre es requerido'); return; }
    try { await mutate(API, 'PATCH', { id: variable.id, nombre, herramienta_monitoreo: herramienta }); toast.success('Variable guardada'); await onSaved(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-digi-border flex items-center justify-between">
        <span className="text-[12px] font-semibold text-digi-text" style={df}>Variable</span>
        <span className="text-[10px] text-digi-muted" style={mf}>{causaLabel(variable.factor, variable.causa)}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div>
          <label className="block text-[11px] font-medium text-digi-text mb-1" style={mf}>Nombre</label>
          <input className={INPUT} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-digi-text mb-1" style={mf}>Herramienta de monitoreo</label>
          <textarea className={`${INPUT} resize-none`} rows={4} value={herramienta} onChange={(e) => setHerramienta(e.target.value)} placeholder="¿Con qué se monitorea/mide esta variable?" />
        </div>
        <p className="text-[10.5px] text-digi-muted italic" style={mf}>Más adelante se agregarán campos que conectarán Gestión de Datos con este sistema.</p>
      </div>
      <div className="p-3 border-t border-digi-border flex gap-2">
        <button onClick={save} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-white bg-accent hover:bg-accent/90 rounded-md" style={mf}><Check className="w-3.5 h-3.5" /> Guardar</button>
        <button onClick={onDelete} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-red-500 border border-red-200 bg-red-50 hover:bg-red-100 rounded-md" style={mf}><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}
