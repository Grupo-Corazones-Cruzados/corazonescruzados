'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Flag, Trash2, Check } from 'lucide-react';
import PixelConfirm from '@/components/ui/PixelConfirm';
import Segmentado from '@/components/ui/Segmentado';
import { BTN_ICONO_FILA } from '@/components/ui/Button';

const mf = { fontFamily: 'var(--font-body)' } as const;

const MOTIVO: Record<string, string> = {
  ofensivo: 'Contenido ofensivo', acoso: 'Acoso o amenazas', engano: 'Engaño o fraude', spam: 'Spam', otro: 'Otro motivo',
};
const TIPO: Record<string, string> = { portafolio: 'Ficha del Marketplace', proyecto: 'Proyecto del Marketplace', mensaje: 'Mensaje de chat' };
const ESTADO: Record<string, string> = { pendiente: 'Pendiente', retirado: 'Contenido retirado', descartada: 'Descartada' };

type Denuncia = {
  id: number; tipo: string; objeto_id: string; motivo: string; detalle: string | null; extracto: string | null;
  estado: string; creada_en: string; resuelta_en: string | null;
  denunciante: string | null; denunciante_correo: string | null; autor: string | null; autor_correo: string | null;
};

const fecha = (s: string) => new Date(s).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Guayaquil' });

/**
 * DENUNCIAS (Apple, norma 1.2; Fernando, 2026-11-13). Lo que los usuarios denunciaron desde el «⋯» del Marketplace y de
 * los chats. Apple espera que se actúe en menos de 24 horas: «Retirar» quita el contenido (y cierra las demás
 * denuncias sobre lo mismo); «Descartar» la cierra sin tocar nada. A cada administrador le llega el aviso.
 */
export default function DenunciasPanel() {
  const [vista, setVista] = useState<'pendiente' | 'todas'>('pendiente');
  const [lista, setLista] = useState<Denuncia[] | null>(null);
  const [confirmar, setConfirmar] = useState<{ d: Denuncia; accion: 'retirar' | 'descartar' } | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/moderacion/denuncias?estado=${vista}`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'No se pudieron cargar las denuncias');
      setLista(j.data || []);
    } catch (e: any) { toast.error(e.message); setLista((l) => l ?? []); }
  }, [vista]);
  useEffect(() => { cargar(); }, [cargar]);

  const resolver = async () => {
    if (!confirmar) return;
    try {
      const r = await fetch(`/api/moderacion/denuncias/${confirmar.d.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: confirmar.accion }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'No se pudo resolver');
      toast.success(confirmar.accion === 'retirar' ? 'Contenido retirado' : 'Denuncia descartada');
    } catch (e: any) { toast.error(e.message); }
    finally { setConfirmar(null); cargar(); }
  };

  return (
    <div className="space-y-3" style={mf}>
      <Segmentado valor={vista} onChange={setVista}
        opciones={[{ valor: 'pendiente', texto: 'Pendientes' }, { valor: 'todas', texto: 'Todas' }]} />
      {lista === null ? (
        <p className="text-center text-[13px] text-digi-muted py-10">Cargando…</p>
      ) : lista.length === 0 ? (
        <div className="bg-digi-card border border-digi-border rounded-lg text-center py-12">
          <Flag className="w-8 h-8 mx-auto text-digi-muted/40 mb-2" />
          <p className="text-[14px] font-semibold text-digi-text">{vista === 'pendiente' ? 'Sin denuncias pendientes' : 'Sin denuncias'}</p>
        </div>
      ) : (
        <ul className="divide-y divide-digi-border border border-digi-border rounded-lg bg-digi-card">
          {lista.map((d) => (
            <li key={d.id} className="flex items-start gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 text-[13.5px]">
                  <span className="font-semibold text-digi-text">{MOTIVO[d.motivo] || d.motivo}</span>
                  <span className="text-digi-muted">· {TIPO[d.tipo] || d.tipo}</span>
                  {d.estado !== 'pendiente' && <span className="text-digi-muted">· {ESTADO[d.estado]}</span>}
                </div>
                {d.extracto && <p className="mt-1 text-[13px] text-digi-text line-clamp-3 whitespace-pre-wrap">{d.extracto}</p>}
                {d.detalle && <p className="mt-1 text-[12.5px] text-digi-muted">«{d.detalle}»</p>}
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-digi-muted">
                  <span>Denuncia: {d.denunciante || d.denunciante_correo || '—'}</span>
                  {(d.autor || d.autor_correo) && <span>Autor: {d.autor || d.autor_correo}</span>}
                  <span className="tabular-nums">{fecha(d.creada_en)}</span>
                </div>
              </div>
              {d.estado === 'pendiente' && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <button type="button" onClick={() => setConfirmar({ d, accion: 'descartar' })} className={BTN_ICONO_FILA}
                    title="Descartar" aria-label="Descartar"><Check className="w-4 h-4" /></button>
                  <button type="button" onClick={() => setConfirmar({ d, accion: 'retirar' })} className={`${BTN_ICONO_FILA} text-red-600`}
                    title="Retirar el contenido" aria-label="Retirar el contenido"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <PixelConfirm open={!!confirmar}
        title={confirmar?.accion === 'retirar' ? 'Retirar el contenido' : 'Descartar la denuncia'}
        message={confirmar?.accion === 'retirar'
          ? (confirmar.d.tipo === 'mensaje' ? 'Se borra el mensaje del chat.' : confirmar.d.tipo === 'proyecto' ? 'El proyecto deja de estar publicado en el Marketplace.' : 'La ficha deja de verse en el Marketplace; su autor la conserva.')
          : 'Se cierra la denuncia sin tocar el contenido.'}
        confirmLabel={confirmar?.accion === 'retirar' ? 'Retirar' : 'Descartar'}
        danger={confirmar?.accion === 'retirar'} onConfirm={resolver} onCancel={() => setConfirmar(null)} />
    </div>
  );
}
