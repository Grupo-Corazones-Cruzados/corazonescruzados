'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Camera, MapPin, Sparkles, Trash2, RefreshCw, Loader2, X, Check,
  Package, PawPrint, User, ExternalLink, ScanEye, Images, ImageOff, CircleDot,
} from 'lucide-react';
import PixelConfirm from '@/components/ui/PixelConfirm';
import ImageGallery from '@/components/ui/ImageGallery';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const API = '/api/centralized/percepcion/capturas';

type Captura = {
  id: number;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  direccion: string | null;
  estado: 'pendiente' | 'analizando' | 'analizado' | 'error';
  resumen: string | null;
  capturado_en: string;
  analizado_en: string | null;
  fotos_count: number;
  elementos_count: number;
  cover: string | null;
};
type Elemento = {
  id: number;
  categoria: 'objeto' | 'animal' | 'persona';
  nombre: string;
  confianza: number | null;
  resumen: string | null;
  propiedades: Record<string, string>;
  foto_indices: number[];
};
type Detalle = Captura & { error?: string | null; notas?: string | null; fotos: { id: number; url: string; orden: number }[]; elementos: Elemento[] };

const CATEGORIAS = [
  { key: 'objeto', label: 'Objetos', icon: Package, color: '#4B2D8E' },
  { key: 'animal', label: 'Animales', icon: PawPrint, color: '#B45309' },
  { key: 'persona', label: 'Personas', icon: User, color: '#BE185D' },
] as const;

const ESTADO: Record<Captura['estado'], { label: string; dot: string; variant: string }> = {
  pendiente: { label: 'Pendiente', dot: 'bg-amber-500', variant: 'warning' },
  analizando: { label: 'Analizando…', dot: 'bg-accent', variant: 'info' },
  analizado: { label: 'Analizado', dot: 'bg-green-500', variant: 'success' },
  error: { label: 'Error', dot: 'bg-red-500', variant: 'error' },
};

const FILTERS = [
  { key: 'todas', label: 'Todas', icon: Images },
  { key: 'analizado', label: 'Analizadas', icon: ScanEye },
  { key: 'proceso', label: 'En proceso', icon: Loader2 },
  { key: 'error', label: 'Con error', icon: ImageOff },
] as const;

function fmtFecha(iso: string): string {
  try { return new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}
function mapsUrl(lat: number, lng: number): string { return `https://www.google.com/maps?q=${lat},${lng}`; }

export default function PercepcionSocialSystem({ isAdmin }: { system?: any; isAdmin?: boolean }) {
  const [capturas, setCapturas] = useState<Captura[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('todas');
  const [selId, setSelId] = useState<number | null>(null);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Captura | null>(null);

  const load = useCallback(async () => {
    try { const d = await fetch(API).then((r) => r.json()); setCapturas(d.data || []); } catch { /* noop */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadDetalle = useCallback(async (id: number) => {
    setLoadingDetalle(true);
    try { const d = await fetch(`${API}/${id}`).then((r) => r.json()); setDetalle(d.data || null); }
    catch { setDetalle(null); }
    finally { setLoadingDetalle(false); }
  }, []);
  useEffect(() => { if (selId != null) loadDetalle(selId); else setDetalle(null); }, [selId, loadDetalle]);

  const counts = useMemo(() => ({
    todas: capturas.length,
    analizado: capturas.filter((c) => c.estado === 'analizado').length,
    proceso: capturas.filter((c) => c.estado === 'pendiente' || c.estado === 'analizando').length,
    error: capturas.filter((c) => c.estado === 'error').length,
  }), [capturas]);

  const visibles = useMemo(() => {
    if (filter === 'todas') return capturas;
    if (filter === 'proceso') return capturas.filter((c) => c.estado === 'pendiente' || c.estado === 'analizando');
    return capturas.filter((c) => c.estado === filter);
  }, [capturas, filter]);

  // Re-encola una captura (error/colgada) para que el worker local la vuelva a tomar.
  const requeue = useCallback(async (id: number) => {
    try {
      const res = await fetch(`${API}/${id}/analyze`, { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'No se pudo encolar');
      toast.success('Captura encolada para análisis');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      await load();
      if (selId === id) await loadDetalle(id);
    }
  }, [load, loadDetalle, selId]);

  const onSaved = useCallback(async (newId: number) => {
    await load();
    setSelId(newId); // queda 'pendiente'; el worker local la procesará (polling la refresca).
  }, [load]);

  // Polling: mientras la captura seleccionada esté pendiente/analizando, refresca hasta que el worker termine.
  const enProceso = detalle && (detalle.estado === 'pendiente' || detalle.estado === 'analizando');
  useEffect(() => {
    if (!enProceso || selId == null) return;
    const t = setInterval(() => { loadDetalle(selId); load(); }, 4000);
    return () => clearInterval(t);
  }, [enProceso, selId, loadDetalle, load]);

  const del = async (c: Captura) => {
    try {
      const res = await fetch(`${API}/${c.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('No se pudo eliminar');
      if (selId === c.id) setSelId(null);
      await load();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100dvh-130px)]">
      {/* ── Rail: acción + filtros ── */}
      <aside className="w-full lg:w-[210px] shrink-0 flex flex-col gap-3">
        <button
          onClick={() => setCaptureOpen(true)}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-accent text-white text-[13px] font-semibold hover:bg-accent/90 shadow-sm transition-colors"
          style={mf}
        >
          <Camera className="w-4 h-4" /> Nueva captura
        </button>
        <div className="bg-digi-card border border-digi-border rounded-xl overflow-hidden">
          <div className="px-3 py-2.5 border-b border-digi-border flex items-center gap-1.5">
            <ScanEye className="w-4 h-4 text-accent" />
            <span className="text-[12px] font-semibold text-digi-text" style={df}>Percepción Social</span>
          </div>
          <div className="p-1.5 space-y-0.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors ${filter === f.key ? 'bg-accent-light border border-accent/30' : 'hover:bg-black/[0.03] border border-transparent'}`}
              >
                <f.icon className={`w-4 h-4 shrink-0 ${filter === f.key ? 'text-accent' : 'text-digi-muted'}`} />
                <span className="text-[12.5px] font-medium text-digi-text flex-1" style={mf}>{f.label}</span>
                <span className="text-[10.5px] text-digi-muted" style={mf}>{counts[f.key]}</span>
              </button>
            ))}
          </div>
          <div className="p-2.5 border-t border-digi-border">
            <p className="text-[10px] text-digi-muted leading-snug" style={mf}>
              Captura tu entorno (ubicación + fotos); la IA reconoce objetos, animales y personas y sus propiedades.
            </p>
          </div>
        </div>
      </aside>

      {/* ── Galería de capturas ── */}
      <div className="flex-1 min-w-0 min-h-[45vh] lg:min-h-0 bg-digi-card border border-digi-border rounded-xl flex flex-col overflow-hidden">
        <div className="px-3 py-2.5 border-b border-digi-border flex items-center gap-2">
          <span className="text-[13px] font-semibold text-digi-text" style={df}>Capturas del entorno</span>
          <span className="text-[11px] text-digi-muted" style={mf}>· {visibles.length}</span>
          <button onClick={load} className="ml-auto text-digi-muted hover:text-accent" title="Recargar"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {visibles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-12 h-12 rounded-xl bg-accent-light border border-accent/20 flex items-center justify-center mb-3">
                <Camera className="w-6 h-6 text-accent" />
              </div>
              <p className="text-[13px] font-medium text-digi-text" style={mf}>Aún no hay capturas</p>
              <p className="text-[12px] text-digi-muted mt-1 max-w-xs" style={mf}>Usa “Nueva captura” para registrar tu entorno con la cámara y tu ubicación.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-2.5">
              {visibles.map((c) => {
                const est = ESTADO[c.estado];
                const active = selId === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelId(c.id)}
                    className={`group text-left rounded-xl border overflow-hidden transition-all ${active ? 'border-accent ring-1 ring-accent/30' : 'border-digi-border hover:border-accent/40'}`}
                  >
                    <div className="relative aspect-[4/3] bg-black/[0.04]">
                      {c.cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.cover} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-digi-muted"><ImageOff className="w-6 h-6" /></div>
                      )}
                      <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/55 text-white text-[10px]" style={mf}>
                        <Images className="w-3 h-3" /> {c.fotos_count}
                      </span>
                      <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/55 text-white text-[10px]" style={mf}>
                        <span className={`w-1.5 h-1.5 rounded-full ${est.dot}`} /> {est.label}
                      </span>
                    </div>
                    <div className="px-2.5 py-2">
                      <div className="flex items-center gap-1.5 text-[11px] text-digi-muted" style={mf}>
                        <MapPin className="w-3 h-3 shrink-0" />
                        {c.lat != null && c.lng != null ? <span className="truncate">{c.lat.toFixed(4)}, {c.lng.toFixed(4)}</span> : <span>Sin ubicación</span>}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[11px] text-digi-muted" style={mf}>{fmtFecha(c.capturado_en)}</span>
                        {c.estado === 'analizado' && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-accent font-medium" style={mf}><Sparkles className="w-3 h-3" /> {c.elementos_count}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Panel de detalle ── */}
      <aside className="w-full lg:w-[380px] shrink-0 max-h-[70vh] lg:max-h-none bg-digi-card border border-digi-border rounded-xl flex flex-col overflow-hidden">
        {selId == null ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <p className="text-[12px] text-digi-muted text-center" style={mf}>Selecciona una captura para ver sus fotos y los elementos que la IA reconoció.</p>
          </div>
        ) : loadingDetalle && !detalle ? (
          <div className="flex-1 flex items-center justify-center p-6 text-[12px] text-digi-muted" style={mf}>Cargando…</div>
        ) : detalle ? (
          <DetailPanel
            detalle={detalle}
            onRequeue={() => requeue(detalle.id)}
            onDelete={() => setConfirmDel(detalle)}
          />
        ) : null}
      </aside>

      {captureOpen && (
        <CaptureOverlay onClose={() => setCaptureOpen(false)} onSaved={onSaved} />
      )}

      <PixelConfirm
        open={!!confirmDel}
        title="Eliminar captura"
        message={confirmDel ? '¿Eliminar esta captura y todos sus elementos reconocidos? Esta acción no se puede deshacer.' : ''}
        confirmLabel="Eliminar" danger
        onConfirm={() => { if (confirmDel) del(confirmDel); setConfirmDel(null); }}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}

/* ─────────────────────────── Panel de detalle ─────────────────────────── */
function DetailPanel({ detalle, onRequeue, onDelete }: { detalle: Detalle; onRequeue: () => void; onDelete: () => void }) {
  const est = ESTADO[detalle.estado];
  const fotos = detalle.fotos.map((f) => f.url);
  const porCategoria = (cat: string) => detalle.elementos.filter((e) => e.categoria === cat);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-digi-border flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${est.dot}`} />
        <span className="text-[12px] font-semibold text-digi-text" style={df}>Captura #{detalle.id}</span>
        <span className="text-[10.5px] text-digi-muted" style={mf}>{fmtFecha(detalle.capturado_en)}</span>
        <button onClick={onDelete} className="ml-auto text-red-500 hover:text-red-600" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Ubicación */}
        <div className="flex items-center gap-2 text-[12px] text-digi-text" style={mf}>
          <MapPin className="w-3.5 h-3.5 text-accent shrink-0" />
          {detalle.lat != null && detalle.lng != null ? (
            <>
              <span>{detalle.lat.toFixed(5)}, {detalle.lng.toFixed(5)}</span>
              {detalle.accuracy != null && <span className="text-[10.5px] text-digi-muted">±{Math.round(detalle.accuracy)}m</span>}
              <a href={mapsUrl(detalle.lat, detalle.lng)} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-[11px] text-accent hover:underline">
                Ver en Maps <ExternalLink className="w-3 h-3" />
              </a>
            </>
          ) : <span className="text-digi-muted">Sin ubicación registrada</span>}
        </div>

        {/* Fotos */}
        <div className="rounded-lg overflow-hidden border border-digi-border bg-black/[0.03]">
          <ImageGallery images={fotos} alt={`Captura ${detalle.id}`} />
        </div>

        {/* Estado del análisis */}
        {detalle.estado === 'analizando' ? (
          <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-accent-light border border-accent/20 text-[12px] text-accent" style={mf}>
            <Loader2 className="w-4 h-4 animate-spin" /> Analizando el entorno con IA…
          </div>
        ) : detalle.estado === 'pendiente' ? (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[12px] text-amber-700" style={mf}>
            <Loader2 className="w-4 h-4 mt-0.5 shrink-0" />
            <span>En cola para análisis. Se procesará cuando el <b>procesador local</b> (worker con Claude CLI) esté activo.</span>
          </div>
        ) : detalle.estado === 'error' ? (
          <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-600" style={mf}>
            <p className="font-medium mb-1">No se pudo analizar</p>
            {detalle.error && <p className="text-[11px] mb-2">{detalle.error}</p>}
            <button onClick={onRequeue} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white border border-red-200 text-red-600 hover:bg-red-100 text-[11px] font-medium">
              <RefreshCw className="w-3.5 h-3.5" /> Reintentar análisis
            </button>
          </div>
        ) : null}

        {/* Resumen del entorno */}
        {detalle.estado === 'analizado' && detalle.resumen && (
          <div className="px-3 py-2.5 rounded-lg bg-black/[0.02] border border-digi-border">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-digi-muted mb-1" style={df}>Resumen del entorno</p>
            <p className="text-[12px] text-digi-text leading-relaxed" style={mf}>{detalle.resumen}</p>
          </div>
        )}

        {/* Elementos por categoría */}
        {detalle.estado === 'analizado' && (
          detalle.elementos.length === 0 ? (
            <p className="text-[12px] text-digi-muted text-center py-4" style={mf}>La IA no reconoció elementos en estas fotos.</p>
          ) : (
            <div className="space-y-3">
              {CATEGORIAS.map((cat) => {
                const list = porCategoria(cat.key);
                if (!list.length) return null;
                return (
                  <div key={cat.key}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <cat.icon className="w-3.5 h-3.5" style={{ color: cat.color }} />
                      <span className="text-[11.5px] font-semibold text-digi-text" style={df}>{cat.label}</span>
                      <span className="text-[10.5px] text-digi-muted" style={mf}>({list.length})</span>
                      <span className="flex-1 h-px bg-digi-border" />
                    </div>
                    <div className="space-y-1.5">
                      {list.map((el) => <ElementCard key={el.id} el={el} color={cat.color} />)}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}

        {detalle.notas && (
          <p className="text-[11px] text-digi-muted italic" style={mf}>Notas: {detalle.notas}</p>
        )}
      </div>
    </div>
  );
}

function ElementCard({ el, color }: { el: Elemento; color: string }) {
  const props = Object.entries(el.propiedades || {});
  return (
    <div className="rounded-lg border border-digi-border bg-white/60 px-2.5 py-2">
      <div className="flex items-center gap-2">
        <span className="text-[12.5px] font-semibold text-digi-text flex-1" style={mf}>{el.nombre}</span>
        {el.confianza != null && (
          <span className="inline-flex items-center gap-1 text-[10px] text-digi-muted" style={mf} title="Confianza de la IA">
            <CircleDot className="w-3 h-3" style={{ color }} /> {el.confianza}%
          </span>
        )}
      </div>
      {el.resumen && <p className="text-[11px] text-digi-muted mt-0.5 leading-snug" style={mf}>{el.resumen}</p>}
      {props.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {props.map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent-light/60 border border-accent/15 text-[10px]" style={mf}>
              <span className="text-digi-muted">{k}:</span>
              <span className="text-digi-text font-medium">{v}</span>
            </span>
          ))}
        </div>
      )}
      {el.foto_indices?.length > 0 && (
        <p className="text-[9.5px] text-digi-muted mt-1" style={mf}>En foto{el.foto_indices.length > 1 ? 's' : ''} {el.foto_indices.join(', ')}</p>
      )}
    </div>
  );
}

/* ─────────────────────── Overlay de captura (cámara + GPS) ─────────────────────── */
type Shot = { url: string; blob: Blob };
function CaptureOverlay({ onClose, onSaved }: { onClose: () => void; onSaved: (id: number) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const [camError, setCamError] = useState<string | null>(null);
  const [camReady, setCamReady] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [saving, setSaving] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
      setCamReady(true);
    } catch {
      setCamError('No se pudo acceder a la cámara. Concede permisos del navegador y usa una conexión segura (HTTPS).');
      setCamReady(false);
    }
  }, []);

  const requestGeo = useCallback(() => {
    if (!('geolocation' in navigator)) { setGeoStatus('error'); return; }
    setGeoStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }); setGeoStatus('ok'); },
      () => setGeoStatus('error'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }, []);

  useEffect(() => {
    startCamera();
    requestGeo();
    return () => { stopCamera(); shots.forEach((s) => URL.revokeObjectURL(s.url)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => { if (blob) setShots((s) => [...s, { url: URL.createObjectURL(blob), blob }]); }, 'image/jpeg', 0.9);
  };

  const removeShot = (i: number) => setShots((s) => { const copy = [...s]; const [rm] = copy.splice(i, 1); if (rm) URL.revokeObjectURL(rm.url); return copy; });

  const save = async () => {
    if (!shots.length) { toast.error('Toma al menos una foto del entorno'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      shots.forEach((s, i) => fd.append('photos', s.blob, `foto-${i + 1}.jpg`));
      if (coords) {
        fd.append('lat', String(coords.lat));
        fd.append('lng', String(coords.lng));
        fd.append('accuracy', String(coords.accuracy));
      }
      const res = await fetch(API, { method: 'POST', body: fd });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Error al guardar la captura');
      toast.success('Captura guardada. Analizando con IA…');
      stopCamera();
      onClose();
      onSaved(d.id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const close = () => { stopCamera(); onClose(); };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" style={mf}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 text-white shrink-0">
        <Camera className="w-4 h-4" />
        <span className="text-[13px] font-semibold" style={df}>Nueva captura del entorno</span>
        <div className="ml-auto flex items-center gap-2 text-[11px]">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md ${geoStatus === 'ok' ? 'bg-green-500/20 text-green-300' : geoStatus === 'error' ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-white/70'}`}>
            <MapPin className="w-3 h-3" />
            {geoStatus === 'ok' && coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : geoStatus === 'loading' ? 'Ubicando…' : geoStatus === 'error' ? 'Sin GPS' : 'GPS'}
          </span>
          {geoStatus === 'error' && <button onClick={requestGeo} className="text-white/70 hover:text-white"><RefreshCw className="w-3.5 h-3.5" /></button>}
          <button onClick={close} className="w-8 h-8 flex items-center justify-center rounded-md bg-white/10 hover:bg-white/20 text-white"><X className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Cámara */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-4 relative">
        {camError ? (
          <div className="max-w-sm text-center text-white/80">
            <ImageOff className="w-8 h-8 mx-auto mb-3 text-white/50" />
            <p className="text-[13px]">{camError}</p>
            <button onClick={startCamera} className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-[12px]"><RefreshCw className="w-3.5 h-3.5" /> Reintentar</button>
          </div>
        ) : (
          <video ref={videoRef} playsInline muted className="max-h-full max-w-full rounded-xl bg-black object-contain" />
        )}
      </div>

      {/* Tira de fotos tomadas */}
      {shots.length > 0 && (
        <div className="shrink-0 px-4 py-2 flex gap-2 overflow-x-auto">
          {shots.map((s, i) => (
            <div key={s.url} className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.url} alt="" className="w-16 h-16 object-cover rounded-md border border-white/20" />
              <button onClick={() => removeShot(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center"><X className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      )}

      {/* Controles */}
      <div className="shrink-0 flex items-center justify-center gap-4 px-4 py-4">
        <span className="text-[11px] text-white/60 w-24 text-right">{shots.length} foto{shots.length === 1 ? '' : 's'}</span>
        <button
          onClick={takePhoto}
          disabled={!camReady || saving}
          className="w-16 h-16 rounded-full bg-white border-4 border-white/40 flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
          title="Tomar foto"
        >
          <Camera className="w-6 h-6 text-black" />
        </button>
        <button
          onClick={save}
          disabled={saving || !shots.length}
          className="w-24 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-accent text-white text-[12px] font-semibold hover:bg-accent/90 disabled:opacity-40"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" /> Guardar</>}
        </button>
      </div>
    </div>
  );
}
