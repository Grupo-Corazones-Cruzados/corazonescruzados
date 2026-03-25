// Digimon sounds — real audio from Digimon Rumble Arena 2
// with 8-bit synthesized fallback for digimon without audio files
//
// Two sound events:
//   - select: plays when clicking/selecting a digimon (intro voice)
//   - done:   plays when a digimon completes a task (gotit/celebration)

// Digimon that have real .m4a sound files
const AUDIO_FILES = new Set([
  'agumon', 'gabumon', 'patamon', 'veemon', 'gomamon',
]);

// 8-bit synthesized fallback for digimon without audio files
type OscType = OscillatorType;
interface SynthDef {
  notes: { freq: number; duration: number }[];
  wave: OscType;
  volume: number;
}

const SYNTH_SELECT: Record<string, SynthDef> = {
  piyomon: {
    notes: [
      { freq: 350, duration: 0.05 }, { freq: 500, duration: 0.04 },
      { freq: 420, duration: 0.05 }, { freq: 580, duration: 0.04 },
      { freq: 460, duration: 0.06 },
    ],
    wave: 'sawtooth', volume: 0.12,
  },
  shoutmon: {
    notes: [
      { freq: 300, duration: 0.05 }, { freq: 450, duration: 0.05 },
      { freq: 600, duration: 0.06 }, { freq: 750, duration: 0.07 },
      { freq: 680, duration: 0.08 },
    ],
    wave: 'square', volume: 0.13,
  },
};

const SYNTH_DONE: Record<string, SynthDef> = {
  piyomon: {
    notes: [
      { freq: 400, duration: 0.06 }, { freq: 500, duration: 0.06 },
      { freq: 600, duration: 0.06 }, { freq: 800, duration: 0.10 },
    ],
    wave: 'triangle', volume: 0.15,
  },
  shoutmon: {
    notes: [
      { freq: 500, duration: 0.05 }, { freq: 600, duration: 0.05 },
      { freq: 700, duration: 0.06 }, { freq: 900, duration: 0.10 },
    ],
    wave: 'square', volume: 0.15,
  },
};

const DEFAULT_SELECT: SynthDef = {
  notes: [
    { freq: 440, duration: 0.06 }, { freq: 520, duration: 0.06 }, { freq: 440, duration: 0.08 },
  ],
  wave: 'sine', volume: 0.12,
};

const DEFAULT_DONE: SynthDef = {
  notes: [
    { freq: 523, duration: 0.08 }, { freq: 659, duration: 0.08 },
    { freq: 784, duration: 0.08 }, { freq: 1047, duration: 0.12 },
  ],
  wave: 'sine', volume: 0.15,
};

let audioCtx: AudioContext | null = null;
const audioCache = new Map<string, HTMLAudioElement>();

function getAudioCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playSynth(def: SynthDef) {
  const ctx = getAudioCtx();
  let t = ctx.currentTime;
  for (const note of def.notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = def.wave;
    osc.frequency.setValueAtTime(note.freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(def.volume, t + 0.01);
    gain.gain.linearRampToValueAtTime(0, t + note.duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + note.duration + 0.01);
    t += note.duration;
  }
}

function playFile(key: string, volume = 0.4) {
  let audio = audioCache.get(key);
  if (!audio) {
    audio = new Audio(`/sounds/digimon/${key}.m4a`);
    audioCache.set(key, audio);
  }
  audio.volume = volume;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

// Cooldown tracking per event type
const lastPlayed: Record<string, { agent: string; time: number }> = {};
const COOLDOWN_MS = 1200;

function shouldPlay(event: string, spriteId: string): boolean {
  const now = Date.now();
  const last = lastPlayed[event];
  if (last && last.agent === spriteId && now - last.time < COOLDOWN_MS) return false;
  lastPlayed[event] = { agent: spriteId, time: now };
  return true;
}

/** Play when selecting/clicking a digimon */
export function playDigimonSelect(spriteId: string): void {
  if (!shouldPlay('select', spriteId)) return;
  if (AUDIO_FILES.has(spriteId)) {
    playFile(`${spriteId}_select`, 0.35);
  } else {
    playSynth(SYNTH_SELECT[spriteId] || DEFAULT_SELECT);
  }
}

/** Play when a digimon completes a task */
export function playDigimonDone(spriteId: string): void {
  if (!shouldPlay('done', spriteId)) return;
  if (AUDIO_FILES.has(spriteId)) {
    playFile(`${spriteId}_done`, 0.45);
  } else {
    playSynth(SYNTH_DONE[spriteId] || DEFAULT_DONE);
  }
}

/** Play when a digimon eats */
export function playDigimonEat(spriteId: string): void {
  if (!shouldPlay('eat', spriteId)) return;
  if (AUDIO_FILES.has(spriteId)) {
    playFile(`${spriteId}_eat`, 0.4);
  } else {
    // Cute munch synth fallback
    playSynth({
      notes: [
        { freq: 300, duration: 0.05 }, { freq: 400, duration: 0.04 },
        { freq: 350, duration: 0.05 }, { freq: 450, duration: 0.04 },
        { freq: 380, duration: 0.06 },
      ],
      wave: 'sine', volume: 0.12,
    });
  }
}
