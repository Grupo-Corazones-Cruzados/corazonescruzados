'use client';

import { useEffect, useRef } from 'react';
import { paintLightingFrame, type LightSource } from './lights';

// Animated lighting overlay. Lives inside the world's transformed
// container so it scrolls with the map. Renders ambient darkness with
// per-light radial holes punched into it; tints those holes with the
// light's color. Animates at the browser's RAF cadence.
export default function LightOverlay({
  width,
  height,
  tilePx,
  ambientDarkness,
  lights,
}: {
  width: number; // tiles
  height: number; // tiles
  tilePx: number; // pixels per tile (in source space, before CSS scale)
  ambientDarkness: number; // 0..1
  lights: LightSource[];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Stash the animated inputs in a ref so the RAF loop doesn't have
  // to re-bind every render.
  const inputsRef = useRef({ lights, ambientDarkness, width, height, tilePx });
  inputsRef.current = { lights, ambientDarkness, width, height, tilePx };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = width * tilePx;
    canvas.height = height * tilePx;

    let raf = 0;
    const tick = (now: number) => {
      const inputs = inputsRef.current;
      // Skip the work entirely if the world is fully lit and no lights
      // are doing anything visible.
      if (inputs.ambientDarkness <= 0 && inputs.lights.length === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        paintLightingFrame(
          ctx,
          inputs.width * inputs.tilePx,
          inputs.height * inputs.tilePx,
          inputs.tilePx,
          inputs.ambientDarkness,
          inputs.lights,
          now,
        );
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [width, height, tilePx]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        imageRendering: 'pixelated',
        pointerEvents: 'none',
      }}
    />
  );
}
