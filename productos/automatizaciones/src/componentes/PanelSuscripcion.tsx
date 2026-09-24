'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Clock, Gift, CreditCard, ExternalLink, Check, Bot, Mail, MessageCircle } from 'lucide-react';
import { Boton, Insignia, Tarjeta } from '@/componentes/ui';
import { enlaceDePago } from '@/acciones/suscripcion';

/**
 * LA SUSCRIPCIÓN, EN UN SOLO SITIO.
 *
 * ⚠️ Este componente existe porque lo necesitan DOS pantallas y no podían tener cada una
 * la suya:
 *   · `Configuración → Suscripción`, donde lo pidió Fernando y donde se mira normalmente;
 *   · `/‹cliente›/suscripcion`, que es la única que se puede ver **con el acceso cerrado**
 *     y por eso vive fuera del armazón protegido.
 *
 * Con dos copias, la del bloqueo acabaría diciendo una cosa y la de Configuración otra —y
 * la que se equivocara sería justo la que alguien mira cuando no puede entrar—. Se
 * escribe una vez y se usa dos.
 */

export type SuscripcionVista = {
  cortesia: boolean;
  /** 'ok' | 'vencido' | 'suspendido' | 'sin-pago' — lo que decide la puerta. */
  acceso: string;
  titulo: string;
  costoMensual: number;
  moneda: string;
  /** Hasta cuándo llega lo pagado, ya formateado. */
  cubiertoHasta: string | null;
  /** Cuándo se cierra el acceso si no paga, ya formateado. */
  seBloqueaEl: string | null;
  diasDeRetraso: number;
  pendientes: string[];
  esperandoConfirmacion: { periodo: string } | null;
  maxUsuarios: number | null;
  mesesRetencion: number | null;
};

/**
 * «2026-09» es como lo guarda la plataforma, no como lo dice una persona. Al cliente se le
 * escribe «septiembre de 2026», que es lo que él llama su mensualidad.
 */
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
               'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function mesLargo(periodo: string) {
  const [a, m] = periodo.split('-').map(Number);
  return MESES[m - 1] ? `${MESES[m - 1]} de ${a}` : periodo;
}

const INCLUYE = [
  { icono: Bot, que: 'Agente de IA que contesta tu WhatsApp con el conocimiento de tu negocio.' },
  { icono: Mail, que: 'Campañas de correo: listas de contactos y envíos programados.' },
  { icono: MessageCircle, que: 'Campañas de WhatsApp: plantillas y difusión a tus listas.' },
];

export default function PanelSuscripcion({
  slug,
  s,
  volverAlPanel = false,
}: {
  slug: string;
  s: SuscripcionVista;
  /** La pantalla de bloqueo ofrece volver; la pestaña de Configuración ya está dentro. */
  volverAlPanel?: boolean;
}) {
  const [enCurso, arranca] = useTransition();
  const alDia = s.acceso === 'ok';
  const hayQuePagar = !s.cortesia && s.pendientes.length > 0 && !s.esperandoConfirmacion;

  return (
    <Tarjeta className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-texto">
            {s.cortesia ? 'Acceso del grupo' : s.titulo}
          </p>
          {!s.cortesia && (
            <p className="text-[13px] text-tenue">
              {s.costoMensual > 0 ? `${s.costoMensual.toFixed(2)} ${s.moneda} al mes` : 'Precio por definir'}
            </p>
          )}
        </div>
        <Insignia
          tono={alDia ? 'exito' : s.acceso === 'suspendido' ? 'error' : 'aviso'}
          icono={alDia ? CheckCircle2 : AlertTriangle}
        >
          {alDia ? 'Al día' : s.acceso === 'suspendido' ? 'Suspendida' : s.acceso === 'vencido' ? 'Bloqueada' : 'Sin pagar'}
        </Insignia>
      </div>

      {s.cortesia && (
        <p className="mt-3 flex items-start gap-2 rounded border border-borde bg-acento-suave px-3 py-2.5 text-[12.5px] leading-relaxed text-acento">
          <Gift className="mt-px h-4 w-4 shrink-0" /> Acceso del grupo: sin mensualidad y sin topes.
        </p>
      )}

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

      {!s.cortesia && (
        <dl className="mt-4 space-y-2 border-t border-borde pt-4 text-[13px]">
          <Fila etiqueta="Pagado hasta">{s.cubiertoHasta ?? 'Todavía no se ha pagado'}</Fila>
          <Fila etiqueta="Meses pendientes">
            {s.pendientes.length ? s.pendientes.map(mesLargo).join(', ') : 'ninguno'}
          </Fila>
          <Fila etiqueta="Cuentas incluidas">{s.maxUsuarios ?? 'Sin límite'}</Fila>
          <Fila etiqueta="Histórico que se conserva">
            {s.mesesRetencion ? `${s.mesesRetencion} mes(es)` : 'Todo'}
          </Fila>
        </dl>
      )}

      {/* ⭐ EL MES DE ESPERA, CON FECHA. «Estás en mora» no mueve a nadie; «el 1 de octubre
          se cierra» sí. Y cuando ya está cerrado, se dice que se reabre al pagar, que es
          la única pregunta que tiene quien no puede entrar. */}
      {!s.cortesia && s.diasDeRetraso > 0 && (
        <p
          className={`mt-4 flex items-start gap-2 rounded border border-borde px-3 py-2.5 text-[12.5px] leading-relaxed ${
            alDia ? 'bg-aviso-suave text-aviso' : 'bg-error-suave text-error'
          }`}
        >
          <Clock className="mt-px h-4 w-4 shrink-0" />
          {alDia ? (
            <span>
              Llevas <strong>{s.diasDeRetraso} días</strong> de retraso. El acceso sigue abierto hasta
              el <strong>{s.seBloqueaEl}</strong>; después se cierra.
            </span>
          ) : (
            <span>
              El acceso se cerró el <strong>{s.seBloqueaEl}</strong>. Se reabre en cuanto se registre
              el pago.
            </span>
          )}
        </p>
      )}

      {s.esperandoConfirmacion && (
        <p className="mt-3 flex items-start gap-2 rounded border border-borde bg-acento-suave px-3 py-2.5 text-[12.5px] leading-relaxed text-acento">
          <Clock className="mt-px h-4 w-4 shrink-0" />
          Ya enviaste el comprobante de <strong>{mesLargo(s.esperandoConfirmacion.periodo)}</strong>. Está
          esperando que alguien de GCC lo revise; el acceso se abre en cuanto lo confirme.
        </p>
      )}

      {hayQuePagar && (
        <p className="mt-4 rounded border border-borde bg-realce px-3 py-2.5 text-[12.5px] leading-relaxed text-tenue">
          Puedes pagar con <strong>tarjeta</strong> o por <strong>transferencia</strong>, adjuntando el
          comprobante. Si es transferencia, alguien de GCC lo revisa y el acceso se abre en cuanto lo
          confirme.
        </p>
      )}

      {/* Las acciones, abajo a la derecha. */}
      {(hayQuePagar || volverAlPanel) && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {volverAlPanel && alDia && (
            <Link href={`/${slug}/panel`}>
              <Boton variante="secundario">Volver al panel</Boton>
            </Link>
          )}
          {hayQuePagar && (
            <Boton
              tamano="lg"
              disabled={enCurso}
              onClick={() =>
                arranca(async () => {
                  const r = await enlaceDePago(slug);
                  if (!r.ok) { toast.error(r.error); return; }
                  // Misma pestaña a propósito: es un pago, y una pestaña nueva es una
                  // pestaña que se pierde de vista a media transferencia.
                  window.location.href = r.url;
                })
              }
            >
              <CreditCard className="h-4 w-4" />
              {enCurso ? 'Abriendo el pago…' : `Pagar ${mesLargo(s.pendientes[0])} · ${s.costoMensual.toFixed(2)} ${s.moneda}`}
              <ExternalLink className="h-3.5 w-3.5" />
            </Boton>
          )}
        </div>
      )}
    </Tarjeta>
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
