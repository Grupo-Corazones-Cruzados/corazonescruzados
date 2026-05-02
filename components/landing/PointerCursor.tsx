'use client';

import { useEffect, useRef, useState } from 'react';

const SIZE = 32;
const TIP_X = 16;
const TIP_Y = 4;

const POINTER_PATH =
  'M4.95004 22.3499C4.33004 22.3499 3.73004 22.11 3.27004 21.65C2.56004 20.94 2.37004 19.8899 2.79004 18.9699L10.09 3.03994C10.49 2.16994 11.33 1.60996 12.29 1.64996C13.25 1.65996 14.08 2.21993 14.45 3.08993L21.24 18.9499C21.64 19.8699 21.42 20.92 20.69 21.61C19.96 22.3 18.91 22.4699 18 22.0299L12.28 19.2499L5.94004 22.1299C5.62004 22.2799 5.28004 22.3499 4.95004 22.3499ZM12.26 3.64996C12.17 3.64996 12 3.67996 11.91 3.86996L4.61004 19.8C4.51004 20.01 4.62004 20.1599 4.69004 20.2299C4.76004 20.2999 4.91004 20.3999 5.12004 20.3099L11.89 17.2299C12.16 17.1099 12.47 17.11 12.74 17.24L18.89 20.2299C19.1 20.3299 19.25 20.2299 19.32 20.1599C19.39 20.0899 19.5 19.9399 19.41 19.7299L12.62 3.86996C12.52 3.67996 12.38 3.66996 12.26 3.64996Z';

export default function PointerCursor() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let targetX = -9999;
    let targetY = -9999;
    let curX = -9999;
    let curY = -9999;
    let curAngle = 0;
    let targetAngle = 0;
    let rafId = 0;

    const tick = () => {
      const prevX = curX;
      const prevY = curY;
      curX += (targetX - curX) * 0.35;
      curY += (targetY - curY) * 0.35;

      const dx = curX - prevX;
      const dy = curY - prevY;
      const mag = Math.hypot(dx, dy);
      if (mag > 0.6) {
        targetAngle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
      }
      let diff = targetAngle - curAngle;
      diff = ((diff + 540) % 360) - 180;
      curAngle += diff * 0.25;

      if (wrapperRef.current) {
        wrapperRef.current.style.transform = `translate3d(${curX.toFixed(2)}px, ${curY.toFixed(2)}px, 0) rotate(${curAngle.toFixed(1)}deg)`;
      }
      rafId = requestAnimationFrame(tick);
    };

    const handleMove = (e: MouseEvent) => {
      targetX = e.clientX - TIP_X;
      targetY = e.clientY - TIP_Y;
      if (curX < -1000) {
        curX = targetX;
        curY = targetY;
      }
      if (!visible) setVisible(true);
    };

    const handleLeave = () => setVisible(false);
    const handleEnter = () => setVisible(true);

    window.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseleave', handleLeave);
    document.addEventListener('mouseenter', handleEnter);
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseleave', handleLeave);
      document.removeEventListener('mouseenter', handleEnter);
    };
  }, [visible]);

  return (
    <div
      ref={wrapperRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: SIZE,
        height: SIZE,
        pointerEvents: 'none',
        zIndex: 2147483647,
        opacity: visible ? 1 : 0,
        transition: 'opacity 200ms ease',
        willChange: 'transform',
        transformOrigin: `${TIP_X}px ${TIP_Y}px`,
      }}
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox="0 0 24 24"
        fill="#ffffff"
        style={{
          display: 'block',
          filter:
            'drop-shadow(0 1px 2px rgba(0,0,0,0.55)) drop-shadow(0 0 1px rgba(0,0,0,0.6))',
        }}
      >
        <path d={POINTER_PATH} />
      </svg>
    </div>
  );
}
