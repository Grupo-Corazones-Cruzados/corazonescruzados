'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { fmt2 } from '@/lib/format';
import { BarraProgreso, BloqueResultado, ZonaArchivo, cabeceraAcceso, descargarBlob } from './piezasArchivo';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

/**
 * TRANSCRIBIR AUDIO — el formulario que antes vivía dentro de la página de Herramientas, tal cual
 * (Whisper en `/api/tools/transcribe`, con FFmpeg partiendo el audio). `token`: igual que en
 * `ConvertirArchivos`, para el acceso compartido. Para empezar de cero, se monta con otra `key`.
 */
export default function TranscribirAudio({ token, alUsar }: {
  token?: string;
  alUsar?: (titulo: string, detalle: Record<string, string>) => void;
}) {
  const [transcribeFile, setTranscribeFile] = useState<File | null>(null);
  const [transcribePhase, setTranscribePhase] = useState<'idle' | 'processing' | 'done'>('idle');
  const [transcribeProgress, setTranscribeProgress] = useState(0);
  const [transcribeResult, setTranscribeResult] = useState<{ blob: Blob; name: string } | null>(null);
  const transcribeInputRef = useRef<HTMLInputElement>(null);

  const resetTranscribe = () => { setTranscribeFile(null); setTranscribePhase('idle'); setTranscribeProgress(0); setTranscribeResult(null); };

  const handleTranscribe = async () => {
    if (!transcribeFile) return;
    setTranscribePhase('processing'); setTranscribeProgress(0); setTranscribeResult(null);
    const progressInterval = setInterval(() => setTranscribeProgress(prev => Math.min(prev + Math.random() * 6, 90)), 500);
    try {
      const form = new FormData();
      form.append('file', transcribeFile);
      const res = await fetch('/api/tools/transcribe', { method: 'POST', body: form, headers: cabeceraAcceso(token) });
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
      alUsar?.(transcribeFile.name, { tamano: `${fmt2(transcribeFile.size / 1024 / 1024)} MB` });
      setTranscribePhase('done');
      descargarBlob(blob, name);
      toast.success('Transcripción completada');
    } catch (err: any) {
      clearInterval(progressInterval);
      toast.error(err.message || 'Error al transcribir');
      setTranscribeProgress(0);
      setTranscribePhase('idle');
    }
  };

  if (transcribePhase === 'processing') {
    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex justify-between text-[12px]" style={mf}>
            <span className="text-digi-muted">Transcribiendo...</span>
            <span className="text-accent font-medium">{Math.round(transcribeProgress)}%</span>
          </div>
          <BarraProgreso value={transcribeProgress} />
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
          <BarraProgreso value={100} done />
        </div>
        <BloqueResultado result={transcribeResult} onReset={resetTranscribe} label="Audio transcrito exitosamente" />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-digi-muted" style={mf}>Sube un archivo de audio (MP3, M4A, WAV, OGG, WEBM) para transcribirlo a texto.</p>
      <div className="flex flex-col gap-1">
        <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Archivo de audio</label>
        <ZonaArchivo onClick={() => transcribeInputRef.current?.click()} file={transcribeFile}
          hint="Haz clic para seleccionar un archivo de audio" />
        <input ref={transcribeInputRef} type="file" accept=".mp3,.m4a,.mp4,.wav,.ogg,.webm" onChange={e => setTranscribeFile(e.target.files?.[0] || null)} className="hidden" />
      </div>
      <button onClick={handleTranscribe} disabled={!transcribeFile} className="pixel-btn pixel-btn-primary w-full text-sm disabled:opacity-50" style={mf}>
        Iniciar transcripción
      </button>
    </div>
  );
}
