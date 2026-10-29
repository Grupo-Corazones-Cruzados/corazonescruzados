'use client';

/**
 * LA CASILLA «NO SOY UN ROBOT» de los registros (Fernando, 2026-10-29) — el widget de ALTCHA.
 *
 * Al marcarla, el navegador resuelve una prueba de trabajo (~1 s) y entrega una «solución» que el
 * formulario manda en el campo `altcha`; el servidor la comprueba en `lib/registro/captcha.ts`.
 * El widget es un componente web: se carga solo en el navegador, en español de Latinoamérica.
 *
 * `onCambio(solución | null)`: la solución al verificarse; `null` si caduca o falla.
 * `reinicio`: cambiarlo vuelve a dejar la casilla sin marcar (tras un error del servidor, la
 * solución ya se gastó y hay que resolver otra).
 */

import { createElement, useEffect, useRef, useState } from 'react';

export default function Captcha({
  onCambio,
  reinicio = 0,
  tema = 'claro',
}: {
  onCambio: (solucion: string | null) => void;
  reinicio?: number;
  tema?: 'claro' | 'oscuro';
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [listo, setListo] = useState(false);
  const onCambioRef = useRef(onCambio);
  onCambioRef.current = onCambio;

  useEffect(() => {
    let vivo = true;
    Promise.all([import('altcha'), import('altcha/i18n/es-419')])
      .then(() => { if (vivo) setListo(true); })
      .catch(() => undefined);
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !listo) return;
    const alCambiar = (e: Event) => {
      const d = (e as CustomEvent<{ state: string; payload?: string }>).detail;
      onCambioRef.current(d?.state === 'verified' && d.payload ? d.payload : null);
    };
    el.addEventListener('statechange', alCambiar);
    return () => el.removeEventListener('statechange', alCambiar);
  }, [listo]);

  useEffect(() => {
    if (!reinicio) return;
    (ref.current as unknown as { reset?: () => void } | null)?.reset?.();
    onCambioRef.current(null);
  }, [reinicio]);

  return (
    <div className={`captcha-registro captcha-${tema}`}>
      {createElement('altcha-widget', {
        ref,
        challenge: '/api/registro/desafio',
        language: 'es-419',
        name: 'altcha',
        type: 'checkbox',
        // Sin el logo ni el pie «ALTCHA»: la casilla sola, con el estilo del formulario.
        configuration: JSON.stringify({ hideLogo: true, hideFooter: true }),
      })}
    </div>
  );
}
