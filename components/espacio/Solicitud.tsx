'use client';

import { useState } from 'react';
import { HelpCircle, ShieldQuestion } from 'lucide-react';
import MarkdownRenderer from '@/components/shared/MarkdownRenderer';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import type { Solicitud } from './api';

type Responder = (s: Solicitud, r: { permitir: boolean; respuestas?: Record<string, string>; mensaje?: string }) => void;

function Preguntas({ s, responder }: { s: Solicitud; responder: Responder }) {
  const preguntas: any[] = s.entrada?.questions || [];
  const [elegidas, setElegidas] = useState<Record<string, string[]>>({});
  const [otras, setOtras] = useState<Record<string, string>>({});
  const listo = preguntas.every((p) => (elegidas[p.question]?.length || otras[p.question]?.trim()));

  function alternar(p: any, etiqueta: string) {
    setElegidas((act) => {
      const ya = act[p.question] || [];
      if (!p.multiSelect) return { ...act, [p.question]: ya.includes(etiqueta) ? [] : [etiqueta] };
      return { ...act, [p.question]: ya.includes(etiqueta) ? ya.filter((x) => x !== etiqueta) : [...ya, etiqueta] };
    });
  }

  function enviar() {
    const respuestas: Record<string, string> = {};
    for (const p of preguntas) respuestas[p.question] = [...(elegidas[p.question] || []), otras[p.question]?.trim()].filter(Boolean).join(', ');
    responder(s, { permitir: true, respuestas });
  }

  return (
    <>
      {preguntas.map((p) => (
        <fieldset key={p.question} className="space-y-1.5 min-w-0">
          <legend className="text-[13.5px] font-medium text-digi-text mb-1.5">{p.question}</legend>
          <div className="space-y-1.5">
            {(p.options || []).map((o: any) => {
              const activa = elegidas[p.question]?.includes(o.label);
              return (
                <button key={o.label} type="button" onClick={() => alternar(p, o.label)} aria-pressed={!!activa}
                  className={`w-full text-left rounded-md border px-3 py-2 min-h-11 transition-colors ${activa ? 'border-accent bg-accent-light' : 'border-digi-border hover:border-digi-muted'}`}>
                  <span className="block text-[13px] font-medium text-digi-text">{o.label}</span>
                  {o.description && <span className="block text-[12px] text-digi-muted">{o.description}</span>}
                </button>
              );
            })}
            <input value={otras[p.question] || ''} onChange={(e) => setOtras({ ...otras, [p.question]: e.target.value })} placeholder="Otra respuesta"
              className="w-full h-11 sm:h-9 rounded-md border border-digi-border bg-digi-darker px-3 text-[13px] text-digi-text outline-none focus:border-digi-muted" />
          </div>
        </fieldset>
      ))}
      <div className="flex justify-end gap-2">
        <button type="button" className={BTN_SECONDARY} onClick={() => responder(s, { permitir: false, mensaje: 'El usuario prefirió no responder.' })}>Omitir</button>
        <button type="button" className={BTN_PRIMARY} disabled={!listo} onClick={enviar}>Responder</button>
      </div>
    </>
  );
}

function Permiso({ s, responder }: { s: Solicitud; responder: Responder }) {
  const [motivo, setMotivo] = useState('');
  const plan = s.herramienta === 'ExitPlanMode';
  const detalle = s.entrada?.command || s.entrada?.file_path || JSON.stringify(s.entrada, null, 2);
  return (
    <>
      {plan
        ? <div className="espacio-md text-[13.5px] text-digi-text max-h-[50dvh] overflow-y-auto"><MarkdownRenderer content={s.entrada?.plan || ''} /></div>
        : <pre className="text-[11.5px] font-mono whitespace-pre-wrap break-words max-h-48 overflow-y-auto rounded-md bg-digi-darker p-2.5 text-digi-text">{detalle}</pre>}
      <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={plan ? 'Qué cambiarías' : 'Por qué no'}
        className="w-full h-11 sm:h-9 rounded-md border border-digi-border bg-digi-darker px-3 text-[13px] text-digi-text outline-none focus:border-digi-muted" />
      <div className="flex justify-end gap-2">
        <button type="button" className={BTN_SECONDARY} onClick={() => responder(s, { permitir: false, mensaje: motivo || 'Rechazado por el usuario.' })}>{plan ? 'Seguir planificando' : 'Rechazar'}</button>
        <button type="button" className={BTN_PRIMARY} onClick={() => responder(s, { permitir: true })}>{plan ? 'Aprobar el plan' : 'Permitir'}</button>
      </div>
    </>
  );
}

export default function TarjetaSolicitud({ s, responder }: { s: Solicitud; responder: Responder }) {
  const pregunta = s.herramienta === 'AskUserQuestion';
  const titulo = pregunta ? 'Claude te pregunta' : s.herramienta === 'ExitPlanMode' ? 'Plan para aprobar' : `Permiso para ${s.herramienta}`;
  const Icono = pregunta ? HelpCircle : ShieldQuestion;
  return (
    <div className="rounded-lg border border-digi-border bg-digi-card p-3 space-y-3 min-w-0">
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-amber-400"><Icono className="w-3.5 h-3.5" /> {titulo}</p>
      {pregunta ? <Preguntas s={s} responder={responder} /> : <Permiso s={s} responder={responder} />}
    </div>
  );
}
