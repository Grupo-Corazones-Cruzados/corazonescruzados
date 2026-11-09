'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Receipt, BadgeCheck, KeyRound, Pencil, Plus, Upload, XCircle, Paperclip } from 'lucide-react';
import { Cifra } from '@/components/ui/Cifra';
import Segmentado from '@/components/ui/Segmentado';
import Interruptor from '@/components/ui/Interruptor';
import { EditPanel, QuickEditDialog, EditField, EDIT_INPUT } from '@/components/ui/EditDialog';
import { BTN_SECONDARY } from '@/components/ui/Button';
import { useAuth } from '@/components/providers/AuthProvider';
import { fechaCorta, mf, Dato } from '@/components/cobros/comun';
import { ESTADO_EMISOR, REGIMEN_TEXTO, TARIFA_IVA, EstadoEmisorTexto } from '@/components/facturacion/comun';
import { LEYENDA_REGIMEN, type Regimen } from '@/lib/integrations/sri/regimen';
import type { EmisorVisible } from '@/lib/facturacion-emisores';

const df = { fontFamily: 'var(--font-display)' } as const;

type Borrador = {
  ruc: string; razonSocial: string; nombreComercial: string; dirMatriz: string; dirEstablecimiento: string;
  estab: string; ptoEmi: string; obligadoContabilidad: boolean; regimen: Regimen; cobraIva: boolean; tarifaIva: string;
};

/**
 * Configuración → Facturación (fase 4, paso 3 del modelo económico, 2026-11-09): la cuenta de emisor con la que
 * la plataforma hará las facturas de esta persona —su RUC y su firma electrónica—. La firma se sube aquí, se
 * guarda cifrada y nunca vuelve al navegador: solo se ven el titular y el vencimiento. Emitir con ella es el
 * paso 4; mientras tanto la cuenta queda en el estado que le ponga el administrador.
 *
 * Fernando ve aquí la cuenta de GCC, de solo lectura (su firma está en el servidor).
 */
export default function FacturacionPanel() {
  const { suplantacion } = useAuth();
  const [emisor, setEmisor] = useState<EmisorVisible | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [firmaAbierta, setFirmaAbierta] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [clave, setClave] = useState('');
  const archivoRef = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/facturacion');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'No se pudo cargar tu facturación.');
      setEmisor(j.data);
      setErr(null);
    } catch (e: any) { setErr(e.message); setEmisor(null); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const esGcc = !!emisor?.esGcc;
  const soloLectura = esGcc || !!suplantacion;
  const porque = esGcc ? 'La cuenta de GCC no se cambia desde aquí' : suplantacion ? 'La cuenta de emisor solo la cambia su dueño' : undefined;
  const bloqueado = !!emisor && emisor.estado !== 'borrador';

  const abrir = () => setBorrador({
    ruc: emisor?.ruc ?? '', razonSocial: emisor?.razonSocial ?? '', nombreComercial: emisor?.nombreComercial ?? '',
    dirMatriz: emisor?.dirMatriz ?? '', dirEstablecimiento: emisor?.dirEstablecimiento ?? '',
    estab: emisor?.estab ?? '001', ptoEmi: emisor?.ptoEmi ?? '001', obligadoContabilidad: emisor?.obligadoContabilidad ?? false,
    regimen: emisor?.regimen ?? 'rimpe_emprendedor', cobraIva: emisor?.cobraIva ?? false,
    tarifaIva: emisor && emisor.tarifaIva !== '0' ? emisor.tarifaIva : '4',
  });

  const guardar = async () => {
    if (!borrador) return;
    setGuardando(true);
    try {
      const r = await fetch('/api/facturacion', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(borrador),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(j.error || 'No se pudieron guardar tus datos.'); return; }
      setEmisor(j.data);
      setBorrador(null);
      toast.success('Datos guardados');
    } finally { setGuardando(false); }
  };

  const subirFirma = async () => {
    if (!archivo || !clave) return;
    setGuardando(true);
    try {
      const fd = new FormData();
      fd.append('archivo', archivo);
      fd.append('clave', clave);
      const r = await fetch('/api/facturacion/firma', { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(j.error || 'No se pudo guardar la firma.'); return; }
      setEmisor(j.data);
      cerrarFirma();
      toast.success('Firma guardada');
    } finally { setGuardando(false); }
  };
  const cerrarFirma = () => { setFirmaAbierta(false); setArchivo(null); setClave(''); };

  const b = borrador;
  const puedeGuardar = !!b && /^\d{10}001$/.test(b.ruc) && b.razonSocial.trim().length >= 3 && b.dirMatriz.trim().length >= 5
    && /^\d{3}$/.test(b.estab) && /^\d{3}$/.test(b.ptoEmi);
  const firma = emisor?.firma ?? null;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 max-lg:p-0 flex flex-col gap-3">
      {err && (
        <div className="px-3 py-2 rounded-md border border-red-400/40 bg-red-500/10 text-[12px] text-red-600 flex items-center gap-2" style={mf}>
          <XCircle className="w-4 h-4 shrink-0" /> {err}
        </div>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-2 max-md:[&>*:last-child:nth-child(odd)]:col-span-2">
        <Cifra Icon={BadgeCheck} label="Estado" value={emisor === undefined ? undefined : emisor ? ESTADO_EMISOR[emisor.estado].texto : 'Sin registrar'} />
        <Cifra Icon={Receipt} label="RUC" value={emisor === undefined ? undefined : emisor?.ruc ?? '—'} />
        <Cifra Icon={KeyRound} label="Firma vence" tone={firma && vencePronto(firma.vence) ? 'red' : undefined}
          value={emisor === undefined ? undefined : firma ? fechaCorta(firma.vence) : 'Sin firma'} />
      </div>

      <section className="bg-digi-card border border-digi-border rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-[13.5px] font-semibold text-digi-text mb-2" style={df}>Datos del emisor</h3>
          {emisor ? (
            <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 text-[12.5px]" style={mf}>
              <Dato t="RUC" v={emisor.ruc} />
              <Dato t="Razón social" v={emisor.razonSocial} />
              <Dato t="Nombre comercial" v={emisor.nombreComercial || '—'} />
              <Dato t="Establecimiento" v={`${emisor.estab}-${emisor.ptoEmi}`} />
              <Dato t="Dirección matriz" v={emisor.dirMatriz} />
              <Dato t="Dirección del establecimiento" v={emisor.dirEstablecimiento} />
              <Dato t="Régimen" v={REGIMEN_TEXTO[emisor.regimen]} />
              <Dato t="IVA" v={emisor.cobraIva ? TARIFA_IVA[emisor.tarifaIva] : 'No cobra'} />
              <Dato t="Contabilidad" v={emisor.obligadoContabilidad ? 'Obligado' : 'No obligado'} />
              <div className="min-w-0">
                <dt className="text-[10.5px] uppercase tracking-wide text-digi-muted">Estado</dt>
                <dd><EstadoEmisorTexto estado={emisor.estado} /></dd>
              </div>
              {emisor.leyenda && <div className="col-span-2"><Dato t="Leyenda" v={emisor.leyenda} /></div>}
            </dl>
          ) : (
            <p className="text-[12.5px] text-digi-muted" style={mf}>{emisor === undefined ? 'Cargando…' : 'Aún no registras tu RUC.'}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 sm:self-end">
          {emisor && !esGcc && <span className="text-[11.5px] text-digi-muted" style={mf}>Actualizada el {fechaCorta(emisor.actualizado)}</span>}
          <button type="button" onClick={abrir} disabled={emisor === undefined || soloLectura} className={BTN_SECONDARY} title={porque}>
            {emisor ? <><Pencil className="w-4 h-4" /> Editar datos</> : <><Plus className="w-4 h-4" /> Registrar RUC</>}
          </button>
        </div>
      </section>

      <section className="bg-digi-card border border-digi-border rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-[13.5px] font-semibold text-digi-text mb-2" style={df}>Firma electrónica</h3>
          {firma ? (
            <dl className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 text-[12.5px]" style={mf}>
              <Dato t="Titular" v={firma.titular} />
              <Dato t="Vence" v={fechaCorta(firma.vence)} />
              <Dato t="Corresponde al RUC" v={firma.coincide === true ? 'Sí' : firma.coincide === false ? 'No' : 'Sin comprobar'} />
              {firma.actualizada && <Dato t="Subida" v={fechaCorta(firma.actualizada)} />}
            </dl>
          ) : (
            <p className="text-[12.5px] text-digi-muted" style={mf}>{emisor === undefined ? 'Cargando…' : 'Aún no subes tu firma electrónica (.p12).'}</p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 sm:self-end">
          <button type="button" onClick={() => setFirmaAbierta(true)} disabled={!emisor || soloLectura} className={BTN_SECONDARY}
            title={porque ?? (!emisor ? 'Primero registra tu RUC' : undefined)}>
            <Upload className="w-4 h-4" /> {firma ? 'Cambiar firma' : 'Subir firma'}
          </button>
        </div>
      </section>

      <EditPanel open={!!borrador} title={emisor ? 'Editar datos del emisor' : 'Registrar RUC'}
        onClose={() => setBorrador(null)} onSave={guardar} saving={guardando} canSave={puedeGuardar} saveLabel="Guardar datos">
        {b && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <EditField label="RUC">
              <input className={EDIT_INPUT} value={b.ruc} inputMode="numeric" maxLength={13} disabled={bloqueado}
                title={bloqueado ? 'Con la cuenta habilitada, el RUC solo lo cambia el administrador' : undefined}
                onChange={(e) => setBorrador({ ...b, ruc: e.target.value.replace(/\D/g, '') })} />
            </EditField>
            <EditField label="Razón social">
              <input className={EDIT_INPUT} value={b.razonSocial} maxLength={300}
                onChange={(e) => setBorrador({ ...b, razonSocial: e.target.value })} />
            </EditField>
            <EditField label="Nombre comercial">
              <input className={EDIT_INPUT} value={b.nombreComercial} maxLength={300}
                onChange={(e) => setBorrador({ ...b, nombreComercial: e.target.value })} />
            </EditField>
            <div className="grid grid-cols-2 gap-3">
              <EditField label="Establecimiento">
                <input className={EDIT_INPUT} value={b.estab} inputMode="numeric" maxLength={3} disabled={bloqueado}
                  onChange={(e) => setBorrador({ ...b, estab: e.target.value.replace(/\D/g, '') })} />
              </EditField>
              <EditField label="Punto de emisión">
                <input className={EDIT_INPUT} value={b.ptoEmi} inputMode="numeric" maxLength={3} disabled={bloqueado}
                  onChange={(e) => setBorrador({ ...b, ptoEmi: e.target.value.replace(/\D/g, '') })} />
              </EditField>
            </div>
            <EditField label="Dirección matriz">
              <input className={EDIT_INPUT} value={b.dirMatriz} maxLength={300}
                onChange={(e) => setBorrador({ ...b, dirMatriz: e.target.value })} />
            </EditField>
            <EditField label="Dirección del establecimiento">
              <input className={EDIT_INPUT} value={b.dirEstablecimiento} maxLength={300} placeholder={b.dirMatriz}
                onChange={(e) => setBorrador({ ...b, dirEstablecimiento: e.target.value })} />
            </EditField>
            <EditField label="Régimen">
              <Segmentado etiqueta="Régimen" className="w-full" valor={b.regimen}
                onChange={(regimen) => setBorrador({ ...b, regimen, cobraIva: regimen === 'rimpe_negocio_popular' ? false : b.cobraIva })}
                opciones={(['rimpe_negocio_popular', 'rimpe_emprendedor', 'general'] as Regimen[]).map((r) => ({ valor: r, texto: REGIMEN_TEXTO[r] }))} />
            </EditField>
            <EditField label="Leyenda">
              <input className={EDIT_INPUT} value={LEYENDA_REGIMEN[b.regimen] || '—'} disabled readOnly />
            </EditField>
            <EditField label="Obligado a llevar contabilidad">
              <div className="h-10 flex items-center">
                <Interruptor activo={b.obligadoContabilidad} etiqueta="Obligado a llevar contabilidad"
                  onChange={(v) => setBorrador({ ...b, obligadoContabilidad: v })} />
              </div>
            </EditField>
            <EditField label="Cobra IVA">
              <div className="flex items-center gap-3 min-h-10">
                <Interruptor activo={b.cobraIva} etiqueta="Cobra IVA" disabled={b.regimen === 'rimpe_negocio_popular'}
                  onChange={(v) => setBorrador({ ...b, cobraIva: v })} />
                {b.cobraIva && (
                  <Segmentado etiqueta="Tarifa de IVA" className="flex-1 max-w-[220px]" valor={b.tarifaIva}
                    onChange={(tarifaIva) => setBorrador({ ...b, tarifaIva })}
                    opciones={[{ valor: '4', texto: '15 %' }, { valor: '5', texto: '5 %' }]} />
                )}
              </div>
            </EditField>
          </div>
        )}
      </EditPanel>

      <QuickEditDialog open={firmaAbierta} title={firma ? 'Cambiar firma electrónica' : 'Subir firma electrónica'}
        onClose={cerrarFirma} onSave={subirFirma} saving={guardando} canSave={!!archivo && clave.length > 0} saveLabel="Guardar firma">
        <EditField label="Archivo .p12">
          <input ref={archivoRef} type="file" accept=".p12,.pfx,application/x-pkcs12" className="hidden"
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)} />
          <button type="button" onClick={() => archivoRef.current?.click()} className={`${BTN_SECONDARY} w-full !justify-start`}>
            <Paperclip className="w-4 h-4 shrink-0" />
            <span className="truncate">{archivo ? archivo.name : 'Elegir archivo'}</span>
          </button>
        </EditField>
        <EditField label="Contraseña de la firma">
          <input className={EDIT_INPUT} type="password" value={clave} autoComplete="off" maxLength={200}
            onChange={(e) => setClave(e.target.value)} />
        </EditField>
      </QuickEditDialog>
    </div>
  );
}

/** A 30 días o menos de vencer. */
function vencePronto(vence: string): boolean {
  return Date.parse(`${vence}T12:00:00Z`) - Date.now() <= 30 * 86_400_000;
}
