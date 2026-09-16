'use client';

import { useRef, useState } from 'react';
import { Paperclip, X, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Boton } from '@/componentes/ui';

export type AdjuntoSubido = { id: number; nombre: string; fragmentos: number; caracteres: number };

const MAX = 5;

/**
 * LOS ADJUNTOS DE LA SOLICITUD (máximo 5). Cada archivo se sube en el acto y el
 * servidor lo convierte en embeddings; aquí solo queda su id, que viaja en el
 * formulario como `adjuntos` repetido.
 */
export function Adjuntos({ slug, valor, alCambiar, deshabilitado }: { slug: string; valor: AdjuntoSubido[]; alCambiar: (v: AdjuntoSubido[]) => void; deshabilitado?: boolean }) {
  const [subiendo, setSubiendo] = useState<string[]>([]);
  const entrada = useRef<HTMLInputElement>(null);

  async function subir(archivos: FileList | null) {
    if (!archivos?.length) return;
    const lista = Array.from(archivos);
    if (valor.length + subiendo.length + lista.length > MAX) {
      toast.error(`Como mucho ${MAX} archivos por solicitud.`);
      return;
    }
    for (const a of lista) {
      setSubiendo((s) => [...s, a.name]);
      try {
        const fd = new FormData();
        fd.append('archivo', a);
        const r = await fetch(`/${slug}/api/adjuntos`, { method: 'POST', body: fd });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'No se pudo subir.');
        alCambiar([...valor, j]);
        valor = [...valor, j];
      } catch (e: any) {
        toast.error(e?.message ?? `No se pudo subir «${a.name}».`);
      } finally {
        setSubiendo((s) => s.filter((n) => n !== a.name));
      }
    }
    if (entrada.current) entrada.current.value = '';
  }

  async function quitar(id: number) {
    alCambiar(valor.filter((v) => v.id !== id));
    await fetch(`/${slug}/api/adjuntos?id=${id}`, { method: 'DELETE' }).catch(() => {});
  }

  const lleno = valor.length + subiendo.length >= MAX;
  return (
    <div className="space-y-2">
      {valor.map((v) => (
        <div key={v.id} className="flex items-center gap-2 rounded border border-borde bg-realce px-2.5 py-1.5 text-[12px]">
          <input type="hidden" name="adjuntos" value={v.id} />
          <FileText className="h-4 w-4 shrink-0 text-acento" />
          <span className="min-w-0 flex-1 truncate font-semibold">{v.nombre}</span>
          <span className="shrink-0 text-tenue">{v.fragmentos} fragmentos</span>
          <button type="button" onClick={() => quitar(v.id)} className="rounded p-0.5 text-tenue hover:text-error foco-visible" title="Quitar">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      {subiendo.map((n) => (
        <div key={n} className="flex items-center gap-2 rounded border border-borde px-2.5 py-1.5 text-[12px] text-tenue">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          <span className="truncate">Leyendo y convirtiendo «{n}»…</span>
        </div>
      ))}
      <input ref={entrada} type="file" multiple accept=".pdf,.docx,.txt,.md,.csv" className="hidden" onChange={(e) => subir(e.target.files)} />
      <div className="flex items-center gap-2">
        <Boton type="button" variante="secundario" tamano="sm" icono={Paperclip} onClick={() => entrada.current?.click()} disabled={deshabilitado || lleno}>
          Adjuntar archivo
        </Boton>
        <span className="text-[11px] text-tenue">
          {valor.length} de {MAX} · PDF, Word o texto
        </span>
      </div>
    </div>
  );
}
