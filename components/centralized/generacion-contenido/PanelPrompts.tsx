'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RotateCcw } from 'lucide-react';
import { WideEditPanel } from '@/components/ui/EditDialog';
import { CLAVES_PROMPT, PROMPT_LABEL } from '@/lib/centralized/generacion-contenido';

const mf = { fontFamily: 'var(--font-body)' } as const;

/**
 * LA CONFIGURACIÓN DEL AGENTE: el prompt de cada entregable, editable sin desplegar nada.
 *
 * Fernando lo pidió expresamente porque **todavía no tiene los ejemplos** de cómo debe
 * expresarse el agente y los irá afinando: cómo se escribió antes, cómo debería escribirse
 * ahora. Esos ejemplos van en «Contexto base», que se antepone a todos los entregables.
 *
 * Panel ancho porque lleva dentro un rail y un texto largo: en 644px no se puede leer lo
 * que se está escribiendo.
 */
export default function PanelPrompts({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [prompts, setPrompts] = useState<Record<string, string>>({});
  const [porDefecto, setPorDefecto] = useState<Record<string, string>>({});
  const [clave, setClave] = useState<string>('base');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetch('/api/centralized/generacion-contenido/prompts')
      .then((r) => r.json())
      .then((d) => { setPrompts(d.data?.prompts || {}); setPorDefecto(d.data?.porDefecto || {}); })
      .catch(() => toast.error('No se pudieron cargar los prompts.'));
  }, [open]);

  const guardar = async () => {
    setGuardando(true);
    try {
      const r = await fetch('/api/centralized/generacion-contenido/prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clave, texto: prompts[clave] ?? '' }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo guardar');
      toast.success(`Guardado: ${PROMPT_LABEL[clave]}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setGuardando(false); }
  };

  const modificado = (prompts[clave] ?? '') !== (porDefecto[clave] ?? '');

  return (
    <WideEditPanel
      open={open}
      onClose={onClose}
      title="Configuración del agente"
      onSave={guardar}
      saving={guardando}
      canSave={Boolean((prompts[clave] ?? '').trim())}
      saveLabel="Guardar prompt"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-3">
        {/* Rail de prompts: uno por entregable, más el contexto base. */}
        <div className="bg-digi-card border border-digi-border rounded-lg overflow-hidden h-max">
          {CLAVES_PROMPT.map((c) => {
            const activo = c === clave;
            const tocado = (prompts[c] ?? '') !== (porDefecto[c] ?? '');
            return (
              <button
                key={c}
                type="button"
                onClick={() => setClave(c)}
                className={`w-full text-left px-3 py-2 text-[12.5px] border-l-2 transition-colors
                  ${activo ? 'bg-accent-light border-accent text-accent' : 'border-transparent text-digi-text hover:bg-black/[0.03]'}`}
                style={mf}
              >
                <span className="flex items-center gap-1.5">
                  <span className="truncate">{PROMPT_LABEL[c]}</span>
                  {tocado && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent shrink-0" title="Editado" />}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-digi-text opacity-70" style={mf}>
              {PROMPT_LABEL[clave]}
            </span>
            <span className="text-[11px] text-digi-muted" style={mf}>
              {(prompts[clave] ?? '').length} caracteres
            </span>
            <button
              type="button"
              onClick={() => setPrompts((p) => ({ ...p, [clave]: porDefecto[clave] ?? '' }))}
              disabled={!modificado}
              className="ml-auto inline-flex items-center gap-1 text-[11.5px] text-digi-muted hover:text-accent disabled:opacity-40"
              style={mf}
            >
              <RotateCcw className="w-3.5 h-3.5" /> Volver al original
            </button>
          </div>
          <textarea
            value={prompts[clave] ?? ''}
            onChange={(e) => setPrompts((p) => ({ ...p, [clave]: e.target.value }))}
            rows={26}
            spellCheck={false}
            className="field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-[12.5px] leading-relaxed text-digi-text focus:border-accent focus:outline-none font-mono"
          />
        </div>
      </div>
    </WideEditPanel>
  );
}
