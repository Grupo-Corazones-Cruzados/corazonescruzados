'use client';

import { useEffect, useRef } from 'react';

interface AnimatedSpriteProps {
  src: string;
  row?: number;
  frameCount?: number;
  frameSize?: number;
  fps?: number;
  scale?: number;
  className?: string;
  selectedFrames?: number[]; // only cycle through these frame indices (e.g. [0, 2])
}

export default function AnimatedSprite({
  src,
  row = 0,
  frameCount = 4,
  frameSize = 64,
  fps = 6,
  scale = 2,
  className,
  selectedFrames,
}: AnimatedSpriteProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cancelled = false;

    const displaySize = frameSize * scale;
    canvas.width = displaySize;
    canvas.height = displaySize;

    const img = new Image();
    img.crossOrigin = 'anonymous';

    // Build the list of frame indices to cycle through
    const frames = selectedFrames && selectedFrames.length > 0
      ? selectedFrames.filter(f => f >= 0 && f < frameCount)
      : Array.from({ length: frameCount }, (_, i) => i);
    if (frames.length === 0) frames.push(0);

    let idx = 0;
    let lastTime = 0;
    const interval = 1000 / fps;

    const animate = (time: number) => {
      if (cancelled) return;
      if (time - lastTime >= interval) {
        lastTime = time;
        ctx.clearRect(0, 0, displaySize, displaySize);
        ctx.imageSmoothingEnabled = false;

        const col = frames[idx];
        const sx = col * frameSize;
        const sy = row * frameSize;

        ctx.drawImage(img, sx, sy, frameSize, frameSize, 0, 0, displaySize, displaySize);
        idx = (idx + 1) % frames.length;
      }
      animRef.current = requestAnimationFrame(animate);
    };

    img.onload = () => {
      if (cancelled) return;
      animRef.current = requestAnimationFrame(animate);
    };

    img.onerror = () => {
      if (cancelled) return;
      ctx.fillStyle = '#1a1a3e';
      ctx.fillRect(0, 0, displaySize, displaySize);
      ctx.fillStyle = '#6b7280';
      ctx.font = `${Math.max(10, displaySize / 4)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', displaySize / 2, displaySize / 2);
    };

    img.src = src;

    return () => {
      cancelled = true;
      cancelAnimationFrame(animRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, row, frameCount, frameSize, fps, scale, selectedFrames?.join(',')]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
