'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { CreditCard, ExternalLink } from 'lucide-react';
import { Boton } from '@/componentes/ui';
import { enlaceDePago } from '@/acciones/suscripcion';

/**
 * «PAGAR ESTE MES» — lleva a la pantalla de pago de la plataforma.
 *
 * Ahí están las dos formas que pidió Fernando y que ya existían: **tarjeta** por la
 * pasarela, o **transferencia** subiendo el comprobante, que luego una persona de GCC
 * confirma o rechaza. No se rehace nada de eso aquí: el enlace lleva a la misma pantalla
 * que usa el equipo, así que pagar desde el producto y pagar desde el módulo de
 * suscripciones es literalmente lo mismo.
 *
 * Se abre en la misma pestaña a propósito: es un pago, y una pestaña nueva es una pestaña
 * que se pierde de vista a media transferencia.
 */
export default function BotonPagar({ slug, periodo, importe, moneda }: {
  slug: string; periodo: string; importe: number; moneda: string;
}) {
  const [enCurso, arranca] = useTransition();
  const [yendo, setYendo] = useState(false);

  return (
    <Boton
      tamano="lg"
      disabled={enCurso || yendo}
      onClick={() =>
        arranca(async () => {
          const r = await enlaceDePago(slug);
          if (!r.ok) { toast.error(r.error); return; }
          setYendo(true);
          window.location.href = r.url;
        })
      }
    >
      <CreditCard className="h-4 w-4" />
      {enCurso || yendo ? 'Abriendo el pago…' : `Pagar ${periodo} · ${importe.toFixed(2)} ${moneda}`}
      <ExternalLink className="h-3.5 w-3.5" />
    </Boton>
  );
}
