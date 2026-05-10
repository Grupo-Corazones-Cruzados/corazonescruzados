'use client';

import { useEffect, useMemo, useState } from 'react';
import MapEditor from './MapEditor';
import CinematicEditor from './CinematicEditor';
import type {
  CinematicData,
  SceneKind,
  SceneMeta,
  WorldMapData,
} from './sheets';

// SceneManagerEditor is the new editor entry point. It owns the list of
// scenes (game-engine style: each scene is the unit of "what's loaded
// right now") and routes the right-hand workspace to the right inner
// editor (MapEditor for kind='map', CinematicEditor for kind='cinematic').
//
// MapEditor's outer container is `position: absolute; inset: 0` (was
// `fixed inset: 0`). This wrapper supplies the fixed full-screen frame
// and the sidebar; the inner editor fills whatever's left.
export default function SceneManagerEditor({
  onClose,
}: {
  onClose: () => void;
}) {
  const [scenes, setScenes] = useState<SceneMeta[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [loadingActive, setLoadingActive] = useState(true);
  const [activePayload, setActivePayload] = useState<
    | { kind: 'map'; map: WorldMapData; meta: SceneMeta }
    | { kind: 'cinematic'; data: CinematicData; meta: SceneMeta }
    | null
  >(null);
  const [creating, setCreating] = useState<null | SceneKind>(null);
  const [renamingSlug, setRenamingSlug] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const refreshList = async () => {
    const r = await fetch('/api/world/scenes');
    const j = await r.json();
    if (Array.isArray(j?.scenes)) {
      setScenes(j.scenes as SceneMeta[]);
      if (!activeSlug && j.activeSlug) setActiveSlug(j.activeSlug);
    }
  };

  useEffect(() => {
    refreshList().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load active scene payload whenever the active slug changes.
  useEffect(() => {
    if (!activeSlug) return;
    let cancelled = false;
    setLoadingActive(true);
    fetch(`/api/world/scenes/${activeSlug}`)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !j) return;
        if (j.kind === 'map') {
          setActivePayload({ kind: 'map', map: j.map, meta: j.meta });
        } else if (j.kind === 'cinematic') {
          setActivePayload({ kind: 'cinematic', data: j.data, meta: j.meta });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingActive(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSlug]);

  const createScene = async (kind: SceneKind) => {
    const slug = window.prompt(
      `Slug para la nueva escena (${kind}). Sólo a-z, 0-9 y guion:`,
      '',
    );
    if (!slug) return;
    const name = window.prompt(
      'Nombre visible:',
      slug.replace(/-/g, ' '),
    );
    if (!name) return;
    const r = await fetch('/api/world/scenes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, kind, name }),
    });
    const j = await r.json();
    if (!r.ok) {
      alert(j?.error ?? 'No se pudo crear');
      return;
    }
    await refreshList();
    setActiveSlug(slug);
  };

  const removeScene = async (slug: string) => {
    if (!window.confirm(`¿Borrar la escena "${slug}"? (incluye sus NPCs y luces)`)) return;
    const r = await fetch(`/api/world/scenes/${slug}`, { method: 'DELETE' });
    const j = await r.json();
    if (!r.ok) {
      alert(j?.error ?? 'No se pudo borrar');
      return;
    }
    await refreshList();
    if (activeSlug === slug) {
      const next = scenes.find((s) => s.slug !== slug);
      setActiveSlug(next?.slug ?? null);
    }
  };

  const renameScene = async (slug: string, name: string) => {
    if (!name.trim()) return;
    const r = await fetch(`/api/world/scenes/${slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    if (r.ok) await refreshList();
  };

  const moveScene = async (slug: string, dir: -1 | 1) => {
    // Compute new orderIdx by swapping with neighbor in the current
    // sorted view, then PUT both.
    const sorted = [...scenes].sort((a, b) => a.orderIdx - b.orderIdx);
    const idx = sorted.findIndex((s) => s.slug === slug);
    if (idx < 0) return;
    const swapWith = sorted[idx + dir];
    if (!swapWith) return;
    const a = sorted[idx];
    const b = swapWith;
    await Promise.all([
      fetch(`/api/world/scenes/${a.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIdx: b.orderIdx }),
      }),
      fetch(`/api/world/scenes/${b.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIdx: a.orderIdx }),
      }),
    ]);
    await refreshList();
  };

  const sortedScenes = useMemo(
    () => [...scenes].sort((a, b) => a.orderIdx - b.orderIdx || a.slug.localeCompare(b.slug)),
    [scenes],
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200000,
        background: '#0a0a14',
        color: '#e5e5e5',
        fontFamily: "'Silkscreen', cursive",
        display: 'flex',
        animation: 'pixelFadeIn 0.4s ease-out',
      }}
    >
      {/* ── Sidebar: scene list ── */}
      <aside
        style={{
          width: 220,
          flex: '0 0 220px',
          background: '#0d111c',
          borderRight: '2px solid var(--color-accent)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <div
          style={{
            padding: '14px 12px 10px',
            borderBottom: '2px solid rgba(75,45,142,0.4)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: '0.78rem',
              letterSpacing: '0.22em',
              color: 'var(--color-accent)',
              textTransform: 'uppercase',
            }}
          >
            Escenas
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              onClick={() => createScene('map')}
              style={btnStyle()}
              title="Crear escena de mapa"
            >
              + Mapa
            </button>
            <button
              type="button"
              onClick={() => createScene('cinematic')}
              style={btnStyle()}
              title="Crear escena cinemática"
            >
              + Cinem.
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 6px 12px' }}>
          {sortedScenes.length === 0 && (
            <div
              style={{
                color: 'rgba(225,215,255,0.55)',
                fontSize: '0.55rem',
                padding: '12px 8px',
                lineHeight: 1.5,
              }}
            >
              No hay escenas. Crea una para empezar.
            </div>
          )}
          {sortedScenes.map((s, i) => {
            const active = s.slug === activeSlug;
            const isRenaming = renamingSlug === s.slug;
            return (
              <div
                key={s.slug}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  padding: '6px 8px',
                  margin: '2px 4px',
                  background: active ? 'rgba(75,45,142,0.35)' : 'transparent',
                  border: active
                    ? '1px solid var(--color-accent)'
                    : '1px solid transparent',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  if (!isRenaming) setActiveSlug(s.slug);
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      width: 14,
                      textAlign: 'center',
                    }}
                    title={s.kind}
                  >
                    {s.kind === 'map' ? '□' : '▶'}
                  </span>
                  {isRenaming ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={() => {
                        renameScene(s.slug, renameValue);
                        setRenamingSlug(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          renameScene(s.slug, renameValue);
                          setRenamingSlug(null);
                        } else if (e.key === 'Escape') {
                          setRenamingSlug(null);
                        }
                      }}
                      style={{
                        flex: 1,
                        background: '#0a0a14',
                        color: '#e5e5e5',
                        border: '1px solid var(--color-accent)',
                        fontFamily: "'Silkscreen', cursive",
                        fontSize: '0.6rem',
                        padding: '2px 4px',
                        outline: 'none',
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        flex: 1,
                        fontSize: '0.65rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {s.name}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 3,
                    fontSize: '0.5rem',
                    color: 'rgba(225,215,255,0.55)',
                    paddingLeft: 20,
                  }}
                >
                  <span>{s.slug}</span>
                  {s.eventTrigger && (
                    <span style={{ color: '#ffcc00' }}>
                      ⚡{s.eventTrigger}
                    </span>
                  )}
                </div>
                {active && (
                  <div style={{ display: 'flex', gap: 3, paddingLeft: 20, marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingSlug(s.slug);
                        setRenameValue(s.name);
                      }}
                      style={smallBtn()}
                      title="Renombrar"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveScene(s.slug, -1);
                      }}
                      disabled={i === 0}
                      style={smallBtn(i === 0)}
                      title="Subir"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveScene(s.slug, 1);
                      }}
                      disabled={i === sortedScenes.length - 1}
                      style={smallBtn(i === sortedScenes.length - 1)}
                      title="Bajar"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeScene(s.slug);
                      }}
                      style={smallBtn()}
                      title="Borrar"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            margin: 10,
            padding: '8px 10px',
            background: '#1a1a1a',
            color: '#e5e5e5',
            border: '2px solid var(--color-accent)',
            fontFamily: "'Silkscreen', cursive",
            fontSize: '0.6rem',
            letterSpacing: '0.12em',
            cursor: 'pointer',
          }}
        >
          ← Cerrar editor
        </button>
      </aside>

      {/* ── Workspace ── */}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          position: 'relative',
        }}
      >
        {!activeSlug && (
          <PlaceholderMessage text="Selecciona o crea una escena para empezar." />
        )}
        {activeSlug && loadingActive && !activePayload && (
          <PlaceholderMessage text="Cargando escena…" />
        )}
        {activePayload?.kind === 'map' && (
          <MapEditor
            key={activePayload.meta.slug}
            initialMap={activePayload.map}
            scene={activePayload.meta}
            scenes={sortedScenes}
            embedded
            onClose={onClose}
            onSaved={() => {
              // Bump scene meta after save so the list reflects update.
              refreshList().catch(() => undefined);
            }}
            onSceneMetaChanged={() => refreshList().catch(() => undefined)}
          />
        )}
        {activePayload?.kind === 'cinematic' && (
          <CinematicEditor
            key={activePayload.meta.slug}
            scene={activePayload.meta}
            initialData={activePayload.data}
            onClose={onClose}
            onSaved={() => refreshList().catch(() => undefined)}
          />
        )}
      </main>
    </div>
  );
}

function PlaceholderMessage({ text }: { text: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'grid',
        placeItems: 'center',
        color: 'rgba(225,215,255,0.5)',
        fontSize: '0.8rem',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
      }}
    >
      {text}
    </div>
  );
}

function btnStyle(): React.CSSProperties {
  return {
    flex: 1,
    padding: '6px 6px',
    background: '#1a1a1a',
    color: '#e5e5e5',
    border: '2px solid var(--color-accent)',
    fontFamily: "'Silkscreen', cursive",
    fontSize: '0.55rem',
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
    background: '#1a1a1a',
    color: disabled ? 'rgba(225,215,255,0.3)' : '#e5e5e5',
    border: '1px solid rgba(75,45,142,0.6)',
    fontFamily: "'Silkscreen', cursive",
    fontSize: '0.55rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}
