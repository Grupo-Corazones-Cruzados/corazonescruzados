'use client';

import { useEffect, useRef, useState } from 'react';

interface AvatarCropEditorProps {
  /** Walk sprite sheet URL (row 0, frame 0 is used) */
  src: string;
  crop: { x: number; y: number; size: number };
  onChange: (crop: { x: number; y: number; size: number }) => void;
}

export default function AvatarCropEditor({ src, crop, onChange }: AvatarCropEditorProps) {
  const previewRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Frame 0 of row 0 in the walk sheet is 64x64 pixels at (0,0)
  const FRAME = 64;

  useEffect(() => {
    setLoaded(false);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { imgRef.current = img; setLoaded(true); };
    img.onerror = () => setLoaded(false);
    img.src = src;
  }, [src]);

  // Draw source frame with crop overlay + circular preview
  useEffect(() => {
    if (!loaded || !imgRef.current) return;
    const img = imgRef.current;

    // Source canvas: show 64x64 frame scaled up with crop rectangle
    const srcCanvas = sourceRef.current;
    if (srcCanvas) {
      const ctx = srcCanvas.getContext('2d');
      if (ctx) {
        const scale = 3;
        srcCanvas.width = FRAME * scale;
        srcCanvas.height = FRAME * scale;
        ctx.imageSmoothingEnabled = false;
        // Draw frame 0, row 0
        ctx.drawImage(img, 0, 0, FRAME, FRAME, 0, 0, FRAME * scale, FRAME * scale);
        // Draw crop rectangle
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(crop.x * scale, crop.y * scale, crop.size * scale, crop.size * scale);
        ctx.setLineDash([]);
        // Darken outside crop
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        // Top
        ctx.fillRect(0, 0, FRAME * scale, crop.y * scale);
        // Bottom
        ctx.fillRect(0, (crop.y + crop.size) * scale, FRAME * scale, (FRAME - crop.y - crop.size) * scale);
        // Left
        ctx.fillRect(0, crop.y * scale, crop.x * scale, crop.size * scale);
        // Right
        ctx.fillRect((crop.x + crop.size) * scale, crop.y * scale, (FRAME - crop.x - crop.size) * scale, crop.size * scale);
      }
    }

    // Preview canvas: circular crop result
    const prevCanvas = previewRef.current;
    if (prevCanvas) {
      const ctx = prevCanvas.getContext('2d');
      if (ctx) {
        const dispSize = 48;
        prevCanvas.width = dispSize;
        prevCanvas.height = dispSize;
        ctx.clearRect(0, 0, dispSize, dispSize);
        // Clip circle
        ctx.beginPath();
        ctx.arc(dispSize / 2, dispSize / 2, dispSize / 2, 0, Math.PI * 2);
        ctx.clip();
        // Background
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fill();
        // Draw cropped face
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, crop.x, crop.y, crop.size, crop.size, 0, 0, dispSize, dispSize);
      }
    }
  }, [loaded, crop, FRAME]);

  if (!loaded) {
    return <div className="text-[9px] text-digi-muted animate-pulse">Cargando...</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <canvas
          ref={sourceRef}
          style={{ imageRendering: 'pixelated' }}
          className="rounded border border-digi-border/50"
        />
        <div className="flex flex-col items-center gap-1">
          <canvas
            ref={previewRef}
            style={{ imageRendering: 'pixelated' }}
            className="rounded-full border-2 border-digi-green/50"
          />
          <span className="text-[8px] text-digi-muted">Preview</span>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-digi-muted font-mono w-6">X:</span>
          <input
            type="range" min="0" max={FRAME - crop.size} step="1"
            value={crop.x}
            onChange={(e) => onChange({ ...crop, x: parseInt(e.target.value) })}
            className="flex-1 h-1 accent-digi-green"
          />
          <span className="text-[9px] text-digi-muted font-mono w-6 text-right">{crop.x}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-digi-muted font-mono w-6">Y:</span>
          <input
            type="range" min="0" max={FRAME - crop.size} step="1"
            value={crop.y}
            onChange={(e) => onChange({ ...crop, y: parseInt(e.target.value) })}
            className="flex-1 h-1 accent-digi-green"
          />
          <span className="text-[9px] text-digi-muted font-mono w-6 text-right">{crop.y}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-digi-muted font-mono w-6">Zoom:</span>
          <input
            type="range" min="12" max="56" step="1"
            value={crop.size}
            onChange={(e) => {
              const newSize = parseInt(e.target.value);
              const maxX = FRAME - newSize;
              const maxY = FRAME - newSize;
              onChange({
                x: Math.min(crop.x, maxX),
                y: Math.min(crop.y, maxY),
                size: newSize,
              });
            }}
            className="flex-1 h-1 accent-digi-green"
          />
          <span className="text-[9px] text-digi-muted font-mono w-6 text-right">{crop.size}</span>
        </div>
      </div>
    </div>
  );
}
