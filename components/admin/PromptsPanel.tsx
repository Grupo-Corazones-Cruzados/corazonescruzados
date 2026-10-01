'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { FileText, FolderKanban, Search } from 'lucide-react';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelSelect from '@/components/ui/PixelSelect';
import { PROJECT_STATUS_LABEL, PROJECT_STATUS_VARIANT } from '@/lib/projects/estados';
import type { DocumentoEditorHandle } from '@/components/admin/prompts/DocumentoEditor';

// El editor (TipTap + ProseMirror) solo hace falta en esta pestaña: no entra en el
// paquete del resto del admin.
const DocumentoEditor = dynamic(() => import('@/components/admin/prompts/DocumentoEditor'), { ssr: false });

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;
const INPUT = 'w-full h-[34px] px-2.5 py-0 bg-digi-darker border border-digi-border rounded-md text-[13px] text-digi-text placeholder-digi-muted focus:outline-none';

/** Orden de los estados en el filtro: primero lo que se trabaja, al final lo cerrado. */
const ORDEN = ['in_progress', 'review', 'in_review', 'cotizacion', 'open', 'draft', 'completed', 'closed', 'cotizacion_rechazada', 'cancelled'];
const ULTIMO_KEY = 'admin.prompts.proyecto';

interface Proyecto {
  id: number; title: string; status: string; client: string | null; chars: number; updatedAt: string | null;
}
interface Doc {
  projectId: number; title: string; status: string; html: string; chars: number; updatedAt: string | null;
}

/**
 * Admin ▸ «Prompts» (Fernando, 2026-10-01): a la izquierda los proyectos del módulo
 * Proyectos; a la derecha, la hoja donde se escribe su documentación «como en Word». Lo
 * escrito sale también como Markdown para dárselo a una IA («Copiar como prompt»).
 *
 * El alto lo mide igual que Listas y Fuentes: hasta la barra de ruta fija del dashboard.
 */
export default function PromptsPanel() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();
  const [proyectos, setProyectos] = useState<Proyecto[] | null>(null);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('all');
  const [sel, setSel] = useState<number | null>(null);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [cargando, setCargando] = useState(false);
  const [version, setVersion] = useState(0);
  const editorRef = useRef<DocumentoEditorHandle>(null);

  useEffect(() => {
    const compute = () => {
      const el = boxRef.current;
      if (!el) return;
      const bar = document.querySelector('nav[aria-label="Ruta"]');
      const barH = bar ? bar.getBoundingClientRect().height : 0;
      const h = Math.max(window.innerHeight - el.getBoundingClientRect().top - barH - 12, 420);
      setHeight((prev) => (prev === undefined || Math.abs(prev - h) > 1 ? h : prev));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  useEffect(() => {
    fetch('/api/admin/prompts')
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'No se pudieron cargar los proyectos.');
        const lista: Proyecto[] = j.data;
        setProyectos(lista);
        let ultimo: number | null = null;
        try { ultimo = Number(localStorage.getItem(ULTIMO_KEY)) || null; } catch { /* sin almacenamiento */ }
        setSel((s) => s ?? (lista.find((p) => p.id === ultimo)?.id ?? lista[0]?.id ?? null));
      })
      .catch((e) => { toast.error(e.message); setProyectos([]); });
  }, []);

  useEffect(() => {
    if (sel === null) return;
    let vivo = true;
    setCargando(true);
    fetch(`/api/admin/prompts/${sel}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'No se pudo cargar el documento.');
        if (vivo) setDoc(j.data);
      })
      .catch((e) => { if (vivo) { toast.error(e.message); setDoc(null); } })
      .finally(() => { if (vivo) setCargando(false); });
    try { localStorage.setItem(ULTIMO_KEY, String(sel)); } catch { /* sin almacenamiento */ }
    return () => { vivo = false; };
  }, [sel, version]);

  // Antes de cambiar de proyecto se guarda lo pendiente del que se deja.
  const elegir = async (id: number) => {
    if (id === sel) return;
    if (editorRef.current && !(await editorRef.current.flush())) {
      toast.error('El documento tiene cambios sin guardar. Resuélvelo abajo antes de cambiar de proyecto.');
      return;
    }
    setSel(id);
  };

  const onSaved = useCallback((chars: number, updatedAt: string) => {
    setProyectos((ps) => ps?.map((p) => (p.id === sel ? { ...p, chars, updatedAt } : p)) ?? ps);
  }, [sel]);

  // Las opciones del filtro: solo los estados que tienen proyectos, con su conteo.
  const estados = useMemo(() => {
    const cuenta = new Map<string, number>();
    for (const p of proyectos ?? []) cuenta.set(p.status, (cuenta.get(p.status) ?? 0) + 1);
    const rango = (s: string) => { const i = ORDEN.indexOf(s); return i === -1 ? ORDEN.length : i; };
    return [...cuenta.entries()].sort((x, y) => rango(x[0]) - rango(y[0]));
  }, [proyectos]);

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (proyectos ?? []).filter((p) =>
      (estado === 'all' || p.status === estado)
      && (!t || p.title.toLowerCase().includes(t) || (p.client ?? '').toLowerCase().includes(t)));
  }, [proyectos, q, estado]);

  const actual = proyectos?.find((p) => p.id === sel) ?? null;

  return (
    <div ref={boxRef} style={{ height }} className="flex flex-col lg:flex-row gap-4">
      {/* ── Proyectos ── */}
      <aside className="w-full lg:w-[280px] shrink-0 max-h-[40vh] lg:max-h-none bg-digi-card border border-digi-border rounded-xl flex flex-col overflow-hidden">
        <div className="px-3 py-2.5 border-b border-digi-border flex items-center gap-1.5">
          <FolderKanban className="w-4 h-4 text-accent" />
          <span className="text-[12px] font-semibold text-digi-text flex-1" style={df}>Proyectos</span>
          {proyectos && <span className="text-[10.5px] text-digi-muted tabular-nums" style={mf}>{visibles.length}</span>}
        </div>
        <div className="px-2 py-2 border-b border-digi-border space-y-2">
          <PixelSelect
            aria-label="Estado del proyecto"
            className="h-[34px] !py-0 !px-2.5 !text-[13px]"
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            options={[
              { value: 'all', label: `Todos los estados (${proyectos?.length ?? 0})` },
              ...estados.map(([s, n]) => ({ value: s, label: `${PROJECT_STATUS_LABEL[s] ?? s} (${n})` })),
            ]}
          />
          <div className="relative">
            <Search className="w-4 h-4 text-digi-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input className={`${INPUT} pl-8`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar proyecto o cliente…" />
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-1.5">
          {proyectos === null ? (
            <p className="text-[12px] text-digi-muted text-center py-8" style={mf}>Cargando…</p>
          ) : visibles.length === 0 ? (
            <p className="text-[12px] text-digi-muted text-center py-8" style={mf}>{q || estado !== 'all' ? 'Sin coincidencias.' : 'No hay proyectos.'}</p>
          ) : (
            <div className="space-y-0.5">
              {visibles.map((p) => {
                const activo = p.id === sel;
                return (
                  <button
                    key={p.id}
                    onClick={() => void elegir(p.id)}
                    className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left border transition-colors ${
                      activo ? 'bg-accent-light border-accent/30' : 'border-transparent hover:bg-black/[0.03]'
                    }`}
                  >
                    <span className="flex-1 min-w-0">
                      <span className={`block text-[12.5px] font-medium truncate ${activo ? 'text-accent' : 'text-digi-text'}`} style={mf}>{p.title}</span>
                      {p.client && <span className="block text-[11px] text-digi-muted truncate" style={mf}>{p.client}</span>}
                    </span>
                    {p.chars > 0 && (
                      <FileText
                        className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${activo ? 'text-accent' : 'text-digi-muted'}`}
                        aria-label="Tiene documentación"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* ── La hoja ── */}
      <section className="flex-1 min-w-0 min-h-[60vh] lg:min-h-0 bg-digi-card border border-digi-border rounded-xl flex flex-col overflow-hidden">
        {sel === null || (!doc && !cargando) ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[13px] text-digi-muted" style={mf}>
              {proyectos && proyectos.length === 0 ? 'No hay proyectos.' : 'Selecciona un proyecto.'}
            </p>
          </div>
        ) : (
          <>
            <div className="shrink-0 px-4 py-2.5 border-b border-digi-border flex items-center gap-2 min-w-0">
              <span className="text-[14px] font-semibold text-digi-text truncate" style={df}>
                {doc?.title ?? actual?.title}
              </span>
              {(doc?.status ?? actual?.status) && (
                <PixelBadge variant={PROJECT_STATUS_VARIANT[(doc?.status ?? actual?.status)!] || 'default'}>
                  {PROJECT_STATUS_LABEL[(doc?.status ?? actual?.status)!] ?? doc?.status ?? actual?.status}
                </PixelBadge>
              )}
              {actual?.client && <span className="text-[12px] text-digi-muted truncate hidden sm:inline" style={mf}>{actual.client}</span>}
            </div>
            {cargando || !doc || doc.projectId !== sel ? (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-[12px] text-digi-muted" style={mf}>Cargando…</p>
              </div>
            ) : (
              <DocumentoEditor
                key={`${doc.projectId}-${version}`}
                ref={editorRef}
                projectId={doc.projectId}
                title={doc.title}
                initialHtml={doc.html}
                initialUpdatedAt={doc.updatedAt}
                onSaved={onSaved}
                onReload={() => setVersion((v) => v + 1)}
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}
