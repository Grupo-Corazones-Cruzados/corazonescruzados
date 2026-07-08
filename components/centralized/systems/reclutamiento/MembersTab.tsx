'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { UserRound, Mail, X, Search, BadgeCheck, DollarSign, Briefcase, UserMinus, Network, SlidersHorizontal, Radar } from 'lucide-react';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelConfirm from '@/components/ui/PixelConfirm';
import PixelModal from '@/components/ui/PixelModal';
import PixelSelect from '@/components/ui/PixelSelect';
import ActionsMenu from '@/components/centralized/ActionsMenu';
import CriteriaSections from '@/components/centralized/reclutamiento/CriteriaSections';
import ProspeccionBar from '@/components/centralized/reclutamiento/ProspeccionBar';
import { fmt2 } from '@/lib/format';
import { PISOS, PASOS, PISO_LABEL, PASO_LABEL, pisosAtOrBelow } from '@/lib/centralized/systems';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

/**
 * Pestaña "Miembros": los miembros existentes del grupo (`/api/admin/team`). Lista
 * buscable + panel de detalle a la derecha. El contenido del detalle (información
 * específica del miembro) se definirá más adelante; por ahora se muestran los datos
 * básicos disponibles. Soporta `?miembro=<id>`.
 */
export default function MembersTab({ isAdmin, onChanged }: { isAdmin: boolean; onChanged?: () => void }) {
  const params = useSearchParams();
  const deepLinkId = params.get('miembro');

  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [demoting, setDemoting] = useState(false);
  const [confirmDemote, setConfirmDemote] = useState(false);
  // Modal de acceso a Centralizado (piso/paso)
  const [accessOpen, setAccessOpen] = useState(false);
  const [formPiso, setFormPiso] = useState('');
  const [formPaso, setFormPaso] = useState('');
  const [savingAccess, setSavingAccess] = useState(false);
  // Prospección: panel a la derecha (con overlay) con los criterios de desarrollo.
  const [prospectOpen, setProspectOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/team');
      const data = await res.json();
      setMembers(data.data || []);
    } catch { setMembers([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (deepLinkId && members.some((m) => String(m.id) === String(deepLinkId))) {
      setSelectedId(String(deepLinkId));
    }
  }, [deepLinkId, members]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Solo miembros activos (los degradados a candidato quedan inactivos → fuera).
    const active = members.filter((m) => m.is_active);
    if (!q) return active;
    return active.filter((m) => `${m.name || ''} ${m.email || ''} ${m.position_name || ''}`.toLowerCase().includes(q));
  }, [members, search]);

  const selected = useMemo(() => members.find((m) => String(m.id) === selectedId) || null, [members, selectedId]);
  const displayName = (m: any) => m?.name || m?.email || 'Miembro';
  const isAdminMember = selected?.role === 'admin';

  const doDemote = async (m: any) => {
    setConfirmDemote(false);
    setDemoting(true);
    try {
      const res = await fetch(`/api/admin/members/${m.id}/to-candidate`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      toast.success('Miembro convertido en candidato');
      setSelectedId(null);
      await load();
      onChanged?.();
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setDemoting(false); }
  };

  const openAccess = (m: any) => {
    setFormPiso(m.piso || '');
    setFormPaso(m.paso || '');
    setAccessOpen(true);
  };

  const saveAccess = async () => {
    if (!selected) return;
    setSavingAccess(true);
    try {
      const res = await fetch(`/api/admin/members/${selected.id}/access`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ piso: formPiso || null, paso: formPaso || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      toast.success('Acceso a Centralizado actualizado');
      setAccessOpen(false);
      await load();
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setSavingAccess(false); }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-4 items-start">
      {/* Lista de miembros */}
      <div className="min-w-0">
        <div className="relative mb-3">
          <Search className="w-4 h-4 text-digi-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar miembro..."
            className="field-control w-full pl-8 pr-3 py-2 bg-digi-darker border-2 border-digi-border rounded-md text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none" style={mf} />
        </div>

        {loading ? (
          <div className="bg-digi-card border border-digi-border rounded-lg py-10 text-center text-[13px] text-digi-muted" style={mf}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="bg-digi-card border border-digi-border rounded-lg py-12 text-center">
            <div className="w-11 h-11 rounded-xl bg-black/[0.03] flex items-center justify-center mx-auto mb-2"><UserRound className="w-5 h-5 text-digi-muted" /></div>
            <p className="text-[13px] font-medium text-digi-text" style={mf}>Sin miembros</p>
            <p className="text-[12px] text-digi-muted mt-0.5" style={mf}>{isAdmin ? 'Aún no hay miembros registrados.' : 'No tienes acceso a los miembros.'}</p>
          </div>
        ) : (
          <ul className="bg-digi-card border border-digi-border rounded-lg divide-y divide-digi-border/60 overflow-hidden">
            {filtered.map((m) => {
              const active = String(m.id) === selectedId;
              return (
                <li key={m.id}>
                  <button onClick={() => setSelectedId(String(m.id))}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors border-l-2 ${active ? 'bg-accent-light border-accent' : 'border-transparent hover:bg-black/[0.02]'}`}>
                    {m.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-digi-border shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-accent-light border border-accent/20 flex items-center justify-center shrink-0">
                        <span className="text-[12px] font-semibold text-accent uppercase" style={mf}>{displayName(m).charAt(0)}</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] font-medium truncate ${active ? 'text-accent' : 'text-digi-text'}`} style={mf}>{displayName(m)}</p>
                      <p className="text-[11.5px] text-digi-muted truncate" style={mf}>{m.position_name || m.email || '—'}</p>
                    </div>
                    {!m.is_active && <span className="text-[10px] text-digi-muted shrink-0" style={mf}>inactivo</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Detalle del miembro (contenido por definir) */}
      <aside className="w-full">
        {selected ? (
          <div className="space-y-4">
            <div className="bg-digi-card border border-digi-border rounded-xl shadow-sm p-4">
              <div className="flex items-start gap-3">
                {selected.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selected.avatar_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-digi-border shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-accent-light border border-accent/20 flex items-center justify-center shrink-0">
                    <span className="text-[18px] font-semibold text-accent uppercase" style={df}>{displayName(selected).charAt(0)}</span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-[16px] font-semibold text-digi-text leading-tight truncate" style={df}>{displayName(selected)}</h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[12px] text-digi-muted" style={mf}>
                    {selected.email && <span className="inline-flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {selected.email}</span>}
                    {selected.position_name && <span className="inline-flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {selected.position_name}</span>}
                    {selected.hourly_rate != null && <span className="inline-flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> {fmt2(Number(selected.hourly_rate))}/h</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <PixelBadge variant={selected.is_active ? 'success' : 'default'}>{selected.is_active ? 'Activo' : 'Inactivo'}</PixelBadge>
                    {selected.role && <PixelBadge variant="info"><span className="inline-flex items-center gap-1"><BadgeCheck className="w-3 h-3" /> {selected.role}</span></PixelBadge>}
                    {!isAdminMember && (
                      <span className="inline-flex items-center gap-1 text-[11.5px] text-digi-muted" style={mf} title="Acceso a Centralizado">
                        <Network className="w-3.5 h-3.5" /> Centralizado: {selected.piso && selected.paso ? `${PISO_LABEL[selected.piso] || selected.piso} · ${PASO_LABEL[selected.paso] || selected.paso}` : 'sin acceso'}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  {isAdmin && (
                    <ActionsMenu items={[
                      { label: 'Prospección', icon: Radar, onClick: () => setProspectOpen(true) },
                      { label: 'Configurar accesos', icon: SlidersHorizontal, onClick: () => openAccess(selected) },
                      { label: demoting ? 'Convirtiendo…' : 'Convertir a candidato', icon: UserMinus, danger: true, onClick: () => setConfirmDemote(true), disabled: isAdminMember || demoting },
                    ]} />
                  )}
                  <button onClick={() => setSelectedId(null)} className="w-8 h-8 flex items-center justify-center rounded-md text-digi-muted hover:text-digi-text hover:bg-black/[0.05] transition-colors" aria-label="Cerrar"><X className="w-4 h-4" /></button>
                </div>
              </div>
              {/* Prospección al borde izquierdo del componente */}
              <div className="mt-3"><ProspeccionBar criteria={selected.criteria || null} /></div>
            </div>
          </div>
        ) : (
          <div className="bg-digi-card border border-digi-border rounded-xl p-10 text-center lg:sticky lg:top-4">
            <div className="w-12 h-12 rounded-xl bg-black/[0.03] flex items-center justify-center mx-auto mb-3"><UserRound className="w-6 h-6 text-digi-muted" /></div>
            <p className="text-[13px] font-medium text-digi-text" style={mf}>Selecciona un miembro</p>
            <p className="text-[12px] text-digi-muted mt-1" style={mf}>Elige un miembro de la lista para ver su información.</p>
          </div>
        )}
      </aside>

      <PixelConfirm
        open={confirmDemote}
        title="Convertir a candidato"
        message={selected ? `¿Convertir a ${displayName(selected)} en candidato? Dejará de ser miembro (pierde el acceso de miembro) y pasará a rol de candidato.` : ''}
        confirmLabel="Convertir a candidato"
        danger
        onConfirm={() => selected && doDemote(selected)}
        onCancel={() => setConfirmDemote(false)}
      />

      {/* Modal: acceso a Centralizado (piso / paso) */}
      <PixelModal open={accessOpen} onClose={() => !savingAccess && setAccessOpen(false)} title={`Acceso a Centralizado — ${selected ? displayName(selected) : ''}`}>
        <div className="space-y-3">
          <p className="text-[12px] text-digi-muted leading-relaxed" style={mf}>
            El miembro accede a los sistemas de <span className="text-digi-text font-medium">su paso</span> en su piso y en
            todos los pisos por <span className="text-digi-text font-medium">debajo</span>.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <PixelSelect label="Piso" value={formPiso} onChange={(e) => setFormPiso(e.target.value)}
              options={[{ value: '', label: 'Sin asignar' }, ...PISOS.map((p) => ({ value: p.key, label: p.label }))]} />
            <PixelSelect label="Paso" value={formPaso} onChange={(e) => setFormPaso(e.target.value)}
              options={[{ value: '', label: 'Sin asignar' }, ...PASOS.map((p) => ({ value: p.key, label: p.label }))]} />
          </div>
          {formPiso && formPaso ? (
            <p className="text-[11.5px] text-accent bg-accent-light border border-accent/20 rounded-md px-2.5 py-2 leading-relaxed" style={mf}>
              Cubre el paso <span className="font-semibold">{PASO_LABEL[formPaso]}</span> en los pisos:{' '}
              <span className="font-semibold">{pisosAtOrBelow(formPiso).map((k) => PISO_LABEL[k]).join(', ')}</span>.
            </p>
          ) : (
            <p className="text-[11.5px] text-digi-muted" style={mf}>Sin piso/paso, el miembro no accede a ningún sistema del Centralizado.</p>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={() => setAccessOpen(false)} disabled={savingAccess}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-digi-border rounded text-sm font-medium text-digi-text hover:border-accent hover:text-accent transition-colors" style={mf}>Cancelar</button>
            <button onClick={saveAccess} disabled={savingAccess}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-accent text-white text-sm font-medium rounded hover:bg-accent-hover transition-colors disabled:opacity-50" style={mf}>
              {savingAccess ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      </PixelModal>

      {/* Prospección: overlay + panel deslizante a la derecha con los criterios del miembro */}
      {prospectOpen && selected && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[pixelFadeIn_0.15s_ease-out]" onClick={() => setProspectOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-full max-w-[680px] bg-digi-darker border-l border-digi-border shadow-2xl flex flex-col animate-[pixelFadeIn_0.2s_ease-out]">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-digi-border shrink-0">
              <div className="w-9 h-9 rounded-lg bg-accent-light border border-accent/20 flex items-center justify-center shrink-0"><Radar className="w-5 h-5 text-accent" /></div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-digi-muted" style={df}>Prospección</p>
                <h3 className="text-[14px] font-semibold text-digi-text truncate leading-tight" style={df}>{displayName(selected)}</h3>
              </div>
              <button onClick={() => setProspectOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-md text-digi-muted hover:text-digi-text hover:bg-black/[0.05] transition-colors" aria-label="Cerrar"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <CriteriaSections criteria={selected.criteria || null} />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
