'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Save } from 'lucide-react';
import { Boton, Campo, Entrada, AreaTexto, Selector, PieAcciones } from '@/componentes/ui';
import { crearReserva, actualizarReserva } from '@/acciones/reservas';
import { noches } from '@/lib/reservas';
import { dinero } from '@/lib/formato';
import { cn } from '@/lib/utils';

export type SuiteOpcion = {
  id: number;
  nombre: string;
  ubicacion: string;
  precioNoche: number | null;
};

export type ReservaEditable = {
  id: number;
  suiteId: number;
  clienteNombre: string;
  telefono: string | null;
  documento: string | null;
  entrada: string; // formato del campo: AAAA-MM-DDTHH:mm
  salida: string;
  precioTotal: number;
  anticipo: number;
  comentarios: string | null;
};

/** Valores de partida al CREAR. Va aparte de `reserva` a propósito: mientras no
 *  exista la reserva no hay identificador, y un objeto con id 0 haría que el
 *  formulario intentara actualizar una reserva inexistente en vez de crearla. */
export type InicialReserva = {
  suiteId: number;
  entrada: string;
  salida: string;
  /** Vino de pulsar un hueco de la agenda: la hora es una propuesta, no un dato. */
  propuesta?: boolean;
};

export default function FormularioReserva({
  slug,
  suites,
  reserva,
  inicial,
  moneda,
  alGuardar,
  id = 'form-reserva',
  sinPie = false,
  alEstado,
}: {
  slug: string;
  suites: SuiteOpcion[];
  reserva?: ReservaEditable;
  inicial?: InicialReserva;
  moneda: string;
  /** Si se da, al guardar se llama a esto en vez de saltar al detalle (el panel de edición cierra y recarga). */
  alGuardar?: () => void;
  /** Para unir botones de fuera (el pie fijo de un panel) con `form=`. */
  id?: string;
  /**
   * Dentro de un `PanelLateral` el pie lo pone el panel (regla del pie fijo, 2026-10-31): el
   * formulario no pinta sus botones y cuenta su estado con `alEstado` para que el panel los
   * deshabilite igual.
   */
  sinPie?: boolean;
  alEstado?: (e: { enCurso: boolean; bloqueado: boolean }) => void;
}) {
  const router = useRouter();
  const [enCurso, arranca] = useTransition();

  const [suiteId, setSuiteId] = useState(
    String(reserva?.suiteId ?? inicial?.suiteId ?? suites[0]?.id ?? ''),
  );
  const [entrada, setEntrada] = useState(reserva?.entrada ?? inicial?.entrada ?? '');
  const [salida, setSalida] = useState(reserva?.salida ?? inicial?.salida ?? '');
  const [precio, setPrecio] = useState(String(reserva?.precioTotal ?? ''));
  const [pagado, setPagado] = useState(String(reserva?.anticipo ?? ''));

  // El estado del pago no se elige: se lee de la cuenta. Aquí solo se anticipa lo
  // que el servidor va a decidir, para que quien guarda sepa cómo queda.
  const cuenta = useMemo(() => {
    const t = Number(precio) || 0;
    const a = Number(pagado) || 0;
    return { total: t, pagado: a, saldo: t - a, pagada: a >= t, excede: a > t };
  }, [precio, pagado]);

  const porUbicacion = useMemo(() => {
    const m = new Map<string, SuiteOpcion[]>();
    for (const s of suites) m.set(s.ubicacion, [...(m.get(s.ubicacion) ?? []), s]);
    return [...m.entries()];
  }, [suites]);

  // Sugerencia de precio: noches × tarifa de la suite. Es una SUGERENCIA — se
  // rellena solo si el campo está vacío, para no pisar un precio pactado.
  const sugerido = useMemo(() => {
    const s = suites.find((x) => String(x.id) === suiteId);
    if (!s?.precioNoche || !entrada || !salida) return null;
    const e = new Date(entrada);
    const x = new Date(salida);
    if (Number.isNaN(e.getTime()) || Number.isNaN(x.getTime()) || x <= e) return null;
    return { noches: noches(e, x), total: noches(e, x) * s.precioNoche };
  }, [suiteId, entrada, salida, suites]);

  useEffect(() => alEstado?.({ enCurso, bloqueado: cuenta.excede }), [alEstado, enCurso, cuenta.excede]);

  function enviar(datos: FormData) {
    arranca(async () => {
      const r = reserva
        ? await actualizarReserva(slug, reserva.id, datos)
        : await crearReserva(slug, datos);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(reserva ? 'Guardado.' : 'Reserva creada.');
      if (alGuardar) {
        alGuardar();
        return;
      }
      // Cuando se navega NO se refresca: refrescar invalida el árbol ACTUAL, que es
      // justo el que se está abandonando, y el destino es dinámico —llega recién
      // hecho igual—. (Sospeché que además cancelaba el salto; lo medí y NO era
      // cierto: el salto ocurría y quien llegaba tarde era mi comprobación.)
      router.push(`/${slug}/reserva/${r.id}`);
    });
  }

  if (!suites.length) {
    return (
      <p className="text-[13px] text-aviso">No hay suites. Créalas en Configuración.</p>
    );
  }

  return (
    <form id={id} action={enviar} className="flex flex-1 flex-col gap-4">
      {/* Rejilla de dos columnas: se aprovecha el ancho del panel. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Suite" requerido>
          <Selector name="suiteId" value={suiteId} onChange={(e) => setSuiteId(e.target.value)} required>
            {porUbicacion.map(([ubicacion, lista]) => (
              <optgroup key={ubicacion} label={ubicacion}>
                {lista.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre}
                    {s.precioNoche ? ` — ${dinero(s.precioNoche, moneda)}/noche` : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Huésped" requerido>
          <Entrada name="clienteNombre" defaultValue={reserva?.clienteNombre} required />
        </Campo>
        <Campo etiqueta="Teléfono">
          <Entrada name="telefono" defaultValue={reserva?.telefono ?? ''} inputMode="tel" />
        </Campo>
        <Campo etiqueta="Documento de identidad">
          <Entrada name="documento" defaultValue={reserva?.documento ?? ''} />
        </Campo>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Entrada" requerido>
          <Entrada
            name="entrada"
            type="datetime-local"
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            required
          />
        </Campo>
        <Campo etiqueta="Salida" requerido>
          <Entrada
            name="salida"
            type="datetime-local"
            value={salida}
            onChange={(e) => setSalida(e.target.value)}
            required
          />
        </Campo>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Precio total">
          <Entrada
            name="precioTotal"
            type="number"
            step="0.01"
            min="0"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            placeholder="0.00"
          />
        </Campo>
        <Campo etiqueta="Valor pagado (abono)">
          <Entrada
            name="anticipo"
            type="number"
            step="0.01"
            min="0"
            value={pagado}
            onChange={(e) => setPagado(e.target.value)}
            placeholder="0.00"
          />
        </Campo>
      </div>

      {/* Una línea con la cuenta tal como va a quedar; la tarifa sugerida es una ACCIÓN. */}
      <div className="-mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
        <span className={cn('font-semibold', cuenta.excede ? 'text-error' : cuenta.pagada ? 'text-exito' : 'text-aviso')}>
          {cuenta.excede ? 'El abono supera el total' : cuenta.pagada ? 'Pagada' : `Saldo ${dinero(cuenta.saldo, moneda)}`}
        </span>
        {sugerido && (
          <button
            type="button"
            onClick={() => setPrecio(sugerido.total.toFixed(2))}
            className="text-acento underline underline-offset-2 hover:text-acento-fuerte"
          >
            {sugerido.noches} {sugerido.noches === 1 ? 'noche' : 'noches'} · usar {dinero(sugerido.total, moneda)}
          </button>
        )}
      </div>

      {/* El último campo crece hasta el pie: el texto largo aprovecha el alto (regla 2026-11-08). */}
      <Campo etiqueta="Comentarios" className="flex flex-1 flex-col">
        <AreaTexto name="comentarios" rows={4} defaultValue={reserva?.comentarios ?? ''} className="min-h-24 flex-1" />
      </Campo>

      {!sinPie && (
        <div className="mt-auto border-t border-borde pt-4">
          <PieAcciones>
            <Boton type="button" variante="secundario" onClick={() => router.back()} disabled={enCurso}>
              Cancelar
            </Boton>
            <Boton type="submit" icono={Save} disabled={enCurso || cuenta.excede}>
              {enCurso ? 'Guardando…' : reserva ? 'Guardar' : 'Crear reserva'}
            </Boton>
          </PieAcciones>
        </div>
      )}
    </form>
  );
}
