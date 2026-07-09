'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import PixelStars from '@/components/landing/PixelStars';
import PointerCursor from '@/components/landing/PointerCursor';
import CharacterCreator, {
  type CharacterConfig,
} from '@/components/landing/CharacterCreator';
import CharacterGameplay from '@/components/landing/CharacterGameplay';
import SavePointIndicator from '@/components/landing/SavePointIndicator';
import AccountRecoveryModal from '@/components/landing/AccountRecoveryModal';
import OnboardingSlidersModal from '@/components/landing/OnboardingSlidersModal';
import EntryChoiceModal from '@/components/landing/EntryChoiceModal';
import ProposalPendingModal from '@/components/landing/ProposalPendingModal';
import CandidateAccountModal from '@/components/landing/CandidateAccountModal';
import ClientSignupModal from '@/components/landing/ClientSignupModal';
import ClientLoginModal from '@/components/landing/ClientLoginModal';
import MemberLoginModal from '@/components/landing/MemberLoginModal';
import { useAuth } from '@/components/providers/AuthProvider';

const ENTRY_MESSAGES = [
  'Estás por entrar a un lugar en donde los sueños se hacen realidad...',
  'Debes saber que lo que estás a punto de hacer...',
  'Cambiará tu vida',
  'Bien, te pondré a prueba...',
];
const TYPING_SPEED_MS = 30;
type EntryPhase =
  | 'message1'
  | 'message2'
  | 'message2Reveal'
  | 'floatingChips'
  | 'preChallenge'
  | 'challenge';

const REVEAL_TEXT = 'Cambiará tu vida';

type PlanetScene = {
  image: string;
  musicRefKey: 'planet' | 'peligro';
  texts: string[];
};
const PLANET_SCENES: PlanetScene[] = [
  {
    image: '/PaisajeVioleta1.png',
    musicRefKey: 'planet',
    texts: [
      'En este mundo todos ocupamos un lugar...',
      'Hacer que todos compartamos el mismo espacio, fue una enorme travesía...',
      'Antes de esto, todo era diferente...',
    ],
  },
  {
    image: '/Pixelart2.png',
    musicRefKey: 'peligro',
    texts: [
      'Observa... Las calles cambian cuando a nadie le interesa poner orden.',
      'Por eso voy a pedirte que me enseñes...',
      '¿Qué harías tú para sobrevivir en un lugar así?',
      '¿Estás listo?',
    ],
  },
];

const PLANET_QUESTION =
  'Estás a punto de ingresar al Mundo Violeta antes de que se convirtiera en lo que es ahora, una vez ingreses necesitarás buscar ayuda antes de que te encuentren si deseas sobrevivir';

type Challenge = 'flee' | 'rapid' | 'flicker' | 'beacon' | 'spaceship' | 'serious';

const VALUE_CHIPS: Array<{
  label: string;
  color: string;
  challenge: Challenge;
  description: string;
}> = [
  {
    label: 'determinación',
    color: '#ef4444',
    challenge: 'flee',
    description: 'Insiste todas las veces que sean necesarias.',
  },
  {
    label: 'coraje',
    color: '#f97316',
    challenge: 'rapid',
    description: 'Confronta tus miedos, y que nada te detenga.',
  },
  {
    label: 'pureza',
    color: '#e0f2fe',
    challenge: 'flicker',
    description: 'Eres lo que sientes y aceptas tu naturaleza.',
  },
  {
    label: 'fe',
    color: '#fbbf24',
    challenge: 'beacon',
    description: 'Confía en todo, incluso en los peores momentos.',
  },
  {
    label: 'paciencia',
    color: '#10b981',
    challenge: 'spaceship',
    description:
      'Después de todo, aprendiste a preocuparte sólo en lo necesario.',
  },
  {
    label: 'seriedad',
    color: '#6366f1',
    challenge: 'serious',
    description: 'Ignoras las palabras, valoras principalmente las acciones.',
  },
  {
    label: 'espontaneidad',
    color: '#ec4899',
    challenge: 'flee',
    description:
      'Olvidas todo, solo recuerdas quien eres y el por qué estás aquí.',
  },
  {
    label: 'autonomía',
    color: '#06b6d4',
    challenge: 'flee',
    description: 'Puedes realizar hasta tus más grandes deseos.',
  },
  {
    label: 'empatía',
    color: '#a78bfa',
    challenge: 'flee',
    description: 'Seleccionas y amas cuando encuentras la verdad en los demás.',
  },
];

// Flee challenge
const FLEE_RADIUS = 150;
const MOUSE_AVOID_MIN_DIST = 260;
// Chase mechanic: counter advances while the chip is actively escaping
// (i.e. teleports keep happening). If the user stops triggering escapes
// for CHASE_GRACE_MS, the counter resets. Total escape time required = 10s.
const CHASE_REQUIRED_MS = 10_000;
const CHASE_GRACE_MS = 5_000;

// Rapid-click challenge (coraje) — three finite levels of escalating speed.
const RAPID_WINDOW_MS = 1500;
const RAPID_THRESHOLDS = [7, 11, 15]; // clicks within RAPID_WINDOW_MS per level
const RAPID_DECAY_TICK_MS = 100;
const RAPID_LEVEL_FLASH_MS = 420;

// Flicker challenge
const FLICKER_DURATION_MS = 20000;
const FLICKER_PHASE_START_MS = 1500;
const FLICKER_PHASE_END_MS = 80;
const FLICKER_TRANSITION_RATIO = 0.85;
const FLICKER_TRANSITION_MIN_MS = 40;
const BG_DARK = 'rgba(0, 0, 0, 0.85)';
const BG_WHITE = 'rgba(255, 255, 255, 0.94)';

// Lockout overlay — realistic chain pattern (alternating side-view and
// end-view oval links with three stroke layers for metallic depth).
const CHAIN_PATTERN_SVG =
  "<svg xmlns='http://www.w3.org/2000/svg' width='56' height='32' viewBox='0 0 56 32'>" +
  "<ellipse cx='14' cy='16' rx='11.5' ry='8.5' fill='none' stroke='%230a0a0a' stroke-width='5.5'/>" +
  "<ellipse cx='14' cy='16' rx='11.5' ry='8.5' fill='none' stroke='%234a4a4a' stroke-width='3'/>" +
  "<ellipse cx='14' cy='16' rx='11.5' ry='8.5' fill='none' stroke='%23a8a8a8' stroke-width='1'/>" +
  "<ellipse cx='42' cy='16' rx='5' ry='11.5' fill='none' stroke='%230a0a0a' stroke-width='5.5'/>" +
  "<ellipse cx='42' cy='16' rx='5' ry='11.5' fill='none' stroke='%234a4a4a' stroke-width='3'/>" +
  "<ellipse cx='42' cy='16' rx='5' ry='11.5' fill='none' stroke='%23a8a8a8' stroke-width='1'/>" +
  "</svg>";
const CHAIN_PATTERN_URL = `url("data:image/svg+xml;utf8,${CHAIN_PATTERN_SVG}")`;

// Pureza second-stage: white-vs-black choice with a hidden third option
const PUREZA_IDX = 2;
const PUREZA_VIOLET = '#8b5cf6';
const PUREZA_PHASE_TIMER_MS = 15_000; // visible countdown per phase
const PUREZA_FILL_FADE_MS = 700;     // fade-in for the violet "ambas" panel
const PUREZA_FLASH_HOLD_MS = 450;
const PUREZA_FLASH_FADE_MS = 420;
const PUREZA_MIX_DURATION_MS = 2200; // halves spiral in + 3D bubble emerges + grows past viewport
const PUREZA_PHASES: Array<{ white: string; black: string }> = [
  { white: 'Discutir',  black: 'Golpear' },
  { white: 'Confesar',  black: 'Mentir' },
  { white: 'Perdonar',  black: 'Matar' },
  { white: 'Unir',      black: 'Discriminar' },
];

// Starfield used as the new pureza background — stars pulse and the field
// densifies/accelerates during the 20s flicker challenge.
type PurezaStar = {
  id: number;
  x: number;            // % across the viewport
  y: number;            // % down the viewport
  size: number;         // px
  delay: number;        // s — staggered twinkling
  threshold: number;    // 0..1 — minimum flicker intensity for the star to appear
  driftIdx: number;     // 0..5 — which drift keyframe pattern to use
  driftDuration: number;// s — how long a drift cycle takes
  driftDelay: number;   // s — phase offset so stars don't move in sync
};
const PUREZA_STAR_COUNT = 170;

// Beacon (fe) challenge
const BEACON_DOT_SIZE = 22;
const BEACON_HOVER_RADIUS = 40;
const BEACON_HOVER_REQUIRED_MS = 20000;
const BEACON_AWAY_RESPAWN_MS = 5000;
const BEACON_IDLE_RESPAWN_MS = 2500; // when the user never engages, respawn 2.5s after fade-out
const BEACON_FADE_IN_MS = 400;
const BEACON_VISIBLE_MS = 1500;
const BEACON_FADE_OUT_MS = 700;
const BEACON_MIN_SEPARATION = 120;

// Serious (seriedad) challenge — dialog flow
const SERIEDAD_PAUSE_MS = 3900;
const SERIEDAD_FADE_MS = 360;
const SERIEDAD_TYPING_DELAY_MS = 280;
const SERIEDAD_PATIENCE_MS = 5 * 60 * 1000; // 5 minutes
const SERIEDAD_TEXTS: Record<string, string> = {
  q1: 'Sabes, las palabras, las intenciones, y los sueños dejan de tener sentido, desde el momento en el que prefieres ignorarlos...',
  q2: 'No importa lo difícil que sea, ni lo imposible que sea, lucharé...',
  q3: 'Lo que haces, te construye...',
  q4: '¿Qué vas a hacer ahora?',
  ok: 'Ok',
  why: '¿Y por qué vas a luchar?',
  really: '¿En serio?',
  finalQ:
    'Si lo pensaste bien, entonces quiero saber tus verdaderas razones para luchar, y si aún no estás seguro, hazlo entonces en otro momento...',
};

// Spaceship (paciencia) challenge
const PACIENCIA_FLY_SPEED = 780;             // px/s while flying at full throttle
const PACIENCIA_FLY_DURATION_MS = 15000;     // full-speed window before deceleration
const PACIENCIA_DECEL_DURATION_MS = 9000;    // deceleration ramp from full speed → 0
const PACIENCIA_SETTLE_DURATION_MS = 1100;   // homing animation to the initial position
const PACIENCIA_WAIT_MS = 15000;             // patient wait once landed → catchable
const PACIENCIA_DODGE_RADIUS = 90;           // cursor proximity that triggers re-launch
const PACIENCIA_DIR_CHANGE_PER_SEC = 0.7;    // probability/sec of a random heading change
const PACIENCIA_PARTICLE_LIFETIME_MS = 700;
const PACIENCIA_PARTICLE_INTERVAL_MS = 28;
const PACIENCIA_MAX_PARTICLES = 28;

// Generic chip layout
const CHIP_W = 170;
const CHIP_H = 40;
const VIEWPORT_PAD = 24;
const FADE_MS = 260;

type ChipMode =
  | 'hidden'
  | 'roaming'
  | 'fleeing'
  | 'catchable'
  | 'rapid'
  | 'flicker'
  | 'beacon'
  | 'spaceship'
  | 'serious'        // chip visible, click opens the dialog
  | 'serious-active'; // chip hidden while the dialog is on screen

type SeriedadStage =
  | 'idle'
  | 'q1'
  | 'q2'
  | 'q3'
  | 'q4'
  | 'choice'
  | 'ok'
  | 'why'
  | 'really'
  | 'finalQ';

type PacienciaPhase = 'flying' | 'decelerating' | 'settling' | 'waiting';
type PacienciaParticle = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  size: number;
};

export default function LandingPage() {
  const router = useRouter();
  const { user } = useAuth();
  // Rol detectado por IP/dispositivo (best-effort): el visitante de esta
  // red corresponde a un client del mundo cuyo email coincide con un user
  // de staff. Sólo controla la visibilidad del botón; el acceso real lo
  // protege el login en /auth.
  const [ipRole, setIpRole] = useState<'admin' | 'member' | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/landing-role')
      .then((r) => (r.ok ? r.json() : { role: null }))
      .then((d) => {
        if (!cancelled && (d?.role === 'admin' || d?.role === 'member')) {
          setIpRole(d.role);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // El botón "Colaborar" usa el rol de sesión para decidir el destino:
  // staff (member/admin) va directo a /dashboard; el resto pasa por /auth.
  const sessionRole = user?.role;
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [windAway, setWindAway] = useState(false);
  const heroSectionRef = useRef<HTMLElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const cameraStateRef = useRef({
    x: 0,
    y: 0,
    viewW: 0,
    viewH: 0,
  });
  const snapCameraRef = useRef<((x: number, y: number) => void) | null>(null);
  const cornerTLRef = useRef<HTMLDivElement | null>(null);
  const cornerTRRef = useRef<HTMLDivElement | null>(null);
  const cornerBLRef = useRef<HTMLDivElement | null>(null);
  const cornerBRRef = useRef<HTMLDivElement | null>(null);
  const minimapDotRef = useRef<HTMLDivElement | null>(null);
  const coordsLabelRef = useRef<HTMLDivElement | null>(null);
  const cameraEnabledRef = useRef(false);
  const cameraLockedRef = useRef(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [worldChatVisible, setWorldChatVisible] = useState(false);
  const [worldChatTyped, setWorldChatTyped] = useState('');
  const [worldChatDone, setWorldChatDone] = useState(false);
  const [worldChatIdx, setWorldChatIdx] = useState(0);
  const [worldChatGlitch, setWorldChatGlitch] = useState(false);
  const [worldChatComplete, setWorldChatComplete] = useState(false);
  const worldChatCompleteRef = useRef(false);
  const minimapAlertRef = useRef<HTMLDivElement | null>(null);
  const [planetEntering, setPlanetEntering] = useState(false);
  const [planetExiting, setPlanetExiting] = useState(false);
  const [planetFlash, setPlanetFlash] = useState(false);
  const [paisajeVisible, setPaisajeVisible] = useState(false);
  const [warpOrigin, setWarpOrigin] = useState('50% 50%');
  const [planetSceneIdx, setPlanetSceneIdx] = useState(0);
  const [planetTextIdx, setPlanetTextIdx] = useState(0);
  const [planetTextTyped, setPlanetTextTyped] = useState('');
  const [planetTextDone, setPlanetTextDone] = useState(false);
  const [planetNarrativeReady, setPlanetNarrativeReady] = useState(false);
  const [planetQuestionVisible, setPlanetQuestionVisible] = useState(false);
  const [bulbOff, setBulbOff] = useState(false);
  const [characterCreatorVisible, setCharacterCreatorVisible] =
    useState(false);
  const [characterConfig, setCharacterConfig] =
    useState<CharacterConfig | null>(null);
  const [gameplayActive, setGameplayActive] = useState(false);
  const [savedCharacter, setSavedCharacter] =
    useState<CharacterConfig | null>(null);
  const [savedAuth, setSavedAuth] = useState<{
    hasPassword: boolean;
    emailVerified: boolean;
    approved: boolean;
    authenticated: boolean;
    pendingEmail: string | null;
    email?: string | null;
    isMember?: boolean;
    hasAccount?: boolean;
    profileCompleted?: boolean;
    profile?: { fullName: string; country: string; address: string; phone: string };
  } | null>(null);
  const savedCharacterCheckedRef = useRef(false);
  const [savedCharacterChecked, setSavedCharacterChecked] = useState(false);
  const [savePointTrigger, setSavePointTrigger] = useState(0);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [entryChoiceOpen, setEntryChoiceOpen] = useState(false);
  // Destino tras elegir/loguearse en el menú: "Entrar" → juego; "Colaborar" →
  // /dashboard. Determina a dónde van candidato/cliente/miembro al iniciar sesión.
  const [entryDestination, setEntryDestination] = useState<'game' | 'dashboard'>('game');
  const [proposalPending, setProposalPending] = useState<
    { email?: string | null; emailVerified?: boolean; approved?: boolean } | null
  >(null);
  // Candidato aprobado que va a crear su cuenta (contraseña + datos). null = cerrado.
  const [candidateAccount, setCandidateAccount] = useState<{ email?: string | null } | null>(null);
  // Cliente con cuenta creada pero correo sin verificar (no puede ingresar).
  const [clientPending, setClientPending] = useState<{ email?: string | null } | null>(null);
  const [clientSignupOpen, setClientSignupOpen] = useState(false);
  const [clientLoginOpen, setClientLoginOpen] = useState(false);
  const [memberLoginOpen, setMemberLoginOpen] = useState(false);
  // El jugador entró como miembro/admin esta sesión → el gameplay no le pide
  // el formulario "crea tu cuenta" (ya tiene cuenta en gcc_world.users).
  const [enteredAsMember, setEnteredAsMember] = useState(false);
  // Se autenticó por un modal en ESTA carga de página (login/passkey) → no se le
  // vuelve a pedir login al entrar al juego. Se reinicia al recargar (sesión
  // nueva): así "Entrar" pide loguearse una sola vez por recarga.
  const [freshAuth, setFreshAuth] = useState(false);
  // El gameplay muestra un overlay de auth (login/cuenta/passkey) → cursor normal.
  const [gameAuthOverlay, setGameAuthOverlay] = useState(false);
  const warpRef = useRef<HTMLDivElement | null>(null);
  const planetMusicRef = useRef<HTMLAudioElement | null>(null);
  const peligroMusicRef = useRef<HTMLAudioElement | null>(null);
  const planetTimeoutsRef = useRef<number[]>([]);
  const worldChatTimeoutRef = useRef<number | null>(null);
  const worldChatAdvanceRef = useRef<number | null>(null);
  const windAudioRef = useRef<HTMLAudioElement | null>(null);
  const typingAudioRef = useRef<HTMLAudioElement | null>(null);
  const distortAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const spaceFwdBufferRef = useRef<AudioBuffer | null>(null);
  const spaceRevBufferRef = useRef<AudioBuffer | null>(null);
  const spaceGainRef = useRef<GainNode | null>(null);
  const spaceLoadingRef = useRef<Promise<void> | null>(null);
  const [adminInfo, setAdminInfo] = useState<{ name: string; photoUrl: string | null } | null>(null);
  const [entryPhase, setEntryPhase] = useState<EntryPhase>('message1');
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [carouselTyped, setCarouselTyped] = useState('');
  const [carouselTypingDone, setCarouselTypingDone] = useState(false);
  const [actionsVisible] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [typingDone, setTypingDone] = useState(false);

  // Chip-capture flow
  const [activeChipIdx, setActiveChipIdx] = useState<number | null>(null);
  const [capturedIdxs, setCapturedIdxs] = useState<number[]>([]);
  const [chipMode, setChipMode] = useState<ChipMode>('hidden');
  const [chipPos, setChipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [chipOpacity, setChipOpacity] = useState(0);
  const [rapidProgress, setRapidProgress] = useState(0);
  const [rapidLevelIdx, setRapidLevelIdx] = useState(0);
  const [rapidFlashing, setRapidFlashing] = useState(false);

  // Backdrop flicker
  const [bgPhase, setBgPhase] = useState<'dark' | 'white'>('dark');
  const [bgTransitionMs, setBgTransitionMs] = useState(0);

  // Pureza second-stage choice
  const [purezaChoiceIdx, setPurezaChoiceIdx] = useState<number>(-1); // -1 = idle, 0..3 = phase
  const [purezaVioletaVisible, setPurezaVioletaVisible] = useState(false);
  const [purezaMixing, setPurezaMixing] = useState(false);
  const [purezaSecondsLeft, setPurezaSecondsLeft] = useState(0);
  const [purezaFlickerIntensity, setPurezaFlickerIntensity] = useState(0);
  const [purezaButtonsOpacity, setPurezaButtonsOpacity] = useState(0);
  const [purezaHoveredSide, setPurezaHoveredSide] = useState<'left' | 'right' | null>(null);
  // Stable random starfield generated once on mount.
  const [purezaStars] = useState<PurezaStar[]>(() => {
    const arr: PurezaStar[] = [];
    for (let i = 0; i < PUREZA_STAR_COUNT; i++) {
      arr.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 1 + Math.random() * 2.4,
        delay: Math.random() * 3,
        threshold: Math.random(),
        driftIdx: Math.floor(Math.random() * 6),
        driftDuration: 9 + Math.random() * 14, // 9..23 s
        driftDelay: Math.random() * 8,
      });
    }
    return arr;
  });
  const [purezaFlashOpacity, setPurezaFlashOpacity] = useState(0);
  const [purezaFlashTransitionMs, setPurezaFlashTransitionMs] = useState(0);
  const [purezaIsViolet, setPurezaIsViolet] = useState(false);
  const [purezaAmbasOpacity, setPurezaAmbasOpacity] = useState(0);
  const [purezaAmbasTransitionMs, setPurezaAmbasTransitionMs] = useState(0);
  const purezaAllVioletRef = useRef(true);
  const purezaTransitioningRef = useRef(false);

  // Beacon
  const [beaconPos, setBeaconPos] = useState<{ x: number; y: number } | null>(null);
  const [beaconOpacity, setBeaconOpacity] = useState(0);
  const [beaconTransitionMs, setBeaconTransitionMs] = useState(0);

  const chipPosRef = useRef(chipPos);
  chipPosRef.current = chipPos;
  const lastMouseRef = useRef<{ x: number; y: number }>({ x: -9999, y: -9999 });
  const teleportingRef = useRef(false);
  const lastEscapeAtRef = useRef<number | null>(null);
  const hasSpawnedRef = useRef(false);
  const capturingRef = useRef(false);
  const rapidClicksRef = useRef<number[]>([]);
  const initialChipPosRef = useRef<{ x: number; y: number } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Flicker refs
  const flickerStartRef = useRef<number | null>(null);
  const flickerPhaseTimeoutRef = useRef<number | null>(null);
  const flickerCompletionTimeoutRef = useRef<number | null>(null);

  // Beacon refs
  const beaconPosRef = useRef<{ x: number; y: number } | null>(null);
  const beaconLifecycleTimeoutsRef = useRef<number[]>([]);
  const beaconHoverCompleteTimeoutRef = useRef<number | null>(null);
  const beaconAwayTimeoutRef = useRef<number | null>(null);
  const beaconHoveringRef = useRef(false);
  const beaconEngagedRef = useRef(false);
  const beaconHasFledRef = useRef(false);

  // Seriedad dialog state
  const [seriedadStage, setSeriedadStage] = useState<SeriedadStage>('idle');
  const [seriedadOpacity, setSeriedadOpacity] = useState(1);
  const [seriedadTyped, setSeriedadTyped] = useState('');
  const [seriedadTypingDone, setSeriedadTypingDone] = useState(false);
  const [seriedadWhyText, setSeriedadWhyText] = useState('');
  const [seriedadFinalText, setSeriedadFinalText] = useState('');
  const [seriedadSiClicks, setSeriedadSiClicks] = useState(0);
  const [landingLocked, setLandingLocked] = useState(false);
  const [padlockShakeId, setPadlockShakeId] = useState(0);
  const seriedadTextKeyRef = useRef<string>('');

  // Spaceship (paciencia) state + refs
  const [pacienciaParticles, setPacienciaParticles] = useState<PacienciaParticle[]>([]);
  const pacienciaPhaseRef = useRef<PacienciaPhase>('flying');
  const pacienciaVelRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pacienciaPhaseStartRef = useRef<number>(0);
  const pacienciaSettleFromRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pacienciaParticlesRef = useRef<PacienciaParticle[]>([]);
  const pacienciaParticleIdRef = useRef(0);
  const pacienciaLastParticleRef = useRef(0);

  // ── Position helpers ─────────────────────────────────────────────
  const pickChipPosition = (avoidMouse: { x: number; y: number } | null) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const rect = modalRef.current?.getBoundingClientRect() ?? null;
    const maxX = Math.max(VIEWPORT_PAD + 1, w - CHIP_W - VIEWPORT_PAD);
    const maxY = Math.max(VIEWPORT_PAD + 1, h - CHIP_H - VIEWPORT_PAD);

    for (let attempt = 0; attempt < 40; attempt++) {
      const x = VIEWPORT_PAD + Math.random() * (maxX - VIEWPORT_PAD);
      const y = VIEWPORT_PAD + Math.random() * (maxY - VIEWPORT_PAD);
      const cx = x + CHIP_W / 2;
      const cy = y + CHIP_H / 2;

      if (avoidMouse) {
        const dist = Math.hypot(cx - avoidMouse.x, cy - avoidMouse.y);
        if (dist < MOUSE_AVOID_MIN_DIST) continue;
      }

      if (rect) {
        if (cy > rect.bottom) continue;
        const margin = 28;
        const overlapsModal =
          x < rect.right + margin &&
          x + CHIP_W > rect.left - margin &&
          y < rect.bottom + margin &&
          y + CHIP_H > rect.top - margin;
        if (overlapsModal) continue;
      }

      return { x, y };
    }

    return { x: maxX, y: VIEWPORT_PAD };
  };

  const pickInitialAbovePosition = () => {
    const w = window.innerWidth;
    const rect = modalRef.current?.getBoundingClientRect() ?? null;
    const x = Math.max(VIEWPORT_PAD, (w - CHIP_W) / 2);
    const stripTop = VIEWPORT_PAD;
    const stripBottom = rect
      ? Math.max(VIEWPORT_PAD, rect.top - 12 - CHIP_H)
      : VIEWPORT_PAD + 60;
    const y = Math.round((stripTop + stripBottom) / 2);
    return { x, y };
  };

  // Beacon dot lives strictly to the LEFT or RIGHT of the modal panel
  // (never above, never below). Returns center coords.
  const pickBeaconPosition = (avoidPrev: { x: number; y: number } | null) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const rect = modalRef.current?.getBoundingClientRect();
    const sideMargin = 30;
    const padInside = 24;

    const fallback = () => {
      const x = w - VIEWPORT_PAD - BEACON_DOT_SIZE;
      const y = h / 2;
      return { x, y };
    };

    if (!rect) return fallback();

    const yMin = rect.top + padInside;
    const yMax = rect.bottom - padInside;
    if (yMax <= yMin) return fallback();

    const leftOuter = rect.left - sideMargin;
    const leftInner = VIEWPORT_PAD + BEACON_DOT_SIZE;
    const rightOuter = w - VIEWPORT_PAD - BEACON_DOT_SIZE;
    const rightInner = rect.right + sideMargin;

    const leftAvailable = leftOuter > leftInner;
    const rightAvailable = rightOuter > rightInner;
    if (!leftAvailable && !rightAvailable) return fallback();

    for (let attempt = 0; attempt < 30; attempt++) {
      let useLeft: boolean;
      if (leftAvailable && rightAvailable) useLeft = Math.random() < 0.5;
      else useLeft = leftAvailable;

      const x = useLeft
        ? leftInner + Math.random() * (leftOuter - leftInner)
        : rightInner + Math.random() * (rightOuter - rightInner);
      const y = yMin + Math.random() * (yMax - yMin);

      if (avoidPrev) {
        const dist = Math.hypot(x - avoidPrev.x, y - avoidPrev.y);
        if (dist < BEACON_MIN_SEPARATION) continue;
      }
      return { x, y };
    }
    return fallback();
  };

  // ── Spawn chip[idx] ──────────────────────────────────────────────
  const spawnChip = (
    idx: number,
    forcePos?: { x: number; y: number }
  ) => {
    const chip = VALUE_CHIPS[idx];
    let pos: { x: number; y: number };
    const reusesInitial =
      chip.challenge === 'rapid' ||
      chip.challenge === 'flicker' ||
      chip.challenge === 'beacon' ||
      chip.challenge === 'spaceship' ||
      chip.challenge === 'serious';

    if (forcePos) {
      pos = forcePos;
      initialChipPosRef.current = forcePos;
    } else if (reusesInitial && initialChipPosRef.current) {
      pos = initialChipPosRef.current;
    } else if (initialChipPosRef.current === null) {
      pos = pickInitialAbovePosition();
      initialChipPosRef.current = pos;
    } else {
      pos = pickChipPosition(null);
    }

    chipPosRef.current = pos;
    setChipPos(pos);
    setChipOpacity(0);
    rapidClicksRef.current = [];
    setRapidProgress(0);
    setRapidLevelIdx(0);
    setRapidFlashing(false);
    teleportingRef.current = false;
    setActiveChipIdx(idx);

    if (chip.challenge === 'flee') {
      setChipMode('roaming');
    } else if (chip.challenge === 'rapid') {
      setChipMode('rapid');
    } else if (chip.challenge === 'flicker') {
      setChipMode('flicker');
    } else if (chip.challenge === 'beacon') {
      setChipMode('beacon');
    } else if (chip.challenge === 'spaceship') {
      setChipMode('spaceship');
    } else {
      setChipMode('serious');
    }

    // Hidden challenges (flicker, beacon) keep chip invisible until they
    // complete; the others fade the chip in immediately.
    if (
      chip.challenge === 'flee' ||
      chip.challenge === 'rapid' ||
      chip.challenge === 'spaceship' ||
      chip.challenge === 'serious'
    ) {
      requestAnimationFrame(() => setChipOpacity(1));
      window.setTimeout(() => setChipOpacity(1), 80);
    }
  };

  // ── Ambient audio — wind before Entrar, space (fwd↔rev) after ───
  useEffect(() => {
    const wind = windAudioRef.current;
    if (!wind) return;

    const WIND_VOL = 0.45;
    const SPACE_VOL = 0.5;
    const FADE_MS = 1200;
    const SPACE_URL =
      '/sounds/music/Efecto%20de%20sonido%20ambiente%20espacio%2001.mp3';

    const fadeHtml = (
      audio: HTMLAudioElement,
      from: number,
      to: number,
      onDone?: () => void,
    ) => {
      const startTime = performance.now();
      let rafId = 0;
      const step = (t: number) => {
        const k = Math.min(1, (t - startTime) / FADE_MS);
        audio.volume = Math.max(0, Math.min(1, from + (to - from) * k));
        if (k < 1) rafId = requestAnimationFrame(step);
        else onDone?.();
      };
      rafId = requestAnimationFrame(step);
      return () => cancelAnimationFrame(rafId);
    };

    if (windAway) {
      const cancelWindFade = fadeHtml(wind, wind.volume, 0, () => {
        wind.pause();
        wind.currentTime = 0;
      });

      let stopped = false;
      let timeoutId = 0;
      const liveSources: AudioBufferSourceNode[] = [];

      const ensureBuffers = async (): Promise<void> => {
        if (spaceFwdBufferRef.current && spaceRevBufferRef.current) return;
        if (spaceLoadingRef.current) return spaceLoadingRef.current;
        const ctx = audioCtxRef.current;
        if (!ctx) return;
        spaceLoadingRef.current = (async () => {
          const res = await fetch(SPACE_URL);
          const arr = await res.arrayBuffer();
          const buf = await ctx.decodeAudioData(arr);
          spaceFwdBufferRef.current = buf;
          const rev = ctx.createBuffer(
            buf.numberOfChannels,
            buf.length,
            buf.sampleRate,
          );
          for (let ch = 0; ch < buf.numberOfChannels; ch++) {
            const src = buf.getChannelData(ch);
            const dst = rev.getChannelData(ch);
            for (let i = 0; i < buf.length; i++) {
              dst[i] = src[buf.length - 1 - i];
            }
          }
          spaceRevBufferRef.current = rev;
        })();
        return spaceLoadingRef.current;
      };

      (async () => {
        try {
          if (!audioCtxRef.current) {
            const Ctor =
              window.AudioContext ||
              (window as unknown as { webkitAudioContext?: typeof AudioContext })
                .webkitAudioContext;
            if (!Ctor) return;
            audioCtxRef.current = new Ctor();
          }
          const ctx = audioCtxRef.current;
          if (ctx.state === 'suspended') await ctx.resume();
          await ensureBuffers();
          if (stopped) return;
          const fwd = spaceFwdBufferRef.current;
          const rev = spaceRevBufferRef.current;
          if (!fwd || !rev) return;

          if (!spaceGainRef.current) {
            spaceGainRef.current = ctx.createGain();
            spaceGainRef.current.connect(ctx.destination);
          }
          const gain = spaceGainRef.current;
          const now = ctx.currentTime;
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(SPACE_VOL, now + FADE_MS / 1000);

          let isReverse = false;
          let nextStart = ctx.currentTime + 0.05;

          const queueOne = () => {
            if (stopped) return;
            const buf = isReverse ? rev : fwd;
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.connect(gain);
            src.start(nextStart);
            liveSources.push(src);
            const startedAt = nextStart;
            const dur = buf.duration;
            nextStart += dur;
            isReverse = !isReverse;
            // Queue the next chunk shortly before this one ends — gapless.
            const lookAhead = 0.3;
            const delayMs = Math.max(
              0,
              (startedAt + dur - lookAhead - ctx.currentTime) * 1000,
            );
            timeoutId = window.setTimeout(queueOne, delayMs);
            src.onended = () => {
              const idx = liveSources.indexOf(src);
              if (idx >= 0) liveSources.splice(idx, 1);
            };
          };

          queueOne();
        } catch {
          // Ignore decode/network errors — leave wind silenced quietly.
        }
      })();

      return () => {
        stopped = true;
        if (timeoutId) clearTimeout(timeoutId);
        cancelWindFade();
        const ctx = audioCtxRef.current;
        const gain = spaceGainRef.current;
        if (ctx && gain) {
          const now = ctx.currentTime;
          const fadeOut = 0.5;
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(gain.gain.value, now);
          gain.gain.linearRampToValueAtTime(0, now + fadeOut);
          window.setTimeout(() => {
            for (const s of liveSources) {
              try {
                s.stop();
              } catch {
                /* noop */
              }
            }
            liveSources.length = 0;
          }, fadeOut * 1000 + 50);
        }
      };
    }

    wind.volume = WIND_VOL;
    wind.loop = true;
    wind.muted = false;

    let started = false;
    const tryStart = () => {
      if (started) return;
      if (!wind.paused) {
        started = true;
        teardown();
        return;
      }
      const p = wind.play();
      if (p && typeof p.then === 'function') {
        p.then(
          () => {
            started = true;
            teardown();
          },
          () => undefined,
        );
      }
    };
    const teardown = () => {
      window.removeEventListener('pointerdown', tryStart);
      window.removeEventListener('pointermove', tryStart);
      window.removeEventListener('keydown', tryStart);
      window.removeEventListener('touchstart', tryStart);
      window.removeEventListener('wheel', tryStart);
      window.removeEventListener('click', tryStart);
      window.removeEventListener('scroll', tryStart);
    };

    window.addEventListener('pointerdown', tryStart);
    window.addEventListener('pointermove', tryStart);
    window.addEventListener('keydown', tryStart);
    window.addEventListener('touchstart', tryStart);
    window.addEventListener('wheel', tryStart);
    window.addEventListener('click', tryStart);
    window.addEventListener('scroll', tryStart);

    tryStart();

    return teardown;
  }, [windAway]);

  // ── Planet entry — crossfade space ambient → planet music ────────
  useEffect(() => {
    if (!planetEntering) return;

    const ctx = audioCtxRef.current;
    const gain = spaceGainRef.current;
    if (ctx && gain) {
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + 1.6);
    }

    const audio = planetMusicRef.current;
    let rafId = 0;
    if (audio) {
      audio.loop = true;
      audio.volume = 0;
      const TARGET = 0.55;
      const FADE_MS = 2200;
      audio.play().catch(() => undefined);
      const start = performance.now();
      const step = (t: number) => {
        const k = Math.max(0, Math.min(1, (t - start) / FADE_MS));
        audio.volume = Math.max(0, Math.min(1, TARGET * k));
        if (k < 1) rafId = requestAnimationFrame(step);
      };
      rafId = requestAnimationFrame(step);
    }
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [planetEntering]);

  // ── Reset planet narrative when entering / leaving the landscape ─
  useEffect(() => {
    if (paisajeVisible) {
      setPlanetSceneIdx(0);
      setPlanetTextIdx(0);
    } else {
      setPlanetTextTyped('');
      setPlanetTextDone(false);
      setPlanetNarrativeReady(false);
      setPlanetQuestionVisible(false);
    }
  }, [paisajeVisible]);

  // ── Planet narrative typewriter — uses the same typing audio ─────
  useEffect(() => {
    if (!paisajeVisible || !planetNarrativeReady) return;
    const scene = PLANET_SCENES[planetSceneIdx];
    if (!scene) return;
    const text = scene.texts[planetTextIdx];
    if (!text) return;
    setPlanetTextTyped('');
    setPlanetTextDone(false);

    const typingAudio = typingAudioRef.current;
    const stopTyping = () => {
      if (!typingAudio) return;
      typingAudio.pause();
      typingAudio.currentTime = 0;
    };
    if (typingAudio) {
      typingAudio.loop = true;
      typingAudio.volume = 0.55;
      typingAudio.currentTime = 0;
      typingAudio.play().catch(() => undefined);
    }

    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setPlanetTextTyped(text.slice(0, i));
      if (i >= text.length) {
        window.clearInterval(id);
        stopTyping();
        setPlanetTextDone(true);
      }
    }, TYPING_SPEED_MS);

    return () => {
      window.clearInterval(id);
      stopTyping();
    };
  }, [paisajeVisible, planetSceneIdx, planetTextIdx, planetNarrativeReady]);

  // ── Crossfade music when planet scene changes ───────────────────
  useEffect(() => {
    if (!paisajeVisible) return;
    const targetKey = PLANET_SCENES[planetSceneIdx].musicRefKey;
    const targetAudio =
      targetKey === 'planet'
        ? planetMusicRef.current
        : peligroMusicRef.current;
    const otherAudio =
      targetKey === 'planet'
        ? peligroMusicRef.current
        : planetMusicRef.current;
    if (!targetAudio) return;

    const TARGET_VOL = 0.55;
    const FADE_MS = 1800;

    const fade = (
      audio: HTMLAudioElement,
      from: number,
      to: number,
      onDone?: () => void,
    ) => {
      const start = performance.now();
      let raf = 0;
      const step = (t: number) => {
        const k = Math.max(0, Math.min(1, (t - start) / FADE_MS));
        audio.volume = Math.max(0, Math.min(1, from + (to - from) * k));
        if (k < 1) raf = requestAnimationFrame(step);
        else onDone?.();
      };
      raf = requestAnimationFrame(step);
      return () => cancelAnimationFrame(raf);
    };

    targetAudio.loop = true;
    if (targetAudio.paused) {
      targetAudio.volume = 0;
      targetAudio.currentTime = 0;
      targetAudio.play().catch(() => undefined);
    }
    const cancelIn = fade(targetAudio, targetAudio.volume, TARGET_VOL);
    let cancelOut: (() => void) | undefined;
    if (otherAudio && !otherAudio.paused) {
      cancelOut = fade(otherAudio, otherAudio.volume, 0, () => {
        otherAudio.pause();
        otherAudio.currentTime = 0;
      });
    }
    return () => {
      cancelIn();
      cancelOut?.();
    };
  }, [paisajeVisible, planetSceneIdx]);

  // ── Mirror worldChatComplete to a ref so the camera RAF can read it
  useEffect(() => {
    worldChatCompleteRef.current = worldChatComplete;
  }, [worldChatComplete]);

  // ── Planet exit — fade space ambient back in, fade music out ─────
  useEffect(() => {
    if (!planetExiting) return;

    const ctx = audioCtxRef.current;
    const gain = spaceGainRef.current;
    if (ctx && gain) {
      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0.5, now + 1.6);
    }

    const FADE_MS = 1500;
    const fadeOut = (audio: HTMLAudioElement | null) => {
      if (!audio || audio.paused) return null;
      const startVol = audio.volume;
      const start = performance.now();
      let raf = 0;
      const step = (t: number) => {
        const k = Math.max(0, Math.min(1, (t - start) / FADE_MS));
        audio.volume = Math.max(0, Math.min(1, startVol * (1 - k)));
        if (k < 1) raf = requestAnimationFrame(step);
        else {
          audio.pause();
          audio.currentTime = 0;
        }
      };
      raf = requestAnimationFrame(step);
      return () => cancelAnimationFrame(raf);
    };
    const cancelPlanet = fadeOut(planetMusicRef.current);
    const cancelPeligro = fadeOut(peligroMusicRef.current);
    return () => {
      cancelPlanet?.();
      cancelPeligro?.();
    };
  }, [planetExiting]);

  // ── Saved-character recognition ───────────────────────────────────
  // The initial /me check on mount can fail silently — flaky network,
  // a cookie that hasn't propagated yet, server cold-start. When that
  // happens the user gets pushed into the "create new account" flow
  // even though they already have one. To recover, we expose a
  // refresh helper and re-run it at several decision points: right
  // after the entry dialogue ends, when the tab regains focus, when
  // the network reports back online, and one last time before the
  // creator opens.
  const savedCharacterRef = useRef<CharacterConfig | null>(null);
  useEffect(() => {
    savedCharacterRef.current = savedCharacter;
  }, [savedCharacter]);
  // Auth fresca para gatear la entrada al juego de forma síncrona tras refrescar.
  const savedAuthRef = useRef<{
    emailVerified: boolean;
    approved: boolean;
    pendingEmail: string | null;
  } | null>(null);
  // Regla: solo se entra al juego con cuenta APROBADA por el admin global y
  // correo VERIFICADO. Si no, se muestra el modal de espera.
  const gateGameEntry = useCallback((): boolean => {
    const a = savedAuthRef.current;
    if (a && (!a.approved || !a.emailVerified)) {
      setProposalPending({ email: a.pendingEmail, emailVerified: a.emailVerified });
      return false;
    }
    return true;
  }, []);

  const refreshSavedCharacter =
    useCallback(async (): Promise<CharacterConfig | null> => {
      try {
        const r = await fetch('/api/character/me', { cache: 'no-store' });
        const j = await r.json();
        if (j?.exists && j.characterData) {
          const cfg = j.characterData as CharacterConfig;
          setSavedCharacter(cfg);
          savedAuthRef.current = {
            emailVerified: !!j.emailVerified,
            approved: !!j.approved,
            pendingEmail: j.pendingEmail ?? null,
          };
          setSavedAuth({
            hasPassword: !!j.hasPassword,
            emailVerified: !!j.emailVerified,
            approved: !!j.approved,
            authenticated: !!j.authenticated,
            pendingEmail: j.pendingEmail ?? null,
            email: j.email ?? null,
            isMember: !!j.isMember,
            hasAccount: !!j.hasAccount,
            profileCompleted: !!j.profileCompleted,
            profile: j.profile ?? undefined,
          });
          return cfg;
        }
      } catch {
        /* swallow — another re-check moment will try again */
      }
      return null;
    }, []);

  // Skip / dismiss the intro and jump straight into gameplay as a
  // returning player. Mirrors the timing of the original Entrar
  // returning-player branch (wind fades, bulb dims, then mount).
  const enterAsReturning = useCallback((cfg: CharacterConfig) => {
    setCharacterCreatorVisible(false);
    setPlanetQuestionVisible(false);
    setCharacterConfig(cfg);
    const stop = (audio: HTMLAudioElement | null) => {
      if (!audio || audio.paused) return;
      audio.pause();
      audio.currentTime = 0;
    };
    window.setTimeout(() => {
      stop(windAudioRef.current);
      stop(planetMusicRef.current);
      stop(peligroMusicRef.current);
      setBulbOff(true);
    }, 1100);
    window.setTimeout(() => {
      setGameplayActive(true);
    }, 2200);
  }, []);

  // ── On mount: detect returning player by cookie / IP ─────────────
  useEffect(() => {
    if (savedCharacterCheckedRef.current) return;
    savedCharacterCheckedRef.current = true;
    refreshSavedCharacter().finally(() => setSavedCharacterChecked(true));
  }, [refreshSavedCharacter]);

  // Tras "Cambiar tipo de ingreso" (recarga): reabre el menú de opciones con el
  // destino que tenía (juego/dashboard).
  useEffect(() => {
    try {
      const d = window.sessionStorage.getItem('gcc_entry_choice');
      if (d) {
        window.sessionStorage.removeItem('gcc_entry_choice');
        setEntryDestination(d === 'dashboard' ? 'dashboard' : 'game');
        setEntryChoiceOpen(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Enlace directo desde /marketplace-publico: abre el modal "Ingresar como
  // cliente" (con opción de crear cuenta) y, al loguearse, va al marketplace del
  // dashboard. Limpia el query param para no reabrirlo en refrescos.
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get('acceso') === 'cliente') {
        setEntryDestination('dashboard');
        setClientLoginOpen(true);
        p.delete('acceso');
        const qs = p.toString();
        window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
      }
    } catch {
      /* ignore */
    }
  }, []);

  // If a saved character is discovered AFTER the user pressed Entrar
  // (windAway = true) and gameplay hasn't mounted yet, dismiss any
  // intro screens and enter as returning. Covers every refresh path.
  useEffect(() => {
    if (!savedCharacter || !windAway || gameplayActive) return;
    if (!gateGameEntry()) {
      // No aprobado / sin verificar: vuelve la landing y muestra el modal.
      setWindAway(false);
      return;
    }
    enterAsReturning(savedCharacter);
  }, [savedCharacter, windAway, gameplayActive, enterAsReturning, gateGameEntry]);

  // Re-validate when the user becomes interactable with the page again
  // (tab focus, network online). Cheap and idempotent — the effect bails
  // out as soon as the saved character is known or gameplay has started.
  useEffect(() => {
    if (savedCharacter || gameplayActive || !windAway) return;
    const check = () => {
      refreshSavedCharacter();
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') check();
    };
    window.addEventListener('online', check);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('online', check);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [savedCharacter, gameplayActive, windAway, refreshSavedCharacter]);

  // After the entry dialogue finishes ("Bien, te pondré a prueba…"),
  // re-check before letting the user touch the planet / creator. This
  // is the explicit moment requested when the initial check missed.
  useEffect(() => {
    if (!worldChatComplete || savedCharacter || gameplayActive) return;
    refreshSavedCharacter();
  }, [worldChatComplete, savedCharacter, gameplayActive, refreshSavedCharacter]);

  // ── Always-on cursor tracker ─────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      lastMouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // ── Hero "camera" — pannable 5x world + minimap ──────────────────
  // The hero section is the camera viewport; the world inside is 5x
  // larger. Cursor position drives velocity (with a dead zone), so the
  // user pans by pointing toward the edges. Camera clamps at world
  // bounds. Corner brackets do a subtle parallax tilt; the minimap
  // dot mirrors the camera position.
  useEffect(() => {
    const WORLD_SCALE = 5;
    const DEAD_ZONE = 0.2;
    const MAX_SPEED = 9;
    const ACCEL = 0.1;
    const RECENTER = 0.06;
    const CORNER_PARALLAX = 10;
    const MINIMAP_W = 120;
    const MINIMAP_H = 90;
    const MINIMAP_DOT = 8;

    let cameraX = 0;
    let cameraY = 0;
    let velX = 0;
    let velY = 0;
    let cursorX = -1;
    let cursorY = -1;
    let viewW = 0;
    let viewH = 0;
    let maxX = 0;
    let maxY = 0;
    let rafId = 0;

    const measure = () => {
      const section = heroSectionRef.current;
      if (!section) return;
      viewW = section.offsetWidth;
      viewH = section.offsetHeight;
      const worldW = viewW * WORLD_SCALE;
      const worldH = viewH * WORLD_SCALE;
      maxX = (worldW - viewW) / 2;
      maxY = (worldH - viewH) / 2;
      if (worldRef.current) {
        worldRef.current.style.width = `${worldW}px`;
        worldRef.current.style.height = `${worldH}px`;
        worldRef.current.style.left = `${-maxX}px`;
        worldRef.current.style.top = `${-maxY}px`;
        worldRef.current.style.setProperty('--world-w', `${worldW}px`);
        worldRef.current.style.setProperty('--world-h', `${worldH}px`);
      }
    };

    const dz = (n: number) => {
      const a = Math.abs(n);
      if (a < DEAD_ZONE) return 0;
      return Math.sign(n) * Math.min(1, (a - DEAD_ZONE) / (1 - DEAD_ZONE));
    };

    const tick = () => {
      const enabled = cameraEnabledRef.current;
      const locked = cameraLockedRef.current;
      if (locked) {
        velX = 0;
        velY = 0;
      } else if (!enabled) {
        cameraX += (0 - cameraX) * RECENTER;
        cameraY += (0 - cameraY) * RECENTER;
        velX = 0;
        velY = 0;
      } else if (viewW > 0 && cursorX >= 0) {
        const nx = (cursorX - viewW / 2) / (viewW / 2);
        const ny = (cursorY - viewH / 2) / (viewH / 2);
        const tvx = dz(nx) * MAX_SPEED;
        const tvy = dz(ny) * MAX_SPEED;
        velX += (tvx - velX) * ACCEL;
        velY += (tvy - velY) * ACCEL;
        cameraX = Math.max(-maxX, Math.min(maxX, cameraX + velX));
        cameraY = Math.max(-maxY, Math.min(maxY, cameraY + velY));
        if (!worldChatCompleteRef.current) {
          const RESTRICT_RADIUS = 220;
          const dist = Math.hypot(cameraX, cameraY);
          if (dist > RESTRICT_RADIUS) {
            cameraX = (cameraX / dist) * RESTRICT_RADIUS;
            cameraY = (cameraY / dist) * RESTRICT_RADIUS;
            velX = 0;
            velY = 0;
          }
        }
      }

      if (worldRef.current) {
        worldRef.current.style.transform = `translate3d(${(-cameraX).toFixed(2)}px, ${(-cameraY).toFixed(2)}px, 0)`;
      }
      cameraStateRef.current.x = cameraX;
      cameraStateRef.current.y = cameraY;
      cameraStateRef.current.viewW = viewW;
      cameraStateRef.current.viewH = viewH;

      const corners: Array<[
        React.RefObject<HTMLDivElement | null>,
        number,
        number,
      ]> = [
        [cornerTLRef, 1, 1],
        [cornerTRRef, -1, 1],
        [cornerBLRef, 1, -1],
        [cornerBRRef, -1, -1],
      ];
      if (enabled && !locked && viewW > 0 && cursorX >= 0) {
        const cnx = Math.max(
          -1,
          Math.min(1, (cursorX - viewW / 2) / (viewW / 2)),
        );
        const cny = Math.max(
          -1,
          Math.min(1, (cursorY - viewH / 2) / (viewH / 2)),
        );
        for (const [ref, sx, sy] of corners) {
          if (ref.current) {
            ref.current.style.transform = `translate3d(${(cnx * CORNER_PARALLAX * sx).toFixed(2)}px, ${(cny * CORNER_PARALLAX * sy).toFixed(2)}px, 0)`;
          }
        }
      } else {
        for (const [ref] of corners) {
          if (ref.current) ref.current.style.transform = 'translate3d(0,0,0)';
        }
      }

      if (minimapDotRef.current && maxX > 0 && maxY > 0) {
        const px =
          ((cameraX + maxX) / (2 * maxX)) * (MINIMAP_W - MINIMAP_DOT);
        const py =
          ((cameraY + maxY) / (2 * maxY)) * (MINIMAP_H - MINIMAP_DOT);
        minimapDotRef.current.style.transform = `translate3d(${px.toFixed(2)}px, ${py.toFixed(2)}px, 0)`;
      }

      if (minimapAlertRef.current && maxX > 0 && maxY > 0) {
        const ALERT_SIZE = 10;
        const targetX = 2255;
        const targetY = -1457; // user Y is inverted (up = positive)
        const ax =
          ((targetX + maxX) / (2 * maxX)) * (MINIMAP_W - ALERT_SIZE);
        const ay =
          ((targetY + maxY) / (2 * maxY)) * (MINIMAP_H - ALERT_SIZE);
        minimapAlertRef.current.style.transform = `translate3d(${ax.toFixed(2)}px, ${ay.toFixed(2)}px, 0)`;
      }

      if (coordsLabelRef.current && viewW > 0 && cursorX >= 0) {
        const wx = Math.round(cameraX + (cursorX - viewW / 2));
        const wy = Math.round(-(cameraY + (cursorY - viewH / 2)));
        coordsLabelRef.current.textContent = `X ${wx >= 0 ? '+' : ''}${wx}   Y ${wy >= 0 ? '+' : ''}${wy}`;
      }

      rafId = requestAnimationFrame(tick);
    };

    const handleMove = (e: MouseEvent) => {
      const section = heroSectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      cursorX = e.clientX - rect.left;
      cursorY = e.clientY - rect.top;
    };
    const handleLeave = () => {
      cursorX = -1;
      cursorY = -1;
    };

    snapCameraRef.current = (x: number, y: number) => {
      cameraX = x;
      cameraY = y;
      velX = 0;
      velY = 0;
      cameraStateRef.current.x = cameraX;
      cameraStateRef.current.y = cameraY;
      if (worldRef.current) {
        worldRef.current.style.transform = `translate3d(${(-cameraX).toFixed(2)}px, ${(-cameraY).toFixed(2)}px, 0)`;
      }
    };

    measure();
    window.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseleave', handleLeave);
    window.addEventListener('resize', measure);
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseleave', handleLeave);
      window.removeEventListener('resize', measure);
      snapCameraRef.current = null;
    };
  }, []);

  // ── Fetch the global admin's avatar/handle ───────────────────────
  useEffect(() => {
    if (adminInfo) return;
    if (!showEntryModal && !windAway) return;
    let cancelled = false;
    fetch('/api/auth/admin-public')
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setAdminInfo({
          name: typeof j?.name === 'string' && j.name ? j.name : 'lfgonzalezm0',
          photoUrl: typeof j?.photoUrl === 'string' ? j.photoUrl : null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setAdminInfo({ name: 'lfgonzalezm0', photoUrl: null });
      });
    return () => {
      cancelled = true;
    };
  }, [showEntryModal, windAway, adminInfo]);

  // ── World chat typewriter — auto-advances through ENTRY_MESSAGES ─
  useEffect(() => {
    if (!worldChatVisible) return;
    if (worldChatIdx >= ENTRY_MESSAGES.length) return;
    const text = ENTRY_MESSAGES[worldChatIdx];
    const isGlitchMsg = text === 'Cambiará tu vida';
    const GLITCH_TYPE_LEN = 6;
    const GLITCH_DURATION_MS = 2000;
    const GLITCH_CHARS = '#@$%&*?!~+=<>{}[]/\\|01';

    setWorldChatTyped('');
    setWorldChatDone(false);
    setWorldChatGlitch(false);

    const typingAudio = typingAudioRef.current;
    const distortAudio = distortAudioRef.current;
    const stopTyping = () => {
      if (!typingAudio) return;
      typingAudio.pause();
      typingAudio.currentTime = 0;
    };
    const stopDistort = () => {
      if (!distortAudio) return;
      distortAudio.pause();
      distortAudio.currentTime = 0;
    };

    if (typingAudio) {
      typingAudio.loop = true;
      typingAudio.volume = 0.55;
      typingAudio.currentTime = 0;
      typingAudio.play().catch(() => undefined);
    }

    let glitchInterval = 0;
    let advanceTimeout = 0;

    const triggerGlitch = () => {
      stopTyping();
      setWorldChatGlitch(true);
      if (distortAudio) {
        distortAudio.volume = 0.6;
        distortAudio.currentTime = 0;
        distortAudio.play().catch(() => undefined);
      }
      const len = text.length;
      const randomize = () => {
        let out = '';
        for (let j = 0; j < len; j++) {
          if (text[j] === ' ' && Math.random() < 0.5) {
            out += ' ';
          } else {
            out +=
              GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];
          }
        }
        setWorldChatTyped(out);
      };
      randomize();
      glitchInterval = window.setInterval(randomize, 70);
      advanceTimeout = window.setTimeout(() => {
        window.clearInterval(glitchInterval);
        glitchInterval = 0;
        stopDistort();
        setWorldChatDone(true);
        if (worldChatAdvanceRef.current) {
          window.clearTimeout(worldChatAdvanceRef.current);
        }
        const isLast = worldChatIdx >= ENTRY_MESSAGES.length - 1;
        worldChatAdvanceRef.current = window.setTimeout(() => {
          if (isLast) {
            setWorldChatComplete(true);
          } else {
            setWorldChatIdx((n) => n + 1);
          }
          worldChatAdvanceRef.current = null;
        }, 3500);
      }, GLITCH_DURATION_MS);
    };

    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setWorldChatTyped(text.slice(0, i));
      if (isGlitchMsg && i >= GLITCH_TYPE_LEN && i < text.length) {
        window.clearInterval(id);
        triggerGlitch();
        return;
      }
      if (i >= text.length) {
        window.clearInterval(id);
        stopTyping();
        setWorldChatDone(true);
        if (worldChatAdvanceRef.current) {
          window.clearTimeout(worldChatAdvanceRef.current);
        }
        const isLast = worldChatIdx >= ENTRY_MESSAGES.length - 1;
        worldChatAdvanceRef.current = window.setTimeout(() => {
          if (isLast) {
            setWorldChatComplete(true);
          } else {
            setWorldChatIdx((n) => n + 1);
          }
          worldChatAdvanceRef.current = null;
        }, 3500);
      }
    }, TYPING_SPEED_MS);

    return () => {
      window.clearInterval(id);
      if (glitchInterval) window.clearInterval(glitchInterval);
      if (advanceTimeout) window.clearTimeout(advanceTimeout);
      stopTyping();
      stopDistort();
    };
  }, [worldChatVisible, worldChatIdx]);

  // ── Typewriter effect ────────────────────────────────────────────
  useEffect(() => {
    if (!showEntryModal) {
      setTypedText('');
      setTypingDone(false);
      return;
    }
    if (
      entryPhase !== 'message1' &&
      entryPhase !== 'message2' &&
      entryPhase !== 'preChallenge'
    )
      return;
    const text =
      entryPhase === 'message1'
        ? ENTRY_MESSAGES[0]
        : entryPhase === 'message2'
          ? ENTRY_MESSAGES[1]
          : ENTRY_MESSAGES[2];
    setTypedText('');
    setTypingDone(false);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTypedText(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        setTypingDone(true);
      }
    }, TYPING_SPEED_MS);
    return () => clearInterval(id);
  }, [showEntryModal, entryPhase]);

  // ── Reset chip flow when modal closes ────────────────────────────
  useEffect(() => {
    if (showEntryModal) return;
    setWindAway(false);
    cameraEnabledRef.current = false;
    setCameraEnabled(false);
    if (worldChatTimeoutRef.current) {
      window.clearTimeout(worldChatTimeoutRef.current);
      worldChatTimeoutRef.current = null;
    }
    if (worldChatAdvanceRef.current) {
      window.clearTimeout(worldChatAdvanceRef.current);
      worldChatAdvanceRef.current = null;
    }
    setWorldChatVisible(false);
    setWorldChatTyped('');
    setWorldChatDone(false);
    setWorldChatIdx(0);
    setWorldChatGlitch(false);
    setWorldChatComplete(false);
    for (const id of planetTimeoutsRef.current) {
      window.clearTimeout(id);
    }
    planetTimeoutsRef.current = [];
    setPlanetEntering(false);
    setPlanetExiting(false);
    setPlanetFlash(false);
    setPaisajeVisible(false);
    setWarpOrigin('50% 50%');
    setPlanetSceneIdx(0);
    setPlanetTextIdx(0);
    setPlanetTextTyped('');
    setPlanetTextDone(false);
    setPlanetNarrativeReady(false);
    setPlanetQuestionVisible(false);
    cameraLockedRef.current = false;
    setActiveChipIdx(null);
    setCapturedIdxs([]);
    setChipMode('hidden');
    setChipOpacity(0);
    setRapidProgress(0);
    setRapidLevelIdx(0);
    setRapidFlashing(false);
    lastEscapeAtRef.current = null;
    setBgPhase('dark');
    setBgTransitionMs(0);
    setBeaconPos(null);
    setBeaconOpacity(0);
    setBeaconTransitionMs(0);
    teleportingRef.current = false;
    hasSpawnedRef.current = false;
    capturingRef.current = false;
    rapidClicksRef.current = [];
    initialChipPosRef.current = null;
    flickerStartRef.current = null;
    if (flickerPhaseTimeoutRef.current !== null) {
      clearTimeout(flickerPhaseTimeoutRef.current);
      flickerPhaseTimeoutRef.current = null;
    }
    if (flickerCompletionTimeoutRef.current !== null) {
      clearTimeout(flickerCompletionTimeoutRef.current);
      flickerCompletionTimeoutRef.current = null;
    }
    beaconPosRef.current = null;
    beaconHoveringRef.current = false;
    beaconEngagedRef.current = false;
    beaconHasFledRef.current = false;
    beaconLifecycleTimeoutsRef.current.forEach((t) => clearTimeout(t));
    beaconLifecycleTimeoutsRef.current = [];
    pacienciaParticlesRef.current = [];
    pacienciaVelRef.current = { x: 0, y: 0 };
    pacienciaPhaseRef.current = 'flying';
    setPacienciaParticles([]);
    setSeriedadStage('idle');
    setSeriedadOpacity(1);
    setSeriedadTyped('');
    setSeriedadTypingDone(false);
    setSeriedadWhyText('');
    setSeriedadFinalText('');
    setSeriedadSiClicks(0);
    setPurezaChoiceIdx(-1);
    setPurezaVioletaVisible(false);
    setPurezaMixing(false);
    setPurezaSecondsLeft(0);
    setPurezaFlickerIntensity(0);
    setPurezaButtonsOpacity(0);
    setPurezaHoveredSide(null);
    setEntryPhase('message1');
    setCarouselIdx(0);
    setCarouselTyped('');
    setCarouselTypingDone(false);
    setPurezaFlashOpacity(0);
    setPurezaFlashTransitionMs(0);
    setPurezaIsViolet(false);
    setPurezaAmbasOpacity(0);
    setPurezaAmbasTransitionMs(0);
    purezaAllVioletRef.current = true;
    purezaTransitioningRef.current = false;
    if (beaconHoverCompleteTimeoutRef.current !== null) {
      clearTimeout(beaconHoverCompleteTimeoutRef.current);
      beaconHoverCompleteTimeoutRef.current = null;
    }
    if (beaconAwayTimeoutRef.current !== null) {
      clearTimeout(beaconAwayTimeoutRef.current);
      beaconAwayTimeoutRef.current = null;
    }
  }, [showEntryModal]);

  // (Auto-spawn of the first chip on typing completion has been removed —
  //  the user now advances through entry messages manually and decides
  //  later when to engage with the floating values.)

  // ── Carousel typewriter — re-runs on every value change ──────────
  useEffect(() => {
    if (entryPhase !== 'floatingChips') {
      setCarouselTyped('');
      setCarouselTypingDone(false);
      return;
    }
    const text = VALUE_CHIPS[carouselIdx].description;
    setCarouselTyped('');
    setCarouselTypingDone(false);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setCarouselTyped(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        setCarouselTypingDone(true);
      }
    }, TYPING_SPEED_MS);
    return () => clearInterval(id);
  }, [entryPhase, carouselIdx]);

  // ── Mouse-tracking flee logic ────────────────────────────────────
  useEffect(() => {
    if (chipMode !== 'roaming' && chipMode !== 'fleeing') return;

    let rafId: number | null = null;
    let pendingMouse: { x: number; y: number } | null = null;

    const triggerTeleport = () => {
      if (teleportingRef.current) return;
      teleportingRef.current = true;
      lastEscapeAtRef.current = Date.now();
      setChipMode((curr) => (curr === 'roaming' ? 'fleeing' : curr));
      setChipOpacity(0);

      window.setTimeout(() => {
        const next = pickChipPosition(lastMouseRef.current);
        chipPosRef.current = next;
        setChipPos(next);
        requestAnimationFrame(() => setChipOpacity(1));
        window.setTimeout(() => {
          teleportingRef.current = false;
        }, FADE_MS);
      }, FADE_MS);
    };

    const tick = () => {
      rafId = null;
      if (!pendingMouse) return;
      const mouse = pendingMouse;
      pendingMouse = null;
      if (teleportingRef.current) return;
      const prev = chipPosRef.current;
      const cx = prev.x + CHIP_W / 2;
      const cy = prev.y + CHIP_H / 2;
      const dist = Math.hypot(cx - mouse.x, cy - mouse.y);
      if (dist < FLEE_RADIUS) triggerTeleport();
    };

    const onMove = (e: MouseEvent) => {
      pendingMouse = { x: e.clientX, y: e.clientY };
      if (rafId === null) rafId = requestAnimationFrame(tick);
    };

    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [chipMode]);

  // ── Chase tracking: accumulate time while the chip is escaping ───
  // Counter advances as long as the user keeps triggering teleports
  // (lastEscapeAtRef is refreshed on every triggerTeleport). If no escape
  // event in the last CHASE_GRACE_MS, the counter resets to 0.
  useEffect(() => {
    if (chipMode !== 'fleeing') return;

    // Initial seed: the teleport that pushed us into 'fleeing' just happened.
    lastEscapeAtRef.current = lastEscapeAtRef.current ?? Date.now();

    let rafId: number | null = null;
    let lastTick = Date.now();
    let accumulated = 0;

    const tick = () => {
      const now = Date.now();
      const dt = now - lastTick;
      lastTick = now;

      const lastEscape = lastEscapeAtRef.current ?? 0;
      if (now - lastEscape < CHASE_GRACE_MS) {
        accumulated = Math.min(CHASE_REQUIRED_MS, accumulated + dt);
      } else {
        accumulated = 0;
      }

      if (accumulated >= CHASE_REQUIRED_MS) {
        setChipMode('catchable');
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      lastEscapeAtRef.current = null;
    };
  }, [chipMode]);

  // ── Rapid-click decay ────────────────────────────────────────────
  useEffect(() => {
    if (chipMode !== 'rapid') return;
    const interval = setInterval(() => {
      const now = Date.now();
      rapidClicksRef.current = rapidClicksRef.current.filter(
        (t) => now - t < RAPID_WINDOW_MS
      );
      setRapidProgress(rapidClicksRef.current.length);
    }, RAPID_DECAY_TICK_MS);
    return () => clearInterval(interval);
  }, [chipMode]);

  // ── Flicker challenge ────────────────────────────────────────────
  // Backdrop stays dark; instead a starfield grows in count and pulse
  // speed via purezaFlickerIntensity (0 → 1 over the 20s window).
  useEffect(() => {
    if (chipMode !== 'flicker') return;

    const stopCycle = () => {
      flickerStartRef.current = null;
      if (flickerPhaseTimeoutRef.current !== null) {
        clearTimeout(flickerPhaseTimeoutRef.current);
        flickerPhaseTimeoutRef.current = null;
      }
      if (flickerCompletionTimeoutRef.current !== null) {
        clearTimeout(flickerCompletionTimeoutRef.current);
        flickerCompletionTimeoutRef.current = null;
      }
      setPurezaFlickerIntensity(0);
    };

    const tickPhase = () => {
      const start = flickerStartRef.current;
      if (start === null) return;
      const elapsed = Date.now() - start;
      const progress = Math.min(1, elapsed / FLICKER_DURATION_MS);
      setPurezaFlickerIntensity(progress);
      flickerPhaseTimeoutRef.current = window.setTimeout(tickPhase, 80);
    };

    const startCycle = () => {
      if (flickerStartRef.current !== null) return;
      flickerStartRef.current = Date.now();
      tickPhase();
      flickerCompletionTimeoutRef.current = window.setTimeout(() => {
        flickerStartRef.current = null;
        if (flickerPhaseTimeoutRef.current !== null) {
          clearTimeout(flickerPhaseTimeoutRef.current);
          flickerPhaseTimeoutRef.current = null;
        }
        setPurezaFlickerIntensity(1);
        // Kick off the choice phases. setChipMode tears down this effect.
        setChipMode('catchable');
        purezaAllVioletRef.current = true;
        purezaTransitioningRef.current = false;
        setPurezaIsViolet(false);
        setPurezaVioletaVisible(false);
        setPurezaFlashTransitionMs(0);
        setPurezaFlashOpacity(0);
        setPurezaChoiceIdx(0);
      }, FLICKER_DURATION_MS);
    };

    const evaluate = () => {
      const rect = modalRef.current?.getBoundingClientRect();
      if (!rect) return;
      const m = lastMouseRef.current;
      const known = m.x > -9000;
      const inside =
        !known ||
        (m.x >= rect.left &&
          m.x <= rect.right &&
          m.y >= rect.top &&
          m.y <= rect.bottom);
      if (inside) stopCycle();
      else startCycle();
    };

    evaluate();
    const onMove = () => evaluate();
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      stopCycle();
    };
  }, [chipMode]);

  // ── Beacon (fe) challenge ────────────────────────────────────────
  useEffect(() => {
    if (chipMode !== 'beacon') return;

    const clearLifecycle = () => {
      beaconLifecycleTimeoutsRef.current.forEach((t) => clearTimeout(t));
      beaconLifecycleTimeoutsRef.current = [];
    };

    const runLifecycle = () => {
      // Fade in
      setBeaconTransitionMs(BEACON_FADE_IN_MS);
      requestAnimationFrame(() => setBeaconOpacity(1));
      const t1 = window.setTimeout(() => {
        // Begin fade out after the visible window
        setBeaconTransitionMs(BEACON_FADE_OUT_MS);
        setBeaconOpacity(0);
      }, BEACON_FADE_IN_MS + BEACON_VISIBLE_MS);
      beaconLifecycleTimeoutsRef.current.push(t1);

      // If the user never engages with the dot, respawn it after the fade-out
      // completes and an idle window (so the spot doesn't sit there forever).
      const idleAt =
        BEACON_FADE_IN_MS +
        BEACON_VISIBLE_MS +
        BEACON_FADE_OUT_MS +
        BEACON_IDLE_RESPAWN_MS;
      const t2 = window.setTimeout(() => {
        if (!beaconEngagedRef.current) respawn();
      }, idleAt);
      beaconLifecycleTimeoutsRef.current.push(t2);
    };

    const placeBeacon = (avoidPrev: { x: number; y: number } | null) => {
      const next = pickBeaconPosition(avoidPrev);
      beaconPosRef.current = next;
      setBeaconPos(next);
      setBeaconTransitionMs(0);
      setBeaconOpacity(0);
      beaconEngagedRef.current = false;
      beaconHasFledRef.current = false;
      clearLifecycle();
      // Wait one frame so the dot mounts at opacity 0 before fading in.
      const startId = window.setTimeout(runLifecycle, 16);
      beaconLifecycleTimeoutsRef.current.push(startId);
    };

    const respawn = () => {
      beaconHoveringRef.current = false;
      if (beaconHoverCompleteTimeoutRef.current !== null) {
        clearTimeout(beaconHoverCompleteTimeoutRef.current);
        beaconHoverCompleteTimeoutRef.current = null;
      }
      placeBeacon(beaconPosRef.current);
    };

    const completeBeacon = () => {
      beaconHoveringRef.current = false;
      clearLifecycle();
      if (beaconHoverCompleteTimeoutRef.current !== null) {
        clearTimeout(beaconHoverCompleteTimeoutRef.current);
        beaconHoverCompleteTimeoutRef.current = null;
      }
      if (beaconAwayTimeoutRef.current !== null) {
        clearTimeout(beaconAwayTimeoutRef.current);
        beaconAwayTimeoutRef.current = null;
      }
      setBeaconTransitionMs(380);
      setBeaconOpacity(0);
      // Reveal fe via the special transition (chip mounts in 'catchable').
      setChipMode('catchable');
      requestAnimationFrame(() => setChipOpacity(1));
      window.setTimeout(() => setChipOpacity(1), 80);
    };

    const triggerFleeEffect = (mx: number, my: number) => {
      const pos = beaconPosRef.current;
      if (!pos) return;
      // Cancel the natural lifecycle — the flee replaces it visually.
      clearLifecycle();
      const dx = pos.x - mx;
      const dy = pos.y - my;
      const norm = Math.hypot(dx, dy) || 1;
      const fleeDistance = 70;
      const fledX = pos.x + (dx / norm) * fleeDistance;
      const fledY = pos.y + (dy / norm) * fleeDistance;
      // Update only the visual position. beaconPosRef stays at the original
      // so the hover hit-test is still anchored where the user first saw it.
      setBeaconTransitionMs(420);
      setBeaconPos({ x: fledX, y: fledY });
      setBeaconOpacity(0);
    };

    const evaluate = (mx: number, my: number) => {
      const pos = beaconPosRef.current;
      if (!pos) return;
      const dist = Math.hypot(mx - pos.x, my - pos.y);
      const inside = dist <= BEACON_HOVER_RADIUS;

      if (inside && !beaconHoveringRef.current) {
        beaconHoveringRef.current = true;
        beaconEngagedRef.current = true;
        if (beaconAwayTimeoutRef.current !== null) {
          clearTimeout(beaconAwayTimeoutRef.current);
          beaconAwayTimeoutRef.current = null;
        }
        if (!beaconHasFledRef.current) {
          beaconHasFledRef.current = true;
          triggerFleeEffect(mx, my);
        }
        beaconHoverCompleteTimeoutRef.current = window.setTimeout(
          completeBeacon,
          BEACON_HOVER_REQUIRED_MS
        );
      } else if (!inside && beaconHoveringRef.current) {
        beaconHoveringRef.current = false;
        if (beaconHoverCompleteTimeoutRef.current !== null) {
          clearTimeout(beaconHoverCompleteTimeoutRef.current);
          beaconHoverCompleteTimeoutRef.current = null;
        }
        beaconAwayTimeoutRef.current = window.setTimeout(
          respawn,
          BEACON_AWAY_RESPAWN_MS
        );
      }
    };

    // Initial spawn of the dot
    placeBeacon(null);

    const onMove = (e: MouseEvent) => evaluate(e.clientX, e.clientY);
    window.addEventListener('mousemove', onMove);

    return () => {
      window.removeEventListener('mousemove', onMove);
      clearLifecycle();
      if (beaconHoverCompleteTimeoutRef.current !== null) {
        clearTimeout(beaconHoverCompleteTimeoutRef.current);
        beaconHoverCompleteTimeoutRef.current = null;
      }
      if (beaconAwayTimeoutRef.current !== null) {
        clearTimeout(beaconAwayTimeoutRef.current);
        beaconAwayTimeoutRef.current = null;
      }
      beaconHoveringRef.current = false;
      beaconPosRef.current = null;
      setBeaconPos(null);
      setBeaconOpacity(0);
    };
  }, [chipMode]);

  // ── Seriedad: typewriter for the active stage ───────────────────
  useEffect(() => {
    const stage = seriedadStage;
    if (stage === 'idle') {
      setSeriedadTyped('');
      setSeriedadTypingDone(false);
      seriedadTextKeyRef.current = '';
      return;
    }
    const textKeyMap: Record<string, string> = {
      q1: 'q1',
      q2: 'q2',
      q3: 'q3',
      q4: 'q4',
      ok: 'ok',
      why: 'why',
      really: 'really',
      finalQ: 'finalQ',
      choice: 'q4', // keep showing q4 text under the buttons
    };
    const textKey = textKeyMap[stage];
    const text = textKey ? SERIEDAD_TEXTS[textKey] : '';
    if (!text) return;

    // While 'choice' (after q4 finished) keep the text fully typed; do nothing.
    if (stage === 'choice') {
      setSeriedadTyped(text);
      setSeriedadTypingDone(true);
      return;
    }

    setSeriedadTyped('');
    setSeriedadTypingDone(false);
    seriedadTextKeyRef.current = textKey;

    let intervalId: number | null = null;
    const startId = window.setTimeout(() => {
      let i = 0;
      intervalId = window.setInterval(() => {
        i += 1;
        setSeriedadTyped(text.slice(0, i));
        if (i >= text.length) {
          if (intervalId !== null) clearInterval(intervalId);
          intervalId = null;
          setSeriedadTypingDone(true);
        }
      }, TYPING_SPEED_MS);
    }, SERIEDAD_TYPING_DELAY_MS);

    return () => {
      window.clearTimeout(startId);
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, [seriedadStage, seriedadSiClicks]);

  // ── Seriedad: auto-advance for self-advancing stages ────────────
  useEffect(() => {
    if (!seriedadTypingDone) return;
    // Map of self-advancing stages.
    const advanceMap: Partial<Record<SeriedadStage, SeriedadStage | '__close-ignore__'>> = {
      q1: 'q2',
      q2: 'q3',
      q3: 'q4',
      q4: 'choice',
      ok: '__close-ignore__',
    };
    const next = advanceMap[seriedadStage];
    if (!next) return;

    if (next === '__close-ignore__') {
      // Ignorar branch: hold "Ok" briefly, then mount the locked-landing
      // overlay on top of the modal so the user sees a smooth fade-in into
      // the chains/padlock; only after that close the modal underneath.
      const t1 = window.setTimeout(() => setLandingLocked(true), SERIEDAD_PAUSE_MS);
      const t2 = window.setTimeout(() => {
        setSeriedadStage('idle');
        setSeriedadOpacity(1);
        setShowEntryModal(false);
      }, SERIEDAD_PAUSE_MS + 1100);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }

    const t1 = window.setTimeout(() => setSeriedadOpacity(0), SERIEDAD_PAUSE_MS);
    const t2 = window.setTimeout(() => {
      setSeriedadStage(next as SeriedadStage);
      setSeriedadOpacity(1);
    }, SERIEDAD_PAUSE_MS + SERIEDAD_FADE_MS);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [seriedadTypingDone, seriedadStage]);

  // ── Seriedad: 5-min patience timer for the 'really' stage ───────
  useEffect(() => {
    if (seriedadStage !== 'really') return;
    const id = window.setTimeout(() => {
      setSeriedadOpacity(0);
      window.setTimeout(() => {
        setSeriedadStage('finalQ');
        setSeriedadOpacity(1);
      }, SERIEDAD_FADE_MS);
    }, SERIEDAD_PATIENCE_MS);
    return () => clearTimeout(id);
  }, [seriedadStage, seriedadSiClicks]);

  // ── Pureza choice phase: timer + buttons fade in → 15s countdown
  // → buttons fade out → Ambas fades in. ───────────────────────────
  useEffect(() => {
    if (purezaChoiceIdx < 0 || purezaChoiceIdx >= PUREZA_PHASES.length) return;
    setPurezaVioletaVisible(false);
    setPurezaMixing(false);
    setPurezaHoveredSide(null);
    setPurezaSecondsLeft(Math.ceil(PUREZA_PHASE_TIMER_MS / 1000));
    // Fade timer + buttons in for the new phase.
    setPurezaButtonsOpacity(0);
    const fadeInId = requestAnimationFrame(() => setPurezaButtonsOpacity(1));

    const startedAt = Date.now();
    const tickId = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(
        0,
        Math.ceil((PUREZA_PHASE_TIMER_MS - elapsed) / 1000)
      );
      setPurezaSecondsLeft(remaining);
    }, 100);

    // Timer ends → fade timer + buttons out, then fade Ambas in.
    const revealId = window.setTimeout(() => {
      setPurezaSecondsLeft(0);
      setPurezaButtonsOpacity(0);
    }, PUREZA_PHASE_TIMER_MS);
    const ambasInId = window.setTimeout(() => {
      setPurezaVioletaVisible(true);
    }, PUREZA_PHASE_TIMER_MS + PUREZA_FILL_FADE_MS);

    return () => {
      cancelAnimationFrame(fadeInId);
      window.clearInterval(tickId);
      window.clearTimeout(revealId);
      window.clearTimeout(ambasInId);
    };
  }, [purezaChoiceIdx]);

  // ── Pureza Ambas panel fade-in when it becomes visible ──────────
  useEffect(() => {
    if (!purezaVioletaVisible) {
      setPurezaAmbasOpacity(0);
      setPurezaAmbasTransitionMs(0);
      return;
    }
    // Mount at opacity 0, then animate to 1 in the next frame so the
    // CSS transition runs.
    setPurezaAmbasTransitionMs(0);
    setPurezaAmbasOpacity(0);
    const id = requestAnimationFrame(() => {
      setPurezaAmbasTransitionMs(PUREZA_FILL_FADE_MS);
      setPurezaAmbasOpacity(1);
    });
    return () => cancelAnimationFrame(id);
  }, [purezaVioletaVisible]);

  // ── Pureza choice handler ───────────────────────────────────────
  const handlePurezaChoice = (chose: 'white' | 'black' | 'violeta') => {
    if (purezaTransitioningRef.current) return;
    if (purezaChoiceIdx < 0 || purezaChoiceIdx >= PUREZA_PHASES.length) return;

    if (chose !== 'violeta') {
      purezaAllVioletRef.current = false;
    }

    const finishPhase = () => {
      const isLast = purezaChoiceIdx >= PUREZA_PHASES.length - 1;
      if (isLast) {
        // End of the four phases.
        setPurezaChoiceIdx(-1);
        setPurezaVioletaVisible(false);
        if (purezaAllVioletRef.current) {
          // Success — reveal pureza in violet, ready to capture.
          setPurezaIsViolet(true);
          setChipOpacity(0);
          requestAnimationFrame(() => setChipOpacity(1));
          window.setTimeout(() => setChipOpacity(1), 80);
        } else {
          // Locked out — bring up the lockout overlay over everything first,
          // then quietly close the modal underneath.
          setLandingLocked(true);
          window.setTimeout(() => {
            setShowEntryModal(false);
          }, 1100);
        }
        purezaTransitioningRef.current = false;
        return;
      }
      // Advance to the next phase.
      setPurezaChoiceIdx(purezaChoiceIdx + 1);
      setPurezaVioletaVisible(false);
      purezaTransitioningRef.current = false;
    };

    if (chose === 'violeta') {
      // Fade Ambas out, then advance to the next phase.
      purezaTransitioningRef.current = true;
      setPurezaVioletaVisible(false);
      window.setTimeout(() => {
        finishPhase();
      }, PUREZA_FILL_FADE_MS);
    } else {
      finishPhase();
    }
  };

  // ── Spaceship (paciencia) RAF loop ───────────────────────────────
  useEffect(() => {
    if (chipMode !== 'spaceship') return;

    const initialPos = initialChipPosRef.current ?? pickInitialAbovePosition();
    initialChipPosRef.current = initialPos;

    // Live-position ref (updated each frame; mirrors chipPosRef but kept
    // separate so we can run the loop independently of React state).
    const livePos = { ...initialPos };
    chipPosRef.current = { ...initialPos };

    // Start with a random heading at full throttle.
    const launch = (awayFrom?: { x: number; y: number }) => {
      let angle: number;
      if (awayFrom) {
        const cx = livePos.x + CHIP_W / 2;
        const cy = livePos.y + CHIP_H / 2;
        angle = Math.atan2(cy - awayFrom.y, cx - awayFrom.x);
        // Add a small jitter so successive dodges don't feel mechanical.
        angle += (Math.random() - 0.5) * 0.6;
      } else {
        angle = Math.random() * Math.PI * 2;
      }
      pacienciaVelRef.current = {
        x: Math.cos(angle) * PACIENCIA_FLY_SPEED,
        y: Math.sin(angle) * PACIENCIA_FLY_SPEED,
      };
      pacienciaPhaseRef.current = 'flying';
      pacienciaPhaseStartRef.current = Date.now();
    };

    launch();
    pacienciaParticlesRef.current = [];
    pacienciaLastParticleRef.current = Date.now();
    setPacienciaParticles([]);

    let rafId: number | null = null;
    let lastFrame = Date.now();

    const tick = () => {
      const now = Date.now();
      const dt = Math.min(0.05, (now - lastFrame) / 1000); // clamp dt to avoid huge jumps
      lastFrame = now;

      const phase = pacienciaPhaseRef.current;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const xMin = VIEWPORT_PAD;
      const xMax = Math.max(xMin + 1, w - VIEWPORT_PAD - CHIP_W);
      const yMin = VIEWPORT_PAD;
      const yMax = Math.max(yMin + 1, h - VIEWPORT_PAD - CHIP_H);

      // ── Phase transitions ────────────────────────────────────────
      if (phase === 'flying') {
        if (now - pacienciaPhaseStartRef.current >= PACIENCIA_FLY_DURATION_MS) {
          pacienciaPhaseRef.current = 'decelerating';
          pacienciaPhaseStartRef.current = now;
        }
      } else if (phase === 'decelerating') {
        const elapsed = now - pacienciaPhaseStartRef.current;
        const t = Math.min(1, elapsed / PACIENCIA_DECEL_DURATION_MS);
        // Smooth deceleration using a quadratic ease-out.
        const factor = 1 - t * t;
        const v = pacienciaVelRef.current;
        const speedNow = Math.hypot(v.x, v.y);
        const targetSpeed = PACIENCIA_FLY_SPEED * factor;
        if (speedNow > 0.1) {
          const k = targetSpeed / speedNow;
          v.x *= k;
          v.y *= k;
        }
        if (t >= 1 || targetSpeed < 5) {
          pacienciaPhaseRef.current = 'settling';
          pacienciaPhaseStartRef.current = now;
          pacienciaSettleFromRef.current = { x: livePos.x, y: livePos.y };
        }
      } else if (phase === 'settling') {
        const elapsed = now - pacienciaPhaseStartRef.current;
        const t = Math.min(1, elapsed / PACIENCIA_SETTLE_DURATION_MS);
        const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
        const from = pacienciaSettleFromRef.current;
        livePos.x = from.x + (initialPos.x - from.x) * ease;
        livePos.y = from.y + (initialPos.y - from.y) * ease;
        if (t >= 1) {
          livePos.x = initialPos.x;
          livePos.y = initialPos.y;
          pacienciaPhaseRef.current = 'waiting';
          pacienciaPhaseStartRef.current = now;
          pacienciaVelRef.current = { x: 0, y: 0 };
        }
      } else if (phase === 'waiting') {
        if (now - pacienciaPhaseStartRef.current >= PACIENCIA_WAIT_MS) {
          // Patience earned — chip becomes catchable in place.
          chipPosRef.current = { x: initialPos.x, y: initialPos.y };
          setChipPos({ x: initialPos.x, y: initialPos.y });
          setPacienciaParticles([]);
          pacienciaParticlesRef.current = [];
          setChipMode('catchable');
          return; // stop the loop on next frame via the cleanup
        }
      }

      // ── Position update for moving phases ────────────────────────
      const movingPhase = pacienciaPhaseRef.current;
      if (movingPhase === 'flying' || movingPhase === 'decelerating') {
        const v = pacienciaVelRef.current;
        livePos.x += v.x * dt;
        livePos.y += v.y * dt;

        // Bounce off viewport edges.
        if (livePos.x < xMin) {
          livePos.x = xMin;
          v.x = Math.abs(v.x);
        } else if (livePos.x > xMax) {
          livePos.x = xMax;
          v.x = -Math.abs(v.x);
        }
        if (livePos.y < yMin) {
          livePos.y = yMin;
          v.y = Math.abs(v.y);
        } else if (livePos.y > yMax) {
          livePos.y = yMax;
          v.y = -Math.abs(v.y);
        }

        // Bounce off the modal panel — gives the user a safe zone for the
        // cursor. AABB overlap check + smallest-axis pushback.
        const modalRect = modalRef.current?.getBoundingClientRect();
        if (modalRect) {
          const chipL = livePos.x;
          const chipR = livePos.x + CHIP_W;
          const chipT = livePos.y;
          const chipB = livePos.y + CHIP_H;
          if (
            chipR > modalRect.left &&
            chipL < modalRect.right &&
            chipB > modalRect.top &&
            chipT < modalRect.bottom
          ) {
            const overlapL = chipR - modalRect.left;     // push chip out left
            const overlapR = modalRect.right - chipL;    // push chip out right
            const overlapT = chipB - modalRect.top;      // push chip up
            const overlapB = modalRect.bottom - chipT;   // push chip down
            const minOverlap = Math.min(overlapL, overlapR, overlapT, overlapB);
            if (minOverlap === overlapL) {
              livePos.x = modalRect.left - CHIP_W;
              v.x = -Math.abs(v.x);
            } else if (minOverlap === overlapR) {
              livePos.x = modalRect.right;
              v.x = Math.abs(v.x);
            } else if (minOverlap === overlapT) {
              livePos.y = modalRect.top - CHIP_H;
              v.y = -Math.abs(v.y);
            } else {
              livePos.y = modalRect.bottom;
              v.y = Math.abs(v.y);
            }
          }
        }

        // Random heading change (probability per second).
        if (Math.random() < PACIENCIA_DIR_CHANGE_PER_SEC * dt) {
          const speed = Math.hypot(v.x, v.y);
          const newAngle = Math.random() * Math.PI * 2;
          v.x = Math.cos(newAngle) * speed;
          v.y = Math.sin(newAngle) * speed;
        }
      }

      // ── Dodge detection (non-flying, non-final phases) ───────────
      if (
        pacienciaPhaseRef.current === 'decelerating' ||
        pacienciaPhaseRef.current === 'settling' ||
        pacienciaPhaseRef.current === 'waiting'
      ) {
        const m = lastMouseRef.current;
        if (m.x > -9000) {
          const cx = livePos.x + CHIP_W / 2;
          const cy = livePos.y + CHIP_H / 2;
          const dist = Math.hypot(cx - m.x, cy - m.y);
          if (dist < PACIENCIA_DODGE_RADIUS) {
            // Snap back to flying at full throttle, heading away from the cursor.
            launch({ x: m.x, y: m.y });
          }
        }
      }

      // ── Particle emission (only while engine is running) ─────────
      const emitting =
        pacienciaPhaseRef.current === 'flying' ||
        pacienciaPhaseRef.current === 'decelerating';
      if (
        emitting &&
        now - pacienciaLastParticleRef.current >= PACIENCIA_PARTICLE_INTERVAL_MS
      ) {
        pacienciaLastParticleRef.current = now;
        const v = pacienciaVelRef.current;
        const speed = Math.hypot(v.x, v.y) || 1;
        const dirX = v.x / speed;
        const dirY = v.y / speed;
        // Spawn at the back of the chip (opposite to motion).
        const cx = livePos.x + CHIP_W / 2;
        const cy = livePos.y + CHIP_H / 2;
        const tailX = cx - dirX * (CHIP_W / 2 + 4);
        const tailY = cy - dirY * (CHIP_H / 2 + 4);
        // Particle drifts slowly opposite to chip motion + small lateral spread.
        const spread = (Math.random() - 0.5) * 90;
        // Perpendicular axis for spread.
        const perpX = -dirY;
        const perpY = dirX;
        pacienciaParticlesRef.current.push({
          id: ++pacienciaParticleIdRef.current,
          x: tailX,
          y: tailY,
          vx: -dirX * 110 + perpX * spread,
          vy: -dirY * 110 + perpY * spread,
          age: 0,
          size: 7 + Math.random() * 5,
        });
      }

      // ── Particle update + culling ────────────────────────────────
      const aged = pacienciaParticlesRef.current;
      const next: PacienciaParticle[] = [];
      for (const p of aged) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        // Slight upward drift like rising smoke.
        p.vy -= 30 * dt;
        p.age += dt * 1000;
        if (p.age < PACIENCIA_PARTICLE_LIFETIME_MS) next.push(p);
      }
      // Cap the array in case of bursts.
      if (next.length > PACIENCIA_MAX_PARTICLES) {
        next.splice(0, next.length - PACIENCIA_MAX_PARTICLES);
      }
      pacienciaParticlesRef.current = next;

      // ── Sync to React state ──────────────────────────────────────
      chipPosRef.current = { x: livePos.x, y: livePos.y };
      setChipPos({ x: livePos.x, y: livePos.y });
      setPacienciaParticles(next.slice());

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      pacienciaParticlesRef.current = [];
      setPacienciaParticles([]);
    };
  }, [chipMode]);

  // ── Capture: chip enters the modal and the next one spawns ───────
  const captureChip = (idx: number) => {
    if (capturingRef.current) return;
    capturingRef.current = true;

    setCapturedIdxs((prev) => [...prev, idx]);
    setChipOpacity(0);

    window.setTimeout(() => {
      setActiveChipIdx(null);
      setChipMode('hidden');
      rapidClicksRef.current = [];
      setRapidProgress(0);
      teleportingRef.current = false;

      // Single-challenge flow: close the modal once the chosen value is
      // captured instead of chaining to the next chip.
      window.setTimeout(() => {
        capturingRef.current = false;
        setShowEntryModal(false);
      }, 320);
    }, FADE_MS);
  };

  const handleChipClick = () => {
    if (capturingRef.current) return;
    if (activeChipIdx === null) return;
    const chip = VALUE_CHIPS[activeChipIdx];

    if (
      chip.challenge === 'flee' ||
      chip.challenge === 'flicker' ||
      chip.challenge === 'beacon' ||
      chip.challenge === 'spaceship'
    ) {
      if (chipMode !== 'catchable') return;
      captureChip(activeChipIdx);
      return;
    }

    if (chip.challenge === 'serious') {
      if (chipMode === 'serious') {
        // Open the dialog overlay; chip hides while it runs.
        setSeriedadStage('q1');
        setSeriedadOpacity(1);
        setSeriedadTyped('');
        setSeriedadTypingDone(false);
        setSeriedadWhyText('');
        setSeriedadFinalText('');
        setSeriedadSiClicks(0);
        setChipMode('serious-active');
        return;
      }
      if (chipMode === 'catchable') {
        captureChip(activeChipIdx);
      }
      return;
    }

    if (chip.challenge === 'rapid' && chipMode === 'rapid') {
      const now = Date.now();
      rapidClicksRef.current.push(now);
      rapidClicksRef.current = rapidClicksRef.current.filter(
        (t) => now - t < RAPID_WINDOW_MS
      );
      const count = rapidClicksRef.current.length;
      setRapidProgress(count);
      const currentThreshold = RAPID_THRESHOLDS[rapidLevelIdx];
      if (count >= currentThreshold) {
        const isLastLevel = rapidLevelIdx + 1 >= RAPID_THRESHOLDS.length;
        if (isLastLevel) {
          captureChip(activeChipIdx);
        } else {
          rapidClicksRef.current = [];
          setRapidProgress(0);
          setRapidLevelIdx(rapidLevelIdx + 1);
          setRapidFlashing(true);
          window.setTimeout(
            () => setRapidFlashing(false),
            RAPID_LEVEL_FLASH_MS
          );
        }
      }
    }
  };

  const activeChip = activeChipIdx !== null ? VALUE_CHIPS[activeChipIdx] : null;
  const isClickable =
    chipMode === 'catchable' ||
    chipMode === 'rapid' ||
    chipMode === 'serious';
  const showChipElement =
    !!activeChip &&
    chipMode !== 'hidden' &&
    chipMode !== 'flicker' &&
    chipMode !== 'beacon' &&
    chipMode !== 'serious-active' &&
    purezaChoiceIdx < 0;

  const colorForChip = (idx: number) =>
    idx === PUREZA_IDX && purezaIsViolet ? PUREZA_VIOLET : VALUE_CHIPS[idx].color;

  const rapidPct =
    activeChip?.challenge === 'rapid'
      ? Math.min(
          100,
          (rapidProgress / RAPID_THRESHOLDS[rapidLevelIdx]) * 100
        )
      : 0;

  // Mientras se elige candidato/cliente o se llena un formulario (modales),
  // usar el cursor normal del sistema. El puntero del juego solo se muestra
  // jugando.
  const nativeCursor =
    entryChoiceOpen ||
    clientSignupOpen ||
    clientLoginOpen ||
    memberLoginOpen ||
    onboardingOpen ||
    recoveryOpen ||
    !!proposalPending ||
    !!clientPending ||
    gameAuthOverlay;

  return (
    <div className={`landing-page${nativeCursor ? ' auth-screen' : ''}`}>
      {!nativeCursor && <PointerCursor />}
      <audio
        ref={windAudioRef}
        src="/sounds/music/Efecto%20de%20sonido%20Viento.mp3"
        loop
        preload="auto"
      />
      <audio
        ref={typingAudioRef}
        src="/sounds/music/Efectos%20de%20sonido%20escritura.mp3"
        loop
        preload="auto"
      />
      <audio
        ref={distortAudioRef}
        src="/sounds/music/Efecto%20de%20sonido%20distorsionado.mp3"
        preload="auto"
      />
      <audio
        ref={planetMusicRef}
        src="/sounds/music/M%C3%BAsica%20Espacial%20261887%20%281%29.mp3"
        loop
        preload="auto"
      />
      <audio
        ref={peligroMusicRef}
        src="/sounds/music/Peligro%20Music.mp3"
        loop
        preload="auto"
      />
      {/* ====== HERO ====== */}
      <section
        ref={heroSectionRef}
        className="relative min-h-[90vh] flex items-center justify-center text-center px-6 overflow-hidden"
      >
        {/* Warp wrapper — scales to "fly into" the planet on click */}
        <div
          ref={warpRef}
          style={{
            position: 'absolute',
            inset: 0,
            transformOrigin: warpOrigin,
            transform: planetEntering ? 'scale(45)' : 'scale(1)',
            transition:
              planetEntering || planetExiting
                ? 'transform 2.5s cubic-bezier(0.55, 0, 0.85, 0.05)'
                : undefined,
            willChange: 'transform',
            pointerEvents: 'none',
          }}
        >
          {/* World — 5x viewport size; pans with the camera */}
          <div
            ref={worldRef}
            aria-hidden="true"
            style={{
              position: 'absolute',
              pointerEvents: 'none',
              willChange: 'transform',
            }}
          >
            <PixelStars count={250} />

            {/* Hidden discovery — planet at world coords (2255, 1457) */}
            <div
              style={{
                position: 'absolute',
                left: 'calc(var(--world-w, 0px) / 2 + 2255px)',
                top: 'calc(var(--world-h, 0px) / 2 - 1457px)',
                width: 520,
                height: 520,
                marginLeft: -260,
                marginTop: -260,
                opacity: worldChatComplete ? 1 : 0,
                transition: 'opacity 1.6s ease',
                willChange: 'opacity',
                pointerEvents:
                  worldChatComplete && !planetEntering ? 'auto' : 'none',
                cursor: 'pointer',
              }}
              onClick={(e) => {
                if (planetEntering || !worldChatComplete) return;
                // Lock camera FIRST so subsequent reads / RAF ticks
                // never apply input or recentering during the zoom.
                cameraLockedRef.current = true;
                const section = heroSectionRef.current;
                if (section) {
                  const sectionRect = section.getBoundingClientRect();
                  const planetRect = (
                    e.currentTarget as HTMLDivElement
                  ).getBoundingClientRect();
                  const ox =
                    (planetRect.left + planetRect.right) / 2 -
                    sectionRect.left;
                  const oy =
                    (planetRect.top + planetRect.bottom) / 2 -
                    sectionRect.top;
                  setWarpOrigin(`${ox}px ${oy}px`);
                }
                for (const id of planetTimeoutsRef.current) {
                  window.clearTimeout(id);
                }
                // Defer the scale trigger one frame so the new
                // transform-origin is committed to the DOM before
                // the transition kicks in.
                requestAnimationFrame(() => {
                  setPlanetEntering(true);
                });
                planetTimeoutsRef.current = [
                  window.setTimeout(() => setPlanetFlash(true), 2300),
                  window.setTimeout(() => setPaisajeVisible(true), 2550),
                  window.setTimeout(() => setPlanetFlash(false), 3700),
                  window.setTimeout(
                    () => setPlanetNarrativeReady(true),
                    4700,
                  ),
                ];
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/planeta_morado_con_bolitas.svg"
                alt=""
                draggable={false}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'block',
                  animation: 'galaxySpin 80s linear infinite',
                  willChange: 'transform',
                }}
              />
            </div>
          </div>
        </div>

        {/* Camera viewfinder — corner brackets pan with the cursor */}
        <div
          ref={cornerTLRef}
          className="absolute top-4 left-4 w-8 h-8 border-t-3 border-l-3 border-accent/30"
          style={{ willChange: 'transform' }}
        />
        <div
          ref={cornerTRRef}
          className="absolute top-4 right-4 w-8 h-8 border-t-3 border-r-3 border-accent/30"
          style={{ willChange: 'transform' }}
        />
        <div
          ref={cornerBLRef}
          className="absolute bottom-4 left-4 w-8 h-8 border-b-3 border-l-3 border-accent/30"
          style={{ willChange: 'transform' }}
        />
        <div
          ref={cornerBRRef}
          className="absolute bottom-4 right-4 w-8 h-8 border-b-3 border-r-3 border-accent/30"
          style={{ willChange: 'transform' }}
        />

        {/* Coordinates — live camera position, sits above the minimap */}
        <div
          ref={coordsLabelRef}
          aria-hidden="true"
          className="absolute"
          style={{
            top: '2.4rem',
            right: '1rem',
            width: 120,
            textAlign: 'center',
            fontFamily: "'Silkscreen', cursive",
            fontSize: '0.6rem',
            letterSpacing: '0.08em',
            color: 'rgba(225,215,255,0.85)',
            textShadow: '1px 1px 0 rgba(0,0,0,0.6)',
            opacity: cameraEnabled && worldChatComplete ? 0.95 : 0,
            transition: 'opacity 600ms ease',
            pointerEvents: 'none',
            zIndex: 30,
          }}
        >
          X +0   Y +0
        </div>

        {/* Minimap — shows camera position in the world */}
        <div
          aria-hidden="true"
          className="absolute"
          style={{
            top: '4rem',
            right: '1rem',
            width: 120,
            height: 90,
            border: '2px solid rgba(123, 95, 191, 0.55)',
            background: 'rgba(0,0,0,0.55)',
            boxShadow:
              '2px 2px 0 rgba(0,0,0,0.5), 0 0 12px rgba(75,45,142,0.25)',
            opacity: cameraEnabled && worldChatComplete ? 0.9 : 0,
            transition: 'opacity 600ms ease',
            pointerEvents: 'none',
            zIndex: 30,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              textAlign: 'center',
              fontFamily: "'Silkscreen', cursive",
              fontSize: '0.55rem',
              letterSpacing: '0.18em',
              color: 'rgba(225,215,255,0.7)',
            }}
          >
            MAPA
          </div>
          <div
            ref={minimapDotRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#ffffff',
              boxShadow:
                '0 0 6px rgba(255,255,255,0.9), 0 0 2px rgba(123,95,191,1)',
              willChange: 'transform',
            }}
          />
          <div
            ref={minimapAlertRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 10,
              height: 10,
              opacity: worldChatComplete ? 1 : 0,
              transition: 'opacity 1s ease',
              willChange: 'transform, opacity',
              filter: 'drop-shadow(0 0 3px rgba(255,180,0,0.85))',
            }}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                animation: worldChatComplete
                  ? 'alertPulse 1.4s ease-in-out infinite'
                  : undefined,
                willChange: 'transform, opacity',
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/Icono%20de%20Advertencia.png"
                alt=""
                draggable={false}
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
            </div>
          </div>
        </div>

        <div
          className="relative z-10 max-w-3xl mx-auto"
          style={{
            pointerEvents: windAway ? 'none' : 'auto',
          }}
        >
          <div
            className="inline-block px-4 py-1.5 mb-6 text-accent-glow border-2 border-accent/40 bg-accent/10"
            style={{
              fontFamily: "'Silkscreen', cursive",
              fontSize: '0.65rem',
              letterSpacing: '0.15em',
              animation: windAway
                ? 'windBlowAway 0.95s ease-in 0s forwards'
                : 'glitchFlicker 4s ease-in-out infinite, breathe 5s ease-in-out infinite',
              willChange: 'transform, opacity, filter',
            }}
          >
            Grupo Corazones Cruzados
          </div>

          <h1
            className="pixel-heading text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white leading-tight"
            style={
              windAway
                ? {
                    animation: 'windBlowAway 1.05s ease-in 0.12s forwards',
                    willChange: 'transform, opacity, filter',
                  }
                : {
                    animation: 'breathe 5s ease-in-out infinite',
                    transformOrigin: 'center',
                    willChange: 'transform',
                  }
            }
          >
            Un Coraz&oacute;n puede
            <br />
            <span
              className="pixel-glow"
              style={{
                background: 'linear-gradient(135deg, #4B2D8E 0%, #A1207D 50%, #7B5FBF 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                filter: 'drop-shadow(0 0 20px rgba(75, 45, 142, 0.4))',
              }}
            >
              <span style={{ WebkitTextFillColor: '#ef4444', filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.5))' }}>cruzar</span> al mundo
            </span>
          </h1>

          <p
            className="mt-5 text-lg md:text-xl opacity-60"
            style={{
              fontFamily: "'Silkscreen', cursive",
              fontSize: '0.8rem',
              letterSpacing: '0.05em',
              color: '#94A3B8',
              animation: windAway
                ? 'windBlowAway 1.1s ease-in 0.26s forwards'
                : 'breathe 5s ease-in-out infinite',
              willChange: 'transform, opacity, filter',
            }}
          >
            Proyecto de Desarrollo Humano
          </p>

          <div className="flex flex-col items-center gap-3 mt-10">
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => {
                if (landingLocked || windAway) return;

                // Returning player: solo entra si está aprobado + verificado.
                if (savedCharacter) {
                  if (!gateGameEntry()) return;
                  // "Entrar" SIEMPRE exige validar el login (credenciales + 2FA)
                  // dentro del juego: descartamos autenticación previa de esta
                  // misma carga para no entrar directo al reconocer la cuenta.
                  setFreshAuth(false);
                  setWindAway(true);
                  return;
                }

                // First-time visitor: menú "¿Cómo quieres ingresar?". "Entrar"
                // lleva al JUEGO (candidato/cliente/miembro crean/usan personaje).
                setEntryDestination('game');
                setEntryChoiceOpen(true);
              }}
              disabled={landingLocked || windAway}
              className="pixel-btn pixel-btn-primary"
              style={{
                ...(landingLocked && !windAway
                  ? { opacity: 0.45, cursor: 'not-allowed' }
                  : {}),
                ...(windAway
                  ? {
                      animation:
                        'windBlowAway 1.15s ease-in 0.4s forwards',
                      willChange: 'transform, opacity, filter',
                      cursor: 'default',
                    }
                  : {
                      animation: 'breathe 5s ease-in-out infinite',
                      willChange: 'transform',
                    }),
              }}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => {
                if (landingLocked || windAway) return;
                // Colaborar: mismo menú de opciones, pero el destino es /dashboard
                // (candidato/cliente/miembro van al dashboard, no al juego). También
                // incluye postular y ver el estado de la solicitud.
                setEntryDestination('dashboard');
                setEntryChoiceOpen(true);
              }}
              disabled={landingLocked || windAway}
              className="pixel-btn pixel-btn-primary"
              style={{
                ...(landingLocked && !windAway
                  ? { opacity: 0.45, cursor: 'not-allowed' }
                  : {}),
                ...(windAway
                  ? {
                      animation:
                        'windBlowAway 1.15s ease-in 0.4s forwards',
                      willChange: 'transform, opacity, filter',
                      cursor: 'default',
                    }
                  : {
                      animation: 'breathe 5s ease-in-out infinite',
                      willChange: 'transform',
                    }),
              }}
            >
              Colaborar
            </button>
            </div>
          </div>
        </div>
      </section>

      {recoveryOpen && (
        <AccountRecoveryModal
          onClose={() => setRecoveryOpen(false)}
          onSuccess={async () => {
            // Cuenta vinculada a este dispositivo (IP actualizada por el endpoint).
            setRecoveryOpen(false);
            setOnboardingOpen(false);
            if (entryDestination === 'dashboard') {
              // Colaborar: el candidato va al dashboard.
              window.location.href = '/dashboard';
              return;
            }
            setFreshAuth(true); // ya validó código en el modal → no re-pedir login
            const found = await refreshSavedCharacter();
            if (found) {
              setSavePointTrigger((n) => n + 1);
              // Solo entra si está APROBADO + correo VERIFICADO; si no,
              // gateGameEntry muestra el modal de espera de aprobación.
              if (!gateGameEntry()) return;
              setWindAway(true); // entra como jugador recurrente
              return;
            }
            // Sin personaje (candidato aprobado en su primer ingreso): arranca el
            // intro del juego (chat → planeta → creador de personaje).
            setWindAway(true);
            cameraEnabledRef.current = true;
            setCameraEnabled(true);
            if (worldChatTimeoutRef.current) {
              window.clearTimeout(worldChatTimeoutRef.current);
            }
            worldChatTimeoutRef.current = window.setTimeout(() => {
              setWorldChatVisible(true);
              worldChatTimeoutRef.current = null;
            }, 6000);
          }}
        />
      )}

      {entryChoiceOpen && (
        <EntryChoiceModal
          destination={entryDestination}
          onClose={() => setEntryChoiceOpen(false)}
          onCandidate={() => {
            setEntryChoiceOpen(false);
            setEnteredAsMember(false);
            try {
              window.localStorage.setItem('gcc_account_type', 'candidate');
            } catch {
              /* ignore */
            }
            // Candidato nuevo (sin postulación previa): conoce el proyecto y se postula.
            setOnboardingOpen(true);
          }}
          onProposalPending={(info) => {
            setEntryChoiceOpen(false);
            setProposalPending({ email: info.email, emailVerified: info.emailVerified });
          }}
          onProposalApproved={(info) => {
            setEntryChoiceOpen(false);
            // Candidato aprobado: muestra el aviso verde con botón "Continuar".
            setProposalPending({ email: info.email, emailVerified: true, approved: true });
          }}
          onClientPending={(info) => {
            setEntryChoiceOpen(false);
            setClientPending({ email: info.email });
          }}
          onCandidateLogin={() => {
            setEntryChoiceOpen(false);
            setEnteredAsMember(false);
            // Candidato existente: inicia sesión (credenciales + código) y entra.
            setRecoveryOpen(true);
          }}
          onClient={() => {
            setEntryChoiceOpen(false);
            setEnteredAsMember(false);
            // Cliente: primero inicia sesión; desde ahí puede crear cuenta.
            setClientLoginOpen(true);
          }}
          onMember={() => {
            setEntryChoiceOpen(false);
            // Miembro/admin: inicia sesión y entra al juego con su personaje.
            setMemberLoginOpen(true);
          }}
        />
      )}

      {onboardingOpen && (
        <OnboardingSlidersModal
          onClose={() => setOnboardingOpen(false)}
          onComplete={async (postulacion) => {
            // Registra la propuesta (queda en espera de aprobación del admin
            // global). El candidato NO entra al juego hasta ser aprobado.
            const pendingInfo: { email?: string | null; emailVerified?: boolean } = {
              email: postulacion.email,
              emailVerified: false,
            };
            try {
              const r = await fetch('/api/candidate/proposal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(postulacion),
              });
              // 200 (creada) o 409 (ya existía) → igualmente queda en espera.
              if (!r.ok && r.status !== 409) {
                const j = await r.json().catch(() => null);
                console.error('Proposal submit failed:', j?.error);
              }
            } catch (err) {
              console.error('Proposal submit error:', err);
            }
            setOnboardingOpen(false);
            setProposalPending(pendingInfo);
          }}
        />
      )}

      {proposalPending && (
        <ProposalPendingModal
          email={proposalPending.email}
          emailVerified={proposalPending.emailVerified}
          approved={proposalPending.approved}
          onContinue={() => {
            const email = proposalPending.email;
            setProposalPending(null);
            setCandidateAccount({ email });
          }}
          onClose={() => setProposalPending(null)}
        />
      )}

      {candidateAccount && (
        <CandidateAccountModal
          email={candidateAccount.email}
          onClose={() => setCandidateAccount(null)}
          onDone={() => {
            // Cuenta creada (sesión de candidato activa): recarga la landing para
            // continuar su flujo (ya reconocido, entra al juego / crea su personaje).
            window.location.href = '/';
          }}
        />
      )}

      {clientPending && (
        <ProposalPendingModal
          mode="client"
          email={clientPending.email}
          emailVerified={false}
          onClose={() => setClientPending(null)}
        />
      )}

      {clientSignupOpen && (
        <ClientSignupModal
          onClose={() => setClientSignupOpen(false)}
          onLogin={() => {
            setClientSignupOpen(false);
            setClientLoginOpen(true);
          }}
        />
      )}

      {clientLoginOpen && (
        <ClientLoginModal
          onClose={() => setClientLoginOpen(false)}
          onSignup={() => {
            setClientLoginOpen(false);
            setClientSignupOpen(true);
          }}
          onLoggedIn={async () => {
            setClientLoginOpen(false);
            if (entryDestination === 'dashboard') {
              // Colaborar: el cliente va al dashboard (marketplace).
              window.location.href = '/dashboard/marketplace';
              return;
            }
            // Entrar: el cliente entra al JUEGO. Ya tiene cuenta (no "crea tu
            // cuenta") y se acaba de autenticar (no re-pedir login).
            setEnteredAsMember(true);
            setFreshAuth(true);
            const found = await refreshSavedCharacter();
            if (found) {
              setSavePointTrigger((n) => n + 1);
              setWindAway(true); // recurrente: entra con su personaje
              return;
            }
            // Sin personaje: arranca el intro → creación de personaje.
            setWindAway(true);
            cameraEnabledRef.current = true;
            setCameraEnabled(true);
            if (worldChatTimeoutRef.current) {
              window.clearTimeout(worldChatTimeoutRef.current);
            }
            worldChatTimeoutRef.current = window.setTimeout(() => {
              setWorldChatVisible(true);
              worldChatTimeoutRef.current = null;
            }, 6000);
          }}
        />
      )}

      {memberLoginOpen && (
        <MemberLoginModal
          onClose={() => setMemberLoginOpen(false)}
          onLoggedIn={async (hasCharacter) => {
            setMemberLoginOpen(false);
            if (entryDestination === 'dashboard') {
              // Colaborar: el miembro/admin va al dashboard.
              window.location.href = '/dashboard';
              return;
            }
            setEnteredAsMember(true);
            setFreshAuth(true); // ya se autenticó en el modal → no re-pedir login
            if (hasCharacter) {
              // Tiene personaje (ya quedó approved): entra directo al juego.
              const found = await refreshSavedCharacter();
              if (found) setSavePointTrigger((n) => n + 1);
              setWindAway(true); // useEffect de savedCharacter → enterAsReturning
              return;
            }
            // Sin personaje: arranca el intro del juego (chat → planeta →
            // creador de personaje). Está autenticado como staff, así que al
            // guardar el personaje queda vinculado a su cuenta.
            setWindAway(true);
            cameraEnabledRef.current = true;
            setCameraEnabled(true);
            if (worldChatTimeoutRef.current) {
              window.clearTimeout(worldChatTimeoutRef.current);
            }
            worldChatTimeoutRef.current = window.setTimeout(() => {
              setWorldChatVisible(true);
              worldChatTimeoutRef.current = null;
            }, 6000);
          }}
        />
      )}

      {/* Gray lockout overlay (after the 'ignorar' / pureza-fail branches) */}
      {landingLocked && (
        <div
          aria-hidden="true"
          className="fixed inset-0"
          style={{
            zIndex: 200,
            backgroundColor: 'rgba(36, 38, 46, 0.74)',
            backdropFilter: 'grayscale(0.92) blur(1.5px)',
            pointerEvents: 'auto',
            overflow: 'hidden',
            animation: 'lockFadeIn 0.7s ease-out',
          }}
        >
          {/* Chains crossing the page — interlocking oval links */}
          {[
            { rot:  28, top: '50%', delay: '0.20s' },
            { rot: -32, top: '50%', delay: '0.35s' },
            { rot:  64, top: '50%', delay: '0.50s' },
          ].map((c, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: c.top,
                left: '-30%',
                width: '160%',
                height: '36px',
                transform: `translateY(-50%) rotate(${c.rot}deg)`,
                backgroundImage: CHAIN_PATTERN_URL,
                backgroundRepeat: 'repeat-x',
                backgroundSize: '56px 32px',
                backgroundPosition: 'center',
                filter: 'drop-shadow(0 6px 10px rgba(0, 0, 0, 0.75))',
                animation: `lockFadeIn 0.85s ease-out ${c.delay} backwards`,
              }}
            />
          ))}

          {/* Padlock — slams in over the chains; shakes on click */}
          <div
            key={`padlock-${padlockShakeId}`}
            role="button"
            tabIndex={0}
            onClick={() => setPadlockShakeId((id) => id + 1)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setPadlockShakeId((id) => id + 1);
              }
            }}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              animation:
                padlockShakeId === 0
                  ? 'lockSlam 0.85s cubic-bezier(0.22, 1.4, 0.4, 1) 0.6s backwards'
                  : 'lockShake 0.6s ease-in-out',
              filter: 'drop-shadow(0 10px 22px rgba(0, 0, 0, 0.75))',
              cursor: 'pointer',
              pointerEvents: 'auto',
              userSelect: 'none',
              outline: 'none',
            }}
          >
            <svg
              width="200"
              height="240"
              viewBox="0 0 64 80"
              style={{ imageRendering: 'pixelated' }}
            >
              {/* Shackle */}
              <path
                d="M 18 40 L 18 24 A 14 14 0 0 1 46 24 L 46 40"
                fill="none"
                stroke="#bdbdbd"
                strokeWidth="6"
                strokeLinecap="square"
              />
              <path
                d="M 18 40 L 18 24 A 14 14 0 0 1 46 24 L 46 40"
                fill="none"
                stroke="#1a1a1a"
                strokeWidth="2"
              />
              {/* Body */}
              <rect
                x="8"
                y="38"
                width="48"
                height="40"
                rx="3"
                fill="#5a5a5a"
                stroke="#1a1a1a"
                strokeWidth="2"
              />
              <rect x="10" y="40" width="44" height="4" fill="#8c8c8c" />
              <rect x="10" y="72" width="44" height="4" fill="#3a3a3a" />
              {/* Keyhole */}
              <circle cx="32" cy="54" r="5" fill="#1a1a1a" />
              <rect x="30" y="54" width="4" height="12" fill="#1a1a1a" />
            </svg>
          </div>
        </div>
      )}

      {/* ====== WHITE FLASH — peak of warp transition ====== */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: '#ffffff',
          pointerEvents: 'none',
          opacity: planetFlash ? 1 : 0,
          transition: planetFlash
            ? 'opacity 220ms ease-out'
            : 'opacity 900ms ease-in',
          zIndex: 9998,
        }}
      />

      {/* ====== PAISAJE — destination after the planet entry ====== */}
      {paisajeVisible && (() => {
        const scene = PLANET_SCENES[planetSceneIdx];
        const canGoPrev = planetTextIdx > 0;
        const canGoNext = true;
        const goNext = () => {
          if (planetTextIdx < scene.texts.length - 1) {
            setPlanetTextIdx(planetTextIdx + 1);
          } else if (planetSceneIdx < PLANET_SCENES.length - 1) {
            setPlanetSceneIdx(planetSceneIdx + 1);
            setPlanetTextIdx(0);
          } else {
            setPlanetQuestionVisible(true);
          }
        };
        const goPrev = () => {
          if (!canGoPrev) return;
          setPlanetTextIdx(planetTextIdx - 1);
        };
        const triggerExit = () => {
          if (planetExiting) return;
          setPlanetQuestionVisible(false);
          setPlanetExiting(true);
          for (const id of planetTimeoutsRef.current) {
            window.clearTimeout(id);
          }
          planetTimeoutsRef.current = [
            window.setTimeout(() => setPlanetFlash(true), 50),
            window.setTimeout(() => {
              setPaisajeVisible(false);
              setPlanetEntering(false);
            }, 280),
            window.setTimeout(() => setPlanetFlash(false), 1200),
            window.setTimeout(() => {
              setPlanetExiting(false);
              cameraLockedRef.current = false;
            }, 2900),
          ];
        };
        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9000,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#0a0a14',
              animation: 'pixelFadeIn 0.9s ease-out',
              padding: 24,
              gap: 0,
            }}
          >
            <div
              style={{
                position: 'relative',
                padding: 14,
                border: '4px solid var(--color-accent)',
                background: '#0a0a14',
                boxShadow:
                  '0 0 36px rgba(75,45,142,0.55), 8px 8px 0 rgba(0,0,0,0.6)',
                maxWidth: 'min(92vw, 1100px)',
                maxHeight: '64vh',
              }}
            >
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-accent" />
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-accent" />
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-accent" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-accent" />

              {/* Back arrow — exits the planet */}
              <button
                type="button"
                onClick={triggerExit}
                aria-label="Salir del mundo"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: -56,
                  transform: 'translateY(-50%)',
                  width: 44,
                  height: 44,
                  background: '#1a1a1a',
                  border: '2px solid var(--color-accent)',
                  boxShadow:
                    '2px 2px 0 rgba(0,0,0,0.55), 0 0 14px rgba(75,45,142,0.55)',
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="22"
                  height="22"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                  aria-hidden="true"
                >
                  <path d="M15 4 L7 12 L15 20" />
                </svg>
              </button>

              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={scene.image}
                src={scene.image}
                alt=""
                draggable={false}
                style={{
                  display: 'block',
                  maxWidth: '100%',
                  maxHeight: 'calc(64vh - 28px)',
                  imageRendering: 'pixelated',
                  animation: 'pixelFadeIn 0.7s ease-out',
                }}
              />
            </div>

            {/* World chat at the planet — speaker, line, text + controls */}
            <div
              style={{
                marginTop: 24,
                width: 'min(92vw, 720px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  whiteSpace: 'nowrap',
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    border: '2px solid var(--color-accent)',
                    background: '#1a1a1a',
                    overflow: 'hidden',
                    flexShrink: 0,
                    boxShadow:
                      '2px 2px 0 rgba(0,0,0,0.5), 0 0 8px rgba(75,45,142,0.5)',
                  }}
                >
                  {adminInfo?.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={adminInfo.photoUrl}
                      alt={adminInfo.name ?? 'lfgonzalezm0'}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display =
                          'none';
                      }}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  )}
                </div>
                <span
                  style={{
                    fontFamily: "'Silkscreen', cursive",
                    fontSize: '0.7rem',
                    color: '#e5e5e5',
                    letterSpacing: '0.08em',
                    textShadow: '1px 1px 0 rgba(0,0,0,0.6)',
                  }}
                >
                  {adminInfo?.name ?? 'lfgonzalezm0'}
                </span>
              </div>

              <div
                style={{
                  height: 2,
                  width: '100%',
                  background: 'rgba(123, 95, 191, 0.45)',
                }}
              />

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  width: '100%',
                  paddingTop: 4,
                }}
              >
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={!canGoPrev}
                  aria-label="Texto anterior"
                  style={{
                    width: 36,
                    height: 36,
                    flexShrink: 0,
                    background: '#1a1a1a',
                    border: '2px solid var(--color-accent)',
                    cursor: canGoPrev ? 'pointer' : 'not-allowed',
                    opacity: canGoPrev ? 1 : 0.25,
                    pointerEvents: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    transition: 'opacity 200ms ease',
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
                  >
                    <path d="M15 4 L7 12 L15 20" />
                  </svg>
                </button>

                <p
                  style={{
                    flex: 1,
                    margin: 0,
                    textAlign: 'center',
                    fontFamily: "'Silkscreen', cursive",
                    fontSize: '0.85rem',
                    color: '#e5e5e5',
                    letterSpacing: '0.04em',
                    lineHeight: 1.65,
                    textShadow: '1px 1px 0 rgba(0,0,0,0.6)',
                    minHeight: '2.5em',
                  }}
                >
                  {planetTextTyped}
                  {!planetTextDone && (
                    <span
                      aria-hidden="true"
                      style={{
                        display: 'inline-block',
                        width: 0,
                        height: '0.95em',
                        marginLeft: '2px',
                        borderRight: '2px solid #a78bfa',
                        verticalAlign: 'middle',
                        animation: 'blinkCaret 0.7s step-end infinite',
                      }}
                    />
                  )}
                </p>

                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canGoNext}
                  aria-label="Texto siguiente"
                  style={{
                    width: 36,
                    height: 36,
                    flexShrink: 0,
                    background: '#1a1a1a',
                    border: '2px solid var(--color-accent)',
                    cursor: canGoNext ? 'pointer' : 'not-allowed',
                    opacity: canGoNext ? 1 : 0.25,
                    pointerEvents: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    transition: 'opacity 200ms ease',
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
                  >
                    <path d="M9 4 L17 12 L9 20" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Question modal — appears after the last narrative text */}
            {planetQuestionVisible && (
              <div
                role="dialog"
                aria-modal="true"
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 9100,
                  background: 'rgba(0, 0, 0, 0.55)',
                  backdropFilter: 'blur(2px)',
                  WebkitBackdropFilter: 'blur(2px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 24,
                  animation: 'pixelFadeIn 0.45s ease-out',
                }}
              >
                <div
                  className="pixel-card pixel-card--no-hover relative"
                  style={{
                    maxWidth: 'min(640px, 92vw)',
                    width: '100%',
                    animation: 'pixelFadeIn 0.45s ease-out',
                  }}
                >
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-accent" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-accent" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-accent" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-accent" />

                  <div
                    style={{
                      fontFamily: "'Silkscreen', cursive",
                      fontSize: '0.75rem',
                      letterSpacing: '0.18em',
                      color: 'var(--color-accent)',
                      textTransform: 'uppercase',
                      marginBottom: 14,
                    }}
                  >
                    Pregunta
                  </div>

                  <p
                    style={{
                      fontFamily: "'Silkscreen', cursive",
                      fontSize: '0.78rem',
                      color: '#e5e5e5',
                      lineHeight: 1.7,
                      letterSpacing: '0.04em',
                      margin: 0,
                    }}
                  >
                    {PLANET_QUESTION}
                  </p>

                  <div className="pixel-divider mt-6 mb-4" />

                  <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
                    <button
                      type="button"
                      className="pixel-btn pixel-btn-primary"
                      onClick={() => {
                        setPlanetQuestionVisible(false);
                        setBulbOff(true);
                        // Fade audios out alongside the bulb-off
                        const fadeAudio = (
                          audio: HTMLAudioElement | null,
                        ) => {
                          if (!audio || audio.paused) return;
                          const startVol = audio.volume;
                          const start = performance.now();
                          const FADE_MS = 700;
                          const step = (t: number) => {
                            const k = Math.max(
                              0,
                              Math.min(1, (t - start) / FADE_MS),
                            );
                            audio.volume = Math.max(
                              0,
                              Math.min(1, startVol * (1 - k)),
                            );
                            if (k < 1) requestAnimationFrame(step);
                            else {
                              audio.pause();
                              audio.currentTime = 0;
                            }
                          };
                          requestAnimationFrame(step);
                        };
                        fadeAudio(planetMusicRef.current);
                        fadeAudio(peligroMusicRef.current);
                        const ctx = audioCtxRef.current;
                        const gain = spaceGainRef.current;
                        if (ctx && gain) {
                          const now = ctx.currentTime;
                          gain.gain.cancelScheduledValues(now);
                          gain.gain.setValueAtTime(gain.gain.value, now);
                          gain.gain.linearRampToValueAtTime(0, now + 0.7);
                        }
                        // Last-chance re-validation before opening the
                        // creator. If the network finally surfaces a
                        // saved character, the savedCharacter useEffect
                        // routes us into gameplay and the timer below
                        // bails out via the savedCharacterRef check.
                        refreshSavedCharacter();
                        window.setTimeout(() => {
                          if (savedCharacterRef.current) return;
                          setCharacterCreatorVisible(true);
                        }, 950);
                      }}
                    >
                      Entrar
                    </button>
                    <button
                      type="button"
                      className="pixel-btn pixel-btn-secondary"
                      onClick={triggerExit}
                    >
                      Salir
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ====== BULB OFF — CRT-style screen shutdown ====== */}
      {bulbOff && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            background: '#000000',
            overflow: 'hidden',
            pointerEvents: 'all',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: '#ffffff',
              boxShadow: '0 0 30px rgba(255, 255, 255, 0.7)',
              animation:
                'bulbOff 0.85s cubic-bezier(0.7, 0, 0.84, 0) forwards',
            }}
          />
        </div>
      )}

      {/* ====== CHARACTER CREATOR ====== */}
      {characterCreatorVisible && (
        <CharacterCreator
          onConfirm={async (cfg) => {
            // Final guard: re-check before persisting a new character.
            // If the network finally surfaces an existing account, route
            // the user into it instead of creating a duplicate.
            const existing = await refreshSavedCharacter();
            if (existing) {
              if (!gateGameEntry()) {
                setCharacterCreatorVisible(false);
                return;
              }
              enterAsReturning(existing);
              return;
            }
            setCharacterConfig(cfg);
            setCharacterCreatorVisible(false);
            setGameplayActive(true);
            fetch('/api/character/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ alias: cfg.name, characterData: cfg }),
            })
              .then((r) => {
                if (r.ok) setSavePointTrigger((n) => n + 1);
              })
              .catch(() => undefined);
          }}
        />
      )}

      {/* ====== GAMEPLAY ====== */}
      {gameplayActive && characterConfig && (
        <CharacterGameplay
          config={characterConfig}
          initialAuth={savedAuth ?? undefined}
          isReturning={!!savedAuth}
          isMemberSession={enteredAsMember}
          freshAuth={freshAuth}
          onAuthOverlayChange={setGameAuthOverlay}
          onChangeEntryType={async () => {
            // Volver al menú "¿Cómo quieres ingresar?" para cambiar de cuenta.
            // Primero DESVINCULA el dispositivo (logout): limpia cookies + tokens
            // e ip_hash, así "Entrar" ya no reconoce la cuenta anterior. Luego
            // recarga y reabre el menú (la landing usa animaciones irreversibles).
            try {
              window.sessionStorage.setItem('gcc_entry_choice', entryDestination);
            } catch {
              /* ignore */
            }
            try {
              await fetch('/api/character/auth/logout', { method: 'POST' });
            } catch {
              /* ignore */
            }
            window.location.reload();
          }}
        />
      )}

      <SavePointIndicator trigger={savePointTrigger} />

      {/* ====== FOOTER ====== */}
      <footer className="border-t-2 border-accent/20 py-8 px-6 text-center relative">
        {/* World chat speaker — sits just above the purple top border */}
        <div
          aria-hidden={!worldChatVisible || worldChatComplete}
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translate(-50%, -100%) translateY(-6px)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.55rem',
            opacity: worldChatVisible && !worldChatComplete ? 1 : 0,
            transition: 'opacity 1s ease',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: '2px solid var(--color-accent)',
              background: '#1a1a1a',
              overflow: 'hidden',
              flexShrink: 0,
              boxShadow:
                '2px 2px 0 rgba(0,0,0,0.5), 0 0 10px rgba(75,45,142,0.5)',
            }}
          >
            {adminInfo?.photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={adminInfo.photoUrl}
                alt={adminInfo.name ?? 'lfgonzalezm0'}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            )}
          </div>
          <span
            style={{
              fontFamily: "'Silkscreen', cursive",
              fontSize: '0.7rem',
              color: '#e5e5e5',
              letterSpacing: '0.08em',
              textShadow: '1px 1px 0 rgba(0,0,0,0.6)',
            }}
          >
            {adminInfo?.name ?? 'lfgonzalezm0'}
          </span>
        </div>

        {worldChatVisible ? (
          <p
            style={{
              fontFamily: "'Silkscreen', cursive",
              fontSize: '0.85rem',
              color: worldChatGlitch ? '#ff3b3b' : '#e5e5e5',
              letterSpacing: worldChatGlitch ? '0.12em' : '0.04em',
              lineHeight: 1.75,
              maxWidth: '64ch',
              margin: '0 auto',
              textShadow: worldChatGlitch
                ? '2px 0 #06b6d4, -2px 0 #ff3b3b, 0 0 6px rgba(255,59,59,0.5)'
                : '1px 1px 0 rgba(0,0,0,0.6)',
              filter: worldChatGlitch ? 'blur(0.4px)' : undefined,
              opacity: worldChatComplete ? 0 : 1,
              transition: 'opacity 1s ease',
              animation: worldChatComplete
                ? undefined
                : worldChatGlitch
                  ? 'glitchFlicker 0.18s steps(1) infinite'
                  : 'pixelFadeIn 0.5s ease-out',
            }}
          >
            {worldChatTyped}
            {!worldChatDone && !worldChatGlitch && (
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  width: 0,
                  height: '0.95em',
                  marginLeft: '2px',
                  borderRight: '2px solid #a78bfa',
                  verticalAlign: 'middle',
                  animation: 'blinkCaret 0.7s step-end infinite',
                }}
              />
            )}
          </p>
        ) : (
          <p
            style={{
              fontFamily: "'Silkscreen', cursive",
              fontSize: '0.65rem',
              color: '#cfc9e2',
              opacity: windAway ? 0 : 0.75,
              filter: windAway ? 'blur(3px)' : undefined,
              transition: 'opacity 1.1s ease-out, filter 1.1s ease-out',
            }}
          >
            &copy; 2026 GCC World &mdash; Todos los derechos reservados
          </p>
        )}
      </footer>

      {/* ====== MODAL DE ENTRADA ====== */}
      {showEntryModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          style={{
            backgroundColor:
              entryPhase === 'message2Reveal' ? '#000000' : BG_DARK,
            transition: 'background-color 600ms ease',
            cursor:
              entryPhase === 'message2Reveal' ? 'pointer' : undefined,
          }}
          onClick={
            entryPhase === 'message2Reveal'
              ? () => {
                  setCarouselIdx(0);
                  setEntryPhase('floatingChips');
                }
              : undefined
          }
        >
          {/* Pureza starfield — visible during the flicker challenge and
              all the choice phases. Stars appear by threshold against the
              flicker intensity; in choice phases intensity stays at 1. */}
          {(chipMode === 'flicker' || purezaChoiceIdx >= 0) && (() => {
            const intensity = chipMode === 'flicker' ? purezaFlickerIntensity : 1;
            const pulseDuration = Math.max(0.45, 2.5 - intensity * 2.0);
            return (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  // No explicit zIndex so the modal pixel-card (later sibling)
                  // sits on top and clips the stars while the question window
                  // is visible.
                }}
              >
                {purezaStars.map((s) => {
                  const visible = intensity >= s.threshold;
                  return (
                    <div
                      key={s.id}
                      style={{
                        position: 'absolute',
                        left: `${s.x}%`,
                        top: `${s.y}%`,
                        opacity: visible ? 1 : 0,
                        transition: 'opacity 200ms ease',
                        animation: visible
                          ? `purezaStarDrift${s.driftIdx} ${s.driftDuration}s ease-in-out ${s.driftDelay}s infinite alternate`
                          : 'none',
                        willChange: 'transform',
                      }}
                    >
                      <span
                        style={{
                          display: 'block',
                          width: `${s.size}px`,
                          height: `${s.size}px`,
                          borderRadius: '50%',
                          background: '#ffffff',
                          boxShadow: '0 0 4px rgba(255,255,255,0.7)',
                          animation: visible
                            ? `purezaTwinkle ${pulseDuration}s ease-in-out ${s.delay}s infinite`
                            : 'none',
                          willChange: 'transform, opacity',
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })()}

          <div
            ref={modalRef}
            className="pixel-card pixel-card--no-hover max-w-2xl w-full relative"
            style={{
              animation: 'pixelFadeIn 0.4s ease-out',
              opacity:
                entryPhase === 'floatingChips' || entryPhase === 'challenge'
                  ? 0
                  : 1,
              transition:
                'opacity 600ms ease, background-color 500ms ease, border-color 500ms ease, box-shadow 500ms ease',
              pointerEvents:
                entryPhase === 'floatingChips' || entryPhase === 'challenge'
                  ? 'none'
                  : 'auto',
              ...(entryPhase === 'message2Reveal'
                ? {
                    background: 'transparent',
                    borderColor: 'transparent',
                    boxShadow: 'none',
                  }
                : {}),
            }}
          >
            {entryPhase !== 'message2Reveal' && (
              <>
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-accent" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-accent" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-accent" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-accent" />
              </>
            )}

            <div
              className="flex items-center gap-3 mb-6"
              style={{
                display:
                  entryPhase === 'message2Reveal' ? 'none' : undefined,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  flexShrink: 0,
                  border: '2px solid var(--color-accent)',
                  background: '#1a1a1a',
                  overflow: 'hidden',
                  position: 'relative',
                  boxShadow:
                    '3px 3px 0 rgba(0,0,0,0.45),' +
                    ' 0 0 14px rgba(75, 45, 142, 0.45)',
                }}
              >
                {adminInfo?.photoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={adminInfo.photoUrl}
                    alt={adminInfo?.name ?? 'lfgonzalezm0'}
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display =
                        'none';
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                )}
              </div>
              <span
                style={{
                  fontFamily: "'Silkscreen', cursive",
                  fontSize: '0.85rem',
                  letterSpacing: '0.08em',
                  color: '#e5e5e5',
                }}
              >
                {adminInfo?.name ?? 'lfgonzalezm0'}
              </span>
            </div>

            <p
              aria-label={
                entryPhase === 'message1'
                  ? ENTRY_MESSAGES[0]
                  : entryPhase === 'message2'
                    ? ENTRY_MESSAGES[1]
                    : entryPhase === 'message2Reveal'
                      ? REVEAL_TEXT
                      : ENTRY_MESSAGES[2]
              }
              className="text-digi-text text-center md:text-left min-h-[11rem]"
              style={{
                fontFamily: "'Silkscreen', cursive",
                fontSize:
                  entryPhase === 'message2Reveal'
                    ? 'clamp(1.4rem, 4.5vw, 2.4rem)'
                    : '0.8rem',
                lineHeight: '1.9',
                letterSpacing:
                  entryPhase === 'message2Reveal' ? '0.25em' : '0.03em',
                whiteSpace: 'pre-wrap',
                display: entryPhase === 'message2Reveal' ? 'flex' : undefined,
                flexWrap:
                  entryPhase === 'message2Reveal' ? 'wrap' : undefined,
                justifyContent:
                  entryPhase === 'message2Reveal' ? 'center' : undefined,
                alignItems:
                  entryPhase === 'message2Reveal' ? 'center' : undefined,
                color:
                  entryPhase === 'message2Reveal' ? '#ffffff' : undefined,
                textShadow:
                  entryPhase === 'message2Reveal'
                    ? '0 0 12px rgba(255,255,255,0.55), 2px 2px 0 rgba(0,0,0,0.6)'
                    : undefined,
              }}
            >
              {entryPhase === 'message2Reveal'
                ? REVEAL_TEXT.split('').map((ch, i) => (
                    <span
                      key={`reveal-${i}`}
                      style={{
                        display: 'inline-block',
                        animation: `letterShake 0.45s ease-in-out ${i * 0.05}s infinite, pixelFadeIn 0.35s ease-out ${i * 0.05}s backwards`,
                        willChange: 'transform',
                      }}
                    >
                      {ch === ' ' ? ' ' : ch}
                    </span>
                  ))
                : (
                    <>
                      {typedText}
                      {!typingDone && (
                        <span
                          aria-hidden="true"
                          style={{
                            display: 'inline-block',
                            width: 0,
                            height: '0.95em',
                            marginLeft: '2px',
                            borderRight: '2px solid #a78bfa',
                            verticalAlign: 'middle',
                            animation: 'blinkCaret 0.7s step-end infinite',
                          }}
                        />
                      )}
                    </>
                  )}
            </p>

            {capturedIdxs.length > 0 && entryPhase !== 'message2Reveal' && (
              <div className="flex flex-wrap gap-3 justify-center mt-7">
                {capturedIdxs.map((idx, i) => {
                  const v = VALUE_CHIPS[idx];
                  const c = colorForChip(idx);
                  return (
                    <span
                      key={`${idx}-${i}`}
                      className="px-3 py-1.5 border-2 inline-block"
                      style={{
                        fontFamily: "'Silkscreen', cursive",
                        fontSize: '0.7rem',
                        letterSpacing: '0.05em',
                        color: c,
                        borderColor: c,
                        background: `${c}1a`,
                        boxShadow: `3px 3px 0 rgba(0,0,0,0.4), 0 0 14px ${c}33`,
                        animation: `pixelFadeIn 0.4s ease-out, floatUpDown ${2.6 + (i % 4) * 0.4}s ease-in-out ${i * 0.18}s infinite 0.4s`,
                        willChange: 'transform',
                      }}
                    >
                      {v.label}
                    </span>
                  );
                })}
              </div>
            )}

            {entryPhase !== 'message2Reveal' && (
              <div className="pixel-divider mt-8 mb-4" />
            )}

            {actionsVisible && entryPhase !== 'message2Reveal' && (
              <div className="flex flex-col sm:flex-row gap-3 justify-center mt-7 mb-4">
                <button
                  onClick={() => setShowEntryModal(false)}
                  className="pixel-btn pixel-btn-primary"
                >
                  Aceptar
                </button>
                <button
                  onClick={() => setShowEntryModal(false)}
                  className="pixel-btn pixel-btn-secondary"
                >
                  Rechazar
                </button>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                minHeight: '2.6rem',
              }}
            >
              {typingDone &&
                (entryPhase === 'message1' ||
                  entryPhase === 'message2' ||
                  entryPhase === 'preChallenge') && (
                  <button
                    type="button"
                    onClick={() => {
                      if (entryPhase === 'message1') {
                        setEntryPhase('message2');
                      } else if (entryPhase === 'message2') {
                        setEntryPhase('message2Reveal');
                      } else if (entryPhase === 'preChallenge') {
                        // Center the chip on the viewport before kicking off
                        // the challenge, so every value spawns from the
                        // dead-centre regardless of its underlying mechanic.
                        const centerX = Math.max(
                          0,
                          window.innerWidth / 2 - CHIP_W / 2
                        );
                        const centerY = Math.max(
                          0,
                          window.innerHeight / 2 - CHIP_H / 2
                        );
                        setEntryPhase('challenge');
                        spawnChip(carouselIdx, {
                          x: centerX,
                          y: centerY,
                        });
                      }
                    }}
                    className="pixel-btn pixel-btn-primary"
                    style={{ pointerEvents: 'auto' }}
                  >
                    Siguiente
                  </button>
                )}
            </div>
          </div>

          {/* Value carousel — videogame-style character selection. */}
          {entryPhase === 'floatingChips' && (() => {
            const current = VALUE_CHIPS[carouselIdx];
            const goPrev = () =>
              setCarouselIdx(
                (prev) =>
                  (prev - 1 + VALUE_CHIPS.length) % VALUE_CHIPS.length
              );
            const goNext = () =>
              setCarouselIdx((prev) => (prev + 1) % VALUE_CHIPS.length);
            return (
              <div
                className="fixed inset-0 flex flex-col items-center justify-center px-6"
                style={{
                  zIndex: 60,
                  animation: 'pixelFadeIn 0.6s ease-out 0.45s backwards',
                }}
              >
                {/* Big value crest + label, pixel-art chip style with the
                    value's color */}
                <div
                  key={`carousel-${carouselIdx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 22,
                    fontFamily: "'Silkscreen', cursive",
                    fontSize: 'clamp(1.6rem, 5vw, 2.6rem)',
                    letterSpacing: '0.12em',
                    padding: '20px 48px',
                    border: `4px solid ${current.color}`,
                    background: `${current.color}1a`,
                    color: current.color,
                    boxShadow: `5px 5px 0 rgba(0,0,0,0.55), 0 0 36px ${current.color}66`,
                    textTransform: 'lowercase',
                    marginBottom: 36,
                    animation: 'pixelFadeIn 0.45s ease-out',
                  }}
                >
                  <ValueIcon
                    label={current.label}
                    color={current.color}
                    size={56}
                  />
                  <span>{current.label}</span>
                </div>

                {/* Description card — same style as the question modal */}
                <div
                  className="pixel-card relative"
                  style={{
                    width: 'min(620px, 92%)',
                    padding: '32px 28px',
                  }}
                >
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-accent" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-accent" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-accent" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-accent" />
                  <p
                    aria-label={current.description}
                    style={{
                      fontFamily: "'Silkscreen', cursive",
                      fontSize: '0.85rem',
                      lineHeight: '1.9',
                      letterSpacing: '0.03em',
                      color: '#e5e5e5',
                      textAlign: 'center',
                      minHeight: '4.2rem',
                    }}
                  >
                    {carouselTyped}
                    {!carouselTypingDone && (
                      <span
                        aria-hidden="true"
                        style={{
                          display: 'inline-block',
                          width: 0,
                          height: '0.95em',
                          marginLeft: '2px',
                          borderRight: '2px solid #a78bfa',
                          verticalAlign: 'middle',
                          animation: 'blinkCaret 0.7s step-end infinite',
                        }}
                      />
                    )}
                  </p>
                </div>

                {/* Confirmar — locks in the selected value and starts
                    only that challenge. */}
                <button
                  type="button"
                  onClick={() => setEntryPhase('preChallenge')}
                  className="pixel-btn pixel-btn-primary"
                  style={{ marginTop: 28 }}
                >
                  Confirmar
                </button>

                {/* Index indicator */}
                <div
                  aria-hidden="true"
                  style={{
                    marginTop: 18,
                    fontFamily: "'Silkscreen', cursive",
                    fontSize: '0.75rem',
                    letterSpacing: '0.18em',
                    color: '#94A3B8',
                  }}
                >
                  {carouselIdx + 1}/{VALUE_CHIPS.length}
                </div>

                {/* Left navigation */}
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label="Anterior"
                  style={{
                    position: 'absolute',
                    left: 28,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 60,
                    height: 60,
                    border: '3px solid var(--color-accent)',
                    background: 'rgba(28, 28, 36, 0.92)',
                    color: '#a78bfa',
                    fontFamily: "'Silkscreen', cursive",
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    boxShadow:
                      '4px 4px 0 rgba(0,0,0,0.55),' +
                      ' 0 0 18px rgba(139, 92, 246, 0.4)',
                  }}
                >
                  {'<'}
                </button>

                {/* Right navigation */}
                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Siguiente"
                  style={{
                    position: 'absolute',
                    right: 28,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 60,
                    height: 60,
                    border: '3px solid var(--color-accent)',
                    background: 'rgba(28, 28, 36, 0.92)',
                    color: '#a78bfa',
                    fontFamily: "'Silkscreen', cursive",
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    boxShadow:
                      '4px 4px 0 rgba(0,0,0,0.55),' +
                      ' 0 0 18px rgba(139, 92, 246, 0.4)',
                  }}
                >
                  {'>'}
                </button>
              </div>
            );
          })()}

          {/* Spaceship engine smoke (paciencia challenge) */}
          {chipMode === 'spaceship' &&
            pacienciaParticles.map((p) => {
              const t = Math.min(1, p.age / PACIENCIA_PARTICLE_LIFETIME_MS);
              const opacity = Math.max(0, 1 - t) * 0.55;
              const size = p.size * (1 + t * 1.4);
              return (
                <div
                  key={p.id}
                  aria-hidden="true"
                  style={{
                    position: 'fixed',
                    left: p.x - size / 2,
                    top: p.y - size / 2,
                    width: size,
                    height: size,
                    borderRadius: '50%',
                    background: `radial-gradient(circle, rgba(245,245,250,${opacity}) 0%, rgba(180,185,200,${opacity * 0.5}) 55%, rgba(120,125,140,0) 100%)`,
                    filter: 'blur(2px)',
                    pointerEvents: 'none',
                    zIndex: 58,
                    mixBlendMode: 'screen',
                  }}
                />
              );
            })}

          {/* Pureza phase panel — small pixel-card layered on top of the
              question modal containing the timer + two phase buttons or
              the Ambas button. Everything fades. */}
          {purezaChoiceIdx >= 0 && purezaChoiceIdx < PUREZA_PHASES.length && (
            <div
              className="fixed inset-0 flex items-center justify-center pointer-events-none"
              style={{ zIndex: 95 }}
            >
              <div
                className="pixel-card relative"
                style={{
                  width: 'min(520px, 92%)',
                  padding: '38px 32px 32px',
                  pointerEvents: 'auto',
                  animation: 'pixelFadeIn 0.45s ease-out',
                }}
              >
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-accent" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-accent" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-accent" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-accent" />

                {/* Timer + phase buttons (fade together) */}
                <div
                  style={{
                    opacity: purezaButtonsOpacity,
                    transition: `opacity ${PUREZA_FILL_FADE_MS}ms ease`,
                    pointerEvents:
                      purezaButtonsOpacity > 0.5 && !purezaVioletaVisible
                        ? 'auto'
                        : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 26,
                  }}
                >
                  {/* Countdown */}
                  <div
                    aria-hidden="true"
                    style={{
                      fontFamily: "'Silkscreen', cursive",
                      fontSize: '1.6rem',
                      letterSpacing: '0.12em',
                      padding: '8px 22px',
                      color: '#a78bfa',
                      background: 'rgba(28, 28, 36, 0.92)',
                      border: `2px solid ${PUREZA_VIOLET}`,
                      boxShadow:
                        '3px 3px 0 rgba(0,0,0,0.55),' +
                        ' 0 0 18px rgba(139, 92, 246, 0.45)',
                      minWidth: 76,
                      textAlign: 'center',
                    }}
                  >
                    {purezaSecondsLeft}s
                  </div>

                  {/* Two phase buttons in a row */}
                  <div
                    style={{
                      display: 'flex',
                      gap: 18,
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handlePurezaChoice('white')}
                      onMouseEnter={() => setPurezaHoveredSide('left')}
                      onMouseLeave={() => setPurezaHoveredSide(null)}
                      style={{
                        fontFamily: "'Silkscreen', cursive",
                        fontSize: '1rem',
                        letterSpacing: '0.12em',
                        padding: '14px 30px',
                        border: `3px solid ${PUREZA_VIOLET}`,
                        background: '#ffffff',
                        color: '#0a0a0a',
                        transform:
                          purezaHoveredSide === 'left'
                            ? 'scale(1.08)'
                            : 'scale(1)',
                        boxShadow:
                          purezaHoveredSide === 'left'
                            ? '5px 5px 0 rgba(0,0,0,0.65), 0 0 30px rgba(139, 92, 246, 0.75)'
                            : '4px 4px 0 rgba(0,0,0,0.6), 0 0 18px rgba(139, 92, 246, 0.45)',
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        transition:
                          'transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 180ms ease',
                      }}
                    >
                      {PUREZA_PHASES[purezaChoiceIdx].white}
                    </button>

                    <button
                      type="button"
                      onClick={() => handlePurezaChoice('black')}
                      onMouseEnter={() => setPurezaHoveredSide('right')}
                      onMouseLeave={() => setPurezaHoveredSide(null)}
                      style={{
                        fontFamily: "'Silkscreen', cursive",
                        fontSize: '1rem',
                        letterSpacing: '0.12em',
                        padding: '14px 30px',
                        border: `3px solid ${PUREZA_VIOLET}`,
                        background: '#000000',
                        color: '#ffffff',
                        transform:
                          purezaHoveredSide === 'right'
                            ? 'scale(1.08)'
                            : 'scale(1)',
                        boxShadow:
                          purezaHoveredSide === 'right'
                            ? '5px 5px 0 rgba(0,0,0,0.65), 0 0 30px rgba(139, 92, 246, 0.75)'
                            : '4px 4px 0 rgba(0,0,0,0.6), 0 0 18px rgba(139, 92, 246, 0.45)',
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        transition:
                          'transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 180ms ease',
                      }}
                    >
                      {PUREZA_PHASES[purezaChoiceIdx].black}
                    </button>
                  </div>
                </div>

                {/* Ambas button — fades in/out, sits at the same place as
                    the timer/buttons block via absolute positioning. */}
                <button
                  type="button"
                  onClick={() => handlePurezaChoice('violeta')}
                  aria-label="Ambas"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    fontFamily: "'Silkscreen', cursive",
                    fontSize: '1.05rem',
                    letterSpacing: '0.14em',
                    padding: '16px 42px',
                    border: `3px solid ${PUREZA_VIOLET}`,
                    background: PUREZA_VIOLET,
                    color: '#ffffff',
                    boxShadow:
                      '4px 4px 0 rgba(0,0,0,0.6),' +
                      ' 0 0 28px rgba(139, 92, 246, 0.85),' +
                      ' 0 0 60px rgba(139, 92, 246, 0.45)',
                    cursor: purezaVioletaVisible ? 'pointer' : 'default',
                    textTransform: 'uppercase',
                    opacity: purezaVioletaVisible ? 1 : 0,
                    pointerEvents: purezaVioletaVisible ? 'auto' : 'none',
                    transition: `opacity ${PUREZA_FILL_FADE_MS}ms ease`,
                  }}
                >
                  Ambas
                </button>
              </div>
            </div>
          )}

          {/* Beacon light (fe challenge) — white core with yellow halo */}
          {chipMode === 'beacon' && beaconPos && (
            <div
              aria-hidden="true"
              style={{
                position: 'fixed',
                left: beaconPos.x - BEACON_DOT_SIZE / 2,
                top: beaconPos.y - BEACON_DOT_SIZE / 2,
                width: BEACON_DOT_SIZE,
                height: BEACON_DOT_SIZE,
                borderRadius: '50%',
                background:
                  'radial-gradient(circle, #ffffff 0%, #fffceb 28%, rgba(253, 224, 71, 0.85) 55%, rgba(251, 191, 36, 0.35) 80%, rgba(251, 191, 36, 0) 100%)',
                opacity: beaconOpacity,
                animation: 'beaconPulse 1.8s ease-in-out infinite',
                transition: `opacity ${beaconTransitionMs}ms ease, left ${beaconTransitionMs}ms ease-out, top ${beaconTransitionMs}ms ease-out`,
                pointerEvents: 'none',
                zIndex: 60,
                willChange: 'transform, opacity',
              }}
            />
          )}

          {/* Chip activo */}
          {showChipElement && activeChip && (
            <button
              type="button"
              onClick={handleChipClick}
              aria-label={`Atrapar ${activeChip.label}`}
              className="px-3 py-1.5 border-2 inline-block select-none"
              style={{
                position: 'fixed',
                left: chipPos.x,
                top: chipPos.y,
                width: CHIP_W,
                fontFamily: "'Silkscreen', cursive",
                fontSize: '0.7rem',
                letterSpacing: '0.05em',
                color: activeChipIdx !== null ? colorForChip(activeChipIdx) : activeChip.color,
                borderColor: activeChipIdx !== null ? colorForChip(activeChipIdx) : activeChip.color,
                background: `${activeChipIdx !== null ? colorForChip(activeChipIdx) : activeChip.color}1a`,
                boxShadow: (() => {
                  const c = activeChipIdx !== null ? colorForChip(activeChipIdx) : activeChip.color;
                  const base = isClickable
                    ? `3px 3px 0 rgba(0,0,0,0.4), 0 0 22px ${c}99`
                    : `3px 3px 0 rgba(0,0,0,0.4), 0 0 14px ${c}55`;
                  return rapidFlashing
                    ? `${base}, 0 0 42px 12px rgba(255, 255, 255, 0.85)`
                    : base;
                })(),
                animation:
                  activeChip.challenge === 'beacon'
                    ? 'feReveal 0.95s ease-out, floatUpDown 2.8s ease-in-out 0.95s infinite'
                    : activeChip.challenge === 'spaceship' && chipMode === 'spaceship'
                      ? 'none'
                      : 'floatUpDown 2.8s ease-in-out infinite',
                opacity: chipOpacity,
                cursor: isClickable ? 'pointer' : 'default',
                pointerEvents: isClickable ? 'auto' : 'none',
                transition: `opacity ${FADE_MS}ms ease, box-shadow 250ms ease`,
                zIndex: 60,
                overflow: 'hidden',
                willChange: 'transform, opacity',
              }}
            >
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <ValueIcon
                  label={activeChip.label}
                  color={
                    activeChipIdx !== null
                      ? colorForChip(activeChipIdx)
                      : activeChip.color
                  }
                  size={22}
                />
                <span>{activeChip.label}</span>
              </span>
              {activeChip.challenge === 'rapid' && (
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: 0,
                    bottom: 0,
                    height: 3,
                    width: `${rapidPct}%`,
                    background: activeChip.color,
                    boxShadow: `0 0 8px ${activeChip.color}`,
                    transition: 'width 100ms ease-out',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </button>
          )}

          {/* ====== SERIEDAD DIALOG ====== */}
          {seriedadStage !== 'idle' && (
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-0 flex items-center justify-center p-4 sm:p-6"
              style={{
                zIndex: 80,
                backgroundColor: 'rgba(0, 0, 0, 0.92)',
                backdropFilter: 'blur(2px)',
              }}
            >
              <div
                className="pixel-card w-full max-w-4xl relative"
                style={{
                  minHeight: '70vh',
                  maxHeight: '92vh',
                  overflowY: 'auto',
                  opacity: seriedadOpacity,
                  transition: `opacity ${SERIEDAD_FADE_MS}ms ease`,
                }}
              >
                {/* Decorative corners */}
                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-accent" />
                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-accent" />
                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-accent" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-accent" />

                <SeriedadCaret done={seriedadTypingDone}>
                  {(caret) => {
                    const baseTextStyle: React.CSSProperties = {
                      fontFamily: "'Silkscreen', cursive",
                      fontSize: '0.95rem',
                      lineHeight: '2',
                      letterSpacing: '0.03em',
                      color: '#e5e5e5',
                      whiteSpace: 'pre-wrap',
                    };

                    if (
                      seriedadStage === 'q1' ||
                      seriedadStage === 'q3'
                    ) {
                      return (
                        <div className="flex items-center justify-center min-h-[60vh] px-4 md:px-10 text-center">
                          <p style={baseTextStyle}>
                            {seriedadTyped}
                            {!seriedadTypingDone && caret}
                          </p>
                        </div>
                      );
                    }

                    if (seriedadStage === 'q2') {
                      return (
                        <div
                          className="grid grid-cols-1 md:grid-cols-[2fr_3fr] gap-6 items-center min-h-[60vh] p-4 md:p-8"
                          style={{ animation: 'pixelFadeIn 0.55s ease-out' }}
                        >
                          <div
                            aria-hidden="true"
                            className="w-full justify-self-center md:justify-self-start"
                            style={{
                              aspectRatio: '2 / 3',
                              maxWidth: 280,
                              backgroundImage: 'url(/Pixelart1.avif)',
                              backgroundSize: '220%',
                              backgroundPosition: '40% 85%',
                              backgroundRepeat: 'no-repeat',
                              imageRendering: 'pixelated',
                              border: '2px solid var(--color-accent)',
                              boxShadow: '4px 4px 0 rgba(0,0,0,0.5), 0 0 22px rgba(75, 45, 142, 0.35)',
                            }}
                          />
                          <p style={baseTextStyle}>
                            {seriedadTyped}
                            {!seriedadTypingDone && caret}
                          </p>
                        </div>
                      );
                    }

                    if (seriedadStage === 'q4' || seriedadStage === 'choice') {
                      return (
                        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 md:px-10 text-center gap-10">
                          <p style={baseTextStyle}>
                            {seriedadTyped}
                            {!seriedadTypingDone && seriedadStage === 'q4' && caret}
                          </p>
                          {seriedadStage === 'choice' && (
                            <div
                              className="flex flex-col sm:flex-row gap-4"
                              style={{ animation: 'pixelFadeIn 0.5s ease-out' }}
                            >
                              <button
                                className="pixel-btn pixel-btn-primary"
                                onClick={() => {
                                  setSeriedadOpacity(0);
                                  window.setTimeout(() => {
                                    setSeriedadStage('why');
                                    setSeriedadOpacity(1);
                                  }, SERIEDAD_FADE_MS);
                                }}
                              >
                                Luchar
                              </button>
                              <button
                                className="pixel-btn pixel-btn-secondary"
                                onClick={() => {
                                  setSeriedadOpacity(0);
                                  window.setTimeout(() => {
                                    setSeriedadStage('ok');
                                    setSeriedadOpacity(1);
                                  }, SERIEDAD_FADE_MS);
                                }}
                              >
                                Ignorar
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    }

                    if (seriedadStage === 'ok') {
                      return (
                        <div className="flex items-center justify-center min-h-[60vh] px-4 md:px-10 text-center">
                          <p style={{ ...baseTextStyle, fontSize: '1.4rem' }}>
                            {seriedadTyped}
                            {!seriedadTypingDone && caret}
                          </p>
                        </div>
                      );
                    }

                    if (seriedadStage === 'why') {
                      return (
                        <div className="flex flex-col gap-6 min-h-[70vh] p-4 md:p-8">
                          <p style={{ ...baseTextStyle, textAlign: 'center' }}>
                            {seriedadTyped}
                            {!seriedadTypingDone && caret}
                          </p>
                          <textarea
                            value={seriedadWhyText}
                            onChange={(e) => setSeriedadWhyText(e.target.value)}
                            placeholder="Escribe tu razón completa..."
                            className="flex-1 w-full p-4 bg-digi-darker border-2 border-digi-border text-digi-text outline-none focus:border-accent transition-colors"
                            style={{
                              fontFamily: "'Silkscreen', cursive",
                              fontSize: '0.85rem',
                              lineHeight: '1.8',
                              minHeight: '40vh',
                              resize: 'none',
                            }}
                          />
                          <div className="flex justify-center">
                            <button
                              className="pixel-btn pixel-btn-primary"
                              disabled={seriedadWhyText.trim().length < 1}
                              style={
                                seriedadWhyText.trim().length < 1
                                  ? { opacity: 0.45, cursor: 'not-allowed' }
                                  : undefined
                              }
                              onClick={() => {
                                if (seriedadWhyText.trim().length < 1) return;
                                setSeriedadOpacity(0);
                                window.setTimeout(() => {
                                  setSeriedadStage('really');
                                  setSeriedadOpacity(1);
                                }, SERIEDAD_FADE_MS);
                              }}
                            >
                              Continuar
                            </button>
                          </div>
                        </div>
                      );
                    }

                    if (seriedadStage === 'really') {
                      return (
                        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 md:px-10 text-center gap-10">
                          <p style={{ ...baseTextStyle, fontSize: '1.6rem' }}>
                            {seriedadTyped}
                            {!seriedadTypingDone && caret}
                          </p>
                          {seriedadTypingDone && (
                            <button
                              className="pixel-btn pixel-btn-primary"
                              style={{ animation: 'pixelFadeIn 0.4s ease-out' }}
                              onClick={() => {
                                // Each click resets the patience timer (via dep)
                                // and re-runs the typewriter for visual reappearance.
                                setSeriedadOpacity(0);
                                window.setTimeout(() => {
                                  setSeriedadSiClicks((c) => c + 1);
                                  setSeriedadOpacity(1);
                                }, SERIEDAD_FADE_MS);
                              }}
                            >
                              Sí
                            </button>
                          )}
                        </div>
                      );
                    }

                    if (seriedadStage === 'finalQ') {
                      return (
                        <div className="flex flex-col gap-6 min-h-[70vh] p-4 md:p-8">
                          <p style={{ ...baseTextStyle, textAlign: 'center' }}>
                            {seriedadTyped}
                            {!seriedadTypingDone && caret}
                          </p>
                          <textarea
                            value={seriedadFinalText}
                            onChange={(e) => setSeriedadFinalText(e.target.value)}
                            placeholder="Escribe tu respuesta..."
                            className="flex-1 w-full p-4 bg-digi-darker border-2 border-digi-border text-digi-text outline-none focus:border-accent transition-colors"
                            style={{
                              fontFamily: "'Silkscreen', cursive",
                              fontSize: '0.85rem',
                              lineHeight: '1.8',
                              minHeight: '34vh',
                              resize: 'none',
                            }}
                          />
                          <div className="flex justify-center">
                            <button
                              className="pixel-btn pixel-btn-primary"
                              disabled={seriedadFinalText.trim().length < 1}
                              style={
                                seriedadFinalText.trim().length < 1
                                  ? { opacity: 0.45, cursor: 'not-allowed' }
                                  : undefined
                              }
                              onClick={() => {
                                if (seriedadFinalText.trim().length < 1) return;
                                // Close the dialog and reveal the seriedad chip
                                // for a normal capture click.
                                setSeriedadOpacity(0);
                                window.setTimeout(() => {
                                  setSeriedadStage('idle');
                                  setSeriedadOpacity(1);
                                  setChipMode('catchable');
                                  setChipOpacity(0);
                                  requestAnimationFrame(() => setChipOpacity(1));
                                  window.setTimeout(() => setChipOpacity(1), 80);
                                }, SERIEDAD_FADE_MS);
                              }}
                            >
                              Enviar
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return null;
                  }}
                </SeriedadCaret>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// One-of-a-kind crest icon per value (Digimon-style symbolic SVG). Each
// uses the value's main colour as fill and a darker outline for depth.
function ValueIcon({
  label,
  color,
  size = 26,
}: {
  label: string;
  color: string;
  size?: number;
}) {
  // Pick a darker outline by hash of the colour so we stay close to the
  // value's hue without manual mapping.
  const outline =
    {
      determinación: '#7f1d1d',
      coraje: '#7c2d12',
      pureza: '#0c4a6e',
      fe: '#92400e',
      paciencia: '#064e3b',
      seriedad: '#1e1b4b',
      espontaneidad: '#831843',
      autonomía: '#164e63',
      empatía: '#3b0764',
    }[label] ?? '#0a0a0a';

  const common = {
    width: size,
    height: size,
    viewBox: '0 0 32 32',
    style: { display: 'block', flexShrink: 0 } as React.CSSProperties,
  };

  switch (label) {
    case 'determinación':
      // Thick upward arrow piercing through — insistir, avanzar.
      return (
        <svg {...common}>
          <polygon
            points="16,3 29,16 23,16 23,29 9,29 9,16 3,16"
            fill={color}
            stroke={outline}
            strokeWidth="1.4"
            strokeLinejoin="miter"
          />
        </svg>
      );

    case 'coraje':
      // Flame with inner highlight — confrontar y arder.
      return (
        <svg {...common}>
          <path
            d="M 16 3 C 22 9 22 15 18 17 C 22 18 22 24 16 29 C 10 24 10 18 14 17 C 10 15 10 9 16 3 Z"
            fill={color}
            stroke={outline}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path
            d="M 16 13 C 18 16 18 21 16 25 C 14 21 14 16 16 13 Z"
            fill="#fde047"
          />
        </svg>
      );

    case 'pureza':
      // 6-arm snowflake — claridad, esencia.
      return (
        <svg {...common}>
          <g stroke={color} strokeWidth="2.2" fill="none" strokeLinecap="round">
            <line x1="16" y1="3" x2="16" y2="29" />
            <line x1="5.4" y1="9.5" x2="26.6" y2="22.5" />
            <line x1="5.4" y1="22.5" x2="26.6" y2="9.5" />
            <polyline points="13,5 16,8 19,5" />
            <polyline points="13,27 16,24 19,27" />
            <polyline points="6,12 9,12 9,9" />
            <polyline points="6,20 9,20 9,23" />
            <polyline points="26,12 23,12 23,9" />
            <polyline points="26,20 23,20 23,23" />
          </g>
          <circle cx="16" cy="16" r="2.4" fill={color} stroke={outline} strokeWidth="0.8" />
        </svg>
      );

    case 'fe':
      // 5-pointed star — guía, luz, esperanza.
      return (
        <svg {...common}>
          <polygon
            points="16,3 19.5,12 29,12 21.2,17.7 24.2,27 16,21.5 7.8,27 10.8,17.7 3,12 12.5,12"
            fill={color}
            stroke={outline}
            strokeWidth="1.2"
            strokeLinejoin="miter"
          />
        </svg>
      );

    case 'paciencia':
      // Hourglass with falling sand stream.
      return (
        <svg {...common} stroke={outline} strokeWidth="1">
          <rect x="6" y="3" width="20" height="2" fill={color} />
          <rect x="6" y="27" width="20" height="2" fill={color} />
          <path d="M 8 5 L 24 5 L 16 16 Z" fill={color} />
          <path d="M 16 16 L 24 27 L 8 27 Z" fill="#065f46" />
          <line x1="16" y1="14" x2="16" y2="22" stroke="#fde047" strokeWidth="1.4" />
        </svg>
      );

    case 'seriedad':
      // Diamond with closed eye — observación firme.
      return (
        <svg {...common}>
          <polygon
            points="16,3 29,16 16,29 3,16"
            fill={color}
            stroke={outline}
            strokeWidth="1.4"
            strokeLinejoin="miter"
          />
          <ellipse cx="16" cy="16" rx="7" ry="3.4" fill={outline} />
          <circle cx="16" cy="16" r="1.8" fill="#a5b4fc" />
        </svg>
      );

    case 'espontaneidad':
      // 4-petal flower with bright centre — soltura, naturalidad.
      return (
        <svg {...common} stroke={outline} strokeWidth="1">
          <ellipse cx="16" cy="6" rx="3.6" ry="6" fill={color} />
          <ellipse cx="16" cy="26" rx="3.6" ry="6" fill={color} />
          <ellipse cx="6" cy="16" rx="6" ry="3.6" fill={color} />
          <ellipse cx="26" cy="16" rx="6" ry="3.6" fill={color} />
          <circle cx="16" cy="16" r="3.6" fill="#fde047" />
        </svg>
      );

    case 'autonomía':
      // Bird in flight — libertad propia.
      return (
        <svg {...common} stroke={outline} strokeWidth="1">
          <path
            d="M 16 17 Q 9 6 3 14 Q 9 13 14 17 Z"
            fill={color}
          />
          <path
            d="M 16 17 Q 23 6 29 14 Q 23 13 18 17 Z"
            fill={color}
          />
          <ellipse cx="16" cy="22" rx="2.4" ry="6.5" fill={color} />
          <circle cx="16" cy="13" r="2.4" fill={color} />
        </svg>
      );

    case 'empatía':
      // Heart with inner accent — encuentro con el otro.
      return (
        <svg {...common}>
          <path
            d="M 16 28 C 4 20 4 8 11 8 C 14 8 16 11 16 14 C 16 11 18 8 21 8 C 28 8 28 20 16 28 Z"
            fill={color}
            stroke={outline}
            strokeWidth="1.2"
          />
          <path
            d="M 16 22 C 9 17 9 12 13 12 C 14.5 12 16 13.5 16 15 C 16 13.5 17.5 12 19 12 C 23 12 23 17 16 22 Z"
            fill="#f5f3ff"
            opacity="0.45"
          />
        </svg>
      );

    default:
      return null;
  }
}

// Tiny helper that renders a blinking caret children-as-function style so each
// stage can decide whether to show it.
function SeriedadCaret({
  done,
  children,
}: {
  done: boolean;
  children: (caret: React.ReactNode) => React.ReactNode;
}) {
  const caret = (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 0,
        height: '0.95em',
        marginLeft: '2px',
        borderRight: '2px solid #a78bfa',
        verticalAlign: 'middle',
        animation: 'blinkCaret 0.7s step-end infinite',
      }}
    />
  );
  return <>{children(done ? null : caret)}</>;
}
