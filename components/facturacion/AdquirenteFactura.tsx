'use client';

import SearchableSelect from '@/components/ui/SearchableSelect';

const mf = { fontFamily: 'var(--font-body)' } as const;

/** Una cuenta de facturación con la que se puede facturar tal cual (ver `cuentaFacturable`). */
export type CuentaFacturable = {
  id: number; id_type: string; ruc: string; name: string;
  email: string | null; phone: string | null; address: string | null;
  portal_client_id: number | null;
};

export type ModoAdquirente = 'cliente' | 'consumidor_final';

/** El SRI no admite facturar a consumidor final por encima de esto. */
export const TOPE_CONSUMIDOR_FINAL = 50;

const TIPO_ID: Record<string, string> = { '04': 'RUC', '05': 'Cédula', '06': 'Pasaporte' };

/**
 * ¿A QUIÉN SE FACTURA? — el adquirente se ELIGE, no se escribe (Fernando, 2026-09-29).
 *
 * Dos opciones: **Cliente** (se elige una cuenta de facturación; sus datos salen de ahí y no
 * se editan) o **Consumidor final** (nada que elegir). La lista solo trae cuentas completas:
 * una a medias no aparece, y se completa en Facturación → Clientes.
 *
 * Consumidor final se deshabilita por encima de 50 $ con el porqué: el SRI no lo admite, y
 * ofrecerlo para luego rechazarlo al emitir es peor que no ofrecerlo.
 */
export default function AdquirenteFactura({
  modo, onModo, cuentaId, onCuenta, cuentas, total, cargando = false,
}: {
  modo: ModoAdquirente;
  onModo: (m: ModoAdquirente) => void;
  cuentaId: string;
  onCuenta: (id: string) => void;
  cuentas: CuentaFacturable[];
  total: number;
  cargando?: boolean;
}) {
  const cfBloqueado = total > TOPE_CONSUMIDOR_FINAL;
  const cuenta = cuentas.find((c) => String(c.id) === cuentaId) || null;

  const opcion = (m: ModoAdquirente, texto: string, deshabilitada = false, porque?: string) => (
    <button type="button" onClick={() => !deshabilitada && onModo(m)} disabled={deshabilitada} title={porque}
      aria-pressed={modo === m}
      className={`flex-1 px-3 py-1.5 text-[12.5px] font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        modo === m ? 'bg-accent text-white' : 'text-digi-text enabled:hover:bg-black/[0.04]'}`} style={mf}>
      {texto}
    </button>
  );

  return (
    <div className="space-y-2">
      <div className="flex gap-1 p-1 rounded-lg border border-digi-border bg-digi-card max-w-sm">
        {opcion('cliente', 'Cliente')}
        {opcion('consumidor_final', 'Consumidor final', cfBloqueado,
          cfBloqueado ? `El SRI no admite facturar a consumidor final por más de $${TOPE_CONSUMIDOR_FINAL}.00` : undefined)}
      </div>

      {modo === 'cliente' && (
        <>
          <SearchableSelect
            value={cuentaId}
            onChange={onCuenta}
            options={cuentas.map((c) => ({ value: String(c.id), label: `${c.name} · ${c.ruc}` }))}
            placeholder={cargando ? 'Cargando clientes…' : cuentas.length ? 'Elige el cliente…' : 'No hay clientes con datos de facturación completos'}
            searchPlaceholder="Buscar por nombre o identificación…"
            disabled={cargando || cuentas.length === 0}
          />
          {cuenta ? (
            // Solo lectura: los datos se corrigen en la cuenta de facturación, no aquí.
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 rounded-md bg-black/[0.03] px-3 py-2 text-[12px]" style={mf}>
              <div className="flex gap-2 min-w-0"><dt className="text-digi-muted shrink-0">{TIPO_ID[cuenta.id_type] || 'ID'}</dt><dd className="text-digi-text tabular-nums truncate">{cuenta.ruc}</dd></div>
              <div className="flex gap-2 min-w-0"><dt className="text-digi-muted shrink-0">Correo</dt><dd className="text-digi-text truncate">{cuenta.email}</dd></div>
              <div className="flex gap-2 min-w-0"><dt className="text-digi-muted shrink-0">Dirección</dt><dd className="text-digi-text truncate" title={cuenta.address || ''}>{cuenta.address}</dd></div>
              <div className="flex gap-2 min-w-0"><dt className="text-digi-muted shrink-0">Teléfono</dt><dd className="text-digi-text truncate">{cuenta.phone || '—'}</dd></div>
            </dl>
          ) : !cargando && (
            <p className="text-[11.5px] text-digi-muted" style={mf}>
              Solo aparecen los clientes con sus datos de facturación completos (identificación, dirección y correo).
            </p>
          )}
        </>
      )}
      {modo === 'consumidor_final' && (
        <p className="text-[12px] text-digi-muted" style={mf}>La factura sale a nombre de CONSUMIDOR FINAL (9999999999999).</p>
      )}
    </div>
  );
}
