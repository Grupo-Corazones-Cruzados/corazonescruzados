'use client';

import BotonQuitar from '@/components/ui/BotonQuitar';
import { fmt2 } from '@/lib/format';
import { Plus } from 'lucide-react';

const mf = { fontFamily: 'var(--font-body)' } as const;

export type ItemFactura = { description: string; quantity: string; unitPrice: string; ivaRate: string; discount: string };

/** Base imponible de una línea: cantidad × precio − descuento. */
const base = (it: ItemFactura) => (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0) - (Number(it.discount) || 0);

/** Total de la factura, IVA incluido — la misma cuenta que los totales de la tabla. */
export function totalFactura(items: ItemFactura[]): number {
  return items.reduce((s, it) => s + base(it) + base(it) * ((Number(it.ivaRate) || 0) / 100), 0);
}

const CELDA = 'w-full h-8 px-2 bg-transparent border border-transparent rounded text-[12.5px] text-digi-text hover:border-digi-border focus:outline-none tabular-nums';

/**
 * EL DETALLE DE LA FACTURA EN TABLA — una línea por ítem (Fernando, 2026-09-29).
 *
 * Antes cada ítem era una tarjeta de dos alturas (la descripción arriba y cuatro campos con
 * su etiqueta debajo), y con cinco requerimientos el detalle no cabía. Ahora las etiquetas
 * van UNA vez en la cabecera, y cada celda es un campo sin marco que se lo pone al pasar el
 * ratón o al enfocarlo: se lee como una tabla y se edita en su sitio.
 */
export default function DetalleFactura({ items, onChange }: { items: ItemFactura[]; onChange: (items: ItemFactura[]) => void }) {
  const cambiar = (i: number, campo: keyof ItemFactura, valor: string) => {
    const n = [...items]; n[i] = { ...n[i], [campo]: valor }; onChange(n);
  };

  const porTarifa: Record<string, number> = {};
  items.forEach((it) => { const t = it.ivaRate || '0'; porTarifa[t] = (porTarifa[t] || 0) + base(it); });
  const descuento = items.reduce((s, it) => s + (Number(it.discount) || 0), 0);
  const iva = items.reduce((s, it) => s + base(it) * ((Number(it.ivaRate) || 0) / 100), 0);

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-digi-border">
        <table className="w-full text-[12.5px]" style={{ ...mf, tableLayout: 'fixed', minWidth: 560 }}>
          <colgroup>
            <col /><col style={{ width: 64 }} /><col style={{ width: 92 }} /><col style={{ width: 72 }} />
            <col style={{ width: 76 }} /><col style={{ width: 92 }} /><col style={{ width: 40 }} />
          </colgroup>
          <thead>
            <tr className="bg-black/[0.03] text-[10.5px] uppercase tracking-wide text-digi-muted">
              <th className="text-left font-semibold px-3 py-1.5">Descripción</th>
              <th className="text-right font-semibold px-2 py-1.5">Cant.</th>
              <th className="text-right font-semibold px-2 py-1.5">P. unit.</th>
              <th className="text-left font-semibold px-2 py-1.5">IVA</th>
              <th className="text-right font-semibold px-2 py-1.5">Desc.</th>
              <th className="text-right font-semibold px-3 py-1.5">Subtotal</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-digi-border/60">
            {items.map((it, i) => (
              <tr key={i}>
                <td className="px-1 py-0.5">
                  <input value={it.description} onChange={(e) => cambiar(i, 'description', e.target.value)} title={it.description}
                    placeholder="Descripción" className={`${CELDA} truncate`} style={mf} />
                </td>
                <td className="px-1 py-0.5">
                  <input value={it.quantity} onChange={(e) => cambiar(i, 'quantity', e.target.value)} type="number" min="0.01" step="0.01"
                    className={`${CELDA} text-right`} style={mf} aria-label="Cantidad" />
                </td>
                <td className="px-1 py-0.5">
                  <input value={it.unitPrice} onChange={(e) => cambiar(i, 'unitPrice', e.target.value)} type="number" min="0" step="0.01"
                    className={`${CELDA} text-right`} style={mf} aria-label="Precio unitario" />
                </td>
                <td className="px-1 py-0.5">
                  <select value={it.ivaRate} onChange={(e) => cambiar(i, 'ivaRate', e.target.value)} className={`${CELDA} select-compacto`} style={mf} aria-label="IVA">
                    <option value="0">0%</option><option value="5">5%</option><option value="15">15%</option>
                  </select>
                </td>
                <td className="px-1 py-0.5">
                  <input value={it.discount} onChange={(e) => cambiar(i, 'discount', e.target.value)} type="number" min="0" step="0.01"
                    className={`${CELDA} text-right`} style={mf} aria-label="Descuento" />
                </td>
                <td className="px-3 py-0.5 text-right tabular-nums text-digi-text">${fmt2(base(it))}</td>
                <td className="py-0.5 text-center">
                  <BotonQuitar onClick={() => onChange(items.filter((_, j) => j !== i))} etiqueta="Quitar ítem" tamano="xs" />
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-3 text-center text-[12px] text-digi-muted">Sin ítems. Agrega al menos uno para facturar.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <button type="button" onClick={() => onChange([...items, { description: '', quantity: '1', unitPrice: '0', ivaRate: '0', discount: '0' }])}
          className="inline-flex items-center gap-1 text-[12px] text-accent border border-accent/40 rounded px-2.5 py-1 hover:bg-accent-light transition-colors" style={mf}>
          <Plus className="w-3.5 h-3.5" /> Ítem
        </button>
        <dl className="min-w-[220px] text-[12px] space-y-0.5" style={mf}>
          {Object.entries(porTarifa).map(([t, b]) => (
            <div key={t} className="flex justify-between gap-6"><dt className="text-digi-muted">Subtotal {t}%</dt><dd className="tabular-nums text-digi-text">${fmt2(b)}</dd></div>
          ))}
          {descuento > 0 && <div className="flex justify-between gap-6"><dt className="text-digi-muted">Descuento</dt><dd className="tabular-nums text-digi-text">${fmt2(descuento)}</dd></div>}
          {iva > 0 && <div className="flex justify-between gap-6"><dt className="text-digi-muted">IVA</dt><dd className="tabular-nums text-digi-text">${fmt2(iva)}</dd></div>}
          <div className="flex justify-between gap-6 border-t border-digi-border pt-1 font-semibold text-accent">
            <dt>Total</dt><dd className="tabular-nums">${fmt2(totalFactura(items))}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
