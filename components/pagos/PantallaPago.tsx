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
import { CheckCircle2, Clock, Eye, Layers, Receipt } from 'lucide-react';
import { Contenedor, Tarjeta } from '@/components/sitio/piezas';
import { CargandoDetalle, EnlaceBoton, ErrorEnlace } from '@/components/sitio/DetallePublico';
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
  // Un ticket se cobra entero: no hay plan que enseñar, así que la pantalla se queda a una
  // sola columna en vez de dejar un hueco donde debería ir la lista.
  const hayPlan = etapas.length > 0;
  const hayDetalle = (datos.detalle || []).length > 0;

  return (
    <Contenedor ancho="amplio" className="py-14 sm:py-20">
      {/* ⚠️ LA REJILLA EMPIEZA ARRIBA DEL TODO, con el encabezado DENTRO de la columna
          izquierda (Fernando, 2026-08-26: «sube la parte de llenar los datos arriba, ese
          espacio está desocupado y se ve feo»).
          Antes el título ocupaba una banda a lo ancho y el formulario arrancaba debajo, así
          que al lado del título quedaba medio ancho de pantalla vacío y el cliente tenía que
          bajar para empezar a rellenar. Ahora el formulario está a la vista desde el
          principio, que es lo que ha venido a hacer. */}
      <div className={`grid gap-8 lg:gap-10 items-start ${(hayPlan || hayDetalle) ? 'lg:grid-cols-2' : 'max-w-xl mx-auto'}`}>
      <div className="min-w-0">
      {/* ── Encabezado ── */}
      <header>
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--violeta-txt)]">
          {proyecto.cliente || 'Pago de proyecto'}
        </p>
        <h1 className="mt-3 text-[30px] sm:text-[38px] leading-[1.15] font-semibold tracking-tight text-[var(--texto)]">
          {proyecto.titulo}
        </h1>
        {proyecto.descripcion && (
          <p className="mt-4 text-[16.5px] leading-relaxed text-[var(--suave)]">{proyecto.descripcion}</p>
        )}
        {/* Qué se paga, en texto con su icono: sin cápsula con relleno ni borde (regla de
            Fernando del 2026-10-29). Y a la derecha, el detalle de lo que se paga. */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="inline-flex items-center gap-2 text-[14.5px] text-[var(--texto)]">
          <Receipt className="w-4 h-4 text-[var(--violeta-txt)]" />
          {hayPlan
            ? <>Estás pagando <strong className="font-semibold">{etapa.nombre}</strong></>
            : (proyecto.tipo === 'subscription' || proyecto.tipo === 'product')
              ? <>Estás contratando <strong className="font-semibold">{etapa.nombre}</strong></>
              : <>Estás pagando este {proyecto.tipo === 'ticket' ? 'ticket' : 'trabajo'}</>}
        </p>
        {/* ⭐ VER EL DETALLE (Fernando, 2026-10-30). El servidor decide adónde: con sesión y
            siendo suyo, a su panel; si no, a la página de solo lectura con este mismo enlace. */}
        {datos.detalleUrl && (
          <EnlaceBoton href={datos.detalleUrl} icon={Eye}>
            Ver detalle del {proyecto.tipo === 'ticket' ? 'ticket' : 'proyecto'}
          </EnlaceBoton>
        )}
        </div>
      </header>

        {/* ── QUÉ SE ESTÁ PAGANDO ──
            «una página que muestre el contenido de cada cosa que se vaya a pagar» (Fernando,
            2026-08-26). Antes solo salía el título, y en un ticket o una suscripción eso deja
            al cliente pagando algo que no reconoce. Cada origen aporta los datos que ÉL
            necesita — nunca costos internos ni reparto del trabajo. */}
        {!hayPlan && hayDetalle && (
          /* Se queda a la vista mientras el cliente rellena el formulario: el panel derecho
             es mucho más largo, así que sin esto el resumen desaparece por arriba justo
             cuando conviene poder mirarlo — y deja un hueco vacío enorme en pantallas
             anchas. Solo en `lg`: en móvil las tarjetas van una debajo de otra. */
          <Tarjeta className="mt-8">
            <h2 className="flex items-center gap-2 text-[17px] font-semibold text-[var(--texto)]">
              <Receipt className="w-[18px] h-[18px] text-[var(--violeta-txt)]" /> Qué estás pagando
            </h2>
            <dl className="mt-4 divide-y divide-[var(--linea)]">
              {(datos.detalle || []).map((d: any) => (
                <div key={d.etiqueta} className="flex items-start justify-between gap-4 py-3">
                  <dt className="text-[13.5px] text-[var(--tenue)] shrink-0">{d.etiqueta}</dt>
                  <dd className="text-[14.5px] text-[var(--texto)] text-right">{d.valor}</dd>
                </div>
              ))}
            </dl>
          </Tarjeta>
        )}
        {/* ── El plan completo, para que sepa dónde encaja lo que paga ── */}
        {hayPlan && (
          <Tarjeta className="mt-8">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-[17px] font-semibold text-[var(--texto)]">
                <Layers className="w-[18px] h-[18px] text-[var(--violeta-txt)]" /> Etapas del proyecto
              </h2>
              <span className="text-[15px] font-semibold tabular-nums text-[var(--texto)]">${fmt2(totalPlan)}</span>
            </div>
            <ul className="mt-4 divide-y divide-[var(--linea)]">
              {etapas.map((e: any) => (
                <li key={e.id}
                  className={`flex items-center justify-between gap-3 py-3 ${e.esLaQueSePaga ? 'px-3 -mx-3 rounded-lg bg-[var(--violeta)]/8' : ''}`}>
                  <span className="min-w-0 flex items-center gap-2">
                    {e.facturada
                      ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                      : <Clock className="w-4 h-4 shrink-0 text-[var(--apagado)]" />}
                    <span className={`truncate text-[15px] ${e.esLaQueSePaga ? 'font-semibold text-[var(--texto)]' : 'text-[var(--texto)]'}`}>
                      {e.nombre}
                    </span>
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="text-[13px] text-[var(--tenue)]">
                      {e.facturada ? 'Pagada' : e.esLaQueSePaga ? 'Ahora' : 'Pendiente'}
                    </span>
                    <span className="text-[15px] tabular-nums text-[var(--texto)]">${fmt2(Number(e.importe))}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Tarjeta>
        )}

      </div>

        {/* ── El pago ── */}
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
