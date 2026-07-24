'use client';

import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import PageHeader from '@/components/ui/PageHeader';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelSelect from '@/components/ui/PixelSelect';
import { fmt2 } from '@/lib/format';
import {
  Repeat2, Captions, Search, UploadCloud, Download, CheckCircle2, LayoutGrid, Wand2, Wrench,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

type Tool = { id: string; name: string; Icon: any; description: string; category: string };

// Categorías (tipos de herramienta). Por ahora solo "Edición".
const CATEGORIES = [
  { value: 'all', label: 'Todas', Icon: LayoutGrid },
  { value: 'edicion', label: 'Edición', Icon: Wand2 },
];

const TOOLS: Tool[] = [
  { id: 'convert', name: 'Convertir Archivos', Icon: Repeat2, category: 'edicion', description: 'Convierte archivos de audio entre formatos (M4A, MP4, WAV, OGG → MP3, etc.).' },
  { id: 'transcribe', name: 'Transcribir Audio', Icon: Captions, category: 'edicion', description: 'Transcribe archivos de audio a texto usando inteligencia artificial (Whisper).' },
];

const CONVERSIONS: Record<string, string[]> = {
  m4a: ['mp3'], mp4: ['mp3'], wav: ['mp3'], ogg: ['mp3'], webm: ['mp3'], mp3: ['wav', 'ogg'],
};

export default function ToolsPage() {
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('all');
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  // Convert state
  const [convertFrom, setConvertFrom] = useState('m4a');
  const [convertTo, setConvertTo] = useState('mp3');
  const [convertFile, setConvertFile] = useState<File | null>(null);
  const [converting, setConverting] = useState(false);
  const [convertProgress, setConvertProgress] = useState(0);
  const [convertResult, setConvertResult] = useState<{ blob: Blob; name: string } | null>(null);
  const convertInputRef = useRef<HTMLInputElement>(null);

  // Transcribe state
  const [transcribeFile, setTranscribeFile] = useState<File | null>(null);
  const [transcribePhase, setTranscribePhase] = useState<'idle' | 'processing' | 'done'>('idle');
  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const [transcribeResult, setTranscribeResult] = useState<{ blob: Blob; name: string } | null>(null);
  const transcribeInputRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: TOOLS.length };
    for (const t of TOOLS) c[t.category] = (c[t.category] || 0) + 1;
    return c;
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return TOOLS.filter((t) => {
      if (cat !== 'all' && t.category !== cat) return false;
      if (q && !t.name.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [cat, search]);

  const resetConvert = () => { setConvertFrom('m4a'); setConvertTo('mp3'); setConvertFile(null); setConverting(false); setConvertProgress(0); setConvertResult(null); };
  const resetTranscribe = () => { setTranscribeFile(null); setTranscribePhase('idle'); setTranscribeProgress(0); setTranscribeResult(null); };

  const selectTool = (id: string) => {
    setSelectedTool(id);
    if (id === 'convert') resetConvert();
    else if (id === 'transcribe') resetTranscribe();
  };

  const triggerDownload = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  // --- Convert ---
  const handleConvert = async () => {
    if (!convertFile) return;
    setConverting(true); setConvertProgress(0); setConvertResult(null);
    const interval = setInterval(() => setConvertProgress(prev => Math.min(prev + Math.random() * 8, 90)), 300);
    try {
      const formData = new FormData();
      formData.append('file', convertFile);
      formData.append('from', convertFrom);
      formData.append('to', convertTo);
      const res = await fetch('/api/tools/convert', { method: 'POST', body: formData });
      clearInterval(interval);
      if (!res.ok) {
        let msg = 'Error al convertir';
        try { const err = await res.json(); msg = err.error || msg; } catch { /* response wasn't JSON */ }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const name = convertFile.name.replace(/\.[^.]+$/, '') + '.' + convertTo;
      setConvertProgress(100);
      setConvertResult({ blob, name });
      triggerDownload(blob, name);
      toast.success('Conversión completada');
    } catch (err: any) {
      clearInterval(interval);
      toast.error(err.message || 'Error al convertir');
      setConvertProgress(0);
      setConverting(false);
    }
  };

  // --- Transcribe (server-side via /api/tools/transcribe with FFmpeg segmentation) ---
  const handleTranscribe = async () => {
    if (!transcribeFile) return;
    setTranscribePhase('processing'); setTranscribeProgress(0); setTranscribeResult(null);
    const progressInterval = setInterval(() => setTranscribeProgress(prev => Math.min(prev + Math.random() * 6, 90)), 500);
    try {
      const form = new FormData();
      form.append('file', transcribeFile);
      const res = await fetch('/api/tools/transcribe', { method: 'POST', body: form });
      clearInterval(progressInterval);
      if (!res.ok) {
        let msg = 'Error al transcribir';
        try { const err = await res.json(); msg = err.error || msg; } catch {}
        throw new Error(msg);
      }
      const blob = await res.blob();
      const name = transcribeFile.name.replace(/\.[^.]+$/, '') + '.txt';
      setTranscribeProgress(100);
      setTranscribeResult({ blob, name });
      setTranscribePhase('done');
      triggerDownload(blob, name);
      toast.success('Transcripción completada');
    } catch (err: any) {
      clearInterval(progressInterval);
      toast.error(err.message || 'Error al transcribir');
      setTranscribeProgress(0);
      setTranscribePhase('idle');
    }
  };

  const ProgressBar = ({ value, done }: { value: number; done?: boolean }) => (
    <div className="w-full h-2 rounded-full bg-digi-border/60 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-300 ${done ? 'bg-green-500' : 'bg-accent'}`} style={{ width: `${value}%` }} />
    </div>
  );

  const ResultBlock = ({ result, onReset, label }: { result: { blob: Blob; name: string }; onReset: () => void; label: string }) => (
    <div className="space-y-2 pt-3 border-t border-digi-border">
      <p className="flex items-center justify-center gap-1.5 text-[12px] text-green-700 font-medium" style={mf}>
        <CheckCircle2 className="w-4 h-4" /> {label}
      </p>
      <button onClick={() => triggerDownload(result.blob, result.name)}
        className="w-full inline-flex items-center justify-center gap-1.5 py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover transition-colors" style={mf}>
        <Download className="w-4 h-4" /> Descargar {result.name}
      </button>
      <button onClick={onReset} className="pixel-btn pixel-btn-secondary w-full text-sm" style={mf}>Usar de nuevo</button>
    </div>
  );

  const Dropzone = ({ onClick, file, hint }: { onClick: () => void; file: File | null; hint: string }) => (
    <div onClick={onClick}
      className="w-full py-6 px-3 rounded-lg border-2 border-dashed border-digi-border hover:border-accent/50 hover:bg-accent-light/40 cursor-pointer text-center transition-colors">
      <UploadCloud className="w-6 h-6 text-digi-muted mx-auto mb-1.5" />
      <p className="text-[12px] text-digi-text" style={mf}>{file ? file.name : hint}</p>
      {file && <p className="text-[11px] text-digi-muted mt-0.5" style={mf}>{fmt2((file.size / 1024 / 1024))} MB</p>}
    </div>
  );

  const tool = TOOLS.find((t) => t.id === selectedTool) || null;

  // Panel derecho: usar la herramienta seleccionada.
  const renderToolPanel = () => {
    if (!tool) {
      return (
        <div className="bg-digi-card border border-digi-border rounded-lg p-6 text-center lg:sticky lg:top-4">
          <div className="w-10 h-10 rounded-lg bg-black/[0.03] flex items-center justify-center mx-auto mb-2">
            <Wrench className="w-5 h-5 text-digi-muted" />
          </div>
          <p className="text-[12px] text-digi-muted" style={mf}>Selecciona una herramienta para usarla.</p>
        </div>
      );
    }
    return (
      <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm overflow-hidden lg:sticky lg:top-4">
        <div className="flex items-center gap-2.5 p-4 border-b border-digi-border">
          <div className="w-9 h-9 rounded-lg bg-accent-light border border-accent/15 flex items-center justify-center shrink-0">
            <tool.Icon className="w-5 h-5 text-accent" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[14px] font-semibold text-digi-text leading-tight" style={mf}>{tool.name}</h3>
            <p className="text-[11px] text-digi-muted" style={mf}>Herramienta de edición</p>
          </div>
        </div>
        <div className="p-4">{tool.id === 'convert' ? renderConvert() : renderTranscribe()}</div>
      </div>
    );
  };

  const renderConvert = () => {
    if (converting) {
      return (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-[12px]" style={mf}>
              <span className="text-digi-muted">{convertProgress < 100 ? 'Convirtiendo...' : 'Completado'}</span>
              <span className="text-accent font-medium">{Math.round(convertProgress)}%</span>
            </div>
            <ProgressBar value={convertProgress} done={convertProgress >= 100} />
          </div>
          {convertResult ? (
            <ResultBlock result={convertResult} onReset={resetConvert} label="Archivo convertido exitosamente" />
          ) : (
            <p className="text-[11px] text-digi-muted text-center" style={mf}>Procesando… no cierres la página</p>
          )}
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <p className="text-[12px] text-digi-muted" style={mf}>{TOOLS[0].description}</p>
        <div className="grid grid-cols-2 gap-3">
          <PixelSelect label="Formato origen" value={convertFrom}
            onChange={(e) => {
              setConvertFrom(e.target.value);
              const targets = CONVERSIONS[e.target.value] || [];
              if (targets.length > 0 && !targets.includes(convertTo)) setConvertTo(targets[0]);
            }}
            options={Object.keys(CONVERSIONS).map((f) => ({ value: f, label: f.toUpperCase() }))} />
          <PixelSelect label="Formato destino" value={convertTo}
            onChange={(e) => setConvertTo(e.target.value)}
            options={(CONVERSIONS[convertFrom] || []).map((f) => ({ value: f, label: f.toUpperCase() }))} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Archivo</label>
          <Dropzone onClick={() => convertInputRef.current?.click()} file={convertFile}
            hint={`Haz clic para seleccionar un archivo .${convertFrom}`} />
          <input ref={convertInputRef} type="file" accept={`.${convertFrom}`} onChange={e => setConvertFile(e.target.files?.[0] || null)} className="hidden" />
        </div>
        <button onClick={handleConvert} disabled={!convertFile} className="pixel-btn pixel-btn-primary w-full text-sm disabled:opacity-50" style={mf}>
          Iniciar conversión
        </button>
      </div>
    );
  };

  const renderTranscribe = () => {
    if (transcribePhase === 'processing') {
      return (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-[12px]" style={mf}>
              <span className="text-digi-muted">Transcribiendo...</span>
              <span className="text-accent font-medium">{Math.round(transcribeProgress)}%</span>
            </div>
            <ProgressBar value={transcribeProgress} />
          </div>
          <p className="text-[11px] text-digi-muted text-center" style={mf}>Procesando… no cierres la página</p>
        </div>
      );
    }
    if (transcribePhase === 'done' && transcribeResult) {
      return (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-[12px]" style={mf}>
              <span className="text-green-700 font-medium">Completado</span>
              <span className="text-green-700 font-medium">100%</span>
            </div>
            <ProgressBar value={100} done />
          </div>
          <ResultBlock result={transcribeResult} onReset={resetTranscribe} label="Audio transcrito exitosamente" />
        </div>
      );
    }
    return (
      <div className="space-y-3">
        <p className="text-[12px] text-digi-muted" style={mf}>Sube un archivo de audio (MP3, M4A, WAV, OGG, WEBM) para transcribirlo a texto.</p>
        <div className="flex flex-col gap-1">
          <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Archivo de audio</label>
          <Dropzone onClick={() => transcribeInputRef.current?.click()} file={transcribeFile}
            hint="Haz clic para seleccionar un archivo de audio" />
          <input ref={transcribeInputRef} type="file" accept=".mp3,.m4a,.mp4,.wav,.ogg,.webm" onChange={e => setTranscribeFile(e.target.files?.[0] || null)} className="hidden" />
        </div>
        <button onClick={handleTranscribe} disabled={!transcribeFile} className="pixel-btn pixel-btn-primary w-full text-sm disabled:opacity-50" style={mf}>
          Iniciar transcripción
        </button>
      </div>
    );
  };

  const RailItem = ({ active, Icon, label, count, onClick }: any) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left transition-colors border-l-2 ${
        active ? 'bg-accent-light border-accent text-accent' : 'border-transparent text-digi-text hover:bg-black/[0.03]'
      }`}
    >
      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-accent' : 'text-digi-muted'}`} />
      <span className="flex-1 min-w-0 text-[12.5px] font-medium truncate" style={mf}>{label}</span>
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${active ? 'bg-accent/15 text-accent' : 'bg-black/[0.05] text-digi-muted'}`}>{count ?? 0}</span>
    </button>
  );

  return (
    <div>
      <PageHeader title="Herramientas" description="Utilidades de uso interno" />

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* ── Left rail: categorías ── */}
        <aside className="w-full lg:w-[220px] shrink-0 bg-digi-card border border-digi-border rounded-lg p-2">
          <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide px-2 pt-1 pb-2" style={df}>Categoría</p>
          <div className="space-y-0.5">
            {CATEGORIES.map((c) => (
              <RailItem key={c.value} active={cat === c.value} Icon={c.Icon} label={c.label}
                count={counts[c.value]} onClick={() => setCat(c.value)} />
            ))}
          </div>
        </aside>

        {/* ── Right region: buscador + tabla + panel de uso ── */}
        <div className="flex-1 min-w-0 w-full">
          <div className="relative w-full max-w-xs mb-3">
            <Search className="w-4 h-4 text-digi-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              placeholder="Buscar herramienta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field-control w-full pl-8 pr-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none"
              style={mf}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
            <div className="min-w-0">
              <PixelDataTable
                singleLine
                columns={[
                  { key: 'name', header: 'Herramienta', render: (t: Tool) => (
                    <span className="flex items-center gap-2 min-w-0">
                      <t.Icon className={`w-4 h-4 shrink-0 ${selectedTool === t.id ? 'text-accent' : 'text-digi-muted'}`} />
                      <span className={`truncate text-[13px] font-medium ${selectedTool === t.id ? 'text-accent' : 'text-digi-text'}`} style={mf}>{t.name}</span>
                    </span>
                  ) },
                  { key: 'description', header: 'Descripción', hideOnMobile: true, render: (t: Tool) => (
                    <span className="text-[12px] text-digi-muted line-clamp-1" style={mf}>{t.description}</span>
                  ) },
                ]}
                data={filtered}
                onRowClick={(t: Tool) => selectTool(t.id)}
                emptyTitle="Sin herramientas"
                emptyDesc="No se encontraron herramientas en esta categoría."
              />
            </div>

            {/* ── Panel de uso ── */}
            <aside className="w-full xl:w-[360px]">
              {renderToolPanel()}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
