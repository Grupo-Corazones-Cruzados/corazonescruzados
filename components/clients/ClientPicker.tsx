'use client';

import { useEffect, useRef, useState } from 'react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-body)' } as const;

type ClientOpt = { id: number; name: string; email: string; status?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Selector de CLIENTE con búsqueda: busca entre los clientes del usuario (por nombre o
 * correo) y permite seleccionar uno existente, o escribir el correo de un cliente NUEVO.
 * Devuelve `{ clientId, clientEmail }` — uno u otro (nunca ambos).
 */
export default function ClientPicker({
  clientId, clientEmail, onChange, scope = 'mine', label = 'Cliente',
}: {
  clientId: string;
  clientEmail: string;
  onChange: (v: { clientId: string; clientEmail: string }) => void;
  scope?: 'mine' | 'all';
  label?: string;
}) {
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/clients${scope === 'mine' ? '?mine=1' : ''}`)
      .then(r => r.json()).then(d => setClients(d.data || [])).catch(() => setClients([]));
  }, [scope]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selected = clients.find(c => String(c.id) === String(clientId));
  const q = query.trim().toLowerCase();
  const filtered = q
    ? clients.filter(c => (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q))
    : clients;
  const isEmail = EMAIL_RE.test(query.trim());
  const emailExists = clients.some(c => (c.email || '').toLowerCase() === query.trim().toLowerCase());

  const display = selected
    ? `${selected.name || selected.email}${selected.status && selected.status !== 'activo' ? ' · sin cuenta' : ''}`
    : (clientEmail ? `${clientEmail} · nuevo` : '');

  const pick = (c: ClientOpt) => { onChange({ clientId: String(c.id), clientEmail: '' }); setOpen(false); setQuery(''); };
  const useEmail = () => { onChange({ clientId: '', clientEmail: query.trim().toLowerCase() }); setOpen(false); setQuery(''); };
  const clear = () => { onChange({ clientId: '', clientEmail: '' }); setQuery(''); };

  return (
    <div className="flex flex-col gap-1" ref={boxRef}>
      {label && <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>{label} <span className="text-accent">*</span></label>}
      <div className="relative">
        <input
          value={open ? query : display}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setOpen(true); setQuery(''); }}
          placeholder="Buscar por nombre o correo, o escribe un correo nuevo…"
          className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none"
          style={mf}
        />
        {(selected || clientEmail) && !open && (
          <button type="button" onClick={clear} aria-label="Quitar cliente"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-digi-muted hover:text-red-500">✕</button>
        )}
        {open && (
          <div className="absolute z-50 left-0 right-0 mt-1 bg-digi-card border-2 border-digi-border rounded-md shadow-lg max-h-56 overflow-y-auto">
            {filtered.slice(0, 50).map(c => (
              <button key={c.id} type="button" onClick={() => pick(c)}
                className="w-full text-left px-3 py-1.5 hover:bg-accent/10 border-b border-digi-border/30 last:border-b-0 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] text-digi-text truncate" style={mf}>{c.name || c.email}</span>
                  {c.status && c.status !== 'activo' && <span className="text-[9.5px] text-amber-600 shrink-0">sin cuenta</span>}
                </div>
                {c.email && <span className="block text-[11px] text-digi-muted truncate" style={mf}>{c.email}</span>}
              </button>
            ))}
            {isEmail && !emailExists && (
              <button type="button" onClick={useEmail}
                className="w-full text-left px-3 py-1.5 text-accent hover:bg-accent/10 transition-colors text-[13px]" style={mf}>
                + Usar correo nuevo: <strong>{query.trim()}</strong>
              </button>
            )}
            {filtered.length === 0 && !isEmail && (
              <div className="px-3 py-2 text-[12px] text-digi-muted" style={mf}>
                {clients.length === 0 ? 'No tienes clientes aún — escribe un correo para agregar uno.' : 'Sin resultados. Escribe un correo válido para un cliente nuevo.'}
              </div>
            )}
          </div>
        )}
      </div>
      {label && <p className="text-[10.5px] text-digi-muted/80" style={mf}>Si el correo no tiene cuenta, se registra y se le invita a crearla.</p>}
    </div>
  );
}
