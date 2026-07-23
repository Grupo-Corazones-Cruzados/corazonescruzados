'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast, Toaster } from 'sonner';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import PixelSelect from '@/components/ui/PixelSelect';
import PixelBadge from '@/components/ui/PixelBadge';
import AutoGrowTextarea from '@/components/ui/AutoGrowTextarea';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { AlertTriangle, Plus, X, ImagePlus } from 'lucide-react';
import PublicHeader from '@/components/public/PublicHeader';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

type Variant = 'default' | 'info' | 'success' | 'warning' | 'error';
const SEV: Record<string, { label: string; v: Variant }> = {
  low: { label: 'Baja', v: 'default' }, medium: { label: 'Media', v: 'warning' },
  high: { label: 'Alta', v: 'error' }, critical: { label: 'Crítica', v: 'error' },
};
const ST: Record<string, { label: string; v: Variant }> = {
  pending: { label: 'Pendiente', v: 'warning' }, reviewing: { label: 'En revisión', v: 'info' },
  approved: { label: 'Aprobado', v: 'info' }, completed: { label: 'Completado', v: 'success' },
  rejected: { label: 'Rechazado', v: 'error' },
};
const SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

type Category = { id: number; name: string; subcategories: { id: number; name: string }[] };
type Incident = {
  id: number; title: string; severity: string; status: string;
  category: string | null; subcategory: string | null; reporter_name: string | null;
  created_at: string; image_count: number;
};

const fileToDataUrl = (f: File) => new Promise<string>((res, rej) => {
  const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f);
});

export default function IncidentsPortal({ token }: { token: string }) {
  const [project, setProject] = useState<{ title: string } | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/incidents-public/${token}`);
      const d = await res.json();
      if (!res.ok) { setError(d.error || 'Enlace inválido'); return; }
      setProject(d.project); setIncidents(d.incidents || []); setCategories(d.categories || []); setError(null);
    } catch { setError('Error al cargar'); }
    finally { setLoading(false); }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const openDetail = async (id: number) => {
    try {
      const res = await fetch(`/api/incidents-public/${token}/${id}`);
      const d = await res.json();
      if (res.ok) setDetail(d.data);
    } catch { /* noop */ }
  };

  return (
    <div className="corp page-dark min-h-screen">
      <Toaster position="top-center" richColors />
      <PublicHeader maxWidth="max-w-2xl" />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-9 h-9 rounded-lg bg-accent-light border border-accent/20 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-accent" /></div>
          <div>
            <h1 className="text-[18px] font-semibold text-white leading-tight" style={df}>Portal de incidentes</h1>
            {project && <p className="text-[12px] text-white/60" style={mf}>{project.title}</p>}
          </div>
        </div>

        {loading ? (
          <p className="text-[13px] text-white/60 text-center py-16" style={mf}>Cargando…</p>
        ) : error ? (
          <div className="bg-digi-card border border-digi-border rounded-xl p-8 text-center mt-6">
            <p className="text-[14px] font-semibold text-digi-text" style={mf}>Enlace no disponible</p>
            <p className="text-[12px] text-digi-muted mt-1" style={mf}>{error}</p>
          </div>
        ) : (
          <>
            <button onClick={() => setCreateOpen(true)} className={`${BTN_PRIMARY} w-full !py-3.5 !text-[15px] mt-5`}><Plus className="w-4 h-4" /> Reportar incidente</button>

            <div className="mt-5 space-y-2">
              <p className="text-[11px] font-semibold text-white/60 uppercase tracking-wide" style={df}>Incidentes ({incidents.length})</p>
              {incidents.length === 0 ? (
                <p className="text-[12px] text-white/50 text-center py-8" style={mf}>Aún no hay incidentes reportados.</p>
              ) : incidents.map((it) => (
                <button key={it.id} onClick={() => openDetail(it.id)}
                  className="w-full text-left rounded-xl border border-digi-border bg-digi-card hover:border-accent/60 transition-colors p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-digi-text truncate flex-1 min-w-0" style={mf}>{it.title}</span>
                    <PixelBadge variant={SEV[it.severity]?.v || 'default'}>{SEV[it.severity]?.label || it.severity}</PixelBadge>
                    <PixelBadge variant={ST[it.status]?.v || 'default'}>{ST[it.status]?.label || it.status}</PixelBadge>
                  </div>
                  <p className="text-[10.5px] text-digi-muted mt-1" style={mf}>
                    {[it.category, it.subcategory].filter(Boolean).join(' › ') || 'Sin categoría'}
                    {it.reporter_name ? ` · ${it.reporter_name}` : ''}
                    {` · ${new Date(it.created_at).toLocaleDateString('es-EC')}`}
                  </p>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {createOpen && (
        <CreateForm token={token} categories={categories} onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); load(); }} />
      )}
      {detail && (
        <PixelModal open onClose={() => setDetail(null)} title={detail.title} size="md">
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <PixelBadge variant={SEV[detail.severity]?.v || 'default'}>{SEV[detail.severity]?.label || detail.severity}</PixelBadge>
              <PixelBadge variant={ST[detail.status]?.v || 'default'}>{ST[detail.status]?.label || detail.status}</PixelBadge>
              {[detail.category, detail.subcategory].filter(Boolean).length > 0 && (
                <span className="text-[11px] text-digi-muted" style={mf}>{[detail.category, detail.subcategory].filter(Boolean).join(' › ')}</span>
              )}
            </div>
            <p className="text-[10.5px] text-digi-muted" style={mf}>{detail.reporter_name || 'Cliente'} · {new Date(detail.created_at).toLocaleString('es-EC')}</p>
            {detail.description && <p className="text-[13px] text-digi-text whitespace-pre-wrap" style={mf}>{detail.description}</p>}
            {Array.isArray(detail.images) && detail.images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {detail.images.map((src: string, i: number) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a key={i} href={src} target="_blank" rel="noreferrer"><img src={src} alt="" className="w-20 h-20 object-cover rounded border border-digi-border" /></a>
                ))}
              </div>
            )}
          </div>
        </PixelModal>
      )}
    </div>
  );
}

function CreateForm({ token, categories, onClose, onSaved }: {
  token: string; categories: Category[]; onClose: () => void; onSaved: () => void;
}) {
  const [reporter, setReporter] = useState('');
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const subs = categories.find((c) => c.name === category)?.subcategories || [];

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const arr = await Promise.all(Array.from(files).slice(0, 8).map(fileToDataUrl));
    setImages((prev) => [...prev, ...arr].slice(0, 8));
  };
  const submit = async () => {
    if (!title.trim()) { toast.error('El título es obligatorio'); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/incidents-public/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, severity, category: category || null, subcategory: subcategory || null, reporter_name: reporter || null, images }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error); }
      toast.success('Incidente enviado'); onSaved();
    } catch (e: any) { toast.error(e?.message || 'Error'); } finally { setBusy(false); }
  };

  return (
    <PixelModal open onClose={onClose} title="Reportar incidente" size="md" busy={busy}>
      <div className="space-y-3">
        <PixelInput label="Tu nombre (opcional)" value={reporter} onChange={(e) => setReporter(e.target.value)} placeholder="Cliente" />
        <PixelInput label="Título *" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Resumen del incidente" />
        <div>
          <label className="field-label text-[10px] text-accent-glow opacity-70">Criticidad *</label>
          <div className="grid grid-cols-4 gap-1.5 mt-1">
            {SEVERITIES.map((s) => (
              <button key={s} type="button" onClick={() => setSeverity(s)}
                className={`py-2 text-[12px] font-medium rounded border transition-colors ${severity === s ? 'bg-accent text-white border-accent' : 'border-digi-border text-digi-muted hover:border-accent'}`} style={mf}>
                {SEV[s].label}
              </button>
            ))}
          </div>
        </div>
        {categories.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            <PixelSelect label="Categoría" value={category} placeholder="Todas"
              onChange={(e) => { setCategory(e.target.value); setSubcategory(''); }}
              options={categories.map((c) => ({ value: c.name, label: c.name }))} />
            <PixelSelect label="Subcategoría" value={subcategory} placeholder="Todas" disabled={!subs.length}
              onChange={(e) => setSubcategory(e.target.value)}
              options={subs.map((s) => ({ value: s.name, label: s.name }))} />
          </div>
        )}
        <div>
          <label className="field-label text-[10px] text-accent-glow opacity-70">Descripción</label>
          <AutoGrowTextarea value={description} onChange={(e) => setDescription(e.target.value)} minRows={4}
            className="field-control w-full px-3 py-2.5 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none transition-colors mt-1"
            placeholder="Describe el incidente…" />
        </div>
        <div>
          <label className="field-label text-[10px] text-accent-glow opacity-70">Imágenes (opcional)</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {images.map((src, i) => (
              <div key={i} className="relative w-16 h-16 rounded border border-digi-border overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button onClick={() => setImages((p) => p.filter((_, j) => j !== i))} className="absolute top-0 right-0 bg-black/60 text-white p-0.5"><X className="w-3 h-3" /></button>
              </div>
            ))}
            {images.length < 8 && (
              <label className="w-16 h-16 rounded border border-dashed border-digi-border flex items-center justify-center cursor-pointer hover:border-accent text-digi-muted">
                <ImagePlus className="w-5 h-5" />
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
              </label>
            )}
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className={`${BTN_SECONDARY} flex-1`}>Cancelar</button>
          <button onClick={submit} disabled={busy} className={`${BTN_PRIMARY} flex-1 disabled:opacity-50`}>{busy ? 'Enviando…' : 'Enviar incidente'}</button>
        </div>
      </div>
    </PixelModal>
  );
}
