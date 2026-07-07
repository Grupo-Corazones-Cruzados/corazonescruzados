'use client';

import { useMemo, useState } from 'react';
import { NODE_META } from '@/lib/centralized/apoyo';
import type { GraphNode, GraphEdge } from '@/lib/centralized/apoyo';

const W = 960;
const H = 620;
const RADIUS: Record<string, number> = { situation: 11, problem: 8.5, cause: 6.5, solution: 8.5 };

/** Layout tipo fuerza (Fruchterman-Reingold simplificado), determinista por índice. */
function useForceLayout(nodes: GraphNode[], edges: GraphEdge[]) {
  return useMemo(() => {
    const N = nodes.length;
    const map = new Map<string, { x: number; y: number }>();
    if (N === 0) return map;
    const idx = new Map(nodes.map((n, i) => [n.key, i]));
    const p = nodes.map((_, i) => {
      const a = (i / N) * Math.PI * 2;
      return { x: W / 2 + Math.cos(a) * 180, y: H / 2 + Math.sin(a) * 140, vx: 0, vy: 0 };
    });
    const links = edges
      .map((e) => ({ s: idx.get(e.source), t: idx.get(e.target) }))
      .filter((l): l is { s: number; t: number } => l.s != null && l.t != null);
    const k = Math.min(W, H) / Math.sqrt(N + 1) * 0.9;
    const ITER = 320;
    for (let it = 0; it < ITER; it++) {
      const temp = 1 - it / ITER;
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          let dx = p[i].x - p[j].x, dy = p[i].y - p[j].y;
          let dist = Math.hypot(dx, dy) || 0.01;
          const rep = (k * k) / dist * 0.55;
          const fx = (dx / dist) * rep, fy = (dy / dist) * rep;
          p[i].vx += fx; p[i].vy += fy; p[j].vx -= fx; p[j].vy -= fy;
        }
      }
      for (const l of links) {
        const a = p[l.s], b = p[l.t];
        let dx = a.x - b.x, dy = a.y - b.y;
        let dist = Math.hypot(dx, dy) || 0.01;
        const att = (dist * dist) / k * 0.02;
        const fx = (dx / dist) * att, fy = (dy / dist) * att;
        a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
      }
      for (let i = 0; i < N; i++) {
        p[i].vx += (W / 2 - p[i].x) * 0.004;
        p[i].vy += (H / 2 - p[i].y) * 0.004;
        const sp = Math.hypot(p[i].vx, p[i].vy) || 0.01;
        const max = 18 * temp + 2;
        const s = Math.min(sp, max) / sp;
        p[i].x += p[i].vx * s; p[i].y += p[i].vy * s;
        p[i].vx *= 0.86; p[i].vy *= 0.86;
        p[i].x = Math.max(24, Math.min(W - 24, p[i].x));
        p[i].y = Math.max(24, Math.min(H - 24, p[i].y));
      }
    }
    nodes.forEach((n, i) => map.set(n.key, { x: p[i].x, y: p[i].y }));
    return map;
  }, [nodes, edges]);
}

export default function KnowledgeGraph({
  nodes,
  edges,
  selectedKey,
  onSelect,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedKey: string | null;
  onSelect: (n: GraphNode | null) => void;
}) {
  const pos = useForceLayout(nodes, edges);
  const [hovered, setHovered] = useState<string | null>(null);
  const active = hovered || selectedKey;

  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of edges) {
      if (!m.has(e.source)) m.set(e.source, new Set());
      if (!m.has(e.target)) m.set(e.target, new Set());
      m.get(e.source)!.add(e.target);
      m.get(e.target)!.add(e.source);
    }
    return m;
  }, [edges]);

  const isLit = (key: string) => !active || key === active || neighbors.get(active)?.has(key);
  const nodeByKey = useMemo(() => new Map(nodes.map((n) => [n.key, n])), [nodes]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[68vh] select-none" onClick={() => onSelect(null)}>
      {/* Aristas */}
      {edges.map((e, i) => {
        const a = pos.get(e.source), b = pos.get(e.target);
        if (!a || !b) return null;
        const lit = !active || e.source === active || e.target === active;
        return (
          <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={lit ? '#8b7bbf' : '#c8c6d0'} strokeWidth={lit ? 1.4 : 0.7} strokeOpacity={lit ? 0.75 : 0.25} />
        );
      })}
      {/* Nodos */}
      {nodes.map((n) => {
        const c = pos.get(n.key);
        if (!c) return null;
        const lit = isLit(n.key);
        const color = NODE_META[n.type].color;
        const r = RADIUS[n.type];
        const isActive = n.key === active;
        const showLabel = isActive || (active ? isLit(n.key) : n.type === 'situation');
        return (
          <g key={n.key}
            className="cursor-pointer"
            opacity={lit ? 1 : 0.28}
            onMouseEnter={() => setHovered(n.key)}
            onMouseLeave={() => setHovered(null)}
            onClick={(ev) => { ev.stopPropagation(); onSelect(n); }}
          >
            {n.key === selectedKey && <circle cx={c.x} cy={c.y} r={r + 5} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.5} />}
            <circle cx={c.x} cy={c.y} r={isActive ? r + 1.5 : r} fill={color} stroke="#ffffff" strokeWidth={1.5} />
            {showLabel && (
              <text x={c.x} y={c.y + r + 11} textAnchor="middle" fontSize={10.5} fill="#242424"
                style={{ fontFamily: 'var(--font-body)', paintOrder: 'stroke', stroke: '#ffffff', strokeWidth: 3 } as any}>
                {n.title.length > 22 ? n.title.slice(0, 21) + '…' : n.title}
              </text>
            )}
          </g>
        );
      })}
      {nodes.length === 0 && (
        <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={14} fill="#605e5c" style={{ fontFamily: 'var(--font-body)' }}>
          Sin situaciones aún. Crea la primera para empezar el grafo.
        </text>
      )}
    </svg>
  );
}
