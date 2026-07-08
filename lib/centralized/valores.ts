/**
 * Lista canónica de VALORES que gobiernan la organización. Fuente ÚNICA de verdad:
 * cualquier lugar que muestre, evalúe o permita elegir valores (criterios de
 * reclutamiento, etiquetas de tareas del horario de vida, etc.) DEBE importar desde
 * aquí. Así, al estandarizar o crear nuevos valores se cambia en un solo sitio.
 */

export interface Valor {
  key: string;
  label: string;
}

export const VALORES: Valor[] = [
  { key: 'determinacion', label: 'Determinación' },
  { key: 'coraje', label: 'Coraje' },
  { key: 'pureza', label: 'Pureza' },
  { key: 'fe', label: 'Fe' },
  { key: 'paciencia', label: 'Paciencia' },
  { key: 'seriedad', label: 'Seriedad' },
  { key: 'espontaneidad', label: 'Espontaneidad' },
  { key: 'autonomia', label: 'Autonomía' },
  { key: 'empatia', label: 'Empatía' },
];

export const VALOR_LABEL: Record<string, string> = Object.fromEntries(VALORES.map((v) => [v.key, v.label]));
export const VALOR_KEYS = VALORES.map((v) => v.key);
export const VALORES_SET = new Set(VALOR_KEYS);
