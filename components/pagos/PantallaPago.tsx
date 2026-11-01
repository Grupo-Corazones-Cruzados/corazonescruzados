'use client';

/**
 * LA PANTALLA DE PAGO — definición ÚNICA para los canales 2 y 3.
 *
 * La usan `/pagar/<token>` (cliente SIN cuenta, que llega por correo) y `/pagar/cobro`
 * (cliente CON sesión, desde su proyecto o su ticket). La diferencia entre las dos es la
 * consulta que hacen al servidor; **todo lo que ve el cliente es lo mismo**, y tiene que
 * serlo: dos pantallas de pago se separan al primer arreglo.
 *
 * «el cliente lo que hace es ingresar al enlace, en ese enlace se ve el detalle del
 * proyecto, y debe estar un botón para realizar el proceso de pago; durante el proceso de
 * pago el mismo cliente debe rellenar sus datos de facturación» (Fernando, 2026-08-25).
 *
 * Vive bajo el marco de `(sitio)` —cabecera oscura, cuerpo claro, pie oscuro— y es
 * **hermana deliberada de `/proyecto/[id]`**: quien recibe las dos por correo tiene que
 * reconocer que son de la misma casa. Por eso reusa `Contenedor` y `Tarjeta` y repite su
 * forma de listar las etapas, en vez de inventarse un lenguaje propio.
 *
 * Y hereda también su línea roja: **enseña el acuerdo, no la cocina**. Ni requerimientos,
 * ni miembros, ni costos internos.
 */

import { useEffect, useState } from 'react';
import { Check, ChevronDown, Eye } from 'lucide-react';
import { Contenedor, Tarjeta } from '@/components/sitio/piezas';
import { CargandoDetalle, ErrorEnlace } from '@/components/sitio/DetallePublico';
import FormularioPago, { type DatosPago } from '@/components/pagos/FormularioPago';
import { fmt2 } from '@/lib/format';

export default function PantallaPago({ consulta, link, sourceId, stageId, sourceType, periodo }: {
  /** El querystring con el que se le pregunta al servidor qué hay que cobrar. */
  consulta: string;
  /** Token del enlace (canal 3). Sin él, el cobro va con la sesión (canal 2). */
  link?: string;
  sourceId?: string;
  stageId?: number | null;
  sourceType?: 'project' | 'ticket' | 'subscription' | 'product';
  /** El mes que se paga, en suscripciones (`AAAA-MM`). */
  periodo?: string;
}) {
  const [datos, setDatos] = useState<DatosPago | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [verTodo, setVerTodo] = useState(false);

  useEffect(() => {
    fetch(`/api/pagos/etapa?${consulta}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setDatos(d); })
      .catch(() => setError('No se pudo cargar el pago.'))
      .finally(() => setCargando(false));
  }, [consulta]);

  if (cargando) return <Contenedor ancho="amplio" className="py-24"><CargandoDetalle /></Contenedor>;
  if (error || !datos) {
    return <Contenedor ancho="amplio" className="py-24"><ErrorEnlace mensaje={error || 'No se pudo cargar el pago.'} /></Contenedor>;
  }

  const { proyecto, etapa } = datos;
  const etapas = proyecto.etapas || [];
  const totalPlan = etapas.reduce((s: number, e: any) => s + Number(e.importe || 0), 0);
  const hayPlan = etapas.length > 0;
  const hayDetalle = (datos.detalle || []).length > 0;

  const tipo = proyecto.tipo === 'ticket' ? 'ticket' : 'proyecto';
  const larga = (proyecto.descripcion || '').length > 220;

  return (
    <Contenedor ancho="amplio" className="py-10 sm:py-16">
      {/* ⚠️ UNA SOLA COLUMNA: lo que se paga ENCIMA del formulario (Fernando, 2026-11-01: «creo que
          deberían alinearse con el diseño del formulario […] quizás no una en el lado derecho y otra
          en el lado izquierdo sino una encima y debajo de la otra»).
          Antes la izquierda era una cabecera de página (rótulo + titular de 38 px + descripción
          suelta sobre el fondo) y la derecha una tarjeta: dos lenguajes. Ahora las dos son
          tarjetas del mismo ancho y hablan igual: rótulo violeta en mayúsculas con la cifra a la
          derecha, filas separadas por líneas, y las etapas con los MISMOS nodos que el camino del
          formulario (hecha = violeta con ✓, la de ahora = borde violeta con halo, por venir =
          gris con su número). La descripción larga se recorta a tres líneas para que el
          formulario quede cerca de arriba, que es a lo que viene el cliente (2026-08-26). */}
      <div className="mx-auto w-full max-w-[720px] space-y-5">
        <Tarjeta>
          <div className="flex items-start justify-between gap-4">
            <p className="min-w-0 truncate pt-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--violeta-txt)]">
              {proyecto.cliente || 'Pago de proyecto'}
            </p>
            {datos.detalleUrl && (
              <a href={datos.detalleUrl} title={`Ver detalle del ${tipo}`}
                className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3 -mr-2 rounded-lg text-[14px] font-medium text-[var(--violeta-txt)] hover:bg-[var(--violeta-vivo)]/10 transition-colors">
                <Eye className="w-4 h-4" /> Ver detalle
              </a>
            )}
          </div>
          <h1 className="mt-2 text-[24px] sm:text-[28px] leading-[1.2] font-semibold tracking-tight text-[var(--texto)]">
            {proyecto.titulo}
          </h1>
          {proyecto.descripcion && (
            <>
              <p className={`mt-3 text-[15px] leading-relaxed text-[var(--suave)] ${larga && !verTodo ? 'line-clamp-3' : ''}`}>
                {proyecto.descripcion}
              </p>
              {larga && (
                <button type="button" onClick={() => setVerTodo(v => !v)}
                  className="mt-1.5 inline-flex items-center gap-1 text-[13.5px] font-medium text-[var(--violeta-txt)] hover:underline">
                  {verTodo ? 'Ver menos' : 'Ver más'}
                  <ChevronDown className={`w-4 h-4 transition-transform ${verTodo ? 'rotate-180' : ''}`} />
                </button>
              )}
            </>
          )}

          {/* ── El plan completo, para que sepa dónde encaja lo que paga ── */}
          {hayPlan && (
            <div className="mt-6 border-t border-[var(--linea)] pt-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--violeta-txt)]">Etapas del proyecto</p>
                <p className="text-[15px] font-semibold tabular-nums text-[var(--texto)]">${fmt2(totalPlan)}</p>
              </div>
              {/* La barra: cada etapa ocupa lo que pesa en el total. */}
              {totalPlan > 0 && (
                <div className="mt-3 flex h-2 gap-[3px]" aria-hidden>
                  {etapas.map((e: any) => (
                    <span key={e.id} style={{ flexGrow: Math.max(Number(e.importe || 0), totalPlan * 0.04) }}
                      className={`basis-0 rounded-full ${e.facturada ? 'bg-[var(--violeta)]'
                        : e.esLaQueSePaga ? 'bg-[var(--violeta-vivo)]/45 ring-1 ring-inset ring-[var(--violeta-vivo)]'
                        : 'bg-[var(--linea)]'}`} />
                  ))}
                </div>
              )}
              <ul className="mt-3 divide-y divide-[var(--linea)]">
                {etapas.map((e: any, i: number) => (
                  <li key={e.id} aria-current={e.esLaQueSePaga ? 'step' : undefined}
                    className="flex items-center justify-between gap-3 py-3">
                    <span className="min-w-0 flex items-center gap-3">
                      <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-semibold tabular-nums ${
                        e.facturada ? 'bg-[var(--violeta)] text-white'
                        : e.esLaQueSePaga ? 'border-2 border-[var(--violeta-vivo)] text-[var(--violeta-txt)] shadow-[0_0_0_4px_rgba(123,95,191,0.14)]'
                        : 'border border-[var(--linea-fuerte)] text-[var(--tenue)]'}`}>
                        {e.facturada ? <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> : i + 1}
                      </span>
                      <span className={`truncate text-[15px] text-[var(--texto)] ${e.esLaQueSePaga ? 'font-semibold' : ''}`}>{e.nombre}</span>
                    </span>
                    <span className="flex items-center gap-3 shrink-0">
                      <span className={`text-[13px] ${e.esLaQueSePaga ? 'font-medium text-[var(--violeta-txt)]' : 'text-[var(--tenue)]'}`}>
                        {e.facturada ? 'Pagada' : e.esLaQueSePaga ? 'Pagas ahora' : 'Pendiente'}
                      </span>
                      <span className={`text-[15px] tabular-nums ${e.facturada ? 'text-[var(--tenue)]' : 'text-[var(--texto)]'} ${e.esLaQueSePaga ? 'font-semibold' : ''}`}>
                        ${fmt2(Number(e.importe))}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── QUÉ SE ESTÁ PAGANDO ── (ticket, suscripción, producto: no hay plan de etapas)
              «una página que muestre el contenido de cada cosa que se vaya a pagar» (Fernando,
              2026-08-26). Nunca costos internos ni reparto del trabajo. */}
          {!hayPlan && hayDetalle && (
            <div className="mt-6 border-t border-[var(--linea)] pt-5">
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--violeta-txt)]">Qué estás pagando</p>
              <dl className="mt-2 divide-y divide-[var(--linea)]">
                {(datos.detalle || []).map((d: any) => (
                  <div key={d.etiqueta} className="flex items-start justify-between gap-4 py-3">
                    <dt className="text-[13.5px] text-[var(--tenue)] shrink-0">{d.etiqueta}</dt>
                    <dd className="text-[14.5px] text-[var(--texto)] text-right">{d.valor}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </Tarjeta>

        {/* ── El pago, por pasos ── (ya dice «Total a pagar · <etapa>»: por eso arriba no se
            repite «Estás pagando…») */}
        <Tarjeta>
          <FormularioPago
            datos={datos}
            link={link}
            sourceType={sourceType}
            sourceId={sourceId}
            stageId={stageId ?? undefined}
            periodo={periodo}
          />
        </Tarjeta>
      </div>
    </Contenedor>
  );
}
