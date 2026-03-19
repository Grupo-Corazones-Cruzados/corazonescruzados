'use client';

import { useEffect, useRef } from 'react';

interface FrameSelectorProps {
  src: string;
  row: number;
  frameCount?: number;
  frameSize?: number;
  selectedFrames: number[];
  onChange: (frames: number[]) => void;
}

function FrameThumb({
  src,
  row,
  col,
  frameSize,
  selected,
  onClick,
}: {
  src: string;
  row: number;
  col: number;
  frameSize: number;
  selected: boolean;
  onClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 32;
    canvas.width = size;
    canvas.height = size;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, col * frameSize, row * frameSize, frameSize, frameSize, 0, 0, size, size);
    };
    img.src = src;
  }, [src, row, col, frameSize]);

  return (
    <button
      onClick={onClick}
      className={`relative rounded border-2 transition-all ${
        selected
          ? 'border-digi-green shadow-[0_0_6px_rgba(29,158,117,0.4)]'
          : 'border-digi-border/40 opacity-35 hover:opacity-60'
      }`}
      title={`Frame ${col + 1}`}
    >
      <canvas
        ref={canvasRef}
        className="block"
        style={{ imageRendering: 'pixelated', width: 28, height: 28 }}
      />
      <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 text-[7px] text-digi-muted font-mono">
        {col + 1}
      </span>
    </button>
  );
}

export default function FrameSelector({
  src,
  row,
  frameCount = 4,
  frameSize = 64,
  selectedFrames,
  onChange,
}: FrameSelectorProps) {
  const toggleFrame = (col: number) => {
    if (selectedFrames.includes(col)) {
      // Don't allow deselecting the last frame
      if (selectedFrames.length <= 1) return;
      onChange(selectedFrames.filter((f) => f !== col).sort((a, b) => a - b));
    } else {
      onChange([...selectedFrames, col].sort((a, b) => a - b));
    }
  };

  return (
    <div className="flex items-center gap-1.5 pt-1 pb-2">
      {Array.from({ length: frameCount }, (_, i) => (
        <FrameThumb
          key={i}
          src={src}
          row={row}
          col={i}
          frameSize={frameSize}
          selected={selectedFrames.includes(i)}
          onClick={() => toggleFrame(i)}
        />
      ))}
    </div>
  );
}
