'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Target, Sparkles, Check, X, ChevronDown } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

interface Assignee {
  member_id: string;
  name: string;
  role: string;
  prospeccion: { net: number; pos: number; neg: number };
  top_talents: string[];
}

/**
 * Buscador de ASIGNADOS para "Solicitar ticket/proyecto": lista candidatos/miembros/admin
 * con su ROL, PROSPECCIÓN (neto) y TOP 5 de TALENTOS (de `/api/tickets/assignees`).
 *
 * El control es un botón compacto (muestra el seleccionado). Al abrir, la lista se despliega
 * como un FLYOUT flotante (portal, position:fixed) ANCLADO A LA IZQUIERDA del control, ocupando
 * toda la altura disponible y con el ancho justo para su contenido (estilo Microsoft). Si no
 * hay espacio a la izquierda, cae debajo del control.
 */
export default function AssigneePicker({
  value, onChange, disabled = false,
}: {
  value: string;
  onChange: (memberId: string) => void;
  disabled?: boolean;
}) {
  const [list, setList] = useState<Assignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/tickets/assignees').then((r) => r.json()).then((d) => { if (alive) setList(d.data || []); })
      .catch(() => { if (alive) setList([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const measure = () => { if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect()); };
  useLayoutEffect(() => { if (open) measure(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const onScroll = () => measure();
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => { window.removeEventListener('resize', onScroll); window.removeEventListener('scroll', onScroll, true); };
  }, [open]);

  // Cerrar al hacer clic fuera (trigger + flyout).
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || flyoutRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((a) =>
      a.name.toLowerCase().includes(s) ||
      a.role.toLowerCase().includes(s) ||
      a.top_talents.some((t) => t.toLowerCase().includes(s)),
    );
  }, [list, q]);

  const selected = list.find((a) => a.member_id === value) || null;

  const roleColor = (role: string) =>
    role === 'Admin' ? 'text-amber-600 bg-amber-500/10 border-amber-400/30'
      : role === 'Candidato' ? 'text-violet-500 bg-violet-500/10 border-violet-400/30'
      : 'text-sky-600 bg-sky-500/10 border-sky-400/30';

  // Posición del flyout: a la izquierda del control (altura completa) si cabe; si no, debajo.
  const enoughLeft = !!rect && rect.left >= 340;
  const flyoutStyle: React.CSSProperties = rect
    ? enoughLeft
      ? { position: 'fixed', top: 12, bottom: 12, right: Math.round(window.innerWidth - rect.left + 8), width: 'max-content', minWidth: 300, maxWidth: 460, zIndex: 70 }
      : { position: 'fixed', top: Math.round(rect.bottom + 6), left: Math.round(rect.left), width: Math.round(rect.width), maxHeight: '50vh', zIndex: 70 }
    : { display: 'none' };

  return (
    <div className={disabled ? 'opacity-50 pointer-events-none' : ''}>
      {/* Control (trigger) */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 rounded-lg border border-digi-border bg-digi-darker px-3 py-2 text-left hover:border-accent/50 focus:outline-none transition-colors"
        style={{ ...mf, boxShadow: 'none' }}
      >
        {selected ? (
          <>
            <span className="flex-1 min-w-0 text-[13px] font-medium text-digi-text truncate">{selected.name}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 ${roleColor(selected.role)}`}>{selected.role}</span>
            <span role="button" tabIndex={-1} onClick={(e) => { e.stopPropagation(); onChange(''); }} title="Quitar selección" className="text-digi-muted hover:text-digi-text shrink-0">
              <X className="w-3.5 h-3.5" />
            </span>
          </>
        ) : (
          <span className="flex-1 text-[13px] text-digi-muted/70 truncate">Seleccionar miembro…</span>
        )}
        <ChevronDown className={`w-4 h-4 text-digi-muted shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Flyout (portal). Si el picker vive dentro de un <dialog> (PixelModal, top layer),
          se porta AL dialog para quedar por ENCIMA del overlay; si no, a document.body. */}
      {open && typeof document !== 'undefined' && createPortal(
        <div ref={flyoutRef} style={flyoutStyle} className="flex flex-col rounded-lg border border-digi-border bg-digi-card shadow-2xl overflow-hidden">
          <div className="p-2 border-b border-digi-border shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 text-digi-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nombre, rol o talento…"
                className="w-full pl-8 pr-3 py-2 bg-digi-darker rounded-md text-[13px] text-digi-text placeholder:text-digi-muted/50 focus:outline-none"
                style={{ ...mf, border: '1px solid var(--color-digi-border)', boxShadow: 'none' }}
              />
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-digi-border/50">
            {loading ? (
              <p className="px-3 py-4 text-[12px] text-digi-muted text-center" style={mf}>Cargando…</p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-4 text-[12px] text-digi-muted text-center" style={mf}>Sin resultados.</p>
            ) : (
              filtered.map((a) => {
                const active = value === a.member_id;
                const net = a.prospeccion.net;
                return (
                  <button key={a.member_id} type="button"
                    onClick={() => { onChange(active ? '' : a.member_id); setOpen(false); }}
                    className={`w-full text-left px-3 py-2 flex items-start gap-2 transition-colors ${active ? 'bg-accent-light' : 'hover:bg-black/[0.03]'}`}>
                    <div className={`w-4 h-4 mt-0.5 shrink-0 rounded border flex items-center justify-center ${active ? 'bg-accent border-accent text-white' : 'border-digi-border'}`}>
                      {active && <Check className="w-3 h-3" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="flex-1 min-w-0 text-[12.5px] font-medium text-digi-text truncate" style={mf}>{a.name}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${roleColor(a.role)}`} style={mf}>{a.role}</span>
                          <span className="inline-flex items-center gap-1 text-[10.5px] text-digi-muted tabular-nums w-9 justify-end" style={mf} title={`Prospección · +${a.prospeccion.pos} / −${a.prospeccion.neg}`}>
                            <Target className="w-3 h-3 text-accent" />
                            <span className={`font-semibold ${net > 0 ? 'text-emerald-600' : net < 0 ? 'text-red-600' : ''}`}>{net > 0 ? `+${net}` : net}</span>
                          </span>
                        </span>
                      </div>
                      {a.top_talents.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap mt-1">
                          <Sparkles className="w-3 h-3 text-digi-muted shrink-0" />
                          {a.top_talents.map((t) => (
                            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-black/[0.05] text-digi-muted whitespace-nowrap" style={mf}>{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>,
        (triggerRef.current?.closest('dialog') as HTMLElement) || document.body,
      )}
    </div>
  );
}
