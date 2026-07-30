'use client';

/**
 * Detalle / configuración de un FLUJO de Automatizaciones, a **página completa** (mismo
 * patrón que el detalle de un ticket): breadcrumb + título + barra de comandos, y debajo el
 * espacio de trabajo según el tipo de flujo.
 *
 * Antes esto era un overlay deslizante sobre la lista de flujos. Decisión del usuario
 * (2026-07-30): página aparte, porque la configuración de una campaña no cabe en un panel.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import DetailHeader from '@/components/ui/DetailHeader';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelConfirm from '@/components/ui/PixelConfirm';
import BrandLoader from '@/components/ui/BrandLoader';
import { BTN_SECONDARY } from '@/components/ui/Button';
import { PanelEmpty } from '@/components/dashboard/flows/FlowPanelUI';
import EmailFlowWorkspace from '@/components/dashboard/flows/EmailFlowWorkspace';
import WhatsAppFlowPanel from '@/components/dashboard/flows/WhatsAppFlowPanel';
import ChatbotFlowPanel from '@/components/dashboard/flows/ChatbotFlowPanel';
import { Mail, MessageCircle, Bot, Sparkles, Puzzle, Play, Pause, AlertTriangle } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

interface Flow {
  id: number; name: string; type: string; description: string; status: string;
  config: Record<string, any>; created_at: string; updated_at: string;
}

const FLOW_TYPES: Record<string, { label: string; Icon: any }> = {
  email: { label: 'Email masivo', Icon: Mail },
  whatsapp: { label: 'WhatsApp', Icon: MessageCircle },
  chatbot: { label: 'Chatbot', Icon: Bot },
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

  return (
    <div>
      <DetailHeader
        breadcrumb={{ label: 'Automatizaciones', href: '/dashboard/automatizaciones' }}
        title={flow.name}
        status={<PixelBadge variant={FLOW_STATUS_V[flow.status] || 'default'}>{FLOW_STATUS_L[flow.status] || flow.status}</PixelBadge>}
        chips={
          <span className="inline-flex items-center gap-1.5 text-[12px] text-digi-muted" style={mf}>
            <type.Icon className="w-3.5 h-3.5 text-accent" /> {type.label}
          </span>
        }
        actions={
          <button onClick={toggleStatus} className={BTN_SECONDARY}>
            {flow.status === 'active' ? <><Pause className="w-4 h-4" /> Pausar</> : <><Play className="w-4 h-4" /> Activar</>}
          </button>
        }
        overflow={[{ label: 'Eliminar flujo', onClick: () => setConfirmDelete(true), danger: true }]}
      />

      {flow.description && (
        <p className="text-[13px] text-digi-muted -mt-2 mb-4 max-w-3xl leading-relaxed" style={mf}>{flow.description}</p>
      )}

      {/* El espacio de trabajo depende del tipo. Los paneles de WhatsApp y Chatbot se
          montan en modo página (sin su overlay), con `onClose` volviendo al listado. */}
      {flow.type === 'whatsapp' ? (
        <WhatsAppFlowPanel flow={flow} variant="page" onClose={() => router.push('/dashboard/automatizaciones')} />
      ) : flow.type === 'chatbot' ? (
        <ChatbotFlowPanel flow={flow} variant="page" onClose={() => router.push('/dashboard/automatizaciones')} />
      ) : (
        // email · ai_agent · custom → campañas de correo (igual que antes del rediseño).
        <EmailFlowWorkspace flow={flow} />
      )}

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
