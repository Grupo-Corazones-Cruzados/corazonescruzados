'use client';

import { useEffect, useState } from 'react';
import FloatingWindow from '@/components/ui/FloatingWindow';
import PixelInput from '@/components/ui/PixelInput';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import type { PolicyTermsConfig, PolicyTermsClause } from '@/lib/centralized/comandos';
import { Plus, Trash2, Save, X, FileText } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const empty = (): PolicyTermsConfig => ({ title: '', purpose: '', conduct: '', clauses: [] });

/**
 * Modal flotante para el DETALLE de la política (términos y condiciones): propósito, modo
 * de actuación y cláusulas. Es la herramienta textual que describe el porqué y el modo de
 * actuación ante la activación de la política (luego compartible a los usuarios).
 */
export default function PolicyTermsModal({
  open, initial, onSave, onClose,
}: {
  open: boolean;
  initial: PolicyTermsConfig;
  onSave: (config: PolicyTermsConfig) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<PolicyTermsConfig>(empty());

  useEffect(() => { if (open) setForm({ title: initial.title || '', purpose: initial.purpose || '', conduct: initial.conduct || '', clauses: initial.clauses ? [...initial.clauses] : [] }); }, [open, initial]);

  const upd = <K extends keyof PolicyTermsConfig>(k: K, v: PolicyTermsConfig[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setClause = (i: number, patch: Partial<PolicyTermsClause>) => setForm((f) => ({ ...f, clauses: f.clauses.map((c, k) => (k === i ? { ...c, ...patch } : c)) }));
  const addClause = () => setForm((f) => ({ ...f, clauses: [...f.clauses, { title: '', text: '' }] }));
  const removeClause = (i: number) => setForm((f) => ({ ...f, clauses: f.clauses.filter((_, k) => k !== i) }));

  const areaCls = 'field-control w-full px-2.5 py-1.5 mt-1 bg-digi-darker border-2 border-digi-border rounded-md text-[13px] text-digi-text focus:border-accent focus:outline-none resize-none';

  return (
    <FloatingWindow open={open} onClose={onClose} title="Detalle y términos de la política" initialWidth={720} initialHeight={640}>
      <div className="space-y-4">
        <PixelInput label="TÍTULO DEL DOCUMENTO" value={form.title} onChange={(e) => upd('title', e.target.value)} placeholder="Ej. Términos de la política de contingencia" />

        <div>
          <label className="text-[12px] font-medium text-digi-muted" style={mf}>Propósito</label>
          <textarea value={form.purpose} onChange={(e) => upd('purpose', e.target.value)} rows={3} placeholder="¿Por qué existe esta política y qué busca resolver?" className={areaCls} style={mf} />
        </div>

        <div>
          <label className="text-[12px] font-medium text-digi-muted" style={mf}>Modo de actuación</label>
          <textarea value={form.conduct} onChange={(e) => upd('conduct', e.target.value)} rows={3} placeholder="¿Cómo deben actuar los usuarios ante la activación de esta política?" className={areaCls} style={mf} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-digi-muted" style={df}><FileText className="w-3.5 h-3.5" /> Cláusulas</p>
            <button type="button" onClick={addClause} className="inline-flex items-center gap-1 text-[12px] font-medium text-digi-muted border border-dashed border-digi-border rounded-md px-2 py-1 hover:border-accent hover:text-accent transition-colors" style={mf}><Plus className="w-3.5 h-3.5" /> Agregar</button>
          </div>
          {form.clauses.length === 0 ? (
            <p className="text-[12px] text-digi-muted/60" style={mf}>Sin cláusulas. Agrega términos y condiciones específicos.</p>
          ) : (
            <div className="space-y-3">
              {form.clauses.map((c, i) => (
                <div key={i} className="relative rounded-lg border border-digi-border bg-digi-darker p-3 space-y-2">
                  <button onClick={() => removeClause(i)} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-digi-card border border-digi-border flex items-center justify-center text-digi-muted hover:text-red-600 hover:border-red-300 transition-colors" title="Quitar"><Trash2 className="w-3.5 h-3.5" /></button>
                  <PixelInput label={`Cláusula ${i + 1} — título`} value={c.title} onChange={(e) => setClause(i, { title: e.target.value })} placeholder="Ej. Obligaciones del miembro" />
                  <div>
                    <label className="text-[12px] font-medium text-digi-muted" style={mf}>Contenido</label>
                    <textarea value={c.text} onChange={(e) => setClause(i, { text: e.target.value })} rows={2} placeholder="Detalle de la cláusula…" className={areaCls} style={mf} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-digi-border">
          <button type="button" onClick={onClose} className={BTN_SECONDARY}><X className="w-4 h-4" /> Cancelar</button>
          <button type="button" onClick={() => { onSave({ ...form, clauses: form.clauses.filter((c) => c.title.trim() || c.text.trim()) }); onClose(); }} className={BTN_PRIMARY}><Save className="w-4 h-4" /> Guardar detalle</button>
        </div>
      </div>
    </FloatingWindow>
  );
}
