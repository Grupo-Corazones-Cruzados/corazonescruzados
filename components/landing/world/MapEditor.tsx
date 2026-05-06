'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CATEGORIES,
  SHEETS,
  TILE_PX,
  tileZ,
  type ItemPlacement,
  type LayerData,
  type Tile,
  type WorldMapData,
} from './sheets';
import { ITEMS, ITEM_CATEGORIES, findItem, itemDataUrl } from './items';

type Brush = {
  sheetIdx: number;
  sx: number;
  sy: number;
  w: number; // selection width in tiles, default 1
  h: number; // selection height in tiles, default 1
};

const VIEW_SCALE = 2; // 1 source px = 2 screen px in editor

export default function MapEditor({
  initialMap,
  onClose,
  onSaved,
}: {
  initialMap: WorldMapData;
  onClose: () => void;
  onSaved: (map: WorldMapData) => void;
}) {
  const [width, setWidth] = useState(initialMap.width);
  const [height, setHeight] = useState(initialMap.height);
  const [tiles, setTiles] = useState<Tile[]>(
    initialMap.layers[0]?.tiles ?? [],
  );
  const [brush, setBrush] = useState<Brush | null>(null);
  // Mutually-exclusive editor modes. `paint` lays tiles (no collision
  // baked in); `collision` toggles the c flag on existing tiles;
  // `erase` removes the top-most thing; `spawn` sets the player spawn.
  type EditorMode = 'paint' | 'collision' | 'erase' | 'spawn';
  const [mode, setMode] = useState<EditorMode>('paint');
  const [spawnX, setSpawnX] = useState(initialMap.spawnX ?? 0);
  const [spawnY, setSpawnY] = useState(initialMap.spawnY ?? 0);
  const [items, setItems] = useState<ItemPlacement[]>(
    initialMap.items ?? [],
  );
  const [itemBrush, setItemBrush] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tiles' | 'items'>('tiles');
  // Tracks the last cell affected by the current drag so that
  // collision-mode toggling doesn't flip the same cell back-and-forth
  // while the cursor sits on it.
  const lastDragCellRef = useRef<{ x: number; y: number } | null>(null);

  // ── Undo / redo history ────────────────────────────────────────
  type Snapshot = {
    tiles: Tile[];
    items: ItemPlacement[];
    width: number;
    height: number;
    spawnX: number;
    spawnY: number;
  };
  const initSnap: Snapshot = useMemo(
    () => ({
      tiles: initialMap.layers[0]?.tiles ?? [],
      items: initialMap.items ?? [],
      width: initialMap.width,
      height: initialMap.height,
      spawnX: initialMap.spawnX ?? 0,
      spawnY: initialMap.spawnY ?? 0,
    }),
    [initialMap],
  );
  const [history, setHistory] = useState<Snapshot[]>([initSnap]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const restoringRef = useRef(false);

  const snapKey = (s: Snapshot) =>
    `${s.width}x${s.height}|${s.spawnX},${s.spawnY}|${JSON.stringify(s.tiles)}|${JSON.stringify(s.items)}`;

  const pushHistory = () => {
    if (restoringRef.current) return;
    const snap: Snapshot = {
      tiles,
      items,
      width,
      height,
      spawnX,
      spawnY,
    };
    setHistory((prev) => {
      const truncated = prev.slice(0, historyIdx + 1);
      const last = truncated[truncated.length - 1];
      if (last && snapKey(last) === snapKey(snap)) return prev;
      const next = [...truncated, snap];
      // Cap at 100 entries to keep memory bounded.
      const trimmed = next.length > 100 ? next.slice(next.length - 100) : next;
      setHistoryIdx(trimmed.length - 1);
      return trimmed;
    });
  };

  const restore = (s: Snapshot) => {
    restoringRef.current = true;
    setTiles(s.tiles);
    setItems(s.items);
    setWidth(s.width);
    setHeight(s.height);
    setSpawnX(s.spawnX);
    setSpawnY(s.spawnY);
    // Release the guard on the next tick so dependent effects run free.
    setTimeout(() => {
      restoringRef.current = false;
    }, 0);
  };

  const undo = () => {
    if (historyIdx <= 0) return;
    const newIdx = historyIdx - 1;
    setHistoryIdx(newIdx);
    restore(history[newIdx]);
  };
  const redo = () => {
    if (historyIdx >= history.length - 1) return;
    const newIdx = historyIdx + 1;
    setHistoryIdx(newIdx);
    restore(history[newIdx]);
  };

  // Keyboard shortcuts.
  //   Q/W/E/R: switch mode (paint / collision / erase / spawn).
  //   1: toggle showCollisions.
  //   A / S: undo / redo.
  //   ⌘S / Ctrl+S: save the map.
  //   ⌘Z / Ctrl+Z (+ Shift / Y): undo / redo with the platform combo.
  // Inputs stay focusable — typing in the width/height boxes won't
  // trigger any of this. `save` is read through a ref because it's
  // declared later in the component.
  const saveRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        return;
      }
      const k = typeof e.key === 'string' ? e.key.toLowerCase() : '';
      const meta = e.metaKey || e.ctrlKey;
      if (meta) {
        if (k === 's') {
          e.preventDefault();
          saveRef.current();
        } else if (k === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if ((k === 'z' && e.shiftKey) || k === 'y') {
          e.preventDefault();
          redo();
        }
        return;
      }
      switch (k) {
        case 'q':
          e.preventDefault();
          setMode('paint');
          return;
        case 'w':
          e.preventDefault();
          setMode('collision');
          return;
        case 'e':
          e.preventDefault();
          setMode('erase');
          return;
        case 'r':
          e.preventDefault();
          setMode('spawn');
          return;
        case '1':
          e.preventDefault();
          setShowCollisions((v) => !v);
          return;
        case 'a':
          e.preventDefault();
          undo();
          return;
        case 's':
          e.preventDefault();
          redo();
          return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyIdx, history]);
  const [activeCategory, setActiveCategory] = useState<
    (typeof CATEGORIES)[number]['id']
  >('terreno');
  const [search, setSearch] = useState('');
  const [showCollisions, setShowCollisions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  // Map -> { "x,y": index in tiles[] } for fast paint replacement.
  const tileIdxByCell = useMemo(() => {
    const m = new Map<string, number>();
    tiles.forEach((t, i) => m.set(`${t.x},${t.y}`, i));
    return m;
  }, [tiles]);

  // ── Sheets pre-load ────────────────────────────────────────────
  const [imgs, setImgs] = useState<(HTMLImageElement | null)[]>(
    () => SHEETS.map(() => null),
  );
  const [itemImgs, setItemImgs] = useState<Map<string, HTMLImageElement>>(
    () => new Map(),
  );
  useEffect(() => {
    const map = new Map<string, HTMLImageElement>();
    for (const it of ITEMS) {
      const img = new Image();
      img.src = itemDataUrl(it);
      map.set(it.id, img);
    }
    setItemImgs(map);
  }, []);
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      SHEETS.map(
        (s) =>
          new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = s.url;
          }),
      ),
    ).then((loaded) => {
      if (!cancelled) setImgs(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Canvas render ──────────────────────────────────────────────
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width * TILE_PX;
    canvas.height = height * TILE_PX;
  }, [width, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.imageSmoothingEnabled = false;
    // background = grid
    ctx.fillStyle = '#1a1f2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Two-pass render: ground (z=0) first, then overlay (z=1) on top.
    const drawTile = (t: Tile) => {
      const sheet = SHEETS[t.s];
      const img = imgs[t.s];
      if (!sheet || !img) return;
      ctx.drawImage(
        img,
        t.sx * TILE_PX,
        t.sy * TILE_PX,
        TILE_PX,
        TILE_PX,
        t.x * TILE_PX,
        t.y * TILE_PX,
        TILE_PX,
        TILE_PX,
      );
      if (t.c && showCollisions) {
        ctx.fillStyle = 'rgba(255, 60, 60, 0.32)';
        ctx.fillRect(
          t.x * TILE_PX,
          t.y * TILE_PX,
          TILE_PX,
          TILE_PX,
        );
        ctx.strokeStyle = 'rgba(255,60,60,0.85)';
        ctx.lineWidth = 1;
        ctx.strokeRect(
          t.x * TILE_PX + 0.5,
          t.y * TILE_PX + 0.5,
          TILE_PX - 1,
          TILE_PX - 1,
        );
      }
    };
    for (const t of tiles) if (tileZ(t.s) === 0) drawTile(t);
    for (const t of tiles) if (tileZ(t.s) === 1) drawTile(t);

    // grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x++) {
      ctx.beginPath();
      ctx.moveTo(x * TILE_PX + 0.5, 0);
      ctx.lineTo(x * TILE_PX + 0.5, height * TILE_PX);
      ctx.stroke();
    }
    for (let y = 0; y <= height; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * TILE_PX + 0.5);
      ctx.lineTo(width * TILE_PX, y * TILE_PX + 0.5);
      ctx.stroke();
    }

    // Items overlay
    for (const placement of items) {
      const def = findItem(placement.itemId);
      if (!def) continue;
      // Draw a light tile background so items pop against terrain.
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(
        placement.x * TILE_PX,
        placement.y * TILE_PX,
        TILE_PX,
        TILE_PX,
      );
      const img = itemImgs.get(def.id);
      if (img && img.complete) {
        ctx.drawImage(
          img,
          placement.x * TILE_PX + 4,
          placement.y * TILE_PX + 4,
          TILE_PX - 8,
          TILE_PX - 8,
        );
      }
    }

    // Spawn marker — green star + ring
    if (
      spawnX >= 0 &&
      spawnY >= 0 &&
      spawnX < width &&
      spawnY < height
    ) {
      const cx = spawnX * TILE_PX + TILE_PX / 2;
      const cy = spawnY * TILE_PX + TILE_PX / 2;
      ctx.fillStyle = 'rgba(60, 200, 90, 0.4)';
      ctx.fillRect(spawnX * TILE_PX, spawnY * TILE_PX, TILE_PX, TILE_PX);
      ctx.strokeStyle = '#3bd16f';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        spawnX * TILE_PX + 1,
        spawnY * TILE_PX + 1,
        TILE_PX - 2,
        TILE_PX - 2,
      );
      ctx.beginPath();
      ctx.fillStyle = '#3bd16f';
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0a0a14';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('P', cx, cy + 1);
    }
  }, [tiles, items, imgs, width, height, showCollisions, spawnX, spawnY, itemImgs]);

  // ── Painting ──────────────────────────────────────────────────
  const paintingRef = useRef(false);

  const paintAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = Math.floor((clientX - rect.left) / (TILE_PX * VIEW_SCALE));
    const cy = Math.floor((clientY - rect.top) / (TILE_PX * VIEW_SCALE));
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) return;

    if (mode === 'spawn') {
      if (cx === spawnX && cy === spawnY) return;
      setSpawnX(cx);
      setSpawnY(cy);
      // Defer push so the state has time to settle.
      window.setTimeout(pushHistory, 0);
      return;
    }
    if (mode === 'erase') {
      // Erase top-most: items first, then overlay tiles, then ground.
      const itemIdx = items.findIndex((it) => it.x === cx && it.y === cy);
      if (itemIdx >= 0) {
        setItems((prev) => prev.filter((_, i) => i !== itemIdx));
        return;
      }
      setTiles((prev) => {
        let target = -1;
        let bestZ = -1;
        prev.forEach((t, i) => {
          if (t.x === cx && t.y === cy) {
            const z = tileZ(t.s);
            if (z > bestZ) {
              bestZ = z;
              target = i;
            }
          }
        });
        if (target < 0) return prev;
        return prev.filter((_, i) => i !== target);
      });
      return;
    }
    if (mode === 'collision') {
      // Toggle the c flag on the top-most tile at (cx, cy). During a
      // drag, skip cells we just toggled so the same cell doesn't
      // flip on every mousemove tick.
      const last = lastDragCellRef.current;
      if (last && last.x === cx && last.y === cy) return;
      lastDragCellRef.current = { x: cx, y: cy };
      setTiles((prev) => {
        let target = -1;
        let bestZ = -1;
        prev.forEach((t, i) => {
          if (t.x === cx && t.y === cy) {
            const z = tileZ(t.s);
            if (z > bestZ) {
              bestZ = z;
              target = i;
            }
          }
        });
        if (target < 0) return prev;
        const next = prev.slice();
        const t = next[target];
        const flipped: Tile = { ...t };
        if (t.c) delete flipped.c;
        else flipped.c = 1;
        next[target] = flipped;
        return next;
      });
      return;
    }
    if (activeTab === 'items' && itemBrush) {
      // Replace any existing item at this cell.
      const without = items.filter((it) => !(it.x === cx && it.y === cy));
      const newItem: ItemPlacement = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        itemId: itemBrush,
        x: cx,
        y: cy,
      };
      setItems([...without, newItem]);
      return;
    }
    if (!brush) return;
    // Stamp the w × h selection starting at (cx, cy). Each painted
    // cell only replaces the existing tile at the SAME z-layer, so
    // dropping a building on grass leaves the grass intact underneath.
    // Collision is no longer baked in here — switch to mode `w` to
    // mark tiles as colliding.
    const brushZ = tileZ(brush.sheetIdx);
    setTiles((prev) => {
      let next = prev;
      let mutated = false;
      for (let dy = 0; dy < brush.h; dy++) {
        for (let dx = 0; dx < brush.w; dx++) {
          const tx = cx + dx;
          const ty = cy + dy;
          if (tx < 0 || ty < 0 || tx >= width || ty >= height) continue;
          const newTile: Tile = {
            x: tx,
            y: ty,
            s: brush.sheetIdx,
            sx: brush.sx + dx,
            sy: brush.sy + dy,
          };
          const idx = next.findIndex(
            (t) => t.x === tx && t.y === ty && tileZ(t.s) === brushZ,
          );
          if (idx >= 0) {
            if (!mutated) {
              next = next.slice();
              mutated = true;
            }
            // Preserve the existing tile's collision flag — re-painting
            // shouldn't undo a collision the user already added.
            if (next[idx].c) newTile.c = 1;
            next[idx] = newTile;
          } else {
            if (!mutated) {
              next = next.slice();
              mutated = true;
            }
            next.push(newTile);
          }
        }
      }
      return next;
    });
  };

  // ── Save ──────────────────────────────────────────────────────
  const save = async () => {
    setSaving(true);
    try {
      const layers: LayerData[] = [{ tiles }];
      const r = await fetch('/api/world/map', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          width,
          height,
          layers,
          items,
          spawnX,
          spawnY,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        alert(j?.error ?? 'No se pudo guardar');
        return;
      }
      setSavedAt(Date.now());
      onSaved({
        name: 'default',
        width,
        height,
        layers,
        items,
        spawnX,
        spawnY,
      });
    } finally {
      setSaving(false);
    }
  };
  // Keep the save function reference fresh for the ⌘S handler.
  useEffect(() => {
    saveRef.current = save;
  });

  // ── Palette ────────────────────────────────────────────────────
  const visibleSheets = SHEETS.filter((s) => s.category === activeCategory);
  const filteredQuery = search.trim().toLowerCase();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200000,
        background: '#0a0a14',
        color: '#e5e5e5',
        fontFamily: "'Silkscreen', cursive",
        display: 'grid',
        gridTemplateColumns: '300px 1fr',
        animation: 'pixelFadeIn 0.4s ease-out',
      }}
    >
      {/* ── Side panel ── */}
      <aside
        style={{
          background: '#131923',
          borderRight: '2px solid var(--color-accent)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <div
          style={{
            padding: '14px 14px 8px',
            borderBottom: '2px solid rgba(75,45,142,0.4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: '0.9rem',
              letterSpacing: '0.22em',
              color: 'var(--color-accent)',
              textTransform: 'uppercase',
            }}
          >
            Editor del mundo
          </div>
          <input
            type="text"
            placeholder="Buscar (sheet, categoría)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: '8px 10px',
              background: '#0f1320',
              border: '2px solid var(--color-accent)',
              color: '#e5e5e5',
              fontFamily: "'Silkscreen', cursive",
              fontSize: '0.7rem',
              outline: 'none',
            }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            gap: 4,
            padding: '8px 10px 4px',
            borderBottom: '1px solid rgba(75,45,142,0.3)',
          }}
        >
          {(['tiles', 'items'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setActiveTab(t);
                if (t === 'items') setBrush(null);
                else setItemBrush(null);
              }}
              style={{
                flex: 1,
                padding: '6px 8px',
                background:
                  activeTab === t ? 'var(--color-accent)' : '#1a1a1a',
                color: activeTab === t ? '#0a0a14' : '#e5e5e5',
                border: '2px solid var(--color-accent)',
                fontFamily: "'Silkscreen', cursive",
                fontSize: '0.6rem',
                letterSpacing: '0.12em',
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {t === 'tiles' ? 'Tiles' : 'Items'}
            </button>
          ))}
        </div>

        {activeTab === 'tiles' && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            padding: 10,
            borderBottom: '2px solid rgba(75,45,142,0.4)',
          }}
        >
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCategory(c.id)}
              style={{
                padding: '5px 8px',
                background:
                  activeCategory === c.id ? 'var(--color-accent)' : '#1a1a1a',
                color: activeCategory === c.id ? '#0a0a14' : '#e5e5e5',
                border: '2px solid var(--color-accent)',
                fontFamily: "'Silkscreen', cursive",
                fontSize: '0.55rem',
                letterSpacing: '0.08em',
                cursor: 'pointer',
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
        )}

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {activeTab === 'items' &&
            ITEM_CATEGORIES.map((cat) => {
              const itemsInCat = ITEMS.filter(
                (it) =>
                  it.category === cat.id &&
                  (!filteredQuery ||
                    it.label.toLowerCase().includes(filteredQuery) ||
                    it.id.toLowerCase().includes(filteredQuery)),
              );
              if (itemsInCat.length === 0) return null;
              return (
                <div key={cat.id}>
                  <div
                    style={{
                      fontSize: '0.55rem',
                      letterSpacing: '0.16em',
                      color: 'rgba(225,215,255,0.65)',
                      textTransform: 'uppercase',
                      marginBottom: 6,
                    }}
                  >
                    {cat.label}
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, 48px)',
                      gap: 6,
                    }}
                  >
                    {itemsInCat.map((it) => {
                      const active = itemBrush === it.id;
                      return (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => {
                            setItemBrush(it.id);
                            setMode('paint');
                          }}
                          title={it.label}
                          style={{
                            width: 48,
                            height: 48,
                            background: '#0a0a14',
                            border: active
                              ? '2px solid #ffcc00'
                              : '2px solid rgba(75,45,142,0.5)',
                            cursor: 'pointer',
                            padding: 4,
                            boxShadow: active
                              ? '0 0 8px #ffcc00'
                              : 'none',
                          }}
                        >
                          <img
                            src={itemDataUrl(it)}
                            alt={it.label}
                            style={{
                              width: '100%',
                              height: '100%',
                              imageRendering: 'pixelated',
                              display: 'block',
                            }}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          {activeTab === 'tiles' &&
            visibleSheets
            .filter(
              (s) =>
                !filteredQuery ||
                s.name.toLowerCase().includes(filteredQuery) ||
                s.id.toLowerCase().includes(filteredQuery) ||
                s.category.toLowerCase().includes(filteredQuery),
            )
            .map((sheet) => {
              const sheetIdx = SHEETS.indexOf(sheet);
              return (
                <div key={sheet.id}>
                  <div
                    style={{
                      fontSize: '0.55rem',
                      letterSpacing: '0.16em',
                      color: 'rgba(225,215,255,0.65)',
                      textTransform: 'uppercase',
                      marginBottom: 6,
                    }}
                  >
                    {sheet.name} · {sheet.cols}×{sheet.rows}
                  </div>
                  <SheetPalette
                    sheet={sheet}
                    sheetIdx={sheetIdx}
                    selected={
                      brush?.sheetIdx === sheetIdx ? brush : null
                    }
                    onPick={(b) => {
                      setBrush(b);
                      setMode('paint');
                    }}
                  />
                </div>
              );
            })}
        </div>
      </aside>

      {/* ── Main editor area ── */}
      <main
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {/* Toolbar */}
        <div
          style={{
            padding: '10px 14px',
            borderBottom: '2px solid rgba(75,45,142,0.4)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            background: '#0f1320',
          }}
        >
          <ToolbarLabel>Tamaño</ToolbarLabel>
          <NumberInput
            value={width}
            min={5}
            max={500}
            onChange={setWidth}
            onCommit={pushHistory}
          />
          <span style={{ color: 'rgba(225,215,255,0.5)' }}>×</span>
          <NumberInput
            value={height}
            min={5}
            max={500}
            onChange={setHeight}
            onCommit={pushHistory}
          />

          <Sep />

          <IconButton
            icon="✎"
            hotkey="Q"
            label="Pintar"
            active={mode === 'paint'}
            onClick={() => setMode('paint')}
          />
          <IconButton
            icon="▥"
            hotkey="W"
            label="Colisión (clic en tile pintado)"
            active={mode === 'collision'}
            onClick={() => setMode('collision')}
          />
          <IconButton
            icon="✕"
            hotkey="E"
            label="Borrar"
            active={mode === 'erase'}
            onClick={() => setMode('erase')}
          />
          <IconButton
            icon="◎"
            hotkey="R"
            label="Posición inicial"
            active={mode === 'spawn'}
            onClick={() => setMode('spawn')}
          />

          <Sep />

          <IconButton
            icon="◉"
            hotkey="1"
            label="Mostrar colisiones"
            active={showCollisions}
            onClick={() => setShowCollisions((v) => !v)}
          />

          <Sep />

          <IconButton
            icon="↶"
            hotkey="A"
            label="Deshacer"
            disabled={historyIdx <= 0}
            onClick={undo}
          />
          <IconButton
            icon="↷"
            hotkey="S"
            label="Rehacer"
            disabled={historyIdx >= history.length - 1}
            onClick={redo}
          />

          <Sep />

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="pixel-btn pixel-btn-primary"
            title="Guardar (⌘S / Ctrl+S)"
            style={{ padding: '6px 14px', fontSize: '0.62rem' }}
          >
            {saving ? 'Guardando…' : 'Guardar (⌘S)'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="pixel-btn pixel-btn-secondary"
            style={{ padding: '6px 14px', fontSize: '0.62rem' }}
          >
            Salir del editor
          </button>
          {savedAt && (
            <span
              style={{
                fontSize: '0.55rem',
                color: 'rgba(150,220,150,0.85)',
                letterSpacing: '0.12em',
                marginLeft: 'auto',
              }}
            >
              ✓ Guardado
            </span>
          )}
          {brush && mode === 'paint' && <BrushPreview brush={brush} />}
          {mode === 'erase' && (
            <span
              style={{
                fontSize: '0.55rem',
                color: '#ff8080',
                letterSpacing: '0.1em',
              }}
            >
              ✕ MODO BORRAR
            </span>
          )}
          {mode === 'collision' && (
            <span
              style={{
                fontSize: '0.55rem',
                color: '#ff8080',
                letterSpacing: '0.1em',
              }}
            >
              ▥ MODO COLISIÓN · clic en tile pintado
            </span>
          )}
          {mode === 'spawn' && (
            <span
              style={{
                fontSize: '0.55rem',
                color: '#3bd16f',
                letterSpacing: '0.1em',
              }}
            >
              ◎ MODO POSICIÓN INICIAL · ({spawnX},{spawnY})
            </span>
          )}
        </div>

        {/* Canvas */}
        <div
          ref={containerRef}
          style={{
            flex: 1,
            overflow: 'auto',
            background: '#05060d',
            padding: 24,
          }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={(e) => {
              paintingRef.current = true;
              lastDragCellRef.current = null;
              paintAt(e.clientX, e.clientY);
            }}
            onMouseUp={() => {
              if (paintingRef.current) {
                paintingRef.current = false;
                lastDragCellRef.current = null;
                pushHistory();
              }
            }}
            onMouseLeave={() => {
              if (paintingRef.current) {
                paintingRef.current = false;
                lastDragCellRef.current = null;
                pushHistory();
              }
            }}
            onMouseMove={(e) => {
              if (paintingRef.current) paintAt(e.clientX, e.clientY);
            }}
            style={{
              imageRendering: 'pixelated',
              width: width * TILE_PX * VIEW_SCALE,
              height: height * TILE_PX * VIEW_SCALE,
              cursor:
                mode === 'erase'
                  ? 'not-allowed'
                  : mode === 'spawn'
                    ? 'cell'
                    : mode === 'collision'
                      ? 'crosshair'
                      : brush
                        ? 'crosshair'
                        : 'default',
              boxShadow: '6px 6px 0 rgba(0,0,0,0.5)',
            }}
          />
        </div>
      </main>
    </div>
  );
}

function SheetPalette({
  sheet,
  sheetIdx,
  selected,
  onPick,
}: {
  sheet: (typeof SHEETS)[number];
  sheetIdx: number;
  selected: Brush | null;
  onPick: (b: Brush) => void;
}) {
  const PALETTE_TILE = 24;
  const [dragStart, setDragStart] = useState<{ sx: number; sy: number } | null>(
    null,
  );
  const [dragNow, setDragNow] = useState<{ sx: number; sy: number } | null>(
    null,
  );

  const cellAt = (e: React.MouseEvent, el: HTMLDivElement) => {
    const rect = el.getBoundingClientRect();
    const sx = Math.floor((e.clientX - rect.left) / PALETTE_TILE);
    const sy = Math.floor((e.clientY - rect.top) / PALETTE_TILE);
    if (sx < 0 || sy < 0 || sx >= sheet.cols || sy >= sheet.rows) return null;
    return { sx, sy };
  };

  // Highlight rectangle: live drag if dragging, otherwise the saved
  // brush selection (when this palette matches the active sheet).
  const highlight = dragStart && dragNow
    ? {
        sx: Math.min(dragStart.sx, dragNow.sx),
        sy: Math.min(dragStart.sy, dragNow.sy),
        w: Math.abs(dragNow.sx - dragStart.sx) + 1,
        h: Math.abs(dragNow.sy - dragStart.sy) + 1,
      }
    : selected
      ? { sx: selected.sx, sy: selected.sy, w: selected.w, h: selected.h }
      : null;

  return (
    <div
      style={{
        position: 'relative',
        width: sheet.cols * PALETTE_TILE,
        maxWidth: '100%',
        background: '#0a0a14',
        border: '1px solid rgba(75,45,142,0.4)',
        backgroundImage: `url(${sheet.url})`,
        backgroundSize: `${sheet.cols * PALETTE_TILE}px ${sheet.rows * PALETTE_TILE}px`,
        imageRendering: 'pixelated',
        height: sheet.rows * PALETTE_TILE,
        cursor: 'crosshair',
        userSelect: 'none',
      }}
      onMouseDown={(e) => {
        const c = cellAt(e, e.currentTarget as HTMLDivElement);
        if (!c) return;
        setDragStart(c);
        setDragNow(c);
      }}
      onMouseMove={(e) => {
        if (!dragStart) return;
        const c = cellAt(e, e.currentTarget as HTMLDivElement);
        if (c) setDragNow(c);
      }}
      onMouseUp={() => {
        if (!dragStart || !dragNow) {
          setDragStart(null);
          setDragNow(null);
          return;
        }
        const sx = Math.min(dragStart.sx, dragNow.sx);
        const sy = Math.min(dragStart.sy, dragNow.sy);
        const w = Math.abs(dragNow.sx - dragStart.sx) + 1;
        const h = Math.abs(dragNow.sy - dragStart.sy) + 1;
        onPick({ sheetIdx, sx, sy, w, h });
        setDragStart(null);
        setDragNow(null);
      }}
      onMouseLeave={() => {
        if (dragStart && dragNow) {
          const sx = Math.min(dragStart.sx, dragNow.sx);
          const sy = Math.min(dragStart.sy, dragNow.sy);
          const w = Math.abs(dragNow.sx - dragStart.sx) + 1;
          const h = Math.abs(dragNow.sy - dragStart.sy) + 1;
          onPick({ sheetIdx, sx, sy, w, h });
        }
        setDragStart(null);
        setDragNow(null);
      }}
    >
      {highlight && (
        <div
          style={{
            position: 'absolute',
            left: highlight.sx * PALETTE_TILE,
            top: highlight.sy * PALETTE_TILE,
            width: highlight.w * PALETTE_TILE,
            height: highlight.h * PALETTE_TILE,
            border: '2px solid #ffcc00',
            boxShadow: '0 0 6px #ffcc00',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
}

function BrushPreview({ brush }: { brush: Brush }) {
  const sheet = SHEETS[brush.sheetIdx];
  // Cap the preview size so a huge selection doesn't blow up the toolbar.
  const PREVIEW_TILE = Math.max(6, Math.min(16, Math.floor(64 / Math.max(brush.w, brush.h))));
  const previewW = brush.w * PREVIEW_TILE;
  const previewH = brush.h * PREVIEW_TILE;
  return (
    <div
      style={{
        marginLeft: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: '0.55rem',
        color: 'rgba(225,215,255,0.7)',
      }}
    >
      Brocha:
      <div
        style={{
          width: previewW,
          height: previewH,
          background: `url(${sheet.url}) -${brush.sx * PREVIEW_TILE}px -${brush.sy * PREVIEW_TILE}px / ${sheet.cols * PREVIEW_TILE}px ${sheet.rows * PREVIEW_TILE}px no-repeat`,
          imageRendering: 'pixelated',
          border: '2px solid var(--color-accent)',
        }}
      />
      <span style={{ fontFamily: 'monospace' }}>
        {sheet.id} ({brush.sx},{brush.sy})
        {(brush.w > 1 || brush.h > 1) && ` ${brush.w}×${brush.h}`}
      </span>
    </div>
  );
}

function IconButton({
  icon,
  hotkey,
  label,
  active = false,
  disabled = false,
  onClick,
}: {
  icon: string;
  hotkey: string;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={`${label} (${hotkey})`}
      style={{
        position: 'relative',
        width: 38,
        height: 38,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: active ? 'var(--color-accent)' : '#1a1a1a',
        color: active
          ? '#0a0a14'
          : disabled
            ? 'rgba(225,215,255,0.3)'
            : '#e5e5e5',
        border: active ? '2px solid #ffcc00' : '2px solid var(--color-accent)',
        boxShadow: active ? '0 0 6px #ffcc00' : 'none',
        fontFamily: "'Silkscreen', cursive",
        fontSize: '1.05rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        padding: 0,
      }}
    >
      <span style={{ lineHeight: 1, paddingBottom: 4 }}>{icon}</span>
      <span
        style={{
          position: 'absolute',
          bottom: 2,
          right: 3,
          fontSize: '0.5rem',
          letterSpacing: '0.04em',
          color: active ? '#0a0a14' : 'rgba(225,215,255,0.6)',
        }}
      >
        {hotkey}
      </span>
    </button>
  );
}

function NumberInput({
  value,
  min,
  max,
  onChange,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  onCommit?: () => void;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => {
        const n = parseInt(e.target.value, 10);
        if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)));
      }}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onCommit?.();
      }}
      style={{
        width: 70,
        padding: '4px 6px',
        background: '#0f1320',
        border: '2px solid var(--color-accent)',
        color: '#e5e5e5',
        fontFamily: "'Silkscreen', cursive",
        fontSize: '0.65rem',
        outline: 'none',
      }}
    />
  );
}

function ToolbarLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: '0.55rem',
        letterSpacing: '0.18em',
        color: 'rgba(225,215,255,0.6)',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  );
}

function Sep() {
  return (
    <div
      style={{
        width: 1,
        height: 22,
        background: 'rgba(75,45,142,0.5)',
        margin: '0 4px',
      }}
    />
  );
}
