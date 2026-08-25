'use client';

/**
 * EL DESENLACE DEL PAGO — a donde `/pagos/respuesta` deja al cliente tras confirmar.
 *
 * Es la última pantalla que ve alguien que acaba de mover dinero, así que cada estado dice
 * **qué pasó con su dinero** antes que nada. La regla que ordena los textos: si el cobro
 * pudo haber entrado, no se le dice que falló.
 *
 * Hermana de `/pagar/<token>`: mismo marco público, mismas piezas.
 */

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { Contenedor, Tarjeta } from '@/components/sitio/piezas';
import { SITIO } from '@/lib/sitio/contenido';

type Desenlace = {
  icono: typeof CheckCircle2;
  color: string;
  titulo: string;
  cuerpo: string;
  escribir?: boolean;
};

const DESENLACES: Record<string, Desenlace> = {
  pagado: {
    icono: CheckCircle2,
    color: 'text-emerald-600',
    titulo: '¡Pago recibido!',
    cuerpo: 'Gracias. Tu factura electrónica se emite automáticamente y te llega al correo que registraste. Si no la ves en unos minutos, revisa el correo no deseado.',
  },
  rechazado: {
    icono: XCircle,
    color: 'text-red-600',
    titulo: 'El pago no se completó',
    cuerpo: 'Tu banco rechazó la transacción y no se te ha cobrado nada. Puedes volver al enlace e intentarlo con otra tarjeta.',
  },
  // ⚠️ Aquí el cliente SÍ pudo haber pagado. Decirle «falló» sería mentirle y, peor, hacer
  // que lo intente otra vez y pague dos veces.
  verificando: {
    icono: Clock,
    color: 'text-amber-600',
    titulo: 'Estamos verificando tu pago',
    cuerpo: 'Tu pago pudo haberse procesado correctamente, pero no hemos podido confirmarlo todavía. NO vuelvas a pagar: lo revisamos y te escribimos en breve.',
    escribir: true,
  },
  descuadre: {
    icono: AlertTriangle,
    color: 'text-amber-600',
    titulo: 'Revisaremos este pago a mano',
    cuerpo: 'El importe cobrado no coincide con el de esta etapa, así que hemos parado la emisión de la factura para revisarlo. Si se te cobró algo, lo resolvemos contigo.',
    escribir: true,
  },
  desconocido: {
    icono: AlertTriangle,
    color: 'text-amber-600',
    titulo: 'No encontramos este pago',
    cuerpo: 'La referencia del pago no corresponde a ningún cobro nuestro. Si el dinero salió de tu cuenta, escríbenos con el comprobante y lo revisamos.',
    escribir: true,
  },
  invalido: {
    icono: AlertTriangle,
    color: 'text-amber-600',
    titulo: 'Enlace de confirmación incompleto',
    cuerpo: 'Llegaste aquí sin los datos de la transacción. Si acabas de pagar, escríbenos antes de volver a intentarlo.',
    escribir: true,
  },
};

function Contenido() {
  const sp = useSearchParams();
  const estado = sp.get('estado') || 'invalido';
  const d = DESENLACES[estado] || DESENLACES.invalido;
  const Icono = d.icono;

  return (
    <Contenedor className="py-20 sm:py-28">
      <Tarjeta className="max-w-xl mx-auto text-center">
        <Icono className={`w-10 h-10 mx-auto ${d.color}`} />
        <h1 className="mt-4 text-[24px] font-semibold text-[var(--texto)]">{d.titulo}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--suave)]">{d.cuerpo}</p>
        {d.escribir && (
          <a href={`mailto:${SITIO.correo}`}
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-[var(--violeta)] px-5 py-2.5 text-[14px] font-semibold text-white hover:opacity-90">
            Escríbenos
          </a>
        )}
      </Tarjeta>
    </Contenedor>
  );
}

export default function PaginaResultadoPago() {
  // `useSearchParams` exige Suspense para que la página pueda prerenderizarse.
  return (
    <Suspense fallback={<Contenedor className="py-24"><div className="h-40 rounded-xl bg-[var(--linea)]/60 animate-pulse" /></Contenedor>}>
      <Contenido />
    </Suspense>
  );
}
