'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import PixelSelect from '@/components/ui/PixelSelect';
import { fmt2 } from '@/lib/format';
import { BarraProgreso, BloqueResultado, ZonaArchivo, cabeceraAcceso, descargarBlob } from './piezasArchivo';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const CONVERSIONS: Record<string, string[]> = {
  m4a: ['mp3'], mp4: ['mp3'], wav: ['mp3'], ogg: ['mp3'], webm: ['mp3'], mp3: ['wav', 'ogg'],
};

/**
 * CONVERTIR ARCHIVOS — el formulario que antes vivía dentro de la página de Herramientas, tal cual.
 * `token`: si se usa desde un acceso compartido (`/herramienta/<token>`), la API lo recibe en
 * `x-acceso-herramienta` y cuenta el uso ella misma. Para empezar de cero, se monta con otra `key`.
 */
export default function ConvertirArchivos({ token, descripcion, alUsar }: {
  token?: string;
  descripcion?: string;
  alUsar?: (titulo: string, detalle: Record<string, string>) => void;
}) {
  const [convertFrom, setConvertFrom] = useState('m4a');
  const [convertTo, setConvertTo] = useState('mp3');
  const [convertFile, setConvertFile] = useState<File | null>(null);
  const [converting, setConverting] = useState(false);
  const [convertProgress, setConvertProgress] = useState(0);
  const [convertResult, setConvertResult] = useState<{ blob: Blob; name: string } | null>(null);
  const convertInputRef = useRef<HTMLInputElement>(null);

  const resetConvert = () => { setConvertFrom('m4a'); setConvertTo('mp3'); setConvertFile(null); setConverting(false); setConvertProgress(0); setConvertResult(null); };

  const handleConvert = async () => {
    if (!convertFile) return;
    setConverting(true); setConvertProgress(0); setConvertResult(null);
    const interval = setInterval(() => setConvertProgress(prev => Math.min(prev + Math.random() * 8, 90)), 300);
    try {
      const formData = new FormData();
      formData.append('file', convertFile);
      formData.append('from', convertFrom);
      formData.append('to', convertTo);
      const res = await fetch('/api/tools/convert', { method: 'POST', body: formData, headers: cabeceraAcceso(token) });
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
      alUsar?.(convertFile.name, { formato: `${convertFrom.toUpperCase()} → ${convertTo.toUpperCase()}`, tamano: `${fmt2(convertFile.size / 1024 / 1024)} MB` });
      descargarBlob(blob, name);
      toast.success('Conversión completada');
    } catch (err: any) {
      clearInterval(interval);
      toast.error(err.message || 'Error al convertir');
      setConvertProgress(0);
      setConverting(false);
    }
  };

  if (converting) {
    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex justify-between text-[12px]" style={mf}>
            <span className="text-digi-muted">{convertProgress < 100 ? 'Convirtiendo...' : 'Completado'}</span>
            <span className="text-accent font-medium">{Math.round(convertProgress)}%</span>
          </div>
          <BarraProgreso value={convertProgress} done={convertProgress >= 100} />
        </div>
        {convertResult ? (
          <BloqueResultado result={convertResult} onReset={resetConvert} label="Archivo convertido exitosamente" />
        ) : (
          <p className="text-[11px] text-digi-muted text-center" style={mf}>Procesando… no cierres la página</p>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {descripcion && <p className="text-[12px] text-digi-muted" style={mf}>{descripcion}</p>}
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
        <ZonaArchivo onClick={() => convertInputRef.current?.click()} file={convertFile}
          hint={`Haz clic para seleccionar un archivo .${convertFrom}`} />
        <input ref={convertInputRef} type="file" accept={`.${convertFrom}`} onChange={e => setConvertFile(e.target.files?.[0] || null)} className="hidden" />
      </div>
      <button onClick={handleConvert} disabled={!convertFile} className="pixel-btn pixel-btn-primary w-full text-sm disabled:opacity-50" style={mf}>
        Iniciar conversión
      </button>
    </div>
  );
}
