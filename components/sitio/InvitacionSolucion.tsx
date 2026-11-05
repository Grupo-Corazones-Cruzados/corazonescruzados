'use client';

/**
 * LA INVITACIÓN A LA PÁGINA DE UNA SOLUCIÓN (Fernando, 2026-11-05: «un botón flotando en la parte
 * central inferior, como si fuese una invitación»). Sale al elegir una solución en el filtro de
 * Clientes ▸ Soluciones y lleva a `/clientes/soluciones/<slug>` solo si el usuario quiere; la «×»
 * la retira hasta que elija otra.
 *
 * Portal al `body`: `.tema-contenido` entra con una animación, y un `fixed` dentro de un elemento
 * animado se coloca respecto a él, no a la pantalla. Al salir sigue montada con su último contenido
 * hasta terminar la transición.
 */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ArrowRight, X } from 'lucide-react';

type Solucion = { nombre: string; slug: string };

const SALIDA_MS = 240;

export default function InvitacionSolucion({ solucion }: { solucion: Solucion | null }) {
  const [cerrada, setCerrada] = useState<string | null>(null);
  const [mostrada, setMostrada] = useState<Solucion | null>(null);
  const [visible, setVisible] = useState(false);

  const activa = solucion && solucion.slug !== cerrada ? solucion : null;
  const slug = activa?.slug ?? null;

  useEffect(() => {
    if (activa) {
      setMostrada(activa);
      // Un cuadro después: el navegador tiene que ver el «antes» para animar la entrada.
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return () => cancelAnimationFrame(r);
    }
    setVisible(false);
    const t = setTimeout(() => setMostrada(null), SALIDA_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => { if (!solucion) setCerrada(null); }, [solucion]);

  if (!mostrada) return null;
  return (
    <>
      <div className="invitacion-hueco" aria-hidden />
      {createPortal(
        <div className={`invitacion${visible ? ' es-visible' : ''}`}>
          <div className="invitacion-flota">
            <span className="invitacion-halo" aria-hidden />
            <Link href={`/clientes/soluciones/${mostrada.slug}`} className="invitacion-enlace"
              aria-label={`Conocer la solución ${mostrada.nombre}`}>
              <PuertaEntreabierta />
              <span className="invitacion-texto">
                <span className="invitacion-rotulo">Te invitamos a conocer</span>
                <span className="invitacion-nombre">{mostrada.nombre}</span>
              </span>
              <span className="invitacion-ir" aria-hidden><ArrowRight /></span>
            </Link>
            <button type="button" className="invitacion-cerrar" aria-label="Quitar la invitación"
              onClick={() => setCerrada(mostrada.slug)}>
              <X aria-hidden />
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/** Una puerta entreabierta con la luz saliendo: al pasar el puntero se abre un poco más. */
function PuertaEntreabierta() {
  return (
    <svg className="invitacion-puerta" viewBox="0 0 52 52" fill="none" aria-hidden>
      <circle cx="26" cy="26" r="26" fill="#fff" fillOpacity="0.12" />
      <path d="M32 13 45 8v36l-13-5Z" fill="url(#invitacion-luz)" />
      <rect x="16" y="11" width="16" height="30" rx="2" fill="#fde68a" />
      <rect className="invitacion-hoja" x="16" y="11" width="13" height="30" rx="1.5" fill="#fff" />
      <circle cx="26" cy="27" r="1.3" fill="#7c3aed" />
      <path d="M12 41h24" stroke="#fff" strokeOpacity="0.75" strokeWidth="2" strokeLinecap="round" />
      <path className="invitacion-chispa" d="m39 12 .9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9Z" fill="#fff" />
      <path className="invitacion-chispa" d="m42 25 .7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z" fill="#fde68a" />
      <path className="invitacion-chispa" d="m37 33 .6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6Z" fill="#fff" />
      <defs>
        <linearGradient id="invitacion-luz" x1="32" y1="26" x2="46" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fde68a" stopOpacity="0.85" />
          <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
