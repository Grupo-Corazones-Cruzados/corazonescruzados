'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export type Gender = 'masculino' | 'femenino';
export type BodyType =
  | 'muy_delgado'
  | 'delgado'
  | 'medio'
  | 'obeso'
  | 'muy_obeso';
export type CharHeight = 'bajo' | 'medio' | 'alto';

type Opt = { id: string; label: string; preview?: string; supportsSit?: boolean };
type HairOpt = Opt & {
  file: string | null;
  gendered?: boolean;
};

export const SKIN_TONES: Opt[] = [
  { id: 'light', label: 'Muy clara', preview: '#F4D6BA' },
  { id: 'taupe', label: 'Clara', preview: '#D6A98C' },
  { id: 'amber', label: 'Cálida', preview: '#D4A368' },
  { id: 'bronze', label: 'Bronce', preview: '#B88660' },
  { id: 'olive', label: 'Oliva', preview: '#9C7A52' },
  { id: 'brown', label: 'Morena', preview: '#8E5A38' },
  { id: 'black', label: 'Oscura', preview: '#2A1A12' },
];

export const HAIR_COLORS: Opt[] = [
  { id: 'black', label: 'Negro', preview: '#1A1A1A' },
  { id: 'raven', label: 'Cuervo', preview: '#2A2240' },
  { id: 'dark_brown', label: 'Castaño oscuro', preview: '#3D2614' },
  { id: 'chestnut', label: 'Castaño', preview: '#5C3320' },
  { id: 'light_brown', label: 'Castaño claro', preview: '#7B4A28' },
  { id: 'ash', label: 'Ceniza', preview: '#9E8E78' },
  { id: 'blonde', label: 'Rubio', preview: '#D9B380' },
  { id: 'platinum', label: 'Platino', preview: '#E8DABF' },
  { id: 'ginger', label: 'Jengibre', preview: '#B05428' },
  { id: 'redhead', label: 'Pelirrojo', preview: '#9C3530' },
  { id: 'gray', label: 'Gris', preview: '#888888' },
  { id: 'white', label: 'Blanco', preview: '#E8E8E8' },
];

export const EYE_COLORS: Opt[] = [
  { id: 'brown', label: 'Café', preview: '#5A3A1F' },
  { id: 'blue', label: 'Azul', preview: '#3D6FA0' },
  { id: 'green', label: 'Verde', preview: '#4D8E45' },
  { id: 'gray', label: 'Gris', preview: '#7A8090' },
  { id: 'purple', label: 'Morado', preview: '#7A5DBE' },
];

export const CLOTHING_COLORS: Opt[] = [
  { id: 'purple', label: 'Morado', preview: '#7B5FBF' },
  { id: 'navy', label: 'Azul marino', preview: '#3D5C8E' },
  { id: 'red', label: 'Rojo', preview: '#8B3434' },
  { id: 'forest', label: 'Verde', preview: '#445D44' },
  { id: 'black', label: 'Negro', preview: '#222222' },
  { id: 'white', label: 'Blanco', preview: '#E8E8E8' },
  { id: 'gray', label: 'Gris', preview: '#888888' },
  { id: 'brown', label: 'Café', preview: '#7B4A28' },
];

export const HAIR_STYLES: HairOpt[] = [
  { id: 'none', label: 'Rapado', file: null, supportsSit: true },
  { id: 'buzzcut', label: 'Buzzcut', file: 'buzzcut', supportsSit: true },
  { id: 'bob', label: 'Bob', file: 'bob', supportsSit: true },
  { id: 'bedhead', label: 'Despeinado', file: 'bedhead', gendered: true },
  { id: 'ponytail', label: 'Cola', file: 'ponytail', gendered: true },
  { id: 'long', label: 'Largo', file: 'long', gendered: true },
  { id: 'curly_long', label: 'Rizado', file: 'curly_long', gendered: true },
];

export const CLOTHING_STYLES: Opt[] = [
  { id: 'none', label: 'Sin ropa', supportsSit: true },
  // Only sit-compatible clothing in LPC base assets is the female
  // tshirt; shown to all but rendered as female sprites under the hood.
  { id: 'tshirt', label: 'T-Shirt (♀)', supportsSit: true },
  { id: 'shortsleeve', label: 'Camiseta' },
  { id: 'longsleeve', label: 'Manga larga' },
  { id: 'sleeveless', label: 'Sin mangas' },
  { id: 'vest', label: 'Chaleco' },
  { id: 'vest_open', label: 'Chaleco abierto' },
];

export const FACE_SHAPES_M: Opt[] = [
  { id: 'standard', label: 'Estándar' },
  { id: 'gaunt', label: 'Delgado' },
  { id: 'plump', label: 'Robusto' },
  { id: 'small', label: 'Pequeño' },
];
export const FACE_SHAPES_F: Opt[] = [
  { id: 'standard', label: 'Estándar' },
  { id: 'small', label: 'Pequeño' },
  { id: 'elderly', label: 'Anciano' },
];

export const EYEBROW_STYLES: Opt[] = [
  { id: 'none', label: 'Sin cejas' },
  { id: 'thick', label: 'Gruesas' },
  { id: 'thin', label: 'Delgadas' },
];

export const BEARD_STYLES: { id: string; label: string; file: string | null }[] = [
  { id: 'none', label: 'Sin barba', file: null },
  { id: '5oclock_shadow', label: 'Sombra', file: '5oclock_shadow' },
  { id: 'trimmed', label: 'Recortada', file: 'trimmed' },
  { id: 'basic', label: 'Básica', file: 'basic' },
  { id: 'medium', label: 'Mediana', file: 'medium' },
];

export const GLASSES_STYLES: { id: string; label: string; file: string | null }[] = [
  { id: 'none', label: 'Sin lentes', file: null },
  { id: 'nerd', label: 'Nerd', file: 'nerd' },
  { id: 'round', label: 'Redondos', file: 'round' },
  { id: 'sunglasses', label: 'Sol', file: 'sunglasses' },
  { id: 'halfmoon', label: 'Media luna', file: 'halfmoon' },
  { id: 'shades', label: 'Sombra', file: 'shades' },
];

export const GLASSES_COLORS: Opt[] = [
  { id: 'black', label: 'Negro', preview: '#1A1A1A' },
  { id: 'brown', label: 'Café', preview: '#7B4A28' },
  { id: 'bronze', label: 'Bronce', preview: '#B88660' },
];

export const SHOES_STYLES: Opt[] = [
  { id: 'none', label: 'Descalzo', supportsSit: true },
  { id: 'shoes2', label: 'Zapatos (sit)', supportsSit: true },
  { id: 'shoes', label: 'Zapatos' },
  { id: 'boots', label: 'Botas' },
  { id: 'sandals', label: 'Sandalias' },
  { id: 'slippers', label: 'Pantuflas' },
];

const BODY_TYPES: Opt[] = [
  { id: 'muy_delgado', label: 'Muy delgado' },
  { id: 'delgado', label: 'Delgado' },
  { id: 'medio', label: 'Medio' },
  { id: 'obeso', label: 'Obeso' },
  { id: 'muy_obeso', label: 'Muy obeso' },
];

export type CharacterConfig = {
  name: string;
  gender: Gender;
  skinId: string;
  bodyType: BodyType;
  height: CharHeight;
  faceShape: string;
  hairStyle: string;
  hairColor: string;
  eyeColor: string;
  eyebrowStyle: string;
  beardStyle: string;
  glassesStyle: string;
  glassesColor: string;
  clothingStyle: string;
  clothingColor: string;
  pantsColor: string;
  shoesStyle: string;
  shoesColor: string;
};

const NAKED_CONFIG: CharacterConfig = {
  name: '',
  gender: 'masculino',
  skinId: 'light',
  bodyType: 'medio',
  height: 'medio',
  faceShape: 'standard',
  hairStyle: 'none',
  hairColor: 'black',
  eyeColor: 'brown',
  eyebrowStyle: 'none',
  beardStyle: 'none',
  glassesStyle: 'none',
  glassesColor: 'black',
  clothingStyle: 'none',
  clothingColor: 'purple',
  pantsColor: 'navy',
  shoesStyle: 'none',
  shoesColor: 'black',
};

type Direction = 'n' | 'w' | 's' | 'e';
const DIR_ROW: Record<Direction, number> = { n: 8, w: 9, s: 10, e: 11 };

// LPC Universal sheet animations that exist across every layer
// (body, head, eyes, hair, clothes, shoes, etc.). Extended animations
// like sit / jump / climb only ship on a subset of layers and are
// intentionally left out for now to avoid a half-rendered character.
export type CharacterAnimation =
  | 'idle'
  | 'walk'
  | 'cast'
  | 'thrust'
  | 'slash'
  | 'shoot'
  | 'hurt'
  | 'sit';

// Animations that live past row 20 of the LPC sheet. Most accessory
// layers (clothes, shoes, hair) only ship the base 21 rows, so we
// gate them at render time to avoid showing the wrong frame.
export const EXTENDED_ANIMATIONS = new Set<CharacterAnimation>(['sit']);

type AnimationDef = {
  // Either a per-direction row map, or a single row used for every
  // direction (hurt is south-only in LPC).
  rows: Record<Direction, number> | number;
  frames: number;
  fps: number;
};

export const ANIMATIONS: Record<CharacterAnimation, AnimationDef> = {
  // Frame 0 of the walk row is the "standing" pose.
  idle:   { rows: { n: 8,  w: 9,  s: 10, e: 11 }, frames: 1,  fps: 1 },
  walk:   { rows: { n: 8,  w: 9,  s: 10, e: 11 }, frames: 9,  fps: 8 },
  cast:   { rows: { n: 0,  w: 1,  s: 2,  e: 3  }, frames: 7,  fps: 8 },
  thrust: { rows: { n: 4,  w: 5,  s: 6,  e: 7  }, frames: 8,  fps: 10 },
  slash:  { rows: { n: 12, w: 13, s: 14, e: 15 }, frames: 6,  fps: 12 },
  shoot:  { rows: { n: 16, w: 17, s: 18, e: 19 }, frames: 13, fps: 12 },
  // Hurt only has the south-facing row.
  hurt:   { rows: 20,                              frames: 6,  fps: 6 },
  // Sit lives in the universal sheet's extended block (rows 30-33).
  // Only items with `supportsSit` show up; the rest are skipped at
  // render time to avoid a half-finished pose.
  sit:    { rows: { n: 30, w: 31, s: 32, e: 33 }, frames: 3,  fps: 4 },
};

// Animaciones que se reproducen UNA vez y se quedan en el último frame (poses
// que terminan en un estado: sentarse, lanzar, golpear…). 'idle' y 'walk' son
// cíclicas (idle = 1 frame; walk reproduce el ciclo de pasos).
export const ONE_SHOT_ANIMATIONS = new Set<CharacterAnimation>([
  'sit',
  'cast',
  'thrust',
  'slash',
  'shoot',
  'hurt',
]);

// Frame a mostrar para un NPC dado un contador MONÓTONO (siempre creciente):
// las cíclicas hacen módulo (bucle); las de una sola vez avanzan hasta el último
// frame y se quedan ahí.
export function npcDisplayFrame(
  animation: CharacterAnimation,
  counter: number,
): number {
  const def = ANIMATIONS[animation];
  if (def.frames <= 1) return 0;
  return ONE_SHOT_ANIMATIONS.has(animation)
    ? Math.min(counter, def.frames - 1)
    : counter % def.frames;
}

export const ANIMATION_OPTIONS: { id: CharacterAnimation; label: string }[] = [
  { id: 'idle',   label: 'Quieto' },
  { id: 'walk',   label: 'Caminar' },
  { id: 'sit',    label: 'Sentado' },
  { id: 'hurt',   label: 'Herido' },
  { id: 'cast',   label: 'Conjurar' },
  { id: 'thrust', label: 'Estocada' },
  { id: 'slash',  label: 'Tajo' },
  { id: 'shoot',  label: 'Disparar' },
];

type LayerKey =
  | 'body'
  | 'head'
  | 'eyes'
  | 'hair'
  | 'eyebrows'
  | 'beard'
  | 'glasses'
  | 'clothes'
  | 'backpack'
  | 'pants'
  | 'shoes';

type Step = {
  key: keyof CharacterConfig;
  label: string;
  options?: Opt[];
  reveals?: LayerKey;
  type?: 'choice' | 'text';
};

function buildSteps(config: CharacterConfig): Step[] {
  const steps: Step[] = [
    { key: 'gender', label: 'Género', reveals: 'body', options: [
      { id: 'masculino', label: 'Masculino' },
      { id: 'femenino', label: 'Femenino' },
    ]},
    { key: 'skinId', label: 'Color de piel', options: SKIN_TONES },
    { key: 'faceShape', label: 'Forma del rostro', reveals: 'head',
      options: config.gender === 'masculino' ? FACE_SHAPES_M : FACE_SHAPES_F },
    { key: 'bodyType', label: 'Tipo de cuerpo', options: BODY_TYPES },
    { key: 'hairStyle', label: 'Cabello', reveals: 'hair', options: HAIR_STYLES },
    { key: 'hairColor', label: 'Color de cabello', options: HAIR_COLORS },
    { key: 'eyebrowStyle', label: 'Cejas', reveals: 'eyebrows', options: EYEBROW_STYLES },
    { key: 'eyeColor', label: 'Color de ojos', options: EYE_COLORS },
  ];
  if (config.gender === 'masculino') {
    steps.push({ key: 'beardStyle', label: 'Barba', reveals: 'beard', options: BEARD_STYLES });
  }
  steps.push({ key: 'glassesStyle', label: 'Lentes', reveals: 'glasses', options: GLASSES_STYLES });
  if (config.glassesStyle !== 'none') {
    steps.push({ key: 'glassesColor', label: 'Color de lentes', options: GLASSES_COLORS });
  }
  steps.push({ key: 'clothingStyle', label: 'Vestimenta', reveals: 'clothes', options: CLOTHING_STYLES });
  if (config.clothingStyle !== 'none') {
    steps.push({ key: 'clothingColor', label: 'Color de vestimenta', options: CLOTHING_COLORS });
  }
  steps.push({ key: 'pantsColor', label: 'Color de pantalón', reveals: 'pants', options: CLOTHING_COLORS });
  steps.push({ key: 'shoesStyle', label: 'Calzado', reveals: 'shoes', options: SHOES_STYLES });
  if (config.shoesStyle !== 'none') {
    steps.push({ key: 'shoesColor', label: 'Color de calzado', options: CLOTHING_COLORS });
  }
  steps.push({ key: 'name', label: 'Nombre', type: 'text' });
  return steps;
}

const NAME_RE = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+$/;
const NAME_MIN = 3;
const NAME_MAX = 16;

function validateName(name: string): { ok: boolean; msg: string } {
  const t = name.trim();
  if (t.length === 0) return { ok: false, msg: `Entre ${NAME_MIN} y ${NAME_MAX} letras, sin espacios ni símbolos` };
  if (t.length < NAME_MIN) return { ok: false, msg: `Mínimo ${NAME_MIN} letras` };
  if (t.length > NAME_MAX) return { ok: false, msg: `Máximo ${NAME_MAX} letras` };
  if (!NAME_RE.test(t)) return { ok: false, msg: 'Solo letras (sin espacios ni símbolos)' };
  return { ok: true, msg: `${t.length} / ${NAME_MAX} letras` };
}

export default function CharacterCreator({
  onConfirm,
}: {
  onConfirm: (config: CharacterConfig) => void;
}) {
  const [config, setConfig] = useState<CharacterConfig>(NAKED_CONFIG);
  const [stepIdx, setStepIdx] = useState(0);
  const [revealed, setRevealed] = useState<Set<LayerKey>>(
    new Set<LayerKey>(['body', 'head', 'eyes']),
  );
  const [direction, setDirection] = useState<Direction>('s');
  const [frame, setFrame] = useState(0);
  const walkingKeysRef = useRef<Set<string>>(new Set());
  const [walking, setWalking] = useState(false);
  const [phase, setPhase] = useState<'creating' | 'transitioning'>(
    'creating',
  );
  const confirmAudioRef = useRef<HTMLAudioElement | null>(null);
  const walkAudioRef = useRef<HTMLAudioElement | null>(null);

  const steps = useMemo(() => buildSteps(config), [config]);
  const safeStepIdx = Math.min(stepIdx, steps.length - 1);
  const step = steps[safeStepIdx];

  // Reveal the step's layer as soon as we enter it, so the user sees
  // their changes in the preview while cycling options.
  useEffect(() => {
    if (step.reveals) {
      const layer = step.reveals;
      setRevealed((s) => (s.has(layer) ? s : new Set(s).add(layer)));
    }
  }, [step.reveals]);

  // ── Walk frame cycler + walking sound ─────────────────────────
  useEffect(() => {
    const walkAudio = walkAudioRef.current;
    if (!walking) {
      setFrame(0);
      if (walkAudio) {
        walkAudio.pause();
        walkAudio.currentTime = 0;
      }
      return;
    }
    if (walkAudio) {
      walkAudio.loop = true;
      walkAudio.volume = 0.4;
      walkAudio.play().catch(() => undefined);
    }
    const id = window.setInterval(() => {
      setFrame((f) => (f >= 8 ? 1 : f + 1));
    }, 130);
    return () => {
      window.clearInterval(id);
      if (walkAudio) {
        walkAudio.pause();
        walkAudio.currentTime = 0;
      }
    };
  }, [walking]);

  // ── Idle behaviour: occasionally turn or wander ────────────────
  useEffect(() => {
    if (walking) return;
    if (phase !== 'creating') return;
    let stop = false;
    const tick = () => {
      if (stop) return;
      const r = Math.random();
      if (r < 0.65) {
        // Just turn
        const dirs: Direction[] = ['n', 'w', 's', 'e'];
        const next = dirs[Math.floor(Math.random() * dirs.length)];
        setDirection(next);
      } else {
        // Walk in place briefly
        const dirs: Direction[] = ['n', 'w', 's', 'e'];
        setDirection(dirs[Math.floor(Math.random() * dirs.length)]);
        setWalking(true);
        window.setTimeout(() => {
          if (!walkingKeysRef.current.size) setWalking(false);
        }, 700 + Math.random() * 700);
      }
    };
    const id = window.setInterval(tick, 3500 + Math.random() * 2000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [walking, phase]);

  // ── Keyboard control ──────────────────────────────────────────
  useEffect(() => {
    const keyToDir = (key: string | undefined): Direction | null => {
      if (typeof key !== 'string') return null;
      const k = key.toLowerCase();
      if (k === 'arrowup' || k === 'w') return 'n';
      if (k === 'arrowdown' || k === 's') return 's';
      if (k === 'arrowleft' || k === 'a') return 'w';
      if (k === 'arrowright' || k === 'd') return 'e';
      return null;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (phase !== 'creating') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        return;
      }
      const dir = keyToDir(e.key);
      if (!dir) return;
      e.preventDefault();
      walkingKeysRef.current.add(e.key);
      setDirection(dir);
      setWalking(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const dir = keyToDir(e.key);
      if (!dir) return;
      walkingKeysRef.current.delete(e.key);
      if (walkingKeysRef.current.size === 0) {
        setWalking(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [phase]);

  // ── Wizard navigation ─────────────────────────────────────────
  const cycleOption = (delta: 1 | -1) => {
    if (!step.options) return;
    const opts = step.options;
    const currentValue = String(config[step.key] ?? '');
    const idx = Math.max(
      0,
      opts.findIndex((o) => o.id === currentValue),
    );
    const next = (idx + delta + opts.length) % opts.length;
    setConfig((c) => ({ ...c, [step.key]: opts[next].id }));
    if (step.reveals) {
      const layer = step.reveals;
      setRevealed((s) => (s.has(layer) ? s : new Set(s).add(layer)));
    }
  };

  const advance = () => {
    const sfx = confirmAudioRef.current;
    if (sfx) {
      sfx.volume = 0.65;
      sfx.currentTime = 0;
      sfx.play().catch(() => undefined);
    }
    if (step.reveals) {
      setRevealed((s) => new Set(s).add(step.reveals as LayerKey));
    }
    if (safeStepIdx + 1 >= steps.length) {
      // Begin zoom-out transition: face up, stop walking, hide UI.
      setDirection('n');
      setWalking(false);
      walkingKeysRef.current.clear();
      setPhase('transitioning');
      window.setTimeout(() => onConfirm(config), 1700);
    } else {
      setStepIdx(safeStepIdx + 1);
    }
  };

  const goBack = () => {
    if (safeStepIdx > 0) setStepIdx(safeStepIdx - 1);
  };

  // ── Current option label for display ───────────────────────────
  let currentOptionLabel = '';
  let currentSwatch: string | undefined;
  if (step.options) {
    const v = String(config[step.key] ?? '');
    const found = step.options.find((o) => o.id === v) ?? step.options[0];
    currentOptionLabel = found.label;
    currentSwatch = found.preview;
  }

  // Name validation
  const nameVal = step.type === 'text' ? validateName(config.name) : null;
  const canConfirm = step.type === 'text' ? !!nameVal?.ok : true;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        background: phase === 'transitioning' ? '#000000' : '#0a0a14',
        transition: 'background 1.5s ease',
        color: '#e5e5e5',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontFamily: "'Silkscreen', cursive",
        animation: 'pixelFadeIn 0.7s ease-out',
        overflow: 'hidden',
        padding: '24px 24px 32px',
      }}
    >
      {/* Header */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 8px',
          opacity: phase === 'transitioning' ? 0 : 1,
          transition: 'opacity 600ms ease',
          pointerEvents: phase === 'transitioning' ? 'none' : 'auto',
        }}
      >
        <div
          style={{
            fontSize: 'clamp(0.85rem, 1.6vw, 1.05rem)',
            letterSpacing: '0.22em',
            color: 'var(--color-accent)',
            textShadow: '2px 2px 0 rgba(0,0,0,0.6)',
            textTransform: 'uppercase',
          }}
        >
          Crea tu personaje
        </div>
        <div
          style={{
            fontSize: '0.7rem',
            letterSpacing: '0.18em',
            color: 'rgba(225,215,255,0.6)',
          }}
        >
          {safeStepIdx + 1} / {steps.length}
        </div>
      </div>

      {/* Character (centered, large) */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          minHeight: 0,
        }}
      >
        <div
          style={{
            transition: 'transform 1.6s cubic-bezier(0.65, 0, 0.35, 1)',
            transform: phase === 'transitioning' ? 'scale(0.5)' : 'scale(1)',
          }}
        >
          <CharacterSprite
            config={config}
            direction={direction}
            frame={frame}
            revealed={revealed}
          />
        </div>
      </div>

      {/* Step controls */}
      <div
        key={step.key}
        style={{
          width: '100%',
          maxWidth: 560,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          animation: 'pixelFadeIn 0.35s ease-out',
          opacity: phase === 'transitioning' ? 0 : 1,
          transition: 'opacity 600ms ease',
          pointerEvents: phase === 'transitioning' ? 'none' : 'auto',
        }}
      >
        <div
          style={{
            fontSize: '0.75rem',
            letterSpacing: '0.22em',
            color: 'var(--color-accent)',
            textTransform: 'uppercase',
            textShadow: '1px 1px 0 rgba(0,0,0,0.6)',
          }}
        >
          {step.label}
        </div>

        {step.type === 'text' ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              width: '100%',
            }}
          >
            <input
              type="text"
              value={config.name}
              autoFocus
              onChange={(e) => {
                const cleaned = e.target.value
                  .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '')
                  .slice(0, NAME_MAX);
                setConfig((c) => ({ ...c, name: cleaned }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canConfirm) advance();
              }}
              placeholder="Nombre"
              style={{
                width: '100%',
                maxWidth: 360,
                padding: '12px 14px',
                background: '#1a1a1a',
                color: '#e5e5e5',
                border: '2px solid var(--color-accent)',
                fontFamily: "'Silkscreen', cursive",
                fontSize: '0.9rem',
                letterSpacing: '0.08em',
                textAlign: 'center',
                outline: 'none',
              }}
            />
            <div
              style={{
                fontSize: '0.6rem',
                letterSpacing: '0.12em',
                color: nameVal?.ok
                  ? 'rgba(150,220,150,0.85)'
                  : 'rgba(220,150,150,0.85)',
              }}
            >
              {nameVal?.msg}
            </div>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              minHeight: 44,
            }}
          >
            <ArrowButton onClick={() => cycleOption(-1)} dir="left" />
            <div
              style={{
                minWidth: 200,
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontSize: '0.8rem',
                letterSpacing: '0.08em',
                color: '#e5e5e5',
                textShadow: '1px 1px 0 rgba(0,0,0,0.6)',
              }}
            >
              {currentSwatch && (
                <span
                  style={{
                    width: 16,
                    height: 16,
                    background: currentSwatch,
                    border: '2px solid #e5e5e5',
                    display: 'inline-block',
                  }}
                />
              )}
              {currentOptionLabel}
            </div>
            <ArrowButton onClick={() => cycleOption(1)} dir="right" />
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 4,
            alignItems: 'center',
          }}
        >
          {safeStepIdx > 0 && (
            <button
              type="button"
              onClick={goBack}
              className="pixel-btn pixel-btn-secondary"
              style={{ fontSize: '0.6rem', padding: '6px 12px' }}
            >
              ← Atrás
            </button>
          )}
          <button
            type="button"
            onClick={() => canConfirm && advance()}
            disabled={!canConfirm}
            className="pixel-btn pixel-btn-primary"
            style={{
              opacity: canConfirm ? 1 : 0.4,
              cursor: canConfirm ? 'pointer' : 'not-allowed',
            }}
          >
            {safeStepIdx + 1 >= steps.length ? 'Empezar' : 'Confirmar'}
          </button>
        </div>

        <div
          style={{
            fontSize: '0.55rem',
            letterSpacing: '0.18em',
            color: 'rgba(225,215,255,0.4)',
            marginTop: 4,
          }}
        >
          Usa ← ↑ → ↓ o WASD para mover al personaje
        </div>
      </div>

      <audio
        ref={confirmAudioRef}
        src="/sounds/music/Confirm%20Sound%20Effect.mp3"
        preload="auto"
      />
      <audio
        ref={walkAudioRef}
        src="/sounds/music/Efecto%20de%20sonido%20caminando%20272246.mp3"
        loop
        preload="auto"
      />
    </div>
  );
}

function ArrowButton({
  onClick,
  dir,
}: {
  onClick: () => void;
  dir: 'left' | 'right';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === 'left' ? 'Anterior' : 'Siguiente'}
      style={{
        width: 38,
        height: 38,
        background: '#1a1a1a',
        border: '2px solid var(--color-accent)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        boxShadow: '2px 2px 0 rgba(0,0,0,0.4)',
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="square"
        strokeLinejoin="miter"
        aria-hidden="true"
        style={{
          transform: dir === 'right' ? 'scaleX(-1)' : undefined,
        }}
      >
        <path d="M15 4 L7 12 L15 20" />
      </svg>
    </button>
  );
}

export const ALL_LAYERS: Set<LayerKey> = new Set<LayerKey>([
  'body',
  'head',
  'eyes',
  'hair',
  'eyebrows',
  'beard',
  'glasses',
  'clothes',
  'pants',
  'shoes',
]);

export type SpriteDirection = Direction;

export function CharacterSprite({
  config,
  direction,
  frame,
  animation = 'walk',
  revealed = ALL_LAYERS,
  scale = 6,
  withBackpack = false,
}: {
  config: CharacterConfig;
  direction: Direction;
  frame: number;
  animation?: CharacterAnimation;
  revealed?: Set<LayerKey>;
  scale?: number;
  // Render the leather backpack strapped to the character's back.
  // Off in the creator wizard / NPC editor preview; on in gameplay
  // so the player always carries it.
  withBackpack?: boolean;
}) {
  const FRAME = 64;
  const SCALE = scale;
  const SHEET_W = 832;
  const animDef = ANIMATIONS[animation];
  const COL = animDef.frames > 0 ? frame % animDef.frames : 0;
  const ROW =
    typeof animDef.rows === 'number' ? animDef.rows : animDef.rows[direction];
  const isExtended = EXTENDED_ANIMATIONS.has(animation);

  const baseGenderSheet = config.gender === 'masculino' ? 'male' : 'female';
  // Always use the standard male/female body so clothes/shoes/pants
  // align perfectly. Body-type variation comes from the scaleX wrapper
  // below (LPC doesn't ship matching accessories for muscular/teen/pregnant).
  const bodySheet = baseGenderSheet;

  const headSheet =
    config.faceShape === 'standard'
      ? baseGenderSheet
      : `${baseGenderSheet}_${config.faceShape}`;

  const bodyUrl = `/character/body/${bodySheet}/${config.skinId}.png`;
  const headUrl = `/character/head/${headSheet}/${config.skinId}.png`;
  const eyesUrl = `/character/eyes/${config.eyeColor}.png`;
  const eyebrowsUrl =
    config.eyebrowStyle !== 'none'
      ? `/character/eyebrows/${config.eyebrowStyle}/${config.hairColor}.png`
      : null;
  // tshirt only ships in the female sheet; render it as female regardless
  // of the configured gender so sit-compatible characters stay sittable.
  const clothesGenderSheet =
    config.clothingStyle === 'tshirt' ? 'female' : baseGenderSheet;
  const clothesOpt = CLOTHING_STYLES.find(
    (c) => c.id === config.clothingStyle,
  );
  const clothesUrl =
    config.clothingStyle !== 'none'
      ? `/character/clothes/${config.clothingStyle}/${clothesGenderSheet}/${config.clothingColor}.png`
      : null;
  const pantsUrl = `/character/pants/${baseGenderSheet}/${config.pantsColor || 'navy'}.png`;
  const shoesOpt = SHOES_STYLES.find((s) => s.id === config.shoesStyle);
  const shoesUrl =
    config.shoesStyle && config.shoesStyle !== 'none'
      ? `/character/shoes/${config.shoesStyle}/${baseGenderSheet}/${config.shoesColor || 'black'}.png`
      : null;

  const hairOpt = HAIR_STYLES.find((h) => h.id === config.hairStyle);
  const hairUrl =
    hairOpt && hairOpt.file
      ? hairOpt.gendered
        ? `/character/hair/${hairOpt.file}/${baseGenderSheet}/${config.hairColor}.png`
        : `/character/hair/${hairOpt.file}/${config.hairColor}.png`
      : null;

  const beardOpt = BEARD_STYLES.find((b) => b.id === config.beardStyle);
  const beardUrl =
    config.gender === 'masculino' && beardOpt && beardOpt.file
      ? `/character/beards/${beardOpt.file}/${config.hairColor}.png`
      : null;

  const glassesOpt = GLASSES_STYLES.find((g) => g.id === config.glassesStyle);
  const glassesUrl =
    glassesOpt && glassesOpt.file
      ? `/character/glasses/${glassesOpt.file}/${config.glassesColor}.png`
      : null;

  const backpackUrl = withBackpack
    ? `/character/backpack/${baseGenderSheet}/leather.png`
    : null;

  // For extended animations (sit, etc.) we hide accessory layers whose
  // sheet doesn't carry frames past row 20 — otherwise the renderer
  // would sample garbage / transparency and the character would look
  // half-finished. Body / head / eyes / pants / eyebrows / beard /
  // glasses all ship the full 46-row universal sheet so they stay.
  const hideClothes = isExtended && !clothesOpt?.supportsSit;
  const hideShoes = isExtended && !shoesOpt?.supportsSit;
  const hideHair = isExtended && !hairOpt?.supportsSit;

  const layers: { url: string; key: LayerKey }[] = [];
  if (revealed.has('body')) layers.push({ url: bodyUrl, key: 'body' });
  if (revealed.has('pants')) layers.push({ url: pantsUrl, key: 'pants' });
  if (revealed.has('shoes') && shoesUrl && !hideShoes)
    layers.push({ url: shoesUrl, key: 'shoes' });
  if (revealed.has('clothes') && clothesUrl && !hideClothes)
    layers.push({ url: clothesUrl, key: 'clothes' });
  if (revealed.has('head')) layers.push({ url: headUrl, key: 'head' });
  if (revealed.has('eyes')) layers.push({ url: eyesUrl, key: 'eyes' });
  if (revealed.has('eyebrows') && eyebrowsUrl)
    layers.push({ url: eyebrowsUrl, key: 'eyebrows' });
  if (revealed.has('beard') && beardUrl)
    layers.push({ url: beardUrl, key: 'beard' });
  if (revealed.has('hair') && hairUrl && !hideHair)
    layers.push({ url: hairUrl, key: 'hair' });
  // Backpack draws over hair / clothes (matches LPC's zPos 110) so it
  // looks correct from every facing — strap visible across the chest,
  // pack visible from behind. Like clothes / shoes, it only ships the
  // base 21 rows so we hide it during extended animations (sit etc.).
  if (backpackUrl && !isExtended)
    layers.push({ url: backpackUrl, key: 'backpack' });
  if (revealed.has('glasses') && glassesUrl)
    layers.push({ url: glassesUrl, key: 'glasses' });

  const displayW = FRAME * SCALE;
  const displayH = FRAME * SCALE;

  // Width factor differentiates the 5 body-type levels even when they
  // share the same LPC body sheet (LPC only ships 3 silhouettes).
  const widthFactor = {
    muy_delgado: 0.86,
    delgado: 0.94,
    medio: 1,
    obeso: 1.08,
    muy_obeso: 1.2,
  }[config.bodyType];

  return (
    <div
      style={{
        width: displayW,
        height: displayH,
        position: 'relative',
        filter: 'drop-shadow(3px 5px 0 rgba(0,0,0,0.6))',
        transform: `scaleX(${widthFactor})`,
        transformOrigin: 'center bottom',
      }}
    >
      {layers.map((l) => (
        <div
          key={l.key}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `url(${l.url})`,
            backgroundSize: `${SHEET_W * SCALE}px auto`,
            backgroundPosition: `${-COL * FRAME * SCALE}px ${-ROW * FRAME * SCALE}px`,
            backgroundRepeat: 'no-repeat',
            imageRendering: 'pixelated',
          }}
        />
      ))}
    </div>
  );
}
