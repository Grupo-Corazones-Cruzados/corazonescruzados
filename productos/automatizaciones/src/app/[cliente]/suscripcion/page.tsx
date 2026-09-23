import Link from 'next/link';
import { Bot, Mail, MessageCircle, AlertTriangle, CheckCircle2, Gift, Check } from 'lucide-react';
import { exigirSesionDelCliente, evaluarAcceso } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { AplicaMarca } from '@/componentes/Marca';
import { Tarjeta, Insignia, Boton } from '@/componentes/ui';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Suscripción' };

/**
 * LA SUSCRIPCIÓN.
 *
 * Fernando fijó el precio el 2026-09-23: **5 $/mes con las tres cosas dentro** —*«no lo
 * trataremos cada cosa con un costo diferente, sino que el producto total vale $5
 * mensuales»*—. Así que esta pantalla enseña **un** plan y, debajo, **qué incluye**: las
 * tres capacidades listadas. Listarlas no es adorno; es lo que convierte «5 $» en «5 $ por
 * esto».
 *
 * Vive FUERA del grupo `(app)` a propósito: es la única pantalla —con la de salir— que se
 * puede ver con la mensualidad vencida. Si estuviera dentro, el armazón la redirigiría a
 * sí misma.
 *
 * ⚠️ AQUÍ NO HAY BOTÓN DE PAGAR, Y ES UNA DECISIÓN, NO UN OLVIDO. Fernando decidió el
 * 2026-09-23 que la compra se haga en la tienda cuando haya app, y que PayPhone quede solo
 * en la web. El día que se enchufe el cobro, el botón dependerá de dónde se esté —en la
 * web el de la pasarela, en el iPhone el de la tienda— y **nunca** habrá una mención de la
 * otra vía (es causa de rechazo por la regla antidesvío de Apple).
 */

const INCLUYE = [
  { icono: Bot, que: 'Agente de IA que contesta WhatsApp solo, con el conocimiento de tu negocio.' },
  { icono: Mail, que: 'Campañas de correo: listas de contactos y envíos programados.' },
  { icono: MessageCircle, que: 'Campañas de WhatsApp: plantillas y difusión a tus listas.' },
];

const ETIQUETA_METODO: Record<string, string> = {
  AUTOSERVICIO: 'Registrado por GCC',
  TARJETA: 'Tarjeta',
  APP_STORE: 'App Store',
  GOOGLE_PLAY: 'Google Play',
};

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
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-texto">
                {inquilino.cortesia ? 'Acceso del grupo' : (s?.plan.nombre ?? 'Sin plan')}
              </p>
              {!inquilino.cortesia && s && (
                <p className="text-[13px] text-tenue">
                  {Number(s.plan.precioMensual) > 0
                    ? `${Number(s.plan.precioMensual).toFixed(2)} ${s.plan.moneda} al mes`
                    : 'Precio por definir'}
                </p>
              )}
            </div>
            {acceso === 'ok' ? (
              <Insignia tono="exito">
                <CheckCircle2 className="mr-1 inline h-3 w-3" />
                Al día
              </Insignia>
            ) : (
              <Insignia tono={acceso === 'suspendido' ? 'error' : 'aviso'}>
                <AlertTriangle className="mr-1 inline h-3 w-3" />
                {acceso === 'suspendido' ? 'Suspendida' : acceso === 'vencido' ? 'Vencida' : 'Sin pagar'}
              </Insignia>
            )}
          </div>

          {inquilino.cortesia && (
            <p className="mt-3 flex items-start gap-2 rounded border border-borde bg-acento-suave px-3 py-2.5 text-[12.5px] leading-relaxed text-acento">
              <Gift className="mt-px h-4 w-4 shrink-0" />
              Todo abierto, sin mensualidad y sin topes.
            </p>
          )}

          {/* QUÉ INCLUYE. Son tres cosas distintas aunque se paguen juntas, y quien lee
              «5 $» necesita saber por qué. */}
          <ul className="mt-4 space-y-2 border-t border-borde pt-4">
            {INCLUYE.map(({ icono: Icono, que }) => (
              <li key={que} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-texto">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-exito-suave">
                  <Check className="h-3 w-3 text-exito" />
                </span>
                <Icono className="mt-0.5 h-4 w-4 shrink-0 text-tenue" />
                <span>{que}</span>
              </li>
            ))}
          </ul>

          {!inquilino.cortesia && (
            <dl className="mt-4 space-y-2 border-t border-borde pt-4 text-[13px]">
              <Fila etiqueta="Pagado hasta">
                {s?.pagadoHasta ? s.pagadoHasta.toLocaleDateString('es-EC') : 'Todavía no se ha pagado'}
              </Fila>
              <Fila etiqueta="Cuentas incluidas">{s?.plan.maxUsuarios ?? 'Sin límite'}</Fila>
              <Fila etiqueta="Histórico que se conserva">
                {s?.plan.mesesRetencion ? `${s.plan.mesesRetencion} mes(es)` : 'Todo'}
              </Fila>
            </dl>
          )}

          {acceso !== 'ok' && (
            <p className="mt-4 rounded border border-borde bg-aviso-suave px-3 py-2.5 text-[12.5px] leading-relaxed text-aviso">
              {acceso === 'suspendido'
                ? 'El acceso está suspendido. Escríbenos a hola@grupocc.org para reactivarlo.'
                : 'Para volver a entrar hay que poner la mensualidad al día. Escríbenos a hola@grupocc.org y te decimos cómo.'}
            </p>
          )}

          {acceso === 'ok' && (
            <Link href={`/${cliente}/panel`} className="mt-4 block">
              <Boton className="w-full" tamano="lg">
                Volver al panel
              </Boton>
            </Link>
          )}
        </Tarjeta>

        {pagos.length > 0 && (
          <>
            <h2 className="mb-2 mt-6 text-[15px] font-semibold text-texto">Pagos registrados</h2>
            <Tarjeta className="divide-y divide-borde">
              {pagos.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[13.5px] text-texto">{p.periodo}</p>
                    <p className="truncate text-[11.5px] text-tenue">
                      {p.pagadoEn ? p.pagadoEn.toLocaleDateString('es-EC') : 'sin fecha'} ·{' '}
                      {ETIQUETA_METODO[p.metodo] ?? p.metodo}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[13.5px] tabular-nums text-texto">
                      {Number(p.monto).toFixed(2)} {p.moneda}
                    </p>
                    <Insignia
                      tono={p.estado === 'PAGADO' ? 'exito' : p.estado === 'FALLIDO' ? 'error' : 'neutro'}
                    >
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

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-tenue">{etiqueta}</dt>
      <dd className="text-right font-medium text-texto">{children}</dd>
    </div>
  );
}
