'use client';

import { useEffect, useMemo, useState } from 'react';
import { GAME_EVENTS } from '@/lib/world/events';
import type {
  CinematicCharacter,
  CinematicData,
  CinematicFrame,
  SceneMeta,
} from './sheets';

// Coordinate space of every cinematic frame. The runtime player and
// the editor preview both scale this to fit the viewport.
const FRAME_W = 1280;
const FRAME_H = 720;
// Display scale inside the editor preview area (constrained so the
// inspector still fits on a 14" laptop screen).
const PREVIEW_SCALE = 0.55;

function newId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

function emptyFrame(): CinematicFrame {
  return {
    id: newId('fr'),
    backdrop: { kind: 'color', color: '#faf9f8' },
    characters: [],
    transition: 'cut',
  };
}

export default function CinematicEditor({
  scene,
  initialData,
  onClose,
  onSaved,
}: {
  scene: SceneMeta;
  initialData: CinematicData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(scene.name);
  const [eventTrigger, setEventTrigger] = useState<string>(
    scene.eventTrigger ?? '',
  );
  const [musicUrl, setMusicUrl] = useState<string>(scene.musicUrl ?? '');
  const [musicVolume, setMusicVolume] = useState<number>(
    typeof scene.musicVolume === 'number' ? scene.musicVolume : 0.5,
  );
  const [frames, setFrames] = useState<CinematicFrame[]>(() =>
    initialData.frames?.length
      ? initialData.frames
      : [emptyFrame()],
  );
  const [activeFrameId, setActiveFrameId] = useState<string>(
    () => initialData.frames?.[0]?.id ?? '',
  );
  // Ensure activeFrameId always points at something valid.
  useEffect(() => {
    if (!frames.find((f) => f.id === activeFrameId)) {
      setActiveFrameId(frames[0]?.id ?? '');
    }
  }, [frames, activeFrameId]);

  const activeFrame = useMemo(
    () => frames.find((f) => f.id === activeFrameId) ?? null,
    [frames, activeFrameId],
  );

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const updateFrame = (id: string, patch: Partial<CinematicFrame>) => {
    setFrames((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };
  const addFrame = () => {
    const f = emptyFrame();
    setFrames((prev) => [...prev, f]);
    setActiveFrameId(f.id);
  };
  const removeFrame = (id: string) => {
    if (frames.length <= 1) return;
    setFrames((prev) => prev.filter((f) => f.id !== id));
  };
  const moveFrame = (id: string, dir: -1 | 1) => {
    setFrames((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      const newIdx = idx + dir;
      if (idx < 0 || newIdx < 0 || newIdx >= prev.length) return prev;
      const next = prev.slice();
      const [moved] = next.splice(idx, 1);
      next.splice(newIdx, 0, moved);
      return next;
    });
  };

  const addCharacter = () => {
    if (!activeFrame) return;
    const c: CinematicCharacter = {
      id: newId('ch'),
      spriteUrl: '',
      x: FRAME_W / 2,
      y: FRAME_H * 0.7,
      scale: 1,
    };
    updateFrame(activeFrame.id, {
      characters: [...activeFrame.characters, c],
    });
  };
  const updateCharacter = (chId: string, patch: Partial<CinematicCharacter>) => {
    if (!activeFrame) return;
    updateFrame(activeFrame.id, {
      characters: activeFrame.characters.map((c) =>
        c.id === chId ? { ...c, ...patch } : c,
      ),
    });
  };
  const removeCharacter = (chId: string) => {
    if (!activeFrame) return;
    updateFrame(activeFrame.id, {
      characters: activeFrame.characters.filter((c) => c.id !== chId),
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`/api/world/scenes/${encodeURIComponent(scene.slug)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          musicUrl: musicUrl || null,
          musicVolume,
          eventTrigger: eventTrigger || null,
          data: { frames },
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        alert(j?.error ?? 'No se pudo guardar');
        return;
      }
      setSavedAt(Date.now());
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#faf9f8',
        color: '#323130',
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
      }}
    >
      {/* ── Top bar: scene metadata ── */}
      <div
        style={{
          padding: '10px 16px',
          background: '#ffffff',
          borderBottom: '1px solid #d1d1d1',
          display: 'flex',
          gap: 14,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: '0.75rem',
            letterSpacing: '0.18em',
            color: '#0078d4',
            textTransform: 'uppercase',
          }}
        >
          Cinemática · {scene.slug}
        </span>
        <Field label="Nombre" inline>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle(180)}
          />
        </Field>
        <Field label="Evento disparador" inline>
          <select
            value={eventTrigger}
            onChange={(e) => setEventTrigger(e.target.value)}
            style={inputStyle(170)}
          >
            <option value="">— ninguno —</option>
            {GAME_EVENTS.map((ev) => (
              <option key={ev} value={ev}>
                {ev}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Música (URL)" inline>
          <input
            value={musicUrl}
            onChange={(e) => setMusicUrl(e.target.value)}
            placeholder="/audio/intro.mp3"
            style={inputStyle(220)}
          />
        </Field>
        <Field label={`Vol ${Math.round(musicVolume * 100)}%`} inline>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={musicVolume}
            onChange={(e) => setMusicVolume(Number(e.target.value))}
            style={{ width: 110, accentColor: '#0078d4' }}
          />
        </Field>
        <div style={{ flex: 1 }} />
        {savedAt && (
          <span
            style={{
              fontSize: '0.55rem',
              color: 'rgba(150,220,150,0.85)',
              letterSpacing: '0.12em',
            }}
          >
            ✓ Guardado
          </span>
        )}
        <button
          type="button"
          onClick={save}
          disabled={saving}
          title="Guardar"
          aria-label="Guardar"
          style={{
            padding: '6px 12px',
            fontSize: '1rem',
            lineHeight: 1,
            background: '#0078d4',
            color: '#323130',
            border: 'none',
            borderRadius: 4,
            fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
            cursor: saving ? 'wait' : 'pointer',
            opacity: saving ? 0.6 : 1,
          }}
        >
          💾
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '6px 12px',
            fontSize: '0.78rem',
            background: '#ffffff',
            color: '#323130',
            border: '1px solid rgba(0,120,212,0.4)',
            borderRadius: 4,
            fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
            cursor: 'pointer',
          }}
        >
          Salir
        </button>
      </div>

      {/* ── Body: frames | preview | inspector ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '200px 1fr 320px',
          minHeight: 0,
        }}
      >
        {/* Frames list */}
        <aside
          style={{
            background: '#faf9f8',
            borderRight: '1px solid #edebe9',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <div
            style={{
              padding: 10,
              borderBottom: '1px solid rgba(0,120,212,0.4)',
              display: 'flex',
              gap: 6,
            }}
          >
            <button
              type="button"
              onClick={addFrame}
              style={btn()}
              title="Añadir frame"
            >
              + Frame
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '6px 6px 12px' }}>
            {frames.map((f, i) => {
              const active = f.id === activeFrameId;
              return (
                <div
                  key={f.id}
                  onClick={() => setActiveFrameId(f.id)}
                  style={{
                    padding: '6px 8px',
                    margin: '2px 4px',
                    background: active ? 'rgba(0,120,212,0.35)' : 'transparent',
                    border: active
                      ? '1px solid #0078d4'
                      : '1px solid transparent',
                    cursor: 'pointer',
                    fontSize: '0.6rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span style={{ color: '#0078d4', minWidth: 20 }}>
                      #{i + 1}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {f.dialog?.text?.slice(0, 24) || '(sin diálogo)'}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 3,
                      fontSize: '0.5rem',
                      color: 'rgba(50,49,48,0.55)',
                    }}
                  >
                    <span>{f.backdrop.kind}</span>
                    <span>·</span>
                    <span>{f.characters.length}p</span>
                    {f.duration ? <span>· {f.duration}ms</span> : <span>· clic</span>}
                  </div>
                  {active && (
                    <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveFrame(f.id, -1);
                        }}
                        disabled={i === 0}
                        style={smallBtn(i === 0)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveFrame(f.id, 1);
                        }}
                        disabled={i === frames.length - 1}
                        style={smallBtn(i === frames.length - 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFrame(f.id);
                        }}
                        disabled={frames.length <= 1}
                        style={smallBtn(frames.length <= 1)}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Preview */}
        <main
          style={{
            display: 'grid',
            placeItems: 'center',
            background: '#edebe9',
            padding: 24,
            overflow: 'auto',
          }}
        >
          {activeFrame && (
            <FramePreview
              frame={activeFrame}
              onMoveCharacter={(chId, x, y) =>
                updateCharacter(chId, { x, y })
              }
            />
          )}
        </main>

        {/* Inspector */}
        <aside
          style={{
            background: '#ffffff',
            borderLeft: '1px solid #d1d1d1',
            padding: 14,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {activeFrame && (
            <FrameInspector
              frame={activeFrame}
              onUpdate={(patch) => updateFrame(activeFrame.id, patch)}
              onAddCharacter={addCharacter}
              onUpdateCharacter={updateCharacter}
              onRemoveCharacter={removeCharacter}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

function FramePreview({
  frame,
  onMoveCharacter,
}: {
  frame: CinematicFrame;
  onMoveCharacter: (id: string, x: number, y: number) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  return (
    <div
      style={{
        position: 'relative',
        width: FRAME_W * PREVIEW_SCALE,
        height: FRAME_H * PREVIEW_SCALE,
        background:
          frame.backdrop.kind === 'color'
            ? frame.backdrop.color
            : '#000',
        border: '1px solid #d1d1d1',
        boxShadow: '6px 6px 0 rgba(0,0,0,0.5)',
        overflow: 'hidden',
        userSelect: 'none',
      }}
      onMouseMove={(e) => {
        if (!draggingId) return;
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const x = (e.clientX - rect.left) / PREVIEW_SCALE;
        const y = (e.clientY - rect.top) / PREVIEW_SCALE;
        onMoveCharacter(draggingId, x, y);
      }}
      onMouseUp={() => setDraggingId(null)}
      onMouseLeave={() => setDraggingId(null)}
    >
      {frame.backdrop.kind === 'image' && frame.backdrop.url && (
        <img
          src={frame.backdrop.url}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      )}
      {frame.characters.map((c) => (
        <div
          key={c.id}
          onMouseDown={(e) => {
            e.preventDefault();
            setDraggingId(c.id);
          }}
          style={{
            position: 'absolute',
            left: c.x * PREVIEW_SCALE - 32,
            top: c.y * PREVIEW_SCALE - 64,
            cursor: 'grab',
          }}
        >
          {c.spriteUrl ? (
            <img
              src={c.spriteUrl}
              alt=""
              draggable={false}
              style={{
                width: 64 * (c.scale ?? 1) * PREVIEW_SCALE,
                height: 64 * (c.scale ?? 1) * PREVIEW_SCALE,
                imageRendering: 'pixelated',
                transform: c.flip ? 'scaleX(-1)' : undefined,
              }}
            />
          ) : (
            <div
              style={{
                width: 64 * PREVIEW_SCALE,
                height: 64 * PREVIEW_SCALE,
                background: 'rgba(255,128,240,0.2)',
                border: '1px dashed #ff80f0',
                display: 'grid',
                placeItems: 'center',
                fontSize: '0.5rem',
                color: '#ff80f0',
              }}
            >
              ?
            </div>
          )}
        </div>
      ))}
      {frame.dialog && frame.dialog.text && (
        <div
          style={{
            position: 'absolute',
            left: 30 * PREVIEW_SCALE,
            right: 30 * PREVIEW_SCALE,
            bottom: 30 * PREVIEW_SCALE,
            padding: 14,
            background: 'rgba(10, 10, 20, 0.85)',
            border: '1px solid #d1d1d1',
            color: '#323130',
            fontSize: 14 * PREVIEW_SCALE,
          }}
        >
          {frame.dialog.speaker && (
            <div style={{ color: '#0078d4', marginBottom: 6 }}>
              {frame.dialog.speaker}
            </div>
          )}
          {frame.dialog.text}
        </div>
      )}
    </div>
  );
}

function FrameInspector({
  frame,
  onUpdate,
  onAddCharacter,
  onUpdateCharacter,
  onRemoveCharacter,
}: {
  frame: CinematicFrame;
  onUpdate: (patch: Partial<CinematicFrame>) => void;
  onAddCharacter: () => void;
  onUpdateCharacter: (chId: string, patch: Partial<CinematicCharacter>) => void;
  onRemoveCharacter: (chId: string) => void;
}) {
  return (
    <>
      <Section title="Backdrop">
        <select
          value={frame.backdrop.kind}
          onChange={(e) => {
            const kind = e.target.value as 'color' | 'image';
            if (kind === 'color') {
              onUpdate({ backdrop: { kind: 'color', color: '#faf9f8' } });
            } else {
              onUpdate({ backdrop: { kind: 'image', url: '' } });
            }
          }}
          style={inputStyle('100%')}
        >
          <option value="color">Color sólido</option>
          <option value="image">Imagen (URL)</option>
        </select>
        {frame.backdrop.kind === 'color' && (
          <input
            type="color"
            value={frame.backdrop.color}
            onChange={(e) =>
              onUpdate({ backdrop: { kind: 'color', color: e.target.value } })
            }
            style={{ width: '100%', height: 30, marginTop: 6 }}
          />
        )}
        {frame.backdrop.kind === 'image' && (
          <input
            type="text"
            placeholder="/cinematics/intro-01.png"
            value={frame.backdrop.url}
            onChange={(e) =>
              onUpdate({ backdrop: { kind: 'image', url: e.target.value } })
            }
            style={{ ...inputStyle('100%'), marginTop: 6 }}
          />
        )}
      </Section>

      <Section title={`Personajes (${frame.characters.length})`}>
        <button type="button" onClick={onAddCharacter} style={btn()}>
          + Personaje
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          {frame.characters.map((c) => (
            <div
              key={c.id}
              style={{
                padding: 8,
                background: '#faf9f8',
                border: '1px solid rgba(0,120,212,0.6)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <input
                placeholder="URL del sprite"
                value={c.spriteUrl}
                onChange={(e) =>
                  onUpdateCharacter(c.id, { spriteUrl: e.target.value })
                }
                style={inputStyle('100%')}
              />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <Field label="X" inline>
                  <input
                    type="number"
                    value={c.x}
                    onChange={(e) =>
                      onUpdateCharacter(c.id, { x: Number(e.target.value) })
                    }
                    style={inputStyle('100%')}
                  />
                </Field>
                <Field label="Y" inline>
                  <input
                    type="number"
                    value={c.y}
                    onChange={(e) =>
                      onUpdateCharacter(c.id, { y: Number(e.target.value) })
                    }
                    style={inputStyle('100%')}
                  />
                </Field>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, alignItems: 'center' }}>
                <Field label={`Escala ${(c.scale ?? 1).toFixed(2)}`} inline>
                  <input
                    type="range"
                    min={0.25}
                    max={4}
                    step={0.05}
                    value={c.scale ?? 1}
                    onChange={(e) =>
                      onUpdateCharacter(c.id, { scale: Number(e.target.value) })
                    }
                    style={{ width: '100%', accentColor: '#0078d4' }}
                  />
                </Field>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.55rem' }}>
                  <input
                    type="checkbox"
                    checked={!!c.flip}
                    onChange={(e) =>
                      onUpdateCharacter(c.id, { flip: e.target.checked })
                    }
                  />
                  Voltear
                </label>
              </div>
              <button
                type="button"
                onClick={() => onRemoveCharacter(c.id)}
                style={{ ...btn(), background: '#fde7e9', color: '#a4262c', borderColor: '#a4262c' }}
              >
                Borrar personaje
              </button>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Diálogo">
        <Field label="Speaker (vacío = narrador)">
          <input
            value={frame.dialog?.speaker ?? ''}
            onChange={(e) =>
              onUpdate({
                dialog: {
                  speaker: e.target.value,
                  text: frame.dialog?.text ?? '',
                  portraitUrl: frame.dialog?.portraitUrl,
                },
              })
            }
            style={inputStyle('100%')}
          />
        </Field>
        <Field label="Texto">
          <textarea
            rows={4}
            value={frame.dialog?.text ?? ''}
            onChange={(e) =>
              onUpdate({
                dialog: {
                  speaker: frame.dialog?.speaker ?? '',
                  text: e.target.value,
                  portraitUrl: frame.dialog?.portraitUrl,
                },
              })
            }
            style={{ ...inputStyle('100%'), resize: 'vertical' }}
          />
        </Field>
        <Field label="Retrato (URL, opcional)">
          <input
            value={frame.dialog?.portraitUrl ?? ''}
            onChange={(e) =>
              onUpdate({
                dialog: {
                  speaker: frame.dialog?.speaker ?? '',
                  text: frame.dialog?.text ?? '',
                  portraitUrl: e.target.value || undefined,
                },
              })
            }
            style={inputStyle('100%')}
          />
        </Field>
      </Section>

      <Section title="Tiempo">
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.55rem',
            marginBottom: 6,
          }}
        >
          <input
            type="checkbox"
            checked={frame.duration == null}
            onChange={(e) =>
              onUpdate({
                duration: e.target.checked ? undefined : 2000,
              })
            }
          />
          Esperar clic / Espacio
        </label>
        {frame.duration != null && (
          <Field label={`Duración: ${frame.duration} ms`}>
            <input
              type="range"
              min={250}
              max={10000}
              step={50}
              value={frame.duration}
              onChange={(e) =>
                onUpdate({ duration: Number(e.target.value) })
              }
              style={{ width: '100%', accentColor: '#0078d4' }}
            />
          </Field>
        )}
        <Field label="Transición desde el frame anterior">
          <select
            value={frame.transition ?? 'cut'}
            onChange={(e) =>
              onUpdate({ transition: e.target.value as 'cut' | 'fade' })
            }
            style={inputStyle('100%')}
          >
            <option value="cut">Corte</option>
            <option value="fade">Fundido</option>
          </select>
        </Field>
      </Section>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          fontSize: '0.7rem',
          letterSpacing: '0.18em',
          color: '#0078d4',
          textTransform: 'uppercase',
          borderBottom: '1px solid rgba(0,120,212,0.4)',
          paddingBottom: 4,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  inline,
  children,
}: {
  label: string;
  inline?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      style={{
        display: 'flex',
        flexDirection: inline ? 'row' : 'column',
        gap: inline ? 6 : 3,
        alignItems: inline ? 'center' : 'stretch',
      }}
    >
      <span
        style={{
          fontSize: '0.5rem',
          color: 'rgba(50,49,48,0.65)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function inputStyle(width: number | string = 'auto'): React.CSSProperties {
  return {
    width,
    background: '#faf9f8',
    color: '#323130',
    border: '1px solid #d1d1d1',
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    fontSize: '0.6rem',
    padding: '4px 6px',
    outline: 'none',
  };
}

function btn(): React.CSSProperties {
  return {
    padding: '6px 10px',
    background: '#ffffff',
    color: '#323130',
    border: '1px solid #d1d1d1',
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    fontSize: '0.6rem',
    letterSpacing: '0.1em',
    cursor: 'pointer',
    textTransform: 'uppercase',
  };
}

function smallBtn(disabled = false): React.CSSProperties {
  return {
    width: 22,
    height: 20,
    padding: 0,
    background: '#ffffff',
    color: disabled ? 'rgba(50,49,48,0.3)' : '#ffffff',
    border: '1px solid rgba(0,120,212,0.6)',
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    fontSize: '0.55rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}
