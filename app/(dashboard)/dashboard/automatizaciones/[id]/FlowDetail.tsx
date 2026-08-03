'use client';

/**
 * Detalle / configuración de un FLUJO de Automatizaciones, a **página completa** (mismo
 * patrón que el detalle de un ticket): breadcrumb + título + barra de comandos, y debajo el
 * espacio de trabajo según el tipo de flujo.
 *
 * Antes esto era un overlay deslizante sobre la lista de flujos. Decisión del usuario
 * (2026-07-30): página aparte, porque la configuración de una campaña no cabe en un panel.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import DetailHeader from '@/components/ui/DetailHeader';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelConfirm from '@/components/ui/PixelConfirm';
import BrandLoader from '@/components/ui/BrandLoader';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import PanelAccesos from '@/components/dashboard/flows/PanelAccesos';
import { useAuth } from '@/components/providers/AuthProvider';
import { PanelEmpty } from '@/components/dashboard/flows/FlowPanelUI';
import EmailFlowWorkspace, { type EmailWorkspaceHandle } from '@/components/dashboard/flows/EmailFlowWorkspace';
import WhatsAppFlowPanel from '@/components/dashboard/flows/WhatsAppFlowPanel';
import AgenteFlowWorkspace from '@/components/dashboard/flows/AgenteFlowWorkspace';
import BotonAvisos, { type Aviso } from '@/components/ui/BotonAvisos';
import BotonAyuda from '@/components/ui/BotonAyuda';
import { Mail, MessageCircle, Sparkles, Puzzle, Play, Pause, AlertTriangle, Plus , Users} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

interface Flow {
  id: number; name: string; type: string; description: string; status: string;
  config: Record<string, any>; created_at: string; updated_at: string;
  /** Quién lleva el flujo dentro de GCC. Decide si se ofrece el botón de accesos. */
  responsable_user_id: string | null;
}

const FLOW_TYPES: Record<string, { label: string; Icon: any }> = {
  email: { label: 'Email masivo', Icon: Mail },
  whatsapp: { label: 'WhatsApp', Icon: MessageCircle },
  ai_agent: { label: 'Agente IA', Icon: Sparkles },
  custom: { label: 'Personalizado', Icon: Puzzle },
};
const FLOW_STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  draft: 'default', active: 'success', paused: 'warning', archived: 'error',
};
const FLOW_STATUS_L: Record<string, string> = {
  draft: 'Borrador', active: 'Activo', paused: 'Pausado', archived: 'Archivado',
};

export default function FlowDetail({ flowId }: { flowId: string }) {
  const router = useRouter();
  const [flow, setFlow] = useState<Flow | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [accesos, setAccesos] = useState(false);
  const { user } = useAuth();
  /** Acciones del espacio de trabajo que se disparan desde la cabecera de la página. */
  const emailRef = useRef<EmailWorkspaceHandle | null>(null);
  /**
   * Advertencias del agente. El dato lo tiene el espacio de trabajo, pero se ven mejor
   * aquí: junto a «Activar», que es la acción que la mayoría condiciona.
   */
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/flows/${flowId}`);
      if (!res.ok) { setNotFound(true); return; }
      const d = await res.json();
      if (!d.data) { setNotFound(true); return; }
      setFlow(d.data);
    } catch { setNotFound(true); }
    finally { setLoading(false); }
  }, [flowId]);

  useEffect(() => { load(); }, [load]);

  const toggleStatus = async () => {
    if (!flow) return;
    const next = flow.status === 'active' ? 'paused' : 'active';
    try {
      await fetch(`/api/admin/flows/${flow.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      await load();
    } catch { toast.error('Error al cambiar el estado'); }
  };

  const remove = async () => {
    if (!flow) return;
    setConfirmDelete(false);
    try {
      await fetch(`/api/admin/flows/${flow.id}`, { method: 'DELETE' });
      toast.success('Flujo eliminado');
      router.push('/dashboard/automatizaciones');
    } catch { toast.error('Error al eliminar el flujo'); }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><BrandLoader size="lg" label="Cargando el flujo…" /></div>;
  }

  if (notFound || !flow) {
    return (
      <div>
        <DetailHeader breadcrumb={{ label: 'Automatizaciones', href: '/dashboard/automatizaciones' }} title="Flujo no encontrado" />
        <PanelEmpty Icon={AlertTriangle} title="Este flujo no existe" desc="Puede que se haya eliminado." />
      </div>
    );
  }

  const type = FLOW_TYPES[flow.type] || FLOW_TYPES.custom;

  // Solo el responsable del flujo y los administradores reparten accesos: un cliente con
  // acceso no puede dárselo a otro. El servidor lo vuelve a comprobar — esconder el botón
  // no es seguridad, es no ofrecer lo que no se puede hacer.
  const puedeRepartirAccesos =
    user?.role === 'admin' || (!!flow.responsable_user_id && flow.responsable_user_id === user?.id);
  const isEmailWorkspace = flow.type !== 'whatsapp' && flow.type !== 'ai_agent';

  return (
    <div>
      <DetailHeader
        breadcrumb={{ label: 'Automatizaciones', href: '/dashboard/automatizaciones' }}
        title={flow.name}
        status={<PixelBadge variant={FLOW_STATUS_V[flow.status] || 'default'}>{FLOW_STATUS_L[flow.status] || flow.status}</PixelBadge>}
        chips={
          <span className="inline-flex items-center gap-1.5 text-[12px] text-digi-muted" style={mf}>
            <type.Icon className="w-3.5 h-3.5 text-accent" /> {type.label}
            {flow.description && (
              <BotonAyuda titulo={`${type.label} — ${flow.name}`} lado="derecha">
                {flow.description}
              </BotonAyuda>
            )}
          </span>
        }
        actions={
          <>
            <BotonAvisos avisos={avisos} />
            {puedeRepartirAccesos && (
              <button onClick={() => setAccesos(true)} className={BTN_SECONDARY}>
                <Users className="w-4 h-4" /> Accesos
              </button>
            )}
            <button onClick={toggleStatus} className={BTN_SECONDARY}>
              {flow.status === 'active' ? <><Pause className="w-4 h-4" /> Pausar</> : <><Play className="w-4 h-4" /> Activar</>}
            </button>
            {isEmailWorkspace && (
              <button onClick={() => emailRef.current?.openNewCampaign()} className={BTN_PRIMARY}>
                <Plus className="w-4 h-4" /> Nueva campaña
              </button>
            )}
          </>
        }
        overflow={[{ label: 'Eliminar flujo', onClick: () => setConfirmDelete(true), danger: true }]}
      />

      {/* El espacio de trabajo depende del tipo. El panel de WhatsApp se monta en modo
          página (sin su overlay), con `onClose` volviendo al listado. */}
      {flow.type === 'whatsapp' ? (
        <WhatsAppFlowPanel flow={flow} variant="page" onClose={() => router.push('/dashboard/automatizaciones')} />
      ) : flow.type === 'ai_agent' ? (
        <AgenteFlowWorkspace flow={flow} onAvisos={setAvisos} />
      ) : (
        // email · custom → campañas de correo (igual que antes del rediseño).
        <EmailFlowWorkspace flow={flow} controlRef={emailRef} />
      )}

      <PanelAccesos flowId={flow.id} abierto={accesos} alCerrar={() => setAccesos(false)} />

      <PixelConfirm
        open={confirmDelete}
        title="Eliminar flujo"
        message={`¿Eliminar "${flow.name}"? Se borran también sus campañas, listas de contactos y contactos. No se puede deshacer.`}
        confirmLabel="Sí, eliminar"
        danger
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
