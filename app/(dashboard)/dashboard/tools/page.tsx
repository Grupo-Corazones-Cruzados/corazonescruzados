'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import PageHeader from '@/components/ui/PageHeader';
import PixelModal from '@/components/ui/PixelModal';
import PixelSelect from '@/components/ui/PixelSelect';
import {
  Repeat2, Captions, Search, ArrowRight, UploadCloud, Download, CheckCircle2,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const TOOLS = [
  { id: 'convert', name: 'Convertir Archivos', Icon: Repeat2, description: 'Convierte archivos de audio entre formatos (M4A, MP4, WAV, OGG → MP3, etc.).' },
  { id: 'transcribe', name: 'Transcribir Audio', Icon: Captions, description: 'Transcribe archivos de audio a texto usando inteligencia artificial (Whisper).' },
];

const CONVERSIONS: Record<string, string[]> = {
  m4a: ['mp3'], mp4: ['mp3'], wav: ['mp3'], ogg: ['mp3'], webm: ['mp3'], mp3: ['wav', 'ogg'],
};

export default function ToolsPage() {
  const [search, setSearch] = useState('');

  // Convert state
  const [showConvert, setShowConvert] = useState(false);
  const [convertFrom, setConvertFrom] = useState('m4a');
  const [convertTo, setConvertTo] = useState('mp3');
  const [convertFile, setConvertFile] = useState<File | null>(null);
  const [converting, setConverting] = useState(false);
  const [convertProgress, setConvertProgress] = useState(0);
  const [convertResult, setConvertResult] = useState<{ blob: Blob; name: string } | null>(null);
  const convertInputRef = useRef<HTMLInputElement>(null);

  // Transcribe state
  const [showTranscribe, setShowTranscribe] = useState(false);
  const [transcribeFile, setTranscribeFile] = useState<File | null>(null);
  const [transcribePhase, setTranscribePhase] = useState<'idle' | 'processing' | 'done'>('idle');
  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const [transcribeResult, setTranscribeResult] = useState<{ blob: Blob; name: string } | null>(null);
  const transcribeInputRef = useRef<HTMLInputElement>(null);

  const filtered = search
    ? TOOLS.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase()))
    : TOOLS;

  const openTool = (id: string) => {
    if (id === 'convert') {
      setConvertFrom('m4a'); setConvertTo('mp3'); setConvertFile(null);
      setConverting(false); setConvertProgress(0); setConvertResult(null);
      setShowConvert(true);
    } else if (id === 'transcribe') {
      setTranscribeFile(null); setTranscribePhase('idle'); setTranscribeProgress(0); setTranscribeResult(null);
      setShowTranscribe(true);
    }
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

    const interval = setInterval(() => {
      setConvertProgress(prev => Math.min(prev + Math.random() * 8, 90));
    }, 300);

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

    const progressInterval = setInterval(() => {
      setTranscribeProgress(prev => Math.min(prev + Math.random() * 6, 90));
    }, 500);

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

  const downloadResult = (result: { blob: Blob; name: string }) => triggerDownload(result.blob, result.name);
  const closeConvert = () => { setShowConvert(false); setConvertResult(null); setConverting(false); };
  const closeTranscribe = () => { setShowTranscribe(false); setTranscribeResult(null); setTranscribePhase('idle'); };

  const ProgressBar = ({ value, done }: { value: number; done?: boolean }) => (
    <div className="w-full h-2 rounded-full bg-digi-border/60 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-300 ${done ? 'bg-green-500' : 'bg-accent'}`} style={{ width: `${value}%` }} />
    </div>
  );

  const ResultBlock = ({ result, onClose, label }: any) => (
    <div className="space-y-2 pt-3 border-t border-digi-border">
      <p className="flex items-center justify-center gap-1.5 text-[12px] text-green-700 font-medium" style={mf}>
        <CheckCircle2 className="w-4 h-4" /> {label}
      </p>
      <button onClick={() => downloadResult(result)}
        className="w-full inline-flex items-center justify-center gap-1.5 py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover transition-colors" style={mf}>
        <Download className="w-4 h-4" /> Descargar {result.name}
      </button>
      <button onClick={onClose} className="pixel-btn pixel-btn-secondary w-full text-sm" style={mf}>Cerrar</button>
    </div>
  );

  const Dropzone = ({ onClick, file, hint }: any) => (
    <div onClick={onClick}
      className="w-full py-6 px-3 rounded-lg border-2 border-dashed border-digi-border hover:border-accent/50 hover:bg-accent-light/40 cursor-pointer text-center transition-colors">
      <UploadCloud className="w-6 h-6 text-digi-muted mx-auto mb-1.5" />
      <p className="text-[12px] text-digi-text" style={mf}>{file ? file.name : hint}</p>
      {file && <p className="text-[11px] text-digi-muted mt-0.5" style={mf}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>}
    </div>
  );

  return (
    <div>
      <PageHeader title="Herramientas" description="Utilidades de uso interno" />

      {/* Command bar */}
      <div className="relative w-full max-w-xs mb-4">
        <Search className="w-4 h-4 text-digi-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          placeholder="Buscar herramienta..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="field-control w-full pl-8 pr-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none"
          style={mf}
        />
      </div>

      {/* Tool gallery */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <button key={t.id} onClick={() => openTool(t.id)}
              className="group text-left bg-digi-card border border-digi-border rounded-lg shadow-sm p-4 flex flex-col hover:border-accent/40 hover:shadow-md transition-all">
              <div className="w-11 h-11 rounded-lg bg-accent-light border border-accent/15 flex items-center justify-center mb-3">
                <t.Icon className="w-5 h-5 text-accent" />
              </div>
              <h3 className="text-[14px] font-semibold text-digi-text" style={mf}>{t.name}</h3>
              <p className="text-[12px] text-digi-muted mt-1 flex-1 leading-relaxed" style={mf}>{t.description}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-[12px] text-accent font-medium group-hover:gap-1.5 transition-all" style={mf}>
                Abrir <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-digi-card border border-digi-border rounded-lg p-10 text-center">
          <p className="text-[13px] text-digi-text font-medium" style={mf}>Sin herramientas</p>
          <p className="text-[12px] text-digi-muted mt-1" style={mf}>No se encontraron herramientas para “{search}”.</p>
        </div>
      )}

      {/* Convert Modal */}
      <PixelModal open={showConvert} onClose={() => !converting && closeConvert()} title="Convertir Archivos" size="sm">
        {converting ? (
          <div className="py-4 space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-[12px]" style={mf}>
                <span className="text-digi-muted">{convertProgress < 100 ? 'Convirtiendo...' : 'Completado'}</span>
                <span className="text-accent font-medium">{Math.round(convertProgress)}%</span>
              </div>
              <ProgressBar value={convertProgress} done={convertProgress >= 100} />
            </div>
            {convertResult ? (
              <ResultBlock result={convertResult} onClose={closeConvert} label="Archivo convertido exitosamente" />
            ) : (
              <p className="text-[11px] text-digi-muted text-center" style={mf}>No cierres esta ventana</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
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
        )}
      </PixelModal>

      {/* Transcribe Modal */}
      <PixelModal open={showTranscribe} onClose={() => transcribePhase !== 'processing' && closeTranscribe()} title="Transcribir Audio" size="sm">
        {transcribePhase === 'processing' ? (
          <div className="py-4 space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-[12px]" style={mf}>
                <span className="text-digi-muted">Transcribiendo...</span>
                <span className="text-accent font-medium">{Math.round(transcribeProgress)}%</span>
              </div>
              <ProgressBar value={transcribeProgress} />
            </div>
            <p className="text-[11px] text-digi-muted text-center" style={mf}>No cierres esta ventana</p>
          </div>
        ) : transcribePhase === 'done' && transcribeResult ? (
          <div className="py-4 space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-[12px]" style={mf}>
                <span className="text-green-700 font-medium">Completado</span>
                <span className="text-green-700 font-medium">100%</span>
              </div>
              <ProgressBar value={100} done />
            </div>
            <ResultBlock result={transcribeResult} onClose={closeTranscribe} label="Audio transcrito exitosamente" />
          </div>
        ) : (
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
        )}
      </PixelModal>
    </div>
  );
}
