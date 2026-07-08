'use client';

import { usePolicyEffects } from '@/components/providers/PolicyEffectsProvider';
import { Megaphone } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

/**
 * Header permanente del dashboard: muestra los mensajes de las políticas ACTIVAS de
 * "Comandos Violeta" (función "Ingresar mensaje permanente"). Si no hay, no renderiza nada.
 */
export default function PolicyBanner() {
  const { messages } = usePolicyEffects();
  if (!messages.length) return null;
  return (
    <div className="mb-4 space-y-2">
      {messages.map((m, i) => (
        <div key={i} className="flex items-start gap-2.5 rounded-lg border border-accent/30 bg-accent-light px-4 py-2.5">
          <Megaphone className="w-4 h-4 mt-0.5 shrink-0 text-accent" />
          <p className="text-[13px] font-medium text-accent leading-snug" style={mf}>{m}</p>
        </div>
      ))}
    </div>
  );
}
