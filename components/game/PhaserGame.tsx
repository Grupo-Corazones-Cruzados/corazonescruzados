'use client';

import { useEffect, useRef, useState } from 'react';
import type Phaser from 'phaser';
import type { WorldScene } from '@/lib/game/phaser/WorldScene';
import TouchPad from './TouchPad';

/**
 * Monta el juego dentro de React sin dejar instancias huérfanas.
 *
 * Dos trampas concretas que este componente evita:
 *
 *  1. **React 19 en StrictMode monta dos veces** y el `import()` es asíncrono.
 *     Sin la bandera `disposed`, la segunda pasada gana la carrera y queda un
 *     juego sin limpiar corriendo de fondo. Es un fallo conocido de Phaser
 *     (phaser#4305). La solución NO es desactivar StrictMode: eso es solo de
 *     desarrollo y ocultaría errores en TODA la app, no solo aquí.
 *
 *  2. **Nada que cambie por frame pasa por React.** La posición del jugador
 *     vive dentro de Phaser; React solo pinta la interfaz de alrededor. Antes,
 *     cada frame de movimiento provocaba un re-render del árbol completo.
 */

type Props = {
  sceneSlug: string;
  /** Muestra el mando táctil. Por defecto se decide por el dispositivo. */
  showTouchControls?: boolean;
};

async function fetchMap(slug: string) {
  // El parámetro es `scene`, y la respuesta ya es el mapa plano.
  const res = await fetch(`/api/world/map?scene=${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error(`No se pudo cargar el mapa "${slug}"`);
  return res.json();
}

/** Guarda la posición, con reintento silencioso: perderla no rompe la partida. */
function persistPosition(sceneSlug: string, x: number, y: number, facing: string) {
  fetch('/api/world/position', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sceneSlug, x, y, facing }),
  }).catch(() => undefined);
}

export default function PhaserGame({ sceneSlug, showTouchControls }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<WorldScene | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Detección de táctil: en escritorio el mando estorba.
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    setIsTouch(
      typeof window !== 'undefined' &&
        window.matchMedia('(hover: none) and (pointer: coarse)').matches,
    );
  }, []);

  useEffect(() => {
    if (gameRef.current || !containerRef.current) return;
    let disposed = false;

    (async () => {
      try {
        const { createGame, WorldScene: SceneClass } = await import('@/lib/game/phaser/createGame');
        // StrictMode pudo desmontarnos mientras se cargaba el módulo.
        if (disposed || !containerRef.current) return;

        const game = createGame(containerRef.current, {
          sceneSlug,
          loadMap: fetchMap,
          onTileChange: persistPosition,
        });
        gameRef.current = game;

        game.events.once('ready', () => {
          if (disposed) return;
          sceneRef.current = game.scene.getScene(SceneClass.KEY) as WorldScene;
          setReady(true);
        });
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : 'No se pudo iniciar el juego');
        }
      }
    })();

    return () => {
      disposed = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, [sceneSlug]);

  const wantsTouch = showTouchControls ?? isTouch;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0d0b14]">
      <div ref={containerRef} className="h-full w-full" />

      {!ready && !error && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-white/70">
          Cargando el mundo…
        </div>
      )}

      {error && (
        <div className="absolute inset-0 grid place-items-center p-6">
          <p className="max-w-sm text-center text-sm text-red-300">{error}</p>
        </div>
      )}

      {ready && wantsTouch && (
        <TouchPad onChange={(v) => sceneRef.current?.setTouchVector(v)} />
      )}
    </div>
  );
}
