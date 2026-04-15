'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { CitizenDef } from '@/types/world';
import type { ChatBlock } from '@/components/world/ChatPanel';

const ChatPanel = dynamic(() => import('@/components/world/ChatPanel'), { ssr: false });

const pf = { fontFamily: "'Silkscreen', cursive" } as const;
const mf = { fontFamily: "'JetBrains Mono', monospace" } as const;

interface FloatingChatWindowProps {
  citizen: CitizenDef;
  blocks: ChatBlock[];
  onBlocksChange: (blocks: ChatBlock[]) => void;
  externalMessage: string | null;
  onExternalMessageConsumed: () => void;
  onClose: () => void;
  minimized: boolean;
  onMinimize: () => void;
  onRestore: () => void;
  queueCount: number;
  isLocalhost: boolean;
  projectName?: string;
  isStreaming: boolean;
  justCompleted: boolean;
  sessionKey?: string;
}

const DEFAULT_W = 420;
const DEFAULT_H = 520;
const STORAGE_KEY = 'floating-chat-pos';

function loadPos() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return null;
}

export default function FloatingChatWindow({
  citizen,
  blocks,
  onBlocksChange,
  externalMessage,
  onExternalMessageConsumed,
  onClose,
  minimized,
  onMinimize,
  onRestore,
  queueCount,
  isLocalhost,
  projectName,
  isStreaming,
  justCompleted,
  sessionKey,
}: FloatingChatWindowProps) {
  const saved = loadPos();
  const [pos, setPos] = useState({ x: saved?.x ?? 80, y: saved?.y ?? 80 });
  const [size, setSize] = useState({ w: saved?.w ?? DEFAULT_W, h: saved?.h ?? DEFAULT_H });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // Persist position
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ x: pos.x, y: pos.y, w: size.w, h: size.h }));
  }, [pos, size]);

  // Drag handlers (title bar only)
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos({
      x: Math.max(0, Math.min(window.innerWidth - 200, dragRef.current.origX + dx)),
      y: Math.max(0, Math.min(window.innerHeight - 60, dragRef.current.origY + dy)),
    });
  }, []);

  const onPointerUp = useCallback(() => { dragRef.current = null; }, []);

  // Size presets
  const cycleSize = () => {
    if (size.w === DEFAULT_W) setSize({ w: 520, h: 620 });
    else if (size.w === 520) setSize({ w: 680, h: 700 });
    else setSize({ w: DEFAULT_W, h: DEFAULT_H });
  };

  // --- MINIMIZED STATE ---
  if (minimized) {
    return (
      <div
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 bg-digi-card border-2 border-accent/50 cursor-pointer hover:border-accent transition-colors"
        onClick={onRestore}
        style={{ boxShadow: '4px 4px 0 rgba(0,0,0,0.4)' }}
      >
        {/* Status bubble */}
        <div className="relative">
          <FaceBubble sprite={citizen.sprite} avatarCrop={citizen.avatarCrop} size={28} />
          <StatusDot streaming={isStreaming} completed={justCompleted} />
        </div>
        <div className="min-w-0">
          <span className="text-[9px] text-accent-glow block" style={pf}>{citizen.name}</span>
          {isStreaming && <span className="text-[7px] text-yellow-400 block animate-pulse" style={mf}>Trabajando...</span>}
          {!isStreaming && justCompleted && <span className="text-[7px] text-green-400 block" style={mf}>Completado</span>}
        </div>
        {queueCount > 0 && (
          <span className="px-1.5 py-0.5 text-[8px] bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 animate-pulse" style={pf}>
            {queueCount}
          </span>
        )}
      </div>
    );
  }

  // --- PRODUCTION GUARD ---
  if (!isLocalhost) {
    return (
      <div
        className="fixed z-50 bg-digi-card border-2 border-red-500/30 p-6 text-center"
        style={{ left: pos.x, top: pos.y, width: 320 }}
      >
        <p className="text-sm text-red-400 mb-2" style={pf}>Prohibido</p>
        <p className="text-[10px] text-digi-muted" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
          El chat con agentes solo esta disponible en entorno local (localhost).
        </p>
        <button onClick={onClose} className="mt-4 text-[9px] text-digi-muted border border-digi-border px-3 py-1 hover:border-accent transition-colors" style={pf}>
          Cerrar
        </button>
      </div>
    );
  }

  // --- OPEN STATE ---
  return (
    <div
      className="fixed z-50 flex flex-col bg-digi-darker border-2 border-accent/40 overflow-hidden"
      style={{
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        boxShadow: '6px 6px 0 rgba(0,0,0,0.5), 0 0 20px rgba(75,45,142,0.15)',
      }}
    >
      {/* Title bar - draggable */}
      <div
        className="shrink-0 flex items-center gap-2 px-3 py-2 bg-digi-card border-b-2 border-digi-border cursor-grab active:cursor-grabbing select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div className="relative shrink-0">
          <FaceBubble sprite={citizen.sprite} avatarCrop={citizen.avatarCrop} size={28} />
          <StatusDot streaming={isStreaming} completed={justCompleted} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[9px] text-accent-glow truncate block" style={pf}>{citizen.name}</span>
          {projectName && <span className="text-[7px] text-digi-muted truncate block" style={mf}>{projectName}</span>}
        </div>

        {queueCount > 0 && (
          <span className="px-1.5 py-0.5 text-[8px] bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 animate-pulse" style={pf}>
            Cola: {queueCount}
          </span>
        )}

        <button onClick={cycleSize} className="w-5 h-5 flex items-center justify-center text-[9px] text-digi-muted hover:text-accent-glow border border-digi-border hover:border-accent transition-colors" style={pf} title="Cambiar tamaño">
          []
        </button>
        <button onClick={onMinimize} className="w-5 h-5 flex items-center justify-center text-[9px] text-digi-muted hover:text-accent-glow border border-digi-border hover:border-accent transition-colors" style={pf} title="Minimizar">
          _
        </button>
        <button onClick={onClose} className="w-5 h-5 flex items-center justify-center text-[9px] text-red-400 hover:text-red-300 border border-digi-border hover:border-red-500/50 transition-colors" style={pf} title="Cerrar">
          X
        </button>
      </div>

      {/* Chat body */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatPanel
          citizen={citizen}
          onClose={onClose}
          blocks={blocks}
          onBlocksChange={onBlocksChange}
          externalMessage={externalMessage}
          onExternalMessageConsumed={onExternalMessageConsumed}
          sessionKey={sessionKey}
        />
      </div>
    </div>
  );
}

function FaceBubble({ sprite, avatarCrop, size = 28 }: { sprite: string; avatarCrop?: { x: number; y: number; size: number }; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = size;
    canvas.height = size;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const srcX = avatarCrop?.x ?? 12;
      const srcY = avatarCrop?.y ?? 14;
      const srcS = avatarCrop?.size ?? 28;
      ctx.clearRect(0, 0, size, size);
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fill();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, srcX, srcY, srcS, srcS, 0, 0, size, size);
      ctx.strokeStyle = '#7B5FBF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
      ctx.stroke();
    };
    img.src = `/api/assets/universal_assets/citizens/${sprite}_walk.png`;
  }, [sprite, avatarCrop, size]);

  return <canvas ref={canvasRef} className="shrink-0" style={{ imageRendering: 'pixelated', width: size, height: size }} />;
}

function StatusDot({ streaming, completed }: { streaming: boolean; completed: boolean }) {
  if (!streaming && !completed) return null;
  return (
    <span
      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-digi-darker ${
        streaming
          ? 'bg-yellow-400 animate-pulse'
          : 'bg-green-400'
      }`}
    />
  );
}
