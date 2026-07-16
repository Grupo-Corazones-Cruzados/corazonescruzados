/**
 * Nomenclatura del usuario corporativo `@grupocc.org`.
 *
 * Regla (ej.: Luis Fernando González Muyulema → `lfgonzalezm0`):
 *   inicial(1er nombre) + inicial(2º nombre) + (1er apellido completo) +
 *   inicial(2º apellido) + contador (desde 0, incrementa si ya existe).
 */

const DOMAIN = 'grupocc.org';

/** Minúsculas, sin acentos ni caracteres no alfanuméricos. */
export function slugPart(s: string | null | undefined): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export interface NameParts {
  firstName?: string;
  secondName?: string;
  firstSurname?: string;
  secondSurname?: string;
}

/** Base del usuario (sin el contador). Ej.: `lfgonzalezm`. */
export function buildUsernameBase(p: NameParts): string {
  const initial = (s?: string) => slugPart(s).charAt(0);
  return `${initial(p.firstName)}${initial(p.secondName)}${slugPart(p.firstSurname)}${initial(p.secondSurname)}`;
}

/** Usuario sugerido con contador (base + counter). */
export function buildUsername(p: NameParts, counter = 0): string {
  return `${buildUsernameBase(p)}${counter}`;
}

/** Separa un usuario en base + contador inicial (`lfgonzalezm0` → {base:'lfgonzalezm', start:0}). */
export function splitBaseCounter(username: string): { base: string; start: number } {
  const m = /^(.*?)(\d*)$/.exec(username.trim());
  const base = slugPart(m?.[1] || '');
  const start = m?.[2] ? parseInt(m[2], 10) : 0;
  return { base, start: Number.isFinite(start) ? start : 0 };
}

/** Formato válido de usuario corporativo (sin el dominio). */
export function isValidUsername(u: string): boolean {
  return /^[a-z][a-z0-9]{2,30}$/.test(u);
}

export function usernameToEmail(username: string): string {
  return `${username}@${DOMAIN}`;
}

export const WORKSPACE_DOMAIN = DOMAIN;
