'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import PixelSelect from '@/components/ui/PixelSelect';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelConfirm from '@/components/ui/PixelConfirm';
import AutoGrowTextarea from '@/components/ui/AutoGrowTextarea';
import { BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER } from '@/components/ui/Button';
import {
  AlertTriangle, Plus, Share2, Tags, X, Trash2, Copy, Link2, RefreshCw, ImagePlus,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

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
const STATUSES = ['pending', 'reviewing', 'approved', 'completed', 'rejected'] as const;

type Category = { id: number; name: string; subcategories: { id: number; name: string }[] };
type Incident = {
  id: number; title: string; severity: string; status: string;
  category: string | null; subcategory: string | null; reporter_name: string | null;
  created_at: string; updated_at: string; image_count: number;
};

const fileToDataUrl = (f: File) => new Promise<string>((res, rej) => {
  const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(f);
});

export default function IncidentsTab({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/incidents`);
      const d = await res.json();
      setIncidents(d.incidents || []);
      setCategories(d.categories || []);
      setToken(d.token || null);
    } catch { toast.error('Error al cargar incidentes'); }
    finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <h3 className="text-[13px] font-semibold text-digi-text inline-flex items-center gap-1.5 min-w-0" style={mf}>
          <AlertTriangle className="w-4 h-4 text-accent shrink-0" /> Incidentes
          {incidents.length > 0 && <span className="text-digi-muted font-normal">({incidents.length})</span>}
        </h3>
        <button onClick={() => setCreateOpen(true)} className={`${BTN_PRIMARY} ml-auto shrink-0 !py-1.5 !text-[12px]`}><Plus className="w-3.5 h-3.5" /> Nuevo</button>
      </div>
      {canManage && (
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => setCatsOpen(true)} className={`${BTN_SECONDARY} flex-1 !py-1.5 !text-[12px]`}><Tags className="w-3.5 h-3.5" /> Categorías</button>
          <button onClick={() => setShareOpen(true)} className={`${BTN_SECONDARY} flex-1 !py-1.5 !text-[12px]`}><Share2 className="w-3.5 h-3.5" /> Compartir</button>
        </div>
      )}

      {loading ? (
        <p className="text-[12px] text-digi-muted text-center py-8" style={mf}>Cargando…</p>
      ) : incidents.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-10 h-10 rounded-lg bg-accent-light border border-accent/20 flex items-center justify-center mx-auto mb-2"><AlertTriangle className="w-5 h-5 text-accent" /></div>
          <p className="text-[12.5px] text-digi-text" style={mf}>Sin incidentes</p>
          <p className="text-[11px] text-digi-muted mt-0.5" style={mf}>Crea uno o comparte el enlace con el cliente.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {incidents.map((it) => (
            <button key={it.id} onClick={() => setDetailId(it.id)}
              className="w-full text-left rounded-lg border border-digi-border bg-digi-darker/40 hover:border-accent/60 transition-colors p-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[12.5px] font-medium text-digi-text truncate flex-1 min-w-0" style={mf}>{it.title}</span>
                <PixelBadge variant={SEV[it.severity]?.v || 'default'}>{SEV[it.severity]?.label || it.severity}</PixelBadge>
                <PixelBadge variant={ST[it.status]?.v || 'default'}>{ST[it.status]?.label || it.status}</PixelBadge>
              </div>
              <p className="text-[10.5px] text-digi-muted mt-1" style={mf}>
                {[it.category, it.subcategory].filter(Boolean).join(' › ') || 'Sin categoría'}
                {it.reporter_name ? ` · ${it.reporter_name}` : ''}
                {it.image_count > 0 ? ` · ${it.image_count} img` : ''}
                {` · ${new Date(it.created_at).toLocaleDateString('es-EC')}`}
              </p>
            </button>
          ))}
        </div>
      )}

      {createOpen && (
        <IncidentCreateModal projectId={projectId} categories={categories}
          onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); load(); }} />
      )}
      {catsOpen && (
        <CategoriesModal projectId={projectId} initial={categories}
          onClose={() => setCatsOpen(false)} onSaved={(c) => { setCategories(c); setCatsOpen(false); }} />
      )}
      {shareOpen && (
        <ShareModal projectId={projectId} token={token} onToken={setToken} onClose={() => setShareOpen(false)} />
      )}
      {detailId != null && (
        <IncidentDetailModal projectId={projectId} incidentId={detailId} canManage={canManage}
          onClose={() => setDetailId(null)} onChanged={() => { setDetailId(null); load(); }} />
      )}
    </div>
  );
}

/* ─── Crear incidente (panel lateral derecho con overlay) ─── */
function IncidentCreateModal({ projectId, categories, onClose, onSaved }: {
  projectId: string; categories: Category[]; onClose: () => void; onSaved: () => void;
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
      const res = await fetch(`/api/projects/${projectId}/incidents`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, severity, category: category || null, subcategory: subcategory || null, reporter_name: reporter || null, images }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error); }
      toast.success('Incidente creado');
      onSaved();
    } catch (e: any) { toast.error(e?.message || 'Error'); }
    finally { setBusy(false); }
  };

  return (
    <PixelModal open onClose={onClose} title="Nuevo incidente" size="md" busy={busy}>
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
          <button onClick={submit} disabled={busy} className={`${BTN_PRIMARY} flex-1 disabled:opacity-50`}>{busy ? 'Guardando…' : 'Crear incidente'}</button>
        </div>
      </div>
    </PixelModal>
  );
}

/* ─── Detalle de incidente ─── */
function IncidentDetailModal({ projectId, incidentId, canManage, onClose, onChanged }: {
  projectId: string; incidentId: number; canManage: boolean; onClose: () => void; onChanged: () => void;
}) {
  const [inc, setInc] = useState<any>(null);
  const [status, setStatus] = useState('pending');
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/incidents/${incidentId}`).then((r) => r.json()).then((d) => {
      setInc(d.data); if (d.data) setStatus(d.data.status);
    }).catch(() => {});
  }, [projectId, incidentId]);

  const saveStatus = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/incidents/${incidentId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      toast.success('Estado actualizado'); onChanged();
    } catch { toast.error('No se pudo actualizar'); } finally { setBusy(false); }
  };
  const del = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/incidents/${incidentId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      toast.success('Incidente eliminado'); onChanged();
    } catch { toast.error('No se pudo eliminar'); } finally { setBusy(false); }
  };

  return (
    <PixelModal open onClose={onClose} title={inc?.title || 'Incidente'} size="md" busy={busy}>
      {!inc ? <p className="text-[12px] text-digi-muted" style={mf}>Cargando…</p> : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <PixelBadge variant={SEV[inc.severity]?.v || 'default'}>{SEV[inc.severity]?.label || inc.severity}</PixelBadge>
            <PixelBadge variant={ST[inc.status]?.v || 'default'}>{ST[inc.status]?.label || inc.status}</PixelBadge>
            {[inc.category, inc.subcategory].filter(Boolean).length > 0 && (
              <span className="text-[11px] text-digi-muted" style={mf}>{[inc.category, inc.subcategory].filter(Boolean).join(' › ')}</span>
            )}
          </div>
          <p className="text-[10.5px] text-digi-muted" style={mf}>
            {inc.reporter_name || 'Cliente'} · {new Date(inc.created_at).toLocaleString('es-EC')}
          </p>
          {inc.description && <p className="text-[13px] text-digi-text whitespace-pre-wrap" style={mf}>{inc.description}</p>}
          {Array.isArray(inc.images) && inc.images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {inc.images.map((src: string, i: number) => (
                // eslint-disable-next-line @next/next/no-img-element
                <a key={i} href={src} target="_blank" rel="noreferrer"><img src={src} alt="" className="w-20 h-20 object-cover rounded border border-digi-border" /></a>
              ))}
            </div>
          )}
          {canManage && (
            <div className="border-t border-digi-border pt-3 space-y-2">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <PixelSelect label="Estado" value={status} onChange={(e) => setStatus(e.target.value)}
                    options={STATUSES.map((s) => ({ value: s, label: ST[s].label }))} />
                </div>
                <button onClick={saveStatus} disabled={busy || status === inc.status} className={`${BTN_PRIMARY} disabled:opacity-50`}>Guardar</button>
              </div>
              <button onClick={() => setConfirmDel(true)} className={`${BTN_DANGER} w-full`}><Trash2 className="w-3.5 h-3.5" /> Eliminar incidente</button>
            </div>
          )}
          <PixelConfirm open={confirmDel} title="Eliminar incidente" message="¿Eliminar este incidente? No se puede deshacer."
            danger confirmLabel="Eliminar" onConfirm={() => { setConfirmDel(false); del(); }} onCancel={() => setConfirmDel(false)} />
        </div>
      )}
    </PixelModal>
  );
}

/* ─── Editor de categorías / subcategorías ─── */
function CategoriesModal({ projectId, initial, onClose, onSaved }: {
  projectId: string; initial: Category[]; onClose: () => void; onSaved: (c: Category[]) => void;
}) {
  type Draft = { name: string; subcategories: { name: string }[] };
  const [cats, setCats] = useState<Draft[]>(initial.map((c) => ({ name: c.name, subcategories: c.subcategories.map((s) => ({ name: s.name })) })));
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const payload = cats.map((c) => ({ name: c.name.trim(), subcategories: c.subcategories.filter((s) => s.name.trim()).map((s) => ({ name: s.name.trim() })) })).filter((c) => c.name);
      const res = await fetch(`/api/projects/${projectId}/incidents/categories`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categories: payload }),
      });
      if (!res.ok) throw new Error();
      const d = await res.json();
      toast.success('Categorías guardadas'); onSaved(d.categories || []);
    } catch { toast.error('No se pudieron guardar'); } finally { setBusy(false); }
  };

  return (
    <PixelModal open onClose={onClose} title="Categorías de incidentes" size="md" busy={busy}>
      <div className="space-y-3">
        <p className="text-[11px] text-digi-muted" style={mf}>Define las categorías y subcategorías que el cliente podrá elegir al crear un incidente.</p>
        <div className="space-y-2">
          {cats.map((c, ci) => (
            <div key={ci} className="rounded-lg border border-digi-border bg-digi-darker/40 p-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <input value={c.name} onChange={(e) => setCats((p) => p.map((x, i) => i === ci ? { ...x, name: e.target.value } : x))}
                  placeholder="Categoría" className="field-control flex-1 px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                <button onClick={() => setCats((p) => p.filter((_, i) => i !== ci))} className="text-digi-muted hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="pl-3 space-y-1.5">
                {c.subcategories.map((s, si) => (
                  <div key={si} className="flex items-center gap-2">
                    <span className="text-digi-muted text-[11px]">›</span>
                    <input value={s.name} onChange={(e) => setCats((p) => p.map((x, i) => i === ci ? { ...x, subcategories: x.subcategories.map((y, j) => j === si ? { name: e.target.value } : y) } : x))}
                      placeholder="Subcategoría" className="field-control flex-1 px-2.5 py-1 bg-digi-darker border-2 border-digi-border text-[12px] text-digi-text focus:border-accent focus:outline-none" style={mf} />
                    <button onClick={() => setCats((p) => p.map((x, i) => i === ci ? { ...x, subcategories: x.subcategories.filter((_, j) => j !== si) } : x))} className="text-digi-muted hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
                <button onClick={() => setCats((p) => p.map((x, i) => i === ci ? { ...x, subcategories: [...x.subcategories, { name: '' }] } : x))}
                  className="text-[11px] text-accent hover:underline inline-flex items-center gap-1"><Plus className="w-3 h-3" /> Subcategoría</button>
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setCats((p) => [...p, { name: '', subcategories: [] }])}
          className="w-full py-2 text-[12px] text-accent border border-dashed border-accent/40 rounded-lg hover:bg-accent/5 inline-flex items-center justify-center gap-1"><Plus className="w-3.5 h-3.5" /> Agregar categoría</button>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className={`${BTN_SECONDARY} flex-1`}>Cancelar</button>
          <button onClick={save} disabled={busy} className={`${BTN_PRIMARY} flex-1 disabled:opacity-50`}>Guardar</button>
        </div>
      </div>
    </PixelModal>
  );
}

/* ─── Compartir enlace (token) ─── */
function ShareModal({ projectId, token, onToken, onClose }: {
  projectId: string; token: string | null; onToken: (t: string | null) => void; onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const base = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  const url = token ? `${base}/incidentes/${token}` : '';

  const gen = async (regenerate = false) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/incidents/token`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ regenerate }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      onToken(d.token); toast.success(regenerate ? 'Enlace regenerado' : 'Enlace generado');
    } catch (e: any) { toast.error(e?.message || 'Error'); } finally { setBusy(false); }
  };
  const revoke = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/incidents/token`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      onToken(null); toast.success('Enlace revocado');
    } catch { toast.error('Error'); } finally { setBusy(false); }
  };
  const copy = () => { navigator.clipboard.writeText(url); toast.success('Enlace copiado'); };

  return (
    <PixelModal open onClose={onClose} title="Compartir incidentes" size="sm" busy={busy}>
      <div className="space-y-3">
        <p className="text-[12px] text-digi-muted" style={mf}>Comparte este enlace con el cliente para que reporte incidentes y vea su estado, sin necesidad de cuenta.</p>
        {!token ? (
          <button onClick={() => gen(false)} disabled={busy} className={`${BTN_PRIMARY} w-full disabled:opacity-50`}><Link2 className="w-4 h-4" /> Generar enlace</button>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <input readOnly value={url} className="field-control flex-1 px-2.5 py-2 bg-digi-darker border-2 border-digi-border text-[11px] text-digi-text focus:outline-none" style={mf} />
              <button onClick={copy} className={`${BTN_SECONDARY} !px-2.5`} title="Copiar"><Copy className="w-4 h-4" /></button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => gen(true)} disabled={busy} className={`${BTN_SECONDARY} flex-1 disabled:opacity-50`}><RefreshCw className="w-3.5 h-3.5" /> Regenerar</button>
              <button onClick={revoke} disabled={busy} className={`${BTN_DANGER} flex-1 disabled:opacity-50`}><X className="w-3.5 h-3.5" /> Revocar</button>
            </div>
          </>
        )}
      </div>
    </PixelModal>
  );
}
