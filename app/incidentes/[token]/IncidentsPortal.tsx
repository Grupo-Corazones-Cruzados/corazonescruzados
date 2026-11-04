'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import PixelModal from '@/components/ui/PixelModal';
import PixelInput from '@/components/ui/PixelInput';
import PixelSelect from '@/components/ui/PixelSelect';
import PixelBadge from '@/components/ui/PixelBadge';
import AutoGrowTextarea from '@/components/ui/AutoGrowTextarea';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import Segmentado from '@/components/ui/Segmentado';
import BotonQuitar from '@/components/ui/BotonQuitar';
import MarcoPublico, { AvisoPublico, CargandoPublico } from '@/components/public/MarcoPublico';
import { AlertTriangle, Link2Off, Plus, ImagePlus } from 'lucide-react';

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
    <MarcoPublico ancho="medio">
      {/* Cabecera: icono en el degradado del tema + título; «Reportar» a la derecha (en el
          teléfono baja a todo el ancho). Mismas piezas que la pestaña de incidentes del panel. */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-white" style={{ background: 'var(--degradado-icono)' }}>
            <AlertTriangle className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h1 className="titulo-progreso text-[20px] text-digi-text leading-tight">Portal de incidentes</h1>
            {project && <p className="text-[13px] text-digi-muted truncate" title={project.title}>{project.title}</p>}
          </div>
        </div>
        {!loading && !error && (
          <button onClick={() => setCreateOpen(true)} className={`${BTN_PRIMARY} w-full sm:w-auto shrink-0`}>
            <Plus className="w-4 h-4" /> Reportar incidente
          </button>
        )}
      </div>

      <div className="mt-6">
        {loading ? (
          <CargandoPublico />
        ) : error ? (
          <AvisoPublico icon={Link2Off} titulo="Enlace no disponible">{error}</AvisoPublico>
        ) : incidents.length === 0 ? (
          <AvisoPublico icon={AlertTriangle} titulo="Aún no hay incidentes">
            Cuando reportes uno, aparecerá aquí con su estado.
          </AvisoPublico>
        ) : (
          <div className="bg-digi-card border border-digi-border rounded-xl overflow-hidden">
            <ul className="divide-y divide-digi-border">
              {incidents.map((it) => (
                <li key={it.id}>
                  <button onClick={() => openDetail(it.id)}
                    className="w-full text-left px-4 py-3 hover:bg-accent-light/50 transition-colors">
                    <div className="flex items-start sm:items-center gap-x-3 gap-y-1 flex-col sm:flex-row">
                      <span className="text-[14px] font-medium text-digi-text truncate w-full sm:flex-1 sm:min-w-0">{it.title}</span>
                      <span className="flex items-center gap-3 shrink-0">
                        <PixelBadge variant={SEV[it.severity]?.v || 'default'}>{SEV[it.severity]?.label || it.severity}</PixelBadge>
                        <PixelBadge variant={ST[it.status]?.v || 'default'}>{ST[it.status]?.label || it.status}</PixelBadge>
                      </span>
                    </div>
                    <p className="text-[12px] text-digi-muted mt-1 truncate">
                      {[it.category, it.subcategory].filter(Boolean).join(' › ') || 'Sin categoría'}
                      {it.reporter_name ? ` · ${it.reporter_name}` : ''}
                      {` · ${new Date(it.created_at).toLocaleDateString('es-EC')}`}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
            {/* El recuento va al pie de la lista, dentro de su tarjeta. */}
            <p className="px-4 py-2.5 border-t border-digi-border bg-digi-darker/40 text-[12px] text-digi-muted">
              {incidents.length} {incidents.length === 1 ? 'incidente' : 'incidentes'}
            </p>
          </div>
        )}
      </div>

      {createOpen && (
        <CreateForm token={token} categories={categories} onClose={() => setCreateOpen(false)} onSaved={() => { setCreateOpen(false); load(); }} />
      )}
      {detail && (
        <PixelModal open onClose={() => setDetail(null)} title={detail.title} size="md">
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <PixelBadge variant={SEV[detail.severity]?.v || 'default'}>{SEV[detail.severity]?.label || detail.severity}</PixelBadge>
              <PixelBadge variant={ST[detail.status]?.v || 'default'}>{ST[detail.status]?.label || detail.status}</PixelBadge>
              {[detail.category, detail.subcategory].filter(Boolean).length > 0 && (
                <span className="text-[12px] text-digi-muted">{[detail.category, detail.subcategory].filter(Boolean).join(' › ')}</span>
              )}
            </div>
            <p className="text-[12px] text-digi-muted">{detail.reporter_name || 'Cliente'} · {new Date(detail.created_at).toLocaleString('es-EC')}</p>
            {detail.description && <p className="text-[14px] text-digi-text whitespace-pre-wrap">{detail.description}</p>}
            {Array.isArray(detail.images) && detail.images.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {detail.images.map((src: string, i: number) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a key={i} href={src} target="_blank" rel="noreferrer"><img src={src} alt="" className="w-full aspect-square object-cover rounded-lg border border-digi-border" /></a>
                ))}
              </div>
            )}
          </div>
        </PixelModal>
      )}
    </MarcoPublico>
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
    <PixelModal open onClose={onClose} title="Reportar incidente" size="md" busy={busy}
      pie={<>
        <button onClick={onClose} disabled={busy} className={BTN_SECONDARY}>Cancelar</button>
        <button onClick={submit} disabled={busy} className={BTN_PRIMARY}>{busy ? 'Enviando…' : 'Enviar incidente'}</button>
      </>}>
      <div className="space-y-3">
        <PixelInput label="Tu nombre (opcional)" value={reporter} onChange={(e) => setReporter(e.target.value)} placeholder="Cliente" />
        <PixelInput label="Título *" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Resumen del incidente" />
        <div>
          <label className="field-label text-[10px] text-accent-glow opacity-70">Criticidad *</label>
          <Segmentado etiqueta="Criticidad" className="mt-1 w-full" valor={severity as typeof SEVERITIES[number]}
            onChange={setSeverity} opciones={SEVERITIES.map((v) => ({ valor: v, texto: SEV[v].label }))} />
        </div>
        {categories.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            className="field-control w-full px-3 py-2.5 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:outline-none transition-colors mt-1"
            placeholder="Describe el incidente…" />
        </div>
        <div>
          <label className="field-label text-[10px] text-accent-glow opacity-70">Imágenes (opcional)</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {images.map((src, i) => (
              <div key={i} className="relative w-16 h-16 rounded-lg border border-digi-border overflow-hidden bg-digi-darker">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="w-full h-full object-cover" />
                <BotonQuitar tamano="xs" etiqueta="Quitar imagen" onClick={() => setImages((p) => p.filter((_, j) => j !== i))}
                  className="absolute top-0.5 right-0.5 bg-digi-card/90" />
              </div>
            ))}
            {images.length < 8 && (
              <label title="Añadir imágenes" className="w-16 h-16 rounded-lg border border-dashed border-digi-border flex items-center justify-center cursor-pointer hover:border-accent text-digi-muted">
                <ImagePlus className="w-5 h-5" />
                <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
              </label>
            )}
          </div>
        </div>
      </div>
    </PixelModal>
  );
}
