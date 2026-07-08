'use client';

import { useEffect, useState } from 'react';
import { usePolicyEffects } from '@/components/providers/PolicyEffectsProvider';
import { Megaphone, ChevronUp, ChevronDown, CalendarDays } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const STORAGE_KEY = 'gcc_policy_msg_hidden';

// Fecha de activación de la política en formato es-ES (p. ej. "8 de julio de 2026").
function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Header FLOTANTE del dashboard con los mensajes de las políticas ACTIVAS de Comandos
 * Violeta. Está FIJO en la parte superior y NO reserva espacio (no desplaza el
 * contenido). Se puede ocultar con la flecha ↑; queda una pestañita con flecha ↓ para
 * volver a mostrarlo. Tiene una animación sutil ("con vida"). Solo se monta dentro de
 * /dashboard/ (va en el layout del dashboard).
 */
export default function PolicyBanner({ collapsed = false }: { collapsed?: boolean }) {
  const { messages } = usePolicyEffects();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try { setOpen(localStorage.getItem(STORAGE_KEY) !== '1'); } catch {}
  }, []);
  const persist = (v: boolean) => {
    setOpen(v);
    try { localStorage.setItem(STORAGE_KEY, v ? '0' : '1'); } catch {}
  };

  if (!messages.length) return null;

  return (
    <>
      <style>{`
        @keyframes gccPolFloat {0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes gccPolIn {from{opacity:0;transform:translateY(-18px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes gccPolBob {0%,100%{transform:translateY(0)}50%{transform:translateY(4px)}}
        @keyframes gccPolGlow {0%,100%{box-shadow:0 8px 26px -8px rgba(139,92,246,.5)}50%{box-shadow:0 14px 42px -6px rgba(168,85,247,.85)}}
        @keyframes gccPolWiggle {0%,88%,100%{transform:rotate(0)}92%{transform:rotate(-16deg)}96%{transform:rotate(14deg)}}
        @keyframes gccPolShine {0%{background-position:-140% 0}60%,100%{background-position:240% 0}}
      `}</style>

      {/* Franja fija: pointer-events none salvo el card/pestaña, para no bloquear la UI */}
      <div className={`fixed top-0 left-0 right-0 ${collapsed ? 'lg:left-16' : 'lg:left-56'} z-[60] flex justify-center px-3 pt-2 pointer-events-none transition-[left] duration-200`}>
        {open ? (
          <div
            className="pointer-events-auto relative overflow-hidden max-w-2xl w-full flex items-start gap-3 rounded-xl px-4 py-2.5 border border-white/25 text-white"
            style={{
              background: 'linear-gradient(100deg,#4c1d95,#5b21b6 50%,#6d28d9)',
              animation: 'gccPolIn .4s ease-out, gccPolFloat 3.6s ease-in-out .4s infinite, gccPolGlow 3.6s ease-in-out .4s infinite',
            }}
          >
            {/* Brillo que recorre el banner (destello de "vida") */}
            <span aria-hidden className="absolute inset-0 pointer-events-none" style={{
              background: 'linear-gradient(105deg,transparent 30%,rgba(255,255,255,.28) 50%,transparent 70%)',
              backgroundSize: '220% 100%',
              animation: 'gccPolShine 4.5s ease-in-out infinite',
            }} />
            <span className="relative mt-0.5 shrink-0" style={{ animation: 'gccPolWiggle 3.2s ease-in-out infinite', transformOrigin: '50% 60%' }}>
              <Megaphone className="w-[18px] h-[18px]" />
            </span>
            <div className="relative min-w-0 flex-1 space-y-1.5">
              {messages.map((m, i) => {
                const date = fmtDate(m.activatedAt);
                return (
                  <div key={i}>
                    <p className="text-[13px] font-medium leading-snug break-words" style={mf}>{m.text}</p>
                    {date && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10.5px] font-semibold text-white/95" style={mf}>
                        <CalendarDays className="w-3 h-3" /> Activa desde el {date}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={() => persist(false)} title="Ocultar aviso" aria-label="Ocultar aviso"
              className="relative shrink-0 -mr-1 w-6 h-6 rounded-md flex items-center justify-center hover:bg-white/25 transition-colors">
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button onClick={() => persist(true)} title="Mostrar aviso" aria-label="Mostrar aviso"
            className="pointer-events-auto flex items-center gap-1 pl-2.5 pr-2 h-7 rounded-b-lg text-white text-[11px] font-semibold border border-t-0 border-white/25 shadow-md"
            style={{ background: 'linear-gradient(180deg,#6d28d9,#5b21b6)', animation: 'gccPolBob 1.6s ease-in-out infinite' }}>
            <Megaphone className="w-3.5 h-3.5" /> <ChevronDown className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </>
  );
}
