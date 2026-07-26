'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import PixelModal from '@/components/ui/PixelModal';
import PixelConfirm from '@/components/ui/PixelConfirm';
import BrandLoader from '@/components/ui/BrandLoader';
import Button from '@/components/ui/Button';
import { DASHBOARD_MODULES, moduleLabel } from '@/lib/dashboard/modules';
import {
  Video, Plus, Trash2, Youtube, EyeOff, GripVertical, Info, ExternalLink,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

const labelCls = 'field-label text-[12px] font-semibold text-digi-text';
const inputCls =
  'field-control w-full px-3 py-2 bg-digi-darker border border-digi-border rounded text-[13px] text-digi-text placeholder:text-digi-muted/60 focus:border-accent focus:outline-none transition-colors';

interface Tutorial {
  id: number;
  module: string;
  title: string;
  description: string | null;
  url: string;
  videoId: string;
  orden: number;
  active: boolean;
}

/** Mismo reconocimiento de enlaces que el servidor, para previsualizar al escribir. */
function parseYouTubeId(input: string): string | null {
  const raw = (input || '').trim();
  if (!raw) return null;
  if (/^[\w-]{11}$/.test(raw)) return raw;
  let url: URL;
  try { url = new URL(raw.startsWith('http') ? raw : `https://${raw}`); } catch { return null; }
  const host = url.hostname.replace(/^www\./, '');
  const seg = url.pathname.split('/').filter(Boolean);
  if (host === 'youtu.be') return /^[\w-]{11}$/.test(seg[0] || '') ? seg[0] : null;
  if (!/(^|\.)youtube(-nocookie)?\.com$/.test(host)) return null;
  const v = url.searchParams.get('v');
  if (v && /^[\w-]{11}$/.test(v)) return v;
  if (['embed', 'shorts', 'live', 'v'].includes(seg[0]) && /^[\w-]{11}$/.test(seg[1] || '')) return seg[1];
  return null;
}

type FormState = {
  id: number | null;
  module: string;
  title: string;
  description: string;
  url: string;
  orden: string;
  active: boolean;
};

const emptyForm = (module: string): FormState => ({
  id: null, module, title: '', description: '', url: '', orden: '', active: true,
});

/**
 * Panel "Tutoriales" — administra los videos de YouTube que se ven desde el botón ⓘ
 * de cada módulo del sidebar. Rail de módulos · lista de videos · formulario en panel
 * derecho con overlay (estándar de formularios del dashboard).
 *
 * Los videos deben estar en YouTube como **No listados** para poder incrustarse; los
 * marcados como *Privados* no se pueden reproducir fuera de YouTube.
 */
export default function TutorialesPanel() {
  const [items, setItems] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string>(DASHBOARD_MODULES[0].href);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<{ text: string; onOk: () => void } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tutoriales?all=1');
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');
      setItems(j.data || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const byModule = useMemo(() => {
    const map: Record<string, Tutorial[]> = {};
    items.forEach((t) => { (map[t.module] ||= []).push(t); });
    return map;
  }, [items]);

  const list = byModule[selected] || [];
  const previewId = form ? parseYouTubeId(form.url) : null;

  const save = async () => {
    if (!form) return;
    if (!form.title.trim()) return toast.error('Ponle un título al tutorial.');
    if (!parseYouTubeId(form.url)) return toast.error('El enlace no parece de YouTube.');

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        module: form.module,
        title: form.title.trim(),
        description: form.description.trim() || null,
        url: form.url.trim(),
        active: form.active,
      };
      if (form.orden.trim()) body.orden = Number(form.orden);

      const res = await fetch(form.id ? `/api/tutoriales/${form.id}` : '/api/tutoriales', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');

      toast.success(form.id ? 'Tutorial actualizado.' : 'Tutorial publicado.');
      setForm(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = (t: Tutorial) => {
    setConfirm({
      text: `¿Eliminar "${t.title}"? Dejará de verse en el módulo ${moduleLabel(t.module)}.`,
      onOk: async () => {
        setConfirm(null);
        try {
          const res = await fetch(`/api/tutoriales/${t.id}`, { method: 'DELETE' });
          const j = await res.json();
          if (!res.ok) throw new Error(j.error || 'Error');
          toast.success('Tutorial eliminado.');
          setForm(null);
          load();
        } catch (e: any) { toast.error(e.message); }
      },
    });
  };

  const toggleActive = async (t: Tutorial) => {
    try {
      const res = await fetch(`/api/tutoriales/${t.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !t.active }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Error');
      setItems((prev) => prev.map((x) => (x.id === t.id ? j.data : x)));
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="grid lg:grid-cols-[240px_minmax(0,1fr)] gap-4">
      {/* ── Rail: módulos ──────────────────────────────────────────────── */}
      <aside className="bg-digi-card border border-digi-border rounded-lg overflow-hidden self-start">
        <div className="px-3 py-2.5 border-b border-digi-border flex items-center gap-2">
          <Video className="w-4 h-4 text-accent" />
          <span className="text-[12px] font-semibold text-digi-text" style={mf}>Módulos</span>
          <span className="ml-auto text-[11px] text-digi-muted" style={mf}>{items.length} videos</span>
        </div>
        <div className="max-h-[62vh] overflow-y-auto p-1.5">
          {DASHBOARD_MODULES.map((m) => {
            const active = selected === m.href;
            const n = (byModule[m.href] || []).length;
            return (
              <button
                key={m.href}
                onClick={() => { setSelected(m.href); setForm(null); }}
                className={`w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors ${
                  active ? 'bg-accent-light text-accent border-l-2 border-accent' : 'text-digi-muted hover:bg-black/[0.04] hover:text-digi-text'
                }`}
              >
                <span className="text-[12px] font-medium truncate flex-1" style={mf}>{m.label}</span>
                {n > 0 && (
                  <span className={`text-[10.5px] px-1.5 rounded-full ${active ? 'bg-accent text-white' : 'bg-digi-border text-digi-muted'}`} style={mf}>
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Centro: videos del módulo ──────────────────────────────────── */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-digi-text truncate" style={mf}>{moduleLabel(selected)}</p>
            <p className="text-[12px] text-digi-muted" style={mf}>
              Videos que verá el usuario al pulsar ⓘ junto a este módulo.
            </p>
          </div>
          <Button onClick={() => setForm(emptyForm(selected))} icon={<Plus className="w-4 h-4" />}>
            Nuevo tutorial
          </Button>
        </div>

        <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-md bg-accent-light border border-digi-border">
          <Info className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
          <p className="text-[12px] text-digi-text" style={mf}>
            En YouTube el video debe estar como <b>No listado</b> (solo accesible con el enlace).
            Los videos marcados <b>Privado</b> no se pueden incrustar en ninguna página.
          </p>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center"><BrandLoader size="md" label="Cargando tutoriales..." /></div>
        ) : !list.length ? (
          <div className="bg-digi-card border border-digi-border rounded-lg text-center py-16">
            <div className="w-11 h-11 rounded-lg bg-accent-light flex items-center justify-center mx-auto mb-3">
              <Youtube className="w-5 h-5 text-accent" />
            </div>
            <p className="text-[13px] font-semibold text-digi-text" style={mf}>Sin tutoriales</p>
            <p className="text-[12px] text-digi-muted mt-1" style={mf}>
              Añade el primer video para {moduleLabel(selected)}.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((t) => (
              <div
                key={t.id}
                onClick={() => setForm({
                  id: t.id, module: t.module, title: t.title, description: t.description || '',
                  url: t.url, orden: String(t.orden), active: t.active,
                })}
                className={`group flex items-center gap-3 rounded-lg border p-2.5 cursor-pointer transition-colors bg-digi-card hover:border-accent hover:bg-accent-light ${
                  t.active ? 'border-digi-border' : 'border-dashed border-digi-border opacity-70'
                }`}
              >
                <GripVertical className="w-4 h-4 text-digi-muted/50 shrink-0" />
                <img
                  src={`https://i.ytimg.com/vi/${t.videoId}/mqdefault.jpg`}
                  alt=""
                  className="w-24 h-[54px] object-cover rounded shrink-0 bg-digi-border"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-digi-text truncate" style={mf}>{t.title}</p>
                  {t.description && (
                    <p className="text-[11.5px] text-digi-muted truncate" style={mf}>{t.description}</p>
                  )}
                  <p className="text-[11px] text-digi-muted/80 mt-0.5" style={mf}>
                    Orden {t.orden} · {t.active ? 'Publicado' : 'Oculto'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <a
                    href={t.url} target="_blank" rel="noopener noreferrer"
                    title="Abrir en YouTube" aria-label="Abrir en YouTube"
                    className="w-8 h-8 flex items-center justify-center rounded-md text-digi-muted hover:text-accent hover:bg-accent-light transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => toggleActive(t)}
                    title={t.active ? 'Ocultar del módulo' : 'Publicar en el módulo'}
                    aria-label={t.active ? 'Ocultar del módulo' : 'Publicar en el módulo'}
                    className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors hover:bg-accent-light ${t.active ? 'text-accent' : 'text-digi-muted'}`}
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => remove(t)}
                    title="Eliminar tutorial" aria-label="Eliminar tutorial"
                    className="w-8 h-8 flex items-center justify-center rounded-md text-digi-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Panel derecho: alta / edición ──────────────────────────────── */}
      {form && (
        <PixelModal
          open
          onClose={() => !saving && setForm(null)}
          title={form.id ? 'Editar tutorial' : 'Nuevo tutorial'}
          size="md"
          busy={saving}
        >
          <div className="space-y-3.5">
            <div className="flex flex-col gap-1">
              <label className={labelCls} style={mf} htmlFor="t-module">Módulo</label>
              <select
                id="t-module"
                value={form.module}
                onChange={(e) => setForm({ ...form, module: e.target.value })}
                className={`${inputCls} field-select appearance-none cursor-pointer`}
                style={mf}
              >
                {DASHBOARD_MODULES.map((m) => <option key={m.href} value={m.href}>{m.label}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className={labelCls} style={mf} htmlFor="t-url">Enlace de YouTube</label>
              <input
                id="t-url"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=..."
                className={inputCls}
                style={mf}
              />
              <span className="text-[11px] text-digi-muted" style={mf}>
                {form.url.trim()
                  ? previewId ? `Video reconocido: ${previewId}` : 'No se reconoce el enlace de YouTube.'
                  : 'Acepta enlaces watch, youtu.be, /embed, /shorts o el ID del video.'}
              </span>
            </div>

            {previewId && (
              <div className="rounded-lg overflow-hidden border border-digi-border bg-black aspect-video">
                <iframe
                  key={previewId}
                  src={`https://www.youtube-nocookie.com/embed/${previewId}?rel=0&modestbranding=1`}
                  title="Vista previa"
                  className="w-full h-full"
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className={labelCls} style={mf} htmlFor="t-title">Título</label>
              <input
                id="t-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Cómo crear un ticket"
                className={inputCls}
                style={mf}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className={labelCls} style={mf} htmlFor="t-desc">Descripción (opcional)</label>
              <textarea
                id="t-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                placeholder="Qué se explica en el video."
                className={`${inputCls} resize-y`}
                style={mf}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className={labelCls} style={mf} htmlFor="t-orden">Orden</label>
                <input
                  id="t-orden"
                  type="number"
                  value={form.orden}
                  onChange={(e) => setForm({ ...form, orden: e.target.value })}
                  placeholder="auto"
                  className={inputCls}
                  style={mf}
                />
                <span className="text-[11px] text-digi-muted" style={mf}>Menor primero.</span>
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelCls} style={mf} htmlFor="t-active">Estado</label>
                <select
                  id="t-active"
                  value={form.active ? 'true' : 'false'}
                  onChange={(e) => setForm({ ...form, active: e.target.value === 'true' })}
                  className={`${inputCls} field-select appearance-none cursor-pointer`}
                  style={mf}
                >
                  <option value="true">Publicado</option>
                  <option value="false">Oculto</option>
                </select>
                <span className="text-[11px] text-digi-muted" style={mf}>Oculto no se ve en el ⓘ.</span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-digi-border">
              {form.id ? (
                <Button
                  variant="danger"
                  icon={<Trash2 className="w-4 h-4" />}
                  disabled={saving}
                  onClick={() => {
                    const t = items.find((x) => x.id === form.id);
                    if (t) remove(t);
                  }}
                >
                  Eliminar
                </Button>
              ) : <span />}
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setForm(null)} disabled={saving}>Cancelar</Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? 'Guardando...' : form.id ? 'Guardar' : 'Publicar'}
                </Button>
              </div>
            </div>
          </div>
        </PixelModal>
      )}

      <PixelConfirm
        open={!!confirm}
        message={confirm?.text || ''}
        confirmLabel="Eliminar"
        danger
        onConfirm={() => confirm?.onOk()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
