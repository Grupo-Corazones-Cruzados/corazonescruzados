"use client";

import { useState, useEffect, type ReactNode } from "react";

/* ── Time helpers ─────────────────────────────────── */

function getDarknessFactor(): number {
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60;

  if (h >= 8 && h < 18) return 0;          // day
  if (h >= 20 || h < 6) return 1;           // night
  if (h >= 6 && h < 8) return smoothstep(1 - (h - 6) / 2); // dawn 1→0
  return smoothstep((h - 18) / 2);          // dusk 0→1
}

/** Smooth ease-in-out for natural light transitions */
function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/* ── Color math ───────────────────────────────────── */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function lerpHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

function lerpNum(a: number, b: number, t: number): string {
  return (a + (b - a) * t).toFixed(3);
}

/* ── Light / Dark pairs: [light, dark] ────────────── */

const PAIRS: Record<string, [string, string]> = {
  // Gray scale (some used directly in hover states)
  "--gray-50":  ["#F8FAFC", "#111722"],
  "--gray-100": ["#F1F5F9", "#1A2233"],
  "--gray-200": ["#E2E8F0", "#243044"],
  "--gray-300": ["#CBD5E1", "#334155"],
  "--gray-400": ["#94A3B8", "#4B5C73"],
  "--gray-500": ["#64748B", "#7A8BA0"],
  "--gray-600": ["#475569", "#94A3B8"],
  "--gray-700": ["#334155", "#B0BDD0"],
  "--gray-800": ["#1E2A3A", "#D0D8E4"],
  "--gray-900": ["#131923", "#E8ECF2"],
  "--gray-950": ["#0A0E17", "#F4F6F9"],

  // Surfaces
  "--bg":           ["#FFFFFF", "#0C1017"],
  "--bg-secondary": ["#F8FAFC", "#111722"],
  "--bg-tertiary":  ["#F1F5F9", "#1A2233"],
  "--bg-elevated":  ["#FFFFFF", "#182030"],

  // Text
  "--text-primary":   ["#131923", "#EAEFF5"],
  "--text-secondary": ["#64748B", "#8C9DB3"],
  "--text-tertiary":  ["#94A3B8", "#5A6B80"],
  "--text-inverse":   ["#FFFFFF", "#0C1017"],

  // Borders
  "--border":        ["#E2E8F0", "#1E2A3A"],
  "--border-light":  ["#F1F5F9", "#161D2A"],
  "--border-strong": ["#CBD5E1", "#2D3D50"],

  // Semantic backgrounds
  "--accent-light":  ["#EDEBFA", "#1C1540"],
  "--success-light": ["#EDF7ED", "#132213"],
  "--warning-light": ["#FFF8E6", "#2A2010"],
  "--error-light":   ["#FDEEED", "#2A1212"],
  "--info-light":    ["#EBF7FF", "#0E1E2E"],
};

/* ── Component ────────────────────────────────────── */

export default function DaytimeTheme({ children }: { children: ReactNode }) {
  // Start with 0 (light) to match SSR / :root defaults
  const [factor, setFactor] = useState(0);

  useEffect(() => {
    setFactor(getDarknessFactor());
    const id = setInterval(() => setFactor(getDarknessFactor()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Build CSS variable overrides
  const vars: Record<string, string> = {};

  for (const [key, [light, dark]] of Object.entries(PAIRS)) {
    vars[key] = lerpHex(light, dark, factor);
  }

  // bg-glass: derived from --bg with alpha
  const bgRgb = hexToRgb(vars["--bg"]);
  vars["--bg-glass"] = `rgba(${bgRgb[0]}, ${bgRgb[1]}, ${bgRgb[2]}, 0.72)`;

  // Shadows: boost opacity in dark mode (4x at full dark)
  const s = (base: number) => lerpNum(base, Math.min(base * 5, 0.5), factor);
  vars["--shadow-xs"] = `0 1px 2px rgba(0,0,0,${s(0.04)})`;
  vars["--shadow-sm"] = `0 1px 3px rgba(0,0,0,${s(0.06)}), 0 1px 2px rgba(0,0,0,${s(0.04)})`;
  vars["--shadow-md"] = `0 4px 6px -1px rgba(0,0,0,${s(0.06)}), 0 2px 4px -1px rgba(0,0,0,${s(0.04)})`;
  vars["--shadow-lg"] = `0 10px 15px -3px rgba(0,0,0,${s(0.08)}), 0 4px 6px -2px rgba(0,0,0,${s(0.04)})`;
  vars["--shadow-xl"] = `0 20px 25px -5px rgba(0,0,0,${s(0.1)}), 0 10px 10px -5px rgba(0,0,0,${s(0.06)})`;

  return (
    <div
      style={{
        ...vars,
        background: vars["--bg"],
        color: vars["--text-primary"],
        minHeight: "100vh",
      } as React.CSSProperties}
    >
      {children}
    </div>
  );
}
