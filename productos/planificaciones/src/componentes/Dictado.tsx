'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/**
 * EL MICRÓFONO. El docente pulsa, cuenta la semana, vuelve a pulsar y el texto
 * aparece en el cuadro (Fernando, 2026-09-15: «que sea transcrito lo dicho
 * automáticamente en un recuadro de entrada de texto»). Graba con MediaRecorder
 * y manda el audio a `/api/transcribir`, que lo pasa por OpenAI: funciona en
 * cualquier navegador con micrófono, no solo en los que traen reconocimiento.
 */
export function Dictado({ slug, alTranscribir, deshabilitado }: { slug: string; alTranscribir: (texto: string) => void; deshabilitado?: boolean }) {
  const [estado, setEstado] = useState<'quieto' | 'grabando' | 'transcribiendo'>('quieto');
  const [segundos, setSegundos] = useState(0);
  const grabadora = useRef<MediaRecorder | null>(null);
  const trozos = useRef<Blob[]>([]);
  const reloj = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    grabadora.current?.stream.getTracks().forEach((t) => t.stop());
    if (reloj.current) clearInterval(reloj.current);
  }, []);

  async function empezar() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Este navegador no permite usar el micrófono.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tipo = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported(t));
      const g = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
      trozos.current = [];
      g.ondataavailable = (e) => e.data.size && trozos.current.push(e.data);
      g.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (reloj.current) clearInterval(reloj.current);
        const audio = new Blob(trozos.current, { type: g.mimeType || 'audio/webm' });
        if (audio.size < 1000) {
          setEstado('quieto');
          return;
        }
        setEstado('transcribiendo');
        try {
          const fd = new FormData();
          fd.append('audio', audio, 'dictado.webm');
          const r = await fetch(`/${slug}/api/transcribir`, { method: 'POST', body: fd });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error || 'No se pudo transcribir.');
          if (j.texto) alTranscribir(j.texto);
          else toast.info('No se entendió nada en la grabación.');
        } catch (e: any) {
          toast.error(e?.message ?? 'No se pudo transcribir.');
        } finally {
          setEstado('quieto');
        }
      };
      grabadora.current = g;
      g.start();
      setSegundos(0);
      reloj.current = setInterval(() => setSegundos((s) => s + 1), 1000);
      setEstado('grabando');
    } catch {
      toast.error('No se pudo acceder al micrófono. Revisa los permisos del navegador.');
    }
  }

  function parar() {
    grabadora.current?.stop();
  }

  const mmss = `${String(Math.floor(segundos / 60)).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`;

  return (
    <button
      type="button"
      onClick={estado === 'grabando' ? parar : empezar}
      disabled={deshabilitado || estado === 'transcribiendo'}
      className={cn(
        'inline-flex h-8 items-center gap-2 rounded px-3 text-[12px] font-semibold transition-colors foco-visible disabled:cursor-not-allowed disabled:opacity-50',
        estado === 'grabando' ? 'bg-error text-white' : 'border border-borde bg-tarjeta text-texto hover:bg-realce',
      )}
      title={estado === 'grabando' ? 'Parar y transcribir' : 'Dictar con el micrófono'}
    >
      {estado === 'transcribiendo' ? <Loader2 className="h-4 w-4 animate-spin" /> : estado === 'grabando' ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
      {estado === 'transcribiendo' ? 'Transcribiendo…' : estado === 'grabando' ? `Parar · ${mmss}` : 'Dictar'}
    </button>
  );
}
