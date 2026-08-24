import { notFound } from 'next/navigation';
import { redirect } from 'next/navigation';
import { CreditCard, ShieldAlert, CalendarX2 } from 'lucide-react';
import { exigirSesionDelHotel } from '@/lib/inquilino';
import { AplicaMarca, LogoHotel } from '@/componentes/Marca';
import { dinero } from '@/lib/formato';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Suscripción' };

const MENSAJES = {
  vencido: {
    icono: CalendarX2,
    titulo: 'La mensualidad está vencida',
    texto:
      'El acceso a la aplicación se reanuda en cuanto se registre el pago del mes. Los datos del alojamiento siguen guardados y no se pierde nada.',
  },
  'sin-pago': {
    icono: CreditCard,
    titulo: 'Todavía no hay ningún pago registrado',
    texto:
      'La cuenta está creada y lista. En cuanto el Grupo Corazones Cruzados registre el primer pago, la aplicación se abre.',
  },
  suspendido: {
    icono: ShieldAlert,
    titulo: 'La cuenta está suspendida',
    texto:
      'El acceso está detenido. Ponte en contacto con el Grupo Corazones Cruzados para reactivarlo.',
  },
} as const;

export default async function PaginaSuscripcion({ params }: { params: Promise<{ hotel: string }> }) {
  const { hotel } = await params;
  const { inquilino, acceso } = await exigirSesionDelHotel(hotel);
  if (!inquilino) notFound();

  // Si la mensualidad está al día esta pantalla no tiene nada que decir.
  if (acceso === 'ok') redirect(`/${hotel}/panel`);

  const m = MENSAJES[acceso];
  const Icono = m.icono;
  const plan = inquilino.suscripcion?.plan;

  return (
    <AplicaMarca
      colorAcento={inquilino.colorAcento}
      tema={inquilino.tema}
      className="flex items-center justify-center px-4 py-10"
    >
      <div className="tarjeta w-full max-w-lg p-8">
        <div className="mb-6 flex items-center gap-3">
          <LogoHotel nombre={inquilino.nombre} logoUrl={inquilino.logoUrl} tamano={40} />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold text-texto">{inquilino.nombre}</p>
            <p className="text-[11px] text-tenue">Gestión de Reservas</p>
          </div>
        </div>

        <div className="flex gap-4 rounded-md border border-borde bg-aviso-suave p-4">
          <Icono className="mt-0.5 h-6 w-6 shrink-0 text-aviso" />
          <div>
            <h1 className="text-[15px] font-semibold text-texto">{m.titulo}</h1>
            <p className="mt-1 text-[13px] leading-relaxed text-tenue">{m.texto}</p>
          </div>
        </div>

        {plan && (
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-tenue">Plan</dt>
              <dd className="font-semibold text-texto">{plan.nombre}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-tenue">Mensualidad</dt>
              <dd className="font-semibold text-texto">
                {dinero(plan.precioMensual, plan.moneda)} / mes
              </dd>
            </div>
            {inquilino.suscripcion?.pagadoHasta && (
              <div className="col-span-2">
                <dt className="text-[11px] uppercase tracking-wide text-tenue">Pagado hasta</dt>
                <dd className="font-semibold text-texto">
                  {inquilino.suscripcion.pagadoHasta.toLocaleDateString('es-EC', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    timeZone: 'UTC',
                  })}
                </dd>
              </div>
            )}
          </dl>
        )}

        <p className="mt-6 border-t border-borde pt-4 text-[12px] leading-relaxed text-tenue">
          Para regularizar el pago escribe a{' '}
          <a className="font-semibold text-acento underline underline-offset-2" href="mailto:lfgonzalezm0@grupocc.org">
            lfgonzalezm0@grupocc.org
          </a>
          .
        </p>
      </div>
    </AplicaMarca>
  );
}
