'use client';

/**
 * LAS TARJETAS DE ROLES — tras elegir un mundo en la portada (Fernando, 2026-10-26).
 *
 * Con el MISMO estilo que las tarjetas de Aventura y Progreso (la antigua `TarjetasMundo`, hoy borrada: Fernando, «que el
 * estilo de las tarjetas y contenido sea similar»): reutilizan sus clases (`.tarjeta-mundo-*`,
 * `.tm-*`) —etiqueta arriba, escenario con el icono, título, descripción, destello y el SELECTOR
 * de esquinas al pasar— y el color del mundo elegido. Cuatro en fila desde `lg`; 2×2 por debajo,
 * con la descripción corta en el teléfono.
 *
 * Las opciones y su estado salen de `useOpcionesAcceso` (la MISMA lista que `EntryChoiceModal`).
 * Están desde el primer momento: mientras se consulta el estado, la tarjeta ya está con un brillo
 * y «Comprobando…», y al llegar la respuesta cambia su contenido, no su sitio.
 */

import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useOpcionesAcceso, type AccionesAcceso, type OpcionAcceso } from '@/components/landing/opcionesAcceso';
import { sonarPasar, sonarTarjeta, sonarVolver } from '@/lib/sitio/sonidoSeleccion';

function Tarjeta({
  o,
  tema,
  retraso,
  estado,
  onElegir,
}: {
  o: OpcionAcceso;
  tema: 'aventura' | 'progreso';
  retraso: number;
  estado: '' | 'elegida' | 'descartada';
  onElegir: () => void;
}) {
  const Icono = o.Icono;
  /**
   * La entrada (`.aparecer`) se quita en cuanto termina, o en cuanto la tarjeta se elige (Fernando,
   * 2026-10-29: al abrir el formulario las tarjetas desaparecían y volvían a los segundos). Al
   * elegir, `.rol-elegida`/`.rol-descartada` cambian la `animation`; al quitarlas, la de entrada
   * EMPEZABA DE NUEVO con su retraso de 3,4 s y su relleno `both` la dejaba invisible todo ese rato.
   */
  const [entro, setEntro] = useState(false);
  useEffect(() => {
    if (estado) setEntro(true);
  }, [estado]);
  return (
    <button
      type="button"
      onClick={o.cargando ? undefined : onElegir}
      // El «tic» al pasar el puntero (Fernando, 2026-10-29). Solo con ratón: en táctil el
      // `pointerenter` llega al tocar y se sumaría al sonido de elegir.
      onPointerEnter={(e) => { if (e.pointerType === 'mouse' && !o.cargando && !estado) sonarPasar(); }}
      aria-disabled={o.cargando || undefined}
      aria-busy={o.cargando || undefined}
      aria-label={`${o.titulo}: ${o.descripcion}`}
      className={`tarjeta-mundo tarjeta-mundo-${tema} tarjeta-rol rol-${o.tono} ${o.cargando ? 'rol-comprobando' : ''} ${estado ? `rol-${estado}` : ''} ${entro || estado ? '' : 'aparecer'}`}
      style={{ ['--retraso' as string]: `${retraso}ms` }}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && e.animationName.startsWith('aparecer')) setEntro(true);
      }}
    >
      <span className="tm-destello" aria-hidden="true" />
      {estado === 'elegida' && <span className="rol-onda" aria-hidden="true" />}
      <span className="tm-selector" aria-hidden="true">
        <span /><span /><span /><span />
      </span>
      {o.cargando && <span className="rol-brillo" aria-hidden="true" />}
      {/* Sin «Soy nuevo» / «Ya tengo cuenta» (Fernando, 2026-10-28). Solo el ESTADO, cuando lo
          hay, como etiqueta dentro de la escena: no ocupa alto, así la tarjeta no cambia. */}
      <span className={`tm-icono tr-escena tr-escena-${tema}`} aria-hidden="true">
        {o.insignia && <span className="tr-estado">{o.insignia}</span>}
        <span className="tr-halo" />
        <span className="tr-icono"><Icono /></span>
      </span>
      <span className="tr-texto">
      <span className="tm-titulo tr-titulo">{o.titulo}</span>
      <span className="tm-descripcion tm-descripcion-larga">{o.descripcion}</span>
      <span className="tm-descripcion tm-descripcion-corta" aria-hidden="true">{o.corta ?? o.descripcion}</span>
      </span>
      <ArrowRight className="tr-flecha" aria-hidden="true" />
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
  /** ms antes de que empiece a entrar la primera tarjeta. */
  retrasoBase?: number;
  /** Vuelve a la pantalla de inicio, antes de elegir mundo. */
  onVolver?: () => void;
}) {
  const opciones = useOpcionesAcceso(tema === 'aventura' ? 'game' : 'dashboard', acciones);

  /**
   * AL ELEGIR UN ROL (Fernando, 2026-10-28: «una animación para cuando se selecciona»): la
   * tarjeta elegida da un pulso con una onda de luz y las demás se apagan; ~450 ms después se
   * abre su ventana. Al cerrarse la ventana las tarjetas vuelven solas a su estado.
   */
  const [elegida, setElegida] = useState<string | null>(null);
  useEffect(() => {
    if (!elegida) return;
    const id = window.setTimeout(() => setElegida(null), 1200);
    return () => window.clearTimeout(id);
  }, [elegida]);
  const elegir = (o: OpcionAcceso) => {
    if (elegida) return;
    // El sonido de elegir una tarjeta (Fernando, 2026-10-29), dentro del clic (iOS).
    sonarTarjeta();
    setElegida(o.clave);
    window.setTimeout(o.onClick, 450);
  };

  return (
    <div className={`roles-mundo roles-${tema}`}>
      {onVolver && (
        <button type="button" onClick={() => { sonarVolver(); onVolver(); }} className="roles-volver aparecer" style={{ ['--retraso' as string]: `${retrasoBase}ms` }}>
          <ArrowLeft aria-hidden="true" />
          Volver
        </button>
      )}
      <div className="roles-fila" data-n={opciones.length} style={{ ['--n' as string]: opciones.length }}>
        {opciones.map((o, i) => (
          <Tarjeta
            key={o.clave}
            o={o}
            tema={tema}
            retraso={retrasoBase + 80 + i * 90}
            estado={!elegida ? '' : elegida === o.clave ? 'elegida' : 'descartada'}
            onElegir={() => elegir(o)}
          />
        ))}
      </div>
    </div>
  );
}
