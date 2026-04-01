'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import PageHeader from '@/components/ui/PageHeader';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelModal from '@/components/ui/PixelModal';

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

const TOOLS = [
  { id: 'convert', name: 'Convertir Archivos', description: 'Convierte archivos de audio entre formatos (M4A, MP4, WAV, OGG → MP3, etc.)' },
  { id: 'transcribe', name: 'Transcribir Audio', description: 'Transcribe archivos de audio a texto usando inteligencia artificial (Whisper)' },
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
  const [transcribing, setTranscribing] = useState(false);
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
      setTranscribeFile(null); setTranscribing(false); setTranscribeProgress(0); setTranscribeResult(null);
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
    // Delay revoke to ensure browser picks up the download
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
      toast.success('Conversion completada');
    } catch (err: any) {
      clearInterval(interval);
      toast.error(err.message || 'Error al convertir');
      setConvertProgress(0);
      setConverting(false);
    }
  };

  // --- Transcribe ---
  const handleTranscribe = async () => {
    if (!transcribeFile) return;
    setTranscribing(true); setTranscribeProgress(0); setTranscribeResult(null);

    const interval = setInterval(() => {
      setTranscribeProgress(prev => Math.min(prev + Math.random() * 5, 90));
    }, 500);

    try {
      const formData = new FormData();
      formData.append('file', transcribeFile);

      const res = await fetch('/api/tools/transcribe', { method: 'POST', body: formData });
      clearInterval(interval);

      if (!res.ok) {
        let msg = 'Error al transcribir';
        try { const err = await res.json(); msg = err.error || msg; } catch { /* response wasn't JSON */ }
        throw new Error(msg);
      }

      // Read as text first, then create blob from it to ensure proper encoding
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const name = transcribeFile.name.replace(/\.[^.]+$/, '') + '.txt';

      setTranscribeProgress(100);
      setTranscribeResult({ blob, name });
      triggerDownload(blob, name);
      toast.success('Transcripcion completada');
    } catch (err: any) {
      clearInterval(interval);
      toast.error(err.message || 'Error al transcribir');
      setTranscribeProgress(0);
      setTranscribing(false);
    }
  };

  const downloadResult = (result: { blob: Blob; name: string }) => {
    triggerDownload(result.blob, result.name);
  };

  const closeConvert = () => { setShowConvert(false); setConvertResult(null); setConverting(false); };
  const closeTranscribe = () => { setShowTranscribe(false); setTranscribeResult(null); setTranscribing(false); };

  return (
    <div>
      <PageHeader title="Herramientas" description="Utilidades de uso interno" />

      <div className="mb-4">
        <input
          placeholder="Buscar..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none w-full max-w-xs"
          style={mf}
        />
      </div>

      <PixelDataTable
        columns={[
          { key: 'name', header: 'Herramienta', render: (t: any) => <span className="text-white">{t.name}</span> },
          { key: 'description', header: 'Descripcion', render: (t: any) => <span className="text-digi-muted">{t.description}</span> },
          { key: 'action', header: '', width: '100px', render: (t: any) => (
            <button onClick={(e) => { e.stopPropagation(); openTool(t.id); }}
              className="px-3 py-1 text-[9px] text-accent-glow border border-accent/30 hover:bg-accent/10 transition-colors" style={pf}>
              Abrir
            </button>
          )},
        ]}
        data={filtered}
        onRowClick={(t: any) => openTool(t.id)}
        emptyTitle="Sin herramientas"
        emptyDesc="No se encontraron herramientas."
      />

      {/* Convert Modal */}
      <PixelModal open={showConvert} onClose={() => !converting && closeConvert()} title="Convertir Archivos" size="sm">
        {converting ? (
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-[9px]" style={mf}>
                <span className="text-digi-muted">{convertProgress < 100 ? 'Convirtiendo...' : 'Completado'}</span>
                <span className="text-accent-glow">{Math.round(convertProgress)}%</span>
              </div>
              <div className="w-full h-2 bg-digi-border overflow-hidden">
                <div className="h-full bg-accent transition-all duration-300" style={{ width: `${convertProgress}%` }} />
              </div>
            </div>
            {convertResult && (
              <div className="space-y-2 pt-2 border-t border-digi-border">
                <p className="text-[9px] text-green-400 text-center" style={mf}>Archivo convertido exitosamente</p>
                <button onClick={() => downloadResult(convertResult)}
                  className="w-full py-2 text-[9px] text-green-400 border border-green-500/30 hover:bg-green-900/20 transition-colors" style={pf}>
                  Descargar {convertResult.name}
                </button>
                <button onClick={closeConvert}
                  className="w-full py-1.5 text-[9px] text-digi-muted border border-digi-border hover:text-white transition-colors" style={pf}>
                  Cerrar
                </button>
              </div>
            )}
            {!convertResult && <p className="text-[8px] text-digi-muted text-center" style={mf}>No cierres esta ventana</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Formato origen</label>
                <select value={convertFrom} onChange={e => {
                  setConvertFrom(e.target.value);
                  const targets = CONVERSIONS[e.target.value] || [];
                  if (targets.length > 0 && !targets.includes(convertTo)) setConvertTo(targets[0]);
                }}
                  className="w-full px-2 py-1.5 bg-digi-darker border border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf}>
                  {Object.keys(CONVERSIONS).map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Formato destino</label>
                <select value={convertTo} onChange={e => setConvertTo(e.target.value)}
                  className="w-full px-2 py-1.5 bg-digi-darker border border-digi-border text-xs text-digi-text focus:border-accent focus:outline-none" style={mf}>
                  {(CONVERSIONS[convertFrom] || []).map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Archivo</label>
              <div
                onClick={() => convertInputRef.current?.click()}
                className="w-full py-4 border-2 border-dashed border-digi-border hover:border-accent/30 cursor-pointer text-center transition-colors">
                <p className="text-[9px] text-digi-muted" style={mf}>
                  {convertFile ? convertFile.name : `Haz clic para seleccionar un archivo .${convertFrom}`}
                </p>
                {convertFile && <p className="text-[8px] text-digi-muted mt-1" style={mf}>{(convertFile.size / 1024 / 1024).toFixed(2)} MB</p>}
              </div>
              <input ref={convertInputRef} type="file" accept={`.${convertFrom}`} onChange={e => setConvertFile(e.target.files?.[0] || null)} className="hidden" />
            </div>

            <button onClick={handleConvert} disabled={!convertFile}
              className="pixel-btn-primary w-full py-2 text-[9px] disabled:opacity-50" style={pf}>
              Iniciar Conversion
            </button>
          </div>
        )}
      </PixelModal>

      {/* Transcribe Modal */}
      <PixelModal open={showTranscribe} onClose={() => !transcribing && closeTranscribe()} title="Transcribir Audio" size="sm">
        {transcribing ? (
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-[9px]" style={mf}>
                <span className="text-digi-muted">{transcribeProgress < 100 ? 'Transcribiendo...' : 'Completado'}</span>
                <span className="text-accent-glow">{Math.round(transcribeProgress)}%</span>
              </div>
              <div className="w-full h-2 bg-digi-border overflow-hidden">
                <div className="h-full bg-accent transition-all duration-300" style={{ width: `${transcribeProgress}%` }} />
              </div>
            </div>
            {transcribeResult && (
              <div className="space-y-2 pt-2 border-t border-digi-border">
                <p className="text-[9px] text-green-400 text-center" style={mf}>Audio transcrito exitosamente</p>
                <button onClick={() => downloadResult(transcribeResult)}
                  className="w-full py-2 text-[9px] text-green-400 border border-green-500/30 hover:bg-green-900/20 transition-colors" style={pf}>
                  Descargar {transcribeResult.name}
                </button>
                <button onClick={closeTranscribe}
                  className="w-full py-1.5 text-[9px] text-digi-muted border border-digi-border hover:text-white transition-colors" style={pf}>
                  Cerrar
                </button>
              </div>
            )}
            {!transcribeResult && <p className="text-[8px] text-digi-muted text-center" style={mf}>No cierres esta ventana</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[9px] text-digi-muted" style={mf}>Sube un archivo de audio (MP3, M4A, WAV, OGG, WEBM) para transcribirlo a texto.</p>

            <div>
              <label className="text-[8px] text-digi-muted mb-0.5 block" style={pf}>Archivo de audio</label>
              <div
                onClick={() => transcribeInputRef.current?.click()}
                className="w-full py-4 border-2 border-dashed border-digi-border hover:border-accent/30 cursor-pointer text-center transition-colors">
                <p className="text-[9px] text-digi-muted" style={mf}>
                  {transcribeFile ? transcribeFile.name : 'Haz clic para seleccionar un archivo de audio'}
                </p>
                {transcribeFile && <p className="text-[8px] text-digi-muted mt-1" style={mf}>{(transcribeFile.size / 1024 / 1024).toFixed(2)} MB</p>}
              </div>
              <input ref={transcribeInputRef} type="file" accept=".mp3,.m4a,.mp4,.wav,.ogg,.webm" onChange={e => setTranscribeFile(e.target.files?.[0] || null)} className="hidden" />
            </div>

            <button onClick={handleTranscribe} disabled={!transcribeFile}
              className="pixel-btn-primary w-full py-2 text-[9px] disabled:opacity-50" style={pf}>
              Iniciar Transcripcion
            </button>
          </div>
        )}
      </PixelModal>
    </div>
  );
}
