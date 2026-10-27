'use client';

/**
 * LAS TARJETAS DE ROLES — tras elegir un mundo en la portada (Fernando, 2026-10-26).
 *
 * Las opciones y su estado salen de `useOpcionesAcceso`, la MISMA lista que pinta
 * `EntryChoiceModal`. Aquí solo cambia la presentación, en DOS GRUPOS que usan el alto de la
 * pantalla (Fernando: «no aprovechas la altura de la página para mostrar las opciones»):
 *
 * · **Soy nuevo** — UNA tarjeta grande, a toda la altura: la postulación. No aparece ni
 *   desaparece mientras se comprueba si ya te postulaste: está desde el primer momento, con
 *   un brillo y la etiqueta «Comprobando…», y al llegar la respuesta cambia su contenido
 *   («Postúlate» / «En revisión» / «Aprobada» / «Ya tienes cuenta»). Antes una tarjeta
 *   «Verificando…» se iba y venía, y confundía.
 * · **Ya tengo cuenta** — candidato, cliente y miembro, apiladas, repartiéndose la altura.
 *
 * Tema del mundo: `.roles-aventura` / `.roles-progreso` (globals.css).
 */

import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useOpcionesAcceso, type AccionesAcceso, type OpcionAcceso } from '@/components/landing/opcionesAcceso';
import { PASOS_POSTULACION } from '@/components/landing/OnboardingSlidersModal';

function Tarjeta({ o, grande, retraso }: { o: OpcionAcceso; grande?: boolean; retraso: number }) {
  const Icono = o.Icono;
  return (
    <button
      type="button"
      onClick={o.cargando ? undefined : o.onClick}
      aria-disabled={o.cargando || undefined}
      aria-busy={o.cargando || undefined}
      className={`rol-tarjeta rol-${o.tono} ${grande ? 'rol-grande' : 'rol-fila'} ${o.cargando ? 'rol-comprobando' : ''} aparecer`}
      style={{ ['--retraso' as string]: `${retraso}ms` }}
    >
      {o.cargando && <span className="rol-brillo" aria-hidden="true" />}
      <span className="rol-icono"><Icono /></span>
      {/* El camino de la postulación, en la tarjeta grande: llena su altura con lo que de
          verdad viene (`span` con roles de lista: un `<ol>` no puede ir dentro de un botón;
          los mismos pasos del formulario, `PASOS_POSTULACION`). Solo cuando
          aún no te has postulado. */}
      {grande && o.tono === 'default' && (
        <span className="rol-camino" role="list" aria-label="Pasos de la postulación">
          {PASOS_POSTULACION.map((p, i) => (
            <span key={p.label} role="listitem" style={{ ['--i' as string]: i }}>
              <span className="rol-camino-num">{i + 1}</span>
              {p.label}
            </span>
          ))}
        </span>
      )}
      <span className="rol-cuerpo">
        {o.insignia && <span className="rol-insignia">{o.insignia}</span>}
        <span className="rol-titulo">{o.titulo}</span>
        <span className="rol-desc">{o.descripcion}</span>
      </span>
      <ArrowRight className="rol-flecha" aria-hidden="true" />
    </button>
  );
}

export default function RolesMundo({
  tema,
  acciones,
  retrasoBase = 0,
  onVolver,
}: {
  tema: 'aventura' | 'progreso';
  acciones: AccionesAcceso;
  /** Vuelve a la pantalla de inicio, antes de elegir mundo (Fernando, 2026-10-26: «algo
   *  discreto para poder retroceder»). */
  onVolver?: () => void;
  /** ms antes de que empiece a entrar la primera tarjeta. */
  retrasoBase?: number;
}) {
  const opciones = useOpcionesAcceso(tema === 'aventura' ? 'game' : 'dashboard', acciones);
  const nuevo = opciones.find((o) => o.grupo === 'nuevo');
  const cuenta = opciones.filter((o) => o.grupo === 'cuenta');

  return (
    <div className={`roles-mundo roles-${tema}`}>
      {onVolver && (
        <button type="button" onClick={onVolver} className="roles-volver aparecer" style={{ ['--retraso' as string]: `${retrasoBase}ms` }}>
          <ArrowLeft aria-hidden="true" />
          Volver
        </button>
      )}
      <section className="roles-grupo roles-grupo-nuevo">
        <p className="roles-grupo-titulo aparecer" style={{ ['--retraso' as string]: `${retrasoBase}ms` }}>Soy nuevo</p>
        {nuevo && <Tarjeta o={nuevo} grande retraso={retrasoBase + 80} />}
      </section>
      <section className="roles-grupo roles-grupo-cuenta">
        <p className="roles-grupo-titulo aparecer" style={{ ['--retraso' as string]: `${retrasoBase + 120}ms` }}>Ya tengo cuenta</p>
        <div className="roles-pila">
          {cuenta.map((o, i) => (
            <Tarjeta key={o.clave} o={o} retraso={retrasoBase + 200 + i * 90} />
          ))}
        </div>
      </section>
    </div>
  );
}
