'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import PixelModal from '@/components/ui/PixelModal';
import { Link2, X } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

interface Props {
  system: { id: number; name: string } | null;
  open: boolean;
  onClose: () => void;
  /** Notifica cambios (compartir/revocar) para refrescar contadores de acceso. */
  onChanged?: () => void;
}

/**
 * Modal "Compartir acceso" de un sistema del Centralizado. Autónomo: carga el equipo
 * y los accesos existentes al abrir, y gestiona compartir/revocar. Lo usan la vista
 * general (panel de detalle) y la página de cada sistema.
 */
export default function ShareAccessModal({ system, open, onClose, onChanged }: Props) {
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [existing, setExisting] = useState<any[]>([]);
  const [sharing, setSharing] = useState(false);
  const [revokingId, setRevokingId] = useState<number | null>(null);

  const loadAccess = useCallback(async (systemId: number) => {
    try {
      const [mRes, aRes] = await Promise.all([
        fetch('/api/admin/team'),
        fetch(`/api/centralized/access?system_id=${systemId}`),
      ]);
      const mData = await mRes.json();
      const aData = await aRes.json();
      setMembers((mData.data || []).filter((m: any) => m.is_active));
      setExisting(aData.data || []);
    } catch { setMembers([]); setExisting([]); }
  }, []);

  useEffect(() => {
    if (open && system) { setSearch(''); setSelected([]); loadAccess(system.id); }
  }, [open, system, loadAccess]);

  const toggle = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const share = async () => {
    if (!system || !selected.length) return;
    setSharing(true);
    try {
      for (const memberId of selected) {
        const res = await fetch('/api/centralized/access', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ member_id: memberId, system_ids: [system.id] }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      }
      toast.success(`Acceso compartido con ${selected.length} miembro(s)`);
      setSelected([]);
      await loadAccess(system.id);
      onChanged?.();
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setSharing(false); }
  };

  const revoke = async (accessId: number) => {
    setRevokingId(accessId);
    try {
      const res = await fetch('/api/centralized/access', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_id: accessId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Acceso revocado');
      setExisting((prev) => prev.filter((a: any) => a.id !== accessId));
      onChanged?.();
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setRevokingId(null); }
  };

  const filteredMembers = members.filter((m: any) => {
    if (existing.some((a: any) => a.member_id === m.id)) return false;
    if (!search.trim()) return true;
    return m.name?.toLowerCase().includes(search.toLowerCase()) || m.email?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <PixelModal open={open} onClose={() => !sharing && onClose()} title={`Compartir — ${system?.name || ''}`}>
      <div className="space-y-4">
        <div>
          <label className="text-[12px] font-medium text-digi-muted block mb-1.5" style={mf}>Agregar personas</label>
          <div className="border-2 border-digi-border bg-digi-darker rounded-md focus-within:border-accent transition-colors">
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-1 px-2 pt-2">
                {selected.map((id) => {
                  const m = members.find((x: any) => x.id === id);
                  if (!m) return null;
                  return (
                    <span key={id} className="inline-flex items-center gap-1 bg-accent-light border border-accent/30 rounded px-2 py-0.5">
                      <span className="text-[11px] text-digi-text" style={mf}>{m.name}</span>
                      <button onClick={() => toggle(id)} className="text-digi-muted hover:text-red-500"><X className="w-3 h-3" /></button>
                    </span>
                  );
                })}
              </div>
            )}
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o email..."
              className="w-full px-3 py-2 bg-transparent text-[13px] text-digi-text focus:outline-none" style={mf} />
          </div>
          {search.trim() && filteredMembers.length > 0 && (
            <div className="border border-digi-border bg-digi-card rounded-md max-h-36 overflow-y-auto mt-1">
              {filteredMembers.map((m: any) => (
                <div key={m.id} onClick={() => { toggle(m.id); setSearch(''); }}
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent-light transition-colors border-b border-digi-border/40 last:border-b-0">
                  {m.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.avatar_url} alt={m.name} className="w-6 h-6 rounded-full object-cover border border-digi-border" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-accent-light border border-accent/30 flex items-center justify-center">
                      <span className="text-[9px] text-accent font-semibold">{m.name?.charAt(0)}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-[12px] text-digi-text block" style={mf}>{m.name}</span>
                    {m.email && <span className="text-[10px] text-digi-muted block truncate" style={mf}>{m.email}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {search.trim() && filteredMembers.length === 0 && (
            <p className="text-[11px] text-digi-muted text-center py-2 mt-1" style={mf}>No se encontraron miembros</p>
          )}
        </div>

        {selected.length > 0 && (
          <button onClick={share} disabled={sharing}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover transition-colors disabled:opacity-50" style={mf}>
            {sharing ? 'Compartiendo...' : `Compartir con ${selected.length} persona(s)`}
          </button>
        )}

        <div className="h-px bg-digi-border/60" />

        <div>
          <label className="text-[12px] font-medium text-digi-muted mb-1.5 flex items-center gap-1.5" style={mf}>
            <Link2 className="w-3.5 h-3.5" /> Personas con acceso
          </label>
          {existing.length > 0 ? (
            <div className="border border-digi-border bg-digi-card rounded-md max-h-48 overflow-y-auto">
              {existing.map((a: any) => (
                <div key={a.id} className="flex items-center gap-2 px-3 py-2 border-b border-digi-border/40 last:border-b-0">
                  {a.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.photo_url} alt={a.member_name} className="w-7 h-7 rounded-full object-cover border border-digi-border" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-accent-light border border-accent/30 flex items-center justify-center">
                      <span className="text-[10px] text-accent font-semibold">{a.member_name?.charAt(0)}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-[12px] text-digi-text block" style={mf}>{a.member_name}</span>
                    <span className="text-[10px] text-digi-muted" style={mf}>Desde {new Date(a.created_at).toLocaleDateString('es-EC')}</span>
                  </div>
                  <button onClick={() => revoke(a.id)} disabled={revokingId === a.id}
                    className="text-[11px] text-red-500 border border-red-500/30 rounded px-2 py-1 hover:bg-red-50 transition-colors disabled:opacity-50" style={mf}>
                    {revokingId === a.id ? '...' : 'Quitar'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-digi-muted text-center py-4 border border-digi-border rounded-md bg-digi-darker" style={mf}>
              Nadie tiene acceso a este sistema aún.
            </p>
          )}
        </div>
      </div>
    </PixelModal>
  );
}
