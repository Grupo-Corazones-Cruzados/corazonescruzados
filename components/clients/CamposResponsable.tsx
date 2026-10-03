'use client';

import SearchableSelect from '@/components/ui/SearchableSelect';
import IconoCuenta from './IconoCuenta';

const mf = { fontFamily: 'var(--font-body)' } as const;
const df = { fontFamily: 'var(--font-display)' } as const;
/** Misma altura de etiqueta en los dos campos: la del cliente lleva el botón «Usar un correo»
 *  y, sin esto, «Miembro» quedaba más abajo. El valor va con `py-2.5`, como `SearchableSelect`. */
const FILA_ETIQUETA = 'flex items-center justify-between gap-2 h-6 mb-1';

/**
 * Los dos campos que abren «Nuevo ticket» y «Nuevo proyecto», uno junto al otro
 * (`grid sm:grid-cols-2`): a la izquierda el MIEMBRO, que es quien crea (solo lectura), y a la
 * derecha el CLIENTE, elegido de los suyos con buscador o escrito como correo. Definición
 * única: los dos formularios se veían distintos (Fernando, 2026-10-03).
 */
export function CampoMiembroPropio({ nombre }: { nombre: string }) {
  return (
    <div>
      <div className={FILA_ETIQUETA}>
        <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Miembro</label>
      </div>
      <div className="field-control w-full px-3 py-2.5 bg-digi-darker border-2 border-digi-border text-sm text-digi-muted rounded" style={mf}>
        Tú — {nombre}
      </div>
    </div>
  );
}

export type ClienteOpcion = { id: number | string; name?: string | null; email?: string | null; status?: string | null };

export function CampoClienteOCorreo({
  modo, onModo, clienteId, onClienteId, correo, onCorreo, clientes,
}: {
  modo: 'lista' | 'correo';
  /** Cambiar de modo vacía los dos valores: lo elegido en uno no vale en el otro. */
  onModo: (m: 'lista' | 'correo') => void;
  clienteId: string;
  onClienteId: (id: string) => void;
  correo: string;
  onCorreo: (v: string) => void;
  clientes: ClienteOpcion[];
}) {
  return (
    <div>
      <div className={FILA_ETIQUETA}>
        <label className="field-label text-[10px] text-accent-glow opacity-70" style={df}>Cliente <span className="text-accent">*</span></label>
        <button type="button" onClick={() => onModo(modo === 'lista' ? 'correo' : 'lista')}
          className="text-[11px] text-digi-muted hover:text-accent border border-digi-border rounded px-1.5 py-0.5 transition-colors" style={mf}>
          {modo === 'lista' ? 'Usar un correo' : 'Elegir de mis clientes'}
        </button>
      </div>
      {modo === 'lista' ? (
        <SearchableSelect value={clienteId} onChange={onClienteId}
          options={clientes.map((c) => ({
            value: String(c.id), label: c.name || c.email || '', hint: c.name && c.email && c.email !== c.name ? c.email : undefined,
            // Con cuenta en GCC World = cliente activo.
            icon: <IconoCuenta conCuenta={!c.status || c.status === 'activo'} />,
          }))}
          placeholder="Elige un cliente" searchPlaceholder="Buscar por nombre o correo…" />
      ) : (
        <input type="email" value={correo} onChange={(e) => onCorreo(e.target.value)} placeholder="correo@cliente.com"
          className="field-control w-full px-3 py-2.5 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:outline-none" style={mf} />
      )}
    </div>
  );
}
