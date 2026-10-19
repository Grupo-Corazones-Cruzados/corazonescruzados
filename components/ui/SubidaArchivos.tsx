'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import BotonQuitar from '@/components/ui/BotonQuitar';
import { FileUp, Paperclip } from 'lucide-react';
import { fmt2 } from '@/lib/format';

const mf = { fontFamily: 'var(--font-body)' } as const;

export const MAX_ARCHIVOS = 10;
export const MAX_BYTES = 100 * 1024 * 1024;

export type ItemSubida = { clave: string; archivo: File; progreso: number; fileId?: string; error?: string };

export const mb = (b: number) => `${fmt2(b / 1024 / 1024)} MB`;

/** Sube un archivo a la URL de sesión de Drive, con progreso. Devuelve el id del archivo. */
function subir(url: string, archivo: File, onProgreso: (p: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) onProgreso(Math.round((ev.loaded / ev.total) * 100)); };
    xhr.onload = () => {
      try {
        if (xhr.status >= 200 && xhr.status < 300) return resolve(JSON.parse(xhr.responseText).id);
      } catch { /* respuesta rara: cae al rechazo */ }
      reject(new Error('No se pudo subir'));
    };
    xhr.onerror = () => reject(new Error('Se cortó la conexión'));
    xhr.send(archivo);
  });
}

/**
 * ⇒ SUBIDA DIRECTA AL DRIVE DE LA EMPRESA, del lado del navegador — definición ÚNICA (2026-10-19).
 * La usan el enlace de un solo uso (quien responde) y la entrega de un solo uso (quien envía).
 *
 * `abrirSesion` pide al servidor la URL de subida de UN archivo (ver `abrirSubida` en
 * `lib/enlaces`); los bytes van del navegador a Google, de uno en uno: diez de 100 MB a la vez
 * saturarían la conexión.
 */
export function useSubidaArchivos(abrirSesion: (a: File) => Promise<string>) {
  const [items, setItems] = useState<ItemSubida[]>([]);
  const abrir = useRef(abrirSesion);
  abrir.current = abrirSesion;

  const cambiar = (clave: string, c: Partial<ItemSubida>) => setItems((p) => p.map((x) => (x.clave === clave ? { ...x, ...c } : x)));

  const agregar = useCallback(async (lista: FileList | null, ocupados: number) => {
    if (!lista) return;
    const libres = MAX_ARCHIVOS - ocupados;
    const elegidos = Array.from(lista);
    if (elegidos.length > libres) toast.error(`Máximo ${MAX_ARCHIVOS} archivos`);
    const nuevos: ItemSubida[] = [];
    for (const archivo of elegidos.slice(0, Math.max(0, libres))) {
      if (archivo.size > MAX_BYTES) { toast.error(`«${archivo.name}» pasa de 100 MB`); continue; }
      if (archivo.size === 0) { toast.error(`«${archivo.name}» está vacío`); continue; }
      nuevos.push({ clave: `${Date.now()}-${Math.random()}`, archivo, progreso: 0 });
    }
    setItems((p) => [...p, ...nuevos]);
    for (const it of nuevos) {
      try {
        const url = await abrir.current(it.archivo);
        const fileId = await subir(url, it.archivo, (p) => cambiar(it.clave, { progreso: p }));
        cambiar(it.clave, { fileId, progreso: 100 });
      } catch (e: any) { cambiar(it.clave, { error: e.message || 'No se pudo subir' }); }
    }
  }, []);

  const quitar = (clave: string) => setItems((p) => p.filter((y) => y.clave !== clave));
  const subiendo = items.some((x) => !x.fileId && !x.error);
  const listos = items.filter((x) => x.fileId);
  return { items, setItems, agregar, quitar, subiendo, listos };
}

/** La lista de archivos con su progreso y el botón para adjuntar más. */
export function ListaSubidas({ items, agregar, quitar, etiqueta = 'Archivos' }: {
  items: ItemSubida[];
  agregar: (l: FileList | null, ocupados: number) => void;
  quitar: (clave: string) => void;
  etiqueta?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-digi-text opacity-70" style={mf}>
        {etiqueta} <span className="font-normal">({items.length}/{MAX_ARCHIVOS} · hasta 100 MB cada uno)</span>
      </span>
      {items.map((x) => (
        <div key={x.clave} className="flex items-center gap-2 rounded-lg border border-digi-border px-3 py-2">
          <Paperclip className="w-4 h-4 text-digi-muted shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[12.5px] text-digi-text truncate" style={mf}>{x.archivo.name}</p>
            {x.error ? (
              <p className="text-[11px] text-red-600" style={mf}>{x.error}</p>
            ) : x.fileId ? (
              <p className="text-[11px] text-green-600" style={mf}>{mb(x.archivo.size)} · Subido</p>
            ) : (
              <div className="mt-1 h-1.5 rounded-full bg-digi-border/60 overflow-hidden">
                <div className="h-full bg-accent transition-all" style={{ width: `${x.progreso}%` }} />
              </div>
            )}
          </div>
          {(x.fileId || x.error) && <BotonQuitar onClick={() => quitar(x.clave)} etiqueta="Quitar archivo" />}
        </div>
      ))}
      {items.length < MAX_ARCHIVOS && (
        <button type="button" onClick={() => input.current?.click()}
          className="w-full py-5 rounded-lg border-2 border-dashed border-digi-border hover:border-accent/50 hover:bg-accent-light/40 text-center transition-colors">
          <FileUp className="w-5 h-5 text-digi-muted mx-auto mb-1" />
          <span className="text-[12px] text-digi-text" style={mf}>Adjuntar archivos</span>
        </button>
      )}
      <input ref={input} type="file" multiple className="hidden"
        onChange={(e) => { agregar(e.target.files, items.length); e.target.value = ''; }} />
    </div>
  );
}
