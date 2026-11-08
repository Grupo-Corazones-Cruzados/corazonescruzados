'use client';

import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { CalendarDays, CalendarRange, History, LayoutGrid, Plus } from 'lucide-react';
import { useConsultaMedia, PANTALLA_XL } from '@/lib/hooks/useConsultaMedia';
import FilterRail, { type FilterRailItem } from '@/components/ui/FilterRail';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelModal from '@/components/ui/PixelModal';
import PanelHastaElPie from '@/components/ui/PanelHastaElPie';
import BarraLista, { type AccionLista } from '@/components/ui/BarraLista';
import type { UsoHerramienta } from '@/lib/herramientas/usos';

const mf = { fontFamily: 'var(--font-body)' } as const;

const PERIODOS = [
  { value: 'all', label: 'Todos', Icon: LayoutGrid },
  { value: 'hoy', label: 'Hoy', Icon: CalendarDays },
  { value: 'semana', label: 'Últimos 7 días', Icon: CalendarRange },
  { value: 'mes', label: 'Este mes', Icon: CalendarRange },
  { value: 'antes', label: 'Anteriores', Icon: History },
];

function enPeriodo(fecha: string, periodo: string): boolean {
  if (periodo === 'all') return true;
  const f = new Date(fecha);
  const ahora = new Date();
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  if (periodo === 'hoy') return f >= hoy;
  if (periodo === 'semana') return f >= new Date(hoy.getTime() - 6 * 86_400_000);
  if (periodo === 'mes') return f >= inicioMes;
  return f < inicioMes;
}

const fecha = (s: string) =>
  new Date(s).toLocaleString('es-EC', { day: 'numeric', month: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' });

/**
 * EL PANEL DE HISTORIAL DE UNA HERRAMIENTA (Fernando, 2026-11-08: «que lo primero que se vea sea esta
 * interfaz de panel en cada herramienta, y en la misma interfaz el formulario para usarla»). La misma
 * disposición que Entregas de un solo uso: el filtro a la izquierda, la lista con su buscador en el
 * centro y el detalle a la derecha (en el teléfono, encima). El botón principal de la barra abre el
 * formulario de la herramienta en el panel lateral derecho (`PixelModal` md, 1040 px, se cierra con el
 * velo). Solo se guarda el registro de cada uso (`lib/herramientas/usos.ts`).
 */
export default function HistorialHerramienta({
  herramienta, Icono, accion, formulario, abierto, onAbrir, onCerrar, version, unidad, etiquetas = {}, acciones = [],
}: {
  herramienta: string;
  Icono: ComponentType<{ className?: string }>;
  /** Texto del botón principal: «Nuevo QR», «Nueva transcripción»… */
  accion: string;
  formulario: ReactNode;
  abierto: boolean;
  onAbrir: () => void;
  onCerrar: () => void;
  /** Cambia cuando se anota un uso: la lista se vuelve a pedir. */
  version: number;
  unidad: [string, string];
  /** Nombre visible de cada clave del detalle. */
  etiquetas?: Record<string, string>;
  /** Botones secundarios antes del principal (Compartir y Accesos en las compartibles). */
  acciones?: AccionLista[];
}) {
  const [usos, setUsos] = useState<UsoHerramienta[] | null>(null);
  const [deTodos, setDeTodos] = useState(false);
  const [periodo, setPeriodo] = useState('all');
  const [busqueda, setBusqueda] = useState('');
  const [selId, setSelId] = useState<number | null>(null);
  const enTelefono = !useConsultaMedia(PANTALLA_XL);

  const cargar = useCallback(() => {
    fetch(`/api/herramientas/usos?herramienta=${herramienta}`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => { setUsos(j.data ?? []); setDeTodos(!!j.deTodos); })
      .catch(() => setUsos([]));
  }, [herramienta]);
  useEffect(() => { cargar(); }, [cargar, version]);
  useEffect(() => { setSelId(null); setPeriodo('all'); setBusqueda(''); }, [herramienta]);

  const conteos = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of PERIODOS) c[p.value] = (usos ?? []).filter((u) => enPeriodo(u.creado_en, p.value)).length;
    return c;
  }, [usos]);
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (usos ?? []).filter((u) => enPeriodo(u.creado_en, periodo)
      && (!q || `${u.titulo} ${Object.values(u.detalle).join(' ')} ${u.persona ?? ''}`.toLowerCase().includes(q)));
  }, [usos, periodo, busqueda]);
  const sel = filtrados.find((u) => u.id === selId) ?? (usos ?? []).find((u) => u.id === selId) ?? null;
  const resumen = (u: UsoHerramienta) => Object.values(u.detalle).join(' · ');

  const railItems: FilterRailItem<string>[] = PERIODOS.map((p) => ({ value: p.value, label: p.label, Icon: p.Icon, count: conteos[p.value] ?? 0 }));

  const fila = (k: string, v: ReactNode) => (
    <div className="flex items-start justify-between gap-3 text-[12px]">
      <span className="text-digi-muted shrink-0" style={mf}>{k}</span>
      <span className="text-digi-text text-right break-words min-w-0" style={mf}>{v}</span>
    </div>
  );
  const detalle = !sel ? null : (
    <div className="p-4 space-y-2">
      {Object.entries(sel.detalle).map(([k, v]) => <div key={k}>{fila(etiquetas[k] ?? k, v)}</div>)}
      {deTodos && fila('Persona', sel.persona || '—')}
      {fila('Fecha', fecha(sel.creado_en))}
    </div>
  );

  return (
    <div>
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <FilterRail title="Fecha" items={railItems} value={periodo} onChange={setPeriodo} />
        <div className="flex-1 min-w-0 w-full">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
            <div className="min-w-0">
              <BarraLista busqueda={busqueda} onBusqueda={setBusqueda} placeholder="Buscar en el historial..."
                acciones={[...acciones, { label: accion, icon: Plus, onClick: onAbrir, tipo: 'primaria' }]} />
              <PixelDataTable
                unidad={unidad}
                singleLine
                data={filtrados}
                onRowClick={(u: UsoHerramienta) => setSelId(u.id)}
                emptyTitle={usos === null ? 'Cargando…' : 'Sin usos todavía'}
                emptyDesc={usos === null ? '' : `Pulsa «${accion}» para usar la herramienta.`}
                columns={[
                  { key: 'titulo', header: 'Nombre', render: (u: UsoHerramienta) => (
                    <span className={`truncate text-[13px] font-medium ${selId === u.id ? 'text-accent' : 'text-digi-text'}`} style={mf}>{u.titulo}</span>
                  ) },
                  { key: 'detalle', header: 'Detalle', hideOnMobile: true, render: (u: UsoHerramienta) => <span className="text-[12px] text-digi-muted truncate" style={mf}>{resumen(u) || '—'}</span> },
                  ...(deTodos ? [{ key: 'persona', header: 'Persona', width: '150px', hideOnMobile: true, render: (u: UsoHerramienta) => <span className="text-[12px] text-digi-muted truncate" style={mf}>{u.persona || '—'}</span> }] : []),
                  { key: 'fecha', header: 'Fecha', width: '140px', hideOnMobile: true, render: (u: UsoHerramienta) => <span className="text-[12px] text-digi-muted" style={mf}>{fecha(u.creado_en)}</span> },
                ]}
                tarjetaMovil={(u: UsoHerramienta) => (
                  <>
                    <span className="block text-[13.5px] font-medium text-digi-text leading-snug" style={mf}>{u.titulo}</span>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-digi-muted" style={mf}>
                      {resumen(u) && <span className="truncate">{resumen(u)}</span>}
                      <span className="ml-auto">{fecha(u.creado_en)}</span>
                    </div>
                  </>
                )}
              />
            </div>

            <aside className="hidden xl:block w-full xl:w-[360px]">
              {!sel ? (
                <PanelHastaElPie desdeAncho={1280} className="bg-digi-card border border-digi-border rounded-lg p-6 text-center flex flex-col items-center justify-center">
                  <div className="w-10 h-10 rounded-lg bg-black/[0.03] flex items-center justify-center mx-auto mb-2">
                    <Icono className="w-5 h-5 text-digi-muted" />
                  </div>
                  <p className="text-[12px] text-digi-muted" style={mf}>Selecciona un uso para ver su detalle.</p>
                </PanelHastaElPie>
              ) : (
                <PanelHastaElPie desdeAncho={1280} className="bg-digi-card border border-digi-border rounded-lg shadow-sm">
                  <div className="p-4 border-b border-digi-border">
                    <h3 className="text-[14px] font-semibold text-digi-text leading-tight break-words" style={mf}>{sel.titulo}</h3>
                  </div>
                  {detalle}
                </PanelHastaElPie>
              )}
            </aside>
          </div>
        </div>
      </div>

      {enTelefono && (
        <PixelModal open={!!sel} onClose={() => setSelId(null)} title={sel?.titulo ?? ''} size="md">
          {detalle}
        </PixelModal>
      )}

      {/* El formulario para usar la herramienta, en el panel lateral derecho. */}
      <PixelModal open={abierto} onClose={onCerrar} title={accion} size="md">
        {formulario}
      </PixelModal>
    </div>
  );
}
