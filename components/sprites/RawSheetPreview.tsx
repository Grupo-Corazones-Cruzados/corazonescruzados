'use client';

import { useEffect, useRef, useState } from 'react';

interface RawSheetPreviewProps {
  src: string;
  yShift: number; // -15 to 15
  cols?: number;
  rows?: number;
}

const ROW_LABELS = ['walk', 'idle', 'work', 'excited', 'done', 'rest', 'eating'];

export default function RawSheetPreview({ src, yShift, cols = 4, rows = 7 }: RawSheetPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Load image once
  useEffect(() => {
    setLoaded(false);
    setImgError(false);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => { imgRef.current = img; setLoaded(true); };
    img.onerror = () => setImgError(true);
    img.src = src;
  }, [src]);

  // Redraw on yShift change or load
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !loaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Canvas display size — fit within a reasonable preview area
    const isMobile = window.innerWidth < 768;
    const maxW = isMobile ? Math.min(window.innerWidth - 48, 220) : 280;
    const aspect = img.naturalHeight / img.naturalWidth;
    const dispW = maxW;
    const dispH = Math.round(dispW * aspect);

    canvas.width = dispW;
    canvas.height = dispH;

    // Draw the raw image
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, dispW, dispH);

    const cellW = dispW / cols;
    const cellH = dispH / rows;
    const shiftPx = cellH * (yShift / 100);

    // Draw grid lines — vertical (columns)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    for (let c = 1; c < cols; c++) {
      const x = Math.round(c * cellW);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, dispH);
      ctx.stroke();
    }

    // Draw grid lines — horizontal (shifted rows)
    for (let r = 0; r <= rows; r++) {
      const y = Math.round(r * cellH + shiftPx);
      if (y < 0 || y > dispH) continue;

      // Row boundary = green dashed, extraction top
      ctx.strokeStyle = 'rgba(29, 158, 117, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(dispW, y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Row label
      if (r < rows && ROW_LABELS[r]) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(1, y + 1, 36, 11);
        ctx.fillStyle = '#4ade80';
        ctx.font = '8px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(ROW_LABELS[r], 3, y + 10);
      }
    }

    // Original grid (without shift) as faint reference
    if (yShift !== 0) {
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      for (let r = 1; r < rows; r++) {
        const y = Math.round(r * cellH);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(dispW, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
  }, [loaded, yShift, cols, rows]);

  if (imgError) {
    return (
      <div className="text-[9px] text-digi-muted italic py-2">
        No se pudo cargar el raw. Regenera primero.
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="text-[9px] text-digi-muted animate-pulse py-2">
        Cargando preview...
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ imageRendering: 'pixelated' }}
      className="rounded border border-digi-border/50"
    />
  );
}
