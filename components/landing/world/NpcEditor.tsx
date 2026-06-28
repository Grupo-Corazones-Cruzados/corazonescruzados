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
} from './EditorIcons';
import {
  PanelHeader,
  EditorButton,
  ListRow,
  EmptyState,
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
  dialogueText: string; // newline-separated for the textarea
};

function npcToDraft(n: NpcRecord): Draft {
  return {
    id: n.id,
    name: n.name,
    config: n.config,
    x: n.x,
    y: n.y,
    facing: n.facing,
    animation: n.animation ?? 'idle',
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
      setNpcs(j.npcs);
      onChanged(j.npcs);
    }
  };

  useEffect(() => {
    refresh().catch(() => undefined);
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
        config: draft.config,
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
        gridTemplateColumns: '260px 1fr',
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
                  frame={previewFrame}
                  scale={3}
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

              <Field label="Posición (tile)">
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    type="number"
                    value={draft.x}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        x: Math.floor(Number(e.target.value) || 0),
                      })
                    }
                    style={{ ...inputStyle, width: 70 }}
                  />
                  <input
                    type="number"
                    value={draft.y}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        y: Math.floor(Number(e.target.value) || 0),
                      })
                    }
                    style={{ ...inputStyle, width: 70 }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({ ...draft, x: playerTileX, y: playerTileY })
                    }
                    style={{
                      ...pillStyle(false),
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                    title="Usar mi posición actual"
                  >
                    <IconLocation size={15} /> Aquí
                  </button>
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
                <button
                  type="button"
                  onClick={save}
                  disabled={busy}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: '0.78rem',
                    background: '#0078d4',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 4,
                    fontFamily:
                      'system-ui, -apple-system, "Segoe UI", sans-serif',
                    cursor: busy ? 'wait' : 'pointer',
                    fontWeight: 600,
                    opacity: busy ? 0.6 : 1,
                  }}
                >
                  {busy ? 'Guardando…' : draft.id ? 'Guardar' : 'Crear'}
                </button>
                {draft.id != null && (
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(true)}
                    disabled={busy}
                    style={{
                      padding: '8px 12px',
                      fontSize: '0.78rem',
                      background: '#fde7e9',
                      color: '#a4262c',
                      border: '1px solid #a4262c',
                      borderRadius: 4,
                      fontFamily:
                        'system-ui, -apple-system, "Segoe UI", sans-serif',
                      cursor: busy ? 'wait' : 'pointer',
                      opacity: busy ? 0.6 : 1,
                    }}
                  >
                    Borrar
                  </button>
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

      <Group label="Piel">
        {SKIN_TONES.map((s) => (
          <SwatchButton
            key={s.id}
            active={config.skinId === s.id}
            color={s.preview}
            label={s.label}
            onClick={() => set('skinId', s.id)}
          />
        ))}
      </Group>

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

      <Group label="Color de cabello">
        {HAIR_COLORS.map((s) => (
          <SwatchButton
            key={s.id}
            active={config.hairColor === s.id}
            color={s.preview}
            label={s.label}
            onClick={() => set('hairColor', s.id)}
          />
        ))}
      </Group>

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

      <Group label="Color de ojos">
        {EYE_COLORS.map((s) => (
          <SwatchButton
            key={s.id}
            active={config.eyeColor === s.id}
            color={s.preview}
            label={s.label}
            onClick={() => set('eyeColor', s.id)}
          />
        ))}
      </Group>

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
        <Group label="Color de lentes">
          {GLASSES_COLORS.map((s) => (
            <SwatchButton
              key={s.id}
              active={config.glassesColor === s.id}
              color={s.preview}
              label={s.label}
              onClick={() => set('glassesColor', s.id)}
            />
          ))}
        </Group>
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
        <Group label="Color de vestimenta">
          {CLOTHING_COLORS.map((s) => (
            <SwatchButton
              key={s.id}
              active={config.clothingColor === s.id}
              color={s.preview}
              label={s.label}
              onClick={() => set('clothingColor', s.id)}
            />
          ))}
        </Group>
      )}

      <Group label="Color de pantalón">
        {CLOTHING_COLORS.map((s) => (
          <SwatchButton
            key={s.id}
            active={config.pantsColor === s.id}
            color={s.preview}
            label={s.label}
            onClick={() => set('pantsColor', s.id)}
          />
        ))}
      </Group>

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
        <Group label="Color de calzado">
          {CLOTHING_COLORS.map((s) => (
            <SwatchButton
              key={s.id}
              active={config.shoesColor === s.id}
              color={s.preview}
              label={s.label}
              onClick={() => set('shoesColor', s.id)}
            />
          ))}
        </Group>
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
