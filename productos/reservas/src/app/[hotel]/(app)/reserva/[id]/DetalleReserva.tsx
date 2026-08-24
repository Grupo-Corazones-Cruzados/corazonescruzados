'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil, Trash2, BadgeCheck, DoorOpen } from 'lucide-react';
import { Boton, Confirmar, PanelLateral } from '@/componentes/ui';
import FormularioReserva, {
  type ReservaEditable,
  type SuiteOpcion,
} from '@/componentes/FormularioReserva';
import { eliminarReserva, marcarPagada, darSalida } from '@/acciones/reservas';

/**
 * Acciones del detalle. Una acción que no procede se DESHABILITA, no desaparece:
 * un botón que se esfuma deja al usuario buscando dónde estaba.
 */
export default function DetalleReserva({
  slug,
  reserva,
  suites,
  moneda,
  puedeOperar,
  yaPagada,
  yaFinalizada,
}: {
  slug: string;
  reserva: ReservaEditable;
  suites: SuiteOpcion[];
  moneda: string;
  puedeOperar: boolean;
  yaPagada: boolean;
  yaFinalizada: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
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

  if (!puedeOperar) {
    return (
      <p className="tarjeta p-4 text-[12px] leading-relaxed text-tenue">
        Tu cuenta es de solo consulta: puedes ver la reserva, pero no modificarla.
      </p>
    );
  }

  return (
    <>
      <div className="tarjeta space-y-2 p-4">
        <Boton
          icono={Pencil}
          className="w-full"
          onClick={() => setEditando(true)}
          disabled={enCurso}
        >
          Editar reserva
        </Boton>
        <Boton
          variante="secundario"
          icono={BadgeCheck}
          className="w-full"
          disabled={enCurso || yaPagada}
          title={yaPagada ? 'La reserva ya está pagada' : undefined}
          onClick={() => ejecutar(() => marcarPagada(slug, reserva.id), 'Reserva marcada como pagada')}
        >
          {yaPagada ? 'Ya está pagada' : 'Marcar como pagada'}
        </Boton>
        <Boton
          variante="secundario"
          icono={DoorOpen}
          className="w-full"
          disabled={enCurso || yaFinalizada}
          title={yaFinalizada ? 'La estancia ya terminó' : undefined}
          onClick={() => ejecutar(() => darSalida(slug, reserva.id), 'Salida registrada')}
        >
          {yaFinalizada ? 'Estancia terminada' : 'Registrar salida'}
        </Boton>
        <Boton
          variante="fantasma"
          icono={Trash2}
          className="w-full text-error hover:bg-error-suave hover:text-error"
          disabled={enCurso}
          onClick={() => setBorrando(true)}
        >
          Eliminar
        </Boton>
      </div>

      <PanelLateral
        abierto={editando}
        alCerrar={() => setEditando(false)}
        titulo="Editar reserva"
        descripcion={reserva.clienteNombre}
        ancho="lg"
      >
        <FormularioReserva slug={slug} suites={suites} reserva={reserva} moneda={moneda} />
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
