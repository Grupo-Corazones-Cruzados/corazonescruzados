import { ETIQUETA_COMIDA, COLOR_COMIDA } from '@/lib/catalogo';
import type { TipoComida } from '@/generated/prisma/enums';
import type { Entrega } from '@/lib/despacho';

/**
 * LA ETIQUETA DEL PAQUETE — 10 × 7 cm, la medida de la del proyecto de referencia.
 * Se pega en la vianda: la cocina lee las restricciones, el despacho lee la
 * dirección y el motorizado se reconoce por su color. Todo tiene que leerse a
 * un metro, así que nombre y comida van grandes.
 *
 * Es un componente de servidor a propósito: no tiene estado y se imprime.
 */
export function Etiqueta({ entrega, comida }: { entrega: Entrega; comida: TipoComida }) {
  const c = entrega.cliente;
  const cocina = entrega.restriccionesCocina[comida] ?? [];
  const direccion = [c.direccion, c.edificio && `Edif. ${c.edificio}`, c.piso && `Piso ${c.piso}`].filter(Boolean).join(' · ');
  return (
    <div
      className="flex h-[7cm] w-[10cm] shrink-0 flex-col overflow-hidden rounded-md border border-borde bg-white text-[11px] text-black print:break-inside-avoid print:rounded-none print:border-black"
    >
      <div className="flex items-center justify-between px-3 py-1.5 text-white" style={{ background: COLOR_COMIDA[comida] }}>
        <span className="text-[15px] font-bold uppercase tracking-wide">{ETIQUETA_COMIDA[comida]}</span>
        {entrega.comidas.length > 1 && (
          <span className="text-[9px] opacity-90">{entrega.comidas.map((x) => ETIQUETA_COMIDA[x]).join(' + ')}</span>
        )}
      </div>
      <div className="flex items-center gap-2 border-b border-gray-300 px-3 py-1.5">
        {c.colorIdentificador && (
          <span className="h-3 w-3 shrink-0 rounded-full border border-gray-400" style={{ background: c.colorIdentificador }} />
        )}
        <p className="truncate text-[14px] font-bold">{c.nombre}</p>
        {c.numeroDireccion === 2 && <span className="ml-auto rounded bg-gray-200 px-1.5 text-[9px] font-semibold">Dir. 2</span>}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-1 px-3 py-1">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-500">Cocina</p>
          {cocina.length ? (
            <div className="flex flex-wrap gap-1">
              {cocina.map((r) => (
                <span key={r} className="rounded bg-red-600 px-1.5 py-px text-[10px] font-bold text-white">
                  SIN {r.toUpperCase()}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[10px] italic text-gray-500">Sin restricciones para este menú</p>
          )}
        </div>
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-500">Despacho</p>
          {entrega.restriccionesDespacho.length ? (
            <div className="flex flex-wrap gap-1">
              {entrega.restriccionesDespacho.map((r) => (
                <span key={r} className="rounded border border-orange-500 px-1.5 py-px text-[10px] font-semibold text-orange-700">
                  {r}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[10px] italic text-gray-500">Estándar</p>
          )}
        </div>
      </div>
      <div className="border-t border-gray-300 px-3 py-1 leading-tight">
        <p className="truncate text-[10px]">{direccion}</p>
        {c.referencias && <p className="truncate text-[9px] italic text-gray-600">Ref.: {c.referencias}</p>}
      </div>
      <div className="flex items-center gap-2 border-t border-gray-300 px-3 py-1">
        {entrega.motorizado ? (
          <>
            {entrega.motorizado.color && (
              <span className="h-3 w-3 rounded-full border border-gray-400" style={{ background: entrega.motorizado.color }} />
            )}
            <span className="text-[10px] font-semibold">{entrega.motorizado.nombre}</span>
          </>
        ) : (
          <span className="text-[10px] font-semibold text-red-700">Sin motorizado</span>
        )}
        <span className="ml-auto text-[9px] text-gray-500">{c.celular}</span>
      </div>
    </div>
  );
}
