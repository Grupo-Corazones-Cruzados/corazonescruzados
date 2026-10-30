'use client';

import { useState } from 'react';
import { ChevronRight, Lock, Plus, TrendingDown, TrendingUp } from 'lucide-react';
import { fmt2 } from '@/lib/format';
import Segmentado from '@/components/ui/Segmentado';
import { QuickEditDialog, EditField, EDIT_INPUT } from '@/components/ui/EditDialog';

/**
 * ⭐ EL ESTADO FINANCIERO, CONTADO PARA UN TELÉFONO (Fernando, 2026-10-30: «no es una buena
 * interfaz para visualizar los ingresos y egresos desde la vista de móvil… crea una versión
 * específica para móvil»).
 *
 * Antes era la tabla del escritorio puesta en tarjetas: cada mes, una caja con tres cajitas
 * dentro (~140 px), y 22 meses eran 3.000 px de desplazamiento. El detalle del mes eran dos
 * campos por renglón —descripción cortada encima, importe debajo— y no se leía nada.
 *
 * Aquí, tres piezas:
 *  - `BalanceMovil`: lo que se viene a mirar, el AHORRO, grande; debajo lo que entró y lo que
 *    salió, y una línea fina que dice qué parte de lo que entró se fue en egresos.
 *  - `MesesMovil`: los meses agrupados por año, cada uno UNA fila (~56 px): el mes con «+ingreso
 *    · −egreso» debajo y el ahorro a la derecha. El año lleva su ahorro en la cabecera.
 *  - `DetalleMes`: el mes como un LISTADO que se lee (concepto a la izquierda, importe a la
 *    derecha), ingresos o egresos de uno en uno, y cada renglón se edita en su ventanita (dos
 *    campos: regla de `EditDialog`), nunca encima.
 * Desde `lg`, el escritorio sigue con su tabla y sus bloques de siempre.
 */

const mf = { fontFamily: 'var(--font-body)' } as const;
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const dinero = (n: number) => `${n < 0 ? '−' : ''}$${fmt2(Math.abs(n))}`;
const colorAhorro = (n: number) => (n >= 0 ? 'text-accent' : 'text-red-400');
/** El importe se escribe como se lee aquí, con coma decimal («300,50»); se guarda con punto. */
const aPantalla = (v: string) => (v ? String(v).replace('.', ',') : '');
const aGuardar = (v: string) => {
  const t = v.replace(/\s/g, '');
  return t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
};

/** Qué parte de lo que entró se fue en egresos, 0–100 (más de 100 = pérdida). */
function parteGastada(ingresos: number, egresos: number) {
  if (ingresos <= 0) return egresos > 0 ? 100 : 0;
  return Math.round((egresos / ingresos) * 100);
}

function LineaGasto({ ingresos, egresos }: { ingresos: number; egresos: number }) {
  const p = parteGastada(ingresos, egresos);
  return (
    <div className="h-1 rounded-full bg-green-400/45 overflow-hidden" role="img"
      aria-label={`Los egresos son el ${p} % de los ingresos`}>
      <div className="h-full rounded-full bg-red-400" style={{ width: `${Math.min(p, 100)}%` }} />
    </div>
  );
}

export function BalanceMovil({ etiquetaAhorro, etiquetaIngresos, ingresos, egresos }: {
  etiquetaAhorro: string;
  etiquetaIngresos: string;
  ingresos: number;
  egresos: number;
}) {
  const ahorro = ingresos - egresos;
  const p = parteGastada(ingresos, egresos);
  return (
    <section className="bg-digi-card border border-digi-border rounded-xl shadow-sm p-4 mb-5" style={mf}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-digi-muted">{etiquetaAhorro}</p>
      <p className={`mt-0.5 text-[30px] leading-tight font-bold tabular-nums ${colorAhorro(ahorro)}`}>{dinero(ahorro)}</p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1 text-[11.5px] text-digi-muted"><TrendingUp className="w-3.5 h-3.5 text-green-400" />{etiquetaIngresos}</p>
          <p className="text-[16px] font-semibold tabular-nums text-green-400 truncate">{dinero(ingresos)}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="inline-flex items-center gap-1 text-[11.5px] text-digi-muted"><TrendingDown className="w-3.5 h-3.5 text-red-400" />Egresos</p>
          <p className="text-[16px] font-semibold tabular-nums text-red-400 truncate">{dinero(egresos)}</p>
        </div>
      </div>
      <div className="mt-3"><LineaGasto ingresos={ingresos} egresos={egresos} /></div>
      <p className="mt-1.5 text-[11.5px] text-digi-muted tabular-nums">
        {ingresos > 0 ? `Los egresos son el ${p} % de los ingresos` : 'Sin ingresos en el periodo'}
      </p>
    </section>
  );
}

export interface MesMovil { id: number; year: number; month: number }

export function MesesMovil<M extends MesMovil>({ meses, ingresoDe, egresoDe, onAbrir, vacio }: {
  meses: M[];
  ingresoDe: (m: M) => number;
  egresoDe: (m: M) => number;
  onAbrir: (m: M) => void;
  vacio: string;
}) {
  if (meses.length === 0) {
    return <p className="py-10 text-center text-[13px] text-digi-muted" style={mf}>{vacio}</p>;
  }
  const anios: { anio: number; filas: M[] }[] = [];
  for (const m of meses) {
    const g = anios.find((a) => a.anio === m.year) ?? (anios.push({ anio: m.year, filas: [] }), anios[anios.length - 1]);
    g.filas.push(m);
  }
  return (
    <div className="space-y-5" style={mf}>
      {anios.map(({ anio, filas }) => {
        const ahorroAnio = filas.reduce((s, m) => s + ingresoDe(m) - egresoDe(m), 0);
        return (
          <section key={anio}>
            <div className="flex items-baseline justify-between px-1 mb-1.5">
              <h3 className="text-[13px] font-semibold text-digi-text tabular-nums">{anio}</h3>
              <span className="text-[11.5px] text-digi-muted tabular-nums">
                Ahorro <span className={`font-semibold ${colorAhorro(ahorroAnio)}`}>{dinero(ahorroAnio)}</span>
              </span>
            </div>
            <div className="bg-digi-card border border-digi-border rounded-xl shadow-sm overflow-hidden divide-y divide-digi-border">
              {filas.map((m) => {
                const ing = ingresoDe(m), egr = egresoDe(m), ah = ing - egr;
                return (
                  <button key={m.id} type="button" onClick={() => onAbrir(m)}
                    className="w-full min-h-[58px] flex items-center gap-3 px-3.5 py-2.5 text-left active:bg-accent-light/40 transition-colors">
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14.5px] font-medium text-digi-text">{MESES[m.month - 1]}</span>
                      <span className="block text-[12px] tabular-nums truncate">
                        <span className="text-green-400">+{fmt2(ing)}</span>
                        <span className="text-digi-muted"> · </span>
                        <span className="text-red-400">−{fmt2(egr)}</span>
                      </span>
                    </span>
                    <span className={`text-[15px] font-semibold tabular-nums shrink-0 ${colorAhorro(ah)}`}>{dinero(ah)}</span>
                    <ChevronRight className="w-[18px] h-[18px] text-digi-muted shrink-0" />
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export interface RenglonMovil {
  type: 'income' | 'expense';
  description: string;
  amount: string;
  facturado?: boolean;
  bloqueado?: boolean;
  adicional?: boolean;
}

type Lado = 'income' | 'expense' | 'adicional';

/**
 * El cuerpo del mes, en el teléfono Y en el escritorio (desde el 2026-10-30, ver la página). Trabaja sobre las MISMAS listas que el escritorio, así el
 * «Guardar» del pie no cambia.
 *
 * Desde el 2026-10-30 (Fernando) ingresos y egresos son lo del SRI y se leen, no se tocan; lo que
 * se escribe a mano son los ADICIONALES —ingresos y egresos no facturados, de nombre una palabra—,
 * en su propia pestaña. `adicionales = null` la esconde («Solo facturado»).
 */
export function DetalleMes<R extends RenglonMovil>({
  ingresos, egresos, adicionales, setAdicionales, editable, oculto, etiquetaIngresos,
  totalIngresos, totalEgresos, ahorroAnterior, ahorroGlobal,
}: {
  ingresos: R[];
  egresos: R[];
  adicionales: R[] | null;
  setAdicionales: React.Dispatch<React.SetStateAction<R[]>>;
  editable: boolean;
  oculto: (r: R) => boolean;
  etiquetaIngresos: string;
  totalIngresos: number;
  totalEgresos: number;
  ahorroAnterior: number;
  ahorroGlobal: number;
}) {
  const [elegido, setLado] = useState<Lado>('income');
  const lado: Lado = elegido === 'adicional' && !adicionales ? 'income' : elegido;
  // Adicional en edición: su índice (o -1 si es nuevo) y sus tres campos.
  const [editando, setEditando] = useState<{ i: number; type: 'income' | 'expense'; description: string; amount: string } | null>(null);

  const lista: R[] = lado === 'income' ? ingresos : lado === 'expense' ? egresos : (adicionales ?? []);
  // En Adicionales, primero los ingresos y luego los egresos (el índice sigue siendo el de la lista).
  const visibles = lista
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => !oculto(r) && (r.description.trim() || Number(r.amount)))
    .sort((a, b) => (lado === 'adicional' ? Number(a.r.type === 'expense') - Number(b.r.type === 'expense') : 0));
  const ocultos = lado === 'income' ? ingresos.filter(oculto).length : 0;
  const ahorro = totalIngresos - totalEgresos;
  const utiles = (l: R[]) => l.filter((r) => !oculto(r) && (r.description.trim() || Number(r.amount)));
  const suma = (l: R[]) => utiles(l).reduce((s, r) => s + (r.type === 'expense' && l === adicionales ? -1 : 1) * (Number(r.amount) || 0), 0);
  // Bajo el nombre de cada pestaña, cuántos renglones y cuánto suman (los adicionales, lo neto con signo).
  const detalle = (l: R[], conSigno = false) => {
    const n = suma(l);
    return `${utiles(l).length} · ${conSigno && n > 0 ? '+' : ''}${dinero(n)}`;
  };
  const tocable = editable && lado === 'adicional';

  const guardarRenglon = () => {
    if (!editando) return;
    const { i, type, description } = editando;
    const amount = aGuardar(editando.amount);
    setAdicionales((prev) => (i < 0
      ? [...prev, { type, description, amount, adicional: true } as R]
      : prev.map((r, k) => (k === i ? { ...r, type, description, amount } : r))));
    setEditando(null);
  };
  const quitarRenglon = () => {
    if (!editando || editando.i < 0) return;
    const i = editando.i;
    setAdicionales((prev) => prev.filter((_, k) => k !== i));
    setEditando(null);
  };

  return (
    <div className="space-y-4" style={mf}>
      {/* El resultado del mes primero: es lo que se viene a ver. */}
      {/* En el escritorio, el ahorro a la izquierda y sus cifras a la derecha: una franja, no una torre. */}
      <section className="rounded-xl border border-digi-border p-4 lg:grid lg:grid-cols-2 lg:gap-8 lg:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-digi-muted">Ahorro del mes</p>
          <p className={`mt-0.5 text-[28px] leading-tight font-bold tabular-nums ${colorAhorro(ahorro)}`}>{dinero(ahorro)}</p>
          <div className="mt-3"><LineaGasto ingresos={totalIngresos} egresos={totalEgresos} /></div>
        </div>
        <dl className="mt-3 lg:mt-0 space-y-1.5 text-[12.5px]">
          <div className="flex justify-between gap-3"><dt className="text-digi-muted">{etiquetaIngresos}</dt><dd className="tabular-nums font-medium text-green-400">{dinero(totalIngresos)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-digi-muted">Egresos</dt><dd className="tabular-nums font-medium text-red-400">{dinero(totalEgresos)}</dd></div>
          <div className="flex justify-between gap-3 pt-1.5 border-t border-digi-border"><dt className="text-digi-muted">A la fecha (mes anterior)</dt><dd className={`tabular-nums font-medium ${ahorroAnterior >= 0 ? 'text-digi-text' : 'text-red-400'}`}>{dinero(ahorroAnterior)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-digi-muted">Ahorro global</dt><dd className={`tabular-nums font-semibold ${colorAhorro(ahorroGlobal)}`}>{dinero(ahorroGlobal)}</dd></div>
        </dl>
      </section>

      <Segmentado
        etiqueta="Ver"
        className="w-full lg:max-w-xl"
        valor={lado}
        onChange={setLado}
        // La cuenta, en la segunda línea: con tres opciones, «Adicionales · 1» no cabe en una.
        opciones={[
          { valor: 'income', texto: etiquetaIngresos, detalle: detalle(ingresos) },
          { valor: 'expense', texto: 'Egresos', detalle: detalle(egresos) },
          ...(adicionales ? [{ valor: 'adicional' as const, texto: 'Adicionales', detalle: detalle(adicionales, true) }] : []),
        ]}
      />

      <section className="rounded-xl border border-digi-border overflow-hidden">
        {ocultos > 0 && (
          <p className="px-3.5 py-2 text-[11.5px] text-digi-muted border-b border-digi-border">
            {ocultos} {ocultos === 1 ? 'ingreso sin factura oculto' : 'ingresos sin factura ocultos'}.
          </p>
        )}
        {visibles.length === 0 ? (
          <p className="px-3.5 py-6 text-center text-[13px] text-digi-muted">
            {lado === 'income' ? 'Sin ingresos registrados.' : lado === 'expense' ? 'Sin egresos registrados.' : 'Sin adicionales.'}
          </p>
        ) : (
          <ul className="divide-y divide-digi-border">
            {visibles.map(({ r, i }) => {
              const entra = r.type === 'income';
              const contenido = (
                <>
                  <span className="flex-1 min-w-0 text-[13px] leading-snug text-digi-text line-clamp-2 break-words">
                    {r.description || <span className="text-digi-muted">Sin descripción</span>}
                  </span>
                  <span className={`shrink-0 text-[13.5px] font-semibold tabular-nums ${entra ? 'text-green-400' : 'text-red-400'}`}>
                    {lado === 'adicional' ? (entra ? '+' : '−') : ''}{dinero(Number(r.amount) || 0)}
                  </span>
                  {lado !== 'adicional'
                    ? <Lock className="w-3.5 h-3.5 text-digi-muted shrink-0" aria-label="Registrado en el SRI" />
                    : tocable && <ChevronRight className="w-4 h-4 text-digi-muted shrink-0" />}
                </>
              );
              return (
                <li key={i}>
                  {tocable ? (
                    <button type="button" onClick={() => setEditando({ i, type: r.type, description: r.description, amount: aPantalla(r.amount) })}
                      className="w-full min-h-[52px] lg:min-h-[40px] flex items-center gap-3 px-3.5 py-2.5 lg:py-1.5 text-left hover:bg-black/[0.03] active:bg-accent-light/40 transition-colors">
                      {contenido}
                    </button>
                  ) : (
                    <div className="min-h-[52px] lg:min-h-[40px] flex items-center gap-3 px-3.5 py-2.5 lg:py-1.5">{contenido}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {tocable && (
          <button type="button" onClick={() => setEditando({ i: -1, type: 'income', description: '', amount: '' })}
            className="w-full min-h-[48px] inline-flex items-center justify-center gap-1.5 border-t border-digi-border text-[13px] font-medium text-accent active:bg-accent-light/40">
            <Plus className="w-4 h-4" /> Agregar adicional
          </button>
        )}
      </section>

      <QuickEditDialog
        open={!!editando}
        title={editando?.i === -1 ? 'Nuevo adicional' : 'Editar adicional'}
        onClose={() => setEditando(null)}
        onSave={guardarRenglon}
        saveLabel="Listo"
        canSave={!!editando && !!editando.description.trim() && Number(aGuardar(editando.amount)) > 0}
        danger={editando && editando.i >= 0 ? { label: 'Quitar', onClick: quitarRenglon } : undefined}
      >
        <Segmentado
          etiqueta="Tipo"
          className="w-full"
          valor={editando?.type ?? 'income'}
          onChange={(type) => setEditando((d) => (d ? { ...d, type } : d))}
          opciones={[{ valor: 'income', texto: 'Ingreso' }, { valor: 'expense', texto: 'Egreso' }]}
        />
        <EditField label="Nombre">
          {/* Una sola palabra: los espacios no llegan a escribirse. */}
          <input value={editando?.description ?? ''} autoFocus className={EDIT_INPUT} style={mf}
            onChange={(e) => { const v = e.target.value.replace(/\s+/g, ''); setEditando((d) => (d ? { ...d, description: v } : d)); }} />
        </EditField>
        <EditField label="Importe">
          <input value={editando?.amount ?? ''} type="text" inputMode="decimal" placeholder="0,00"
            className={`${EDIT_INPUT} tabular-nums`} style={mf}
            onChange={(e) => { const v = e.target.value.replace(/[^\d.,]/g, ''); setEditando((d) => (d ? { ...d, amount: v } : d)); }} />
        </EditField>
      </QuickEditDialog>
    </div>
  );
}
