'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, BookOpen } from 'lucide-react';
import PixelModal from '@/components/ui/PixelModal';
import PixelTabs from '@/components/ui/PixelTabs';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import Button, { BTN_SECONDARY } from '@/components/ui/Button';
import { FUENTE_LABEL, FUENTE_TIPOS, type FuenteTipo } from '@/lib/centralized/generacion-contenido';

const mf = { fontFamily: 'var(--font-body)' } as const;

export interface FuenteElegida { tipo: FuenteTipo; ref_id: number; etiqueta: string }
interface Fila { id: number; etiqueta: string; texto: string; extra: string }

/**
 * EL PANEL DE FUENTES DE CONOCIMIENTO — se abre como el de Gestión de Datos, pero **no
 * edita nada**: aquí solo se marca lo que el video va a citar.
 *
 * Se elige la problemática, se mira cada nivel de la tubería condiciológica en tabla
 * (códigos, categorías, piezas, rompecabezas, subtemas y temas) y se marca con la casilla de
 * la izquierda. La selección se conserva **entre pestañas y entre problemáticas**: un video
 * puede beber de dos investigaciones distintas.
 *
 * Va en panel `xl` (1040px) porque lleva una tabla dentro — es la razón por la que esa
 * variante existe.
 */
export default function SelectorFuentes({
  open, onClose, elegidas, onGuardar,
}: {
  open: boolean;
  onClose: () => void;
  elegidas: FuenteElegida[];
  onGuardar: (fuentes: FuenteElegida[]) => void;
}) {
  const [problematicas, setProblematicas] = useState<{ id: number; name: string; ref: string }[]>([]);
  const [probId, setProbId] = useState<number | null>(null);
  const [datos, setDatos] = useState<Record<string, Fila[]> | null>(null);
  const [tab, setTab] = useState<FuenteTipo>('codigo');
  const [busca, setBusca] = useState('');
  const [cargando, setCargando] = useState(false);
  const [seleccion, setSeleccion] = useState<FuenteElegida[]>([]);

  // Al abrir se parte de lo que ya tenía la idea: el panel no es un lienzo en blanco.
  useEffect(() => { if (open) setSeleccion(elegidas); }, [open, elegidas]);

  useEffect(() => {
    if (!open) return;
    fetch('/api/centralized/generacion-contenido/fuentes')
      .then((r) => r.json())
      .then((d) => {
        const lista = d.data?.problematicas || [];
        setProblematicas(lista);
        setProbId((prev) => prev ?? (lista[0]?.id ?? null));
      })
      .catch(() => { /* el panel se queda vacío y lo dice */ });
  }, [open]);

  const cargar = useCallback(async (id: number) => {
    setCargando(true);
    try {
      const r = await fetch(`/api/centralized/generacion-contenido/fuentes?problematica_id=${id}`);
      const d = await r.json();
      setDatos(d.data || null);
    } catch { setDatos(null); } finally { setCargando(false); }
  }, []);

  useEffect(() => { if (open && probId) cargar(probId); }, [open, probId, cargar]);

  const filas = useMemo(() => {
    const base: Fila[] = (datos?.[tab] as Fila[]) || [];
    const q = busca.trim().toLowerCase();
    if (!q) return base;
    // El filtro corre sobre TODO lo que se ve de la fila, que es lo que uno espera al
    // escribir en un buscador que está encima de una tabla.
    return base.filter((f) =>
      `${f.etiqueta} ${f.texto} ${f.extra}`.toLowerCase().includes(q));
  }, [datos, tab, busca]);

  const marcada = useCallback(
    (tipo: FuenteTipo, id: number) => seleccion.some((s) => s.tipo === tipo && s.ref_id === id),
    [seleccion],
  );

  const alternar = (tipo: FuenteTipo, fila: Fila) => {
    setSeleccion((prev) => prev.some((s) => s.tipo === tipo && s.ref_id === fila.id)
      ? prev.filter((s) => !(s.tipo === tipo && s.ref_id === fila.id))
      : [...prev, { tipo, ref_id: fila.id, etiqueta: fila.etiqueta || String(fila.id) }]);
  };

  const columnas = [
    {
      key: 'sel', header: '', width: '44px',
      render: (f: Fila) => (
        <span className={`w-4 h-4 inline-flex items-center justify-center rounded border
          ${marcada(tab, f.id) ? 'bg-accent border-accent text-white' : 'border-digi-border'}`}>
          {marcada(tab, f.id) && <span className="text-[10px] leading-none">✓</span>}
        </span>
      ),
    },
    {
      key: 'etiqueta', header: FUENTE_LABEL[tab].replace(/s$/, ''), width: '30%',
      render: (f: Fila) => <span className="font-medium text-digi-text">{f.etiqueta || `#${f.id}`}</span>,
    },
    { key: 'texto', header: 'Contenido', render: (f: Fila) => <span className="text-digi-muted">{f.texto}</span> },
    { key: 'extra', header: '', width: '22%', render: (f: Fila) => <span className="text-digi-muted text-[11.5px]">{f.extra}</span> },
  ];

  const conteo = (t: FuenteTipo) => (datos?.[t] as Fila[] | undefined)?.length ?? 0;

  return (
    <PixelModal open={open} onClose={onClose} title="Fuentes de conocimiento" size="xl">
      <div className="flex flex-col gap-3 min-h-0">
        {/* Una fila de controles, no tres: problemática + buscador + lo elegido. */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={probId ?? ''}
            onChange={(e) => setProbId(Number(e.target.value) || null)}
            className="field-control px-3 py-2 border border-digi-border rounded text-[13px] text-digi-text bg-digi-card focus:border-accent focus:outline-none"
            style={mf}
          >
            {problematicas.length === 0 && <option value="">Sin problemáticas</option>}
            {problematicas.map((p) => (
              <option key={p.id} value={p.id}>{p.ref} · {p.name}</option>
            ))}
          </select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-digi-muted pointer-events-none" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar sobre cualquier columna…"
              className="field-control w-full pl-9 pr-3 py-2 border border-digi-border rounded text-[13px] text-digi-text placeholder:text-digi-muted/60 focus:border-accent focus:outline-none"
              style={mf}
            />
          </div>
          <PixelBadge variant={seleccion.length ? 'info' : 'default'}>
            {seleccion.length} elegida{seleccion.length === 1 ? '' : 's'}
          </PixelBadge>
        </div>

        <PixelTabs
          tabs={FUENTE_TIPOS.map((t) => ({ value: t, label: FUENTE_LABEL[t], count: conteo(t) }))}
          active={tab}
          onChange={(v) => setTab(v as FuenteTipo)}
        />

        {cargando ? (
          <div className="py-16 text-center text-[13px] text-digi-muted" style={mf}>Cargando…</div>
        ) : (
          <PixelDataTable
            columns={columnas}
            data={filas}
            onRowClick={(f: Fila) => alternar(tab, f)}
            singleLine
            bottomReserve={72}
            emptyTitle="Nada que elegir aquí"
            emptyDesc={problematicas.length === 0
              ? 'Todavía no hay problemáticas en Gestión de Datos.'
              : `Esta problemática no tiene ${FUENTE_LABEL[tab].toLowerCase()}.`}
          />
        )}

        <div className="flex items-center gap-2 pt-3 border-t border-digi-border">
          <span className="text-[12px] text-digi-muted inline-flex items-center gap-1.5" style={mf}>
            <BookOpen className="w-3.5 h-3.5" /> Solo lectura: aquí no se edita la investigación.
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={onClose} className={BTN_SECONDARY}>Cancelar</button>
            <Button onClick={() => { onGuardar(seleccion); onClose(); }}>Usar estas fuentes</Button>
          </div>
        </div>
      </div>
    </PixelModal>
  );
}
