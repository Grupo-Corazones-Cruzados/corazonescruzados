'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, ChevronRight, FileText, Globe, ImageIcon, ListChecks, Paperclip, Pencil, Search, Sparkles, Terminal, Wrench } from 'lucide-react';
import MarkdownRenderer from '@/components/shared/MarkdownRenderer';
import type { Bloque, Mensaje } from './api';

const ICONOS: Record<string, typeof Wrench> = {
  Bash: Terminal, Read: FileText, Write: Pencil, Edit: Pencil, MultiEdit: Pencil, Grep: Search, Glob: Search,
  WebFetch: Globe, WebSearch: Globe, TodoWrite: ListChecks, Skill: Sparkles, Agent: Sparkles, Task: Sparkles,
};

/** Lo esencial de cada herramienta, en una línea. */
function resumen(nombre: string, e: any): string {
  if (!e) return '';
  return e.description || e.command || e.file_path || e.notebook_path || e.pattern || e.query || e.url || e.skill || e.prompt || e.subject || '';
}

const EDITAN = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);

/** No se bloquea: el acceso es completo por decisión de Fernando. Pero una edición fuera se ve. */
function editaFuera(b: Extract<Bloque, { tipo: 'herramienta' }>, carpeta: string): boolean {
  const ruta = String(b.entrada?.file_path || b.entrada?.notebook_path || '');
  if (!EDITAN.has(b.nombre) || !ruta.startsWith('/')) return false;
  if (ruta === carpeta || ruta.startsWith(`${carpeta}/`)) return false;
  return !/^\/(private\/)?tmp\/|\/\.claude\//.test(ruta);
}

function Herramienta({ b, resultado, carpeta, pasos = [] }: { b: Extract<Bloque, { tipo: 'herramienta' }>; resultado?: Extract<Bloque, { tipo: 'resultado' }>; carpeta: string; pasos?: Mensaje[] }) {
  const [abierto, setAbierto] = useState(false);
  const Icono = ICONOS[b.nombre] || Wrench;
  const linea = String(resumen(b.nombre, b.entrada)).split('\n')[0];
  const llamadas = pasos.flatMap((m) => m.bloques).filter((x): x is Extract<Bloque, { tipo: 'herramienta' }> => x.tipo === 'herramienta');
  const entrada = b.entrada?.command || b.entrada?.new_string || b.entrada?.content || JSON.stringify(b.entrada, null, 2);
  return (
    <div className="min-w-0">
      <button type="button" onClick={() => setAbierto(!abierto)} aria-expanded={abierto}
        className="w-full min-h-7 flex items-center gap-2 text-left rounded px-1 -mx-1 text-[12.5px] text-digi-muted hover:text-digi-text hover:bg-black/[0.03] transition-colors">
        <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform ${abierto ? 'rotate-90' : ''}`} />
        <Icono className="w-3.5 h-3.5 shrink-0" />
        <span className="font-medium shrink-0">{b.nombre}</span>
        <span className="truncate min-w-0 font-mono text-[11.5px]" title={linea}>{linea}</span>
        {editaFuera(b, carpeta) && <span className="shrink-0 text-[11px] font-medium text-amber-400">Otro proyecto</span>}
        {llamadas.length > 0 && <span className="shrink-0 text-[11px] tabular-nums text-accent">{llamadas.length} pasos</span>}
        {resultado?.error && <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" aria-label="Falló" />}
      </button>
      {abierto && (
        <div className="mt-1 mb-2 ml-5 rounded-md border border-digi-border overflow-hidden text-[11.5px] font-mono">
          <pre className="p-2.5 whitespace-pre-wrap break-words max-h-64 overflow-y-auto bg-digi-darker text-digi-text">{String(entrada)}</pre>
          {llamadas.length > 0 && (
            <ul className="p-2.5 border-t border-digi-border space-y-1 max-h-64 overflow-y-auto text-digi-muted">
              {llamadas.map((x) => <li key={x.id} className="truncate" title={String(resumen(x.nombre, x.entrada))}><span className="font-medium">{x.nombre}</span> {String(resumen(x.nombre, x.entrada)).split('\n')[0]}</li>)}
            </ul>
          )}
          {resultado && <pre className={`p-2.5 border-t border-digi-border whitespace-pre-wrap break-words max-h-80 overflow-y-auto ${resultado.error ? 'text-red-400' : 'text-digi-muted'}`}>{resultado.texto || '(sin salida)'}</pre>}
        </div>
      )}
    </div>
  );
}

function Pensamiento({ texto }: { texto: string }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setAbierto(!abierto)} className="min-h-7 flex items-center gap-2 text-[12.5px] italic text-digi-muted hover:text-digi-text">
        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${abierto ? 'rotate-90' : ''}`} /> Razonamiento
      </button>
      {abierto && <p className="ml-5 mb-2 text-[12.5px] italic text-digi-muted whitespace-pre-wrap">{texto}</p>}
    </div>
  );
}

export default function ListaMensajes({ mensajes, parcial, hijos, carpeta }: { mensajes: Mensaje[]; parcial: string; hijos: Record<string, Mensaje[]>; carpeta: string }) {
  const resultados = useMemo(() => {
    const m = new Map<string, Extract<Bloque, { tipo: 'resultado' }>>();
    for (const x of mensajes) for (const b of x.bloques) if (b.tipo === 'resultado') m.set(b.id, b);
    return m;
  }, [mensajes]);

  return (
    <div className="space-y-2 min-w-0">
      {mensajes.map((m) => {
        const visibles = m.bloques.filter((b) => b.tipo !== 'resultado');
        if (!visibles.length) return null;
        if (m.rol === 'user') {
          return (
            <div key={m.uuid} className="flex justify-end pt-2">
              <div className="max-w-[85%] rounded-lg bg-accent-light text-digi-text px-3 py-2 text-[13.5px] min-w-0">
                {visibles.map((b, i) => b.tipo === 'imagen'
                  ? <span key={i} className="flex items-center gap-1.5 text-[12px] text-digi-muted"><ImageIcon className="w-3.5 h-3.5" /> Imagen</span>
                  : b.tipo === 'adjunto'
                    ? <span key={i} className="flex items-center gap-1.5 text-[12px] text-digi-muted min-w-0"><Paperclip className="w-3.5 h-3.5 shrink-0" /><span className="truncate" title={b.nombre}>{b.nombre}</span></span>
                    : b.tipo === 'texto' ? <p key={i} className="whitespace-pre-wrap break-words">{b.texto}</p> : null)}
              </div>
            </div>
          );
        }
        return (
          <div key={m.uuid} className="min-w-0 space-y-1">
            {visibles.map((b, i) => {
              if (b.tipo === 'texto') return <div key={i} className="espacio-md text-[13.5px] text-digi-text break-words min-w-0"><MarkdownRenderer content={b.texto} /></div>;
              if (b.tipo === 'pensando') return <Pensamiento key={i} texto={b.texto} />;
              if (b.tipo === 'herramienta') return <Herramienta key={i} b={b} resultado={resultados.get(b.id)} carpeta={carpeta} pasos={hijos[b.id]} />;
              return null;
            })}
          </div>
        );
      })}
      {parcial && <div className="espacio-md text-[13.5px] text-digi-text break-words min-w-0"><MarkdownRenderer content={parcial} /></div>}
    </div>
  );
}
