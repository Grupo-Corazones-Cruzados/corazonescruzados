// Dominio condiciológico COMPARTIDO por los sistemas Metodología Condiciológica,
// Gestión de Condiciones y Dinámica Condiciológica. Sin dependencias de DB.

// ── Metodología: 6 pasos (Reconocer → … → Cambiar) ────────────────────────────
export const METODOLOGIA_PASOS = [
  { key: 'reconocer',    label: 'Reconocer' },
  { key: 'controlar',    label: 'Controlar' },
  { key: 'predecir',     label: 'Predecir' },
  { key: 'experimentar', label: 'Experimentar' },
  { key: 'convertir',    label: 'Convertir' },
  { key: 'cambiar',      label: 'Cambiar' },
] as const;
export type MetodologiaPaso = (typeof METODOLOGIA_PASOS)[number]['key'];

// ── Dinámica condiciológica: factores → causas → variables ────────────────────
// Los 3 factores globales y sus causas (definido por el usuario 2026-07-11). Las
// VARIABLES de cada causa las define el sistema Dinámica Condiciológica (a futuro).
export type FactorKey = 'mental' | 'corporal' | 'ambiental';

export const FACTORES: { key: FactorKey; label: string; color: string; causas: { key: string; label: string }[] }[] = [
  {
    key: 'mental', label: 'Mental', color: '#f472b6',
    causas: [
      { key: 'cognitivo', label: 'Cognitivo' },
      { key: 'social', label: 'Social' },
    ],
  },
  {
    key: 'corporal', label: 'Corporal', color: '#2dd4bf',
    causas: [
      { key: 'estructural', label: 'Estructural' },
      { key: 'funcional', label: 'Funcional' },
    ],
  },
  {
    key: 'ambiental', label: 'Ambiental', color: '#fbbf24',
    causas: [
      { key: 'positivo', label: 'Positivo' },
      { key: 'universo', label: 'Universo' },
    ],
  },
];

export const FACTOR_LABEL: Record<FactorKey, string> = {
  mental: 'Mental', corporal: 'Corporal', ambiental: 'Ambiental',
};
export const FACTOR_COLOR: Record<FactorKey, string> = {
  mental: '#f472b6', corporal: '#2dd4bf', ambiental: '#fbbf24',
};

/** Todas las causas (planas) con su factor, para pickers y validaciones. */
export const CAUSAS = FACTORES.flatMap((f) => f.causas.map((c) => ({ ...c, factor: f.key })));
export const isFactor = (v: string): v is FactorKey => v === 'mental' || v === 'corporal' || v === 'ambiental';
export const causaLabel = (factor: string, causa: string): string =>
  FACTORES.find((f) => f.key === factor)?.causas.find((c) => c.key === causa)?.label || causa;

// ── Restricciones de variables (limitan cómo se unen las piezas en rompecabezas) ──
// Por ahora 3 tipos (se ampliarán). Vienen de Gestión de Condiciones y viajan con la pieza.
export type RestriccionTipo = 'no_junto_con' | 'aplica_mas_de_uno' | 'solo_categorias';
export const RESTRICCION_TIPOS: { key: RestriccionTipo; label: string; hint: string }[] = [
  { key: 'no_junto_con', label: 'No se usa junto a', hint: 'Variables que NO pueden coexistir con esta.' },
  { key: 'aplica_mas_de_uno', label: 'Aplica más de uno', hint: 'La variable admite combinarse con varias.' },
  { key: 'solo_categorias', label: 'Solo con categorías', hint: 'Solo se une con variables de ciertas categorías.' },
];
export const RESTRICCION_LABEL: Record<RestriccionTipo, string> = Object.fromEntries(
  RESTRICCION_TIPOS.map((r) => [r.key, r.label]),
) as Record<RestriccionTipo, string>;
