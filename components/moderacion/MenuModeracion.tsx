'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Flag, Ban } from 'lucide-react';
import MenuMas, { type AccionMenu } from '@/components/ui/MenuMas';
import PixelModal from '@/components/ui/PixelModal';
import PixelSelect from '@/components/ui/PixelSelect';
import PixelConfirm from '@/components/ui/PixelConfirm';
import AutoGrowTextarea from '@/components/ui/AutoGrowTextarea';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';

const mf = { fontFamily: 'var(--font-body)' } as const;

// Los mismos de `lib/moderacion.ts` (aquí sin importar el servidor).
const MOTIVOS = [
  { value: 'ofensivo', label: 'Contenido ofensivo o inapropiado' },
  { value: 'acoso', label: 'Acoso o amenazas' },
  { value: 'engano', label: 'Engaño o fraude' },
  { value: 'spam', label: 'Spam o publicidad' },
  { value: 'otro', label: 'Otro motivo' },
];

export type TipoDenuncia = 'portafolio' | 'proyecto' | 'mensaje';
export type Autor = { userId?: string; memberId?: number; nombre?: string };

/**
 * «⋯» CON DENUNCIAR Y BLOQUEAR (Apple, normas 2.1 y 1.2; Fernando, 2026-11-13). Va en todo lo que publica
 * otra persona: las fichas del Marketplace y los mensajes de chat. La denuncia llega a los administradores
 * (Admin ▸ Denuncias); el bloqueo es personal y se deshace en Configuración ▸ Perfil.
 * Sin `autor` (un proyecto es del equipo) solo se ofrece denunciar.
 */
export default function MenuModeracion({ tipo, objetoId, autor, onBloqueado, className = '', compacto = false }: {
  tipo: TipoDenuncia;
  objetoId: string | number;
  autor?: Autor;
  onBloqueado?: (autor: Autor) => void;
  className?: string;
  /** Dentro de una burbuja de chat: el «⋯» pequeño y sin borde. */
  compacto?: boolean;
}) {
  const [denunciando, setDenunciando] = useState(false);
  const [bloqueando, setBloqueando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [detalle, setDetalle] = useState('');
  const [enviando, setEnviando] = useState(false);
  const puedeBloquear = !!(autor?.userId || autor?.memberId != null);
  const nombre = autor?.nombre || 'esta persona';

  const items: AccionMenu[] = [
    { label: 'Denunciar', icon: Flag, onClick: () => { setMotivo(''); setDetalle(''); setDenunciando(true); } },
    ...(puedeBloquear ? [{ label: `Bloquear a ${nombre}`, icon: Ban, danger: true, onClick: () => setBloqueando(true) }] : []),
  ];

  const enviar = async () => {
    if (!motivo) { toast.error('Elige un motivo'); return; }
    setEnviando(true);
    try {
      const r = await fetch('/api/moderacion/denuncias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, objetoId: String(objetoId), motivo, detalle }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo enviar la denuncia');
      toast.success('Denuncia enviada. La revisaremos en menos de 24 horas.');
      setDenunciando(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setEnviando(false); }
  };

  const bloquear = async () => {
    try {
      const r = await fetch('/api/moderacion/bloqueos', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: autor?.userId, memberId: autor?.memberId }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo bloquear');
      toast.success(`Bloqueaste a ${d.nombre || nombre}. Ya no verás lo que publica.`);
      onBloqueado?.(autor || {});
    } catch (e: any) { toast.error(e.message); }
    finally { setBloqueando(false); }
  };

  return (
    <span className={className} onClick={(e) => e.stopPropagation()}>
      <MenuMas items={items} label="Denunciar o bloquear" className={compacto ? '!w-6 !h-6 !border-0 !rounded-md' : ''} />
      <PixelModal open={denunciando} onClose={() => setDenunciando(false)} title="Denunciar contenido" size="sm" busy={enviando}
        pie={
          <div className="flex items-center justify-end gap-2 w-full">
            <button type="button" onClick={() => setDenunciando(false)} className={BTN_SECONDARY}>Cancelar</button>
            <button type="button" onClick={enviar} disabled={enviando || !motivo} className={BTN_PRIMARY}>
              <Flag className="w-4 h-4" /> {enviando ? 'Enviando…' : 'Enviar denuncia'}
            </button>
          </div>
        }>
        <div className="space-y-3" style={mf}>
          <PixelSelect label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder="Elige un motivo" options={MOTIVOS} />
          <div className="flex flex-col gap-1">
            <label className="field-label text-[10px] text-accent-glow opacity-70">Detalle (opcional)</label>
            <AutoGrowTextarea value={detalle} onChange={(e: any) => setDetalle(e.target.value)} maxLength={1000}
              className="w-full px-3 py-2 bg-digi-darker border border-digi-border rounded-lg text-[13px] text-digi-text focus:outline-none"
              placeholder="Cuéntanos qué pasa" />
          </div>
        </div>
      </PixelModal>
      <PixelConfirm open={bloqueando} title={`Bloquear a ${nombre}`}
        message="Dejarás de ver sus publicaciones del Marketplace y sus mensajes. No se le avisa. Puedes desbloquearlo en Configuración ▸ Perfil."
        confirmLabel="Bloquear" danger onConfirm={bloquear} onCancel={() => setBloqueando(false)} />
    </span>
  );
}
