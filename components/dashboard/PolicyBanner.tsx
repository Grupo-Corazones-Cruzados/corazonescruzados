'use client';

import { useEffect, useState } from 'react';
import { usePolicyEffects, type PolicyDetailDoc } from '@/components/providers/PolicyEffectsProvider';
import PolicyDetailViewer from '@/components/dashboard/PolicyDetailViewer';
import { Megaphone, ChevronUp, ChevronDown, CalendarDays, FileText } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;
const STORAGE_KEY = 'gcc_policy_msg_hidden';

// Fecha corta es-ES (p. ej. "8 jul 2026"), sin texto extra.
function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Header FLOTANTE del dashboard con las POLÍTICAS ACTIVAS de Comandos Violeta. Cuando hay
 * varias, se navegan con PESTAÑAS (una por política) y solo se muestra el contenido de la
 * seleccionada → cada política se distingue con claridad y el layout queda limpio. Está
 * FIJO arriba, NO reserva espacio, se oculta con ↑ / se reabre con ↓. Movimiento sutil.
 */
export default function PolicyBanner({ collapsed = false }: { collapsed?: boolean }) {
  const { policies } = usePolicyEffects();
  const [open, setOpen] = useState(true);
  const [idx, setIdx] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const [viewer, setViewer] = useState<{ detail: PolicyDetailDoc; policyName: string } | null>(null);

  useEffect(() => { try { setOpen(localStorage.getItem(STORAGE_KEY) !== '1'); } catch {} }, []);
  useEffect(() => { setListOpen(false); }, [idx]);
  // Mantiene el índice válido si cambia la lista (una política se desactiva, etc.).
  useEffect(() => { if (idx > policies.length - 1) setIdx(Math.max(0, policies.length - 1)); }, [policies.length, idx]);

  const persist = (v: boolean) => { setOpen(v); try { localStorage.setItem(STORAGE_KEY, v ? '0' : '1'); } catch {} };

  if (!policies.length) return null;
  const multi = policies.length > 1;
  const p = policies[Math.min(idx, policies.length - 1)];
  const date = fmtDate(p.activatedAt);
  const openDetail = (d: PolicyDetailDoc) => { setViewer({ detail: d, policyName: p.name }); setListOpen(false); };

  return (
    <>
      <style>{`
        @keyframes gccPolFloat {0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
        @keyframes gccPolIn {from{opacity:0;transform:translateY(-14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes gccPolBob {0%,100%{transform:translateY(0)}50%{transform:translateY(3px)}}
      `}</style>

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
            {/* Cabecera: megáfono + pestañas de políticas (si hay varias) + ocultar */}
            <div className="flex items-center gap-2 px-3 pt-2">
              <Megaphone className="w-[18px] h-[18px] shrink-0 text-white/90" />
              {multi ? (
                <div className="flex items-center gap-1.5 overflow-x-auto min-w-0 flex-1 no-scrollbar py-0.5">
                  {policies.map((pol, i) => {
                    const on = i === idx;
                    return (
                      <button key={pol.id} onClick={() => setIdx(i)}
                        className={`shrink-0 max-w-[180px] inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11.5px] font-semibold truncate border transition-colors ${on ? 'bg-white text-[#4c1d95] border-white shadow-sm' : 'bg-white/5 text-white/75 border-white/25 hover:bg-white/15 hover:text-white'}`}
                        style={mf} title={pol.name}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${on ? 'bg-[#6d28d9]' : 'bg-white/40'}`} />
                        <span className="truncate">{pol.name}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <span className="min-w-0 flex-1 text-[11px] font-bold uppercase tracking-wide text-white/75 truncate" style={df} title={p.name}>{p.name}</span>
              )}
              <button onClick={() => persist(false)} title="Ocultar aviso" aria-label="Ocultar aviso"
                className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/20 transition-colors">
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>

            {/* Contenido de la política seleccionada */}
            <div className="px-3 pb-2.5 pt-1.5 pl-[38px]">
              {date && (
                <span className="inline-flex items-center gap-1 text-[10px] text-white/50 mb-1" style={mf}>
                  <CalendarDays className="w-2.5 h-2.5" /> {date}
                </span>
              )}

              {p.messages.map((m, i) => (
                <p key={i} className="text-[13px] font-medium leading-snug break-words" style={mf}>{m}</p>
              ))}

              {p.details.length === 1 && (
                <button onClick={() => openDetail(p.details[0])}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-white/12 hover:bg-white/22 border border-white/15 px-2 py-1 text-[11.5px] font-medium text-white transition-colors" style={mf}>
                  <FileText className="w-3.5 h-3.5" /> Ver detalle: {p.details[0].title}
                </button>
              )}

              {p.details.length > 1 && (
                <div className="relative mt-2 inline-block">
                  <button onClick={() => setListOpen((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-white/12 hover:bg-white/22 border border-white/15 px-2 py-1 text-[11.5px] font-medium text-white transition-colors" style={mf}>
                    <FileText className="w-3.5 h-3.5" /> Detalles ({p.details.length}) <ChevronDown className={`w-3 h-3 transition-transform ${listOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {listOpen && (
                    <div className="absolute left-0 top-full mt-1 z-10 w-64 max-w-[75vw] rounded-lg border border-digi-border bg-digi-card shadow-xl overflow-hidden">
                      <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-digi-muted border-b border-digi-border" style={df}>Documentos de la política</p>
                      <div className="max-h-60 overflow-y-auto divide-y divide-digi-border/60">
                        {p.details.map((d) => (
                          <button key={d.id} onClick={() => openDetail(d)}
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
          </div>
        ) : (
          <button onClick={() => persist(true)} title="Mostrar aviso" aria-label="Mostrar aviso"
            className="pointer-events-auto flex items-center gap-1 pl-2.5 pr-2 h-7 rounded-b-lg text-white text-[11px] font-semibold border border-t-0 border-white/20 shadow-md"
            style={{ background: 'linear-gradient(180deg,#6d28d9,#5b21b6)', animation: 'gccPolBob 1.8s ease-in-out infinite' }}>
            <Megaphone className="w-3.5 h-3.5" /> {policies.length > 1 ? <span>{policies.length}</span> : null} <ChevronDown className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <PolicyDetailViewer open={!!viewer} detail={viewer?.detail || null} policyName={viewer?.policyName} onClose={() => setViewer(null)} />
    </>
  );
}
