import Link from 'next/link';
import { AlertTriangle, Clock, CheckCircle2, Gift } from 'lucide-react';
import { exigirSesionDelCliente, accesoDelContexto } from '@/lib/inquilino';
import { AplicaMarca } from '@/componentes/Marca';
import { Tarjeta, Insignia, Boton } from '@/componentes/ui';
import BotonPagar from './BotonPagar';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Suscripción' };

/**
 * LA PANTALLA DEL IMPAGO.
 *
 * Vive FUERA del grupo `(app)` a propósito, y esa es toda su razón de ser: es la única que
 * se puede ver **sin tener la mensualidad al día**. Si estuviera dentro —o si el bloqueo
 * mandara a Configuración, que exige acceso y ser administrador— un cliente bloqueado
 * rebotaría entre dos pantallas sin llegar nunca a la que le deja arreglarlo.
 *
 * Lo que se ve aquí sale de la suscripción de la PLATAFORMA cuando el cliente está
 * enlazado: es la misma que ve el equipo en el módulo de suscripciones, no una copia.
 */
export default async function PaginaSuscripcion({ params }: { params: Promise<{ cliente: string }> }) {
  const { cliente } = await params;
  const ctx = await exigirSesionDelCliente(cliente);
  const { inquilino, suscripcionGcc: sus } = ctx;
  const acceso = accesoDelContexto(ctx);
  const alDia = acceso === 'ok';

  const fecha = (d: Date | null | undefined) =>
    d ? new Date(d).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  return (
    <AplicaMarca colorAcento={inquilino.colorAcento} tema={inquilino.tema}>
      <div className="mx-auto max-w-xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="mb-1 text-[19px] font-semibold text-texto sm:text-[22px]">Suscripción</h1>
        <p className="mb-5 text-[13px] text-tenue">{inquilino.nombre}</p>

        <Tarjeta className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[15px] font-semibold text-texto">
              {inquilino.cortesia ? 'Acceso del grupo' : (sus?.titulo ?? inquilino.suscripcion?.plan.nombre ?? 'Sin plan')}
            </p>
            <Insignia
              tono={alDia ? 'exito' : acceso === 'suspendido' ? 'error' : 'aviso'}
              icono={alDia ? CheckCircle2 : AlertTriangle}
            >
              {alDia ? 'Al día' : acceso === 'suspendido' ? 'Suspendida' : acceso === 'vencido' ? 'Bloqueada' : 'Sin pagar'}
            </Insignia>
          </div>

          {inquilino.cortesia && (
            <p className="mt-3 flex items-start gap-2 rounded border border-borde bg-acento-suave px-3 py-2.5 text-[12.5px] leading-relaxed text-acento">
              <Gift className="mt-px h-4 w-4 shrink-0" /> Acceso del grupo: sin mensualidad.
            </p>
          )}

          {sus && !inquilino.cortesia && (
            <>
              <dl className="mt-4 space-y-2 border-t border-borde pt-4 text-[13px]">
                <Fila etiqueta="Mensualidad">{sus.costoMensual.toFixed(2)} {sus.moneda}</Fila>
                <Fila etiqueta="Pagado hasta">{fecha(sus.cubiertoHasta)}</Fila>
                <Fila etiqueta="Meses pendientes">
                  {sus.pendientes.length ? sus.pendientes.join(', ') : 'ninguno'}
                </Fila>
              </dl>

              {/* ⭐ EL MES DE ESPERA, DICHO CLARO Y CON FECHA. «Estás en mora» no mueve a
                  nadie; «el 1 de octubre se cierra» sí. */}
              {sus.diasDeRetraso > 0 && (
                <p
                  className={`mt-4 flex items-start gap-2 rounded border border-borde px-3 py-2.5 text-[12.5px] leading-relaxed ${
                    alDia ? 'bg-aviso-suave text-aviso' : 'bg-error-suave text-error'
                  }`}
                >
                  <Clock className="mt-px h-4 w-4 shrink-0" />
                  {alDia ? (
                    <span>
                      Llevas <strong>{sus.diasDeRetraso} días</strong> de retraso. El acceso se
                      mantiene abierto hasta el <strong>{fecha(sus.seBloqueaEl)}</strong>; después se cierra.
                    </span>
                  ) : (
                    <span>
                      El acceso está cerrado desde el <strong>{fecha(sus.seBloqueaEl)}</strong>. Se
                      reabre en cuanto se registre el pago.
                    </span>
                  )}
                </p>
              )}

              {sus.esperandoConfirmacion && (
                <p className="mt-3 flex items-start gap-2 rounded border border-borde bg-acento-suave px-3 py-2.5 text-[12.5px] leading-relaxed text-acento">
                  <Clock className="mt-px h-4 w-4 shrink-0" />
                  Ya enviaste el comprobante de {sus.esperandoConfirmacion.periodo}. Está esperando
                  que alguien de GCC lo revise.
                </p>
              )}
            </>
          )}

          {!inquilino.cortesia && sus && sus.pendientes.length > 0 && !sus.esperandoConfirmacion && (
            <p className="mt-4 rounded border border-borde bg-realce px-3 py-2.5 text-[12.5px] leading-relaxed text-tenue">
              Puedes pagar con <strong>tarjeta</strong> o por <strong>transferencia</strong>, adjuntando
              el comprobante. Si es transferencia, alguien de GCC lo revisa y el acceso se abre en
              cuanto lo confirme.
            </p>
          )}

          {/* Las acciones, abajo a la derecha. Y la de pagar SIEMPRE que haya algo que pagar,
              esté el acceso abierto o cerrado: si solo apareciera al bloquearse, el cliente
              que quiere ponerse al día antes no tendría por dónde. */}
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            {alDia && (
              <Link href={`/${cliente}/panel`}>
                <Boton variante="secundario">Volver al panel</Boton>
              </Link>
            )}
            {!inquilino.cortesia && sus && sus.pendientes.length > 0 && !sus.esperandoConfirmacion && (
              <BotonPagar
                slug={cliente}
                periodo={sus.pendientes[0]}
                importe={sus.costoMensual}
                moneda={sus.moneda}
              />
            )}
          </div>
        </Tarjeta>
      </div>
    </AplicaMarca>
  );
}

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-tenue">{etiqueta}</dt>
      <dd className="text-right font-medium text-texto">{children}</dd>
    </div>
  );
}
