'use client';

import { useEffect, useRef, useState } from 'react';
import GameLoadingScreen, { type LoadingPhase } from './GameLoadingScreen';

/**
 * Monta el juego de Godot dentro de una ruta de la app.
 *
 * En vez de abrir la página suelta que genera Godot, se arranca el motor a mano
 * sobre NUESTRO canvas. Eso da tres cosas que la página suelta no da: control
 * del tamaño (la suelta dejaba media pantalla en gris en el móvil), una
 * pantalla de carga propia —importante cuando son ~50 MB de descarga— y poder
 * poner interfaz de React encima.
 *
 * Requisito heredado del motor: **Godot web exige contexto seguro**. En local
 * hay que usar `npm run dev:https`; por `http://` desde otra máquina no arranca.
 */

/** Lo que expone `index.js` del export de Godot. */
type GodotEngine = {
  new (cfg: Record<string, unknown>): GodotEngineInstance;
  load?: (path: string) => Promise<void>;
};
type GodotEngineInstance = {
  startGame: (cfg?: Record<string, unknown>) => Promise<void>;
  requestQuit?: () => void;
};

declare global {
  interface Window {
    Engine?: GodotEngine;
  }
}

const BASE = '/game';

/**
 * Tamaño en bytes de los archivos pesados del export (wasm + pck).
 *
 * **Sin esto la barra de carga no se mueve.** El motor solo sabe calcular un
 * porcentaje si le dicen cuánto pesa cada archivo: su `Preloader` cuenta los
 * bytes que van llegando, pero si a alguno le falta el total, descarta el
 * cálculo entero y llama a `onProgress(loaded, 0)` — un 0 que no sirve para
 * nada. La página suelta que genera Godot sí los pasa (`GODOT_CONFIG.fileSizes`
 * en `index.html`); nuestro montaje a mano no lo hacía, y por eso la barra se
 * quedaba clavada.
 *
 * Los números NO se copian aquí: cambian en cada export. Se leen del propio
 * `index.html` que Godot acaba de generar, así siempre están al día.
 *
 * Las claves deben ser las MISMAS cadenas con las que el motor pide los
 * archivos (`${executable}.wasm` y `mainPack`), es decir con el prefijo
 * `/game/`; el `index.html` los guarda sin prefijo.
 */
async function leerTamanos(): Promise<Record<string, number>> {
  try {
    const html = await fetch(`${BASE}/index.html`, { cache: 'no-store' }).then((r) => r.text());
    const m = html.match(/"fileSizes"\s*:\s*(\{[^}]*\})/);
    if (!m) return {};
    const crudo = JSON.parse(m[1]) as Record<string, number>;
    const conRuta: Record<string, number> = {};
    for (const [nombre, bytes] of Object.entries(crudo)) {
      if (typeof bytes === 'number' && bytes > 0) conRuta[`${BASE}/${nombre}`] = bytes;
    }
    return conRuta;
  } catch {
    // Si falla, el juego carga igual: la barra se muestra indeterminada.
    return {};
  }
}

function loadEngineScript(): Promise<GodotEngine> {
  if (window.Engine) return Promise.resolve(window.Engine);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${BASE}/index.js"]`);
    const onReady = () => {
      if (window.Engine) resolve(window.Engine);
      else reject(new Error('El motor cargó pero no expuso Engine'));
    };
    if (existing) {
      existing.addEventListener('load', onReady, { once: true });
      return;
    }
    const s = document.createElement('script');
    s.src = `${BASE}/index.js`;
    s.async = true;
    s.onload = onReady;
    s.onerror = () => reject(new Error('No se pudo descargar el motor'));
    document.body.appendChild(s);
  });
}

export default function GodotGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const instanceRef = useRef<GodotEngineInstance | null>(null);
  const [phase, setPhase] = useState<LoadingPhase | null>('preparando');
  const [loaded, setLoaded] = useState(0);
  const [total, setTotal] = useState(0);
  /** El arranque se está eternizando → se avisa y se ofrece reintentar. */
  const [stalled, setStalled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (instanceRef.current || !canvasRef.current) return;
    let disposed = false;
    /** Temporizador que detecta que los bytes dejaron de llegar. */
    let quietTimer: number | null = null;
    /** ¿El motor ya escribió algo? Entonces está vivo, aunque tarde en resolver. */
    let engineSpoke = false;
    /** Errores que suelta el motor al arrancar, para poder enseñarlos. */
    const engineErrors: string[] = [];

    (async () => {
      // Aviso temprano y claro: sin contexto seguro Godot no arranca, y su
      // mensaje de error por defecto no explica qué hacer.
      if (!window.isSecureContext) {
        setError(
          'El juego necesita una conexión segura (HTTPS). En local, arranca el servidor con "npm run dev:https".',
        );
        return;
      }

      try {
        // El script del motor y los tamaños del export son independientes: se
        // piden a la vez para no encadenar dos esperas antes de empezar.
        const [Engine, fileSizes] = await Promise.all([loadEngineScript(), leerTamanos()]);
        if (disposed || !canvasRef.current) return;

        const instance = new Engine({
          fileSizes,
          canvas: canvasRef.current,
          // 2 = adaptativo: el motor ajusta el búfer de dibujo al tamaño real
          // del elemento.
          //
          // Con 0 ("no tocar") el búfer se queda en el tamaño por defecto del
          // canvas (300×150) y el CSS lo estira hasta la pantalla: TODO sale
          // borroso, que en pixel art es lo peor que puede pasar. Como nuestro
          // contenedor ya ocupa la ventana entera, adaptativo no rompe nada.
          canvasResizePolicy: 2,
          executable: `${BASE}/index`,
          mainPack: `${BASE}/index.pck`,
          // El motor lo llama en cada fotograma mientras baja wasm + pck, con
          // los bytes acumulados de AMBOS archivos.
          onProgress: (current: number, totalBytes: number) => {
            if (disposed) return;
            setLoaded(current);
            // El total anunciado es una ESTIMACIÓN, no un dogma: si llegan más
            // bytes de los que decía `index.html` (porque se publicó una versión
            // nueva a mitad de descarga, o porque el html venía de caché y el
            // .pck no), se sube el techo. Antes se daba por terminada la descarga
            // al pasar del total y la pantalla se quedaba en "Encendiendo el
            // motor… 100 %" mientras en realidad seguía bajando.
            setTotal((t) => Math.max(totalBytes, current, t));
            setPhase('descargando');
            // La descarga acaba cuando el contador DEJA DE MOVERSE (el motor
            // deja de llamar aquí), no cuando alcanza una cifra anunciada.
            if (quietTimer !== null) window.clearTimeout(quietTimer);
            quietTimer = window.setTimeout(() => {
              if (!disposed) setPhase('iniciando');
            }, 1200);
          },
          // Salida del motor. Sirve para dos cosas: enterarnos de que Godot ya
          // arrancó (aunque `startGame` tarde en resolver) y poder enseñar sus
          // errores en vez de dejar la pantalla de carga girando para siempre.
          onPrint: () => {
            if (disposed || engineSpoke) return;
            engineSpoke = true;
            // Si el motor ya habla, está vivo y pintando: si en unos segundos
            // `startGame` sigue sin resolver, se retira la cortina igualmente.
            window.setTimeout(() => {
              if (!disposed) setPhase(null);
            }, 8000);
          },
          onPrintError: (...args: unknown[]) => {
            engineErrors.push(args.map(String).join(' '));
          },
        });
        instanceRef.current = instance;

        await instance.startGame();
        if (!disposed) {
          setPhase(null);
          // Godot escucha el teclado en el CANVAS, no en la ventana. Sin foco,
          // las flechas no llegan al juego y el personaje no se mueve hasta que
          // el jugador hace clic — que nadie adivina que hay que hacer.
          canvasRef.current?.focus();
        }
      } catch (err) {
        if (!disposed) {
          const motivo = err instanceof Error ? err.message : 'No se pudo iniciar el juego';
          // El mensaje del motor explica MUCHO mejor qué pasó que el genérico.
          setError(engineErrors.length ? `${motivo} · ${engineErrors[engineErrors.length - 1]}` : motivo);
        }
      }
    })();

    return () => {
      disposed = true;
      if (quietTimer !== null) window.clearTimeout(quietTimer);
      // Sin esto, entrar y salir de la ruta filtra una instancia de wasm por
      // visita — y cada una son decenas de MB de memoria.
      try {
        instanceRef.current?.requestQuit?.();
      } catch {
        /* el motor puede no haber llegado a arrancar */
      }
      instanceRef.current = null;
    };
  }, []);

  // Red de seguridad: si el arranque del motor se eterniza (una publicación a
  // mitad de descarga, una conexión que se cae, un navegador que no puede con el
  // wasm), se avisa y se ofrece reintentar en vez de dejar una pantalla que
  // parece viva pero no avanza.
  useEffect(() => {
    if (phase !== 'iniciando') {
      setStalled(false);
      return;
    }
    const t = window.setTimeout(() => setStalled(true), 30000);
    return () => window.clearTimeout(t);
  }, [phase]);

  const loading = !error && phase !== null;

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: 'var(--color-void)' }}
    >
      {/*
        El `id` es OBLIGATORIO, aunque le pasemos el elemento al motor: por
        debajo, Emscripten resuelve el canvas por selector de id para enganchar
        los eventos de entrada. Sin id construye el selector "#", que es
        inválido, y el juego muere antes de arrancar.
        `block` evita además la franja fantasma que deja el line-height.
      */}
      <canvas id="canvas" ref={canvasRef} className="block h-full w-full" tabIndex={0} />

      {loading && (
        <GameLoadingScreen phase={phase} loaded={loaded} total={total} stalled={stalled} />
      )}

      {error && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8"
          style={{ background: 'var(--color-void)' }}
        >
          <p className="max-w-sm text-center text-sm text-red-300">{error}</p>
          {/* Un error sin salida es un callejón: casi siempre basta recargar. */}
          <button
            type="button"
            className="pixel-btn pixel-btn-secondary"
            onClick={() => window.location.reload()}
          >
            Reintentar
          </button>
        </div>
      )}
    </div>
  );
}
