'use client';

/**
 * ADMIN → PAGOS A MIEMBROS (fase 4, paso 2 del modelo económico, 2026-11-09).
 *
 * GCC cobra todo y después le transfiere a cada miembro o candidato lo que ganó (`member_earnings`). Aquí se ve a
 * quién se le debe, se registra la transferencia (con su comprobante, que va al Drive de la empresa) y se anula
 * un pago mal registrado. Rail de estado + lista, como las demás pestañas del admin; registrar y ver un pago, en
 * el panel derecho.
 *
 * El número de cuenta entero solo aparece dentro del panel de registrar el pago: se pide al abrirlo
 * (`/api/admin/pagos-miembros/cuenta`, que deja escrito quién lo miró). En la lista, solo si tiene cuenta.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Wallet, CheckCircle2, Users, Receipt, Copy, Paperclip, Upload } from 'lucide-react';
import FilterRail from '@/components/ui/FilterRail';
import BarraLista from '@/components/ui/BarraLista';
import PixelDataTable from '@/components/ui/PixelDataTable';
import TablaVaciaHastaElPie from '@/components/ui/TablaVaciaHastaElPie';
import PixelModal from '@/components/ui/PixelModal';
import PixelConfirm from '@/components/ui/PixelConfirm';
import PieAcciones from '@/components/ui/PieAcciones';
import BotonQuitar from '@/components/ui/BotonQuitar';
import { FilaMarcable } from '@/components/ui/ListaMarcable';
import { EditField, EditAmount, EDIT_INPUT } from '@/components/ui/EditDialog';
import { BTN_PRIMARY, BTN_SECONDARY, BTN_ICONO_FILA } from '@/components/ui/Button';
import { money } from '@/lib/format';
import type { CuentaDescifrada, Ganancia, Pago, PersonaPorPagar, Saldo } from '@/lib/pagos-miembros';
import { columnasPagos, tarjetaPago, fechaCorta, origenDe, EnlaceComprobante, ESTADO_PAGO, mf } from '@/components/cobros/comun';

const df = { fontFamily: 'var(--font-display)' } as const;

type Filtro = 'con_saldo' | 'pagados' | 'todos' | 'historial';
type Lista = { personas: PersonaPorPagar[]; pagos: Pago[] };
type Cobros = { ganancias: Ganancia[]; pagos: Pago[]; saldo: Saldo };

const hoyEcuador = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const enFiltro = (p: PersonaPorPagar, f: Filtro) =>
  f === 'todos' || (f === 'con_saldo' ? p.saldo > 0 : f === 'pagados' ? p.saldo <= 0 && p.pagos > 0 : false);

export default function PagosMiembrosPanel() {
  const [lista, setLista] = useState<Lista | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('con_saldo');
  const [busqueda, setBusqueda] = useState('');
  const [persona, setPersona] = useState<PersonaPorPagar | null>(null);
  const [pagoId, setPagoId] = useState<number | null>(null);

  const cargar = useCallback(async () => {
    const r = await fetch('/api/admin/pagos-miembros');
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(j.error || 'No se pudieron cargar los pagos'); setLista({ personas: [], pagos: [] }); return; }
    setLista(j.data);
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const q = busqueda.trim().toLowerCase();
  const personas = useMemo(
    () => (lista?.personas ?? []).filter((p) => enFiltro(p, filtro) && (!q || `${p.nombre} ${p.email}`.toLowerCase().includes(q))),
    [lista, filtro, q],
  );
  const pagos = useMemo(
    () => (lista?.pagos ?? []).filter((p) => !q || `${p.persona ?? ''} ${p.referencia}`.toLowerCase().includes(q)),
    [lista, q],
  );
  const cuenta = (f: Filtro) => (lista ? lista.personas.filter((p) => enFiltro(p, f)).length : undefined);
  const porPagar = useMemo(() => personas.reduce((s, p) => s + Math.max(0, p.saldo), 0), [personas]);

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start">
      <FilterRail<Filtro>
        value={filtro}
        onChange={setFiltro}
        sections={[
          {
            title: 'Personas',
            items: [
              { value: 'con_saldo', label: 'Con saldo', Icon: Wallet, count: cuenta('con_saldo') },
              { value: 'pagados', label: 'Pagados', Icon: CheckCircle2, count: cuenta('pagados') },
              { value: 'todos', label: 'Todos', Icon: Users, count: cuenta('todos') },
            ],
          },
          { title: 'Historial', items: [{ value: 'historial', label: 'Pagos registrados', Icon: Receipt, count: lista?.pagos.length }] },
        ]}
      />

      <div className="flex-1 min-w-0 w-full">
        <BarraLista busqueda={busqueda} onBusqueda={setBusqueda}
          placeholder={filtro === 'historial' ? 'Buscar por persona o referencia' : 'Buscar por nombre o correo'} />
        {filtro === 'historial' ? (
          <TablaVaciaHastaElPie vacia={pagos.length === 0}>
            <PixelDataTable<Pago>
              singleLine unidad={['pago', 'pagos']} cargando={!lista}
              data={pagos} columns={columnasPagos(true)} tarjetaMovil={(p) => tarjetaPago(p, true)}
              onRowClick={(p) => setPagoId(p.id)}
              emptyTitle="Sin pagos" emptyDesc="Aquí aparece cada transferencia registrada."
            />
          </TablaVaciaHastaElPie>
        ) : (
          <TablaVaciaHastaElPie vacia={personas.length === 0}>
            <PixelDataTable<PersonaPorPagar>
              singleLine unidad={['persona', 'personas']} cargando={!lista}
              data={personas} onRowClick={setPersona}
              emptyTitle={filtro === 'con_saldo' ? 'Nadie por pagar' : 'Sin personas'}
              emptyDesc={filtro === 'con_saldo' ? 'Cuando se cobre algo que ganó un miembro, aparecerá aquí.' : 'Todavía no hay ganancias ni pagos.'}
              resumen={personas.length > 0 ? <>Por pagar <b className="tabular-nums">{money(porPagar)}</b></> : undefined}
              columns={[
                { key: 'nombre', header: 'Persona', render: (p) => (
                  <span className="block min-w-0">
                    <span className="block truncate text-[13px] font-medium text-digi-text" style={mf}>{p.nombre}</span>
                    <span className="block truncate text-[11.5px] text-digi-muted" style={mf}>{p.email}</span>
                  </span>
                ) },
                { key: 'saldo', header: 'Por pagar', width: '120px', render: (p) => (
                  <span className={`block text-right text-[13px] tabular-nums ${p.saldo > 0 ? 'text-digi-text font-medium' : 'text-digi-muted'}`} style={mf}>{money(p.saldo)}</span>
                ) },
                { key: 'pagado', header: 'Pagado', width: '120px', hideOnMobile: true, render: (p) => (
                  <span className="block text-right text-[12.5px] tabular-nums text-digi-muted" style={mf}>{money(p.pagado)}</span>
                ) },
                { key: 'ultimo', header: 'Último pago', width: '130px', render: (p) => <span className="text-[12px] text-digi-muted" style={mf}>{fechaCorta(p.ultimoPago)}</span> },
                { key: 'cuenta', header: 'Cuenta', width: '120px', render: (p) => (
                  <span className={`text-[12px] ${p.tieneCuenta ? 'text-digi-muted' : 'text-red-600'}`} style={mf}>{p.tieneCuenta ? 'Registrada' : 'Sin cuenta'}</span>
                ) },
              ]}
              tarjetaMovil={(p) => (
                <>
                  <div className="flex items-start gap-2">
                    <span className="flex-1 min-w-0 text-[13.5px] font-medium text-digi-text truncate" style={mf}>{p.nombre}</span>
                    <span className="shrink-0 text-[13.5px] font-medium tabular-nums text-digi-text" style={mf}>{money(p.saldo)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-[12px] text-digi-muted" style={mf}>
                    <span>{fechaCorta(p.ultimoPago)}</span>
                    <span className={`ml-auto ${p.tieneCuenta ? '' : 'text-red-600'}`}>{p.tieneCuenta ? 'Registrada' : 'Sin cuenta'}</span>
                  </div>
                </>
              )}
            />
          </TablaVaciaHastaElPie>
        )}
      </div>

      <PanelPagar persona={persona} onClose={() => setPersona(null)} onVerPago={setPagoId}
        onPagado={() => { setPersona(null); cargar(); }} />
      <PanelPago id={pagoId} onClose={() => setPagoId(null)} onAnulado={() => { setPagoId(null); setPersona(null); cargar(); }} />
    </div>
  );
}

/* ── Registrar un pago ──────────────────────────────────────────────────────────────────────────── */

function PanelPagar({ persona, onClose, onPagado, onVerPago }: {
  persona: PersonaPorPagar | null; onClose: () => void; onPagado: () => void; onVerPago: (id: number) => void;
}) {
  const [cobros, setCobros] = useState<Cobros | null>(null);
  const [cuenta, setCuenta] = useState<CuentaDescifrada | null | undefined>(undefined);
  const [errCuenta, setErrCuenta] = useState<string | null>(null);
  const [elegidas, setElegidas] = useState<Set<number>>(new Set());
  const [fecha, setFecha] = useState(hoyEcuador());
  const [referencia, setReferencia] = useState('');
  const [nota, setNota] = useState('');
  const [archivo, setArchivo] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const archivoRef = useRef<HTMLInputElement>(null);
  const userId = persona?.userId;

  useEffect(() => {
    if (!userId) return;
    setCobros(null); setCuenta(undefined); setErrCuenta(null);
    setFecha(hoyEcuador()); setReferencia(''); setNota(''); setArchivo(null);
    let vivo = true;
    (async () => {
      const [rc, rk] = await Promise.all([
        fetch(`/api/admin/pagos-miembros?userId=${encodeURIComponent(userId)}`),
        fetch(`/api/admin/pagos-miembros/cuenta?userId=${encodeURIComponent(userId)}`),
      ]);
      const [jc, jk] = await Promise.all([rc.json().catch(() => ({})), rk.json().catch(() => ({}))]);
      if (!vivo) return;
      if (!rc.ok) { toast.error(jc.error || 'No se pudieron cargar sus ganancias'); return; }
      setCobros(jc.data);
      setElegidas(new Set((jc.data as Cobros).ganancias.filter((g) => g.estado === 'pendiente').map((g) => g.id)));
      if (rk.ok) setCuenta(jk.data ?? null);
      else { setCuenta(null); setErrCuenta(jk.error || 'No se pudo leer la cuenta'); }
    })();
    return () => { vivo = false; };
  }, [userId]);

  const pendientes = cobros?.ganancias.filter((g) => g.estado === 'pendiente') ?? [];
  const descuentos = cobros?.ganancias.filter((g) => g.porDescontar) ?? [];
  const total = Math.round((pendientes.filter((g) => elegidas.has(g.id)).reduce((s, g) => s + g.neto, 0)
    - descuentos.reduce((s, g) => s + g.neto, 0)) * 100) / 100;

  const motivo = !cobros ? 'Cargando…'
    : !cuenta ? 'Sin cuenta bancaria registrada'
      : !(total > 0) ? 'El total a pagar tiene que ser mayor que cero'
        : !referencia.trim() ? 'Falta la referencia de la transferencia' : null;

  const alternar = (id: number) => setElegidas((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const registrar = async () => {
    if (!persona || motivo) return;
    setGuardando(true);
    try {
      const f = new FormData();
      f.set('userId', persona.userId);
      f.set('esperado', total.toFixed(2));
      f.set('referencia', referencia.trim());
      f.set('fecha', fecha);
      f.set('nota', nota.trim());
      // Todas elegidas = «todas las pendientes»; si no, solo esas.
      if (elegidas.size !== pendientes.length) f.set('ids', JSON.stringify([...elegidas]));
      if (archivo) f.set('comprobante', archivo);
      const r = await fetch('/api/admin/pagos-miembros', { method: 'POST', body: f });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(j.error || 'No se pudo registrar el pago'); return; }
      toast.success(`Pago de ${money(j.data.total)} registrado`);
      onPagado();
    } finally { setGuardando(false); }
  };

  const copiar = (texto: string) => {
    navigator.clipboard?.writeText(texto).then(() => toast.success('Copiado'), () => toast.error('No se pudo copiar'));
  };

  return (
    <PixelModal open={!!persona} onClose={onClose} title={persona ? `Pagar a ${persona.nombre}` : 'Pagar'} size="xl" busy={guardando}
      pie={(
        <PieAcciones>
          <button type="button" onClick={onClose} disabled={guardando} className={BTN_SECONDARY}>Cancelar</button>
          <button type="button" onClick={registrar} disabled={!!motivo || guardando} title={motivo ?? undefined} className={BTN_PRIMARY}>
            {guardando ? 'Registrando…' : 'Registrar pago'}
          </button>
        </PieAcciones>
      )}>
      <div className="space-y-4">
        <Bloque titulo="Cuenta bancaria">
          {cuenta === undefined ? (
            <p className="text-[12.5px] text-digi-muted" style={mf}>Cargando…</p>
          ) : cuenta ? (
            <dl className="grid grid-cols-2 lg:grid-cols-5 gap-x-4 gap-y-2 text-[12.5px]" style={mf}>
              <Dato t="Titular" v={cuenta.titular} />
              <Dato t="Cédula o RUC" v={cuenta.identificacion} copiar={copiar} />
              <Dato t="Banco" v={cuenta.banco} />
              <Dato t="Tipo" v={cuenta.tipo === 'ahorros' ? 'Ahorros' : 'Corriente'} />
              <Dato t="Número" v={cuenta.numero} copiar={copiar} />
            </dl>
          ) : (
            <p className="text-[12.5px] text-red-600" style={mf}>{errCuenta || 'Sin cuenta bancaria registrada.'}</p>
          )}
        </Bloque>

        <Bloque titulo={`Por pagar${pendientes.length ? ` · ${elegidas.size} de ${pendientes.length}` : ''}`}>
          {!cobros ? <p className="text-[12.5px] text-digi-muted" style={mf}>Cargando…</p>
            : pendientes.length === 0 && descuentos.length === 0 ? <p className="text-[12.5px] text-digi-muted" style={mf}>Nada pendiente.</p>
              : (
                <div className="border border-digi-border rounded-md overflow-hidden divide-y divide-digi-border">
                  {pendientes.map((g) => (
                    <FilaMarcable key={g.id} marcada={elegidas.has(g.id)} onClick={() => alternar(g.id)}
                      etiqueta={`${fechaCorta(g.fecha)} · ${origenDe(g)}`} nota={<span className="tabular-nums">{money(g.neto)}</span>} />
                  ))}
                  {descuentos.map((g) => (
                    <div key={g.id} className="flex items-center gap-2 px-3 py-1.5 text-[12.5px]" style={mf} title="Se revirtió después de pagada: se descuenta">
                      <span className="w-4 shrink-0" />
                      <span className="truncate text-digi-text">{fechaCorta(g.fecha)} · {origenDe(g)}</span>
                      <span className="ml-auto shrink-0 text-[11.5px] text-red-600 tabular-nums">Revertido · −{money(g.neto)}</span>
                    </div>
                  ))}
                </div>
              )}
        </Bloque>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <EditField label="Fecha de la transferencia">
            <input type="date" className={EDIT_INPUT} value={fecha} max={hoyEcuador()} onChange={(e) => setFecha(e.target.value)} />
          </EditField>
          <EditField label="Referencia">
            <input className={EDIT_INPUT} value={referencia} maxLength={120} onChange={(e) => setReferencia(e.target.value)} />
          </EditField>
          <EditField label="Comprobante">
            <div className="flex items-center gap-2 min-h-[38px]">
              <input ref={archivoRef} type="file" accept="image/*,application/pdf" className="hidden"
                onChange={(e) => { setArchivo(e.target.files?.[0] ?? null); e.target.value = ''; }} />
              {archivo ? (
                <>
                  <Paperclip className="w-4 h-4 text-digi-muted shrink-0" />
                  <span className="truncate text-[12.5px] text-digi-text" style={mf} title={archivo.name}>{archivo.name}</span>
                  <BotonQuitar onClick={() => setArchivo(null)} etiqueta="Quitar comprobante" />
                </>
              ) : (
                <button type="button" onClick={() => archivoRef.current?.click()} className={BTN_SECONDARY}>
                  <Upload className="w-4 h-4" /> Adjuntar
                </button>
              )}
            </div>
          </EditField>
          <EditField label="Nota">
            <textarea className={`${EDIT_INPUT} min-h-[38px]`} rows={1} value={nota} maxLength={1000} onChange={(e) => setNota(e.target.value)} />
          </EditField>
        </div>

        <EditAmount label="Total a pagar" value={money(total)} />

        {cobros && cobros.pagos.length > 0 && (
          <Bloque titulo="Pagos anteriores">
            <div className="border border-digi-border rounded-md overflow-hidden divide-y divide-digi-border">
              {cobros.pagos.map((p) => (
                <button key={p.id} type="button" onClick={() => onVerPago(p.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left text-[12.5px] hover:bg-black/[0.03]" style={mf}>
                  <span className="w-24 shrink-0 text-digi-muted">{fechaCorta(p.fecha)}</span>
                  <span className="flex-1 min-w-0 truncate text-digi-text">{p.referencia}</span>
                  <span className={`shrink-0 ${p.estado === 'voided' ? 'text-red-600' : 'text-green-600'}`}>{ESTADO_PAGO[p.estado].texto}</span>
                  <span className={`w-24 shrink-0 text-right tabular-nums ${p.estado === 'voided' ? 'text-digi-muted line-through' : 'text-digi-text'}`}>{money(p.total)}</span>
                </button>
              ))}
            </div>
          </Bloque>
        )}
      </div>
    </PixelModal>
  );
}

/* ── Ver (y anular) un pago ─────────────────────────────────────────────────────────────────────── */

function PanelPago({ id, onClose, onAnulado }: { id: number | null; onClose: () => void; onAnulado: () => void }) {
  const [d, setD] = useState<{ pago: Pago; ganancias: Ganancia[]; descuentos: Ganancia[] } | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [anulando, setAnulando] = useState(false);

  useEffect(() => {
    if (id == null) return;
    setD(null);
    let vivo = true;
    (async () => {
      const r = await fetch(`/api/admin/pagos-miembros?pagoId=${id}`);
      const j = await r.json().catch(() => ({}));
      if (!vivo) return;
      if (!r.ok) { toast.error(j.error || 'No se pudo cargar el pago'); return; }
      setD(j.data);
    })();
    return () => { vivo = false; };
  }, [id]);

  const anular = async () => {
    if (id == null) return;
    setAnulando(true);
    try {
      const r = await fetch('/api/admin/pagos-miembros', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(j.error || 'No se pudo anular el pago'); return; }
      toast.success('Pago anulado');
      setConfirmar(false);
      onAnulado();
    } finally { setAnulando(false); }
  };

  const p = d?.pago;
  return (
    <>
      <PixelModal open={id != null} onClose={onClose} title={id != null ? `Pago #${id}` : 'Pago'} size="xl" busy={anulando}
        pie={(
          <PieAcciones onEliminar={p?.estado === 'paid' ? () => setConfirmar(true) : undefined} etiquetaEliminar="Anular pago">
            <button type="button" onClick={onClose} className={BTN_SECONDARY}>Cerrar</button>
          </PieAcciones>
        )}>
        {!p ? <p className="text-[12.5px] text-digi-muted" style={mf}>Cargando…</p> : (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-3 text-[12.5px]" style={mf}>
              <Dato t="Persona" v={p.persona || '—'} />
              <Dato t="Fecha" v={fechaCorta(p.fecha)} />
              <Dato t="Total" v={money(p.total)} />
              <Dato t="Estado" v={ESTADO_PAGO[p.estado].texto} tono={p.estado === 'voided' ? 'text-red-600' : 'text-green-600'} />
              <Dato t="Referencia" v={p.referencia} />
              <Dato t="Cuenta" v={[p.banco, p.ultimos4 ? `•••• ${p.ultimos4}` : null].filter(Boolean).join(' · ') || '—'} />
              <Dato t="Titular" v={p.titular || '—'} />
              <div className="min-w-0">
                <dt className="text-[10.5px] uppercase tracking-wide text-digi-muted">Comprobante</dt>
                <dd><EnlaceComprobante pago={p} /></dd>
              </div>
            </dl>
            {p.nota && <Bloque titulo="Nota"><p className="text-[12.5px] text-digi-text whitespace-pre-wrap" style={mf}>{p.nota}</p></Bloque>}
            <Bloque titulo={`Ganancias pagadas · ${d!.ganancias.length}`}>
              <FilasGanancias filas={d!.ganancias} vacio={p.estado === 'voided' ? 'Anulado: sus ganancias volvieron al saldo.' : 'Ninguna.'} />
            </Bloque>
            {d!.descuentos.length > 0 && (
              <Bloque titulo={`Descontado · ${d!.descuentos.length}`}><FilasGanancias filas={d!.descuentos} negativo /></Bloque>
            )}
          </div>
        )}
      </PixelModal>

      <PixelConfirm open={confirmar} danger title="Anular pago"
        message="El pago queda anulado y sus ganancias vuelven a estar pendientes. No se le avisa a la persona."
        confirmLabel={anulando ? 'Anulando…' : 'Anular pago'} onConfirm={anular} onCancel={() => setConfirmar(false)} />
    </>
  );
}

/* ── Piezas ─────────────────────────────────────────────────────────────────────────────────────── */

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[12.5px] font-semibold text-digi-text mb-2" style={df}>{titulo}</h3>
      {children}
    </section>
  );
}

function Dato({ t, v, copiar, tono = 'text-digi-text' }: { t: string; v: string; copiar?: (v: string) => void; tono?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] uppercase tracking-wide text-digi-muted">{t}</dt>
      <dd className={`flex items-center gap-1 min-w-0 ${tono}`}>
        <span className="truncate tabular-nums" title={v}>{v}</span>
        {copiar && (
          <button type="button" onClick={() => copiar(v)} className={BTN_ICONO_FILA} title={`Copiar ${t.toLowerCase()}`} aria-label={`Copiar ${t.toLowerCase()}`}>
            <Copy className="w-3.5 h-3.5" />
          </button>
        )}
      </dd>
    </div>
  );
}

function FilasGanancias({ filas, negativo = false, vacio = 'Ninguna.' }: { filas: Ganancia[]; negativo?: boolean; vacio?: string }) {
  if (filas.length === 0) return <p className="text-[12.5px] text-digi-muted" style={mf}>{vacio}</p>;
  return (
    <div className="border border-digi-border rounded-md overflow-hidden divide-y divide-digi-border">
      {filas.map((g) => (
        <div key={g.id} className="flex items-center gap-3 px-3 py-2 text-[12.5px]" style={mf}>
          <span className="w-24 shrink-0 text-digi-muted">{fechaCorta(g.fecha)}</span>
          <span className="flex-1 min-w-0 truncate text-digi-text" title={origenDe(g)}>{origenDe(g)}</span>
          <span className={`shrink-0 tabular-nums ${negativo ? 'text-red-600' : 'text-digi-text'}`}>{negativo ? '−' : ''}{money(g.neto)}</span>
        </div>
      ))}
    </div>
  );
}
