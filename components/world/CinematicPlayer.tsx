'use client';

import { useEffect, useRef, useState } from 'react';
import type { CinematicData, CinematicFrame } from '@/components/landing/world/sheets';

const FRAME_W = 1280;
const FRAME_H = 720;
const TYPEWRITER_CPS = 50; // chars per second

export default function CinematicPlayer({
  data,
  onDone,
  skippable = true,
}: {
  data: CinematicData;
  onDone: () => void;
  skippable?: boolean;
}) {
  const frames = data.frames ?? [];
  const [idx, setIdx] = useState(0);
  // Re-keys the typewriter when the frame changes.
  const frame: CinematicFrame | undefined = frames[idx];

  // Fit the 1280×720 stage inside the viewport while preserving ratio.
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const recompute = () => {
      const sx = window.innerWidth / FRAME_W;
      const sy = window.innerHeight / FRAME_H;
      setScale(Math.min(sx, sy));
    };
    recompute();
    window.addEventListener('resize', recompute);
    return () => window.removeEventListener('resize', recompute);
  }, []);

  // Typewriter state.
  const [typed, setTyped] = useState('');
  const finishedTypingRef = useRef(false);
  useEffect(() => {
    finishedTypingRef.current = false;
    const text = frame?.dialog?.text ?? '';
    if (!text) {
      setTyped('');
      finishedTypingRef.current = true;
      return;
    }
    setTyped('');
    const startTs = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = (now - startTs) / 1000;
      const chars = Math.min(text.length, Math.floor(elapsed * TYPEWRITER_CPS));
      setTyped(text.slice(0, chars));
      if (chars < text.length) raf = requestAnimationFrame(tick);
      else finishedTypingRef.current = true;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frame?.id, frame?.dialog?.text]);

  // Auto-advance when the frame has a duration set.
  useEffect(() => {
    if (!frame) return;
    if (frame.duration == null) return;
    const t = window.setTimeout(() => advance(), frame.duration);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame?.id, frame?.duration]);

  // Fade transition between frames.
  const [fadeAlpha, setFadeAlpha] = useState(0);
  const advance = () => {
    if (!frame) return;
    if (idx >= frames.length - 1) {
      onDone();
      return;
    }
    const transition = frames[idx + 1]?.transition ?? 'cut';
    if (transition === 'fade') {
      // Fade to black, swap, fade back in.
      const ms = 250;
      const startTs = performance.now();
      const fadeOut = (now: number) => {
        const dt = Math.min(1, (now - startTs) / ms);
        setFadeAlpha(dt);
        if (dt < 1) requestAnimationFrame(fadeOut);
        else {
          setIdx((i) => i + 1);
          const startIn = performance.now();
          const fadeIn = (n2: number) => {
            const dt2 = Math.min(1, (n2 - startIn) / ms);
            setFadeAlpha(1 - dt2);
            if (dt2 < 1) requestAnimationFrame(fadeIn);
          };
          requestAnimationFrame(fadeIn);
        }
      };
      requestAnimationFrame(fadeOut);
    } else {
      setIdx((i) => i + 1);
    }
  };

  // Keyboard / click controls.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!finishedTypingRef.current && frame?.dialog?.text) {
          // First press finishes typing instantly.
          setTyped(frame.dialog.text);
          finishedTypingRef.current = true;
          return;
        }
        advance();
      } else if (e.key === 'Escape' && skippable) {
        e.preventDefault();
        onDone();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame?.id, idx, frames.length, skippable]);

  if (!frame) {
    // Shouldn't render but be defensive.
    return null;
  }

  return (
    <div
      onClick={() => {
        if (!finishedTypingRef.current && frame.dialog?.text) {
          setTyped(frame.dialog.text);
          finishedTypingRef.current = true;
          return;
        }
        advance();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        zIndex: 300000,
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        userSelect: 'none',
        fontFamily: "'Silkscreen', cursive",
      }}
    >
      <div
        style={{
          position: 'relative',
          width: FRAME_W,
          height: FRAME_H,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          background:
            frame.backdrop.kind === 'color' ? frame.backdrop.color : '#000',
          overflow: 'hidden',
        }}
      >
        {frame.backdrop.kind === 'image' && frame.backdrop.url && (
          <img
            src={frame.backdrop.url}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        )}
        {frame.characters.map((c) => (
          <img
            key={c.id}
            src={c.spriteUrl}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              left: c.x - 64 * (c.scale ?? 1),
              top: c.y - 128 * (c.scale ?? 1),
              width: 128 * (c.scale ?? 1),
              height: 128 * (c.scale ?? 1),
              imageRendering: 'pixelated',
              transform: c.flip ? 'scaleX(-1)' : undefined,
            }}
          />
        ))}
        {frame.dialog && frame.dialog.text && (
          <div
            style={{
              position: 'absolute',
              left: 60,
              right: 60,
              bottom: 50,
              padding: 20,
              background: 'rgba(10, 10, 20, 0.85)',
              border: '4px solid var(--color-accent)',
              color: '#e5e5e5',
              fontSize: 22,
              lineHeight: 1.5,
              display: 'flex',
              gap: 16,
              alignItems: 'flex-start',
            }}
          >
            {frame.dialog.portraitUrl && (
              <img
                src={frame.dialog.portraitUrl}
                alt=""
                draggable={false}
                style={{
                  width: 96,
                  height: 96,
                  imageRendering: 'pixelated',
                  border: '2px solid rgba(75,45,142,0.6)',
                  flex: '0 0 auto',
                }}
              />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              {frame.dialog.speaker && (
                <div
                  style={{
                    color: '#ffcc00',
                    fontSize: 18,
                    letterSpacing: '0.1em',
                    marginBottom: 8,
                  }}
                >
                  {frame.dialog.speaker}
                </div>
              )}
              <div style={{ whiteSpace: 'pre-wrap' }}>{typed}</div>
              <div
                style={{
                  marginTop: 12,
                  fontSize: 12,
                  color: 'rgba(225,215,255,0.55)',
                  letterSpacing: '0.12em',
                }}
              >
                {finishedTypingRef.current
                  ? '▼ [Espacio / clic] continuar'
                  : '…'}
                {skippable && '   ·   [Esc] saltar'}
              </div>
            </div>
          </div>
        )}
        {!frame.dialog?.text && skippable && (
          <div
            style={{
              position: 'absolute',
              right: 30,
              bottom: 30,
              padding: '8px 16px',
              background: 'rgba(10, 10, 20, 0.7)',
              color: 'rgba(225,215,255,0.65)',
              fontSize: 14,
              letterSpacing: '0.12em',
            }}
          >
            [Espacio] continuar · [Esc] saltar
          </div>
        )}
      </div>
      {fadeAlpha > 0 && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: '#000',
            opacity: fadeAlpha,
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}
