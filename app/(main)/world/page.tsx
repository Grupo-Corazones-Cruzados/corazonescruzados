'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import ChatPanel from '@/components/world/ChatPanel';
import type { ChatBlock } from '@/components/world/ChatPanel';
import { useAppStore } from '@/lib/store';
import { X } from 'lucide-react';
import TasksModal from '@/components/world/TasksModal';
import FloatingTasksWidget from '@/components/world/FloatingTasksWidget';
import MusicPlayer from '@/components/world/MusicPlayer';
import FeedingScheduleModal from '@/components/world/FeedingScheduleModal';
import type { ProjectStructure } from '@/types/projects';

// ─── Types ──────────────────────────────────────────────
interface Agent {
  agentId: string;
  name: string;
  sprite: string;
  projectPath: string;
  scale: number;
  flipWalk: boolean;
  frameConfig?: Record<string, number[]>;
  avatarCrop?: { x: number; y: number; size: number };
}

// Walk sheet: row 0=down, 1=up, 2=left, 3=right | Actions sheet: row 0=working, 1=sleeping, 2=talking, 3=idle
interface SpriteState {
  x: number;
  targetX: number;
  y: number;
  direction: 'left' | 'right';
  phase: 'idle' | 'walking' | 'working' | 'hovered' | 'done' | 'resting' | 'eating';
  idleTimer: number;
  walkImg: HTMLImageElement | null;
  actionsImg: HTMLImageElement | null;
  doneImg: HTMLImageElement | null;
  eatingImg: HTMLImageElement | null;
  hoverBounce: number;
  doneStartFrame: number;
  lastActiveTime: number;
  eatingStartFrame: number;
  groundOffset: number; // vertical offset on terrain (0 = ground line)
}

interface DigimonClientData {
  agentId: string;
  affinity: number;
  foodSchedule: { meals: [string, string, string] };
  lastFedDates: string[];
  phrases: {
    tier1: string[]; tier2: string[]; tier3: string[];
    tier4: string[]; tier5: string[]; tier6: string[];
  };
}

interface SpeechBubble {
  text: string;
  startTime: number;
  duration: number;  // ms
}

interface FoodIconState {
  mealIndex: number;
  bouncePhase: number;
}

// ─── Constants ──────────────────────────────────────────
const SPRITE_SIZE = 64;
const SCALE = 2;
const DRAW_SIZE = SPRITE_SIZE * SCALE;
const GROUND_Y = 0.65; // ground at 65% of canvas height (elevated)
const WALK_SPEED = 1.2;
const IDLE_MIN = 3000;
const IDLE_MAX = 8000;

// Speech bubble frequency per tier (ms between phrases)
const SPEECH_INTERVALS: Record<number, number> = { 1: 120000, 2: 60000, 3: 40000, 4: 25000, 5: 15000, 6: 8000 };
const SPEECH_DURATION_MIN = 3000;
const SPEECH_DURATION_MAX = 5000;
const EATING_DURATION_FRAMES = 24; // ~2s at 12fps

// Per-agent sprite configuration (defaults: walkFrames=4, doneFrames=10)
const RESTING_TIMEOUT = 60000; // 1 minute without interaction → resting
const SPRITE_CONFIG: Record<string, { walkFrames?: number; doneFrames?: number; workingBounce?: boolean; frameHeight?: number; flipRight?: boolean; doneClamp?: boolean; doneLoopFrom?: number; yOffsets?: { idle?: number; walking?: number; working?: number; hovered?: number; done?: number; resting?: number; eating?: number } }> = {
};

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(img); // still resolve so we don't break
    img.src = src;
  });
}

// ─── Page ───────────────────────────────────────────────
export default function WorldPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const MAX_BLOCKS_PER_AGENT = 50;
  const [chatHistories, setChatHistories] = useState<Record<string, ChatBlock[]>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [streamingAgents, setStreamingAgents] = useState<Set<string>>(new Set());
  const [externalMessage, setExternalMessage] = useState<{ agentId: string; text: string } | null>(null);
  const [tasksOpen, setTasksOpen] = useState(false);
  const [feedingOpen, setFeedingOpen] = useState(false);
  const [initialTaskId, setInitialTaskId] = useState<string | null>(null);
  const [agentProjectMap, setAgentProjectMap] = useState<Record<string, string>>({});
  const [hiddenAgents, setHiddenAgents] = useState<Set<string>>(new Set());

  // Digimon data (affinity, food, phrases)
  const digimonDataRef = useRef<Record<string, DigimonClientData>>({});
  const speechBubblesRef = useRef<Map<string, SpeechBubble>>(new Map());
  const speechTimersRef = useRef<Map<string, number>>(new Map());
  const foodIconsRef = useRef<Map<string, FoodIconState>>(new Map());

  // Restore hidden agents after mount (avoids SSR hydration mismatch)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('world_hidden_agents');
      if (saved) setHiddenAgents(new Set(JSON.parse(saved)));
    } catch { /* use default */ }
  }, []);
  const hiddenAgentsRef = useRef(hiddenAgents);
  hiddenAgentsRef.current = hiddenAgents;
  const prevTextCounts = useRef<Record<string, number>>({});

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const spritesRef = useRef<Map<string, SpriteState>>(new Map());
  const frameRef = useRef(0);
  const animRef = useRef(0);
  const hoveredAgentRef = useRef<string | null>(null);
  const activeAgentRef = useRef<string | null>(null);
  activeAgentRef.current = activeAgent;

  const toggleAgentVisibility = useCallback((agentId: string) => {
    setHiddenAgents(prev => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else {
        next.add(agentId);
        // Deselect if hiding the active agent
        if (activeAgent === agentId) setActiveAgent(null);
      }
      localStorage.setItem('world_hidden_agents', JSON.stringify([...next]));
      return next;
    });
  }, [activeAgent]);
  const streamingAgentsRef = useRef(streamingAgents);
  streamingAgentsRef.current = streamingAgents;
  const unreadRef = useRef(unread);
  unreadRef.current = unread;

  // Load agents
  useEffect(() => {
    (async () => {
      try {
        const [worldRes, linksRes, structsRes] = await Promise.all([
          fetch('/api/world').then(r => r.json()),
          fetch('/api/agent-links').then(r => r.json()),
          fetch('/api/project-structures').then(r => r.json()),
        ]);
        const citizens = worldRes.citizens || [];
        const loaded: Agent[] = citizens.map((c: any) => ({
          agentId: c.agentId,
          name: c.name,
          sprite: c.sprite,
          projectPath: linksRes[c.agentId]?.projectPath || '',
          scale: c.scale ?? 1.0,
          flipWalk: c.flipWalk ?? true,
          frameConfig: c.frameConfig,
          avatarCrop: c.avatarCrop,
        }));
        setAgents(loaded);

        // Build agentId → projectStructureId map
        const projMap: Record<string, string> = {};
        for (const s of structsRes as ProjectStructure[]) {
          projMap[s.agentId] = s.id;
        }
        setAgentProjectMap(projMap);

        // Load digimon data (affinity, food, phrases)
        try {
          const digiRes = await fetch('/api/digimon-data');
          const digiData = await digiRes.json();
          digimonDataRef.current = digiData;
        } catch { /* ignore */ }

        // Load sprite images — spread across the terrain
        const cW = containerRef.current?.clientWidth || window.innerWidth;
        // All citizens share the same Y baseline (groundOffset = 0)
        const cols = Math.min(loaded.length, Math.max(3, Math.floor(cW / 160)));
        const colSpacing = (cW - 120) / Math.max(cols, 1);

        for (let i = 0; i < loaded.length; i++) {
          const a = loaded[i];
          const [walkImg, actionsImg, doneImg, eatingImg] = await Promise.all([
            loadImg(`/api/assets/universal_assets/citizens/${a.sprite}_walk.png`),
            loadImg(`/api/assets/universal_assets/citizens/${a.sprite}_actions.png`),
            loadImg(`/api/assets/universal_assets/citizens/${a.sprite}_done.png`),
            loadImg(`/api/assets/universal_assets/citizens/${a.sprite}_eating.png`),
          ]);
          const col = i % cols;
          const row = Math.floor(i / cols);
          const initX = 60 + col * colSpacing + (row % 2 === 1 ? colSpacing * 0.4 : 0);
          spritesRef.current.set(a.agentId, {
            x: initX,
            targetX: initX,
            y: 0,
            direction: 'right',
            phase: 'idle',
            idleTimer: Math.random() * IDLE_MAX,
            walkImg,
            actionsImg,
            doneImg,
            eatingImg,
            hoverBounce: 0,
            doneStartFrame: 0,
            lastActiveTime: Date.now(),
            eatingStartFrame: 0,
            groundOffset: 0,
          });
        }
      } catch {}
    })();
  }, []);

  // Track unread
  useEffect(() => {
    for (const a of agents) {
      const blocks = chatHistories[a.agentId] || [];
      const textCount = blocks.filter(b => b.type === 'text').length;
      const prev = prevTextCounts.current[a.agentId] || 0;
      if (activeAgent !== a.agentId && textCount > prev) {
        setUnread(u => ({ ...u, [a.agentId]: (u[a.agentId] || 0) + textCount - prev }));
      }
      prevTextCounts.current[a.agentId] = textCount;
    }
  }, [chatHistories, agents, activeAgent]);

  // Track which agents are streaming (working)
  useEffect(() => {
    const streaming = new Set<string>();
    for (const a of agents) {
      const blocks = chatHistories[a.agentId] || [];
      if (blocks.length === 0) continue;
      const last = blocks[blocks.length - 1];
      // Agent is working if the last block is NOT a final result or user message
      if (last.type === 'thinking' || last.type === 'tool_use' || last.type === 'tool_result') {
        streaming.add(a.agentId);
      }
      // Also working if last is text but no result block exists after the last user message
      if (last.type === 'text') {
        const lastUserIdx = blocks.map((b, i) => b.type === 'user' ? i : -1).filter(i => i >= 0).pop() ?? -1;
        const lastResultIdx = blocks.map((b, i) => b.type === 'result' ? i : -1).filter(i => i >= 0).pop() ?? -1;
        if (lastUserIdx >= 0 && lastResultIdx < lastUserIdx) {
          streaming.add(a.agentId);
        }
      }
    }
    setStreamingAgents(streaming);
  }, [chatHistories, agents]);

  // ─── Memory usage estimation ──────────────────────────
  const updateMemoryUsage = useAppStore(s => s.updateMemoryUsage);

  useEffect(() => {
    let totalBytes = 0;
    let totalBlocks = 0;
    for (const agentId of Object.keys(chatHistories)) {
      const blocks = chatHistories[agentId];
      totalBlocks += blocks.length;
      for (const b of blocks) {
        // Rough estimate: content length * 2 (UTF-16) + object overhead
        totalBytes += (b.content?.length || 0) * 2 + 200;
        if (b.input) totalBytes += JSON.stringify(b.input).length * 2;
      }
    }
    updateMemoryUsage(totalBytes, totalBlocks);
  }, [chatHistories, updateMemoryUsage]);

  // ─── Canvas Animation Loop ────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };
    resize();
    const obs = new ResizeObserver(resize);
    obs.observe(container);

    let lastTime = 0;

    const render = (time: number) => {
      const dt = time - lastTime;
      if (dt >= 80) { // ~12fps
        lastTime = time;
        frameRef.current++;
        const W = canvas.width;
        const H = canvas.height;
        const groundY = H * GROUND_Y;

        ctx.clearRect(0, 0, W, H);

        // ── Time-based day/night cycle (Ecuador UTC-5) ──
        const now = new Date();
        const utcH = now.getUTCHours() + now.getUTCMinutes() / 60;
        const ecH = ((utcH - 5) + 24) % 24; // Ecuador time as float (0-24)

        // Sun/moon angle: 0=midnight(bottom), 0.5=noon(top), 1=midnight
        const dayProgress = ecH / 24;
        // Arc angle: 0 at sunrise(6h), PI at sunset(18h)
        const sunAngle = ((ecH - 6) / 12) * Math.PI; // 0 to PI during day
        const moonAngle = ((ecH - 18) / 12) * Math.PI; // 0 to PI during night

        // Day intensity: 0=full night, 1=full day
        // Smooth transitions: dawn 5-7, dusk 17-19
        let dayIntensity = 0;
        if (ecH >= 7 && ecH <= 17) dayIntensity = 1;
        else if (ecH > 5 && ecH < 7) dayIntensity = (ecH - 5) / 2;
        else if (ecH > 17 && ecH < 19) dayIntensity = 1 - (ecH - 17) / 2;

        // Sky colors interpolated by dayIntensity
        const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
        const lerpColor = (night: number[], day: number[], t: number) =>
          `rgb(${Math.round(lerp(night[0], day[0], t))},${Math.round(lerp(night[1], day[1], t))},${Math.round(lerp(night[2], day[2], t))})`;

        // Dawn/dusk warm tint
        let warmTint = 0;
        if (ecH > 5 && ecH < 7) warmTint = 1 - Math.abs(ecH - 6);
        if (ecH > 17 && ecH < 19) warmTint = 1 - Math.abs(ecH - 18);

        const skyTop = warmTint > 0.3
          ? lerpColor([10, 14, 26], [180, 80, 40], warmTint * 0.7)
          : lerpColor([10, 14, 26], [70, 130, 200], dayIntensity);
        const skyMid = warmTint > 0.3
          ? lerpColor([15, 22, 40], [220, 120, 50], warmTint * 0.6)
          : lerpColor([15, 22, 40], [120, 180, 230], dayIntensity);
        const skyBottom = warmTint > 0.3
          ? lerpColor([20, 30, 48], [240, 160, 80], warmTint * 0.5)
          : lerpColor([20, 30, 48], [180, 210, 240], dayIntensity);

        const skyGrad = ctx.createLinearGradient(0, 0, 0, groundY);
        skyGrad.addColorStop(0, skyTop);
        skyGrad.addColorStop(0.5, skyMid);
        skyGrad.addColorStop(1, skyBottom);
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, groundY);

        // ── Sun (visible 6h-18h) ──
        if (ecH >= 5.5 && ecH <= 18.5) {
          const sx = lerp(W * 0.1, W * 0.9, (ecH - 5.5) / 13);
          const arcH = groundY * 0.8;
          const sy = groundY - Math.sin(sunAngle) * arcH;

          // Glow
          const glowR = 40 + dayIntensity * 30;
          const glowGrad = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR * 2);
          glowGrad.addColorStop(0, `rgba(255, 200, 50, ${0.3 * dayIntensity})`);
          glowGrad.addColorStop(0.5, `rgba(255, 150, 30, ${0.1 * dayIntensity})`);
          glowGrad.addColorStop(1, 'rgba(255, 150, 30, 0)');
          ctx.fillStyle = glowGrad;
          ctx.fillRect(sx - glowR * 2, sy - glowR * 2, glowR * 4, glowR * 4);

          // Sun body
          ctx.fillStyle = warmTint > 0.3 ? '#ff6030' : '#ffe066';
          ctx.beginPath();
          ctx.arc(sx, sy, 14 + dayIntensity * 6, 0, Math.PI * 2);
          ctx.fill();

          // Rays
          ctx.strokeStyle = `rgba(255, 220, 80, ${0.2 * dayIntensity})`;
          ctx.lineWidth = 1.5;
          for (let r = 0; r < 8; r++) {
            const ra = (r / 8) * Math.PI * 2 + frameRef.current * 0.01;
            const r1 = 22 + dayIntensity * 6;
            const r2 = r1 + 6 + Math.sin(frameRef.current * 0.03 + r) * 3;
            ctx.beginPath();
            ctx.moveTo(sx + Math.cos(ra) * r1, sy + Math.sin(ra) * r1);
            ctx.lineTo(sx + Math.cos(ra) * r2, sy + Math.sin(ra) * r2);
            ctx.stroke();
          }
        }

        // ── Moon (visible 18h-6h) ──
        if (ecH >= 18 || ecH <= 6) {
          const moonH = ecH >= 18 ? ecH - 18 : ecH + 6; // 0-12 during night
          const mx = lerp(W * 0.15, W * 0.85, moonH / 12);
          const arcH = groundY * 0.7;
          const my = groundY - Math.sin((moonH / 12) * Math.PI) * arcH;

          // Moon glow
          const moonGlow = ctx.createRadialGradient(mx, my, 0, mx, my, 40);
          moonGlow.addColorStop(0, 'rgba(180, 200, 255, 0.15)');
          moonGlow.addColorStop(1, 'rgba(180, 200, 255, 0)');
          ctx.fillStyle = moonGlow;
          ctx.fillRect(mx - 40, my - 40, 80, 80);

          // Moon body
          ctx.fillStyle = '#e0e8f0';
          ctx.beginPath();
          ctx.arc(mx, my, 10, 0, Math.PI * 2);
          ctx.fill();
          // Crescent shadow
          ctx.fillStyle = skyTop;
          ctx.beginPath();
          ctx.arc(mx + 4, my - 2, 8, 0, Math.PI * 2);
          ctx.fill();
        }

        // ── Stars (fade out during day) ──
        const starAlpha = Math.max(0, 1 - dayIntensity * 1.5);
        if (starAlpha > 0) {
          ctx.fillStyle = '#ffffff';
          for (let i = 0; i < 50; i++) {
            const sx = ((i * 137 + 50) % W);
            const sy = ((i * 97 + 30) % (groundY * 0.7));
            const size = (i % 3 === 0) ? 1.5 : 0.8;
            ctx.globalAlpha = starAlpha * (0.3 + 0.3 * Math.sin(frameRef.current * 0.05 + i));
            ctx.fillRect(sx, sy, size, size);
          }
          ctx.globalAlpha = 1;
        }

        // ── Clouds (subtle, move slowly) ──
        ctx.globalAlpha = 0.08 + dayIntensity * 0.12;
        ctx.fillStyle = dayIntensity > 0.5 ? '#ffffff' : '#8090a0';
        for (let c = 0; c < 5; c++) {
          const cx = ((c * 200 + frameRef.current * 0.15 * (c % 2 === 0 ? 1 : 0.7)) % (W + 100)) - 50;
          const cy = 30 + c * 25 + Math.sin(c * 3) * 15;
          ctx.beginPath();
          ctx.ellipse(cx, cy, 35 + c * 5, 8 + c * 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(cx + 20, cy - 5, 25, 7, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;

        // ── Ground (digital terrain with depth) ──
        // Main ground gradient — richer green during day, darker at night
        const groundTop = lerpColor([20, 30, 42], [55, 105, 55], dayIntensity * 0.6);
        const groundMid = lerpColor([15, 22, 32], [40, 75, 40], dayIntensity * 0.4);
        const groundBot = lerpColor([8, 12, 18], [22, 40, 25], dayIntensity * 0.3);
        const groundGrad = ctx.createLinearGradient(0, groundY, 0, H);
        groundGrad.addColorStop(0, groundTop);
        groundGrad.addColorStop(0.3, groundMid);
        groundGrad.addColorStop(1, groundBot);
        ctx.fillStyle = groundGrad;
        ctx.fillRect(0, groundY, W, H - groundY);

        // Digital grid pattern on ground (digimon-style)
        ctx.strokeStyle = `rgba(29, 158, 117, ${0.04 + dayIntensity * 0.06})`;
        ctx.lineWidth = 0.5;
        const gridSpacing = 24;
        for (let gy = groundY + gridSpacing; gy < H; gy += gridSpacing) {
          const fade = 1 - (gy - groundY) / (H - groundY);
          ctx.globalAlpha = fade * (0.04 + dayIntensity * 0.06);
          ctx.beginPath();
          ctx.moveTo(0, gy);
          ctx.lineTo(W, gy);
          ctx.stroke();
        }
        for (let gx = 0; gx < W; gx += gridSpacing) {
          ctx.globalAlpha = 0.02 + dayIntensity * 0.03;
          ctx.beginPath();
          ctx.moveTo(gx, groundY);
          ctx.lineTo(gx, H);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Ground edge — glowing line with shadow
        const edgeGlow = ctx.createLinearGradient(0, groundY - 4, 0, groundY + 6);
        edgeGlow.addColorStop(0, 'rgba(29, 158, 117, 0)');
        edgeGlow.addColorStop(0.4, `rgba(29, 158, 117, ${0.15 + dayIntensity * 0.2})`);
        edgeGlow.addColorStop(0.5, `rgba(29, 158, 117, ${0.3 + dayIntensity * 0.3})`);
        edgeGlow.addColorStop(0.6, `rgba(29, 158, 117, ${0.15 + dayIntensity * 0.15})`);
        edgeGlow.addColorStop(1, 'rgba(29, 158, 117, 0)');
        ctx.fillStyle = edgeGlow;
        ctx.fillRect(0, groundY - 4, W, 10);

        // Ground line
        ctx.strokeStyle = `rgba(29, 158, 117, ${0.4 + dayIntensity * 0.3})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        ctx.lineTo(W, groundY);
        ctx.stroke();

        // Shadow below ground line
        const shadowGrad = ctx.createLinearGradient(0, groundY, 0, groundY + 20);
        shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.3)');
        shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = shadowGrad;
        ctx.fillRect(0, groundY, W, 20);

        // ── Nature assets (behind sprites) ──
        ctx.imageSmoothingEnabled = false;

        // Seed-based positions so they don't move between frames
        const seed = (i: number) => ((i * 9301 + 49297) % 233280) / 233280;

        // Grass tufts along ground line
        for (let i = 0; i < 30; i++) {
          const gx = seed(i * 3) * W;
          const gy = groundY - 2;
          const h = 4 + seed(i * 3 + 1) * 6;
          const green = dayIntensity > 0.3
            ? `rgba(${40 + seed(i) * 30}, ${120 + seed(i + 1) * 80}, ${40 + seed(i + 2) * 30}, ${0.4 + dayIntensity * 0.3})`
            : `rgba(20, ${50 + seed(i) * 30}, 30, 0.3)`;
          ctx.fillStyle = green;
          ctx.fillRect(gx, gy - h, 2, h);
          ctx.fillRect(gx - 2, gy - h + 2, 2, h - 2);
          ctx.fillRect(gx + 2, gy - h + 1, 2, h - 1);
        }

        // Background trees (far, small, subtle)
        for (let i = 0; i < 6; i++) {
          const tx = seed(i * 7 + 100) * W;
          const treeH = 30 + seed(i * 7 + 101) * 25;
          const ty = groundY - treeH;
          const trunkW = 4;
          const crownR = 12 + seed(i * 7 + 102) * 10;
          const depth = 0.25 + seed(i * 7 + 103) * 0.15; // far away = subtle

          // Trunk
          ctx.fillStyle = dayIntensity > 0.3
            ? `rgba(80, 55, 35, ${depth})`
            : `rgba(30, 20, 15, ${depth})`;
          ctx.fillRect(tx - trunkW / 2, ty + crownR * 0.6, trunkW, treeH - crownR * 0.6);

          // Crown layers (overlapping circles for fullness)
          const leafColor = dayIntensity > 0.3
            ? [30 + seed(i) * 20, 100 + seed(i + 1) * 60, 30 + seed(i + 2) * 20]
            : [15, 40 + seed(i) * 20, 20];
          ctx.fillStyle = `rgba(${leafColor[0]}, ${leafColor[1]}, ${leafColor[2]}, ${depth + 0.1})`;
          ctx.beginPath();
          ctx.arc(tx, ty + crownR * 0.5, crownR, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(${leafColor[0] + 15}, ${leafColor[1] + 20}, ${leafColor[2] + 10}, ${depth})`;
          ctx.beginPath();
          ctx.arc(tx - crownR * 0.4, ty + crownR * 0.7, crownR * 0.7, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(tx + crownR * 0.4, ty + crownR * 0.6, crownR * 0.75, 0, Math.PI * 2);
          ctx.fill();
        }

        // Bushes (foreground, on ground)
        for (let i = 0; i < 8; i++) {
          const bx = seed(i * 5 + 200) * W;
          const by = groundY;
          const bw = 15 + seed(i * 5 + 201) * 15;
          const bh = 8 + seed(i * 5 + 202) * 8;
          const bushColor = dayIntensity > 0.3
            ? `rgba(${35 + seed(i) * 25}, ${90 + seed(i + 50) * 70}, ${30 + seed(i + 51) * 20}, ${0.5 + dayIntensity * 0.3})`
            : `rgba(20, ${40 + seed(i) * 20}, 25, 0.35)`;
          ctx.fillStyle = bushColor;
          ctx.beginPath();
          ctx.ellipse(bx, by - bh / 2, bw / 2, bh / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          // Highlight
          ctx.fillStyle = dayIntensity > 0.3
            ? `rgba(60, ${160 + seed(i) * 40}, 50, 0.2)`
            : `rgba(25, 55, 30, 0.15)`;
          ctx.beginPath();
          ctx.ellipse(bx - bw * 0.15, by - bh * 0.6, bw * 0.3, bh * 0.25, 0, 0, Math.PI * 2);
          ctx.fill();
        }

        // Flowers (small colorful dots)
        for (let i = 0; i < 15; i++) {
          const fx = seed(i * 4 + 300) * W;
          const fy = groundY - 1 - seed(i * 4 + 301) * 5;
          const colors = ['#ff6b8a', '#ffb347', '#87ceeb', '#dda0dd', '#f0e68c', '#ff69b4'];
          const color = colors[Math.floor(seed(i * 4 + 302) * colors.length)];
          const fAlpha = dayIntensity > 0.3 ? 0.6 + dayIntensity * 0.3 : 0.15;
          ctx.globalAlpha = fAlpha;
          // Stem
          ctx.fillStyle = dayIntensity > 0.3 ? '#3a7a3a' : '#1a3a1a';
          ctx.fillRect(fx, fy, 1, 3 + seed(i) * 3);
          // Petals
          ctx.fillStyle = color;
          const ps = 2;
          ctx.fillRect(fx - ps, fy - 1, ps, ps);
          ctx.fillRect(fx + 1, fy - 1, ps, ps);
          ctx.fillRect(fx, fy - ps - 1, ps, ps);
          ctx.fillRect(fx, fy + 1, ps, ps);
          // Center
          ctx.fillStyle = '#fff';
          ctx.fillRect(fx, fy, 1, 1);
        }
        ctx.globalAlpha = 1;

        // Distant mountains/hills silhouette
        ctx.fillStyle = dayIntensity > 0.3
          ? `rgba(40, 70, 50, ${0.15 + dayIntensity * 0.1})`
          : `rgba(15, 25, 20, 0.3)`;
        ctx.beginPath();
        ctx.moveTo(0, groundY);
        for (let mx = 0; mx <= W; mx += 3) {
          const mh = Math.sin(mx * 0.005) * 30 + Math.sin(mx * 0.012 + 2) * 20 + Math.sin(mx * 0.003 + 5) * 15;
          ctx.lineTo(mx, groundY - 20 - Math.max(0, mh));
        }
        ctx.lineTo(W, groundY);
        ctx.closePath();
        ctx.fill();

        // ── Time display ──
        const hh = Math.floor(ecH);
        const mm = Math.floor((ecH % 1) * 60);
        const timeStr = `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillStyle = `rgba(255,255,255,${0.2 + dayIntensity * 0.15})`;
        ctx.fillText(timeStr + ' EC', W - 10, 16);

        // ── Sprites ──
        const sprites = spritesRef.current;
        for (const a of agents) {
          const s = sprites.get(a.agentId);
          if (!s) continue;

          const isAgentHidden = hiddenAgentsRef.current.has(a.agentId);
          const isWorking = streamingAgentsRef.current.has(a.agentId);
          const isHovered = isAgentHidden ? false : hoveredAgentRef.current === a.agentId;
          const baseY = groundY - DRAW_SIZE + 40 + s.groundOffset;
          s.y = baseY;

          // Behavior — eating takes priority after food icon click
          if (s.phase === 'eating') {
            // Stay in eating until animation completes
            if (frameRef.current - s.eatingStartFrame > EATING_DURATION_FRAMES) {
              s.phase = 'idle';
              s.idleTimer = IDLE_MIN + Math.random() * (IDLE_MAX - IDLE_MIN);
              s.lastActiveTime = Date.now();
            }
          } else if (isWorking) {
            s.phase = 'working';
            s.targetX = s.x;
            s.hoverBounce = 0;
          } else if (s.phase === 'working' && !isWorking) {
            // Just finished working → enter done phase
            s.phase = 'done';
            s.hoverBounce = 0;
            s.doneStartFrame = frameRef.current;
            // Play task-complete sound
            import('@/lib/digimon-sounds').then(m => m.playDigimonDone(a.sprite));
          } else if (s.phase === 'done' && activeAgentRef.current === a.agentId) {
            // User opened this chat → exit done phase
            s.phase = 'idle';
            s.idleTimer = IDLE_MIN + Math.random() * (IDLE_MAX - IDLE_MIN);
          } else if (isHovered && s.phase !== 'hovered' && s.phase !== 'done') {
            s.phase = 'hovered';
            s.hoverBounce = 0;
            s.targetX = s.x;
          } else if (!isHovered && s.phase === 'hovered') {
            s.phase = 'idle';
            s.lastActiveTime = Date.now();
            s.idleTimer = IDLE_MIN + Math.random() * (IDLE_MAX - IDLE_MIN);
          }

          if (!isWorking && s.phase !== 'hovered') {
            // Resting: wake up on any interaction
            if (s.phase === 'resting' && (isHovered || activeAgentRef.current === a.agentId)) {
              s.phase = 'idle';
              s.lastActiveTime = Date.now();
              s.idleTimer = IDLE_MIN + Math.random() * (IDLE_MAX - IDLE_MIN);
            }
            if (s.phase === 'idle') {
              s.idleTimer -= dt;
              // After 1 min without interaction → rest
              if (Date.now() - s.lastActiveTime > RESTING_TIMEOUT) {
                s.phase = 'resting';
              } else if (s.idleTimer <= 0) {
                s.targetX = 60 + Math.random() * (W - 120);
                s.phase = 'walking';
                s.lastActiveTime = Date.now();
                s.direction = s.targetX > s.x ? 'right' : 'left';
              }
            } else if (s.phase === 'walking') {
              const dx = s.targetX - s.x;
              if (Math.abs(dx) < WALK_SPEED * 2) {
                s.x = s.targetX;
                s.phase = 'idle';
                s.idleTimer = IDLE_MIN + Math.random() * (IDLE_MAX - IDLE_MIN);
              } else {
                s.x += (dx > 0 ? WALK_SPEED : -WALK_SPEED);
                s.direction = dx > 0 ? 'right' : 'left';
              }
            }
          }

          // Hover counter (for sparkle effects)
          if (s.phase === 'hovered') {
            s.hoverBounce += 0.08;
          }

          // Draw sprite — ghost mode if hidden
          if (isAgentHidden) ctx.globalAlpha = 0.12;
          let sheet: HTMLImageElement | null;
          let row: number;
          let frames: number;
          let speed: number;
          const sprCfg = SPRITE_CONFIG[a.sprite] || {};

          // Map phase to frameConfig key
          const phaseToConfigKey: Record<string, string> = {
            eating: 'eating', done: 'done', working: 'work',
            hovered: 'excited', walking: 'walk', resting: 'rest', idle: 'idle',
          };
          const cfgKey = phaseToConfigKey[s.phase] || 'idle';
          const activeFrames = a.frameConfig?.[cfgKey];

          if (s.phase === 'eating') {
            sheet = s.eatingImg;
            row = 0;
            frames = activeFrames?.length || 4;
            speed = 3;
          } else if (s.phase === 'done') {
            sheet = s.doneImg;
            row = 0;
            frames = activeFrames?.length || sprCfg.doneFrames || 4;
            speed = 3;
          } else if (s.phase === 'working') {
            sheet = s.actionsImg;
            row = 0;
            frames = activeFrames?.length || 4;
            speed = 3;
          } else if (s.phase === 'hovered') {
            sheet = s.actionsImg;
            row = 2;
            frames = activeFrames?.length || 4;
            speed = 4;
          } else if (s.phase === 'walking') {
            sheet = s.walkImg;
            row = 2; // always use walk-left row, flip via canvas for right
            frames = activeFrames?.length || sprCfg.walkFrames || 4;
            speed = 3;
          } else if (s.phase === 'resting') {
            sheet = s.actionsImg;
            row = 1; // sleeping/resting row
            frames = activeFrames?.length || 4;
            speed = 6; // slow animation
          } else {
            sheet = s.actionsImg;
            row = 3; // idle row
            frames = activeFrames?.length || 4;
            speed = 3;
          }

          // Hover glow under sprite
          if (isHovered) {
            const glowAlpha = 0.15 + 0.08 * Math.sin(frameRef.current * 0.1);
            ctx.fillStyle = `rgba(29, 158, 117, ${glowAlpha})`;
            ctx.beginPath();
            ctx.ellipse(s.x, baseY + DRAW_SIZE - 2, DRAW_SIZE * 0.45, 8, 0, 0, Math.PI * 2);
            ctx.fill();
          }

          // Per-agent scale from world config (editable in sprites page)
          const agentScale = a.scale;
          const fh = sprCfg.frameHeight || SPRITE_SIZE;
          const aspectRatio = fh / SPRITE_SIZE;
          const drawW = DRAW_SIZE * agentScale;
          const drawH = DRAW_SIZE * agentScale * aspectRatio;
          const phaseYOffset = sprCfg.yOffsets?.[s.phase] ?? 0;
          const spriteTopY = s.y + DRAW_SIZE - drawH + phaseYOffset;

          if (sheet && sheet.complete && sheet.naturalWidth > 0) {
            let frame: number;
            if (sprCfg.doneClamp && s.phase === 'done') {
              // Play once, then loop from doneLoopFrom (or stay on last frame)
              const elapsed = Math.floor((frameRef.current - s.doneStartFrame) / speed);
              const loopFrom = sprCfg.doneLoopFrom ?? frames;
              if (elapsed < frames) {
                frame = elapsed;
              } else if (loopFrom < frames) {
                const loopLen = frames - loopFrom;
                frame = loopFrom + (elapsed - frames) % loopLen;
              } else {
                frame = frames - 1;
              }
            } else if (sprCfg.workingBounce && s.phase === 'working' && frames > 1) {
              // Ping-pong: 0,1,2,3,2,1,0,1,2,3,...
              const cycle = 2 * (frames - 1);
              const pos = Math.floor(frameRef.current / speed) % cycle;
              frame = pos < frames ? pos : cycle - pos;
            } else {
              frame = Math.floor(frameRef.current / speed) % frames;
            }
            // Map logical frame index to actual sprite column using frameConfig
            const actualFrame = activeFrames ? (activeFrames[frame] ?? frame) : frame;
            const sx = actualFrame * SPRITE_SIZE;
            const sy = row * fh;
            ctx.imageSmoothingEnabled = false;
            // Flip walk direction based on per-agent config
            const shouldFlip = s.phase === 'walking' && (
              a.flipWalk ? s.direction === 'left' : s.direction === 'right'
            );
            if (shouldFlip) {
              ctx.save();
              ctx.translate(s.x, 0);
              ctx.scale(-1, 1);
              ctx.drawImage(sheet, sx, sy, SPRITE_SIZE, fh, -drawW / 2, spriteTopY, drawW, drawH);
              ctx.restore();
            } else {
              ctx.drawImage(sheet, sx, sy, SPRITE_SIZE, fh, s.x - drawW / 2, spriteTopY, drawW, drawH);
            }
          }

          if (isAgentHidden) { ctx.globalAlpha = 1; continue; } // Skip labels for hidden agents

          // Name label — fixed distance above ground line for all agents
          const namePad = 22;
          const nameY = baseY - namePad;
          ctx.font = '11px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          const nameText = isHovered ? `> ${a.name} <` : a.name;
          const nameW = ctx.measureText(nameText).width + 12;

          const isDone = s.phase === 'done';
          const statusColor = isWorking ? '#f472b6' : isDone ? '#fbbf24' : isHovered ? '#4ade80' : '#1D9E75';
          const statusText = isWorking ? 'working...' : isDone ? 'task complete!' : isHovered ? 'click to chat!' : s.phase === 'resting' ? 'zzz...' : s.phase === 'walking' ? 'wandering' : 'idle';

          // Name bg
          ctx.fillStyle = isHovered ? 'rgba(29, 158, 117, 0.3)' : 'rgba(0,0,0,0.7)';
          ctx.beginPath();
          ctx.roundRect(s.x - nameW / 2, nameY, nameW, 16, 4);
          ctx.fill();
          if (isHovered) {
            ctx.strokeStyle = '#1D9E75';
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          // Name text
          ctx.fillStyle = statusColor;
          ctx.fillText(nameText, s.x, nameY + 12);

          // Project name below name label
          const projectName = a.projectPath ? a.projectPath.split('/').pop() : '';
          if (projectName) {
            ctx.font = '9px "JetBrains Mono", monospace';
            ctx.fillStyle = '#484f58';
            ctx.globalAlpha = 0.7;
            ctx.fillText(projectName, s.x, nameY + 24);
            ctx.globalAlpha = 1;
          }

          // Status text below
          ctx.font = '9px "JetBrains Mono", monospace';
          ctx.fillStyle = isWorking ? '#f472b6' : isHovered ? '#4ade80' : '#484f58';
          ctx.globalAlpha = isWorking ? 0.5 + 0.5 * Math.sin(frameRef.current * 0.15) : isHovered ? 0.9 : 0.6;
          ctx.fillText(statusText, s.x, baseY + DRAW_SIZE + 14);
          ctx.globalAlpha = 1;

          // Hover sparkles
          if (isHovered) {
            ctx.fillStyle = '#4ade80';
            for (let p = 0; p < 5; p++) {
              const angle = s.hoverBounce * 1.5 + p * (Math.PI * 2 / 5);
              const dist = 30 + Math.sin(s.hoverBounce * 2 + p) * 10;
              const px = s.x + Math.cos(angle) * dist;
              const py = s.y + DRAW_SIZE / 2 + Math.sin(angle) * dist * 0.5;
              const sparkSize = 1.5 + Math.sin(s.hoverBounce * 3 + p * 2) * 1;
              ctx.globalAlpha = 0.3 + 0.3 * Math.sin(s.hoverBounce * 4 + p);
              ctx.fillRect(px, py, sparkSize, sparkSize);
            }
            ctx.globalAlpha = 1;
          }

          // Unread badge
          const n = unreadRef.current[a.agentId] || 0;
          if (n > 0) {
            const bx = s.x + DRAW_SIZE / 2 - 5;
            const by = s.y - 5;
            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            ctx.arc(bx, by, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(n), bx, by);
            ctx.textBaseline = 'alphabetic';
          }

          // Working particles
          if (isWorking) {
            ctx.fillStyle = '#f472b6';
            for (let p = 0; p < 3; p++) {
              const px = s.x - 15 + Math.sin(frameRef.current * 0.1 + p * 2) * 20;
              const py = s.y + 10 + Math.cos(frameRef.current * 0.08 + p * 3) * 15;
              ctx.globalAlpha = 0.3 + 0.2 * Math.sin(frameRef.current * 0.2 + p);
              ctx.fillRect(px, py, 2, 2);
            }
            ctx.globalAlpha = 1;
          }

          // ── Food icon + Speech bubble (affinity bar only on top bubbles) ──
          const dData = digimonDataRef.current[a.agentId];
          if (dData) {
            // ── Food icon (bouncing) ──
            const nowMs = Date.now();
            const nowDate = new Date();
            const todayStr = nowDate.toISOString().split('T')[0];
            const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();

            for (let mi = 0; mi < 3; mi++) {
              const mealStr = dData.foodSchedule.meals[mi];
              if (!mealStr) continue;
              const [mh, mm] = mealStr.split(':').map(Number);
              const mealMin = mh * 60 + mm;
              const diff = nowMinutes - mealMin;
              const fedKey = `${todayStr}_${mi}`;
              const alreadyFed = dData.lastFedDates.includes(fedKey);

              if (diff >= 0 && diff < 180 && !alreadyFed && s.phase !== 'eating') {
                // Show food icon above sprite
                const bounce = Math.sin(frameRef.current * 0.15) * 4;
                const iconX = s.x;
                const iconY = s.y - 10 + bounce;

                // Store food icon state for hit testing
                foodIconsRef.current.set(a.agentId, { mealIndex: mi, bouncePhase: bounce });

                // Draw pixel-art food icon (small apple/meat)
                ctx.fillStyle = '#ff6347'; // tomato red
                ctx.beginPath();
                ctx.arc(iconX, iconY, 7, 0, Math.PI * 2);
                ctx.fill();
                // Highlight
                ctx.fillStyle = '#ff8c69';
                ctx.beginPath();
                ctx.arc(iconX - 2, iconY - 2, 3, 0, Math.PI * 2);
                ctx.fill();
                // Stem
                ctx.fillStyle = '#228b22';
                ctx.fillRect(iconX - 1, iconY - 10, 2, 4);
                // Leaf
                ctx.fillRect(iconX + 1, iconY - 9, 3, 2);

                // Pulsing ring
                ctx.strokeStyle = '#ff6347';
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.3 + 0.3 * Math.sin(frameRef.current * 0.1);
                ctx.beginPath();
                ctx.arc(iconX, iconY, 11, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1;
                break; // Only show one food icon at a time
              } else {
                foodIconsRef.current.delete(a.agentId);
              }
            }

            // ── Speech bubble ──
            const bubble = speechBubblesRef.current.get(a.agentId);
            const tier = dData.affinity >= 90 ? 6 : dData.affinity >= 70 ? 5 : dData.affinity >= 50 ? 4 : dData.affinity >= 30 ? 3 : dData.affinity >= 10 ? 2 : 1;

            // Generate new speech bubble if timer expired
            const lastSpeech = speechTimersRef.current.get(a.agentId) ?? 0;
            const interval = SPEECH_INTERVALS[tier] ?? 120000;
            if (nowMs - lastSpeech > interval && !bubble) {
              const allPhrases: string[] = [
                ...dData.phrases.tier1,
                ...(tier >= 2 ? dData.phrases.tier2 : []),
                ...(tier >= 3 ? dData.phrases.tier3 : []),
                ...(tier >= 4 ? dData.phrases.tier4 : []),
                ...(tier >= 5 ? dData.phrases.tier5 : []),
                ...(tier >= 6 ? dData.phrases.tier6 : []),
              ];
              if (allPhrases.length > 0) {
                const phrase = allPhrases[Math.floor(Math.random() * allPhrases.length)];
                const dur = SPEECH_DURATION_MIN + Math.random() * (SPEECH_DURATION_MAX - SPEECH_DURATION_MIN);
                speechBubblesRef.current.set(a.agentId, { text: phrase, startTime: nowMs, duration: dur });
                speechTimersRef.current.set(a.agentId, nowMs);
              }
            }

            // Draw active speech bubble
            if (bubble) {
              const elapsed = nowMs - bubble.startTime;
              if (elapsed > bubble.duration) {
                speechBubblesRef.current.delete(a.agentId);
              } else {
                // Fade in/out
                const fadeIn = Math.min(1, elapsed / 300);
                const fadeOut = Math.min(1, (bubble.duration - elapsed) / 300);
                const alpha = fadeIn * fadeOut;

                ctx.globalAlpha = alpha;
                ctx.font = '9px "JetBrains Mono", monospace';
                const textW = ctx.measureText(bubble.text).width;
                const bw = textW + 12;
                const bh = 18;
                const bx = s.x - bw / 2;
                const by = s.y - 50;

                // Bubble body
                ctx.fillStyle = 'rgba(255,255,255,0.92)';
                ctx.beginPath();
                ctx.roundRect(bx, by, bw, bh, 4);
                ctx.fill();
                // Border
                ctx.strokeStyle = '#1D9E75';
                ctx.lineWidth = 1;
                ctx.stroke();
                // Triangle pointer
                ctx.fillStyle = 'rgba(255,255,255,0.92)';
                ctx.beginPath();
                ctx.moveTo(s.x - 4, by + bh);
                ctx.lineTo(s.x + 4, by + bh);
                ctx.lineTo(s.x, by + bh + 5);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#1D9E75';
                ctx.beginPath();
                ctx.moveTo(s.x - 4, by + bh);
                ctx.lineTo(s.x, by + bh + 5);
                ctx.lineTo(s.x + 4, by + bh);
                ctx.stroke();
                // Text
                ctx.fillStyle = '#1a1a2e';
                ctx.textAlign = 'center';
                ctx.fillText(bubble.text, s.x, by + 13);
                ctx.globalAlpha = 1;
              }
            }
          }
        }

        // ── Agent avatar bubbles (top bar) ──
        const bubbleSize = 32;
        const bubblePad = 10;
        const totalBubbleW = agents.length * (bubbleSize + bubblePad) - bubblePad;
        const bubbleStartX = (W - totalBubbleW) / 2;
        const bubbleY = 10;

        for (let i = 0; i < agents.length; i++) {
          const a = agents[i];
          const s = sprites.get(a.agentId);
          if (!s) continue;
          const bx = bubbleStartX + i * (bubbleSize + bubblePad) + bubbleSize / 2;
          const by = bubbleY + bubbleSize / 2;
          const isSelected = activeAgentRef.current === a.agentId;
          const isHidden = hiddenAgentsRef.current.has(a.agentId);

          // Circle bg — greyed out if hidden
          if (isHidden) {
            ctx.globalAlpha = 0.35;
            ctx.fillStyle = 'rgba(60, 60, 60, 0.8)';
          } else {
            ctx.fillStyle = isSelected ? 'rgba(29, 158, 117, 0.4)' : 'rgba(0, 0, 0, 0.6)';
          }
          ctx.beginPath();
          ctx.arc(bx, by, bubbleSize / 2 + 2, 0, Math.PI * 2);
          ctx.fill();

          // Border
          ctx.strokeStyle = isHidden ? 'rgba(100,100,100,0.3)' : isSelected ? '#1D9E75' : 'rgba(255,255,255,0.15)';
          ctx.lineWidth = isSelected && !isHidden ? 2 : 1;
          ctx.stroke();
          ctx.globalAlpha = isHidden ? 0.35 : 1;

          // Draw face (zoom into top portion of walk sprite row 0, frame 0)
          const sheet = s.walkImg;
          if (sheet && sheet.complete && sheet.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(bx, by, bubbleSize / 2, 0, Math.PI * 2);
            ctx.clip();
            // Per-agent camera offset for face crop (from avatarCrop config or defaults)
            const ac = a.avatarCrop;
            const srcX = ac?.x ?? 12;
            const srcY = ac?.y ?? 14;
            const srcW = ac?.size ?? 28;
            const srcH = ac?.size ?? 28;
            ctx.imageSmoothingEnabled = false;
            if (isHidden) ctx.filter = 'grayscale(100%)';
            ctx.drawImage(sheet, srcX, srcY, srcW, srcH, bx - bubbleSize / 2, by - bubbleSize / 2, bubbleSize, bubbleSize);
            ctx.filter = 'none';
            ctx.restore();
          }
          ctx.globalAlpha = 1;

          // Affinity bar below bubble (between bubble and eye)
          const abData = digimonDataRef.current[a.agentId];
          if (abData && !isHidden) {
            const abW = 28;
            const abH = 3;
            const abX = bx - abW / 2;
            const abY = by + bubbleSize / 2 + 4;
            const abFill = Math.max(0, Math.min(1, abData.affinity / 100));
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(abX - 1, abY - 1, abW + 2, abH + 2);
            const abR = Math.round(255 * (1 - abFill));
            const abG = Math.round(255 * abFill);
            ctx.fillStyle = `rgb(${abR},${abG},50)`;
            ctx.fillRect(abX, abY, abW * abFill, abH);
          }

          // Eye toggle icon below bubble — pixel-art style
          const eyeY = by + bubbleSize / 2 + 12;
          const ew = 10; // half-width
          const eh = 4;  // half-height
          ctx.globalAlpha = isHidden ? 0.5 : 0.85;
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          if (isHidden) {
            // Closed eye: horizontal line with small lashes down
            ctx.strokeStyle = '#6b7280';
            ctx.beginPath();
            ctx.moveTo(bx - ew, eyeY);
            ctx.lineTo(bx + ew, eyeY);
            ctx.stroke();
            // Lashes
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(bx - 6, eyeY);
            ctx.lineTo(bx - 7, eyeY + 3);
            ctx.moveTo(bx, eyeY);
            ctx.lineTo(bx, eyeY + 4);
            ctx.moveTo(bx + 6, eyeY);
            ctx.lineTo(bx + 7, eyeY + 3);
            ctx.stroke();
            // Red slash
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.8;
            ctx.beginPath();
            ctx.moveTo(bx - ew - 2, eyeY - eh - 1);
            ctx.lineTo(bx + ew + 2, eyeY + eh + 1);
            ctx.stroke();
          } else {
            // Open eye: almond shape + pupil
            ctx.strokeStyle = '#9ca3af';
            ctx.beginPath();
            ctx.moveTo(bx - ew, eyeY);
            ctx.quadraticCurveTo(bx, eyeY - eh * 2, bx + ew, eyeY);
            ctx.quadraticCurveTo(bx, eyeY + eh * 2, bx - ew, eyeY);
            ctx.closePath();
            ctx.stroke();
            // Pupil
            ctx.fillStyle = '#d1d5db';
            ctx.beginPath();
            ctx.arc(bx, eyeY, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;

          // Unread badge on bubble (only if visible)
          if (!isHidden) {
            const n = unreadRef.current[a.agentId] || 0;
            if (n > 0) {
              ctx.fillStyle = '#ef4444';
              ctx.beginPath();
              ctx.arc(bx + bubbleSize / 2 - 2, by - bubbleSize / 2 + 2, 6, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = '#fff';
              ctx.font = 'bold 7px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(String(n), bx + bubbleSize / 2 - 2, by - bubbleSize / 2 + 2);
              ctx.textBaseline = 'alphabetic';
            }
          }

          // Working indicator (only if visible)
          if (!isHidden && streamingAgentsRef.current.has(a.agentId)) {
            ctx.strokeStyle = '#f472b6';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.5 + 0.5 * Math.sin(frameRef.current * 0.15);
            ctx.beginPath();
            ctx.arc(bx, by, bubbleSize / 2 + 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }

          // Done indicator (only if visible)
          if (!isHidden && s.phase === 'done') {
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.5 + 0.5 * Math.sin(frameRef.current * 0.1);
            ctx.beginPath();
            ctx.arc(bx, by, bubbleSize / 2 + 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
          }
        }
      }
      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animRef.current);
      obs.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents]);

  // ─── Pointer detection (mouse + touch) ─────────────────
  const hitTestAgent = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const cx = clientX - rect.left;
    const cy = clientY - rect.top;
    const W = canvas.width;

    // Check food icons first (on sprites)
    for (const a of agents) {
      const s = spritesRef.current.get(a.agentId);
      const food = foodIconsRef.current.get(a.agentId);
      if (!s || !food) continue;
      const iconX = s.x;
      const iconY = s.y - 10;
      const dist = Math.sqrt((cx - iconX) ** 2 + (cy - iconY) ** 2);
      if (dist <= 15) return `food:${a.agentId}:${food.mealIndex}`;
    }

    // Check eye toggle buttons first (below bubbles)
    const bubbleSize = 32;
    const bubblePad = 10;
    const totalBubbleW = agents.length * (bubbleSize + bubblePad) - bubblePad;
    const bubbleStartX = (W - totalBubbleW) / 2;
    for (let i = 0; i < agents.length; i++) {
      const bx = bubbleStartX + i * (bubbleSize + bubblePad) + bubbleSize / 2;
      const eyeY = 10 + bubbleSize / 2 + bubbleSize / 2 + 12;
      const eyeDist = Math.sqrt((cx - bx) ** 2 + (cy - eyeY) ** 2);
      if (eyeDist <= 12) return `eye:${agents[i].agentId}`;
    }

    // Check avatar bubbles (top bar) — skip hidden agents
    for (let i = 0; i < agents.length; i++) {
      if (hiddenAgentsRef.current.has(agents[i].agentId)) continue;
      const bx = bubbleStartX + i * (bubbleSize + bubblePad) + bubbleSize / 2;
      const by = 10 + bubbleSize / 2;
      const dist = Math.sqrt((cx - bx) ** 2 + (cy - by) ** 2);
      if (dist <= bubbleSize / 2 + 5) return agents[i].agentId;
    }

    // Check sprites on ground — skip hidden agents
    for (const a of agents) {
      if (hiddenAgentsRef.current.has(a.agentId)) continue;
      const s = spritesRef.current.get(a.agentId);
      if (!s) continue;
      if (cx >= s.x - DRAW_SIZE / 2 - 15 && cx <= s.x + DRAW_SIZE / 2 + 15 && cy >= s.y - 15 && cy <= s.y + DRAW_SIZE + 15) {
        return a.agentId;
      }
    }
    return null;
  }, [agents]);

  const handleCanvasMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const found = hitTestAgent(e.clientX, e.clientY);
    hoveredAgentRef.current = found;
    if (canvasRef.current) canvasRef.current.style.cursor = found ? 'pointer' : 'default';
  }, [hitTestAgent]);

  // ─── Click/tap on canvas to select agent ────────────────
  // Feed a digimon via API
  const feedDigimon = useCallback(async (agentId: string, mealIndex: number) => {
    try {
      const res = await fetch('/api/digimon-data/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, mealIndex }),
      });
      if (res.ok) {
        const data = await res.json();
        // Update local digimon data
        const d = digimonDataRef.current[agentId];
        if (d) {
          d.affinity = data.affinity;
          d.lastFedDates.push(data.fedKey);
        }
        // Trigger eating animation + sound
        const s = spritesRef.current.get(agentId);
        if (s) {
          s.phase = 'eating';
          s.eatingStartFrame = frameRef.current;
          const agent = agents.find(a => a.agentId === agentId);
          if (agent) {
            import('@/lib/digimon-sounds').then(m => m.playDigimonEat(agent.sprite));
          }
        }
        // Remove food icon
        foodIconsRef.current.delete(agentId);
      }
    } catch { /* ignore */ }
  }, []);

  const selectAgentAt = useCallback((clientX: number, clientY: number) => {
    const result = hitTestAgent(clientX, clientY);
    if (!result) return;
    // Food icon click
    if (result.startsWith('food:')) {
      const parts = result.split(':');
      feedDigimon(parts[1], parseInt(parts[2]));
      return;
    }
    // Eye toggle click
    if (result.startsWith('eye:')) {
      const agentId = result.slice(4);
      toggleAgentVisibility(agentId);
      return;
    }
    const agentId = result;
    if (activeAgent === agentId) {
      setActiveAgent(null);
    } else {
      setActiveAgent(agentId);
      setUnread(u => ({ ...u, [agentId]: 0 }));
      // Play selection sound
      const agent = agents.find(a => a.agentId === agentId);
      if (agent) {
        import('@/lib/digimon-sounds').then(m => m.playDigimonSelect(agent.sprite));
      }
    }
  }, [hitTestAgent, activeAgent, toggleAgentVisibility, feedDigimon, agents]);

  const lastInteractionRef = useRef(0);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    // Skip if this click was already handled by a recent touch event
    if (Date.now() - lastInteractionRef.current < 300) return;
    lastInteractionRef.current = Date.now();
    selectAgentAt(e.clientX, e.clientY);
  }, [selectAgentAt]);

  const handleCanvasTouch = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      hoveredAgentRef.current = hitTestAgent(t.clientX, t.clientY);
    }
  }, [hitTestAgent]);

  const handleCanvasTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.changedTouches.length === 1) {
      const t = e.changedTouches[0];
      lastInteractionRef.current = Date.now();
      selectAgentAt(t.clientX, t.clientY);
      hoveredAgentRef.current = null;
    }
  }, [selectAgentAt]);

  const agent = agents.find(a => a.agentId === activeAgent);

  // ─── Send incident to agent ─────────────────────────────
  const handleSendToAgent = useCallback(async (agentId: string, message: string, images: string[]) => {
    let fullMsg = message;

    // Save base64 images to temp files so the agent can read them
    if (images.length > 0) {
      const savedPaths: string[] = [];
      for (const dataUri of images) {
        try {
          // Convert base64 data URI to Blob
          const res = await fetch(dataUri);
          const blob = await res.blob();
          const ext = blob.type.split('/')[1] || 'png';
          const file = new File([blob], `incident-img-${Date.now()}.${ext}`, { type: blob.type });
          const form = new FormData();
          form.append('file', file);
          const uploadRes = await fetch('/api/chat-upload', { method: 'POST', body: form });
          const uploadData = await uploadRes.json();
          if (uploadData.path) savedPaths.push(uploadData.path);
        } catch { /* skip failed uploads */ }
      }
      if (savedPaths.length > 0) {
        const paths = savedPaths.map(p => `"${p}"`).join(', ');
        fullMsg += `\n\n[The user has attached ${savedPaths.length} image(s). Read them with the Read tool to see them: ${paths}]`;
      }
    }

    setActiveAgent(agentId);
    setUnread(u => ({ ...u, [agentId]: 0 }));
    setTimeout(() => setExternalMessage({ agentId, text: fullMsg }), 300);
  }, []);

  // ─── Render ───────────────────────────────────────────
  return (
    <div className={`-m-3 md:-m-6 overflow-hidden h-[calc(100%+1.5rem)] md:h-[calc(100%+3rem)] ${
      agent ? 'flex flex-col landscape:flex-row' : 'flex flex-col'
    }`}>
      {/* Canvas scene */}
      <div ref={containerRef} className="relative flex-1 min-h-[120px] min-w-0 cursor-pointer">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMove}
          onMouseLeave={() => { hoveredAgentRef.current = null; }}
          onTouchStart={handleCanvasTouch}
          onTouchEnd={handleCanvasTouchEnd}
          className="block w-full h-full touch-none"
          style={{ imageRendering: 'pixelated' }}
        />
        {/* Bottom-left button row */}
        <div className="absolute bottom-4 left-4 z-10 flex items-end gap-3">
          <MusicPlayer />

          {/* Feeding schedule button */}
          <button
            onClick={() => setFeedingOpen(true)}
            className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg bg-[#0d1117]/90 border border-[#30363d] hover:border-amber-400/40 hover:bg-amber-400/10 transition-all text-xl"
            title="Horarios de comida"
          >
            🍖
          </button>

        </div>

        <FeedingScheduleModal open={feedingOpen} onClose={() => setFeedingOpen(false)} />
        <FloatingTasksWidget
          onOpenTasksModal={() => { setInitialTaskId(null); setTasksOpen(true); }}
          onOpenTaskDetail={(id) => { setInitialTaskId(id); setTasksOpen(true); }}
        />
      </div>

      {/* Chat panel */}
      <div
        className={`shrink-0 bg-[#0d1117] transition-all duration-300 ease-in-out overflow-hidden ${
          agent
            ? 'border-t landscape:border-t-0 landscape:border-l border-[#30363d] h-[55%] min-h-[220px] landscape:h-full landscape:min-h-0 landscape:w-[45%] landscape:min-w-[280px]'
            : 'h-0 landscape:w-0'
        }`}
      >
        {agent && (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-[#161b22] border-b border-[#30363d] shrink-0">
              <span className="text-xs md:text-sm font-mono font-medium text-digi-green">{agent.name}</span>
              <span className="text-[9px] md:text-[10px] font-mono text-[#484f58] truncate flex-1">
                {agent.projectPath ? agent.projectPath.split('/').pop() : 'No project'}
              </span>
              <button
                onClick={() => {
                  if (agent) setChatHistories(prev => ({ ...prev, [agent.agentId]: [] }));
                }}
                className="p-1.5 rounded text-[#484f58] hover:text-red-400 active:bg-red-400/10"
                title="Limpiar chat"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
              <button onClick={() => setActiveAgent(null)} className="p-1.5 rounded text-[#484f58] hover:text-white active:bg-white/10">
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 min-h-0">
              <ChatPanel
                key={agent.agentId}
                citizen={{ agentId: agent.agentId, name: agent.name, sprite: agent.sprite, position: '', type: 'agent', avatarCrop: agent.avatarCrop }}
                onClose={() => setActiveAgent(null)}
                blocks={chatHistories[agent.agentId] || []}
                onBlocksChange={(newBlocks) => {
                  const id = agent.agentId;
                  const trimmed = newBlocks.length > MAX_BLOCKS_PER_AGENT
                    ? newBlocks.slice(-MAX_BLOCKS_PER_AGENT)
                    : newBlocks;
                  setChatHistories(prev => ({ ...prev, [id]: trimmed }));
                }}
                externalMessage={externalMessage?.agentId === agent.agentId ? externalMessage.text : null}
                onExternalMessageConsumed={() => setExternalMessage(null)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Tasks modal */}
      <TasksModal
        open={tasksOpen}
        onClose={() => { setTasksOpen(false); setInitialTaskId(null); }}
        activeAgentId={activeAgent}
        agentProjectMap={agentProjectMap}
        onSendToAgent={handleSendToAgent}
        initialTaskId={initialTaskId}
      />
    </div>
  );
}
