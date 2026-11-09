'use client';

import { Paperclip } from 'lucide-react';
import PixelBadge from '@/components/ui/PixelBadge';
import type { Column } from '@/components/ui/PixelDataTable';
import { money } from '@/lib/format';
import type { Ganancia, Pago, EstadoGanancia } from '@/lib/pagos-miembros';

/**
 * Las piezas que comparten «Mis cobros» (Configuración → Cobros) y Admin → Pagos a miembros: las columnas de
 * las ganancias y de los pagos, el estado en una palabra y el enlace al comprobante. Una sola definición para que
 * el miembro y el administrador lean lo mismo con las mismas palabras.
 */

export const mf = { fontFamily: 'var(--font-body)' } as const;

const ORIGEN: Record<string, string> = { ticket: 'Ticket', project: 'Proyecto', subscription: 'Suscripción' };

export const ESTADO_GANANCIA: Record<EstadoGanancia, { texto: string; v: 'warning' | 'success' | 'error' }> = {
  pendiente: { texto: 'Pendiente', v: 'warning' },
  pagado: { texto: 'Pagado', v: 'success' },
  revertido: { texto: 'Revertido', v: 'error' },
};

/** `AAAA-MM-DD` o ISO → «9 nov 2026». Un día sin hora se lee como día (sin correrlo por la zona). */
export function fechaCorta(s: string | null | undefined): string {
  if (!s) return '—';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00`) : new Date(s);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function origenDe(g: Ganancia): string {
  const tipo = ORIGEN[g.origen] ?? g.origen;
  const titulo = [g.titulo, g.requisito].filter(Boolean).join(' › ');
  return titulo ? `${tipo} · ${titulo}` : `${tipo} #${g.origenId}`;
}

const cifra = (n: number, tono = 'text-digi-text') => (
  <span className={`block text-right text-[12.5px] tabular-nums ${tono}`} style={mf}>{money(n)}</span>
);

export function columnasGanancias(): Column<Ganancia>[] {
  return [
    { key: 'fecha', header: 'Fecha', width: '110px', render: (g) => <span className="text-[12px] text-digi-muted" style={mf}>{fechaCorta(g.fecha)}</span> },
    { key: 'origen', header: 'Origen', render: (g) => <span className="block truncate text-[13px] text-digi-text" style={mf} title={origenDe(g)}>{origenDe(g)}</span> },
    { key: 'bruto', header: 'Bruto', width: '100px', hideOnMobile: true, render: (g) => cifra(g.bruto, 'text-digi-muted') },
    { key: 'comision', header: 'Comisión', width: '100px', hideOnMobile: true, render: (g) => cifra(g.comision, 'text-digi-muted') },
    { key: 'neto', header: 'Neto', width: '100px', render: (g) => cifra(g.neto) },
    { key: 'estado', header: 'Estado', width: '100px', render: (g) => <PixelBadge variant={ESTADO_GANANCIA[g.estado].v}>{ESTADO_GANANCIA[g.estado].texto}</PixelBadge> },
  ];
}

export function tarjetaGanancia(g: Ganancia) {
  return (
    <>
      <div className="flex items-start gap-2">
        <span className="flex-1 min-w-0 text-[13.5px] font-medium text-digi-text leading-snug" style={mf}>{origenDe(g)}</span>
        <span className="shrink-0"><PixelBadge variant={ESTADO_GANANCIA[g.estado].v}>{ESTADO_GANANCIA[g.estado].texto}</PixelBadge></span>
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-[12px] text-digi-muted tabular-nums" style={mf}>
        <span>{fechaCorta(g.fecha)}</span>
        <span className="ml-auto">{money(g.bruto)} − {money(g.comision)} = <span className="text-digi-text font-medium">{money(g.neto)}</span></span>
      </div>
    </>
  );
}

/** El comprobante se sirve por su ruta con sesión (`/api/cobros/pagos/<id>/comprobante`), nunca por `/api/media`. */
export function EnlaceComprobante({ pago }: { pago: Pago }) {
  if (!pago.comprobante) return <span className="text-[12px] text-digi-muted" style={mf}>—</span>;
  return (
    <a href={`/api/cobros/pagos/${pago.id}/comprobante`} onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 text-[12.5px] text-accent hover:underline" style={mf} title={pago.comprobante.nombre}>
      <Paperclip className="w-3.5 h-3.5" /> Ver
    </a>
  );
}

export const ESTADO_PAGO: Record<Pago['estado'], { texto: string; v: 'success' | 'error' }> = {
  paid: { texto: 'Pagado', v: 'success' },
  voided: { texto: 'Anulado', v: 'error' },
};

export function columnasPagos(conPersona = false): Column<Pago>[] {
  return [
    { key: 'fecha', header: 'Fecha', width: '110px', render: (p) => <span className="text-[12px] text-digi-muted" style={mf}>{fechaCorta(p.fecha)}</span> },
    ...(conPersona ? [{ key: 'persona', header: 'Persona', render: (p: Pago) => <span className="block truncate text-[13px] text-digi-text" style={mf}>{p.persona || '—'}</span> }] : []),
    { key: 'total', header: 'Total', width: '110px', render: (p) => cifra(p.total, p.estado === 'voided' ? 'text-digi-muted line-through' : 'text-digi-text') },
    { key: 'referencia', header: 'Referencia', render: (p) => <span className="block truncate text-[12.5px] text-digi-text" style={mf} title={p.referencia}>{p.referencia}</span> },
    { key: 'cuenta', header: 'Cuenta', width: '130px', hideOnMobile: true, render: (p) => <span className="text-[12px] text-digi-muted" style={mf}>{p.ultimos4 ? `•••• ${p.ultimos4}` : '—'}</span> },
    { key: 'comprobante', header: 'Comprobante', width: '110px', render: (p) => <EnlaceComprobante pago={p} /> },
    { key: 'estado', header: 'Estado', width: '90px', render: (p) => <PixelBadge variant={ESTADO_PAGO[p.estado].v}>{ESTADO_PAGO[p.estado].texto}</PixelBadge> },
  ];
}

export function tarjetaPago(p: Pago, conPersona = false) {
  return (
    <>
      <div className="flex items-start gap-2">
        <span className="flex-1 min-w-0 text-[13.5px] font-medium text-digi-text leading-snug truncate" style={mf}>
          {conPersona && p.persona ? p.persona : p.referencia}
        </span>
        <span className="shrink-0"><PixelBadge variant={ESTADO_PAGO[p.estado].v}>{ESTADO_PAGO[p.estado].texto}</PixelBadge></span>
      </div>
      <div className="mt-1.5 flex items-center gap-3 text-[12px] text-digi-muted tabular-nums" style={mf}>
        <span>{fechaCorta(p.fecha)}</span>
        <EnlaceComprobante pago={p} />
        <span className="ml-auto text-digi-text font-medium">{money(p.total)}</span>
      </div>
    </>
  );
}

/** Un dato con su título encima (Configuración › Cobros y › Facturación). */
export function Dato({ t, v }: { t: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10.5px] uppercase tracking-wide text-digi-muted">{t}</dt>
      <dd className="text-digi-text truncate" title={v}>{v}</dd>
    </div>
  );
}

/** Un bloque con título dentro de un panel derecho (Pagos a miembros, Emisores). */
export function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-[12.5px] font-semibold text-digi-text mb-2" style={{ fontFamily: 'var(--font-display)' }}>{titulo}</h3>
      {children}
    </section>
  );
}
