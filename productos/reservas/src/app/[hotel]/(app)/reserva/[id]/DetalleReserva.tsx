'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil, Trash2, DoorOpen } from 'lucide-react';
import { Boton, Confirmar, PanelLateral } from '@/componentes/ui';
import { CabeceraPagina } from '@/componentes/Navegacion';
import FormularioReserva, {
  type ReservaEditable,
  type SuiteOpcion,
} from '@/componentes/FormularioReserva';
import { eliminarReserva, darSalida } from '@/acciones/reservas';

/**
 * Acciones del detalle. Una acción que no procede se DESHABILITA, no desaparece:
 * un botón que se esfuma deja al usuario buscando dónde estaba.
 *
 * «Marcar como pagada» ya no existe (Fernando, 2026-09-20): el pago se deriva de
 * lo pagado frente al precio, así que se anota el cobro EDITANDO la reserva. Y la
 * salida se registra solo cuando la cuenta está saldada.
 *
 * Las acciones van en la CABECERA de la página (por eso la cabecera se pinta aquí):
 * «Editar» y «Registrar salida» son las principales —en el teléfono, la barra de
 * abajo—; «Eliminar» es secundaria y destructiva —en el teléfono, dentro del «⋯»—.
 */
export default function DetalleReserva({
  cabecera,
  slug,
  reserva,
  suites,
  moneda,
  puedeOperar,
  pagada,
  yaFinalizada,
  abrirEdicion = false,
}: {
  cabecera: { titulo: string; volver: string; extra?: React.ReactNode };
  slug: string;
  reserva: ReservaEditable;
  suites: SuiteOpcion[];
  moneda: string;
  puedeOperar: boolean;
  pagada: boolean;
  yaFinalizada: boolean;
  /** Llega con `?editar=1` (desde la lista de saldos pendientes): se abre ya en edición. */
  abrirEdicion?: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(abrirEdicion);
  const [borrando, setBorrando] = useState(false);
  const [enCurso, arranca] = useTransition();

  const ejecutar = (fn: () => Promise<{ ok: boolean; error?: string }>, exito: string) =>
    arranca(async () => {
      const r = await fn();
      if (!r.ok) {
        toast.error(r.error ?? 'No se pudo completar la acción');
        return;
      }
      toast.success(exito);
      router.refresh();
    });

  const titulo = (
    <CabeceraPagina
      titulo={cabecera.titulo}
      volver={{ href: cabecera.volver, etiqueta: 'Volver' }}
      extra={cabecera.extra}
      menu={
        puedeOperar
          ? [{ etiqueta: 'Eliminar', icono: Trash2, peligro: true, deshabilitado: enCurso, alPulsar: () => setBorrando(true) }]
          : undefined
      }
      acciones={
        puedeOperar && (
          <>
            {/* La salida a la izquierda y «Editar» (la afirmativa) a la derecha. */}
            <Boton
              variante="secundario"
              icono={DoorOpen}
              disabled={enCurso || yaFinalizada || !pagada}
              title={
                yaFinalizada
                  ? 'La estancia ya terminó'
                  : !pagada
                    ? 'Con saldo pendiente no se puede dar la salida: edita la reserva y anota el pago'
                    : undefined
              }
              onClick={() => ejecutar(() => darSalida(slug, reserva.id), 'Salida registrada')}
            >
              {/* Corto: en el teléfono comparte la barra con «Editar». Que falta el pago ya lo
                  dice la línea de estado («Pago pendiente»). */}
              {yaFinalizada ? 'Estancia terminada' : 'Registrar salida'}
            </Boton>
            <Boton icono={Pencil} onClick={() => setEditando(true)} disabled={enCurso}>
              Editar reserva
            </Boton>
          </>
        )
      }
    />
  );

  if (!puedeOperar) return titulo;

  return (
    <>
      {titulo}

      <PanelLateral
        abierto={editando}
        alCerrar={() => setEditando(false)}
        titulo="Editar reserva"
        descripcion={reserva.clienteNombre}
        ancho="lg"
      >
        <FormularioReserva
          slug={slug}
          suites={suites}
          reserva={reserva}
          moneda={moneda}
          alGuardar={() => {
            setEditando(false);
            // Misma pantalla sin `?editar=1`: al ser dinámica llega recién hecha.
            router.replace(`/${slug}/reserva/${reserva.id}`);
          }}
        />
      </PanelLateral>

      <Confirmar
        abierto={borrando}
        titulo="Eliminar la reserva"
        mensaje="La reserva deja de contar para la ocupación y para los reportes, pero no se borra de la base: el histórico de meses cerrados no puede cambiar hacia atrás."
        ocupado={enCurso}
        alCerrar={() => setBorrando(false)}
        alAceptar={() =>
          arranca(async () => {
            const r = await eliminarReserva(slug, reserva.id);
            if (!r.ok) {
              toast.error(r.error);
              return;
            }
            toast.success('Reserva eliminada');
            setBorrando(false);
      // Cuando se navega NO se refresca: refrescar invalida el árbol ACTUAL, que es
      // justo el que se está abandonando, y el destino es dinámico —llega recién
      // hecho igual—. (Sospeché que además cancelaba el salto; lo medí y NO era
      // cierto: el salto ocurría y quien llegaba tarde era mi comprobación.)
            router.push(`/${slug}/panel`);
          })
        }
      />
    </>
  );
}
