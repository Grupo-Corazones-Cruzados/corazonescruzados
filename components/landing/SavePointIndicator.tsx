'use client';

import { useEffect, useRef, useState } from 'react';

export default function SavePointIndicator({
  trigger,
}: {
  trigger: number;
}) {
  const [visible, setVisible] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const sfxRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (trigger === 0) return;
    setVisible(true);
    setConfirmed(false);
    const sfx = sfxRef.current;
    if (sfx) {
      sfx.volume = 0.55;
      sfx.currentTime = 0;
      sfx.play().catch(() => undefined);
    }
    const t1 = window.setTimeout(() => setConfirmed(true), 900);
    const t2 = window.setTimeout(() => setVisible(false), 3600);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [trigger]);

  if (trigger === 0) return null;

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 99998,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px 10px 12px',
        background: '#131923',
        border: '2px solid var(--color-accent)',
        boxShadow:
          '4px 4px 0 rgba(0,0,0,0.55), 0 0 22px rgba(75,45,142,0.45)',
        transform: visible ? 'translateX(0)' : 'translateX(120%)',
        opacity: visible ? 1 : 0,
        transition:
          'transform 540ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 420ms ease',
        fontFamily: "'Silkscreen', cursive",
        pointerEvents: 'none',
        animation: visible ? 'savePointPulse 1.6s ease-in-out infinite' : 'none',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-loader.gif"
          alt=""
          style={{
            width: 36,
            height: 36,
            imageRendering: 'pixelated',
            display: 'block',
            opacity: confirmed ? 0.5 : 1,
            transition: 'opacity 200ms ease',
          }}
        />
        {confirmed && (
          <div
            style={{
              position: 'absolute',
              right: -2,
              bottom: -2,
              width: 16,
              height: 16,
              background: '#3b8b3b',
              border: '2px solid #0f1320',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'savePointCheck 0.4s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            <svg
              viewBox="0 0 12 12"
              width="10"
              height="10"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="square"
            >
              <path d="M2 6 L5 9 L10 3" />
            </svg>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div
          style={{
            fontSize: '0.5rem',
            letterSpacing: '0.22em',
            color: 'rgba(225,215,255,0.6)',
            textTransform: 'uppercase',
          }}
        >
          {confirmed ? 'Guardado' : 'Guardando…'}
        </div>
        <div
          style={{
            fontSize: '0.74rem',
            letterSpacing: '0.1em',
            color: '#e5e5e5',
            textShadow: '1px 1px 0 rgba(0,0,0,0.6)',
            whiteSpace: 'nowrap',
          }}
        >
          Punto de guardado
        </div>
      </div>
      <audio
        ref={sfxRef}
        src="/sounds/music/Floraphonic%20Classic%20Game%20Action%20Sound.mp3"
        preload="auto"
      />
    </div>
  );
}
