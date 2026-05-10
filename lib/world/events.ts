// Catalog of game events that can fire a cinematic. The editor's
// CinematicEditor uses this as the source of truth for the trigger
// dropdown. Adding a new event = adding the literal here + calling
// `triggerGameEvent('your_event')` from the right gameplay site.
export const GAME_EVENTS = [
  'intro',
  'first_login',
  'first_pickup',
  'first_npc_talk',
] as const;

export type GameEventName = (typeof GAME_EVENTS)[number];

// localStorage key used to remember which cinematics already played.
// Decision: client-side cache (clearing browser data replays them).
export const CINEMATIC_PLAYED_PREFIX = 'cinematic_played:';

export function hasPlayedCinematic(eventName: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(CINEMATIC_PLAYED_PREFIX + eventName) === '1';
  } catch {
    return false;
  }
}

export function markCinematicPlayed(eventName: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CINEMATIC_PLAYED_PREFIX + eventName, '1');
  } catch {
    /* private mode etc — not fatal */
  }
}
