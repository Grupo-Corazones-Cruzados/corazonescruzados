'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { LayoutGrid, Layers, Package, Shapes } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useConsultaMedia, PANTALLA_XL } from '@/lib/hooks/useConsultaMedia';
import AccesoAlProducto from '@/components/productos/AccesoAlProducto';
import IncidentsTab from '@/components/projects/IncidentsTab';
import FilterRail from '@/components/ui/FilterRail';
import BarraLista from '@/components/ui/BarraLista';
import PixelDataTable from '@/components/ui/PixelDataTable';
import TablaVaciaHastaElPie from '@/components/ui/TablaVaciaHastaElPie';
import PanelDetalle from '@/components/ui/PanelDetalle';
import PanelHastaElPie from '@/components/ui/PanelHastaElPie';
import PestanasRail from '@/components/ui/PestanasRail';
import PixelModal from '@/components/ui/PixelModal';
import { BTN_SECONDARY } from '@/components/ui/Button';
import { TONO } from '@/components/ui/tonos';
import { fmt2 } from '@/lib/format';
import { esUrlCloudinary, urlRedimensionada } from '@/lib/cloudinary-url';
import type { Plataforma, Solucion, DetallePlataforma } from '@/lib/productos/plataformas';

const mf = { fontFamily: 'var(--font-body)' } as const;

/**
 * PLATAFORMAS — los productos a los que la cuenta tiene acceso (Fernando, 2026-10-23).
 *
 * Desde el 2026-10-29, con la disposición de las demás listas: *«a la izquierda […] elegir entre
 * las soluciones […] en el panel central todos los productos que tienes acceso para ese tipo de
 * solución […] seleccionar el producto y ver los detalles como cliente […] en un panel derecho
 * […] con una pestaña de incidentes»*.
 *
 * - Izquierda: las soluciones (`gcc_world.soluciones`); un producto es de las soluciones de su
 *   talento (ver `lib/productos/plataformas.ts`). «Otras» recoge los que no tienen ninguna.
 * - Centro: una fila por ORGANIZACIÓN (una cuenta puede tener más de una en un producto).
 * - Derecha: Propiedades (suscripción, plan, usuarios, pagos) e Incidentes —el mismo sistema que
 *   en Proyectos y Tickets—. Abajo, fijo, «Entrar a Organización».
 *
 * El menú solo enseña el módulo si hay al menos una; si alguien llega por la dirección sin
 * ninguna, ve el camino al marketplace en vez de una página en blanco.
 */
type Filtro = 'todas' | 'otras' | `s${number}`;
type Pestana = 'propiedades' | 'incidentes';

const fecha = (d: string | null | undefined) =>
  d ? new Date(d + 'T12:00:00').toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function PlataformasPage() {
  const { user } = useAuth();
  const enTelefono = !useConsultaMedia(PANTALLA_XL);
  const [datos, setDatos] = useState<{ soluciones: Solucion[]; plataformas: Plataforma[] } | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [busqueda, setBusqueda] = useState('');
  const [elegida, setElegida] = useState<Plataforma | null>(null);

  useEffect(() => {
    fetch('/api/plataformas')
      .then((r) => (r.ok ? r.json() : { soluciones: [], plataformas: [] }))
      .then((j) => setDatos({ soluciones: j.soluciones ?? [], plataformas: j.plataformas ?? [] }))
      .catch(() => setDatos({ soluciones: [], plataformas: [] }));
  }, []);

  const plataformas = datos?.plataformas ?? [];
  const otras = plataformas.filter((p) => p.soluciones.length === 0).length;
  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return plataformas.filter((p) =>
      (filtro === 'todas' || (filtro === 'otras' ? p.soluciones.length === 0 : p.soluciones.includes(Number(filtro.slice(1)))))
      && (!q || `${p.productoNombre} ${p.nombre}`.toLowerCase().includes(q)));
  }, [plataformas, filtro, busqueda]);

  // En escritorio el panel enseña siempre una: la primera de la lista si no se ha elegido otra.
  useEffect(() => {
    if (enTelefono) return;
    if (!elegida || !filas.some((f) => f.id === elegida.id)) setElegida(filas[0] ?? null);
  }, [filas, enTelefono, elegida]);

  if (datos === null) {
    return <p className="text-[13px] text-digi-muted py-12 text-center" style={mf}>Cargando…</p>;
  }

  if (plataformas.length === 0) {
    return (
      <div className="pixel-card text-center py-12 max-w-md mx-auto" style={mf}>
        <LayoutGrid className="w-8 h-8 mx-auto text-digi-muted/40 mb-2" />
        <p className="text-[14px] font-semibold text-digi-text">Aún no tienes plataformas</p>
        <p className="text-[12.5px] text-digi-muted mt-1 mb-4">Cuando te suscribas a un producto, aparecerá aquí.</p>
        <Link href="/dashboard/marketplace" className={BTN_SECONDARY}>Ver el marketplace</Link>
      </div>
    );
  }

  const cuenta = (id: number) => plataformas.filter((p) => p.soluciones.includes(id)).length;

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      <FilterRail<Filtro>
        title="Soluciones"
        items={[
          { value: 'todas', label: 'Todas', Icon: LayoutGrid, count: plataformas.length },
          ...datos.soluciones.map((s) => ({ value: `s${s.id}` as Filtro, label: s.nombre, Icon: Layers, count: cuenta(s.id) })),
          ...(otras ? [{ value: 'otras' as Filtro, label: 'Otras', Icon: Shapes, count: otras }] : []),
        ]}
        value={filtro}
        onChange={setFiltro}
      />

      <div className="flex-1 min-w-0 w-full">
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
          <div className="min-w-0">
            <BarraLista busqueda={busqueda} onBusqueda={setBusqueda} placeholder="Buscar producto u organización…" />
            <TablaVaciaHastaElPie vacia={filas.length === 0}>
              <PixelDataTable
                unidad={['plataforma', 'plataformas']}
                singleLine
                data={filas}
                onRowClick={(p: Plataforma) => setElegida(p)}
                emptyTitle="Sin plataformas"
                emptyDesc="No tienes productos de esta solución."
                columns={[
                  { key: 'producto', header: 'Producto', render: (p: Plataforma) => (
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Miniatura src={p.portada} />
                      <span className={`truncate text-[13px] font-medium ${elegida?.id === p.id ? 'text-accent' : 'text-digi-text'}`} style={mf}>{p.productoNombre}</span>
                    </span>
                  ) },
                  { key: 'org', header: 'Organización', render: (p: Plataforma) => <span className="text-[12px] text-digi-text" style={mf}>{p.nombre}</span> },
                  { key: 'estado', header: 'Estado', width: '200px', render: (p: Plataforma) => <Situacion a={p} /> },
                ]}
                tarjetaMovil={(p: Plataforma) => (
                  <div className="flex items-center gap-3" style={mf}>
                    <Miniatura src={p.portada} grande />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-digi-text truncate">{p.productoNombre}</p>
                      <p className="text-[12px] text-digi-muted truncate">{p.nombre}</p>
                      <Situacion a={p} />
                    </div>
                  </div>
                )}
              />
            </TablaVaciaHastaElPie>
          </div>

          {!enTelefono && (
            <aside className="w-full xl:w-[360px]">
              {elegida ? (
                <Detalle key={elegida.id} p={elegida} esAdmin={user?.role === 'admin'} />
              ) : (
                <PanelHastaElPie desdeAncho={1280} className="bg-digi-card border border-digi-border rounded-lg p-6 text-center flex flex-col justify-center">
                  <Package className="w-5 h-5 text-digi-muted mx-auto mb-2" />
                  <p className="text-[12px] text-digi-muted" style={mf}>Selecciona un producto para ver su detalle.</p>
                </PanelHastaElPie>
              )}
            </aside>
          )}
        </div>
      </div>

      {/* El detalle en teléfono y tableta. En escritorio NO se monta: ver `enTelefono`. */}
      {enTelefono && (
        <PixelModal open={!!elegida} onClose={() => setElegida(null)} title={elegida?.productoNombre ?? 'Plataforma'} size="md">
          {elegida && <Detalle key={elegida.id} p={elegida} esAdmin={user?.role === 'admin'} enVentana />}
        </PixelModal>
      )}
    </div>
  );
}

function Miniatura({ src, grande = false }: { src: string | null; grande?: boolean }) {
  const t = grande ? 'w-12 h-12' : 'w-7 h-7';
  if (!src) {
    return <span className={`${t} shrink-0 rounded border border-digi-border flex items-center justify-center`}><Package className="w-3.5 h-3.5 text-digi-muted/50" /></span>;
  }
  const url = esUrlCloudinary(src) ? urlRedimensionada(src, grande ? 160 : 96) : src;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" loading="lazy" className={`${t} shrink-0 rounded border border-digi-border object-cover`} />;
}

/** El estado del pago, en texto de color (sin píldora ni punto). */
function Situacion({ a }: { a: Pick<Plataforma, 'cortesia' | 'diasDeRetraso' | 'pagadoHasta'> }) {
  if (a.cortesia) return <span className="text-[12px] font-semibold text-accent" style={mf}>Acceso del grupo</span>;
  if (a.diasDeRetraso) {
    return <span className="text-[12px] font-semibold text-amber-700" style={mf}>Vencida hace {a.diasDeRetraso} día{a.diasDeRetraso === 1 ? '' : 's'}</span>;
  }
  return <span className={`text-[12px] font-semibold ${TONO.exito.texto}`} style={mf}>Al día{a.pagadoHasta ? ` · hasta el ${fecha(a.pagadoHasta)}` : ''}</span>;
}

// Los productos guardan estados y métodos como enum en mayúsculas (PAGADO, AUTOSERVICIO…).
const TEXTO: Record<string, string> = {
  PAGADO: 'Pagado', PENDIENTE: 'Pendiente', FALLIDO: 'Fallido',
  AUTOSERVICIO: 'Pago en línea', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia', EFECTIVO: 'Efectivo',
};
const legible = (v: string | null | undefined) => (v ? TEXTO[v] ?? v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, ' ') : null);

/** El panel derecho: Propiedades / Incidentes, y «Entrar a Organización» fijo abajo. */
function Detalle({ p, esAdmin, enVentana = false }: { p: Plataforma; esAdmin: boolean; enVentana?: boolean }) {
  const [pestana, setPestana] = useState<Pestana>('propiedades');
  const [d, setD] = useState<DetallePlataforma | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/plataformas/${p.id}`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Error'); setD(j.data); })
      .catch((e) => setError(e.message));
  }, [p.id]);

  const filas: [string, React.ReactNode][] = d ? [
    ['Estado', <Situacion key="s" a={p} />],
    ['Cliente desde', fecha(d.creadoEn)],
    ['Inicio de la suscripción', fecha(d.suscripcion?.inicio)],
    ['Pagado hasta', d.cortesia ? 'Sin mensualidad' : fecha(d.suscripcion?.pagadoHasta)],
    ['Plan', d.plan ? `${d.plan.nombre}${d.plan.precio != null ? ` · $${fmt2(d.plan.precio)}/mes` : ''}` : '—'],
    ['Usuarios activos', `${d.usuariosActivos}${d.plan?.maxUsuarios ? ` de ${d.plan.maxUsuarios}` : ''}`],
    ...(d.suscripcion?.metodoPago ? [['Forma de pago', legible(d.suscripcion.metodoPago)] as [string, React.ReactNode]] : []),
  ] : [];

  const contenido = (
    <>
      <PestanasRail valor={pestana} onChange={setPestana}
        opciones={[{ valor: 'propiedades', texto: 'Propiedades' }, { valor: 'incidentes', texto: 'Incidentes' }]} />

      {pestana === 'incidentes' && <IncidentsTab api={`/api/plataformas/${p.id}`} canManage={esAdmin} />}

      {pestana === 'propiedades' && (error ? (
        <p className="text-[12px] text-red-600" style={mf}>{error}</p>
      ) : !d ? (
        <p className="text-[12px] text-digi-muted" style={mf}>Cargando…</p>
      ) : (
        <>
          <dl className="space-y-2.5" style={mf}>
            {filas.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                <dt className="text-digi-muted shrink-0">{k}</dt>
                <dd className="text-digi-text text-right min-w-0 truncate">{v}</dd>
              </div>
            ))}
          </dl>

          {/* Los pagos de la mensualidad: lo único que se desplaza si son muchos. */}
          <div className={enVentana ? '' : 'flex-1 min-h-32 flex flex-col'}>
            <p className="text-[10px] font-semibold text-digi-muted uppercase tracking-wide mb-1.5" style={mf}>
              Consumos ({d.pagos.length})
            </p>
            {d.pagos.length === 0 ? (
              <p className="text-[12px] text-digi-muted" style={mf}>{d.cortesia ? 'Acceso del grupo: sin mensualidades.' : 'Aún no hay pagos registrados.'}</p>
            ) : (
              <ul className={`${enVentana ? 'max-h-64' : 'min-h-0'} overflow-y-auto divide-y divide-digi-border/60`} style={mf}>
                {d.pagos.map((x, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-1.5 text-[12.5px]">
                    <span className="min-w-0">
                      <span className="text-digi-text">{x.periodo ?? '—'}</span>
                      <span className="block text-[11px] text-digi-muted">
                        {[legible(x.estado), legible(x.metodo), x.pagadoEn ? fecha(x.pagadoEn) : null].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <span className="text-digi-text tabular-nums shrink-0">${fmt2(x.monto)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ))}
    </>
  );

  const pie = <AccesoAlProducto accesos={[p]} />;

  if (enVentana) {
    return <div className="space-y-4">{contenido}<div className="pt-3 border-t border-digi-border">{pie}</div></div>;
  }
  return (
    <PanelDetalle titulo={p.productoNombre} subtitulo={p.nombre} icono={Package} pie={pie}>
      {contenido}
    </PanelDetalle>
  );
}
