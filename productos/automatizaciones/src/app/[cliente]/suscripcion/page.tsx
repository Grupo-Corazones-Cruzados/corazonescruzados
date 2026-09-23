import Link from 'next/link';
import { Bot, Mail, MessageCircle, AlertTriangle, CheckCircle2, Gift } from 'lucide-react';
import {
  exigirSesionDelCliente,
  evaluarProducto,
  productosAbiertos,
  PRODUCTOS,
  NOMBRE_PRODUCTO,
  type EstadoAcceso,
} from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { AplicaMarca } from '@/componentes/Marca';
import { Tarjeta, Insignia, Boton } from '@/componentes/ui';
import type { TipoAutomatizacion } from '@/generated/prisma/enums';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Suscripción' };

/**
 * LA SUSCRIPCIÓN, PRODUCTO A PRODUCTO.
 *
 * Fernando corrigió el 2026-09-23 que **lo que se vende es el tipo de flujo**, así que
 * esta pantalla ya no enseña «tu plan»: enseña **los tres productos y en qué estado está
 * cada uno**, incluidos los que no ha contratado. Enseñar lo que no tiene no es publicidad
 * metida con calzador: es la respuesta a «¿por qué no me aparece Campañas de Correo?».
 *
 * Vive FUERA del grupo `(app)` a propósito: es la única pantalla —con la de salir— que se
 * puede ver sin tener nada al día. Si estuviera dentro, el armazón la redirigiría a sí misma.
 *
 * ⚠️ AQUÍ NO HAY BOTÓN DE PAGAR, Y ES UNA DECISIÓN, NO UN OLVIDO. Fernando decidió el
 * 2026-09-23 que la compra se haga en la tienda cuando haya app, y que PayPhone quede solo
 * en la web. Mientras los precios estén por definir, esta pantalla informa y da el
 * contacto; el día que se enchufe el cobro, el botón dependerá de dónde se esté —en la web
 * el de la pasarela, en el iPhone el de la tienda— y **nunca** habrá una mención de la
 * otra vía (es causa de rechazo por la regla antidesvío de Apple).
 */

const PINTA: Record<TipoAutomatizacion, { icono: React.ComponentType<{ className?: string }>; que: string }> = {
  AGENTE_IA: { icono: Bot, que: 'Contesta WhatsApp solo, con el conocimiento de tu negocio.' },
  CORREO: { icono: Mail, que: 'Listas de contactos y envíos programados por correo.' },
  WHATSAPP: { icono: MessageCircle, que: 'Plantillas y difusión por WhatsApp a tus listas.' },
};

const PINTA_ESTADO: Record<EstadoAcceso, { tono: 'exito' | 'aviso' | 'error' | 'neutro'; texto: string }> = {
  ok: { tono: 'exito', texto: 'Al día' },
  vencido: { tono: 'aviso', texto: 'Vencida' },
  'sin-pago': { tono: 'aviso', texto: 'Sin pagar' },
  'sin-contratar': { tono: 'neutro', texto: 'No contratado' },
  suspendido: { tono: 'error', texto: 'Suspendido' },
};

export default async function PaginaSuscripcion({ params }: { params: Promise<{ cliente: string }> }) {
  const { cliente } = await params;
  const { inquilino } = await exigirSesionDelCliente(cliente);
  const abiertos = productosAbiertos(inquilino);

  const pagos = await prisma.pagoMensual.findMany({
    where: { inquilinoId: inquilino.id },
    orderBy: [{ periodo: 'desc' }],
    take: 12,
    include: { suscripcion: { select: { producto: true } } },
  });

  return (
    <AplicaMarca colorAcento={inquilino.colorAcento} tema={inquilino.tema}>
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
        <h1 className="mb-1 text-[19px] font-semibold text-texto sm:text-[22px]">Suscripción</h1>
        <p className="mb-5 text-[13px] text-tenue">{inquilino.nombre}</p>

        {inquilino.cortesia && (
          <p className="mb-3 flex items-start gap-2 rounded border border-borde bg-acento-suave px-3 py-2.5 text-[12.5px] leading-relaxed text-acento">
            <Gift className="mt-px h-4 w-4 shrink-0" />
            Acceso del grupo: los tres productos abiertos, sin mensualidad y sin topes.
          </p>
        )}

        <div className="space-y-2.5">
          {PRODUCTOS.map((producto) => {
            const estado = evaluarProducto(inquilino, producto);
            const s = inquilino.suscripciones.find((x) => x.producto === producto);
            const pinta = PINTA[producto];
            const Icono = pinta.icono;
            const e = PINTA_ESTADO[estado];

            return (
              <Tarjeta key={producto} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Icono
                      className={
                        estado === 'ok' ? 'mt-0.5 h-5 w-5 shrink-0 text-acento' : 'mt-0.5 h-5 w-5 shrink-0 text-tenue'
                      }
                    />
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-texto">{NOMBRE_PRODUCTO[producto]}</p>
                      <p className="text-[12px] leading-relaxed text-tenue">{pinta.que}</p>
                    </div>
                  </div>
                  <Insignia tono={e.tono}>
                    {estado === 'ok' ? (
                      <CheckCircle2 className="mr-1 inline h-3 w-3" />
                    ) : estado === 'sin-contratar' ? null : (
                      <AlertTriangle className="mr-1 inline h-3 w-3" />
                    )}
                    {e.texto}
                  </Insignia>
                </div>

                {!inquilino.cortesia && s && (
                  <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
                    <div className="flex items-center gap-1.5">
                      <dt className="text-tenue">Pagado hasta:</dt>
                      <dd className="font-medium text-texto">
                        {s.pagadoHasta ? s.pagadoHasta.toLocaleDateString('es-EC') : 'todavía no'}
                      </dd>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <dt className="text-tenue">Precio:</dt>
                      <dd className="font-medium text-texto">
                        {Number(s.plan.precioMensual) > 0
                          ? `${Number(s.plan.precioMensual).toFixed(2)} ${s.plan.moneda} al mes`
                          : 'por definir'}
                      </dd>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <dt className="text-tenue">Histórico:</dt>
                      <dd className="font-medium text-texto">
                        {s.plan.mesesRetencion ? `${s.plan.mesesRetencion} mes(es)` : 'todo'}
                      </dd>
                    </div>
                  </dl>
                )}

                {!inquilino.cortesia && estado !== 'ok' && (
                  <p className="mt-3 rounded border border-borde bg-realce px-3 py-2 text-[12px] leading-relaxed text-tenue">
                    {estado === 'sin-contratar'
                      ? 'No lo tienes contratado. Escríbenos a hola@grupocc.org y te lo activamos.'
                      : estado === 'suspendido'
                        ? 'Está suspendido. Escríbenos a hola@grupocc.org para reactivarlo.'
                        : 'Para volver a usarlo hay que poner la mensualidad al día. Escríbenos a hola@grupocc.org.'}
                  </p>
                )}
              </Tarjeta>
            );
          })}
        </div>

        {abiertos.length > 0 && (
          <Link href={`/${cliente}/panel`} className="mt-4 block">
            <Boton className="w-full" tamano="lg">
              Volver al panel
            </Boton>
          </Link>
        )}

        {pagos.length > 0 && (
          <>
            <h2 className="mb-2 mt-6 text-[15px] font-semibold text-texto">Pagos registrados</h2>
            <Tarjeta className="divide-y divide-borde">
              {pagos.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] text-texto">
                      {NOMBRE_PRODUCTO[p.suscripcion.producto]}
                    </p>
                    <p className="text-[11.5px] text-tenue">
                      {p.periodo} ·{' '}
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

const ETIQUETA_METODO: Record<string, string> = {
  AUTOSERVICIO: 'Registrado por GCC',
  TARJETA: 'Tarjeta',
  APP_STORE: 'App Store',
  GOOGLE_PLAY: 'Google Play',
};
