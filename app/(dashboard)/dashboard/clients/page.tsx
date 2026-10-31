'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConsultaMedia, PANTALLA_XL } from '@/lib/hooks/useConsultaMedia';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import PixelDataTable from '@/components/ui/PixelDataTable';
import PixelBadge from '@/components/ui/PixelBadge';
import PixelModal from '@/components/ui/PixelModal';
import PixelConfirm from '@/components/ui/PixelConfirm';
import PageHeader from '@/components/ui/PageHeader';
import FilterRail from '@/components/ui/FilterRail';
import PanelHastaElPie from '@/components/ui/PanelHastaElPie';
import PanelDetalle from '@/components/ui/PanelDetalle';
import PieAcciones from '@/components/ui/PieAcciones';
import Segmentado from '@/components/ui/Segmentado';
import Interruptor from '@/components/ui/Interruptor';
import BotonQuitar from '@/components/ui/BotonQuitar';
import { BTN_PRIMARY } from '@/components/ui/Button';
import TablaVaciaHastaElPie from '@/components/ui/TablaVaciaHastaElPie';
import BarraLista from '@/components/ui/BarraLista';
import { PAISES } from '@/lib/countries';
import { fmt2 } from '@/lib/format';
import {
  Users, Building2, Contact, BookUser, UserRound, Globe, Plus, X,
  CheckCircle2, ChevronDown, ExternalLink, FileText,
} from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;
const inputCls = 'field-control w-full px-3 py-2 bg-digi-darker border-2 border-digi-border text-sm text-digi-text focus:border-accent focus:outline-none';
const smallInputCls = 'field-control w-full px-2.5 py-1.5 bg-digi-darker border-2 border-digi-border text-[13px] text-digi-text focus:border-accent focus:outline-none';
const labelCls = 'field-label text-[11px] text-digi-muted mb-0.5 block';

const ID_TYPE_LABEL: Record<string, string> = { '04': 'RUC', '05': 'Cédula', '06': 'Pasaporte', '07': 'Cons. Final', '08': 'ID Exterior' };
const ID_TYPE_TABS = [
  { value: 'all', label: 'Todos', Icon: Users },
  { value: '04', label: 'RUC', Icon: Building2 },
  { value: '05', label: 'Cédula', Icon: Contact },
  { value: '06', label: 'Pasaporte', Icon: BookUser },
  { value: '07', label: 'Consumidor Final', Icon: UserRound },
  { value: '08', label: 'ID Exterior', Icon: Globe },
];
const STATUS_V: Record<string, 'default' | 'info' | 'success' | 'warning' | 'error'> = { pending: 'warning', sent: 'info', paid: 'success', cancelled: 'error', failed: 'error' };
const STATUS_LABEL: Record<string, string> = { pending: 'Pendiente', sent: 'Enviada', paid: 'Pagada', cancelled: 'Anulada', failed: 'Fallida' };

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fechaEs(ymd: string | null): string {
  if (!ymd) return '-';
  const [y, m, d] = String(ymd).split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return `${d} ${MESES[m - 1]} ${y}`;
}

/** Selector de país con buscador (lista desplegable en línea). */
function CountrySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const filtered = q ? PAISES.filter(p => p.toLowerCase().includes(q.toLowerCase())) : PAISES;
  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)} className={`${smallInputCls} text-left flex items-center justify-between`} style={mf}>
        <span className={value ? 'text-digi-text' : 'text-digi-muted'}>{value || 'Seleccionar país…'}</span>
        <ChevronDown className="w-3.5 h-3.5 text-digi-muted" />
      </button>
      {open && (
        <div className="mt-1 border border-digi-border rounded-lg bg-digi-darker overflow-hidden">
          <input autoFocus value={q} onChange={ev => setQ(ev.target.value)} placeholder="Buscar país…"
            className="w-full px-2.5 py-1.5 bg-digi-card border-b border-digi-border text-[12px] text-digi-text focus:outline-none" style={mf} />
          <div className="max-h-48 overflow-y-auto">
            {value && <button type="button" onClick={() => { onChange(''); setOpen(false); setQ(''); }} className="w-full text-left px-2.5 py-1.5 text-[12px] text-digi-muted hover:bg-accent-light transition-colors" style={mf}>— Sin país —</button>}
            {filtered.length === 0 ? (
              <div className="px-2.5 py-2 text-[12px] text-digi-muted" style={mf}>Sin resultados</div>
            ) : filtered.map(p => (
              <button key={p} type="button" onClick={() => { onChange(p); setOpen(false); setQ(''); }}
                className={`w-full text-left px-2.5 py-1.5 text-[12px] hover:bg-accent-light transition-colors ${p === value ? 'text-accent font-medium' : 'text-digi-text'}`} style={mf}>{p}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClientsPage() {
  /**
   * ⚠️ EL MODAL DE TELÉFONO **NO SE MONTA** EN ESCRITORIO, y no es una optimización.
   *
   * Antes iba envuelto en `<div className="xl:hidden">`: invisible en pantalla grande,
   * pero montado. Y un `<dialog>` montado al que se le llama `showModal()` **deja inerte
   * el resto de la página** aunque no se vea — así que al abrir una ficha en escritorio
   * dejaban de funcionar TODOS los botones, sin nada que mirar. (Fernando, 2026-09-23:
   * «como si algo lo estuviese tapando, algo invisible y el mouse no hace nada».)
   *
   * Aquí no se elige un aspecto, se elige QUÉ SE MONTA: o el panel lateral o el modal.
   * Eso se decide en JavaScript, no con una clase.
   */
  const enTelefono = !useConsultaMedia(PANTALLA_XL);

  const { user } = useAuth();
  const router = useRouter();
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [scopeType, setScopeType] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const onSort = (key: string) => {
    if (key === sortBy) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(key); setSortDir('asc'); }
  };

  // Create
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [cIdType, setCIdType] = useState('04');
  const [cRuc, setCRuc] = useState('');
  const [cName, setCName] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cAddress, setCAddress] = useState('');
  const [cCountry, setCCountry] = useState('');

  // Detail / edit
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [e, setE] = useState<any>({ id_type: '04', ruc: '', name: '', email: '', phone: '', address: '', country: '' });
  /** Hasta 3 juegos de datos de facturación por cliente (Fernando, 2026-10-31). `datoSel` es el
   *  que se edita (su id) o 'nuevo'; las notas son del cliente, no de un juego. */
  const [datoSel, setDatoSel] = useState('');
  const [notas, setNotas] = useState('');
  const [nuevoPredeterminado, setNuevoPredeterminado] = useState(false);
  const [confirmCfg, setConfirmCfg] = useState<{ title: string; message: string; confirmLabel: string; danger: boolean; onConfirm: () => void } | null>(null);
  const [detailTab, setDetailTab] = useState<'datos' | 'consumos'>('datos');

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    try {
      const res = await fetch(`/api/billing-clients?${params}`);
      const data = await res.json();
      setClients(data.data || []);
    } catch { setClients([]); }
  }, [search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const countByType = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of clients) m[c.id_type] = (m[c.id_type] || 0) + 1;
    m.all = clients.length;
    return m;
  }, [clients]);

  const sortedClients = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const arr = clients.filter(c => scopeType === 'all' || c.id_type === scopeType);
    arr.sort((a, b) => {
      if (sortBy === 'name' || sortBy === 'country') {
        const av = (a[sortBy] || '').toString().trim().toLowerCase();
        const bv = (b[sortBy] || '').toString().trim().toLowerCase();
        if (!av && bv) return 1;
        if (av && !bv) return -1;
        return av.localeCompare(bv) * dir;
      }
      if (sortBy === 'facturas' || sortBy === 'total') return (Number(a[sortBy] || 0) - Number(b[sortBy] || 0)) * dir;
      if (sortBy === 'ultima') {
        const av = a.ultima || ''; const bv = b.ultima || '';
        if (!av && bv) return 1;
        if (av && !bv) return -1;
        return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
      }
      return 0;
    });
    return arr;
  }, [clients, scopeType, sortBy, sortDir]);

  const resetCreate = () => { setCIdType('04'); setCRuc(''); setCName(''); setCEmail(''); setCPhone(''); setCAddress(''); setCCountry(''); };

  const createClient = async () => {
    if (cIdType !== '07' && !cRuc.trim()) { toast.error('Ingresa la identificación'); return; }
    if (cIdType !== '07' && !cName.trim()) { toast.error('Ingresa el nombre / razón social'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/billing-clients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_type: cIdType, ruc: cRuc, name: cName, email: cEmail, phone: cPhone, address: cAddress, country: cCountry }),
      });
      if (!res.ok) { toast.error((await res.json()).error || 'Error'); return; }
      toast.success('Cliente creado');
      setShowCreate(false); resetCreate(); fetchData();
    } catch { toast.error('Error al crear'); }
    finally { setCreating(false); }
  };

  /** Los juegos de datos en orden fijo: los del cliente primero y luego por antigüedad, así
   *  «Datos 2» no cambia de sitio al marcar otro como predeterminado. */
  const datosOrden = (d: any): any[] => [...(d?.datos || [])].sort((a: any, b: any) => (Number(b.titular) - Number(a.titular)) || a.id - b.id);
  const formDe = (x: any) => ({ id_type: x?.id_type || '04', ruc: x?.ruc || '', name: x?.name || '', email: x?.email || '', phone: x?.phone || '', address: x?.address || '', country: x?.country || '' });

  /** Pone la ficha en pantalla editando el juego `id` (por defecto el del cliente). */
  const mostrarFicha = (d: any, id?: number | string) => {
    setDetail(d || null);
    if (!d) return;
    const lista = datosOrden(d);
    const dato = lista.find((x: any) => String(x.id) === String(id)) || lista[0] || d;
    setDatoSel(String(dato.id));
    setE(formDe(dato));
    setNotas(d.notes || '');
  };

  const elegirDato = (v: string) => {
    if (v === 'nuevo') { setDatoSel('nuevo'); setE(formDe(null)); setNuevoPredeterminado(false); }
    else { setDatoSel(v); setE(formDe(datosOrden(detail).find((x: any) => String(x.id) === v))); }
    setSavedOk(false);
  };

  const openDetail = async (c: any) => {
    setSelected(c); setDetail(null); setDetailTab('datos'); setSavedOk(false); setLoadingDetail(true);
    try {
      const res = await fetch(`/api/billing-clients/${c.id}`);
      const data = await res.json();
      mostrarFicha(data.data);
    } catch { toast.error('No se pudo cargar el detalle'); }
    finally { setLoadingDetail(false); }
  };

  const saveClient = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      if (datoSel === 'nuevo') {
        const res = await fetch(`/api/billing-clients/${detail.id}/datos`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...e, predeterminado: nuevoPredeterminado }),
        });
        const data = await res.json();
        if (!res.ok) { toast.error(data.error || 'Error'); return; }
        // Las notas del cliente, si se tocaron mientras tanto.
        if (notas !== (detail.notes || '')) {
          await fetch(`/api/billing-clients/${detail.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes: notas }) });
        }
        const d = await (await fetch(`/api/billing-clients/${detail.id}`)).json();
        mostrarFicha(d.data, data.data?.id);
        toast.success('Datos de facturación añadidos');
      } else {
        const res = await fetch(`/api/billing-clients/${datoSel}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...e, notes: notas }),
        });
        const data = await res.json();
        if (!res.ok) { toast.error(data.error || 'Error'); return; }
        mostrarFicha(data.data, datoSel);
        toast.success('Cliente actualizado');
      }
      setSavedOk(true); setTimeout(() => setSavedOk(false), 3000);
      fetchData();
    } catch { toast.error('Error'); }
    finally { setSaving(false); }
  };

  /** Marca el juego `id` como el que se propone al facturar. */
  const marcarPredeterminado = async (id: number | string) => {
    try {
      const res = await fetch(`/api/billing-clients/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ predeterminado: true }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Error'); return; }
      mostrarFicha(data.data, datoSel);
    } catch { toast.error('Error'); }
  };

  const quitarDato = () => {
    const dato = datosOrden(detail).find((x: any) => String(x.id) === datoSel);
    if (!dato || dato.titular) return;
    setConfirmCfg({
      title: 'Quitar datos de facturación', confirmLabel: 'Quitar', danger: true,
      message: `¿Quitar los datos «${dato.name} · ${dato.ruc}» de este cliente? Sus facturas se conservan y siguen contando para él.`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/billing-clients/${dato.id}`, { method: 'DELETE' });
          const data = await res.json();
          if (!res.ok) { toast.error(data.error || 'Error'); return; }
          mostrarFicha(data.data);
          toast.success('Datos de facturación quitados'); fetchData();
        } catch { toast.error('Error al quitar'); }
      },
    });
  };

  const deleteClient = () => {
    if (!detail) return;
    setConfirmCfg({
      title: 'Eliminar cliente', confirmLabel: 'Eliminar', danger: true,
      message: `¿Eliminar el cliente "${detail.name}"? Solo se borra el registro; las facturas se conservan.`,
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/billing-clients/${detail.id}`, { method: 'DELETE' });
          if (!res.ok) { toast.error((await res.json()).error || 'Error'); return; }
          toast.success('Cliente eliminado'); setSelected(null); setDetail(null); fetchData();
        } catch { toast.error('Error al eliminar'); }
      },
    });
  };

  const goOrigin = (inv: any) => {
    if (inv.origin_type === 'ticket') router.push(`/dashboard/tickets/${inv.origin_id}`);
    else if (inv.origin_type === 'project') router.push(`/dashboard/projects/${inv.origin_id}`);
    else if (inv.origin_type === 'subscription') router.push(`/dashboard/subscriptions`);
  };


  /** Las piezas de la ficha, una sola vez: panel de la derecha en escritorio (`PanelDetalle`,
   *  con las acciones fijas abajo) y ventana en teléfono (todo seguido, como antes). */
  const fichaLista = !!selected && !loadingDetail && !!detail;
  const toggleFicha = !fichaLista ? null : (
    <div className="inline-flex gap-1 p-0.5 bg-black/[0.04] rounded-md">
      {(['datos', 'consumos'] as const).map(t => (
        <button key={t} onClick={() => setDetailTab(t)}
          className={`min-h-11 sm:min-h-0 px-3 py-1 text-[12px] font-medium rounded transition-colors ${detailTab === t ? 'bg-white text-accent shadow-sm' : 'text-digi-muted hover:text-digi-text'}`} style={mf}>
          {t === 'datos' ? 'Datos' : `Consumos (${detail.invoices.length})`}
        </button>
      ))}
    </div>
  );
  const listaDatos = fichaLista ? datosOrden(detail) : [];
  /** «120…001»: la identificación entera ensanchaba la opción elegida. */
  const idCorta = (id?: string) => !id ? '—' : id.length > 7 ? `${id.slice(0, 3)}…${id.slice(-3)}` : id;
  const datoActual = listaDatos.find((x: any) => String(x.id) === datoSel) || null;
  const esNuevo = datoSel === 'nuevo';
  const datosFicha = !fichaLista ? null : (
    <>
        {detail.is_consumidor_final && <p className="text-[11px] text-digi-muted" style={mf}>Registro especial: agrupa todas las facturas a consumidor final.</p>}
        {/* Hasta 3 juegos de datos de facturación (Fernando, 2026-10-31): al facturar se elige
            cuál, y se propone el que está «por defecto». */}
        {!detail.is_consumidor_final && (
            <Segmentado<string>
              etiqueta="Datos de facturación"
              className="w-full"
              valor={datoSel}
              onChange={elegirDato}
              opciones={[
                ...listaDatos.map((d: any, i: number) => ({ valor: String(d.id), texto: `Datos ${i + 1}`, detalle: idCorta(d.ruc), marca: d.predeterminada ? 'Por defecto al facturar' : undefined })),
                ...(listaDatos.length < 3 ? [{ valor: 'nuevo', texto: '+ Añadir', detalle: esNuevo ? 'Sin guardar' : `${listaDatos.length} de 3` }] : []),
              ]}
            />
        )}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls} style={mf}>Tipo ID</label>
            <select value={e.id_type} onChange={ev => setE({ ...e, id_type: ev.target.value })} disabled={detail.is_consumidor_final} className={`${smallInputCls} field-select appearance-none disabled:opacity-50`} style={mf}>
              <option value="04">RUC</option><option value="05">Cédula</option><option value="06">Pasaporte</option>{(!datoActual || datoActual.titular) && !esNuevo && <option value="07">Consumidor Final</option>}<option value="08">ID Exterior</option>
            </select>
          </div>
          <div>
            <label className={labelCls} style={mf}>Identificación</label>
            <input value={e.ruc} onChange={ev => setE({ ...e, ruc: ev.target.value })} disabled={detail.is_consumidor_final} className={`${smallInputCls} disabled:opacity-50`} style={mf} />
          </div>
        </div>
        <div>
          <label className={labelCls} style={mf}>Nombre / Razón Social</label>
          <input value={e.name} onChange={ev => setE({ ...e, name: ev.target.value })} disabled={detail.is_consumidor_final} className={`${smallInputCls} disabled:opacity-50`} style={mf} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={labelCls} style={mf}>Email</label><input value={e.email} onChange={ev => setE({ ...e, email: ev.target.value })} type="email" className={smallInputCls} style={mf} /></div>
          <div><label className={labelCls} style={mf}>Teléfono</label><input value={e.phone} onChange={ev => setE({ ...e, phone: ev.target.value })} className={smallInputCls} style={mf} /></div>
        </div>
        <div><label className={labelCls} style={mf}>Dirección</label><input value={e.address} onChange={ev => setE({ ...e, address: ev.target.value })} className={smallInputCls} style={mf} /></div>
        <div><label className={labelCls} style={mf}>País</label><CountrySelect value={e.country || ''} onChange={(v) => setE({ ...e, country: v })} /></div>
        {!detail.is_consumidor_final && listaDatos.length + (esNuevo ? 1 : 0) > 1 && (
          <div className="flex items-center justify-between gap-3 min-h-7">
            <span className="text-[12.5px] text-digi-text" style={mf}>Usar por defecto al facturar</span>
            <div className="flex items-center gap-2">
            {/* Quitar unos datos extra va aquí, en un hueco que existe siempre (vacío si no se
                puede quitar): junto al selector lo estrechaba y movía las opciones. */}
            {user?.role === 'admin' && datoActual && !datoActual.titular
              ? <BotonQuitar onClick={quitarDato} etiqueta="Quitar estos datos de facturación" />
              : <span aria-hidden className="w-7 h-7" />}
            <Interruptor
              etiqueta="Usar por defecto al facturar"
              activo={esNuevo ? nuevoPredeterminado : !!datoActual?.predeterminada}
              // Siempre hay unos por defecto: apagarlo en unos extra devuelve el papel a los del cliente.
              disabled={!esNuevo && !!datoActual?.titular && !!datoActual?.predeterminada}
              onChange={(v) => {
                if (esNuevo) { setNuevoPredeterminado(v); return; }
                if (!datoActual) return;
                const titular = listaDatos.find((x: any) => x.titular);
                marcarPredeterminado(v ? datoActual.id : titular?.id ?? detail.id);
              }}
            />
            </div>
          </div>
        )}
        <div><label className={labelCls} style={mf}>Notas del cliente</label><textarea value={notas} onChange={ev => setNotas(ev.target.value)} rows={2} className={`${smallInputCls} resize-none`} style={mf} /></div>
        {detail.aliases?.length > 0 && (
          <div className="text-[11px] text-digi-muted" style={mf}><span className="text-accent font-medium">Identificaciones fusionadas: </span>{detail.aliases.join(', ')}</div>
        )}
    </>
  );
  const guardarFicha = !fichaLista ? null : (
        <button onClick={saveClient} disabled={saving} className={BTN_PRIMARY} style={mf}>
          {saving ? 'Guardando…' : savedOk ? <><CheckCircle2 className="w-4 h-4" /> Guardado</> : esNuevo ? 'Guardar datos' : 'Guardar cambios'}
        </button>
  );
  /** `enPanel`: en la columna de escritorio la lista de facturas se queda con el alto que sobra
   *  y se desplaza sola (ver `PanelDetalle`); en el teléfono va seguida, como antes. */
  const consumosFicha = (enPanel: boolean) => !fichaLista ? null : (
    <>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-digi-darker border border-digi-border rounded-lg px-2.5 py-2"><div className="text-[10px] text-digi-muted uppercase tracking-wide" style={mf}>Facturas</div><div className="text-[16px] font-semibold text-digi-text" style={mf}>{detail.summary.count}</div></div>
          <div className="bg-digi-darker border border-digi-border rounded-lg px-2.5 py-2"><div className="text-[10px] text-digi-muted uppercase tracking-wide" style={mf}>Total</div><div className="text-[16px] font-semibold text-digi-text tabular-nums" style={mf}>${fmt2(detail.summary.total_facturado)}</div></div>
          <div className="bg-digi-darker border border-digi-border rounded-lg px-2.5 py-2"><div className="text-[10px] text-digi-muted uppercase tracking-wide" style={mf}>Autorizado</div><div className="text-[16px] font-semibold text-green-600 tabular-nums" style={mf}>${fmt2(detail.summary.total_autorizado)}</div></div>
        </div>
        <div className={enPanel ? 'flex-1 min-h-32 flex flex-col gap-3' : 'space-y-3'}>
        <h4 className="text-[12px] font-semibold text-digi-text border-b border-digi-border pb-1.5 shrink-0" style={mf}>Facturas ({detail.invoices.length})</h4>
        {detail.invoices.length === 0 ? (
          <p className="text-[12px] text-digi-muted py-3 text-center" style={mf}>Sin facturas registradas para este cliente.</p>
        ) : (
          <div className={`space-y-2 ${enPanel ? 'min-h-0 overflow-y-auto' : ''}`}>
            {detail.invoices.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between gap-2 px-3 py-2 border border-digi-border rounded-lg bg-digi-darker">
                <div className="min-w-0">
                  <div className="text-[12px] font-medium text-digi-text" style={mf}>{inv.invoice_number || `Factura #${inv.id}`}</div>
                  <div className="text-[11px] text-digi-muted flex items-center gap-2 flex-wrap" style={mf}>
                    <span>{inv.created_at}</span>
                    <span>· ${fmt2(inv.total)}</span>
                    <PixelBadge variant={STATUS_V[inv.status] || 'default'}>{STATUS_LABEL[inv.status] || inv.status}</PixelBadge>
                    {inv.origin_label && <span className="text-digi-muted">· {inv.origin_label}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {inv.origin_type && (
                    <button onClick={() => goOrigin(inv)} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] border border-digi-border rounded text-digi-muted hover:text-digi-text transition-colors" style={mf}><ExternalLink className="w-3 h-3" /> Origen</button>
                  )}
                  <button onClick={() => router.push(`/dashboard/invoices/${inv.id}`)} className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] border border-accent/40 rounded text-accent hover:bg-accent-light transition-colors" style={mf}><FileText className="w-3 h-3" /> Factura</button>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
    </>
  );
  const puedeEliminar = fichaLista && user?.role === 'admin' && !detail.is_consumidor_final;
  /** Las acciones en UNA fila (regla «PieAcciones», Fernando 2026-10-31): papelera sola a la
   *  izquierda y «Guardar cambios» a la derecha; en «Consumos» solo la papelera. */
  const accionesFicha = !fichaLista || (detailTab !== 'datos' && !puedeEliminar) ? null : (
    <PieAcciones onEliminar={puedeEliminar ? deleteClient : undefined} etiquetaEliminar="Eliminar cliente">
      {detailTab === 'datos' && guardarFicha}
    </PieAcciones>
  );

  /** El cuerpo de la ficha en la ventana del teléfono. */
  const cuerpoFicha = !fichaLista ? null : (
    <>
  {/* Segmented toggle */}
  <div className="px-4 pt-3">
    {toggleFicha}
  </div>

  {/* Sin alto propio: desplaza el cuerpo de la ventana, no una segunda caja dentro. */}
  <div className="p-4 space-y-3">
    {detailTab === 'datos' ? datosFicha : consumosFicha(false)}
  </div>
    </>
  );

  return (
    <div>
      <PageHeader title="Clientes" description="Clientes de facturación y sus consumos" />

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* ── Left rail: tipo de identificación ── */}
        <FilterRail
          title="Tipo de identificación"
          items={ID_TYPE_TABS.map((t) => ({ value: t.value, label: t.label, Icon: t.Icon, count: countByType[t.value] }))}
          value={scopeType}
          onChange={setScopeType}
        />

        {/* ── Right region: command bar + (list · detail) ── */}
        <div className="flex-1 min-w-0 w-full">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-4 items-start">
            <div className="min-w-0">
              {/* ⇒ EL PANEL DE DETALLE EMPIEZA ARRIBA (Fernando, 2026-10-29): la barra va dentro de
                  la columna de la lista. «Nuevo cliente» es la acción principal. */}
              <BarraLista
                busqueda={search}
                onBusqueda={setSearch}
                placeholder="Nombre, identificación o email…"
                acciones={[
                  { label: 'Nuevo cliente', icon: Plus, onClick: () => { resetCreate(); setShowCreate(true); }, tipo: 'primaria' },
                ]}
              />
              {/* Vacía o cargando, también hasta el pie (Fernando, 2026-10-29). */}
              <TablaVaciaHastaElPie vacia={sortedClients.length === 0}>
              <PixelDataTable
                singleLine
                recuento={`${sortedClients.length} cliente${sortedClients.length === 1 ? '' : 's'} · ${sortedClients.reduce((s, c) => s + Number(c.facturas || 0), 0)} facturas`}
                resumen={<>Total facturado: <span className="text-accent font-semibold tabular-nums">${fmt2(sortedClients.reduce((s, c) => s + Number(c.total || 0), 0))}</span></>}
                sortBy={sortBy} sortDir={sortDir} onSort={onSort}
                data={sortedClients}
                onRowClick={(c: any) => openDetail(c)}
                emptyTitle="Sin clientes"
                emptyDesc="No hay clientes en este tipo."
                columns={[
                  { key: 'name', header: 'Cliente', width: '200px', sortKey: 'name', render: (c: any) => (
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={`truncate text-[13px] font-medium ${selected?.id === c.id ? 'text-accent' : 'text-digi-text'}`} style={mf}>{c.name}</span>
                      {c.is_consumidor_final && <PixelBadge variant="info" className="shrink-0">CF</PixelBadge>}
                    </span>
                  ) },
                  { key: 'id', header: 'Identificación', width: '150px', hideOnMobile: true, render: (c: any) => <span className="text-[12px] text-digi-text" style={mf}>{c.ruc}</span> },
                  { key: 'email', header: 'Email', width: '160px', hideOnMobile: true, render: (c: any) => <span className="text-[12px] text-digi-muted" style={mf}>{c.email || '—'}</span> },
                  { key: 'facturas', header: 'Facturas', width: '90px', sortKey: 'facturas', hideOnMobile: true, render: (c: any) => <span className="text-[12px] text-digi-text tabular-nums" style={mf}>{c.facturas}</span> },
                  { key: 'total', header: 'Total facturado', width: '130px', sortKey: 'total', render: (c: any) => <span className="text-[12px] text-digi-text tabular-nums" style={mf}>${fmt2(Number(c.total))}</span> },
                  { key: 'ultima', header: 'Última factura', width: '140px', sortKey: 'ultima', hideOnMobile: true, render: (c: any) => <span className="text-[12px] text-digi-muted" style={mf}>{fechaEs(c.ultima)}</span> },
                ]}
                /* ── El cliente, contado para un teléfono ─────────────────────────────
                   La tabla recorta el nombre a media columna («Compañía Internacional
                   de …», «EXPORTADORA DE FLORES …») y esconde con `hideOnMobile` la
                   identificación, el correo, el número de facturas y la última — o sea,
                   **todo lo que distingue a un cliente de otro**, que en una cartera de
                   23 con nombres largos y parecidos es justo lo que se viene a mirar. */
                tarjetaMovil={(c: any) => (
                  <>
                    <div className="flex items-start gap-2">
                      <span className="flex-1 min-w-0 text-[13.5px] font-medium text-digi-text leading-snug" style={mf}>{c.name}</span>
                      {c.is_consumidor_final && <PixelBadge variant="info">CF</PixelBadge>}
                      <span className="shrink-0 text-[13px] font-semibold text-digi-text tabular-nums" style={mf}>${fmt2(Number(c.total || 0))}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] text-digi-muted" style={mf}>
                      {c.ruc && <span className="tabular-nums">{c.ruc}</span>}
                      <span className="tabular-nums">{c.facturas || 0} factura{Number(c.facturas) === 1 ? '' : 's'}</span>
                      {c.ultima && <span className="ml-auto">Última {new Date(c.ultima).toLocaleDateString('es-EC')}</span>}
                    </div>
                    {c.email && <p className="mt-0.5 text-[12px] text-digi-muted truncate" style={mf}>{c.email}</p>}
                  </>
                )}
              />
              </TablaVaciaHastaElPie>
            </div>

            {/* ── Ficha del cliente ───────────────────────────────────────────────
                Es donde se editan sus datos y se ven sus facturas. En teléfono caía bajo
                la lista de 23 clientes, así que tocar una fila no producía ningún cambio
                visible. Ahí se abre a pantalla completa. */}
            <aside className="hidden xl:block w-full xl:w-[400px]">
              {!selected ? (
                <PanelHastaElPie desdeAncho={1280} className="bg-digi-card border border-digi-border rounded-lg p-6 text-center flex flex-col justify-center">
                  <div className="w-10 h-10 rounded-lg bg-black/[0.03] flex items-center justify-center mx-auto mb-2">
                    <Users className="w-5 h-5 text-digi-muted" />
                  </div>
                  <p className="text-[12px] text-digi-muted" style={mf}>Selecciona un cliente para ver y editar sus datos.</p>
                </PanelHastaElPie>
              ) : loadingDetail || !detail ? (
                <PanelHastaElPie desdeAncho={1280} className="bg-digi-card border border-digi-border rounded-lg p-10 text-center text-[12px] text-digi-muted flex flex-col justify-center"><span style={mf}>Cargando…</span></PanelHastaElPie>
              ) : (
                /* La ficha en tres franjas (Fernando, 2026-10-29): cabecera y acciones fijas, y lo
                   que se desplaza es el cuerpo; en «Consumos», la lista de facturas se queda con el
                   alto que sobra y se desplaza sola. Ver `PanelDetalle`. */
                <PanelDetalle
                  titulo={
                    <span className="flex items-center gap-2">
                      <span className="truncate">{detail.name}</span>
                      {detail.is_consumidor_final && <PixelBadge variant="info">CF</PixelBadge>}
                    </span>
                  }
                  subtitulo={[ID_TYPE_LABEL[detail.id_type] || detail.id_type, detail.ruc].filter(Boolean).join(' · ') || undefined}
                  onCerrar={() => { setSelected(null); setDetail(null); }}
                  pie={accionesFicha ?? undefined}
                >
                  <div>{toggleFicha}</div>
                  {detailTab === 'datos' ? datosFicha : consumosFicha(true)}
                </PanelDetalle>
              )}
            </aside>
          </div>
        </div>
      </div>


      {/* El detalle en teléfono. En escritorio NO se monta: ver `enTelefono`. */}
      {enTelefono && (
        <PixelModal
          open={!!selected}
          onClose={() => { setSelected(null); setDetail(null); }}
          title={detail?.name || 'Cliente'}
          size="md"
          pie={accionesFicha}
        >
          {loadingDetail || !detail
            ? <p className="py-10 text-center text-[12px] text-digi-muted" style={mf}>Cargando…</p>
            : cuerpoFicha}
        </PixelModal>
      )}

      {/* Create Modal */}
      <PixelModal open={showCreate} onClose={() => setShowCreate(false)} title="Nuevo cliente">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls} style={mf}>Tipo ID</label>
              <select value={cIdType} onChange={ev => { const t = ev.target.value; setCIdType(t); if (t === '07') { setCRuc('9999999999999'); setCName('CONSUMIDOR FINAL'); } else { if (cRuc === '9999999999999') setCRuc(''); if (cName === 'CONSUMIDOR FINAL') setCName(''); } }} className={`${smallInputCls} field-select appearance-none`} style={mf}>
                <option value="04">RUC</option><option value="05">Cédula</option><option value="06">Pasaporte</option><option value="07">Consumidor Final</option><option value="08">ID Exterior</option>
              </select>
            </div>
            <div>
              <label className={labelCls} style={mf}>Identificación *</label>
              <input value={cRuc} onChange={ev => setCRuc(ev.target.value)} disabled={cIdType === '07'} className={`${smallInputCls} disabled:opacity-50`} style={mf} />
            </div>
          </div>
          <div>
            <label className={labelCls} style={mf}>Nombre / Razón Social *</label>
            <input value={cName} onChange={ev => setCName(ev.target.value)} disabled={cIdType === '07'} className={`${inputCls} disabled:opacity-50`} style={mf} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className={labelCls} style={mf}>Email</label><input value={cEmail} onChange={ev => setCEmail(ev.target.value)} type="email" className={smallInputCls} style={mf} /></div>
            <div><label className={labelCls} style={mf}>Teléfono</label><input value={cPhone} onChange={ev => setCPhone(ev.target.value)} className={smallInputCls} style={mf} /></div>
          </div>
          <div><label className={labelCls} style={mf}>Dirección</label><input value={cAddress} onChange={ev => setCAddress(ev.target.value)} className={smallInputCls} style={mf} /></div>
          <div><label className={labelCls} style={mf}>País</label><CountrySelect value={cCountry} onChange={setCCountry} /></div>
          <button onClick={createClient} disabled={creating} className="pixel-btn pixel-btn-primary w-full disabled:opacity-50">{creating ? '...' : 'Crear cliente'}</button>
        </div>
      </PixelModal>

      <PixelConfirm
        open={!!confirmCfg}
        title={confirmCfg?.title}
        message={confirmCfg?.message || ''}
        confirmLabel={confirmCfg?.confirmLabel}
        danger={confirmCfg?.danger}
        onConfirm={() => { const fn = confirmCfg?.onConfirm; setConfirmCfg(null); fn?.(); }}
        onCancel={() => setConfirmCfg(null)}
      />
    </div>
  );
}
