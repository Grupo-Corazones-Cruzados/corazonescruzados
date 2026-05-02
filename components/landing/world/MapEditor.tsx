'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CATEGORIES,
  SHEETS,
  TILE_PX,
  type LayerData,
  type Tile,
  type WorldMapData,
} from './sheets';

type Brush = {
  sheetIdx: number;
  sx: number;
  sy: number;
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
  const [collide, setCollide] = useState(false);
  const [eraseMode, setEraseMode] = useState(false);
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

    for (const t of tiles) {
      const sheet = SHEETS[t.s];
      const img = imgs[t.s];
      if (!sheet || !img) continue;
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
    }

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
  }, [tiles, imgs, width, height, showCollisions]);

  // ── Painting ──────────────────────────────────────────────────
  const paintingRef = useRef(false);

  const paintAt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = Math.floor((clientX - rect.left) / (TILE_PX * VIEW_SCALE));
    const cy = Math.floor((clientY - rect.top) / (TILE_PX * VIEW_SCALE));
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) return;

    if (eraseMode) {
      const idx = tileIdxByCell.get(`${cx},${cy}`);
      if (idx == null) return;
      setTiles((prev) => prev.filter((_, i) => i !== idx));
      return;
    }
    if (!brush) return;
    const newTile: Tile = {
      x: cx,
      y: cy,
      s: brush.sheetIdx,
      sx: brush.sx,
      sy: brush.sy,
    };
    if (collide) newTile.c = 1;
    setTiles((prev) => {
      const idx = prev.findIndex((t) => t.x === cx && t.y === cy);
      if (idx >= 0) {
        const copy = prev.slice();
        copy[idx] = newTile;
        return copy;
      }
      return [...prev, newTile];
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
        body: JSON.stringify({ width, height, layers }),
      });
      const j = await r.json();
      if (!r.ok) {
        alert(j?.error ?? 'No se pudo guardar');
        return;
      }
      setSavedAt(Date.now());
      onSaved({ name: 'default', width, height, layers });
    } finally {
      setSaving(false);
    }
  };

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
          {visibleSheets
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
                      setEraseMode(false);
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
          <NumberInput value={width} min={5} max={500} onChange={setWidth} />
          <span style={{ color: 'rgba(225,215,255,0.5)' }}>×</span>
          <NumberInput value={height} min={5} max={500} onChange={setHeight} />

          <Sep />

          <Toggle
            checked={collide}
            onChange={setCollide}
            label="Pintar con colisión"
          />
          <Toggle
            checked={showCollisions}
            onChange={setShowCollisions}
            label="Mostrar colisiones"
          />
          <Toggle
            checked={eraseMode}
            onChange={(v) => {
              setEraseMode(v);
              if (v) setBrush(null);
            }}
            label="Borrar"
          />

          <Sep />

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="pixel-btn pixel-btn-primary"
            style={{ padding: '6px 14px', fontSize: '0.62rem' }}
          >
            {saving ? 'Guardando…' : 'Guardar mapa'}
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
          {brush && !eraseMode && (
            <BrushPreview brush={brush} />
          )}
          {eraseMode && (
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
              paintAt(e.clientX, e.clientY);
            }}
            onMouseUp={() => {
              paintingRef.current = false;
            }}
            onMouseLeave={() => {
              paintingRef.current = false;
            }}
            onMouseMove={(e) => {
              if (paintingRef.current) paintAt(e.clientX, e.clientY);
            }}
            style={{
              imageRendering: 'pixelated',
              width: width * TILE_PX * VIEW_SCALE,
              height: height * TILE_PX * VIEW_SCALE,
              cursor: eraseMode
                ? 'not-allowed'
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
  const PALETTE_TILE = 24; // shrunk for palette display
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
      }}
      onClick={(e) => {
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const sx = Math.floor((e.clientX - rect.left) / PALETTE_TILE);
        const sy = Math.floor((e.clientY - rect.top) / PALETTE_TILE);
        if (sx < 0 || sy < 0 || sx >= sheet.cols || sy >= sheet.rows) return;
        onPick({ sheetIdx, sx, sy });
      }}
    >
      {selected && (
        <div
          style={{
            position: 'absolute',
            left: selected.sx * PALETTE_TILE,
            top: selected.sy * PALETTE_TILE,
            width: PALETTE_TILE,
            height: PALETTE_TILE,
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
          width: 32,
          height: 32,
          background: `url(${sheet.url}) -${brush.sx * TILE_PX}px -${brush.sy * TILE_PX}px / ${sheet.cols * TILE_PX}px ${sheet.rows * TILE_PX}px no-repeat`,
          imageRendering: 'pixelated',
          border: '2px solid var(--color-accent)',
        }}
      />
      <span style={{ fontFamily: 'monospace' }}>
        {sheet.id} ({brush.sx},{brush.sy})
      </span>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        cursor: 'pointer',
        fontSize: '0.55rem',
        letterSpacing: '0.1em',
        color: '#e5e5e5',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: '#7B5FBF' }}
      />
      {label}
    </label>
  );
}

function NumberInput({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
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
