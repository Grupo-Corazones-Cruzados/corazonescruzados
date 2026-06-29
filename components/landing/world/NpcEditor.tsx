'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import PixelConfirm from '@/components/ui/PixelConfirm';
import {
  CharacterSprite,
  type CharacterConfig,
  type CharacterAnimation,
  type SpriteDirection,
  ANIMATIONS,
  ANIMATION_OPTIONS,
  npcDisplayFrame,
  BODY_TYPES,
  SKIN_TONES,
  HAIR_COLORS,
  HAIR_STYLES,
  EYE_COLORS,
  EYEBROW_STYLES,
  BEARD_STYLES,
  GLASSES_STYLES,
  GLASSES_COLORS,
  CLOTHING_STYLES,
  CLOTHING_COLORS,
  SHOES_STYLES,
  FACE_SHAPES_M,
  FACE_SHAPES_F,
} from '../CharacterCreator';
import {
  IconUp,
  IconDown,
  IconLeft,
  IconRight,
  IconLocation,
  IconWarning,
  IconAdd,
  IconSave,
  IconDelete,
} from './EditorIcons';
import {
  PanelHeader,
  EditorButton,
  ListRow,
  EmptyState,
  PANEL_WIDTH,
} from './editorUi';

export type NpcRecord = {
  id: number;
  map: string;
  name: string;
  config: CharacterConfig;
  x: number;
  y: number;
  facing: SpriteDirection;
  animation: CharacterAnimation;
  dialogue: string[];
};

const DEFAULT_NPC_CONFIG: CharacterConfig = {
  name: 'NPC',
  gender: 'masculino',
  skinId: 'taupe',
  bodyType: 'medio',
  height: 'medio',
  faceShape: 'standard',
  hairStyle: 'bedhead',
  hairColor: 'chestnut',
  eyeColor: 'brown',
  eyebrowStyle: 'thin',
  beardStyle: 'none',
  glassesStyle: 'none',
  glassesColor: 'black',
  clothingStyle: 'shortsleeve',
  clothingColor: 'forest',
  pantsColor: 'navy',
  shoesStyle: 'shoes',
  shoesColor: 'brown',
};

type Draft = {
  id: number | null;
  name: string;
  config: CharacterConfig;
  x: number;
  y: number;
  facing: SpriteDirection;
  animation: CharacterAnimation;
  scale: number; // tamaño del cuerpo (multiplicador, 1 = normal)
  walkMode: 'route' | 'wander'; // comportamiento con animación 'walk'
  wanderRadius: number; // radio de deambulación (modo 'wander')
  route: NpcWaypoint[]; // waypoints (modo 'route'); se editan en el mapa
  dialogueText: string; // newline-separated for the textarea
};

// El tamaño del cuerpo se guarda dentro del `config` (jsonb) como `scale`.
export function npcScale(config: unknown): number {
  const s = (config as { scale?: unknown } | null | undefined)?.scale;
  return typeof s === 'number' && s > 0 ? s : 1;
}

// Comportamiento de movimiento del NPC (solo aplica con animación 'walk'). Se
// guarda dentro del `config` (jsonb) como `behavior`. 'route' = recorre los
// waypoints en ping-pong; 'wander' = deambula al azar dentro de un radio.
export type NpcWaypoint = { x: number; y: number };
export type NpcBehavior = {
  mode: 'route' | 'wander';
  route: NpcWaypoint[];
  wanderRadius: number;
};
export function npcBehavior(config: unknown): NpcBehavior {
  const b = (config as { behavior?: unknown } | null | undefined)?.behavior as
    | Partial<NpcBehavior>
    | undefined;
  const route = Array.isArray(b?.route)
    ? b!.route.filter(
        (p): p is NpcWaypoint =>
          typeof p?.x === 'number' && typeof p?.y === 'number',
      )
    : [];
  return {
    mode: b?.mode === 'wander' ? 'wander' : 'route',
    route,
    wanderRadius:
      typeof b?.wanderRadius === 'number' && b.wanderRadius > 0
        ? b.wanderRadius
        : 3,
  };
}

function npcToDraft(n: NpcRecord): Draft {
  return {
    id: n.id,
    name: n.name,
    config: n.config,
    x: n.x,
    y: n.y,
    facing: n.facing,
    animation: n.animation ?? 'idle',
    scale: npcScale(n.config),
    walkMode: npcBehavior(n.config).mode,
    wanderRadius: npcBehavior(n.config).wanderRadius,
    route: npcBehavior(n.config).route,
    dialogueText: (n.dialogue ?? []).join('\n'),
  };
}

function newDraft(playerX: number, playerY: number): Draft {
  return {
    id: null,
    name: 'Aldeano',
    config: { ...DEFAULT_NPC_CONFIG },
    x: playerX,
    y: playerY,
    facing: 's',
    animation: 'idle',
    scale: 1,
    walkMode: 'route',
    wanderRadius: 3,
    route: [],
    dialogueText: '¡Hola, viajero!\nQué bueno verte por aquí.',
  };
}

export default function NpcEditor({
  playerTileX,
  playerTileY,
  sceneSlug,
  onClose,
  onChanged,
  embedded = false,
  initialNpcId,
}: {
  playerTileX: number;
  playerTileY: number;
  // Scene this editor edits NPCs for. Optional for back-compat; defaults
  // to 'main' which is the only seeded scene after migration 015.
  sceneSlug?: string;
  onClose: () => void;
  onChanged: (npcs: NpcRecord[]) => void;
  /** Embebido dentro del SceneManagerEditor (no overlay de pantalla completa). */
  embedded?: boolean;
  /** Abrir directamente en crear ('new') o editar (id) un NPC. */
  initialNpcId?: 'new' | number;
}) {
  const slug = sceneSlug ?? 'main';
  const [npcs, setNpcs] = useState<NpcRecord[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  // Cycles the preview's animation frame at the chosen FPS so the
  // admin can see the pose actually move while editing.
  const [previewFrame, setPreviewFrame] = useState(0);
  const previewFpsRef = useRef(8);
  useEffect(() => {
    previewFpsRef.current = draft ? ANIMATIONS[draft.animation].fps : 8;
  }, [draft?.animation]);
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const fps = previewFpsRef.current;
      const interval = 1000 / Math.max(1, fps);
      if (now - last >= interval) {
        setPreviewFrame((f) => f + 1);
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const refresh = async () => {
    const r = await fetch(`/api/world/npcs?scene=${encodeURIComponent(slug)}`);
    const j = await r.json();
    if (Array.isArray(j?.npcs)) {
      setNpcs(j.npcs as NpcRecord[]);
      onChanged(j.npcs as NpcRecord[]);
      return j.npcs as NpcRecord[];
    }
    return [] as NpcRecord[];
  };

  // Abre directo en crear/editar según initialNpcId (una sola vez).
  const initedRef = useRef(false);
  useEffect(() => {
    refresh()
      .then((list) => {
        if (initedRef.current) return;
        initedRef.current = true;
        if (initialNpcId === 'new') {
          setDraft(newDraft(playerTileX, playerTileY));
        } else if (typeof initialNpcId === 'number') {
          const n = list.find((x) => x.id === initialNpcId);
          if (n) setDraft(npcToDraft(n));
        }
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const dialogue = draft.dialogueText
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      const body = JSON.stringify({
        scene: slug,
        name: draft.name,
        config: {
          ...draft.config,
          scale: draft.scale,
          behavior: {
            mode: draft.walkMode,
            route: draft.route,
            wanderRadius: draft.wanderRadius,
          },
        },
        x: draft.x,
        y: draft.y,
        facing: draft.facing,
        animation: draft.animation,
        dialogue,
      });
      const url =
        draft.id != null ? `/api/world/npcs/${draft.id}` : '/api/world/npcs';
      const method = draft.id != null ? 'PUT' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j?.error ?? 'No se pudo guardar');
        return;
      }
      await refresh();
      if (j?.npc) setDraft(npcToDraft(j.npc));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!draft?.id) return;
    setConfirmRemove(false);
    setBusy(true);
    try {
      await fetch(`/api/world/npcs/${draft.id}`, { method: 'DELETE' });
      await refresh();
      setDraft(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        ...(embedded
          ? { position: 'relative', flex: 1, minWidth: 0, height: '100%' }
          : { position: 'fixed', inset: 0, zIndex: 200000, animation: 'pixelFadeIn 0.4s ease-out' }),
        background: '#faf9f8',
        color: '#323130',
        fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        display: 'grid',
        gridTemplateColumns: `${PANEL_WIDTH}px 1fr`,
      }}
    >
      {/* List */}
      <aside
        style={{
          background: '#ffffff',
          borderRight: '1px solid #d1d1d1',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <PanelHeader title="NPCs">
          <EditorButton
            icon={<IconAdd size={15} />}
            onClick={() => setDraft(newDraft(playerTileX, playerTileY))}
            style={{ width: '100%' }}
          >
            Nuevo NPC
          </EditorButton>
        </PanelHeader>
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {npcs.length === 0 ? (
            <EmptyState>Aún no hay NPCs. Crea uno con “Nuevo NPC”.</EmptyState>
          ) : (
            npcs.map((n) => (
              <ListRow
                key={n.id}
                active={draft?.id === n.id}
                onClick={() => setDraft(npcToDraft(n))}
                title={n.name}
                subtitle={`(${n.x}, ${n.y})`}
              />
            ))
          )}
        </div>
        {!embedded && (
          <div
            style={{
              padding: 10,
              borderTop: '1px solid #edebe9',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                padding: '6px 10px',
                fontSize: '0.75rem',
                background: '#ffffff',
                color: '#323130',
                border: '1px solid rgba(0,120,212,0.4)',
                borderRadius: 4,
                fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
                cursor: 'pointer',
              }}
            >
              Cerrar
            </button>
          </div>
        )}
      </aside>

      {/* Edit area */}
      <main
        style={{
          padding: 24,
          overflowY: 'auto',
          minHeight: 0,
        }}
      >
        {!draft ? (
          <div
            style={{
              fontSize: '0.7rem',
              color: 'rgba(50,49,48,0.55)',
              letterSpacing: '0.1em',
            }}
          >
            Selecciona un NPC o crea uno nuevo.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '300px 1fr',
              gap: 24,
              alignItems: 'start',
            }}
          >
            {/* Preview + meta */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div
                style={{
                  background: '#f3f2f1',
                  border: '1px solid #d1d1d1',
                  padding: 16,
                  display: 'flex',
                  justifyContent: 'center',
                  minHeight: 280,
                  alignItems: 'center',
                }}
              >
                <CharacterSprite
                  config={draft.config}
                  direction={draft.facing}
                  animation={draft.animation}
                  frame={npcDisplayFrame(draft.animation, previewFrame)}
                  scale={3 * draft.scale}
                />
              </div>

              <Field label="Mira hacia">
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['n', 'w', 's', 'e'] as const).map((d) => {
                    // Hurt only renders south in LPC, so lock the
                    // facing dropdown when that pose is selected.
                    const disabled = draft.animation === 'hurt' && d !== 's';
                    return (
                      <PillButton
                        key={d}
                        active={draft.facing === d}
                        disabled={disabled}
                        onClick={() =>
                          !disabled && setDraft({ ...draft, facing: d })
                        }
                      >
                        {d === 'n' ? (
                          <IconUp size={16} />
                        ) : d === 's' ? (
                          <IconDown size={16} />
                        ) : d === 'w' ? (
                          <IconLeft size={16} />
                        ) : (
                          <IconRight size={16} />
                        )}
                      </PillButton>
                    );
                  })}
                </div>
              </Field>

              <Field label="Animación / pose">
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 4,
                  }}
                >
                  {ANIMATION_OPTIONS.map((a) => (
                    <PillButton
                      key={a.id}
                      active={draft.animation === a.id}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          animation: a.id,
                          // Hurt is south-only.
                          facing: a.id === 'hurt' ? 's' : draft.facing,
                        })
                      }
                    >
                      {a.label}
                    </PillButton>
                  ))}
                </div>
              </Field>

              {draft.animation === 'walk' && (
                <Field label="Comportamiento al caminar">
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', gap: 4 }}>
                      <PillButton
                        active={draft.walkMode === 'route'}
                        onClick={() =>
                          setDraft({ ...draft, walkMode: 'route' })
                        }
                      >
                        Ruta definida
                      </PillButton>
                      <PillButton
                        active={draft.walkMode === 'wander'}
                        onClick={() =>
                          setDraft({ ...draft, walkMode: 'wander' })
                        }
                      >
                        Deambular
                      </PillButton>
                    </div>
                    {draft.walkMode === 'wander' ? (
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                      >
                        <span
                          style={{ fontSize: '0.78rem', color: '#605e5c' }}
                        >
                          Radio
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={15}
                          value={draft.wanderRadius}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              wanderRadius: Math.max(
                                1,
                                Math.min(15, Math.floor(Number(e.target.value) || 1)),
                              ),
                            })
                          }
                          style={{ ...inputStyle, width: 70 }}
                        />
                        <span
                          style={{ fontSize: '0.72rem', color: '#a19f9d' }}
                        >
                          tiles
                        </span>
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: '0.74rem',
                          color: '#605e5c',
                          lineHeight: 1.5,
                        }}
                      >
                        {draft.route.length > 0
                          ? `Ruta con ${draft.route.length} punto${draft.route.length === 1 ? '' : 's'} (ida y vuelta).`
                          : 'Sin ruta aún.'}{' '}
                        Define los puntos con el botón{' '}
                        <strong style={{ color: '#0078d4' }}>Ruta</strong> de la
                        galería de NPCs (sobre el mapa).
                      </div>
                    )}
                  </div>
                </Field>
              )}

              <Field label="Nombre">
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) =>
                    setDraft({ ...draft, name: e.target.value })
                  }
                  style={inputStyle}
                />
              </Field>

              <Field label="Tamaño del cuerpo">
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                >
                  <input
                    type="range"
                    min={0.5}
                    max={2.5}
                    step={0.1}
                    value={draft.scale}
                    onChange={(e) =>
                      setDraft({ ...draft, scale: Number(e.target.value) })
                    }
                    style={{ flex: 1, accentColor: '#0078d4' }}
                  />
                  <span
                    style={{
                      minWidth: 46,
                      textAlign: 'right',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      color: '#323130',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {Math.round(draft.scale * 100)}%
                  </span>
                </div>
              </Field>

              <Field label="Diálogo (una línea por mensaje)">
                <textarea
                  value={draft.dialogueText}
                  onChange={(e) =>
                    setDraft({ ...draft, dialogueText: e.target.value })
                  }
                  rows={5}
                  style={{
                    ...inputStyle,
                    resize: 'vertical',
                    minHeight: 100,
                    fontFamily: 'monospace',
                  }}
                />
              </Field>

              {error && (
                <div
                  style={{
                    fontSize: '0.72rem',
                    color: '#a4262c',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <IconWarning size={15} /> {error}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <EditorButton
                  onClick={save}
                  disabled={busy}
                  icon={<IconSave size={15} />}
                  style={{ flex: 1 }}
                >
                  {busy ? 'Guardando…' : draft.id ? 'Guardar' : 'Crear'}
                </EditorButton>
                {draft.id != null && (
                  <EditorButton
                    variant="danger"
                    onClick={() => setConfirmRemove(true)}
                    disabled={busy}
                    icon={<IconDelete size={15} />}
                  >
                    Borrar
                  </EditorButton>
                )}
              </div>
            </div>

            {/* Appearance editor */}
            <AppearanceEditor
              config={draft.config}
              onChange={(cfg) => setDraft({ ...draft, config: cfg })}
            />
          </div>
        )}
      </main>

      <PixelConfirm
        open={confirmRemove}
        title="Borrar NPC"
        message={`¿Borrar a "${draft?.name ?? ''}"?`}
        confirmLabel="Sí, borrar"
        danger
        onConfirm={remove}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  );
}

type ColorOpt = { id: string; label: string; preview?: string };

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Opción cuyo color predefinido es el más cercano al hex elegido.
function nearestColorOpt(hex: string, options: ColorOpt[]): ColorOpt {
  const [r, g, b] = hexToRgb(hex);
  let best = options[0];
  let bestD = Infinity;
  for (const o of options) {
    if (!o.preview) continue;
    const [pr, pg, pb] = hexToRgb(o.preview);
    const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

// Grupo de color: swatches predefinidos + selector libre que se ajusta al color
// disponible más cercano (los sprites usan sheets por color, no tinte arbitrario).
function ColorGroup({
  label,
  options,
  value,
  onPick,
}: {
  label: string;
  options: ColorOpt[];
  value: string;
  onPick: (id: string) => void;
}) {
  const current = options.find((o) => o.id === value);
  return (
    <Group label={label}>
      {options.map((s) => (
        <SwatchButton
          key={s.id}
          active={value === s.id}
          color={s.preview}
          label={s.label}
          onClick={() => onPick(s.id)}
        />
      ))}
      <label
        title="Elegir cualquier color (se ajusta al disponible más cercano)"
        style={{
          width: 28,
          height: 28,
          position: 'relative',
          display: 'inline-grid',
          placeItems: 'center',
          border: '1px dashed #0078d4',
          borderRadius: 2,
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: '0.85rem', color: '#0078d4', fontWeight: 700, lineHeight: 1 }}>
          +
        </span>
        <input
          type="color"
          value={current?.preview ?? '#888888'}
          onChange={(e) => onPick(nearestColorOpt(e.target.value, options).id)}
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0,
            cursor: 'pointer',
          }}
        />
      </label>
    </Group>
  );
}

function AppearanceEditor({
  config,
  onChange,
}: {
  config: CharacterConfig;
  onChange: (c: CharacterConfig) => void;
}) {
  const set = <K extends keyof CharacterConfig>(
    key: K,
    value: CharacterConfig[K],
  ) => onChange({ ...config, [key]: value });

  const faceShapes = useMemo(
    () => (config.gender === 'masculino' ? FACE_SHAPES_M : FACE_SHAPES_F),
    [config.gender],
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        background: '#f3f2f1',
        border: '1px solid #d1d1d1',
        padding: 16,
        maxHeight: 'calc(100vh - 80px)',
        overflowY: 'auto',
      }}
    >
      <SectionTitle>Apariencia</SectionTitle>

      <Group label="Género">
        {[
          { id: 'masculino' as const, label: 'M' },
          { id: 'femenino' as const, label: 'F' },
        ].map((o) => (
          <PillButton
            key={o.id}
            active={config.gender === o.id}
            onClick={() => set('gender', o.id)}
          >
            {o.label}
          </PillButton>
        ))}
      </Group>

      <ColorGroup
        label="Piel"
        options={SKIN_TONES}
        value={config.skinId}
        onPick={(id) => set('skinId', id)}
      />

      <Group label="Forma del rostro">
        {faceShapes.map((o) => (
          <PillButton
            key={o.id}
            active={config.faceShape === o.id}
            onClick={() => set('faceShape', o.id)}
          >
            {o.label}
          </PillButton>
        ))}
      </Group>

      <Group label="Contextura">
        {BODY_TYPES.map((o) => (
          <PillButton
            key={o.id}
            active={config.bodyType === o.id}
            onClick={() => set('bodyType', o.id as CharacterConfig['bodyType'])}
          >
            {o.label}
          </PillButton>
        ))}
      </Group>

      <Group label="Cabello">
        {HAIR_STYLES.map((o) => (
          <PillButton
            key={o.id}
            active={config.hairStyle === o.id}
            onClick={() => set('hairStyle', o.id)}
          >
            {o.label}
          </PillButton>
        ))}
      </Group>

      <ColorGroup
        label="Color de cabello"
        options={HAIR_COLORS}
        value={config.hairColor}
        onPick={(id) => set('hairColor', id)}
      />

      <Group label="Cejas">
        {EYEBROW_STYLES.map((o) => (
          <PillButton
            key={o.id}
            active={config.eyebrowStyle === o.id}
            onClick={() => set('eyebrowStyle', o.id)}
          >
            {o.label}
          </PillButton>
        ))}
      </Group>

      <ColorGroup
        label="Color de ojos"
        options={EYE_COLORS}
        value={config.eyeColor}
        onPick={(id) => set('eyeColor', id)}
      />

      {config.gender === 'masculino' && (
        <Group label="Barba">
          {BEARD_STYLES.map((o) => (
            <PillButton
              key={o.id}
              active={config.beardStyle === o.id}
              onClick={() => set('beardStyle', o.id)}
            >
              {o.label}
            </PillButton>
          ))}
        </Group>
      )}

      <Group label="Lentes">
        {GLASSES_STYLES.map((o) => (
          <PillButton
            key={o.id}
            active={config.glassesStyle === o.id}
            onClick={() => set('glassesStyle', o.id)}
          >
            {o.label}
          </PillButton>
        ))}
      </Group>

      {config.glassesStyle !== 'none' && (
        <ColorGroup
          label="Color de lentes"
          options={GLASSES_COLORS}
          value={config.glassesColor}
          onPick={(id) => set('glassesColor', id)}
        />
      )}

      <Group label="Vestimenta">
        {CLOTHING_STYLES.map((o) => (
          <PillButton
            key={o.id}
            active={config.clothingStyle === o.id}
            onClick={() => set('clothingStyle', o.id)}
          >
            {o.label}
          </PillButton>
        ))}
      </Group>

      {config.clothingStyle !== 'none' && (
        <ColorGroup
          label="Color de vestimenta"
          options={CLOTHING_COLORS}
          value={config.clothingColor}
          onPick={(id) => set('clothingColor', id)}
        />
      )}

      <ColorGroup
        label="Color de pantalón"
        options={CLOTHING_COLORS}
        value={config.pantsColor}
        onPick={(id) => set('pantsColor', id)}
      />

      <Group label="Calzado">
        {SHOES_STYLES.map((o) => (
          <PillButton
            key={o.id}
            active={config.shoesStyle === o.id}
            onClick={() => set('shoesStyle', o.id)}
          >
            {o.label}
          </PillButton>
        ))}
      </Group>

      {config.shoesStyle !== 'none' && (
        <ColorGroup
          label="Color de calzado"
          options={CLOTHING_COLORS}
          value={config.shoesColor}
          onPick={(id) => set('shoesColor', id)}
        />
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span
        style={{
          fontSize: '0.55rem',
          letterSpacing: '0.16em',
          color: 'rgba(50,49,48,0.6)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          fontSize: '0.55rem',
          letterSpacing: '0.16em',
          color: 'rgba(50,49,48,0.6)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {children}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: '0.75rem',
        letterSpacing: '0.22em',
        color: '#0078d4',
        textTransform: 'uppercase',
        borderBottom: '1px solid rgba(0,120,212,0.4)',
        paddingBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  background: '#faf9f8',
  border: '1px solid #d1d1d1',
  color: '#323130',
  fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  fontSize: '0.7rem',
  outline: 'none',
};

function pillStyle(active: boolean): React.CSSProperties {
  return {
    padding: '5px 9px',
    background: active ? '#0078d4' : '#ffffff',
    color: active ? '#ffffff' : '#323130',
    border: '1px solid #d1d1d1',
    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
    fontSize: '0.55rem',
    letterSpacing: '0.08em',
    cursor: 'pointer',
  };
}

function PillButton({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...pillStyle(active),
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function SwatchButton({
  active,
  color,
  label,
  onClick,
}: {
  active: boolean;
  color?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      style={{
        width: 28,
        height: 28,
        background: color ?? '#edebe9',
        border: active ? '1px solid #d1d1d1' : '1px solid #d1d1d1',
        boxShadow: active ? '0 0 6px #0078d4' : 'none',
        cursor: 'pointer',
        padding: 0,
      }}
    />
  );
}
