'use client';

/**
 * ADMIN → EMISORES (fase 4, paso 3 del modelo económico, 2026-11-09).
 *
 * Las cuentas de emisor (RUC + firma electrónica) que registra cada miembro o candidato en Configuración ›
 * Facturación, y la de GCC. Aquí se ven de solo lectura —la firma nunca: titular, vencimiento y si corresponde al
 * RUC— y el administrador cambia el estado: Pruebas (ambiente de pruebas del SRI), Activo (producción) o
 * Suspendido. Emitir con ellas llega en el paso 4.
 *
 * Rail de estado + lista, como Pagos a miembros; el detalle, en el panel derecho.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { FilePen, FlaskConical, BadgeCheck, Ban, Layers } from 'lucide-react';
import FilterRail from '@/components/ui/FilterRail';
import BarraLista from '@/components/ui/BarraLista';
import PixelDataTable from '@/components/ui/PixelDataTable';
import TablaVaciaHastaElPie from '@/components/ui/TablaVaciaHastaElPie';
import PixelModal from '@/components/ui/PixelModal';
import PieAcciones from '@/components/ui/PieAcciones';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { fechaCorta, mf, Dato, Bloque } from '@/components/cobros/comun';
import { REGIMEN_TEXTO, TARIFA_IVA, EstadoEmisorTexto } from '@/components/facturacion/comun';
import type { EstadoEmisor } from '@/lib/integrations/sri/regimen';
import type { EmisorDeLista } from '@/lib/facturacion-emisores';

type Filtro = 'todos' | EstadoEmisor;

const venceClase = (vence: string | undefined) =>
  vence && Date.parse(`${vence}T12:00:00Z`) - Date.now() <= 30 * 86_400_000 ? 'text-red-600' : 'text-digi-muted';

export default function EmisoresPanel() {
  const [lista, setLista] = useState<EmisorDeLista[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState<EmisorDeLista | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    const r = await fetch('/api/admin/emisores');
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(j.error || 'No se pudieron cargar los emisores'); setLista([]); return; }
    setLista(j.data);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const q = busqueda.trim().toLowerCase();
  const filas = useMemo(
    () => (lista ?? []).filter((e) => (filtro === 'todos' || e.estado === filtro)
      && (!q || `${e.persona} ${e.email ?? ''} ${e.ruc} ${e.razonSocial}`.toLowerCase().includes(q))),
    [lista, filtro, q],
  );
  const cuenta = (f: Filtro) => (lista ? lista.filter((e) => f === 'todos' || e.estado === f).length : undefined);

  const cambiar = async (estado: EstadoEmisor) => {
    if (!abierto) return;
    setGuardando(true);
    try {
      const r = await fetch('/api/admin/emisores', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: abierto.id, estado }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(j.error || 'No se pudo cambiar el estado'); return; }
      setLista(j.data);
      setAbierto((j.data as EmisorDeLista[]).find((e) => e.id === abierto.id) ?? null);
      toast.success('Estado cambiado');
    } finally { setGuardando(false); }
  };

  // Por qué no se puede habilitar (deshabilitado con el porqué en `title`, sin notas debajo).
  const sinHabilitar = (e: EmisorDeLista): string | undefined =>
    e.esGcc ? 'La cuenta de GCC no se cambia desde aquí'
      : !e.firma ? 'Falta la firma electrónica'
      : Date.parse(`${e.firma.vence}T12:00:00Z`) <= Date.now() ? 'La firma está vencida'
      : e.firma.coincide === false ? 'La firma no corresponde al RUC'
      : undefined;

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      <FilterRail<Filtro>
        value={filtro}
        onChange={setFiltro}
        sections={[{
          title: 'Estado',
          items: [
            { value: 'todos', label: 'Todos', Icon: Layers, count: cuenta('todos') },
            { value: 'borrador', label: 'Borrador', Icon: FilePen, count: cuenta('borrador') },
            { value: 'en_pruebas', label: 'Pruebas', Icon: FlaskConical, count: cuenta('en_pruebas') },
            { value: 'activo', label: 'Activo', Icon: BadgeCheck, count: cuenta('activo') },
            { value: 'suspendido', label: 'Suspendido', Icon: Ban, count: cuenta('suspendido') },
          ],
        }]}
      />

      <div className="flex-1 min-w-0 w-full">
        <BarraLista busqueda={busqueda} onBusqueda={setBusqueda} placeholder="Buscar por persona, RUC o razón social" />
        <TablaVaciaHastaElPie vacia={filas.length === 0}>
          <PixelDataTable<EmisorDeLista>
            singleLine unidad={['emisor', 'emisores']} cargando={!lista}
            data={filas} onRowClick={setAbierto}
            emptyTitle="Sin emisores" emptyDesc="Aquí aparece cada cuenta de emisor que registra un miembro o candidato."
            columns={[
              { key: 'persona', header: 'Persona', render: (e) => (
                <span className="block min-w-0">
                  <span className="block truncate text-[13px] font-medium text-digi-text" style={mf}>{e.persona}</span>
                  <span className="block truncate text-[11.5px] text-digi-muted" style={mf}>{e.razonSocial}</span>
                </span>
              ) },
              { key: 'ruc', header: 'RUC', width: '140px', render: (e) => <span className="text-[12.5px] tabular-nums text-digi-text" style={mf}>{e.ruc}</span> },
              { key: 'vence', header: 'Firma vence', width: '130px', render: (e) => (
                <span className={`text-[12px] ${e.firma ? venceClase(e.firma.vence) : 'text-red-600'}`} style={mf}>{e.firma ? fechaCorta(e.firma.vence) : 'Sin firma'}</span>
              ) },
              { key: 'coincide', header: 'Firma del RUC', width: '120px', hideOnMobile: true, render: (e) => (
                <span className={`text-[12px] ${e.firma?.coincide === false ? 'text-red-600' : 'text-digi-muted'}`} style={mf}>
                  {!e.firma ? '—' : e.firma.coincide === true ? 'Sí' : e.firma.coincide === false ? 'No' : 'Sin comprobar'}
                </span>
              ) },
              { key: 'estado', header: 'Estado', width: '110px', render: (e) => <EstadoEmisorTexto estado={e.estado} /> },
            ]}
            tarjetaMovil={(e) => (
              <>
                <div className="flex items-start gap-2">
                  <span className="flex-1 min-w-0 text-[13.5px] font-medium text-digi-text truncate" style={mf}>{e.persona}</span>
                  <span className="shrink-0"><EstadoEmisorTexto estado={e.estado} /></span>
                </div>
                <div className="mt-1.5 flex items-center gap-3 text-[12px] text-digi-muted tabular-nums" style={mf}>
                  <span>{e.ruc}</span>
                  <span className={`ml-auto ${e.firma ? venceClase(e.firma.vence) : 'text-red-600'}`}>{e.firma ? fechaCorta(e.firma.vence) : 'Sin firma'}</span>
                </div>
              </>
            )}
          />
        </TablaVaciaHastaElPie>
      </div>

      <PixelModal open={!!abierto} onClose={() => setAbierto(null)} title={abierto ? abierto.persona : 'Emisor'} busy={guardando}
        pie={abierto ? (
          <PieAcciones>
            {abierto.estado !== 'suspendido' && abierto.estado !== 'borrador' && (
              <button type="button" onClick={() => cambiar('suspendido')} disabled={guardando || abierto.esGcc}
                title={abierto.esGcc ? 'La cuenta de GCC no se cambia desde aquí' : undefined} className={BTN_SECONDARY}>Suspender</button>
            )}
            {abierto.estado !== 'en_pruebas' && (
              <button type="button" onClick={() => cambiar('en_pruebas')} disabled={guardando || !!sinHabilitar(abierto)}
                title={sinHabilitar(abierto)} className={BTN_SECONDARY}>Pasar a pruebas</button>
            )}
            {abierto.estado !== 'activo' && (
              <button type="button" onClick={() => cambiar('activo')} disabled={guardando || !!sinHabilitar(abierto)}
                title={sinHabilitar(abierto)} className={BTN_PRIMARY}>Activar</button>
            )}
          </PieAcciones>
        ) : undefined}>
        {abierto && (
          <div className="space-y-4">
            <Bloque titulo="Emisor">
              <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 text-[12.5px]" style={mf}>
                <Dato t="RUC" v={abierto.ruc} />
                <Dato t="Razón social" v={abierto.razonSocial} />
                <Dato t="Nombre comercial" v={abierto.nombreComercial || '—'} />
                <Dato t="Establecimiento" v={`${abierto.estab}-${abierto.ptoEmi}`} />
                <Dato t="Dirección matriz" v={abierto.dirMatriz} />
                <Dato t="Dirección del establecimiento" v={abierto.dirEstablecimiento} />
                <Dato t="Régimen" v={REGIMEN_TEXTO[abierto.regimen]} />
                <Dato t="IVA" v={abierto.cobraIva ? TARIFA_IVA[abierto.tarifaIva] : 'No cobra'} />
                <Dato t="Contabilidad" v={abierto.obligadoContabilidad ? 'Obligado' : 'No obligado'} />
                <Dato t="Ambiente" v={abierto.ambiente === '2' ? 'Producción' : 'Pruebas'} />
                <Dato t="Correo" v={abierto.email ?? '—'} />
                <div className="min-w-0">
                  <dt className="text-[10.5px] uppercase tracking-wide text-digi-muted">Estado</dt>
                  <dd><EstadoEmisorTexto estado={abierto.estado} /></dd>
                </div>
                {abierto.leyenda && <div className="col-span-2"><Dato t="Leyenda" v={abierto.leyenda} /></div>}
              </dl>
            </Bloque>
            <Bloque titulo="Firma electrónica">
              {abierto.firma ? (
                <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 text-[12.5px]" style={mf}>
                  <Dato t="Titular" v={abierto.firma.titular} />
                  <Dato t="Vence" v={fechaCorta(abierto.firma.vence)} />
                  <Dato t="Corresponde al RUC" v={abierto.firma.coincide === true ? 'Sí' : abierto.firma.coincide === false ? 'No' : 'Sin comprobar'} />
                  <Dato t="Dónde" v={abierto.firma.enServidor ? 'Entorno del servidor' : `Subida el ${fechaCorta(abierto.firma.actualizada)}`} />
                </dl>
              ) : (
                <p className="text-[12.5px] text-digi-muted" style={mf}>Sin firma electrónica.</p>
              )}
            </Bloque>
          </div>
        )}
      </PixelModal>
    </div>
  );
}
