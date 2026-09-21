'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { AlertCircle, CalendarCheck, Save } from 'lucide-react';
import { Boton, Campo, Entrada, AreaTexto, Selector } from '@/componentes/ui';
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
}: {
  slug: string;
  suites: SuiteOpcion[];
  reserva?: ReservaEditable;
  inicial?: InicialReserva;
  moneda: string;
  /** Si se da, al guardar se llama a esto en vez de saltar al detalle (el panel de edición cierra y recarga). */
  alGuardar?: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
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

  function enviar(datos: FormData) {
    setError(null);
    arranca(async () => {
      const r = reserva
        ? await actualizarReserva(slug, reserva.id, datos)
        : await crearReserva(slug, datos);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      toast.success(reserva ? 'Reserva actualizada' : 'Reserva creada');
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
      <p className="rounded border border-borde bg-aviso-suave px-3 py-2 text-[13px] text-aviso">
        No hay suites creadas todavía. Créalas en Configuración antes de registrar una reserva.
      </p>
    );
  }

  return (
    <form action={enviar} className="space-y-4">
      {inicial?.propuesta && (
        <p className="flex items-start gap-2 rounded border border-borde bg-acento-suave px-3 py-2 text-[12px] text-acento">
          <CalendarCheck className="mt-px h-4 w-4 shrink-0" />
          La entrada y la salida vienen del hueco que pulsaste en la agenda: revísalas antes de guardar.
        </p>
      )}
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Huésped" requerido>
          <Entrada name="clienteNombre" defaultValue={reserva?.clienteNombre} required />
        </Campo>
        <Campo etiqueta="Teléfono">
          <Entrada name="telefono" defaultValue={reserva?.telefono ?? ''} inputMode="tel" />
        </Campo>
      </div>

      <Campo etiqueta="Documento de identidad">
        <Entrada name="documento" defaultValue={reserva?.documento ?? ''} />
      </Campo>

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

      {sugerido && (
        <p className="-mt-2 text-[12px] text-tenue">
          {sugerido.noches} {sugerido.noches === 1 ? 'noche' : 'noches'} ·{' '}
          <button
            type="button"
            onClick={() => setPrecio(sugerido.total.toFixed(2))}
            className="font-semibold text-acento underline underline-offset-2"
          >
            usar {dinero(sugerido.total, moneda)}
          </button>
        </p>
      )}

      <p className={cn('-mt-2 text-[12px]', cuenta.excede ? 'text-error' : cuenta.pagada ? 'text-exito' : 'text-aviso')}>
        {cuenta.excede
          ? 'El valor pagado supera el precio total.'
          : cuenta.pagada
            ? 'Cuenta saldada: la reserva quedará como pagada.'
            : `Saldo pendiente: ${dinero(cuenta.saldo, moneda)}. Quedará como pago pendiente.`}
      </p>

      <Campo etiqueta="Comentarios">
        <AreaTexto name="comentarios" rows={3} defaultValue={reserva?.comentarios ?? ''} />
      </Campo>

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded border border-borde bg-error-suave px-3 py-2 text-[12px] text-error"
        >
          <AlertCircle className="mt-px h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-borde pt-4">
        <Boton type="button" variante="secundario" onClick={() => router.back()} disabled={enCurso}>
          Cancelar
        </Boton>
        <Boton type="submit" icono={Save} disabled={enCurso || cuenta.excede}>
          {enCurso ? 'Guardando…' : reserva ? 'Guardar cambios' : 'Crear reserva'}
        </Boton>
      </div>
    </form>
  );
}
