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
import PanelHastaElPie from '@/components/ui/PanelHastaElPie';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { fmt2 } from '@/lib/format';
import { Trash2, PackageOpen, CircleDot, CheckCircle2, Lock, Clock, Search, Copy, Download, Paperclip, LayoutGrid } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

type Variante = 'default' | 'info' | 'success' | 'warning' | 'error';
type Archivo = { id: string; nombre: string; mime: string; tamano: number };
type Entrega = {
  id: number; url: string; titulo: string; mensaje: string; cliente_nombre: string | null; exige_cuenta: boolean;
  estado: 'vigente' | 'usado' | 'cerrado' | 'vencido'; vence_en: string; enviado_a: string | null; creado_en: string;
  archivos: Archivo[]; abierto_en: string | null; abierto_por_email: string | null;
  descargas: { id: string; en: string }[]; creador_nombre: string | null;
};

const ESTADOS = [
  { value: 'all', label: 'Todos', Icon: LayoutGrid },
  { value: 'vigente', label: 'Vigentes', Icon: CircleDot },
  { value: 'usado', label: 'Abiertas', Icon: CheckCircle2 },
  { value: 'cerrado', label: 'Cerradas', Icon: Lock },
  { value: 'vencido', label: 'Vencidas', Icon: Clock },
];
const ESTADO: Record<string, { label: string; v: Variante }> = {
  vigente: { label: 'Vigente', v: 'info' }, usado: { label: 'Abierta', v: 'success' },
  cerrado: { label: 'Cerrada', v: 'default' }, vencido: { label: 'Vencida', v: 'warning' },
};
// Sin punto de color delante del título: el estado ya lo dice la palabra en color de su
// columna (y de la tarjeta del teléfono). Dos marcas para lo mismo (Fernando, 2026-10-23).

const fecha = (s: string | null) => (s ? new Date(s).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const mb = (b: number) => `${fmt2(b / 1024 / 1024)} MB`;

/**
 * Entregas de un solo uso (Herramientas → Gestión): cada fila es lo que se envió, con su estado,
 * cuándo y quién la abrió y qué descargó. Misma forma que «Enlaces de un solo uso» (Fernando:
 * «tiene que funcionar igual»), en su propia página («todo separado»). Ver `lib/entregas`.
 */
export default function EntregasPage() {
  // El panel de teléfono NO se monta en escritorio: un <dialog> montado deja inerte la página.
  const enTelefono = !useConsultaMedia(PANTALLA_XL);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [entregas, setEntregas] = useState<Entrega[] | null>(null);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [selId, setSelId] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState<'cerrar' | 'eliminar' | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/entregas', { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudieron cargar las entregas');
      setEntregas(d.data || []);
    } catch (e: any) { toast.error(e.message); setEntregas((p) => p ?? []); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: entregas?.length || 0 };
    for (const e of entregas || []) c[e.estado] = (c[e.estado] || 0) + 1;
    return c;
  }, [entregas]);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (entregas || []).filter((e) => {
      if (tab !== 'all' && e.estado !== tab) return false;
      if (q && ![e.titulo, e.cliente_nombre, e.enviado_a, e.mensaje].some((x) => x?.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [entregas, tab, search]);

  const sel = entregas?.find((e) => e.id === selId) || null;
  const railItems: FilterRailItem<string>[] = ESTADOS.map((s) => ({ value: s.value, label: s.label, Icon: s.Icon, count: counts[s.value] ?? 0 }));

  const copiar = (url: string) => { navigator.clipboard.writeText(url); toast.success('Enlace copiado'); };

  const ejecutar = async () => {
    if (!sel || !confirmar) return;
    const eliminar = confirmar === 'eliminar';
    setOcupado(true);
    try {
      const r = await fetch(`/api/entregas/${sel.id}`, eliminar
        ? { method: 'DELETE' }
        : { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: 'cerrar' }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || (eliminar ? 'No se pudo eliminar' : 'No se pudo cerrar'));
      toast.success(eliminar ? 'Entrega eliminada' : 'Entrega cerrada');
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
        {fila('Cliente', sel.cliente_nombre ? `${sel.cliente_nombre}${sel.exige_cuenta ? ' · pide su cuenta' : ''}` : '—')}
        {sel.enviado_a && fila('Enviado a', sel.enviado_a)}
        {isAdmin && fila('Creado por', sel.creador_nombre || '—')}
        {fila('Creado', fecha(sel.creado_en))}
        {sel.estado === 'vigente' && fila('Vence', fecha(sel.vence_en))}
        {sel.abierto_en && fila('Abierta', fecha(sel.abierto_en))}
        {sel.abierto_por_email && fila('La abrió', sel.abierto_por_email)}
      </div>

      {sel.mensaje && (
        <div className="pt-3 border-t border-digi-border">
          <p className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide mb-1" style={mf}>Mensaje</p>
          <p className="text-[13px] text-digi-text whitespace-pre-wrap leading-relaxed" style={mf}>{sel.mensaje}</p>
        </div>
      )}

      {sel.archivos.length > 0 && (
        <div className="pt-3 border-t border-digi-border space-y-1.5">
          <p className="text-[11px] font-semibold text-digi-muted uppercase tracking-wide" style={mf}>Archivos</p>
          {sel.archivos.map((a) => {
            const veces = sel.descargas.filter((d) => d.id === a.id).length;
            return (
              <a key={a.id} href={`/api/entregas/${sel.id}/archivos/${a.id}`}
                className="flex items-center gap-2 rounded-lg border border-digi-border px-3 py-2 hover:border-accent/50 transition-colors">
                <Paperclip className="w-4 h-4 text-digi-muted shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[12.5px] text-digi-text truncate" style={mf}>{a.nombre}</span>
                  <span className="block text-[11px] text-digi-muted" style={mf}>
                    {mb(a.tamano)}{sel.abierto_en ? ` · ${veces ? `descargado ${veces === 1 ? '1 vez' : `${veces} veces`}` : 'sin descargar'}` : ''}
                  </span>
                </span>
                <Download className="w-4 h-4 text-accent shrink-0" />
              </a>
            );
          })}
        </div>
      )}

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
      <PageHeader title="Entregas de un solo uso" description="Lo que enviaste, si ya lo abrieron y qué descargaron" />

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <FilterRail title="Estado" items={railItems} value={tab} onChange={setTab} />

        <div className="flex-1 min-w-0 w-full">
          <div className="relative w-full mb-3">
            <Search className="w-4 h-4 text-digi-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por título, cliente o mensaje..."
              className="field-control w-full pl-8 pr-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none" style={mf} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
            <div className="min-w-0">
              <PixelDataTable
                singleLine
                data={filtrados}
                onRowClick={(e: Entrega) => setSelId(e.id)}
                emptyTitle={entregas === null ? 'Cargando…' : 'Sin entregas'}
                emptyDesc={entregas === null ? '' : 'Genera una desde Herramientas → Entrega de un solo uso.'}
                columns={[
                  { key: 'titulo', header: 'Título', render: (e: Entrega) => (
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={`truncate text-[13px] font-medium ${selId === e.id ? 'text-accent' : 'text-digi-text'}`} style={mf}>{e.titulo}</span>
                      {e.archivos.length > 0 && (
                        <span title={`${e.archivos.length} archivo(s)`} className="inline-flex items-center gap-0.5 text-[11.5px] text-digi-muted tabular-nums shrink-0" style={mf}>
                          <Paperclip className="w-3.5 h-3.5" />{e.archivos.length}
                        </span>
                      )}
                    </span>
                  ) },
                  { key: 'cliente', header: 'Cliente', width: '150px', hideOnMobile: true, render: (e: Entrega) => <span className="text-[12px] text-digi-muted truncate" style={mf}>{e.cliente_nombre || '—'}</span> },
                  { key: 'estado', header: 'Estado', width: '100px', hideOnMobile: true, render: (e: Entrega) => <PixelBadge variant={ESTADO[e.estado].v}>{ESTADO[e.estado].label}</PixelBadge> },
                  { key: 'abierta', header: 'Abierta', width: '130px', hideOnMobile: true, render: (e: Entrega) => <span className="text-[12px] text-digi-muted" style={mf}>{fecha(e.abierto_en)}</span> },
                ]}
                tarjetaMovil={(e: Entrega) => (
                  <>
                    <div className="flex items-start gap-2">
                      <span className="flex-1 min-w-0 text-[13.5px] font-medium text-digi-text leading-snug" style={mf}>{e.titulo}</span>
                      <span className="shrink-0"><PixelBadge variant={ESTADO[e.estado].v}>{ESTADO[e.estado].label}</PixelBadge></span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-digi-muted" style={mf}>
                      {e.cliente_nombre && <span>{e.cliente_nombre}</span>}
                      {e.archivos.length > 0 && <span className="inline-flex items-center gap-1 tabular-nums"><Paperclip className="w-3.5 h-3.5" /> {e.archivos.length}</span>}
                      <span className="ml-auto">{fecha(e.abierto_en || e.creado_en)}</span>
                    </div>
                  </>
                )}
              />
            </div>

            {/* Sin botón de cerrar, como en Tickets: el panel enseña la fila elegida. */}
            <aside className="hidden xl:block w-full xl:w-[360px]">
              {/* Fernando, 2026-10-29: la tarjeta del panel derecho llega hasta el pie aunque tenga poco; lo que no quepa se desplaza dentro. */}
              {!sel ? (
                <PanelHastaElPie desdeAncho={1280} className="bg-digi-card border border-digi-border rounded-lg p-6 text-center flex flex-col items-center justify-center">
                  <div className="w-10 h-10 rounded-lg bg-black/[0.03] flex items-center justify-center mx-auto mb-2">
                    <PackageOpen className="w-5 h-5 text-digi-muted" />
                  </div>
                  <p className="text-[12px] text-digi-muted" style={mf}>Selecciona una entrega para ver su detalle.</p>
                </PanelHastaElPie>
              ) : (
                <PanelHastaElPie desdeAncho={1280} className="bg-digi-card border border-digi-border rounded-lg shadow-sm">
                  <div className="p-4 border-b border-digi-border">
                    <h3 className="text-[14px] font-semibold text-digi-text leading-tight" style={mf}>{sel.titulo}</h3>
                    <p className="text-[11px] text-digi-muted mt-0.5" style={mf}>Entrega #{sel.id}</p>
                  </div>
                  {detalle}
                </PanelHastaElPie>
              )}
            </aside>
          </div>
        </div>
      </div>

      {enTelefono && (
        <PixelModal open={!!sel} onClose={() => setSelId(null)} title={sel ? sel.titulo : 'Entrega'} size="md">
          {detalle}
        </PixelModal>
      )}

      <PixelConfirm
        open={!!confirmar}
        title={confirmar === 'eliminar' ? 'Eliminar entrega' : 'Cerrar entrega'}
        message={confirmar === 'eliminar'
          ? 'Se borra la entrega, y sus archivos van a la papelera de Drive (30 días para recuperarlos). El enlace dejará de abrir.'
          : 'Quien tenga el enlace ya no podrá abrirla ni descargar nada. No se puede volver a abrir.'}
        confirmLabel={ocupado ? (confirmar === 'eliminar' ? 'Eliminando…' : 'Cerrando…') : (confirmar === 'eliminar' ? 'Eliminar' : 'Cerrar entrega')}
        danger
        onConfirm={ejecutar}
        onCancel={() => setConfirmar(null)}
      />
    </div>
  );
}
