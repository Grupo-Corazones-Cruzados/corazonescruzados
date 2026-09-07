'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import PixelModal from '@/components/ui/PixelModal';
import PixelBadge from '@/components/ui/PixelBadge';
import Button, { BTN_SECONDARY } from '@/components/ui/Button';
import { FilaMarcable } from '@/components/ui/ListaMarcable';
import { REFERENCIA_LABEL, REFERENCIA_TIPOS, type ReferenciaTipo } from '@/lib/centralized/generacion-contenido';

const mf = { fontFamily: 'var(--font-body)' } as const;

export interface ReferenciaElegida { tipo: ReferenciaTipo; ref_id: number; titulo: string }
interface Resultado { tipo: ReferenciaTipo; ref_id: number; titulo: string; subtitulo: string }

/**
 * EL BUSCADOR DE REFERENCIA HISTÓRICA: los productos, proyectos y tickets del propio
 * usuario (el administrador busca en todos). Se pueden citar varios, y de tipos distintos:
 * un video suele apoyarse en más de un trabajo real.
 *
 * La fila es `FilaMarcable`, la misma casilla que usan `ListaMarcable` y `MultiSelectSearch`
 * en el resto del panel: no hay una segunda forma de marcar cosas.
 */
export default function SelectorReferencias({
  open, onClose, elegidas, onGuardar,
}: {
  open: boolean;
  onClose: () => void;
  elegidas: ReferenciaElegida[];
  onGuardar: (refs: ReferenciaElegida[]) => void;
}) {
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState<ReferenciaTipo | 'todos'>('todos');
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [cargando, setCargando] = useState(false);
  const [seleccion, setSeleccion] = useState<ReferenciaElegida[]>([]);

  useEffect(() => { if (open) { setSeleccion(elegidas); setQ(''); } }, [open, elegidas]);

  const buscar = useCallback(async (texto: string, t: string) => {
    setCargando(true);
    try {
      const r = await fetch(`/api/centralized/generacion-contenido/referencias?q=${encodeURIComponent(texto)}&tipo=${t}`);
      const d = await r.json();
      setResultados(d.data || []);
    } catch { setResultados([]); } finally { setCargando(false); }
  }, []);

  // Se busca al abrir y al teclear, con un respiro para no disparar una consulta por letra.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => buscar(q, tipo), q ? 300 : 0);
    return () => clearTimeout(id);
  }, [open, q, tipo, buscar]);

  const marcada = useCallback(
    (t: ReferenciaTipo, id: number) => seleccion.some((s) => s.tipo === t && s.ref_id === id),
    [seleccion],
  );

  const alternar = (r: Resultado) => {
    setSeleccion((prev) => prev.some((s) => s.tipo === r.tipo && s.ref_id === r.ref_id)
      ? prev.filter((s) => !(s.tipo === r.tipo && s.ref_id === r.ref_id))
      : [...prev, { tipo: r.tipo, ref_id: r.ref_id, titulo: r.titulo }]);
  };

  // Lo ya elegido se ve arriba aunque el buscador ya no lo devuelva: si no, uno cree que
  // se le ha perdido al cambiar de filtro.
  const fueraDeResultados = useMemo(
    () => seleccion.filter((s) => !resultados.some((r) => r.tipo === s.tipo && r.ref_id === s.ref_id)),
    [seleccion, resultados],
  );

  return (
    <PixelModal open={open} onClose={onClose} title="Referencia histórica" size="lg">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as any)}
            className="field-control px-3 py-2 border border-digi-border rounded text-[13px] text-digi-text bg-digi-card focus:border-accent focus:outline-none"
            style={mf}
          >
            <option value="todos">Todos</option>
            {REFERENCIA_TIPOS.map((t) => <option key={t} value={t}>{REFERENCIA_LABEL[t]}s</option>)}
          </select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-digi-muted pointer-events-none" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar entre tus productos, proyectos y tickets…"
              className="field-control w-full pl-9 pr-3 py-2 border border-digi-border rounded text-[13px] text-digi-text placeholder:text-digi-muted/60 focus:border-accent focus:outline-none"
              style={mf}
            />
          </div>
          <PixelBadge variant={seleccion.length ? 'info' : 'default'}>
            {seleccion.length} elegida{seleccion.length === 1 ? '' : 's'}
          </PixelBadge>
        </div>

        <div className="max-h-[52vh] overflow-y-auto rounded border border-digi-border divide-y divide-digi-border/60">
          {fueraDeResultados.map((s) => (
            <FilaMarcable
              key={`sel-${s.tipo}-${s.ref_id}`}
              marcada
              etiqueta={s.titulo}
              nota={REFERENCIA_LABEL[s.tipo]}
              onClick={() => setSeleccion((prev) => prev.filter((x) => !(x.tipo === s.tipo && x.ref_id === s.ref_id)))}
            />
          ))}
          {cargando ? (
            <p className="px-3 py-3 text-[12px] text-digi-muted" style={mf}>Buscando…</p>
          ) : resultados.length === 0 && fueraDeResultados.length === 0 ? (
            <p className="px-3 py-3 text-[12px] text-digi-muted" style={mf}>
              No hay trabajos que coincidan.
            </p>
          ) : (
            resultados.map((r) => (
              <FilaMarcable
                key={`${r.tipo}-${r.ref_id}`}
                marcada={marcada(r.tipo, r.ref_id)}
                etiqueta={r.titulo}
                nota={`${REFERENCIA_LABEL[r.tipo]}${r.subtitulo ? ` · ${r.subtitulo}` : ''}`}
                onClick={() => alternar(r)}
              />
            ))
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-digi-border">
          <button type="button" onClick={onClose} className={BTN_SECONDARY}>Cancelar</button>
          <Button onClick={() => { onGuardar(seleccion); onClose(); }}>Usar estas referencias</Button>
        </div>
      </div>
    </PixelModal>
  );
}
