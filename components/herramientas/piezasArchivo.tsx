'use client';

import { CheckCircle2, Download, UploadCloud } from 'lucide-react';
import { fmt2 } from '@/lib/format';

const mf = { fontFamily: 'var(--font-body)' } as const;

/**
 * Las piezas que comparten Convertir y Transcribir: la zona para elegir el archivo, la barra de
 * progreso y el bloque del resultado. Vivían dentro de la página de Herramientas; salieron para que
 * el acceso compartido (`/herramienta/<token>`) use exactamente las mismas.
 */
export function descargarBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/** Cabecera que lleva el token de un acceso compartido a la API de la herramienta. */
export const cabeceraAcceso = (token?: string): Record<string, string> =>
  token ? { 'x-acceso-herramienta': token } : {};

export function BarraProgreso({ value, done }: { value: number; done?: boolean }) {
  return (
    <div className="w-full h-2 rounded-full bg-digi-border/60 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-300 ${done ? 'bg-green-500' : 'bg-accent'}`} style={{ width: `${value}%` }} />
    </div>
  );
}

export function BloqueResultado({ result, onReset, label }: { result: { blob: Blob; name: string }; onReset: () => void; label: string }) {
  return (
    <div className="space-y-2 pt-3 border-t border-digi-border">
      <p className="flex items-center justify-center gap-1.5 text-[12px] text-green-700 font-medium" style={mf}>
        <CheckCircle2 className="w-4 h-4" /> {label}
      </p>
      <button onClick={() => descargarBlob(result.blob, result.name)}
        className="w-full inline-flex items-center justify-center gap-1.5 py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover transition-colors" style={mf}>
        <Download className="w-4 h-4" /> Descargar {result.name}
      </button>
      <button onClick={onReset} className="pixel-btn pixel-btn-secondary w-full text-sm" style={mf}>Usar de nuevo</button>
    </div>
  );
}

export function ZonaArchivo({ onClick, file, hint }: { onClick: () => void; file: File | null; hint: string }) {
  return (
    <div onClick={onClick}
      className="w-full py-6 px-3 rounded-lg border-2 border-dashed border-digi-border hover:border-accent/50 hover:bg-accent-light/40 cursor-pointer text-center transition-colors">
      <UploadCloud className="w-6 h-6 text-digi-muted mx-auto mb-1.5" />
      <p className="text-[12px] text-digi-text" style={mf}>{file ? file.name : hint}</p>
      {file && <p className="text-[11px] text-digi-muted mt-0.5" style={mf}>{fmt2((file.size / 1024 / 1024))} MB</p>}
    </div>
  );
}
