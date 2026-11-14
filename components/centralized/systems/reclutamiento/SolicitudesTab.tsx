'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import { BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER } from '@/components/ui/Button';
import {
  Inbox, Mail, Check, X, ShieldCheck, ShieldAlert, Megaphone, CalendarDays, AtSign, UserPlus,
  Send,
} from 'lucide-react';
import PanelHastaElPie from '@/components/ui/PanelHastaElPie';
import PanelDetalle from '@/components/ui/PanelDetalle';
import BarraLista from '@/components/ui/BarraLista';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;

const STATUS_VARIANT: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  pending: 'warning', approved: 'success', rejected: 'error',
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada',
};

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

/**
 * Pestaña "Solicitudes": postulaciones enviadas desde el formulario "Quiero
 * postularme como candidato" de la landing (`candidate_proposals`). Lista buscable +
 * panel grande de detalle; el admin aprueba (crea cuenta de candidato) o rechaza.
 * Soporta `?solicitud=<id>` para abrir una directamente.
 */
export default function SolicitudesTab({ isAdmin }: { isAdmin: boolean }) {
  const params = useSearchParams();
  const deepLinkId = params.get('solicitud');

  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/candidate-proposals');
      const data = await res.json();
      setProposals(data.data || []);
    } catch { setProposals([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (deepLinkId && proposals.some((p) => String(p.id) === String(deepLinkId))) {
      setSelectedId(String(deepLinkId));
    }
  }, [deepLinkId, proposals]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return proposals;
    return proposals.filter((p) => `${nombreDe(p)} ${p.email} ${p.reason || ''}`.toLowerCase().includes(q));
  }, [proposals, search]);

  const selected = useMemo(() => proposals.find((p) => String(p.id) === selectedId) || null, [proposals, selectedId]);

  // Aprobación: abre un modal para fijar el usuario corporativo (nomenclatura).
  const [approving, setApproving] = useState<any | null>(null);
  const [username, setUsername] = useState('');

  // Con nombres, todo es automático y se lanza desde «Aprobar» del panel, sin segunda ventana (Fernando,
  // 2026-11-13: «desde el botón de aprobar ya se lance inmediatamente todo»): el servidor elige el primer usuario
  // libre, crea el correo y manda la credencial. Sin nombres (postulaciones anteriores al 2026-11-12) se abre la
  // ventana para escribir el usuario a mano.
  const openApprove = (p: any) => {
    if (p.primer_nombre) { void aprobar(p); return; }
    setUsername('');
    setApproving(p);
  };

  const aprobar = async (p: any) => {
    const automatico = !!p.primer_nombre;
    if (!automatico && !username.trim()) { toast.error('Escribe el nombre de usuario'); return; }
    setBusyId(String(p.id));
    try {
      const res = await fetch(`/api/admin/candidate-proposals/${p.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(automatico ? {} : { username: username.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo aprobar la postulación.');
      toast.success(data.emailSent === false
        ? `Aprobada — ${data.workspaceEmail || `${data.username}@grupocc.org`}, pero la credencial no se pudo enviar`
        : `Aprobada — credencial enviada a ${data.workspaceEmail || `${data.username}@grupocc.org`}`);
      setApproving(null);
      await load();
    } catch (e: any) { toast.error(e.message || 'No se pudo aprobar la postulación.'); }
    finally { setBusyId(null); }
  };
  const submitApprove = () => { if (approving) void aprobar(approving); };

  const reenviarCredencial = async (p: any) => {
    setBusyId(String(p.id));
    try {
      const res = await fetch(`/api/admin/candidate-proposals/${p.id}/credencial`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo enviar la credencial.');
      toast.success(`Credencial enviada a ${data.personal}`);
    } catch (e: any) { toast.error(e.message || 'No se pudo enviar la credencial.'); }
    finally { setBusyId(null); }
  };

  const reject = async (p: any) => {
    if (!window.confirm(`¿Rechazar la postulación de ${p.email}? Se eliminará y el correo quedará libre.`)) return;
    setBusyId(String(p.id));
    try {
      const res = await fetch(`/api/admin/candidate-proposals/${p.id}/reject`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error || 'Error');
      toast.success('Postulación rechazada');
      if (selectedId === String(p.id)) setSelectedId(null);
      await load();
    } catch (e: any) { toast.error(e.message || 'Error'); }
    finally { setBusyId(null); }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)] gap-4 items-start">
      {/* Lista */}
      <div className="min-w-0">
        <BarraLista busqueda={search} onBusqueda={setSearch} placeholder="Buscar por correo o motivo..." />

        {/* Lista y detalle llegan al pie desde `xl`, donde van lado a lado (Fernando, 2026-10-29). */}
        <PanelHastaElPie desdeAncho={1280} desplazar={false} className="flex flex-col">
        {loading ? (
          <div className="bg-digi-card border border-digi-border rounded-lg py-10 text-center text-[13px] text-digi-muted xl:flex-1 xl:flex xl:items-center xl:justify-center" style={mf}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="bg-digi-card border border-digi-border rounded-lg py-12 text-center xl:flex-1 xl:flex xl:flex-col xl:justify-center">
            <div className="w-11 h-11 rounded-xl bg-black/[0.03] flex items-center justify-center mx-auto mb-2"><Inbox className="w-5 h-5 text-digi-muted" /></div>
            <p className="text-[13px] font-medium text-digi-text" style={mf}>Sin solicitudes</p>
            <p className="text-[12px] text-digi-muted mt-0.5" style={mf}>{isAdmin ? 'Aún no hay postulaciones de candidatos.' : 'No tienes acceso a las postulaciones.'}</p>
          </div>
        ) : (
          <ul className="bg-digi-card border border-digi-border rounded-lg divide-y divide-digi-border/60 overflow-hidden xl:flex-1 xl:min-h-0 xl:overflow-y-auto">
            {filtered.map((p) => {
              const active = String(p.id) === selectedId;
              return (
                <li key={p.id}>
                  <button onClick={() => setSelectedId(String(p.id))}
                    className={`w-full text-left px-3 py-2.5 flex items-start gap-2.5 transition-colors border-l-2 ${active ? 'bg-accent-light border-accent' : 'border-transparent hover:bg-black/[0.02]'}`}>
                    <div className="w-8 h-8 rounded-full bg-accent-light border border-accent/20 flex items-center justify-center shrink-0">
                      <span className="text-[12px] font-semibold text-accent uppercase" style={mf}>{(p.email || '?').charAt(0)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] font-medium truncate ${active ? 'text-accent' : 'text-digi-text'}`} style={mf}>{nombreDe(p) || p.email}</p>
                      {p.reason && <p className="text-[11.5px] text-digi-muted truncate" style={mf}>{p.reason}</p>}
                      <div className="flex items-center gap-1.5 mt-1">
                        <PixelBadge variant={STATUS_VARIANT[p.status] || 'default'}>{STATUS_LABEL[p.status] || p.status}</PixelBadge>
                        <span className="text-[10.5px] text-digi-muted tabular-nums" style={mf}>{fmtDate(p.created_at)}</span>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        </PanelHastaElPie>
      </div>

      {/* Detalle */}
      {/* Sin selección el panel es solo «Selecciona un una solicitud»: en el teléfono caería bajo la
          lista sin aportar, así que ahí no se pinta (Fernando, 2026-10-23). */}
      <aside className={`w-full ${selected ? '' : 'hidden lg:block'}`}>
        {selected ? (
          /* Tres franjas (Fernando, 2026-10-29): cabecera y «Aprobar / Rechazar» fijos; se
             desplaza el cuerpo. Ver `PanelDetalle`. */
          <PanelDetalle
            icono={UserPlus}
            titulo={<span className="block truncate">{nombreDe(selected) || selected.email}</span>}
            subtitulo={
              <span className="flex items-center gap-1.5">
                <PixelBadge variant={STATUS_VARIANT[selected.status] || 'default'}>{STATUS_LABEL[selected.status] || selected.status}</PixelBadge>
                <span>Postuló el {fmtDate(selected.created_at)}</span>
              </span>
            }
            onCerrar={() => setSelectedId(null)}
            pie={isAdmin && selected.status === 'approved' && selected.primer_nombre ? (
              // Aprobada con correo corporativo: reenviar la credencial (contraseña temporal nueva, al correo personal).
              <button onClick={() => reenviarCredencial(selected)} disabled={busyId === String(selected.id)} className={`${BTN_PRIMARY} w-full disabled:opacity-50`}>
                <Send className="w-4 h-4" /> {busyId === String(selected.id) ? 'Enviando…' : 'Reenviar credencial'}
              </button>
            ) : isAdmin && selected.status !== 'approved' ? (
              // La peligrosa a la izquierda y la principal a la derecha, como en todos los pies.
              <div className="flex gap-2">
                <button onClick={() => reject(selected)} disabled={busyId === String(selected.id)} className={`${BTN_DANGER} flex-1 disabled:opacity-50`}>
                  <X className="w-4 h-4" /> Rechazar
                </button>
                <button onClick={() => openApprove(selected)} disabled={busyId === String(selected.id)} className={`${BTN_PRIMARY} flex-1 disabled:opacity-50`}>
                  <Check className="w-4 h-4" /> {busyId === String(selected.id) ? 'Aprobando…' : 'Aprobar'}
                </button>
              </div>
            ) : undefined}
          >
              <div className="flex items-center gap-2 text-[13px]">
                <Mail className="w-4 h-4 text-digi-muted shrink-0" />
                <a href={`mailto:${selected.email}`} className="text-accent hover:underline break-all" style={mf}>{selected.email}</a>
              </div>

              {/* El motivo se queda con el alto que sobra y «Detalles» va fijo abajo, justo sobre los botones
                  (Fernando, 2026-11-13); si el motivo es largo, se desplaza dentro de su cuadro. */}
              <div className="flex-1 min-h-32 flex flex-col">
                <p className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide mb-1.5" style={df}>Motivo para unirse</p>
                <p className="flex-1 min-h-0 overflow-y-auto text-[13px] text-digi-text leading-relaxed whitespace-pre-wrap rounded-lg border border-digi-border bg-digi-darker p-3" style={mf}>{selected.reason || 'Sin motivo indicado.'}</p>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide mb-1.5" style={df}>Detalles</p>
                <dl className="rounded-lg border border-digi-border divide-y divide-digi-border/60 overflow-hidden">
                  <Row Icon={selected.email_verified ? ShieldCheck : ShieldAlert} label="Correo verificado" value={<PixelBadge variant={selected.email_verified ? 'success' : 'warning'}>{selected.email_verified ? 'Verificado' : 'Sin verificar'}</PixelBadge>} />
                  <Row Icon={Megaphone} label="Acepta comunicaciones" value={<span className="text-[12.5px] text-digi-text" style={mf}>{selected.marketing ? 'Sí' : 'No'}</span>} />
                  <Row Icon={CalendarDays} label="Fecha de postulación" value={<span className="text-[12.5px] text-digi-text tabular-nums" style={mf}>{fmtDate(selected.created_at)}</span>} />
                  {selected.decided_at && (
                    <Row Icon={Check} label="Decidida" value={<span className="text-[12.5px] text-digi-text" style={mf}>{fmtDate(selected.decided_at)}{selected.decided_by ? ` · ${selected.decided_by}` : ''}</span>} />
                  )}
                </dl>
              </div>

          </PanelDetalle>
        ) : (
          <PanelHastaElPie desdeAncho={1280} className="bg-digi-card border border-digi-border rounded-xl p-10 text-center lg:sticky lg:top-4 flex flex-col justify-center">
            <div className="w-12 h-12 rounded-xl bg-black/[0.03] flex items-center justify-center mx-auto mb-3"><Inbox className="w-6 h-6 text-digi-muted" /></div>
            <p className="text-[13px] font-medium text-digi-text" style={mf}>Selecciona una solicitud</p>
            <p className="text-[12px] text-digi-muted mt-1" style={mf}>Elige una postulación de la lista para ver su contenido completo.</p>
          </PanelHastaElPie>
        )}
      </aside>

      {/* Modal de aprobación: define el usuario corporativo (nomenclatura) */}
      <PixelModal open={!!approving} onClose={() => setApproving(null)} title="Aprobar postulación" size="md">
        <div className="space-y-4">
              <p className="text-[13px] text-digi-muted" style={mf}>
                Define el <strong>usuario corporativo</strong> del candidato <strong>{approving?.email}</strong>. El candidato completará su nombre al crear su cuenta.
              </p>
              <div>
                <label className="text-[12px] font-medium text-digi-muted" style={mf}>NOMBRE DE USUARIO</label>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 flex items-center rounded-md border-2 border-digi-border bg-digi-darker focus-within:border-accent">
                    <AtSign className="w-4 h-4 text-digi-muted ml-2.5 shrink-0" />
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                      className="field-control flex-1 bg-transparent border-0 px-2 py-1.5 text-[14px] text-digi-text focus:outline-none"
                      style={mf}
                      placeholder="lfgonzalezm0"
                    />
                    <span className="text-[13px] text-digi-muted pr-3 shrink-0" style={mf}>@grupocc.org</span>
                  </div>
                </div>
              </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-digi-border">
            <button type="button" onClick={() => setApproving(null)} className={BTN_SECONDARY} style={mf}>
              <X className="w-4 h-4" /> Cancelar
            </button>
            <button type="button" onClick={submitApprove} disabled={busyId === String(approving?.id) || !username.trim()} className={BTN_PRIMARY} style={mf}>
              <Check className="w-4 h-4" /> {busyId === String(approving?.id) ? 'Aprobando…' : 'Aprobar candidato'}
            </button>
          </div>
        </div>
      </PixelModal>
    </div>
  );
}

function Row({ Icon, label, value }: { Icon: any; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 bg-digi-card">
      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-digi-muted" style={mf}>
        <Icon className="w-3.5 h-3.5" /> {label}
      </span>
      <span className="text-right">{value}</span>
    </div>
  );
}

/** El nombre completo de la postulación (dos nombres y dos apellidos), o '' si es de antes del 2026-11-12. */
function nombreDe(p: any): string {
  return [p?.primer_nombre, p?.segundo_nombre, p?.primer_apellido, p?.segundo_apellido].filter(Boolean).join(' ');
}
