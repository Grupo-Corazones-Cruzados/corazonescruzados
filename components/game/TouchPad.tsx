'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Mando virtual para jugar en teléfono y tablet.
 *
 * El juego solo respondía a teclado, así que en móvil sencillamente no se podía
 * jugar. Este control aparece donde el dedo toca —en vez de ocupar una posición
 * fija— porque en pantallas pequeñas obliga a mirar dónde poner el pulgar.
 *
 * Emite un vector ya normalizado directamente a la escena de Phaser, sin pasar
 * por el estado de React: el movimiento no debe provocar re-renders.
 */

type Props = {
  onChange: (v: { x: number; y: number } | null) => void;
  /** Radio en píxeles a partir del cual el vector vale 1. */
  radius?: number;
};

export default function TouchPad({ onChange, radius = 56 }: Props) {
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [visual, setVisual] = useState<{
    ox: number;
    oy: number;
    dx: number;
    dy: number;
  } | null>(null);

  const emit = useCallback(
    (dx: number, dy: number) => {
      const dist = Math.hypot(dx, dy);
      if (dist < 8) {
        // Zona muerta: evita que un pulgar quieto haga vibrar al personaje.
        onChange({ x: 0, y: 0 });
        return;
      }
      const clamped = Math.min(dist, radius);
      const scale = clamped / radius / dist;
      onChange({ x: dx * scale, y: dy * scale });
    },
    [onChange, radius],
  );

  const handleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== null) return;
    pointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    originRef.current = { x: e.clientX, y: e.clientY };
    setVisual({ ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 });
    onChange({ x: 0, y: 0 });
  };

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== pointerIdRef.current || !originRef.current) return;
    const dx = e.clientX - originRef.current.x;
    const dy = e.clientY - originRef.current.y;
    setVisual({ ox: originRef.current.x, oy: originRef.current.y, dx, dy });
    emit(dx, dy);
  };

  const handleUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== pointerIdRef.current) return;
    pointerIdRef.current = null;
    originRef.current = null;
    setVisual(null);
    onChange(null);
  };

  // `touch-none` impide que el navegador interprete el arrastre como scroll o
  // como gesto de recarga, que en móvil se lleva por delante el control.
  return (
    <div
      className="absolute inset-0 touch-none"
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
    >
      {visual && (
        <>
          <div
            className="pointer-events-none absolute rounded-full border-2 border-white/30 bg-white/5"
            style={{
              left: visual.ox - radius,
              top: visual.oy - radius,
              width: radius * 2,
              height: radius * 2,
            }}
          />
          <div
            className="pointer-events-none absolute rounded-full bg-white/60"
            style={{
              left:
                visual.ox +
                Math.max(-radius, Math.min(radius, visual.dx)) -
                18,
              top:
                visual.oy +
                Math.max(-radius, Math.min(radius, visual.dy)) -
                18,
              width: 36,
              height: 36,
            }}
          />
        </>
      )}
    </div>
  );
}
