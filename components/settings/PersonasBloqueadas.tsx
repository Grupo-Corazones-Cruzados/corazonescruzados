'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Ban } from 'lucide-react';
import GrupoForm from './GrupoForm';
import BotonQuitar from '@/components/ui/BotonQuitar';

const mf = { fontFamily: 'var(--font-body)' } as const;
const fecha = (s: string) => new Date(s).toLocaleDateString('es-EC', { dateStyle: 'medium', timeZone: 'America/Guayaquil' });

/**
 * PERSONAS BLOQUEADAS (Apple, norma 1.2; 2026-11-13). Quien se bloquea desde el «⋯» del Marketplace o de un chat
 * aparece aquí; quitarlo de la lista lo desbloquea y vuelve a verse lo que publica.
 */
export default function PersonasBloqueadas() {
  const [lista, setLista] = useState<{ id: number; nombre: string; creado_en: string }[] | null>(null);
  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/moderacion/bloqueos', { cache: 'no-store' });
      const j = await r.json();
      setLista(j.data?.lista || []);
    } catch { setLista((l) => l ?? []); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const desbloquear = async (id: number) => {
    try {
      const r = await fetch(`/api/moderacion/bloqueos/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'No se pudo desbloquear');
      toast.success('Desbloqueado');
    } catch (e: any) { toast.error(e.message); }
    finally { cargar(); }
  };

  return (
    <GrupoForm titulo="Personas bloqueadas">
      {lista === null ? (
        <p className="text-[12px] text-digi-muted" style={mf}>Cargando…</p>
      ) : lista.length === 0 ? (
        <p className="text-[12px] text-digi-muted" style={mf}>No has bloqueado a nadie.</p>
      ) : (
        <ul className="divide-y divide-digi-border rounded border border-digi-border">
          {lista.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[12.5px] text-digi-text flex items-center gap-1.5 truncate" style={mf}>
                  <Ban className="w-3.5 h-3.5 shrink-0" /> {b.nombre}
                </p>
                <p className="text-[11px] text-digi-muted" style={mf}>Bloqueado el {fecha(b.creado_en)}</p>
              </div>
              <BotonQuitar onClick={() => desbloquear(b.id)} etiqueta={`Desbloquear a ${b.nombre}`} />
            </li>
          ))}
        </ul>
      )}
    </GrupoForm>
  );
}
