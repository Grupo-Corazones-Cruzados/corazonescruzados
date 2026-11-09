'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Wallet, CheckCircle2, MinusCircle, Landmark, Pencil, Plus, XCircle } from 'lucide-react';
import { Cifra } from '@/components/ui/Cifra';
import PixelDataTable from '@/components/ui/PixelDataTable';
import TablaVaciaHastaElPie from '@/components/ui/TablaVaciaHastaElPie';
import Segmentado from '@/components/ui/Segmentado';
import { EditPanel, EditField, EDIT_INPUT } from '@/components/ui/EditDialog';
import { BTN_SECONDARY } from '@/components/ui/Button';
import { useAuth } from '@/components/providers/AuthProvider';
import { money } from '@/lib/format';
import type { CuentaVisible, Ganancia, Pago, Saldo, TipoCuenta } from '@/lib/pagos-miembros';
import { columnasGanancias, tarjetaGanancia, columnasPagos, tarjetaPago, fechaCorta, mf, Dato } from '@/components/cobros/comun';

const df = { fontFamily: 'var(--font-display)' } as const;

type Datos = { ganancias: Ganancia[]; pagos: Pago[]; saldo: Saldo; cuenta: CuentaVisible | null };
type Borrador = { titular: string; identificacion: string; banco: string; tipo: TipoCuenta; numero: string };

const TIPO: Record<TipoCuenta, string> = { ahorros: 'Ahorros', corriente: 'Corriente' };

/**
 * Configuración → Cobros (fase 4, paso 2 del modelo económico, 2026-11-09): lo que GCC le debe a esta persona y
 * lo que ya le pagó. GCC cobra todo y después transfiere a cada miembro o candidato lo suyo, a la cuenta que
 * registra aquí (solo ella puede cambiarla; el número se guarda cifrado y aquí solo se ven los 4 últimos).
 */
export default function CobrosPanel() {
  const { suplantacion } = useAuth();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [vista, setVista] = useState<'ganancias' | 'pagos'>('ganancias');
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/cobros');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'No se pudieron cargar tus cobros.');
      setDatos(j.data);
      setErr(null);
    } catch (e: any) { setErr(e.message); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const cuenta = datos?.cuenta ?? null;
  const abrir = () => setBorrador({
    titular: cuenta?.titular ?? '', identificacion: cuenta?.identificacion ?? '', banco: cuenta?.banco ?? '',
    tipo: cuenta?.tipo ?? 'ahorros', numero: '',
  });

  const guardar = async () => {
    if (!borrador) return;
    setGuardando(true);
    try {
      const r = await fetch('/api/cobros/cuenta', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(borrador),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(j.error || 'No se pudo guardar la cuenta.'); return; }
      setDatos((d) => (d ? { ...d, cuenta: j.data } : d));
      setBorrador(null);
      toast.success('Cuenta guardada');
    } finally { setGuardando(false); }
  };

  const puedeGuardar = !!borrador && borrador.titular.trim().length >= 3 && borrador.identificacion.trim().length >= 10
    && borrador.banco.trim().length >= 2 && (!!cuenta || /^\d{5,20}$/.test(borrador.numero.replace(/[\s-]+/g, '')));
  const saldo = datos?.saldo;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 max-lg:p-0 flex flex-col gap-3">
      {err && (
        <div className="px-3 py-2 rounded-md border border-red-400/40 bg-red-500/10 text-[12px] text-red-600 flex items-center gap-2" style={mf}>
          <XCircle className="w-4 h-4 shrink-0" /> {err}
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 max-md:[&>*:last-child:nth-child(odd)]:col-span-2">
        <Cifra Icon={Wallet} label="Por cobrar" value={saldo ? money(saldo.saldo) : undefined} />
        <Cifra Icon={CheckCircle2} tone="green" label="Pagado" value={saldo ? money(saldo.pagado) : undefined} />
        {saldo && saldo.descuento > 0 && <Cifra Icon={MinusCircle} tone="red" label="Por descontar" value={money(saldo.descuento)} />}
        <Cifra Icon={Landmark} label="Cuenta" value={datos ? (cuenta ? `•••• ${cuenta.ultimos4}` : 'Sin registrar') : undefined} />
      </div>

      <section className="bg-digi-card border border-digi-border rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-[13.5px] font-semibold text-digi-text mb-2" style={df}>Cuenta bancaria</h3>
          {cuenta ? (
            <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 text-[12.5px]" style={mf}>
              <Dato t="Titular" v={cuenta.titular} />
              <Dato t="Cédula o RUC" v={cuenta.identificacion} />
              <Dato t="Banco" v={cuenta.banco} />
              <Dato t={`Cuenta de ${TIPO[cuenta.tipo].toLowerCase()}`} v={`•••• ${cuenta.ultimos4}`} />
            </dl>
          ) : (
            <p className="text-[12.5px] text-digi-muted" style={mf}>{datos ? 'Aún no registras la cuenta en la que te pagamos.' : 'Cargando…'}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 sm:self-end">
          {cuenta && <span className="text-[11.5px] text-digi-muted" style={mf}>Actualizada el {fechaCorta(cuenta.actualizada)}</span>}
          <button type="button" onClick={abrir} disabled={!datos || !!suplantacion} className={BTN_SECONDARY}
            title={suplantacion ? 'La cuenta de cobro solo la cambia su dueño' : undefined}>
            {cuenta ? <><Pencil className="w-4 h-4" /> Editar cuenta</> : <><Plus className="w-4 h-4" /> Registrar cuenta</>}
          </button>
        </div>
      </section>

      <div className="flex flex-col min-h-0">
        <Segmentado etiqueta="Historial" className="w-full sm:max-w-xs mb-3" valor={vista} onChange={setVista}
          opciones={[
            { valor: 'ganancias', texto: `Ganancias${datos ? ` · ${datos.ganancias.length}` : ''}` },
            { valor: 'pagos', texto: `Pagos${datos ? ` · ${datos.pagos.length}` : ''}` },
          ]} />
        {vista === 'ganancias' ? (
          <TablaVaciaHastaElPie vacia={!datos || datos.ganancias.length === 0}>
            <PixelDataTable<Ganancia>
              singleLine unidad={['ganancia', 'ganancias']} cargando={!datos && !err}
              data={datos?.ganancias ?? []} columns={columnasGanancias()} tarjetaMovil={tarjetaGanancia}
              emptyTitle="Sin ganancias" emptyDesc="Aquí aparece lo que ganas cuando se cobra un ticket, un proyecto o una suscripción."
              resumen={saldo ? <>Por cobrar <b className="tabular-nums">{money(saldo.saldo)}</b></> : undefined}
            />
          </TablaVaciaHastaElPie>
        ) : (
          <TablaVaciaHastaElPie vacia={!datos || datos.pagos.length === 0}>
            <PixelDataTable<Pago>
              singleLine unidad={['pago', 'pagos']} cargando={!datos && !err}
              data={datos?.pagos ?? []} columns={columnasPagos()} tarjetaMovil={(p) => tarjetaPago(p)}
              emptyTitle="Sin pagos" emptyDesc="Aquí aparece cada transferencia que te hacemos."
              resumen={saldo ? <>Pagado <b className="tabular-nums">{money(saldo.pagado)}</b></> : undefined}
            />
          </TablaVaciaHastaElPie>
        )}
      </div>

      <EditPanel open={!!borrador} title={cuenta ? 'Editar cuenta bancaria' : 'Registrar cuenta bancaria'}
        onClose={() => setBorrador(null)} onSave={guardar} saving={guardando} canSave={puedeGuardar} saveLabel="Guardar cuenta">
        {borrador && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <EditField label="Titular">
              <input className={EDIT_INPUT} value={borrador.titular} maxLength={120} autoComplete="name"
                onChange={(e) => setBorrador({ ...borrador, titular: e.target.value })} />
            </EditField>
            <EditField label="Cédula o RUC">
              <input className={EDIT_INPUT} value={borrador.identificacion} inputMode="numeric" maxLength={13}
                onChange={(e) => setBorrador({ ...borrador, identificacion: e.target.value.replace(/\D/g, '') })} />
            </EditField>
            <EditField label="Banco">
              <input className={EDIT_INPUT} value={borrador.banco} maxLength={80}
                onChange={(e) => setBorrador({ ...borrador, banco: e.target.value })} />
            </EditField>
            <EditField label="Tipo de cuenta">
              <Segmentado etiqueta="Tipo de cuenta" className="w-full" valor={borrador.tipo}
                onChange={(tipo) => setBorrador({ ...borrador, tipo })}
                opciones={[{ valor: 'ahorros', texto: 'Ahorros' }, { valor: 'corriente', texto: 'Corriente' }]} />
            </EditField>
            <EditField label="Número de cuenta">
              <input className={EDIT_INPUT} value={borrador.numero} inputMode="numeric" maxLength={24} autoComplete="off"
                placeholder={cuenta ? `•••• ${cuenta.ultimos4}` : ''}
                onChange={(e) => setBorrador({ ...borrador, numero: e.target.value.replace(/[^\d\s-]/g, '') })} />
            </EditField>
          </div>
        )}
      </EditPanel>
    </div>
  );
}
