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
  // Lateral sidebar tab — toggles between the scenes list and the
  // map-editor's asset/layers panel. Default 'scenes' so the user
  // sees the scene list first when they open the editor.
  const [sidebarTab, setSidebarTab] = useState<'scenes' | 'assets'>('scenes');

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

  // ESC closes the editor — but stay out of the way if the user is
  // typing in an input or textarea (rename fields, search boxes, hex
  // pickers). They likely want ESC to blur / clear the field instead
  // of nuking the whole editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT'
      ) {
        return;
      }
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

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
        background: '#faf9f8',
        color: '#323130',
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        display: 'flex',
        animation: 'pixelFadeIn 0.4s ease-out',
      }}
    >
      {/* ── Lateral tab strip — toggles which sidebar is visible ── */}
      <nav
        style={{
          width: 44,
          flex: '0 0 44px',
          background: '#faf9f8',
          borderRight: '1px solid #edebe9',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          padding: '8px 0',
          gap: 2,
        }}
      >
        <SidebarTabButton
          active={sidebarTab === 'scenes'}
          icon="🗂"
          label="Escenas"
          onClick={() => setSidebarTab('scenes')}
        />
        <SidebarTabButton
          active={sidebarTab === 'assets'}
          icon="🎨"
          label="Assets / Capas del mapa"
          onClick={() => setSidebarTab('assets')}
        />
        {/* Spacer */}
        <div style={{ flex: 1 }} />
        <SidebarTabButton
          active={false}
          icon="←"
          label="Cerrar editor"
          onClick={onClose}
        />
      </nav>

      {/* ── Sidebar: scene list (visible only when 'scenes' tab is active) ── */}
      <aside
        style={{
          width: 220,
          flex: '0 0 220px',
          background: '#faf9f8',
          borderRight: '1px solid #d1d1d1',
          display: sidebarTab === 'scenes' ? 'flex' : 'none',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <div
          style={{
            padding: '14px 12px 10px',
            borderBottom: '1px solid #edebe9',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: '0.78rem',
              letterSpacing: '0.22em',
              color: '#0078d4',
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
                color: 'rgba(50,49,48,0.55)',
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
            const kindIcon = s.kind === 'map' ? '🗺' : '🎬';
            return (
              <div
                key={s.slug}
                onClick={() => {
                  if (!isRenaming) setActiveSlug(s.slug);
                }}
                style={{
                  position: 'relative',
                  padding: '8px 8px 8px 12px',
                  margin: '1px 0',
                  background: active ? '#deecf9' : 'transparent',
                  borderLeft: active
                    ? '3px solid #0078d4'
                    : '3px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontSize: '1rem',
                      lineHeight: 1,
                    }}
                    title={s.kind === 'map' ? 'Mapa' : 'Cinemática'}
                  >
                    {kindIcon}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                    }}
                  >
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
                          width: '100%',
                          background: '#ffffff',
                          color: '#323130',
                          border: '1px solid #0078d4',
                          fontFamily:
                            "system-ui, -apple-system, 'Segoe UI', sans-serif",
                          fontSize: '0.85rem',
                          padding: '4px 6px',
                          outline: 'none',
                          borderRadius: 2,
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: active ? 600 : 500,
                          color: '#323130',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {s.name}
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: '0.72rem',
                        color: '#605e5c',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {s.slug}
                      {s.eventTrigger && (
                        <span
                          style={{
                            color: '#0078d4',
                            marginLeft: 6,
                            fontWeight: 600,
                          }}
                        >
                          ⚡{s.eventTrigger}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
                {active && (
                  <div
                    style={{
                      display: 'flex',
                      gap: 4,
                      paddingLeft: 24,
                    }}
                  >
                    <RowAction
                      icon="✎"
                      title="Renombrar"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingSlug(s.slug);
                        setRenameValue(s.name);
                      }}
                    />
                    <RowAction
                      icon="↑"
                      title="Subir"
                      disabled={i === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveScene(s.slug, -1);
                      }}
                    />
                    <RowAction
                      icon="↓"
                      title="Bajar"
                      disabled={i === sortedScenes.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveScene(s.slug, 1);
                      }}
                    />
                    <RowAction
                      icon="🗑"
                      title="Borrar"
                      danger
                      onClick={(e) => {
                        e.stopPropagation();
                        removeScene(s.slug);
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
            sidebarTab={sidebarTab}
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
        color: 'rgba(50,49,48,0.5)',
        fontSize: '0.8rem',
        letterSpacing: '0.15em',
        textTransform: 'uppercase',
      }}
    >
      {text}
    </div>
  );
}

function SidebarTabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: '100%',
        height: 40,
        display: 'grid',
        placeItems: 'center',
        background: active
          ? '#deecf9'
          : hover
            ? '#f3f2f1'
            : 'transparent',
        color: active ? '#0078d4' : '#323130',
        border: 'none',
        borderLeft: active
          ? '3px solid #0078d4'
          : '3px solid transparent',
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        fontSize: '1.2rem',
        cursor: 'pointer',
        padding: 0,
        borderRadius: 0,
      }}
    >
      {icon}
    </button>
  );
}

function btnStyle(): React.CSSProperties {
  return {
    flex: 1,
    padding: '7px 10px',
    background: '#0078d4',
    color: '#ffffff',
    border: '1px solid #0078d4',
    borderRadius: 2,
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    fontSize: '0.78rem',
    fontWeight: 500,
    letterSpacing: '0.02em',
    cursor: 'pointer',
  };
}

// Compact icon button used inline next to list items (rename / move /
// delete). Subtle ghost button — hover bg lifts it out without
// dominating the row.
function RowAction({
  icon,
  title,
  onClick,
  disabled = false,
  danger = false,
}: {
  icon: string;
  title: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 26,
        height: 24,
        display: 'grid',
        placeItems: 'center',
        padding: 0,
        background: !disabled && hover
          ? danger
            ? '#fde7e9'
            : '#f3f2f1'
          : '#ffffff',
        color: disabled
          ? '#a19f9d'
          : danger
            ? '#a4262c'
            : '#323130',
        border: '1px solid #d1d1d1',
        borderRadius: 2,
        fontSize: '0.85rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        lineHeight: 1,
      }}
    >
      {icon}
    </button>
  );
}
