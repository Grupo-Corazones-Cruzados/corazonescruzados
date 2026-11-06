'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Check, FileSearch, Loader2 } from 'lucide-react';
import PixelModal from '@/components/ui/PixelModal';
import { EditField, EDIT_INPUT } from '@/components/ui/EditDialog';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/components/ui/Button';
import { fmt2 } from '@/lib/format';

type Diferencia = { numero: string; sri?: number; plataforma?: number; cliente?: string | null; estado?: string | null };
type Resultado = { coinciden: number; anuladas: number; faltan: Diferencia[]; importes: Diferencia[]; estados: Diferencia[]; soloPlataforma: Diferencia[]; diasFallidos: string[]; dias: number };
type Trabajo = { id: number; estado: 'pendiente' | 'en_curso' | 'hecho' | 'error' | 'captcha'; meses: { year: number; month: number; dias: string[] }[] | null; resultado: Resultado | null; mensaje: string | null; terminado_en: string | null };
type Estado = { claveConfigurada: boolean; trabajadorVistoEn: string | null; ultimo: Trabajo | null };

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const enMarcha = (t?: Trabajo | null) => t?.estado === 'pendiente' || t?.estado === 'en_curso';
const m1Atento = (visto: string | null) => !!visto && Date.now() - new Date(visto).getTime() < 2 * 60_000;
const SEGUNDOS_POR_DIA = 7;

function Grupo({ titulo, filas, detalle }: { titulo: string; filas: Diferencia[]; detalle: (f: Diferencia) => string }) {
  if (!filas.length) return null;
  return (
    <section>
      <h4 className="text-[12.5px] font-semibold text-amber-600 mb-1.5">{titulo} ({filas.length})</h4>
      <div className="border border-digi-border rounded-lg divide-y divide-digi-border">
        {filas.map((f) => (
          <div key={f.numero} className="flex items-center justify-between gap-3 px-3 py-2 text-[12.5px]">
            <span className="min-w-0">
              <span className="block text-digi-text tabular-nums">{f.numero}</span>
              {f.cliente && <span className="block truncate text-[11.5px] text-digi-muted">{f.cliente}</span>}
            </span>
            <span className="shrink-0 text-right tabular-nums text-digi-text">{detalle(f)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * «FACTURAS EMITIDAS» (Fernando, 2026-11-05). Coteja un mes contra el portal del SRI con el M1 (ver
 * `lib/finance-sri-emitidas.ts`) y enseña las diferencias. Solo informa: nada de lo que muestra se aplica.
 */
export default function BotonEmitidasSri({ className = '' }: { className?: string }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const opciones = useMemo(() => {
    const hoy = new Date();
    return Array.from({ length: 24 }, (_, i) => {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      return { valor: `${d.getFullYear()}-${d.getMonth() + 1}`, texto: `${MESES[d.getMonth()]} ${d.getFullYear()}`, year: d.getFullYear(), month: d.getMonth() + 1 };
    });
  }, []);
  const [mes, setMes] = useState(opciones[0].valor);
  const anterior = useRef<Trabajo | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch('/api/finance/sri/emitidas');
      if (r.ok) setEstado((await r.json()).data);
    } catch { /* se reintenta en la siguiente vuelta */ }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (!enMarcha(estado?.ultimo)) return;
    const t = window.setInterval(cargar, 5000);
    return () => window.clearInterval(t);
  }, [estado?.ultimo, cargar]);

  useEffect(() => {
    const u = estado?.ultimo ?? null;
    const a = anterior.current;
    anterior.current = u;
    if (!a || !u || a.id !== u.id || !enMarcha(a) || enMarcha(u)) return;
    if (u.estado === 'hecho') toast.success('Cotejo con el SRI terminado');
    else toast.error(u.mensaje || 'No se pudo consultar el SRI.');
  }, [estado?.ultimo]);

  const consultar = async () => {
    const o = opciones.find((x) => x.valor === mes);
    if (!o) return;
    setEnviando(true);
    try {
      const r = await fetch('/api/finance/sri/emitidas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ year: o.year, month: o.month }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo pedir la consulta');
      setEstado(d.data);
      if (!m1Atento(d.data.trabajadorVistoEn)) toast.warning('El M1 no está conectado: consultará en cuanto vuelva.');
    } catch (e: any) { toast.error(e.message); }
    finally { setEnviando(false); }
  };

  if (!estado) return null;
  const u = estado.ultimo;
  const corriendo = enMarcha(u);
  const r = u?.resultado ?? null;
  const delMes = u?.meses?.[0];
  const nombreMes = delMes ? `${MESES[delMes.month - 1]} ${delMes.year}` : '';
  const minutos = delMes ? Math.max(1, Math.ceil((delMes.dias.length * SEGUNDOS_POR_DIA) / 60)) : 1;
  const sinDiferencias = r && !r.faltan.length && !r.importes.length && !r.estados.length && !r.soloPlataforma.length && !r.diasFallidos.length;

  return (
    <>
      <span className={className}>
        <button type="button" onClick={() => setAbierto(true)} className={`${BTN_SECONDARY} inline-flex items-center justify-center gap-1.5`}>
          {corriendo ? <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" /> : <FileSearch className="w-4 h-4" />}
          {corriendo ? 'Cotejando…' : 'Facturas emitidas'}
        </button>
      </span>

      {abierto && typeof document !== 'undefined' && createPortal(
        <PixelModal open={abierto} onClose={() => setAbierto(false)} title="Facturas emitidas en el SRI" size="lg"
          pie={<>
            <button onClick={() => setAbierto(false)} className={BTN_SECONDARY}>Cerrar</button>
            <button onClick={consultar} disabled={corriendo || enviando} className={BTN_PRIMARY}>{corriendo ? 'Cotejando…' : 'Cotejar'}</button>
          </>}>
          <div className="space-y-5">
            <div className="max-w-xs">
              <EditField label="Mes">
                <select value={mes} onChange={(e) => setMes(e.target.value)} disabled={corriendo} className={EDIT_INPUT}>
                  {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}
                </select>
              </EditField>
            </div>

            {corriendo && (
              <p className="flex items-center gap-2 text-[13px] text-digi-text">
                <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none text-accent" />
                {u?.estado === 'en_curso' ? `Consultando ${nombreMes}: unos ${minutos} min.` : m1Atento(estado.trabajadorVistoEn) ? 'Enviando al M1…' : 'Esperando al M1.'}
              </p>
            )}

            {!corriendo && u && (u.estado === 'error' || u.estado === 'captcha') && !r && (
              <p className="text-[13px] text-red-400">{u.estado === 'captcha' ? 'El SRI pidió resolver el captcha. Vuelve a intentarlo en un rato.' : u.mensaje || 'No se pudo consultar el SRI.'}</p>
            )}

            {!corriendo && r && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                  <h3 className="titulo-progreso text-[15px] text-digi-text">{nombreMes}</h3>
                  <span className="text-[12.5px] text-digi-muted tabular-nums">{r.coinciden} coinciden{r.anuladas ? ` · ${r.anuladas} anuladas` : ''}</span>
                </div>
                {sinDiferencias && (
                  <p className="flex items-center gap-2 text-[13px] text-green-500"><Check className="w-4 h-4" /> Todo coincide con el SRI.</p>
                )}
                <Grupo titulo="En el SRI y no en la plataforma" filas={r.faltan} detalle={(f) => `$${fmt2(f.sri || 0)}`} />
                <Grupo titulo="Importe distinto" filas={r.importes} detalle={(f) => `SRI $${fmt2(f.sri || 0)} · aquí $${fmt2(f.plataforma || 0)}`} />
                <Grupo titulo="Estado distinto" filas={r.estados} detalle={(f) => `$${fmt2(f.sri || 0)} · aquí ${f.estado || 'sin estado'}`} />
                <Grupo titulo="En la plataforma y no en el SRI" filas={r.soloPlataforma} detalle={(f) => `$${fmt2(f.plataforma || 0)}`} />
                {r.diasFallidos.length > 0 && (
                  <p className="text-[12.5px] text-red-400">Sin consultar: {r.diasFallidos.join(', ')}. Vuelve a cotejar el mes.</p>
                )}
              </div>
            )}
          </div>
        </PixelModal>, document.querySelector('.corp') ?? document.body)}
    </>
  );
}
