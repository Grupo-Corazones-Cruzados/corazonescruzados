import type { EstadoEmisor, Regimen } from '@/lib/integrations/sri/regimen';

/**
 * Piezas compartidas por Configuración › Facturación (el miembro) y Admin › Emisores: una sola definición de cómo
 * se nombra cada estado y cada régimen.
 */

/** El estado en UNA palabra, solo con color de texto (sin cápsula con relleno). */
export const ESTADO_EMISOR: Record<EstadoEmisor, { texto: string; clase: string }> = {
  borrador: { texto: 'Borrador', clase: 'text-digi-muted' },
  en_pruebas: { texto: 'Pruebas', clase: 'text-amber-600' },
  activo: { texto: 'Activo', clase: 'text-green-600' },
  suspendido: { texto: 'Suspendido', clase: 'text-red-600' },
};

export const REGIMEN_TEXTO: Record<Regimen, string> = {
  rimpe_negocio_popular: 'Negocio Popular',
  rimpe_emprendedor: 'Emprendedor',
  general: 'General',
};

/** `codigoPorcentaje` del SRI → tarifa. */
export const TARIFA_IVA: Record<string, string> = { '0': '0 %', '4': '15 %', '5': '5 %' };

export function EstadoEmisorTexto({ estado }: { estado: EstadoEmisor }) {
  const e = ESTADO_EMISOR[estado] ?? ESTADO_EMISOR.borrador;
  return <span className={`text-[12.5px] font-medium ${e.clase}`}>{e.texto}</span>;
}
