'use client';

import PanelCompartirEnlace from '@/components/ui/PanelCompartirEnlace';
import { EditAmount } from '@/components/ui/EditDialog';
import { fmt2 } from '@/lib/format';

/**
 * Vigencias del enlace de pago. «el usuario miembro responsable define el tiempo máximo de
 * duración del token» (Fernando, 2026-08-25). Tope: 30 días (`MAX_HORAS_ENLACE`).
 */
const DURACIONES = [
  { v: 24, l: '1 día' }, { v: 72, l: '3 días' }, { v: 168, l: '1 semana' },
  { v: 360, l: '15 días' }, { v: 720, l: '1 mes' },
];

/**
 * EL ENLACE DE PAGO (canal 3) — el formulario de compartir, para proyecto y ticket.
 *
 * Es `PanelCompartirEnlace` (el mismo de la cotización) con lo propio del cobro: el importe
 * limpio debajo y la llamada a `/api/<origen>/<id>/payment-link`. Lo que va encima del
 * importe —p. ej. elegir la etapa— lo pone quien lo usa en `children`.
 */
export default function PanelEnlacePago({
  open, onClose, titulo, que, endpoint, cuerpo, correoInicial, importe, etiquetaImporte, children, puedeGenerar = true,
}: {
  open: boolean;
  onClose: () => void;
  titulo: string;
  /** Qué se paga, en minúscula: «el proyecto», «la etapa Anticipo», «el ticket». */
  que: string;
  endpoint: string;
  /** Lo que se añade al cuerpo del POST (p. ej. `{ stage_id }`). */
  cuerpo?: Record<string, unknown>;
  correoInicial: string;
  importe: number;
  etiquetaImporte: string;
  children?: React.ReactNode;
  puedeGenerar?: boolean;
}) {
  return (
    <PanelCompartirEnlace
      open={open} onClose={onClose} title={titulo}
      intro={<>Genera un enlace para que el cliente pague <strong>{que}</strong> sin crear cuenta: verá el detalle,
        rellenará sus datos de facturación y pagará con <strong>tarjeta o transferencia</strong>. La factura se emite
        sola en cuanto el pago se confirma.</>}
      duraciones={DURACIONES} duracionInicial={168} correoInicial={correoInicial}
      puedeGenerar={puedeGenerar}
      aviso="Cualquiera con este enlace puede ver el detalle y pagar. No lo publiques."
      generar={async ({ horas, email, enviar }) => {
        const res = await fetch(endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...cuerpo, email, horas, enviar }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || 'No se pudo generar el enlace');
        // El enlace se enseña SIEMPRE, aunque el correo falle: ya es válido y el responsable
        // puede copiarlo y mandarlo por donde quiera.
        if (!enviar) return { url: d.url, mensaje: 'Enlace generado' };
        return d.correoEnviado
          ? { url: d.url, mensaje: `Enlace enviado a ${d.email}` }
          : { url: d.url, mensaje: 'Enlace creado, pero el correo no salió: cópialo y envíalo tú', ok: false };
      }}
      pie={<EditAmount label={etiquetaImporte} value={`$${fmt2(importe)}`}
        hint={<>Es el importe limpio. Al cliente se le suman aparte los gastos de procesamiento del
          pago con tarjeta, que paga él y ve antes de confirmar.</>} />}
    >
      {children}
    </PanelCompartirEnlace>
  );
}
