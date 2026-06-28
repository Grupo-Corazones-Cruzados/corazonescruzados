'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import PixelConfirm from '@/components/ui/PixelConfirm';
import MapEditor from './MapEditor';
import CinematicEditor from './CinematicEditor';
import NpcEditor, { type NpcRecord } from './NpcEditor';
import {
  IconScenes,
  IconNpcs,
  IconLayers,
  IconClose,
  IconMap,
  IconFilm,
  IconAdd,
  IconEdit,
  IconUp,
  IconDown,
  IconDelete,
  IconBolt,
} from './EditorIcons';
import { PanelHeader, EditorButton, ListRow, EmptyState, E, PANEL_WIDTH } from './editorUi';
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
  playerTileX = 0,
  playerTileY = 0,
  onNpcsChanged,
  initialTab = 'scenes',
}: {
  onClose: () => void;
  /** Posición del jugador (para el botón "Aquí" al crear NPCs). */
  playerTileX?: number;
  playerTileY?: number;
  /** Mantiene vivos los NPCs en pantalla al editarlos. */
  onNpcsChanged?: (npcs: NpcRecord[]) => void;
  /** Pestaña inicial del nav lateral. */
  initialTab?: 'scenes' | 'npcs' | 'assets';
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
  // Escena en edición (formulario con nombre, música y evento).
  const [editScene, setEditScene] = useState<SceneMeta | null>(null);
  const [confirmRemoveSlug, setConfirmRemoveSlug] = useState<string | null>(null);
  // Lateral sidebar tab — toggles between the scenes list and the
  // map-editor's asset/layers panel. Default 'scenes' so the user
  // sees the scene list first when they open the editor.
  const [sidebarTab, setSidebarTab] = useState<'scenes' | 'npcs' | 'assets'>(
    initialTab,
  );

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
      toast.error(j?.error ?? 'No se pudo crear');
      return;
    }
    await refreshList();
    setActiveSlug(slug);
  };

  const removeScene = async (slug: string) => {
    setConfirmRemoveSlug(null);
    const r = await fetch(`/api/world/scenes/${slug}`, { method: 'DELETE' });
    const j = await r.json();
    if (!r.ok) {
      toast.error(j?.error ?? 'No se pudo borrar');
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
      {/* ── Nav rail estilo Fluent (icono + etiqueta) ── */}
      <nav
        style={{
          width: 72,
          flex: '0 0 72px',
          background: '#ffffff',
          borderRight: '1px solid #edebe9',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          padding: '10px 6px',
          gap: 4,
        }}
      >
        <SidebarTabButton
          active={sidebarTab === 'scenes'}
          icon={<IconScenes />}
          label="Escenas"
          onClick={() => setSidebarTab('scenes')}
        />
        <SidebarTabButton
          active={sidebarTab === 'npcs'}
          icon={<IconNpcs />}
          label="NPCs"
          onClick={() => setSidebarTab('npcs')}
        />
        <SidebarTabButton
          active={sidebarTab === 'assets'}
          icon={<IconLayers />}
          label="Capas"
          onClick={() => setSidebarTab('assets')}
        />
        <div style={{ flex: 1 }} />
        <SidebarTabButton
          active={false}
          icon={<IconClose />}
          label="Cerrar"
          onClick={onClose}
        />
      </nav>

      {sidebarTab === 'npcs' ? (
        /* ── Sección NPCs (lista + edición, embebida) ── */
        <NpcEditor
          embedded
          sceneSlug={activeSlug ?? 'main'}
          playerTileX={playerTileX}
          playerTileY={playerTileY}
          onChanged={onNpcsChanged ?? (() => undefined)}
          onClose={onClose}
        />
      ) : (
        <>
      {/* ── Sidebar: scene list (visible only when 'scenes' tab is active) ── */}
      <aside
        style={{
          width: PANEL_WIDTH,
          flex: `0 0 ${PANEL_WIDTH}px`,
          background: '#faf9f8',
          borderRight: '1px solid #d1d1d1',
          display: sidebarTab === 'scenes' ? 'flex' : 'none',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <PanelHeader title="Escenas">
          <div style={{ display: 'flex', gap: 6 }}>
            <EditorButton
              icon={<IconAdd size={14} />}
              onClick={() => createScene('map')}
              title="Crear escena de mapa"
              style={{ flex: 1 }}
            >
              Mapa
            </EditorButton>
            <EditorButton
              icon={<IconAdd size={14} />}
              onClick={() => createScene('cinematic')}
              title="Crear escena cinemática"
              style={{ flex: 1 }}
            >
              Cinem.
            </EditorButton>
          </div>
        </PanelHeader>
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 6px 12px' }}>
          {sortedScenes.length === 0 && (
            <EmptyState>No hay escenas. Crea una para empezar.</EmptyState>
          )}
          {sortedScenes.map((s, i) => {
            const active = s.slug === activeSlug;
            const isRenaming = renamingSlug === s.slug;
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
                      display: 'grid',
                      placeItems: 'center',
                      color: active ? '#0078d4' : '#605e5c',
                    }}
                    title={s.kind === 'map' ? 'Mapa' : 'Cinemática'}
                  >
                    {s.kind === 'map' ? <IconMap size={18} /> : <IconFilm size={18} />}
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
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 2,
                            verticalAlign: 'middle',
                          }}
                        >
                          <IconBolt size={13} />
                          {s.eventTrigger}
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
                      icon={<IconEdit size={15} />}
                      title="Editar escena"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditScene(s);
                      }}
                    />
                    <RowAction
                      icon={<IconUp size={15} />}
                      title="Subir"
                      disabled={i === 0}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveScene(s.slug, -1);
                      }}
                    />
                    <RowAction
                      icon={<IconDown size={15} />}
                      title="Bajar"
                      disabled={i === sortedScenes.length - 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        moveScene(s.slug, 1);
                      }}
                    />
                    <RowAction
                      icon={<IconDelete size={15} />}
                      title="Borrar"
                      danger
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmRemoveSlug(s.slug);
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
            sidebarTab={sidebarTab === 'assets' ? 'assets' : 'scenes'}
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
        </>
      )}

      <PixelConfirm
        open={confirmRemoveSlug !== null}
        title="Borrar escena"
        message={`¿Borrar la escena "${confirmRemoveSlug ?? ''}"? Incluye sus NPCs y luces.`}
        confirmLabel="Sí, borrar"
        danger
        onConfirm={() => { if (confirmRemoveSlug) removeScene(confirmRemoveSlug); }}
        onCancel={() => setConfirmRemoveSlug(null)}
      />

      {editScene && (
        <SceneEditDialog
          scene={editScene}
          onClose={() => setEditScene(null)}
          onSaved={() => {
            setEditScene(null);
            refreshList().catch(() => undefined);
          }}
        />
      )}
    </div>
  );
}

// Diálogo modal para editar las propiedades de una escena (no solo el nombre).
function SceneEditDialog({
  scene,
  onClose,
  onSaved,
}: {
  scene: SceneMeta;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(scene.name ?? '');
  const [eventTrigger, setEventTrigger] = useState(scene.eventTrigger ?? '');
  const [musicUrl, setMusicUrl] = useState(scene.musicUrl ?? '');
  const [musicVolume, setMusicVolume] = useState(
    typeof scene.musicVolume === 'number' ? scene.musicVolume : 0.5,
  );
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await fetch(`/api/world/scenes/${scene.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || 'Escena',
          eventTrigger: eventTrigger.trim(),
          musicUrl: musicUrl.trim(),
          musicVolume,
        }),
      });
      onSaved();
    } catch {
      setBusy(false);
    }
  };

  const field: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    background: '#ffffff',
    border: `1px solid ${E.borderStrong}`,
    borderRadius: E.radius,
    color: E.text,
    fontFamily: E.font,
    fontSize: '0.85rem',
    outline: 'none',
  };
  const lbl: React.CSSProperties = {
    fontSize: '0.62rem',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: E.accent,
    fontWeight: 600,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200001,
        background: 'rgba(0,0,0,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: E.font,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 420,
          background: E.surface,
          borderRadius: 8,
          boxShadow: '0 16px 50px rgba(0,0,0,0.3)',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${E.border}` }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: E.text }}>
            Editar escena
          </div>
          <div style={{ fontSize: '0.72rem', color: E.textSoft }}>{scene.slug}</div>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={lbl}>Nombre</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={field} autoFocus />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={lbl}>Evento (trigger)</label>
            <input
              value={eventTrigger}
              onChange={(e) => setEventTrigger(e.target.value)}
              placeholder="(opcional) p. ej. intro"
              style={field}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={lbl}>Música (URL)</label>
            <input
              value={musicUrl}
              onChange={(e) => setMusicUrl(e.target.value)}
              placeholder="(opcional) /sounds/music/…"
              style={field}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={lbl}>Volumen de música · {Math.round(musicVolume * 100)}%</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={musicVolume}
              onChange={(e) => setMusicVolume(Number(e.target.value))}
              style={{ accentColor: E.accent }}
            />
          </div>
        </div>
        <div
          style={{
            padding: '12px 20px',
            borderTop: `1px solid ${E.border}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
          }}
        >
          <EditorButton variant="secondary" onClick={onClose}>
            Cancelar
          </EditorButton>
          <EditorButton onClick={save} disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar'}
          </EditorButton>
        </div>
      </div>
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
  icon: React.ReactNode;
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
      aria-pressed={active}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        padding: '9px 2px',
        background: active ? '#f3f9fd' : hover ? '#f3f2f1' : 'transparent',
        color: active ? '#0078d4' : '#605e5c',
        border: 'none',
        borderRadius: 6,
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        fontSize: '0.62rem',
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
      }}
    >
      {/* Indicador de selección estilo Fluent */}
      <span
        style={{
          position: 'absolute',
          left: 2,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 3,
          height: active ? 20 : 0,
          borderRadius: 2,
          background: '#0078d4',
          transition: 'height 0.15s ease',
        }}
      />
      {icon}
      <span>{label}</span>
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
  icon: React.ReactNode;
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
