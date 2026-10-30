'use client';

import { useEffect, useState } from 'react';
import { TEMAS, TEMA_POR_DEFECTO, definicionTema, type TemaId } from '@/lib/temas';
import { LLAVE_ULTIMO_TEMA } from '@/components/providers/TemaPanel';

/**
 * ⭐ LA PANTALLA DE CARGA DEL PANEL (Fernando, 2026-10-30: «actualizar esta pantalla de carga a un
 * estilo más de /dashboard y que cambie según el tema […] que su diseño sea nuevo e interesante»).
 *
 * Antes era un anillo y «CARGANDO...» en letra pixel sobre negro, FUERA del tema: se ve mientras se
 * comprueba la sesión, antes de saber quién entra, así que no había tema que leer.
 *
 * Ahora es la SILUETA DEL PROPIO PANEL —raíl, saludo, cifras, filtros y tabla— hecha de bloques que
 * se iluminan en ola (`.carga-bloque`, `app/movimiento.css`), con una barra fina en el degradado del
 * tema arriba. Lo que va a aparecer ya está dibujado donde va a aparecer: al entrar el panel, nada
 * salta de sitio.
 *
 * ── EL TEMA ANTES DE LA SESIÓN ─────────────────────────────────────────────────────────────
 * La preferencia es por cuenta (`gcc_dash_theme:<id>`) y aquí aún no hay cuenta. `TemaPanel`
 * guarda además el ÚLTIMO tema usado en este equipo (`LLAVE_ULTIMO_TEMA`), y un `<script>` en
 * línea lo aplica mientras el navegador lee el HTML: sin él, el servidor pinta el tema claro y
 * quien usa el negro vería un fogonazo blanco. Después, el estado de React coge el mismo valor.
 */

const OSCUROS = TEMAS.filter((t) => t.base === 'oscuro').map((t) => t.id);
const IDS = TEMAS.map((t) => t.id);

function leerUltimo(): TemaId {
  try {
    const v = localStorage.getItem(LLAVE_ULTIMO_TEMA) ?? localStorage.getItem('gcc_dash_theme');
    if (v === 'dark') return 'oscuro';
    if (v === 'light') return 'claro';
    return definicionTema(v)?.id ?? TEMA_POR_DEFECTO;
  } catch {
    return TEMA_POR_DEFECTO;
  }
}

// Lo mismo que `leerUltimo`, para el `<script>` en línea (corre antes que React).
const SCRIPT_TEMA = `(function(){try{var e=document.currentScript.parentElement,t=localStorage.getItem(${JSON.stringify(LLAVE_ULTIMO_TEMA)})||localStorage.getItem('gcc_dash_theme')||'';if(t==='dark')t='oscuro';if(t==='light')t='claro';if(${JSON.stringify(IDS)}.indexOf(t)<0)t=${JSON.stringify(TEMA_POR_DEFECTO)};e.classList.remove('tema-${TEMA_POR_DEFECTO}');e.classList.add('tema-'+t);if(${JSON.stringify(OSCUROS)}.indexOf(t)>=0)e.classList.add('dark');}catch(_){}})();`;

/** Un bloque que se ilumina. `i` escalona la ola: cada bloque brilla un poco después del anterior. */
function B({ className = '', i = 0 }: { className?: string; i?: number }) {
  return <span aria-hidden className={`carga-bloque block ${className}`} style={{ '--i': i } as React.CSSProperties} />;
}

export default function CargaPanel() {
  const [tema, setTema] = useState<TemaId>(TEMA_POR_DEFECTO);
  useEffect(() => { setTema(leerUltimo()); }, []);
  const oscuro = OSCUROS.includes(tema);

  return (
    <div
      className={`corp tema-progreso tema-${tema} ${oscuro ? 'dark' : ''} carga-panel relative flex min-h-screen overflow-hidden`}
      role="status" aria-live="polite" aria-label="Cargando el panel"
      // El `<script>` de abajo cambia las clases antes de hidratar: React no debe «corregirlas».
      suppressHydrationWarning
    >
      <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />

      {/* La barra de arriba: un tramo del degradado del tema que recorre el ancho sin parar. */}
      <span aria-hidden className="carga-barra absolute top-0 inset-x-0 h-[3px] z-10" />

      {/* La cápsula de abajo: dice qué pasa, con un anillo en el acento y el texto del panel. */}
      <div className="carga-tarjeta carga-capsula fixed left-1/2 -translate-x-1/2 bottom-[calc(1.5rem+var(--seguro-abajo))] lg:ml-8 z-10 inline-flex items-center gap-2.5 pl-3 pr-4 py-2.5 shadow-lg whitespace-nowrap">
        <span aria-hidden className="w-4 h-4 rounded-full border-2 border-digi-border border-t-accent animate-spin motion-reduce:animate-none" style={{ animationDuration: '0.8s' }} />
        <span className="text-[13px] font-medium text-digi-text" style={{ fontFamily: 'var(--font-body)' }}>
          Preparando tu panel<span aria-hidden className="carga-puntos ml-px" />
        </span>
      </div>

      {/* El raíl (escritorio): con los colores de raíl de cada tema (`.rail`). */}
      <aside className="rail hidden lg:flex fixed inset-y-0 left-0 w-16 flex-col items-center gap-3 py-4 bg-digi-card border-r border-digi-border">
        <B className="w-9 h-9 rounded-xl mb-3" />
        {Array.from({ length: 8 }, (_, k) => <B key={k} i={k} className="w-8 h-8 rounded-lg" />)}
        <span className="flex-1" />
        <B className="w-8 h-8 rounded-full" i={9} />
      </aside>

      <div className="flex-1 min-w-0 lg:ml-16 flex flex-col">
        {/* La cabecera del teléfono. */}
        <header className="rail lg:hidden shrink-0 h-[calc(3.5rem+var(--seguro-arriba))] pt-[var(--seguro-arriba)] flex items-center gap-3 px-3 bg-digi-card border-b border-digi-border">
          <B className="w-8 h-8 rounded-lg" />
          <B className="h-3.5 w-28 rounded-full" i={1} />
          <span className="flex-1" />
          <B className="w-8 h-8 rounded-full" i={2} />
        </header>

        <div className="p-4 md:p-6 space-y-5">
          {/* El saludo. */}
          <B className="h-8 sm:h-10 w-64 sm:w-96 max-w-full rounded-xl" />

          {/* Las cifras: dos columnas en el teléfono, seis en fila en pantalla ancha. */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
            {Array.from({ length: 6 }, (_, k) => (
              <div key={k} className={`carga-tarjeta flex items-center gap-2.5 px-3 py-2.5 ${k > 3 ? 'max-md:hidden' : ''}`}>
                <B className="w-7 h-7 rounded-md shrink-0" i={k} />
                <span className="flex-1 space-y-1.5">
                  <B className="h-2 w-16 rounded-full" i={k} />
                  <B className="h-3.5 w-20 rounded-full" i={k + 1} />
                </span>
              </div>
            ))}
          </div>

          {/* Título de sección y filtros. */}
          <div className="space-y-3">
            <B className="h-5 w-56 rounded-lg" i={2} />
            <div className="flex gap-2">
              <B className="h-[38px] w-40 rounded-lg" i={3} />
              <B className="h-[38px] w-72 rounded-lg max-sm:flex-1" i={4} />
              <span className="flex-1 max-sm:hidden" />
              <B className="h-[38px] w-36 rounded-lg max-sm:hidden" i={5} />
            </div>
          </div>

          {/* La tabla. */}
          <div className="carga-tarjeta overflow-hidden">
            <div className="flex gap-6 px-4 py-3 border-b border-digi-border">
              {['w-[18%]', 'w-[10%]', 'w-[10%] max-sm:hidden', 'w-[10%] max-sm:hidden', 'w-[10%] ml-auto'].map((w, k) => <B key={k} className={`h-2.5 rounded-full ${w}`} i={k} />)}
            </div>
            {Array.from({ length: 8 }, (_, fila) => (
              <div key={fila} className="flex items-center gap-6 px-4 py-3.5 border-b border-digi-border last:border-b-0">
                <B className="h-3 w-[22%] rounded-full" i={fila} />
                <B className="h-3 w-[14%] rounded-full max-sm:w-[22%]" i={fila + 1} />
                <B className="h-3 w-[14%] rounded-full max-sm:hidden" i={fila + 2} />
                <B className="h-3 w-[14%] rounded-full max-sm:hidden" i={fila + 3} />
                <span className="flex-1" />
                <B className="h-3 w-[10%] rounded-full max-sm:w-[20%]" i={fila + 4} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
