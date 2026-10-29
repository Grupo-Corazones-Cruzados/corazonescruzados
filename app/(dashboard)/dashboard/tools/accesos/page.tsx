'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useConsultaMedia, PANTALLA_XL } from '@/lib/hooks/useConsultaMedia';
import { useAuth } from '@/components/providers/AuthProvider';
import PageHeader from '@/components/ui/PageHeader';
import FilterRail, { type FilterRailItem } from '@/components/ui/FilterRail';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import PixelConfirm from '@/components/ui/PixelConfirm';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { fmtInt } from '@/lib/format';
import { Trash2, Share2, CircleDot, Lock, Clock, Search, Copy, LayoutGrid } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

type Variante = 'default' | 'info' | 'success' | 'warning' | 'error';
type Acceso = {
  id: number; url: string; herramienta: string; herramienta_nombre: string; titulo: string; cliente_nombre: string | null;
  exige_cuenta: boolean; estado: 'vigente' | 'cerrado' | 'vencido'; vence_en: string; enviado_a: string | null;
  creado_en: string; usos: number; ultimo_uso: string | null; cerrado_en: string | null; creador_nombre: string | null;
};

const ESTADOS = [
  { value: 'all', label: 'Todos', Icon: LayoutGrid },
  { value: 'vigente', label: 'Vigentes', Icon: CircleDot },
  { value: 'cerrado', label: 'Cerrados', Icon: Lock },
  { value: 'vencido', label: 'Vencidos', Icon: Clock },
];
const ESTADO: Record<string, { label: string; v: Variante }> = {
  vigente: { label: 'Vigente', v: 'info' }, cerrado: { label: 'Cerrado', v: 'default' }, vencido: { label: 'Vencido', v: 'warning' },
};

const fecha = (s: string | null) => (s ? new Date(s).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }) : '—');

/**
 * Accesos compartidos a herramientas (Herramientas → «Compartir acceso»): cada fila es un
 * enlace con token, su vigencia y cuántas veces se usó. Mismo patrón que los enlaces de un solo uso.
 */
export default function AccesosPage() {
  // El panel de teléfono NO se monta en escritorio: un <dialog> montado deja inerte la página.
  const enTelefono = !useConsultaMedia(PANTALLA_XL);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [accesos, setAccesos] = useState<Acceso[] | null>(null);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [selId, setSelId] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState<'cerrar' | 'eliminar' | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/herramientas/accesos', { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudieron cargar los accesos');
      setAccesos(d.data || []);
    } catch (e: any) { toast.error(e.message); setAccesos((p) => p ?? []); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: accesos?.length || 0 };
    for (const a of accesos || []) c[a.estado] = (c[a.estado] || 0) + 1;
    return c;
  }, [accesos]);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (accesos || []).filter((a) => {
      if (tab !== 'all' && a.estado !== tab) return false;
      if (q && ![a.herramienta_nombre, a.titulo, a.cliente_nombre, a.enviado_a].some((x) => x?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [accesos, tab, search]);

  const sel = accesos?.find((a) => a.id === selId) || null;
  const railItems: FilterRailItem<string>[] = ESTADOS.map((s) => ({ value: s.value, label: s.label, Icon: s.Icon, count: counts[s.value] ?? 0 }));
  const nombre = (a: Acceso) => a.titulo || a.cliente_nombre || a.enviado_a || `Acceso #${a.id}`;

  const copiar = (url: string) => { navigator.clipboard.writeText(url); toast.success('Enlace copiado'); };

  const ejecutar = async () => {
    if (!sel || !confirmar) return;
    const eliminar = confirmar === 'eliminar';
    setOcupado(true);
    try {
      const r = await fetch(`/api/herramientas/accesos/${sel.id}`, eliminar
        ? { method: 'DELETE' }
        : { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'cerrar' }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || (eliminar ? 'No se pudo eliminar' : 'No se pudo cerrar'));
      toast.success(eliminar ? 'Acceso eliminado' : 'Acceso cerrado');
      if (eliminar) setSelId(null);
    } catch (e: any) { toast.error(e.message); }
    finally { setOcupado(false); setConfirmar(null); cargar(); }
  };

  const fila = (k: string, v: React.ReactNode) => (
    <div className="flex items-start justify-between gap-3 text-[12px]">
      <span className="text-digi-muted shrink-0" style={mf}>{k}</span>
      <span className="text-digi-text text-right break-words min-w-0" style={mf}>{v}</span>
    </div>
  );

  /** El cuerpo del detalle, una sola vez: columna en escritorio, panel en teléfono. */
  const detalle = !sel ? null : (
    <div className="p-4 space-y-3">
      <div className="space-y-2">
        {fila('Estado', <PixelBadge variant={ESTADO[sel.estado].v}>{ESTADO[sel.estado].label}</PixelBadge>)}
        {fila('Herramienta', sel.herramienta_nombre)}
        {fila('Cliente', sel.cliente_nombre ? `${sel.cliente_nombre}${sel.exige_cuenta ? ' · pide su cuenta' : ''}` : '—')}
        {sel.enviado_a && fila('Enviado a', sel.enviado_a)}
        {isAdmin && fila('Creado por', sel.creador_nombre || '—')}
        {fila('Creado', fecha(sel.creado_en))}
        {sel.estado === 'cerrado' ? fila('Cerrado', fecha(sel.cerrado_en)) : fila('Vence', fecha(sel.vence_en))}
        {fila('Usos', fmtInt(sel.usos))}
        {fila('Último uso', fecha(sel.ultimo_uso))}
      </div>

      <div className="pt-3 border-t border-digi-border flex flex-wrap gap-2">
        <button onClick={() => setConfirmar('eliminar')} disabled={ocupado} className={BTN_DANGER}><Trash2 className="w-4 h-4" /> Eliminar</button>
        {sel.estado === 'vigente' && (
          <div className="ml-auto flex gap-2">
            <button onClick={() => setConfirmar('cerrar')} disabled={ocupado} className={BTN_SECONDARY}><Lock className="w-4 h-4" /> Cerrar</button>
            <button onClick={() => copiar(sel.url)} className={BTN_PRIMARY}><Copy className="w-4 h-4" /> Copiar enlace</button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader title="Accesos compartidos" description="Los enlaces a herramientas y cuánto se usan" />

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <FilterRail title="Estado" items={railItems} value={tab} onChange={setTab} />

        <div className="flex-1 min-w-0 w-full">
          <div className="relative w-full mb-3">
            <Search className="w-4 h-4 text-digi-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Herramienta, persona o cliente…"
              className="field-control w-full pl-8 pr-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none" style={mf} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
            <div className="min-w-0">
              <PixelDataTable
            unidad={['acceso', 'accesos']}
                singleLine
                data={filtrados}
                onRowClick={(a: Acceso) => setSelId(a.id)}
                emptyTitle={accesos === null ? 'Cargando…' : 'Sin accesos'}
                emptyDesc={accesos === null ? '' : 'Comparte uno desde Herramientas → la herramienta → Compartir acceso.'}
                columns={[
                  { key: 'nombre', header: 'Para quién', render: (a: Acceso) => (
                    <span className={`truncate text-[13px] font-medium ${selId === a.id ? 'text-accent' : 'text-digi-text'}`} style={mf}>{nombre(a)}</span>
                  ) },
                  { key: 'herramienta', header: 'Herramienta', width: '200px', hideOnMobile: true, render: (a: Acceso) => <span className="text-[12px] text-digi-muted truncate" style={mf}>{a.herramienta_nombre}</span> },
                  { key: 'estado', header: 'Estado', width: '100px', hideOnMobile: true, render: (a: Acceso) => <PixelBadge variant={ESTADO[a.estado].v}>{ESTADO[a.estado].label}</PixelBadge> },
                  { key: 'usos', header: 'Usos', width: '70px', hideOnMobile: true, render: (a: Acceso) => <span className="text-[12px] text-digi-muted tabular-nums" style={mf}>{fmtInt(a.usos)}</span> },
                  { key: 'vence', header: 'Vence', width: '130px', hideOnMobile: true, render: (a: Acceso) => <span className="text-[12px] text-digi-muted" style={mf}>{fecha(a.vence_en)}</span> },
                ]}
                tarjetaMovil={(a: Acceso) => (
                  <>
                    <div className="flex items-start gap-2">
                      <span className="flex-1 min-w-0 text-[13.5px] font-medium text-digi-text leading-snug" style={mf}>{nombre(a)}</span>
                      <span className="shrink-0"><PixelBadge variant={ESTADO[a.estado].v}>{ESTADO[a.estado].label}</PixelBadge></span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-digi-muted" style={mf}>
                      <span>{a.herramienta_nombre}</span>
                      <span className="tabular-nums">{fmtInt(a.usos)} {a.usos === 1 ? 'uso' : 'usos'}</span>
                      <span className="ml-auto">{fecha(a.vence_en)}</span>
                    </div>
                  </>
                )}
              />
            </div>

            <aside className="hidden xl:block w-full xl:w-[360px]">
              {!sel ? (
                <div className="bg-digi-card border border-digi-border rounded-lg p-6 text-center lg:sticky lg:top-4">
                  <div className="w-10 h-10 rounded-lg bg-black/[0.03] flex items-center justify-center mx-auto mb-2">
                    <Share2 className="w-5 h-5 text-digi-muted" />
                  </div>
                  <p className="text-[12px] text-digi-muted" style={mf}>Selecciona un acceso para ver su detalle.</p>
                </div>
              ) : (
                <div className="bg-digi-card border border-digi-border rounded-lg shadow-sm overflow-hidden lg:sticky lg:top-4">
                  <div className="p-4 border-b border-digi-border">
                    <h3 className="text-[14px] font-semibold text-digi-text leading-tight" style={mf}>{nombre(sel)}</h3>
                    <p className="text-[11px] text-digi-muted mt-0.5" style={mf}>Acceso #{sel.id}</p>
                  </div>
                  {detalle}
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>

      {enTelefono && (
        <PixelModal open={!!sel} onClose={() => setSelId(null)} title={sel ? nombre(sel) : 'Acceso'} size="md">
          {detalle}
        </PixelModal>
      )}

      <PixelConfirm
        open={!!confirmar}
        title={confirmar === 'eliminar' ? 'Eliminar acceso' : 'Cerrar acceso'}
        message={confirmar === 'eliminar'
          ? 'Se borra el acceso y su registro de usos. El enlace dejará de abrir la herramienta.'
          : 'Quien tenga el enlace ya no podrá usar la herramienta. No se puede volver a abrir.'}
        confirmLabel={ocupado ? (confirmar === 'eliminar' ? 'Eliminando…' : 'Cerrando…') : (confirmar === 'eliminar' ? 'Eliminar' : 'Cerrar acceso')}
        danger
        onConfirm={ejecutar}
        onCancel={() => setConfirmar(null)}
      />
    </div>
  );
}
