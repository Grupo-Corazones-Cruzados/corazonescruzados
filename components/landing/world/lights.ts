// Light source data + per-frame animation math. Shared between the
// editor preview, the gameplay overlay and the lights API.

export type LightMode = 'steady' | 'blink' | 'pulse' | 'flicker' | 'rainbow';

export type LightSource = {
  id: number;
  x: number; // tile col
  y: number; // tile row
  radius: number; // tiles
  color: string; // hex (#rrggbb) — ignored by `rainbow`
  mode: LightMode;
  periodMs: number;
  intensity: number; // 0..1
};

export const LIGHT_MODE_OPTIONS: { id: LightMode; label: string }[] = [
  { id: 'steady', label: 'Constante' },
  { id: 'blink', label: 'Encendido / apagado' },
  { id: 'pulse', label: 'Latido suave' },
  { id: 'flicker', label: 'Antorcha' },
  { id: 'rainbow', label: 'Arcoíris' },
];

// Per-light deterministic seed for `flicker` so each light bobs on its
// own schedule instead of all blinking together.
function seedFor(id: number) {
  return (Math.sin(id * 9301 + 49297) + 1) / 2; // 0..1
}

export type LightFrame = { alpha: number; color: string };

export function computeLightFrame(
  light: LightSource,
  nowMs: number,
): LightFrame {
  const baseAlpha = Math.max(0, Math.min(1, light.intensity));
  const period = Math.max(50, light.periodMs);
  const phase = (nowMs / period) % 1;
  let alpha = baseAlpha;
  let color = light.color;

  switch (light.mode) {
    case 'steady':
      break;
    case 'blink':
      alpha = phase < 0.5 ? baseAlpha : 0;
      break;
    case 'pulse':
      // Smooth in/out between 0.45 and 1.0 of intensity.
      alpha = baseAlpha * (0.45 + 0.55 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2)));
      break;
    case 'flicker': {
      // Layer a few sine waves at different frequencies, biased high
      // so the light stays mostly on but jitters like a torch.
      const seed = seedFor(light.id) * 1000;
      const t = nowMs / period;
      const a =
        0.5 + 0.5 * Math.sin(t * 11 + seed) * 0.4 +
        0.5 * Math.sin(t * 23 + seed * 1.7) * 0.25 +
        0.5 * Math.sin(t * 53 + seed * 0.3) * 0.15;
      alpha = baseAlpha * Math.max(0.35, Math.min(1, 0.6 + a));
      break;
    }
    case 'rainbow':
      color = hslToHex((phase * 360) % 360, 0.85, 0.6);
      break;
  }
  return { alpha, color };
}

function hslToHex(h: number, s: number, l: number): string {
  // Standard HSL → RGB.
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hh = (h % 360) / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hh < 1) [r, g, b] = [c, x, 0];
  else if (hh < 2) [r, g, b] = [x, c, 0];
  else if (hh < 3) [r, g, b] = [0, c, x];
  else if (hh < 4) [r, g, b] = [0, x, c];
  else if (hh < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  const to = (n: number) =>
    Math.max(0, Math.min(255, Math.round((n + m) * 255)))
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

// Parse #rrggbb into [r, g, b] integers. Falls back to white on any
// malformed input — light parsing must never throw mid-frame.
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return [255, 255, 255];
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

// Paint one frame of the lighting overlay onto a 2D context that
// covers a `pxW × pxH` source area. `tilePx` is the size of one tile
// in source pixels. Lights are positioned in tile coordinates.
export function paintLightingFrame(
  ctx: CanvasRenderingContext2D,
  pxW: number,
  pxH: number,
  tilePx: number,
  ambientDarkness: number,
  lights: LightSource[],
  nowMs: number,
) {
  ctx.save();
  // 1. Fill the canvas with ambient darkness.
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(5, 6, 18, ${Math.max(0, Math.min(1, ambientDarkness))})`;
  ctx.fillRect(0, 0, pxW, pxH);

  // 2. Punch holes in the darkness for each light using a radial
  //    gradient with destination-out (subtracts alpha from the dark).
  ctx.globalCompositeOperation = 'destination-out';
  const punchFrames: { x: number; y: number; r: number; frame: LightFrame }[] = [];
  for (const light of lights) {
    const frame = computeLightFrame(light, nowMs);
    if (frame.alpha <= 0) continue;
    const cx = light.x * tilePx + tilePx / 2;
    const cy = light.y * tilePx + tilePx / 2;
    const r = light.radius * tilePx;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `rgba(255,255,255,${frame.alpha})`);
    grad.addColorStop(0.6, `rgba(255,255,255,${frame.alpha * 0.55})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    punchFrames.push({ x: cx, y: cy, r, frame });
  }

  // 3. Add a colored tint at the punched holes so coloured lights
  //    tint the lit area instead of just punching neutral light.
  ctx.globalCompositeOperation = 'lighter';
  for (const p of punchFrames) {
    const [r, g, b] = hexToRgb(p.frame.color);
    const tintAlpha = p.frame.alpha * 0.35;
    if (tintAlpha <= 0) continue;
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    grad.addColorStop(0, `rgba(${r},${g},${b},${tintAlpha})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
