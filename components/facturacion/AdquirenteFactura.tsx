'use client';

import SearchableSelect from '@/components/ui/SearchableSelect';
import Segmentado from '@/components/ui/Segmentado';

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

  return (
    <div className="space-y-2">
      <Segmentado<ModoAdquirente>
        etiqueta="Adquirente"
        valor={modo}
        onChange={onModo}
        opciones={[
          { valor: 'cliente', texto: 'Cliente' },
          { valor: 'consumidor_final', texto: 'Consumidor final', deshabilitada: cfBloqueado,
            porque: `El SRI no admite facturar a consumidor final por más de $${TOPE_CONSUMIDOR_FINAL}.00` },
        ]}
      />

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
          ) : null}
        </>
      )}
    </div>
  );
}
