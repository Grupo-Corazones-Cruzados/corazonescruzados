'use client';

import { useEffect, useState } from 'react';
import { usePolicyEffects, type ActivePolicy, type PolicyDetailDoc } from '@/components/providers/PolicyEffectsProvider';
import PolicyDetailViewer from '@/components/dashboard/PolicyDetailViewer';
import { Megaphone, ChevronUp, ChevronDown, CalendarDays, FileText } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;
const STORAGE_KEY = 'gcc_policy_msg_hidden';

// Fecha de activación de la política en formato es-ES (p. ej. "8 de julio de 2026").
function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Header FLOTANTE del dashboard con las POLÍTICAS ACTIVAS de Comandos Violeta. Cada
 * política es una sección de la misma burbuja (nombre, fecha de activación, mensajes y
 * enlace(s) a su detalle/términos). Está FIJO arriba y NO reserva espacio (no desplaza el
 * contenido). Se oculta con ↑ y se reabre con la pestañita ↓. Movimiento sutil y serio.
 * Los documentos de detalle se leen en una ventana flotante movible/redimensionable.
 */
export default function PolicyBanner({ collapsed = false }: { collapsed?: boolean }) {
  const { policies } = usePolicyEffects();
  const [open, setOpen] = useState(true);
  const [viewer, setViewer] = useState<{ detail: PolicyDetailDoc; policyName: string } | null>(null);
  const [listFor, setListFor] = useState<number | null>(null); // política cuyo listado de detalles está desplegado

  useEffect(() => {
    try { setOpen(localStorage.getItem(STORAGE_KEY) !== '1'); } catch {}
  }, []);
  const persist = (v: boolean) => {
    setOpen(v);
    try { localStorage.setItem(STORAGE_KEY, v ? '0' : '1'); } catch {}
  };

  if (!policies.length) return null;

  const openDetail = (detail: PolicyDetailDoc, policyName: string) => { setViewer({ detail, policyName }); setListFor(null); };

  return (
    <>
      <style>{`
        @keyframes gccPolFloat {0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
        @keyframes gccPolIn {from{opacity:0;transform:translateY(-14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes gccPolBob {0%,100%{transform:translateY(0)}50%{transform:translateY(3px)}}
      `}</style>

      {/* Franja fija: pointer-events none salvo el card/pestaña */}
      <div className={`fixed top-0 left-0 right-0 ${collapsed ? 'lg:left-16' : 'lg:left-56'} z-[60] flex justify-center px-3 pt-2 pointer-events-none transition-[left] duration-200`}>
        {open ? (
          <div
            className="pointer-events-auto max-w-2xl w-full rounded-xl border border-white/15 text-white"
            style={{
              background: 'linear-gradient(100deg,#4c1d95,#5b21b6 55%,#6d28d9)',
              boxShadow: '0 10px 34px -10px rgba(76,29,149,.7)',
              animation: 'gccPolIn .35s ease-out, gccPolFloat 5s ease-in-out .35s infinite',
            }}
          >
            <div className="flex items-start gap-2 px-4 py-2.5">
              <Megaphone className="w-[18px] h-[18px] mt-0.5 shrink-0 text-white/90" />
              <div className="min-w-0 flex-1 divide-y divide-white/12">
                {policies.map((p) => (
                  <PolicySection key={p.id} p={p} listOpen={listFor === p.id} onToggleList={() => setListFor((v) => (v === p.id ? null : p.id))} onOpenDetail={openDetail} />
                ))}
              </div>
              <button onClick={() => persist(false)} title="Ocultar aviso" aria-label="Ocultar aviso"
                className="shrink-0 -mr-1 w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/20 transition-colors">
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => persist(true)} title="Mostrar aviso" aria-label="Mostrar aviso"
            className="pointer-events-auto flex items-center gap-1 pl-2.5 pr-2 h-7 rounded-b-lg text-white text-[11px] font-semibold border border-t-0 border-white/20 shadow-md"
            style={{ background: 'linear-gradient(180deg,#6d28d9,#5b21b6)', animation: 'gccPolBob 1.8s ease-in-out infinite' }}>
            <Megaphone className="w-3.5 h-3.5" /> <ChevronDown className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <PolicyDetailViewer open={!!viewer} detail={viewer?.detail || null} policyName={viewer?.policyName} onClose={() => setViewer(null)} />
    </>
  );
}

/** Sección de una política activa dentro de la burbuja. */
function PolicySection({
  p, listOpen, onToggleList, onOpenDetail,
}: {
  p: ActivePolicy;
  listOpen: boolean;
  onToggleList: () => void;
  onOpenDetail: (d: PolicyDetailDoc, policyName: string) => void;
}) {
  const date = fmtDate(p.activatedAt);
  return (
    <div className="py-2 first:pt-0 last:pb-0">
      <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-white/60" style={df}>{p.name}</span>
        {date && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-1.5 py-0.5 text-[9.5px] font-semibold text-white/90" style={mf}>
            <CalendarDays className="w-2.5 h-2.5" /> Activa desde el {date}
          </span>
        )}
      </div>

      {p.messages.map((m, i) => (
        <p key={i} className="text-[13px] font-medium leading-snug break-words mt-1" style={mf}>{m}</p>
      ))}

      {/* Detalle(s) de la política */}
      {p.details.length === 1 && (
        <button onClick={() => onOpenDetail(p.details[0], p.name)}
          className="mt-1.5 inline-flex items-center gap-1.5 rounded-md bg-white/12 hover:bg-white/22 border border-white/15 px-2 py-1 text-[11.5px] font-medium text-white transition-colors" style={mf}>
          <FileText className="w-3.5 h-3.5" /> Ver detalle: {p.details[0].title}
        </button>
      )}

      {p.details.length > 1 && (
        <div className="relative mt-1.5 inline-block">
          <button onClick={onToggleList}
            className="inline-flex items-center gap-1.5 rounded-md bg-white/12 hover:bg-white/22 border border-white/15 px-2 py-1 text-[11.5px] font-medium text-white transition-colors" style={mf}>
            <FileText className="w-3.5 h-3.5" /> Detalles ({p.details.length}) <ChevronDown className={`w-3 h-3 transition-transform ${listOpen ? 'rotate-180' : ''}`} />
          </button>
          {listOpen && (
            <div className="absolute left-0 top-full mt-1 z-10 w-64 max-w-[75vw] rounded-lg border border-digi-border bg-digi-card shadow-xl overflow-hidden">
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-digi-muted border-b border-digi-border" style={df}>Documentos de la política</p>
              <div className="max-h-60 overflow-y-auto divide-y divide-digi-border/60">
                {p.details.map((d) => (
                  <button key={d.id} onClick={() => onOpenDetail(d, p.name)}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-black/[0.03] transition-colors" style={mf}>
                    <FileText className="w-3.5 h-3.5 shrink-0 text-accent" />
                    <span className="text-[12.5px] text-digi-text truncate">{d.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
