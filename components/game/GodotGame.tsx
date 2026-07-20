'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Monta el juego de Godot dentro de una ruta de la app.
 *
 * En vez de abrir la página suelta que genera Godot, se arranca el motor a mano
 * sobre NUESTRO canvas. Eso da tres cosas que la página suelta no da: control
 * del tamaño (la suelta dejaba media pantalla en gris en el móvil), una
 * pantalla de carga propia —importante cuando son ~10 MB de descarga— y poder
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
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Preparando…');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (instanceRef.current || !canvasRef.current) return;
    let disposed = false;

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
        setStatus('Descargando el motor…');
        const Engine = await loadEngineScript();
        if (disposed || !canvasRef.current) return;

        const instance = new Engine({
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
          onProgress: (current: number, total: number) => {
            if (total > 0) setProgress(Math.round((current / total) * 100));
          },
        });
        instanceRef.current = instance;

        setStatus('Iniciando el mundo…');
        await instance.startGame();
        if (!disposed) {
          setStatus('');
          // Godot escucha el teclado en el CANVAS, no en la ventana. Sin foco,
          // las flechas no llegan al juego y el personaje no se mueve hasta que
          // el jugador hace clic — que nadie adivina que hay que hacer.
          canvasRef.current?.focus();
        }
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : 'No se pudo iniciar el juego');
        }
      }
    })();

    return () => {
      disposed = true;
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

  const loading = !error && status !== '';

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0d0b14]">
      {/*
        El `id` es OBLIGATORIO, aunque le pasemos el elemento al motor: por
        debajo, Emscripten resuelve el canvas por selector de id para enganchar
        los eventos de entrada. Sin id construye el selector "#", que es
        inválido, y el juego muere antes de arrancar.
        `block` evita además la franja fantasma que deja el line-height.
      */}
      <canvas id="canvas" ref={canvasRef} className="block h-full w-full" tabIndex={0} />

      {loading && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0d0b14] px-8 text-center">
          <p className="text-sm text-white/70">{status}</p>
          <div className="h-1.5 w-56 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-[#7c5ad0] transition-[width] duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          {progress > 0 && <p className="text-xs text-white/40">{progress}%</p>}
        </div>
      )}

      {error && (
        <div className="absolute inset-0 grid place-items-center bg-[#0d0b14] px-8">
          <p className="max-w-sm text-center text-sm text-red-300">{error}</p>
        </div>
      )}
    </div>
  );
}
