import Link from 'next/link';
import { CreditCard, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { exigirSesionDelCliente, evaluarAcceso } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { AplicaMarca } from '@/componentes/Marca';
import { Tarjeta, Insignia, Boton } from '@/componentes/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Suscripción' };

/**
 * LA PANTALLA DE LA SUSCRIPCIÓN (Fernando, 2026-09-23: «y pueda gestionar su
 * suscripción allí también»).
 *
 * Vive FUERA del grupo `(app)` a propósito: es la única pantalla —con la de salir— que
 * se puede ver con la mensualidad vencida. Si estuviera dentro, el armazón la
 * redirigiría a sí misma.
 *
 * ⚠️ AQUÍ NO HAY BOTÓN DE PAGAR, Y ES UNA DECISIÓN, NO UN OLVIDO. Fernando decidió el
 * 2026-09-23 que la compra se haga en la tienda cuando haya app, y que PayPhone quede
 * solo en la web. Mientras el precio esté por definir, esta pantalla informa y da el
 * contacto; el día que se enchufe el cobro, el botón que aparezca dependerá de dónde
 * se esté: en la web el de la pasarela, en el iPhone el de la tienda y NUNCA una
 * mención de la otra vía (es causa de rechazo por la regla antidesvío de Apple).
 */
export default async function PaginaSuscripcion({ params }: { params: Promise<{ cliente: string }> }) {
  const { cliente } = await params;
  const { inquilino } = await exigirSesionDelCliente(cliente);
  const acceso = evaluarAcceso(inquilino);
  const s = inquilino.suscripcion;

  const pagos = await prisma.pagoMensual.findMany({
    where: { inquilinoId: inquilino.id },
    orderBy: { periodo: 'desc' },
    take: 12,
  });

  return (
    <AplicaMarca colorAcento={inquilino.colorAcento} tema={inquilino.tema}>
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="mb-1 text-[19px] font-semibold text-texto sm:text-[22px]">Suscripción</h1>
        <p className="mb-5 text-[13px] text-tenue">{inquilino.nombre}</p>

        <Tarjeta className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-acento" />
              <span className="text-[14px] font-medium text-texto">
                {inquilino.cortesia ? 'Acceso del grupo' : (s?.plan.nombre ?? 'Sin plan')}
              </span>
            </div>
            {acceso === 'ok' ? (
              <Insignia tono="exito">
                <CheckCircle2 className="mr-1 inline h-3 w-3" />
                Al día
              </Insignia>
            ) : (
              <Insignia tono={acceso === 'suspendido' ? 'error' : 'aviso'}>
                <AlertTriangle className="mr-1 inline h-3 w-3" />
                {acceso === 'suspendido' ? 'Suspendida' : acceso === 'vencido' ? 'Vencida' : 'Sin pago'}
              </Insignia>
            )}
          </div>

          <dl className="mt-4 space-y-2 text-[13px]">
            {!inquilino.cortesia && (
              <>
                <Fila etiqueta="Pagado hasta">
                  {s?.pagadoHasta ? s.pagadoHasta.toLocaleDateString('es-EC') : 'Todavía no se ha pagado'}
                </Fila>
                <Fila etiqueta="Precio">
                  {s && Number(s.plan.precioMensual) > 0
                    ? `${Number(s.plan.precioMensual).toFixed(2)} ${s.plan.moneda} al mes`
                    : 'Por definir'}
                </Fila>
              </>
            )}
            <Fila etiqueta="Cuentas incluidas">
              {inquilino.cortesia ? 'Sin límite' : (s?.plan.maxUsuarios ?? 'Sin límite')}
            </Fila>
            <Fila etiqueta="Histórico que se conserva">
              {inquilino.cortesia
                ? 'Todo'
                : s?.plan.mesesRetencion
                  ? `${s.plan.mesesRetencion} mes(es)`
                  : 'Todo'}
            </Fila>
          </dl>

          {acceso !== 'ok' && (
            <p className="mt-4 rounded border border-borde bg-aviso-suave px-3 py-2.5 text-[12.5px] leading-relaxed text-aviso">
              {acceso === 'suspendido'
                ? 'El acceso está suspendido. Escríbenos a hola@grupocc.org para reactivarlo.'
                : 'Para volver a entrar hay que poner la mensualidad al día. Escríbenos a hola@grupocc.org y te decimos cómo.'}
            </p>
          )}

          {acceso === 'ok' && (
            <Link href={`/${cliente}/panel`} className="mt-4 block">
              <Boton className="w-full" tamano="lg">Volver al panel</Boton>
            </Link>
          )}
        </Tarjeta>

        {pagos.length > 0 && (
          <>
            <h2 className="mb-2 mt-6 text-[15px] font-semibold text-texto">Pagos registrados</h2>
            <Tarjeta className="divide-y divide-borde">
              {pagos.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div>
                    <p className="text-[13.5px] text-texto">{p.periodo}</p>
                    <p className="text-[11.5px] text-tenue">
                      {p.pagadoEn ? p.pagadoEn.toLocaleDateString('es-EC') : 'Sin fecha'} ·{' '}
                      {ETIQUETA_METODO[p.metodo] ?? p.metodo}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[13.5px] tabular-nums text-texto">
                      {Number(p.monto).toFixed(2)} {p.moneda}
                    </p>
                    <Insignia tono={p.estado === 'PAGADO' ? 'exito' : p.estado === 'FALLIDO' ? 'error' : 'neutro'}>
                      {p.estado === 'PAGADO' ? 'Pagado' : p.estado === 'FALLIDO' ? 'Fallido' : 'Pendiente'}
                    </Insignia>
                  </div>
                </div>
              ))}
            </Tarjeta>
          </>
        )}
      </div>
    </AplicaMarca>
  );
}

const ETIQUETA_METODO: Record<string, string> = {
  AUTOSERVICIO: 'Registrado por GCC',
  TARJETA: 'Tarjeta',
  APP_STORE: 'App Store',
  GOOGLE_PLAY: 'Google Play',
};

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-tenue">{etiqueta}</dt>
      <dd className="text-right font-medium text-texto">{children}</dd>
    </div>
  );
}
