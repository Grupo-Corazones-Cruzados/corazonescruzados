'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import {
  CharacterSprite,
  type CharacterConfig,
  type SpriteDirection,
} from './CharacterCreator';
import WorldMap, {
  TILE,
  WORLD_SCALE,
  buildCollisionGrid,
} from './WorldMap';
import SceneManagerEditor from './world/SceneManagerEditor';
import InventoryBar from './world/InventoryBar';
import { type NpcRecord } from './world/NpcEditor';
import LightOverlay from './world/LightOverlay';
import CinematicPlayer from '@/components/world/CinematicPlayer';
import {
  hasPlayedCinematic,
  markCinematicPlayed,
  type GameEventName,
} from '@/lib/world/events';
import {
  EQUIPPED_LIGHT_TEMPLATES,
  findItem,
  itemDataUrl,
} from './world/items';
import type { LightSource } from './world/lights';
import type {
  CinematicData,
  SceneMeta,
  Transition,
  WorldMapData,
  WorldProp,
} from './world/sheets';

const TILE_PX_DISPLAY = TILE * WORLD_SCALE; // 64 px per tile on screen
const SPEED = 1.2 * WORLD_SCALE;
const DEFAULT_SCENE_SLUG = 'main';
const DEFAULT_MAP: WorldMapData = {
  name: DEFAULT_SCENE_SLUG,
  width: 60,
  height: 40,
  layers: [{ tiles: [] }],
  items: [],
  spawnX: 30,
  spawnY: 20,
  transitions: [],
};

// Convert spawn tile coords to character world coords (centered),
// using the on-screen scaled pixel size so the character lands on
// the correct tile at the gameplay zoom level.
function spawnToWorld(map: WorldMapData) {
  const mapPxW = map.width * TILE_PX_DISPLAY;
  const mapPxH = map.height * TILE_PX_DISPLAY;
  return {
    x: map.spawnX * TILE_PX_DISPLAY + TILE_PX_DISPLAY / 2 - mapPxW / 2,
    y: map.spawnY * TILE_PX_DISPLAY + TILE_PX_DISPLAY / 2 - mapPxH / 2,
  };
}

type AuthStatus = {
  hasPassword: boolean;
  emailVerified: boolean;
  authenticated: boolean;
  pendingEmail?: string | null;
  email?: string | null;
  isMember?: boolean;
  hasAccount?: boolean;
  profileCompleted?: boolean;
  profile?: { fullName: string; country: string; address: string; phone: string };
};

export default function CharacterGameplay({
  config,
  initialAuth,
  isReturning = false,
  isMemberSession = false,
  freshAuth = false,
  onChangeEntryType,
  onAuthOverlayChange,
}: {
  config: CharacterConfig;
  initialAuth?: AuthStatus;
  isReturning?: boolean;
  /** El jugador entró como miembro/admin esta sesión → no se le pide cuenta. */
  isMemberSession?: boolean;
  /** Se autenticó por un modal en esta carga → no re-pedir login al entrar. */
  freshAuth?: boolean;
  /** Volver al menú "¿Cómo quieres ingresar?" para cambiar el tipo de cuenta. */
  onChangeEntryType?: () => void;
  /** Avisa cuando hay un overlay de auth (login/cuenta/passkey) → cursor normal. */
  onAuthOverlayChange?: (visible: boolean) => void;
}) {
  const [pos, setPos] = useState(spawnToWorld(DEFAULT_MAP));
  const spawnAppliedRef = useRef(false);
  const [direction, setDirection] = useState<SpriteDirection>('n');
  const [walking, setWalking] = useState(false);
  const [frame, setFrame] = useState(0);
  const keysRef = useRef<Set<string>>(new Set());
  const walkAudioRef = useRef<HTMLAudioElement | null>(null);
  const [worldMap, setWorldMap] = useState<WorldMapData>(DEFAULT_MAP);
  const [editorOpen, setEditorOpen] = useState(false);
  // Pestaña inicial al abrir el editor de escenas (escenas o NPCs).
  const [editorInitialTab, setEditorInitialTab] = useState<'scenes' | 'npcs'>('scenes');
  const [isAdmin, setIsAdmin] = useState(false);
  // Inventory is permanent — no toggle. Caps at MAX_INVENTORY_SLOTS
  // distinct items; further pickups of an item already in inventory
  // bump its quantity, but a pickup of a brand-new item silently
  // drops on the floor (stays available to grab once you free a slot).
  const MAX_INVENTORY_SLOTS = 10;
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [pickedItems, setPickedItems] = useState<Set<string>>(new Set());
  const [equipped, setEquipped] = useState<string | null>(null);
  const pickingRef = useRef<Set<string>>(new Set());
  // Refs for the keyboard handler so it always reads the latest
  // inventory / equipped without having to re-bind the listener.
  const inventoryRef = useRef(inventory);
  const equippedRef = useRef(equipped);
  useEffect(() => {
    inventoryRef.current = inventory;
  }, [inventory]);
  useEffect(() => {
    equippedRef.current = equipped;
  }, [equipped]);
  const [npcs, setNpcs] = useState<NpcRecord[]>([]);
  const [npcEditorOpen, setNpcEditorOpen] = useState(false);
  const [lights, setLights] = useState<LightSource[]>([]);
  // Single ever-incrementing frame counter; each NPC's sprite mods it
  // by the length of its chosen animation. Ticks at a fixed cadence
  // that's slow enough to look natural across walk / cast / hurt /
  // etc. without burning CPU on a per-NPC interval.
  const [npcFrame, setNpcFrame] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setNpcFrame((f) => f + 1), 130);
    return () => window.clearInterval(id);
  }, []);
  const [activeDialogue, setActiveDialogue] = useState<{
    npcId: number;
    line: number;
  } | null>(null);
  const nearbyNpcRef = useRef<NpcRecord | null>(null);
  const activeDialogueRef = useRef<typeof activeDialogue>(null);
  useEffect(() => {
    activeDialogueRef.current = activeDialogue;
  }, [activeDialogue]);

  // Active scene + transitions (Phase 2). `currentScene` drives every
  // scene-scoped fetch. `pendingSpawnRef` carries spawn coords through
  // a transition swap (when set, applied on next loadScene).
  const [currentScene, setCurrentScene] = useState<string>(DEFAULT_SCENE_SLUG);
  const [sceneMeta, setSceneMeta] = useState<SceneMeta | null>(null);
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const transitionsRef = useRef<Transition[]>([]);
  useEffect(() => {
    transitionsRef.current = transitions;
  }, [transitions]);
  const pendingSpawnRef = useRef<{ x?: number; y?: number } | null>(null);
  const transitioningRef = useRef(false);
  // After a transition lands, ignore the destination tile if it itself
  // contains a transition (prevents instant ping-pong loops).
  const ignoreTransitionTileRef = useRef<{ x: number; y: number } | null>(null);
  // Phase 3: pending cinematic to play (set by triggerGameEvent when
  // the cinematic for an event hasn't already been seen).
  const [cinematicPlaying, setCinematicPlaying] = useState<
    { meta: SceneMeta; data: CinematicData } | null
  >(null);
  // Cached list of scene metadata (used to resolve event triggers
  // without an extra round-trip per event).
  const sceneListRef = useRef<SceneMeta[]>([]);

  // Loads the named scene and populates worldMap/transitions/npcs/lights.
  // For cinematic kind, queues it for playback instead of swapping the
  // gameplay map.
  const loadScene = async (
    slug: string,
    opts?: { spawnX?: number; spawnY?: number },
  ) => {
    const r = await fetch(`/api/world/scenes/${encodeURIComponent(slug)}`);
    if (!r.ok) return;
    const j = await r.json();
    if (j?.kind === 'cinematic') {
      setCinematicPlaying({ meta: j.meta, data: j.data });
      return;
    }
    if (j?.kind !== 'map') return;
    const m: WorldMapData = {
      ...j.map,
      items: j.map.items ?? [],
      transitions: j.map.transitions ?? [],
    };
    // Apply pending spawn override (from a transition) before locking
    // the player into the destination's default spawn.
    const spawnX = opts?.spawnX ?? pendingSpawnRef.current?.x;
    const spawnY = opts?.spawnY ?? pendingSpawnRef.current?.y;
    pendingSpawnRef.current = null;
    if (typeof spawnX === 'number') m.spawnX = spawnX;
    if (typeof spawnY === 'number') m.spawnY = spawnY;
    setWorldMap(m);
    setTransitions(m.transitions ?? []);
    setSceneMeta(j.meta);
    setCurrentScene(slug);
    setIsAdmin(!!j.meta?.isAdmin);
    setNpcs(Array.isArray(j.npcs) ? j.npcs : []);
    setLights(Array.isArray(j.lights) ? j.lights : []);
    // Reset per-scene prop trigger state so a fresh scene visit can
    // re-fire its non-repeat triggers, and the spawn tile itself
    // doesn't accidentally fire a step trigger on landing.
    firedPropTriggersRef.current.clear();
    lastStepTileRef.current = { x: m.spawnX, y: m.spawnY };
    // Re-spawn player to the (possibly overridden) spawn point.
    spawnAppliedRef.current = true;
    setPos(spawnToWorld(m));
    // After landing, suppress the very tile we arrived on for one
    // movement check so we don't immediately retrigger.
    ignoreTransitionTileRef.current = { x: m.spawnX, y: m.spawnY };
  };

  // Resolve a game event to a cinematic scene (cached) and play it if
  // it hasn't been seen yet. Safe to call at any point; no-ops when:
  //   - the scene list isn't loaded yet,
  //   - no cinematic is bound to the event,
  //   - the player already saw it (localStorage),
  //   - or another cinematic is currently playing.
  const triggerGameEvent = (name: GameEventName) => {
    if (cinematicPlaying) return;
    if (hasPlayedCinematic(name)) return;
    const cinematic = sceneListRef.current.find(
      (s) => s.kind === 'cinematic' && s.eventTrigger === name,
    );
    if (!cinematic) return;
    fetch(`/api/world/scenes/${encodeURIComponent(cinematic.slug)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.kind === 'cinematic' && j.data) {
          setCinematicPlaying({ meta: j.meta, data: j.data });
        }
      })
      .catch(() => undefined);
  };
  // Stable ref so RAF-style closures can call it without re-binding.
  const triggerGameEventRef = useRef(triggerGameEvent);
  useEffect(() => {
    triggerGameEventRef.current = triggerGameEvent;
  });

  // Initial load: pick the active map scene + inventory + scene list.
  useEffect(() => {
    fetch('/api/world/scenes')
      .then((r) => r.json())
      .then(async (j: { scenes?: SceneMeta[]; activeSlug?: string | null }) => {
        if (Array.isArray(j?.scenes)) sceneListRef.current = j.scenes;
        const slug = j?.activeSlug ?? DEFAULT_SCENE_SLUG;
        await loadScene(slug);
        // After landing, fire the 'intro' event so any intro cinematic
        // plays once per player (localStorage gated).
        triggerGameEventRef.current('intro');
      })
      .catch(() => undefined);
    fetch('/api/world/inventory')
      .then((r) => r.json())
      .then(
        (j: {
          inventory?: Record<string, number>;
          pickedItems?: string[];
          equipped?: string | null;
        }) => {
          if (j?.inventory) setInventory(j.inventory);
          if (j?.pickedItems) setPickedItems(new Set(j.pickedItems));
          if (j?.equipped !== undefined) setEquipped(j.equipped);
        },
      )
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pick up any item under the player's tile (called every frame).
  // A pickup is rejected when it would introduce an 11th distinct
  // item; existing stacks always grow.
  const pickupCheck = (worldX: number, worldY: number) => {
    const tx = Math.floor((worldX + HALF_W) / TILE_PX_DISPLAY);
    const ty = Math.floor((worldY + HALF_H) / TILE_PX_DISPLAY);
    const item = (worldMap.items ?? []).find(
      (it) => it.x === tx && it.y === ty && !pickedItems.has(it.id),
    );
    if (!item || pickingRef.current.has(item.id)) return;
    const isNewSlot = !(item.itemId in inventoryRef.current);
    const slotsUsed = Object.keys(inventoryRef.current).filter(
      (k) => (inventoryRef.current[k] ?? 0) > 0,
    ).length;
    if (isNewSlot && slotsUsed >= MAX_INVENTORY_SLOTS) {
      // Inventory full; leave the item on the ground.
      return;
    }
    pickingRef.current.add(item.id);
    fetch('/api/world/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        placementId: item.id,
        itemId: item.itemId,
      }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok) {
          setInventory(j.inventory ?? {});
          setPickedItems(new Set(j.pickedItems ?? []));
          triggerGameEventRef.current('first_pickup');
        }
      })
      .catch(() => undefined)
      .finally(() => {
        pickingRef.current.delete(item.id);
      });
  };
  const [auth, setAuth] = useState<AuthStatus>(() => {
    const base: AuthStatus = initialAuth ?? {
      hasPassword: false,
      emailVerified: false,
      authenticated: true,
    };
    // Jugador recurrente: cada carga de página (sesión nueva) pide login UNA
    // sola vez al entrar al juego — SALVO que ya se haya autenticado por un modal
    // en esta misma carga (freshAuth: login de miembro/candidato o passkey). Así
    // no hay doble login, pero al recargar sí se valida la sesión nueva.
    return isReturning ? { ...base, authenticated: freshAuth } : base;
  });

  // Brand-new player (just created character this session) plays freely.
  // Returning players must set up password (1st return) or log in (subsequent).
  const [passkeyOffer, setPasskeyOffer] = useState(false);
  const [passkeyRegistered, setPasskeyRegistered] = useState(false);
  // ESC (jugando, sin overlays) → modal de confirmación para salir del juego.
  const [exitConfirm, setExitConfirm] = useState(false);
  // Brand-new players are now also forced to create an account before
  // they can play, to lock in their progress before they leave the page.
  // Los miembros/admin NO ven el formulario (ya tienen cuenta en gcc_world.users).
  // Candidato/invitado: lo ve si no tiene contraseña; o si tiene una temporal
  // (correo verificado pero perfil sin completar) tras ser aprobado.
  // No se pide "crea tu cuenta" si ya tiene cuenta (miembro/admin/CLIENTE:
  // hasAccount o isMember) o si entró con cuenta esta sesión (isMemberSession).
  const showSetup =
    !auth.isMember &&
    !auth.hasAccount &&
    !isMemberSession &&
    (!auth.hasPassword || (!!auth.emailVerified && !auth.profileCompleted));
  const showLogin = isReturning && auth.hasPassword && !auth.authenticated;
  const authOverlay = showSetup || showLogin || passkeyOffer;
  const overlayVisible = authOverlay || exitConfirm;
  const locked = overlayVisible;

  // Mientras hay un overlay (auth, confirmación de salida o editor de escenas/
  // NPC), usar el cursor normal del sistema; jugando vuelve el puntero del juego.
  const systemCursor = overlayVisible || editorOpen || npcEditorOpen;
  useEffect(() => {
    onAuthOverlayChange?.(systemCursor);
    return () => onAuthOverlayChange?.(false);
  }, [systemCursor, onAuthOverlayChange]);

  // ESC: solo cuando el juego está activo (sin overlays de auth) abre/cierra el
  // modal de confirmación de salida.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (authOverlay) return; // hay un formulario de auth → ESC no aplica
      e.preventDefault();
      setExitConfirm((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [authOverlay]);

  // After the signup → email verification flow completes, hasPassword
  // transitions from false → true. Use that edge to offer a passkey.
  const prevHasPasswordRef = useRef(auth.hasPassword);
  useEffect(() => {
    if (
      !prevHasPasswordRef.current &&
      auth.hasPassword &&
      typeof window !== 'undefined' &&
      'PublicKeyCredential' in window
    ) {
      fetch('/api/character/auth/passkey/status')
        .then((r) => r.json())
        .then((j) => {
          if (!j?.hasPasskeys) setPasskeyOffer(true);
        })
        .catch(() => undefined);
    }
    prevHasPasswordRef.current = auth.hasPassword;
  }, [auth.hasPassword]);

  // Miembro que acaba de crear su personaje (no recurrente): tras guardar (save
  // deja la sesión de personaje activa), si no tiene passkey, se la ofrecemos.
  const memberOfferRef = useRef(false);
  useEffect(() => {
    if (!isMemberSession || isReturning || memberOfferRef.current) return;
    if (typeof window === 'undefined' || !('PublicKeyCredential' in window)) return;
    memberOfferRef.current = true;
    const t = window.setTimeout(() => {
      fetch('/api/character/auth/passkey/status')
        .then((r) => r.json())
        .then((j) => {
          if (!j?.hasPasskeys) setPasskeyOffer(true);
        })
        .catch(() => undefined);
    }, 2800);
    return () => window.clearTimeout(t);
  }, [isMemberSession, isReturning]);

  // ── Walk frame cycler + walking SFX ──────────────────────────────
  useEffect(() => {
    const sfx = walkAudioRef.current;
    if (!walking) {
      setFrame(0);
      if (sfx) {
        sfx.pause();
        sfx.currentTime = 0;
      }
      return;
    }
    if (sfx) {
      sfx.loop = true;
      sfx.volume = 0.4;
      sfx.play().catch(() => undefined);
    }
    const id = window.setInterval(() => {
      setFrame((f) => (f >= 8 ? 1 : f + 1));
    }, 130);
    return () => {
      window.clearInterval(id);
      if (sfx) {
        sfx.pause();
        sfx.currentTime = 0;
      }
    };
  }, [walking]);

  // ── Keyboard handlers (gated by `locked`) ────────────────────────
  useEffect(() => {
    const keyToDir = (key: string | undefined): SpriteDirection | null => {
      if (typeof key !== 'string') return null;
      const k = key.toLowerCase();
      if (k === 'arrowup' || k === 'w') return 'n';
      if (k === 'arrowdown' || k === 's') return 's';
      if (k === 'arrowleft' || k === 'a') return 'w';
      if (k === 'arrowright' || k === 'd') return 'e';
      return null;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (locked) return;
      // While the editor or NPC editor is open, hand control over to
      // them so their hotkeys (Q/W/E/R/1/A/S/⌘S) don't double-fire here.
      if (editorOpen || npcEditorOpen) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        return;
      }
      const k = typeof e.key === 'string' ? e.key.toLowerCase() : '';
      // Talk / advance dialogue with E, Enter, or Space.
      // Priority: dialogue advance → talk to nearby NPC → admin opens editor.
      if (k === 'e' || k === 'enter' || k === ' ') {
        const dlg = activeDialogueRef.current;
        if (dlg) {
          // Advance to next line, or close on the last one.
          const npc = npcs.find((n) => n.id === dlg.npcId);
          if (!npc || dlg.line + 1 >= npc.dialogue.length) {
            setActiveDialogue(null);
          } else {
            setActiveDialogue({ npcId: dlg.npcId, line: dlg.line + 1 });
          }
          e.preventDefault();
          return;
        }
        const near = nearbyNpcRef.current;
        if (near && near.dialogue.length > 0) {
          setActiveDialogue({ npcId: near.id, line: 0 });
          triggerGameEventRef.current('first_npc_talk');
          // Stop walking so the dialogue feels intentional.
          keysRef.current.clear();
          setWalking(false);
          e.preventDefault();
          return;
        }
        // Nearby prop with interact-trigger fires before the editor fallback.
        const nearProp = nearbyInteractPropRef.current;
        if (nearProp) {
          runPropTriggerRef.current(nearProp);
          e.preventDefault();
          return;
        }
        // No NPC / prop: admin uses E to enter the world editor.
        if (k === 'e' && isAdmin) {
          setEditorOpen(true);
          keysRef.current.clear();
          setWalking(false);
          e.preventDefault();
          return;
        }
      }
      // Close dialogue on Escape.
      if (k === 'escape' && activeDialogueRef.current) {
        setActiveDialogue(null);
        e.preventDefault();
        return;
      }
      // Hotbar selection — keys 1-9 pick slot 0..8, key 0 picks slot 9.
      // Re-pressing the slot of the currently equipped item unequips it.
      if (k.length === 1 && k >= '0' && k <= '9') {
        const slot = k === '0' ? 9 : Number(k) - 1;
        const entries = Object.entries(inventoryRef.current).filter(
          ([, qty]) => qty > 0,
        );
        const target = entries[slot];
        if (target) {
          const [id] = target;
          const next = equippedRef.current === id ? null : id;
          setEquipped(next);
          fetch('/api/world/inventory', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ equipped: next }),
          }).catch(() => undefined);
          e.preventDefault();
        }
        return;
      }
      // Block movement while a dialogue is open.
      if (activeDialogueRef.current) return;
      const dir = keyToDir(e.key);
      if (!dir) return;
      e.preventDefault();
      keysRef.current.add(e.key);
      setDirection(dir);
      setWalking(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const dir = keyToDir(e.key);
      if (!dir) return;
      keysRef.current.delete(e.key);
      if (keysRef.current.size === 0) setWalking(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [locked, npcs, editorOpen, npcEditorOpen, isAdmin]);

  // ── Movement loop ────────────────────────────────────────────────
  // Pos is the character's world coordinate (0,0 = map center). The
  // map renders centered on the viewport and translates by -pos so
  // the character stays glued to the centre while the world scrolls.
  // Bounds clamp + per-tile collision keeps the character inside the
  // playable area and out of impassable tiles.
  const MAP_PX_W = worldMap.width * TILE_PX_DISPLAY;
  const MAP_PX_H = worldMap.height * TILE_PX_DISPLAY;
  const HALF_W = MAP_PX_W / 2;
  const HALF_H = MAP_PX_H / 2;
  const MARGIN = 28;
  const collisionGrid = useMemo(
    () => buildCollisionGrid(worldMap),
    [worldMap],
  );
  const isBlocked = (worldX: number, worldY: number) => {
    // Convert center-origin scaled world coords → tile coords.
    const tx = Math.floor((worldX + HALF_W) / TILE_PX_DISPLAY);
    const ty = Math.floor((worldY + HALF_H) / TILE_PX_DISPLAY);
    if (tx < 0 || ty < 0 || tx >= worldMap.width || ty >= worldMap.height)
      return false;
    if (collisionGrid[ty]?.[tx]) return true;
    // NPCs occupy their own tile.
    return npcs.some((n) => n.x === tx && n.y === ty);
  };

  // Player tile coordinates (used for proximity to NPCs and as the
  // default "place here" position in the NPC editor).
  const playerTileX = Math.floor((pos.x + HALF_W) / TILE_PX_DISPLAY);
  const playerTileY = Math.floor((pos.y + HALF_H) / TILE_PX_DISPLAY);

  // Real lights (from DB) + per-prop synthetic lights + the equipped
  // item's light (if any). Synthetic ids are negative so they never
  // collide with real /api/world/lights rows.
  const lightsWithEquipped = useMemo<LightSource[]>(() => {
    const propLights: LightSource[] = [];
    let nextId = -2;
    for (const p of worldMap.props ?? []) {
      if (!p.light) continue;
      propLights.push({
        id: nextId--,
        x: p.x,
        y: p.y,
        radius: p.light.radius,
        color: p.light.color,
        mode: p.light.mode,
        periodMs: p.light.periodMs,
        intensity: p.light.intensity,
      });
    }
    const base = [...lights, ...propLights];
    const tpl = equipped ? EQUIPPED_LIGHT_TEMPLATES[equipped] : null;
    if (!tpl) return base;
    return [
      ...base,
      {
        id: -1,
        x: playerTileX,
        y: playerTileY,
        radius: tpl.radius,
        color: tpl.color,
        mode: tpl.mode,
        periodMs: tpl.periodMs,
        intensity: tpl.intensity,
      },
    ];
  }, [lights, worldMap.props, equipped, playerTileX, playerTileY]);

  // Adjacent NPC (Manhattan distance ≤ 1, including same tile fallback).
  const nearbyNpc = useMemo(() => {
    if (!npcs.length) return null;
    return (
      npcs.find(
        (n) => Math.abs(n.x - playerTileX) + Math.abs(n.y - playerTileY) <= 1,
      ) ?? null
    );
  }, [npcs, playerTileX, playerTileY]);
  useEffect(() => {
    nearbyNpcRef.current = nearbyNpc;
  }, [nearbyNpc]);

  // Mirror props in a ref so the RAF loop can read them without
  // re-binding when the map changes.
  const propsRef = useRef<WorldProp[]>([]);
  useEffect(() => {
    propsRef.current = worldMap.props ?? [];
  }, [worldMap.props]);
  // Last tile we ran step-trigger detection for. Prevents the trigger
  // from re-firing every frame while the player stands on the tile.
  const lastStepTileRef = useRef<{ x: number; y: number } | null>(null);

  // Closest prop within Manhattan 1 that has an `interact` trigger.
  // Used by the E-key handler.
  const nearbyInteractPropRef = useRef<WorldProp | null>(null);
  const nearbyInteractProp = useMemo(() => {
    const list = worldMap.props ?? [];
    if (list.length === 0) return null;
    return (
      list.find(
        (p) =>
          p.trigger?.activation === 'interact' &&
          Math.abs(p.x - playerTileX) + Math.abs(p.y - playerTileY) <= 1,
      ) ?? null
    );
  }, [worldMap.props, playerTileX, playerTileY]);
  useEffect(() => {
    nearbyInteractPropRef.current = nearbyInteractProp;
  }, [nearbyInteractProp]);

  // Tracks which prop triggers have already fired this session, so
  // non-repeating triggers don't loop. Resets on a full page reload.
  const firedPropTriggersRef = useRef<Set<string>>(new Set());

  // Executes a prop's trigger. No-op if the prop has no trigger, or if
  // it already fired this session and isn't marked `repeat`.
  const runPropTrigger = (prop: WorldProp) => {
    const t = prop.trigger;
    if (!t) return;
    if (firedPropTriggersRef.current.has(prop.id) && !t.repeat) return;
    firedPropTriggersRef.current.add(prop.id);
    if (t.kind === 'cinematic' && t.cinematicSlug) {
      fetch(`/api/world/scenes/${encodeURIComponent(t.cinematicSlug)}`)
        .then((r) => r.json())
        .then((j) => {
          if (j?.kind === 'cinematic' && j.data) {
            setCinematicPlaying({ meta: j.meta, data: j.data });
          }
        })
        .catch(() => undefined);
      return;
    }
    if (t.kind === 'tile-change') {
      setWorldMap((m) => {
        const nextLayers = (m.layers ?? []).map((l) => {
          if ((l.id ?? '') !== t.layerId) return l;
          return {
            ...l,
            tiles: (l.tiles ?? []).filter(
              (tile) => !(tile.x === t.tileX && tile.y === t.tileY),
            ),
          };
        });
        return { ...m, layers: nextLayers };
      });
      return;
    }
    if (t.kind === 'layer-toggle') {
      setWorldMap((m) => {
        const nextLayers = (m.layers ?? []).map((l) => {
          if ((l.id ?? '') !== t.layerId) return l;
          return { ...l, visible: l.visible === false ? true : false };
        });
        return { ...m, layers: nextLayers };
      });
      return;
    }
  };
  const runPropTriggerRef = useRef(runPropTrigger);
  useEffect(() => {
    runPropTriggerRef.current = runPropTrigger;
  });
  useEffect(() => {
    if (
      !walking ||
      editorOpen ||
      npcEditorOpen ||
      activeDialogue ||
      cinematicPlaying
    ) {
      return;
    }
    let raf = 0;
    const tick = () => {
      const vx = direction === 'w' ? -SPEED : direction === 'e' ? SPEED : 0;
      const vy = direction === 'n' ? -SPEED : direction === 's' ? SPEED : 0;
      setPos((p) => {
        // Try X then Y separately so a wall on one axis doesn't
        // freeze diagonal movement on the other.
        let nx = Math.max(
          -HALF_W + MARGIN,
          Math.min(HALF_W - MARGIN, p.x + vx),
        );
        let ny = Math.max(
          -HALF_H + MARGIN,
          Math.min(HALF_H - MARGIN, p.y + vy),
        );
        if (isBlocked(nx, p.y)) nx = p.x;
        if (isBlocked(nx, ny)) ny = p.y;
        pickupCheck(nx, ny);
        // Transition check — only when we're not already mid-swap and
        // the player isn't standing on the suppression tile that was
        // set when they arrived from another scene.
        if (!transitioningRef.current) {
          const tx = Math.floor((nx + HALF_W) / TILE_PX_DISPLAY);
          const ty = Math.floor((ny + HALF_H) / TILE_PX_DISPLAY);
          const ignore = ignoreTransitionTileRef.current;
          if (ignore && (ignore.x !== tx || ignore.y !== ty)) {
            ignoreTransitionTileRef.current = null;
          }
          if (
            !ignoreTransitionTileRef.current ||
            ignoreTransitionTileRef.current.x !== tx ||
            ignoreTransitionTileRef.current.y !== ty
          ) {
            const hit = transitionsRef.current.find(
              (t) =>
                tx >= t.x && tx < t.x + t.w && ty >= t.y && ty < t.y + t.h,
            );
            if (hit && hit.targetScene) {
              triggerTransition(hit);
            }
          }
        }
        // Step-trigger props — fire only when the player's tile
        // actually changes, so the trigger doesn't loop every frame.
        const stx = Math.floor((nx + HALF_W) / TILE_PX_DISPLAY);
        const sty = Math.floor((ny + HALF_H) / TILE_PX_DISPLAY);
        const last = lastStepTileRef.current;
        if (!last || last.x !== stx || last.y !== sty) {
          lastStepTileRef.current = { x: stx, y: sty };
          const stepHit = propsRef.current.find(
            (pp) =>
              pp.trigger?.activation === 'step' &&
              pp.x === stx &&
              pp.y === sty,
          );
          if (stepHit) runPropTriggerRef.current(stepHit);
        }
        return { x: nx, y: ny };
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    walking,
    direction,
    HALF_W,
    HALF_H,
    editorOpen,
    npcEditorOpen,
    activeDialogue,
    cinematicPlaying,
    collisionGrid,
    npcs,
  ]);

  // Fade overlay opacity for scene transitions. 0 = transparent, 1 =
  // black; pumped by triggerTransition during the swap.
  const [fadeAlpha, setFadeAlpha] = useState(0);
  const fadeAlphaRef = useRef(0);
  useEffect(() => {
    fadeAlphaRef.current = fadeAlpha;
  }, [fadeAlpha]);

  const triggerTransition = (hit: Transition) => {
    if (transitioningRef.current) return;
    transitioningRef.current = true;
    const fadeMs = Math.max(0, hit.fadeMs ?? 250);
    const halfMs = Math.max(1, fadeMs);
    // Fade to black, swap scene, fade back in.
    const startTs = performance.now();
    const fadeOut = (now: number) => {
      const dt = Math.min(1, (now - startTs) / halfMs);
      setFadeAlpha(dt);
      if (dt < 1) requestAnimationFrame(fadeOut);
      else {
        pendingSpawnRef.current = {
          x: hit.targetSpawnX,
          y: hit.targetSpawnY,
        };
        loadScene(hit.targetScene)
          .catch(() => undefined)
          .finally(() => {
            const startIn = performance.now();
            const fadeIn = (n2: number) => {
              const dt2 = Math.min(1, (n2 - startIn) / halfMs);
              setFadeAlpha(1 - dt2);
              if (dt2 < 1) requestAnimationFrame(fadeIn);
              else {
                transitioningRef.current = false;
              }
            };
            requestAnimationFrame(fadeIn);
          });
      }
    };
    requestAnimationFrame(fadeOut);
  };

  // ── Poll auth status while overlay is open (catch verify/login from
  //    other tabs or after returning from email link) ───────────────
  useEffect(() => {
    if (!overlayVisible) return;
    const refresh = async () => {
      try {
        const r = await fetch('/api/character/me');
        const j = await r.json();
        if (j?.exists) {
          setAuth((prev) => ({
            hasPassword: !!j.hasPassword,
            emailVerified: !!j.emailVerified,
            // Polling must NOT auto-grant authenticated state, even if
            // a stale auth cookie is still valid on the server. Login
            // can only succeed via the explicit LoginForm submission.
            authenticated: prev.authenticated,
            pendingEmail: j.pendingEmail ?? null,
          }));
        }
      } catch {
        /* noop */
      }
    };
    const id = window.setInterval(refresh, 4000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [overlayVisible]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        background: '#000',
        overflow: 'hidden',
        animation: 'pixelFadeIn 0.6s ease-out',
      }}
    >
      {/* World map — anchored to viewport center, scrolls opposite to
          the character so they appear to walk while staying centred. */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: MAP_PX_W,
          height: MAP_PX_H,
          transform: `translate(calc(-50% - ${pos.x}px), calc(-50% - ${pos.y}px))`,
          willChange: 'transform',
        }}
      >
        <WorldMap map={worldMap} hidePickedItems={pickedItems} />
        {/* NPCs live in the world transform so they scroll with the map. */}
        {npcs.map((n) => (
          <div
            key={n.id}
            style={{
              position: 'absolute',
              left: n.x * TILE_PX_DISPLAY + TILE_PX_DISPLAY / 2,
              top: n.y * TILE_PX_DISPLAY + TILE_PX_DISPLAY / 2,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
            }}
          >
            <CharacterSprite
              config={n.config}
              direction={n.facing}
              animation={n.animation}
              frame={npcFrame}
              scale={3}
            />
            {/* Name tag floats above the NPC's head. */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: -6,
                transform: 'translate(-50%, -100%)',
                background: 'rgba(10,10,20,0.85)',
                border: '1px solid rgba(225,215,255,0.4)',
                padding: '2px 6px',
                fontFamily: "'Silkscreen', cursive",
                fontSize: '0.55rem',
                color: '#e5e5e5',
                letterSpacing: '0.1em',
                whiteSpace: 'nowrap',
              }}
            >
              {n.name}
            </div>
          </div>
        ))}
      </div>

      {/* Character — fixed at viewport centre. */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          willChange: 'transform',
        }}
      >
        <CharacterSprite
          config={config}
          direction={direction}
          frame={frame}
          scale={3}
          withBackpack
        />
        {equipped &&
          (() => {
            const def = findItem(equipped);
            if (!def) return null;
            // Sit the equipped item right at the character's near-hand
            // so it reads as "in hand" rather than "floating beside".
            // Each facing has its own offset, mirror flag, and a tilt
            // so the item feels carried instead of just stuck on.
            const offsetMap = {
              n: { x: -22, y: 32, scaleX: 1, rotate: -20 },
              s: { x: 26, y: 32, scaleX: -1, rotate: -25 },
              w: { x: -36, y: 22, scaleX: 1, rotate: -15 },
              e: { x: 36, y: 22, scaleX: -1, rotate: -15 },
            } as const;
            const o = offsetMap[direction];
            return (
              <img
                src={itemDataUrl(def)}
                alt=""
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: 40,
                  height: 40,
                  imageRendering: 'pixelated',
                  pointerEvents: 'none',
                  transform: `translate(calc(-50% + ${o.x}px), calc(-50% + ${o.y}px)) scaleX(${o.scaleX}) rotate(${o.rotate}deg)`,
                  transformOrigin: 'center center',
                  filter: 'drop-shadow(2px 2px 0 rgba(0,0,0,0.55))',
                  // Hide behind body when player faces north (back
                  // turned) so the item peeks from over the shoulder.
                  zIndex: direction === 'n' ? -1 : 1,
                }}
              />
            );
          })()}
      </div>

      {/* Lighting layer — same world transform as the tile container,
          rendered above the player so the dark / lit zones cover them
          too. Pinned at zIndex above world+player but below all UI. */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: MAP_PX_W,
          height: MAP_PX_H,
          transform: `translate(calc(-50% - ${pos.x}px), calc(-50% - ${pos.y}px))`,
          willChange: 'transform',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        <LightOverlay
          width={worldMap.width}
          height={worldMap.height}
          tilePx={TILE_PX_DISPLAY}
          ambientDarkness={worldMap.ambientDarkness ?? 0}
          lights={lightsWithEquipped}
        />
      </div>

      {showSetup && (
        <SignupForm
          alias={config.name}
          onSignedUp={(email) =>
            setAuth({
              hasPassword: true,
              emailVerified: false,
              authenticated: false,
              pendingEmail: email,
            })
          }
          onCompleted={() =>
            setAuth({ hasPassword: true, emailVerified: true, authenticated: true })
          }
          pendingEmail={auth.pendingEmail ?? null}
          initialEmail={auth.email ?? auth.pendingEmail ?? ''}
          emailVerified={!!auth.emailVerified}
          initialProfile={auth.profile}
        />
      )}

      {showLogin && (
        <LoginForm
          expectedKind={auth.isMember ? 'member' : auth.hasAccount ? 'client' : 'candidate'}
          onChangeEntryType={onChangeEntryType}
          onLoggedIn={async () => {
            // Re-lee el estado AUTORITATIVO tras el login: la sesión nueva ya
            // apunta a la fila correcta del jugador, así que isMember/profile son
            // fiables (evita el "crea tu cuenta" del miembro por una cookie vieja).
            let me: {
              isMember?: boolean;
              hasAccount?: boolean;
              hasPassword?: boolean;
              emailVerified?: boolean;
              profileCompleted?: boolean;
              email?: string | null;
              profile?: { fullName: string; country: string; address: string; phone: string };
            } | null = null;
            try {
              me = await fetch('/api/character/me', { cache: 'no-store' }).then((r) => r.json());
            } catch {
              /* usa el auth previo */
            }
            setAuth((a) => ({
              ...a,
              hasPassword: true,
              emailVerified: true,
              authenticated: true,
              // OR: si ya era cuenta (miembro/cliente) no dejes que un false la
              // revierta; basta con que cualquiera de los dos lo confirme.
              isMember: !!me?.isMember || !!a.isMember,
              hasAccount: !!me?.hasAccount || !!a.hasAccount,
              profileCompleted: me?.profileCompleted ?? a.profileCompleted,
              email: me?.email ?? a.email,
              profile: me?.profile ?? a.profile,
            }));
            // After password login, offer to register a passkey on
            // this device if the browser supports WebAuthn and the
            // account doesn't already have one.
            try {
              if (
                typeof window !== 'undefined' &&
                'PublicKeyCredential' in window
              ) {
                const status = await fetch(
                  '/api/character/auth/passkey/status',
                ).then((r) => r.json());
                if (!status?.hasPasskeys) setPasskeyOffer(true);
              }
            } catch {
              /* noop */
            }
          }}
        />
      )}

      {passkeyOffer && (
        <PasskeyOfferDialog
          onSkip={() => setPasskeyOffer(false)}
          onRegistered={() => {
            setPasskeyRegistered(true);
            window.setTimeout(() => setPasskeyOffer(false), 1200);
          }}
          registered={passkeyRegistered}
        />
      )}

      {exitConfirm && (
        <ExitConfirmDialog
          onCancel={() => setExitConfirm(false)}
          onConfirm={() => {
            // Volver a la pantalla de inicio (recarga: la landing usa animaciones
            // irreversibles, así que el reset limpio es recargar).
            window.location.href = '/';
          }}
        />
      )}

      <audio
        ref={walkAudioRef}
        src="/sounds/music/Efecto%20de%20sonido%20caminando%20272246.mp3"
        loop
        preload="auto"
      />

      {isAdmin && !overlayVisible && !editorOpen && !npcEditorOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: 24,
            zIndex: 99997,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <button
            type="button"
            onClick={() => {
              setEditorInitialTab('scenes');
              setEditorOpen(true);
            }}
            className="pixel-btn pixel-btn-secondary"
            title="Editor (E)"
            style={{
              fontSize: '0.6rem',
              padding: '8px 14px',
              letterSpacing: '0.14em',
            }}
          >
            ✎ Editor [E]
          </button>
          <button
            type="button"
            onClick={() => {
              setEditorInitialTab('npcs');
              setEditorOpen(true);
            }}
            className="pixel-btn pixel-btn-secondary"
            style={{
              fontSize: '0.6rem',
              padding: '8px 14px',
              letterSpacing: '0.14em',
            }}
          >
            ☻ NPCs
          </button>
        </div>
      )}

      {/* "Press E to talk" hint when adjacent to an NPC. */}
      {nearbyNpc &&
        !activeDialogue &&
        !overlayVisible &&
        !editorOpen &&
        !npcEditorOpen && (
          <div
            style={{
              position: 'fixed',
              bottom: 90,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 99996,
              padding: '6px 12px',
              background: 'rgba(19,25,35,0.92)',
              border: '2px solid var(--color-accent)',
              boxShadow: '4px 4px 0 rgba(0,0,0,0.55)',
              fontFamily: "'Silkscreen', cursive",
              fontSize: '0.6rem',
              letterSpacing: '0.14em',
              color: '#e5e5e5',
            }}
          >
            <span style={{ color: '#ffcc00' }}>[E]</span> Hablar con{' '}
            {nearbyNpc.name}
          </div>
        )}

      {/* Dialogue overlay. */}
      {activeDialogue &&
        (() => {
          const npc = npcs.find((n) => n.id === activeDialogue.npcId);
          if (!npc) return null;
          const line = npc.dialogue[activeDialogue.line] ?? '';
          const isLast = activeDialogue.line + 1 >= npc.dialogue.length;
          return (
            <div
              style={{
                position: 'fixed',
                left: '50%',
                bottom: 32,
                transform: 'translateX(-50%)',
                zIndex: 99998,
                width: 'min(640px, 90vw)',
                padding: 18,
                background: 'rgba(10,10,20,0.95)',
                border: '2px solid var(--color-accent)',
                boxShadow: '6px 6px 0 rgba(0,0,0,0.6)',
                fontFamily: "'Silkscreen', cursive",
                color: '#e5e5e5',
              }}
            >
              <div
                style={{
                  fontSize: '0.7rem',
                  letterSpacing: '0.18em',
                  color: 'var(--color-accent)',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                }}
              >
                {npc.name}
              </div>
              <div
                style={{
                  fontSize: '0.85rem',
                  lineHeight: 1.6,
                  letterSpacing: '0.04em',
                  marginBottom: 14,
                }}
              >
                {line}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.55rem',
                  color: 'rgba(225,215,255,0.6)',
                  letterSpacing: '0.12em',
                }}
              >
                <span>
                  {activeDialogue.line + 1} / {npc.dialogue.length}
                </span>
                <span>
                  <span style={{ color: '#ffcc00' }}>[E]</span>{' '}
                  {isLast ? 'Cerrar' : 'Continuar'} ·{' '}
                  <span style={{ color: '#ffcc00' }}>[Esc]</span> Salir
                </span>
              </div>
            </div>
          );
        })()}

      {/* Inventory hotbar — always present at the bottom of the
          screen (hidden only while a modal-style overlay covers it).
          Shows numbered slots so players can pick with 1-9 / 0 keys. */}
      {!overlayVisible &&
        !editorOpen &&
        !npcEditorOpen &&
        !activeDialogue && (
          <InventoryBar
            inventory={inventory}
            equipped={equipped}
            maxSlots={MAX_INVENTORY_SLOTS}
            onEquip={(id) => {
              setEquipped(id);
              fetch('/api/world/inventory', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ equipped: id }),
              }).catch(() => undefined);
            }}
          />
        )}

      {/* Scene transition fade overlay. Sits above the world but
          below modal editors so transitions don't black out the
          editor when it's open. */}
      {fadeAlpha > 0 && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            background: '#000',
            opacity: fadeAlpha,
            zIndex: 100000,
          }}
        />
      )}

      {editorOpen && (
        <SceneManagerEditor
          initialTab={editorInitialTab}
          playerTileX={playerTileX}
          playerTileY={playerTileY}
          onNpcsChanged={setNpcs}
          onClose={() => {
            setEditorOpen(false);
            // Re-load the active scene so any edits to it land in the
            // gameplay view (tiles, NPCs, lights, transitions, music).
            loadScene(currentScene).catch(() => undefined);
          }}
        />
      )}

      {cinematicPlaying && (
        <CinematicPlayer
          data={cinematicPlaying.data}
          onDone={() => {
            if (cinematicPlaying.meta.eventTrigger) {
              markCinematicPlayed(cinematicPlaying.meta.eventTrigger);
            }
            setCinematicPlaying(null);
          }}
        />
      )}

      {/* Per-scene background music. Swaps src whenever the active
          scene changes; the browser handles the actual playback. */}
      <SceneAudio
        url={sceneMeta?.musicUrl ?? null}
        volume={
          typeof sceneMeta?.musicVolume === 'number'
            ? sceneMeta.musicVolume
            : 0.5
        }
        muted={!!cinematicPlaying}
      />
    </div>
  );
}

function SceneAudio({
  url,
  volume,
  muted,
}: {
  url: string | null;
  volume: number;
  muted: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.volume = Math.max(0, Math.min(1, volume));
  }, [volume]);
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (!url) {
      a.pause();
      a.removeAttribute('src');
      return;
    }
    if (a.src !== url) {
      a.src = url;
      // Browsers block autoplay until user interaction. Fail silently
      // when blocked — the player can interact later to start music.
      a.play().catch(() => undefined);
    }
  }, [url]);
  return (
    <audio
      ref={audioRef}
      loop
      muted={muted}
      style={{ display: 'none' }}
    />
  );
}

function PasskeyOfferDialog({
  onSkip,
  onRegistered,
  registered,
}: {
  onSkip: () => void;
  onRegistered: () => void;
  registered: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const register = async () => {
    setBusy(true);
    setError(null);
    const res = await tryRegisterPasskey();
    setBusy(false);
    if (res.ok) onRegistered();
    else setError(res.error);
  };
  return (
    <FormShell
      title={registered ? '¡Passkey registrada!' : 'Usa tu huella o Face ID'}
      subtitle={
        registered
          ? 'La próxima vez podrás entrar sin contraseña'
          : 'Asocia este dispositivo para entrar más rápido la próxima vez'
      }
    >
      {!registered && (
        <p
          style={{
            fontSize: '0.7rem',
            lineHeight: 1.6,
            margin: '0 0 16px',
            color: '#cbd5e1',
          }}
        >
          Usa el sensor biométrico de tu dispositivo (Touch ID, Face ID,
          huella, PIN) para crear una passkey. Después podrás iniciar sesión
          en un solo paso.
        </p>
      )}
      {error && (
        <div
          style={{
            fontSize: '0.62rem',
            color: '#ff6f6f',
            marginBottom: 10,
          }}
        >
          {error}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!registered && (
          <button
            type="button"
            disabled={busy}
            onClick={register}
            className="pixel-btn pixel-btn-primary"
            style={{ opacity: busy ? 0.6 : 1 }}
          >
            {busy ? 'Registrando...' : 'Registrar passkey'}
          </button>
        )}
        <button
          type="button"
          onClick={onSkip}
          className="pixel-btn pixel-btn-secondary"
        >
          {registered ? 'Continuar' : 'Ahora no'}
        </button>
      </div>
    </FormShell>
  );
}

function ExitConfirmDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <FormShell title="¿Salir del juego?" subtitle="Tu progreso queda guardado.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button"
          onClick={onConfirm}
          className="pixel-btn pixel-btn-primary"
          autoFocus
        >
          Salir al inicio
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="pixel-btn pixel-btn-secondary"
        >
          Cancelar
        </button>
      </div>
    </FormShell>
  );
}

function FormShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        zIndex: 100001,
        animation: 'pixelFadeIn 0.5s ease-out',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#131923',
          border: '2px solid var(--color-accent)',
          padding: '28px 26px',
          fontFamily: "'Silkscreen', cursive",
          color: '#e5e5e5',
          boxShadow:
            '6px 6px 0 rgba(0,0,0,0.55), 0 0 28px rgba(75,45,142,0.35)',
        }}
      >
        <div
          style={{
            fontSize: '0.85rem',
            letterSpacing: '0.22em',
            color: 'var(--color-accent)',
            textTransform: 'uppercase',
            textAlign: 'center',
            marginBottom: subtitle ? 4 : 18,
            textShadow: '1px 1px 0 rgba(0,0,0,0.6)',
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: '0.62rem',
              letterSpacing: '0.1em',
              color: 'rgba(225,215,255,0.7)',
              textAlign: 'center',
              marginBottom: 18,
            }}
          >
            {subtitle}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function input(extra?: React.CSSProperties): React.CSSProperties {
  return {
    width: '100%',
    padding: '10px 12px',
    background: '#0f1320',
    color: '#e5e5e5',
    border: '2px solid var(--color-accent)',
    fontFamily: "'Silkscreen', cursive",
    fontSize: '0.78rem',
    letterSpacing: '0.05em',
    outline: 'none',
    ...extra,
  };
}

function SignupForm({
  alias,
  pendingEmail,
  onSignedUp,
  onCompleted,
  initialEmail = '',
  emailVerified = false,
  initialProfile,
}: {
  alias: string;
  pendingEmail: string | null;
  onSignedUp: (email: string) => void;
  /** Guardado directo (sin código) cuando el correo ya está verificado. */
  onCompleted: () => void;
  initialEmail?: string;
  emailVerified?: boolean;
  initialProfile?: { fullName: string; country: string; address: string; phone: string };
}) {
  const [email, setEmail] = useState(initialEmail || pendingEmail || '');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [fullName, setFullName] = useState(initialProfile?.fullName ?? '');
  const [country, setCountry] = useState(initialProfile?.country ?? '');
  const [address, setAddress] = useState(initialProfile?.address ?? '');
  const [phone, setPhone] = useState(initialProfile?.phone ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(!!pendingEmail && !emailVerified);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (fullName.trim().length < 2) {
      setError('Ingresa tu nombre completo');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Correo inválido');
      return;
    }
    if (country.trim().length < 2) {
      setError('Ingresa tu país');
      return;
    }
    if (address.trim().length < 3) {
      setError('Ingresa tu dirección');
      return;
    }
    if (phone.trim().length < 7) {
      setError('Ingresa un teléfono válido');
      return;
    }
    if (pwd.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (pwd !== pwd2) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setSubmitting(true);
    try {
      // Correo ya verificado (candidato aprobado): guarda directo (actualiza la
      // contraseña temporal + datos), sin código.
      if (emailVerified) {
        const r = await fetch('/api/character/auth/complete-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            password: pwd,
            fullName: fullName.trim(),
            country: country.trim(),
            address: address.trim(),
            phone: phone.trim(),
          }),
        });
        const j = await r.json();
        if (!r.ok) {
          setError(j?.error ?? 'No se pudo guardar');
          return;
        }
        onCompleted();
        return;
      }

      // Correo sin verificar: envía código de verificación.
      const r = await fetch('/api/character/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password: pwd,
          fullName: fullName.trim(),
          country: country.trim(),
          address: address.trim(),
          phone: phone.trim(),
          accountType:
            (typeof window !== 'undefined' &&
              window.localStorage.getItem('gcc_account_type')) ||
            'candidate',
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j?.error ?? 'No se pudo enviar el correo');
        return;
      }
      setSent(true);
      onSignedUp(email.trim());
    } catch {
      setError('Error de red');
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <FormShell
        title="Confirma tu correo"
        subtitle={`Te enviamos un enlace a ${email}`}
      >
        <p
          style={{
            fontSize: '0.7rem',
            lineHeight: 1.6,
            margin: '6px 0 14px',
            color: '#cbd5e1',
          }}
        >
          Abre el correo y haz clic en el botón de confirmación para activar tu
          cuenta. Mientras tanto no podrás continuar en el juego.
        </p>
        <p
          style={{
            fontSize: '0.6rem',
            color: 'rgba(225,215,255,0.55)',
            margin: '0 0 14px',
            lineHeight: 1.6,
          }}
        >
          Cuando confirmes, esta pantalla se actualizará automáticamente.
        </p>
        <button
          type="button"
          className="pixel-btn pixel-btn-secondary"
          style={{ width: '100%' }}
          onClick={() => setSent(false)}
        >
          Cambiar correo
        </button>
      </FormShell>
    );
  }

  return (
    <FormShell
      title="Crea tu cuenta"
      subtitle={`Para ${alias} — guarda tu progreso`}
    >
      <form
        onSubmit={submit}
        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Nombre completo"
          autoComplete="name"
          autoFocus
          style={input()}
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Correo electrónico"
          autoComplete="email"
          readOnly={emailVerified}
          title={emailVerified ? 'Tu correo ya fue verificado y no se puede cambiar' : undefined}
          style={{ ...input(), ...(emailVerified ? { opacity: 0.6, cursor: 'not-allowed' } : {}) }}
        />
        <input
          type="text"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          placeholder="País"
          autoComplete="country-name"
          style={input()}
        />
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Dirección"
          autoComplete="street-address"
          style={input()}
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Contacto telefónico"
          autoComplete="tel"
          style={input()}
        />
        <input
          type="password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          placeholder="Contraseña (mín. 8)"
          autoComplete="new-password"
          style={input()}
        />
        <input
          type="password"
          value={pwd2}
          onChange={(e) => setPwd2(e.target.value)}
          placeholder="Confirma la contraseña"
          autoComplete="new-password"
          style={input()}
        />
        {error && (
          <div
            style={{
              fontSize: '0.62rem',
              letterSpacing: '0.05em',
              color: '#ff6f6f',
            }}
          >
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="pixel-btn pixel-btn-primary"
          style={{ marginTop: 6, opacity: submitting ? 0.6 : 1 }}
        >
          {submitting
            ? 'Guardando...'
            : emailVerified
              ? 'Guardar datos'
              : 'Enviar correo'}
        </button>
      </form>
    </FormShell>
  );
}

function LoginForm({
  onLoggedIn,
  expectedKind,
  onChangeEntryType,
}: {
  onLoggedIn: () => void;
  /** Tipo reconocido: el modal solo acepta este tipo de cuenta. */
  expectedKind?: 'member' | 'candidate' | 'client';
  onChangeEntryType?: () => void;
}) {
  const [step, setStep] = useState<'creds' | 'factor' | 'code'>('creds');
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [code, setCode] = useState('');
  const [masked, setMasked] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPasskeys, setHasPasskeys] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  useEffect(() => {
    fetch('/api/character/auth/passkey/status')
      .then((r) => r.json())
      .then((j) => setHasPasskeys(!!j?.hasPasskeys))
      .catch(() => undefined);
  }, []);

  // Paso 1: valida credenciales (sin enviar código) → muestra opciones.
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch('/api/character/auth/returning/begin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password: pwd,
          expect: expectedKind,
          validateOnly: true,
        }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j?.error ?? 'Credenciales incorrectas');
        return;
      }
      setMasked(j?.masked ?? null);
      setStep('factor');
    } catch {
      setError('Error de red');
    } finally {
      setSubmitting(false);
    }
  };

  // Paso 2 (opción A): envía el código de verificación.
  const sendCode = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch('/api/character/auth/returning/begin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: pwd, expect: expectedKind }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j?.error ?? 'No se pudo enviar el código');
        return;
      }
      setMasked(j?.masked ?? null);
      setStep('code');
    } catch {
      setError('Error de red');
    } finally {
      setSubmitting(false);
    }
  };

  // Paso 2: valida el código y entra.
  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch('/api/character/auth/returning/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j?.error ?? 'Código incorrecto');
        return;
      }
      onLoggedIn();
    } catch {
      setError('Error de red');
    } finally {
      setSubmitting(false);
    }
  };

  const loginWithPasskey = async () => {
    setError(null);
    setPasskeyBusy(true);
    try {
      const begin = await fetch('/api/character/auth/passkey/login/begin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expect: expectedKind, email: email.trim() }),
      });
      const opts = await begin.json();
      if (!begin.ok) {
        setError(opts?.error ?? 'No se pudo iniciar passkey');
        return;
      }
      const credential = await startAuthentication({ optionsJSON: opts });
      const finish = await fetch('/api/character/auth/passkey/login/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...credential, email: email.trim() }),
      });
      const fJson = await finish.json();
      if (!finish.ok) {
        setError(fJson?.error ?? 'Passkey rechazada');
        return;
      }
      onLoggedIn();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error de passkey';
      // User canceled the prompt → quietly ignore (no scary red text).
      if (!/cancel|abort|timeout|allowed/i.test(msg)) {
        setError(msg);
      }
    } finally {
      setPasskeyBusy(false);
    }
  };

  if (step === 'code') {
    return (
      <FormShell
        title="Confirma el código"
        subtitle={`Te enviamos un código a ${masked ?? 'tu correo'}`}
      >
        <form onSubmit={submitCode} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Código de 6 dígitos"
            autoComplete="one-time-code"
            autoFocus
            style={{ ...input(), textAlign: 'center', letterSpacing: '0.3em' }}
          />
          {error && (
            <div style={{ fontSize: '0.62rem', letterSpacing: '0.05em', color: '#ff6f6f' }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="pixel-btn pixel-btn-primary"
            style={{ marginTop: 6, opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
          <button
            type="button"
            onClick={() => { setStep('creds'); setCode(''); setError(null); }}
            style={{
              background: 'transparent', border: 0, cursor: 'pointer',
              fontSize: '0.62rem', letterSpacing: '0.05em', color: '#b9b2cf',
              textDecoration: 'underline', marginTop: 2,
            }}
          >
            ← Volver
          </button>
        </form>
      </FormShell>
    );
  }

  if (step === 'factor') {
    return (
      <FormShell
        title="Elige cómo continuar"
        subtitle="Verificamos tus credenciales. Completa un segundo paso."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            type="button"
            onClick={sendCode}
            disabled={submitting}
            className="pixel-btn pixel-btn-primary"
            style={{ opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? 'Enviando código...' : 'Enviar código'}
          </button>
          {hasPasskeys && (
            <button
              type="button"
              onClick={loginWithPasskey}
              disabled={passkeyBusy}
              className="pixel-btn pixel-btn-secondary"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: passkeyBusy ? 0.6 : 1,
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="square"
                aria-hidden="true"
              >
                <path d="M12 2a5 5 0 0 1 5 5v3" />
                <path d="M12 2a5 5 0 0 0-5 5v3" />
                <rect x="5" y="10" width="14" height="11" rx="1" />
                <path d="M12 14v4" />
              </svg>
              {passkeyBusy ? 'Autenticando...' : 'Usar passkey'}
            </button>
          )}
          {error && (
            <div style={{ fontSize: '0.62rem', letterSpacing: '0.05em', color: '#ff6f6f' }}>
              {error}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setStep('creds');
              setError(null);
            }}
            style={{
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
              fontSize: '0.62rem',
              letterSpacing: '0.05em',
              color: '#b9b2cf',
              textDecoration: 'underline',
              marginTop: 2,
            }}
          >
            ← Volver
          </button>
        </div>
      </FormShell>
    );
  }

  return (
    <FormShell
      title="Continúa tu partida"
      subtitle="Ingresa con tu correo y contraseña para continuar"
    >
      <form
        onSubmit={submit}
        style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Correo electrónico"
          autoComplete="email"
          autoFocus
          style={input()}
        />
        <input
          type="password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          placeholder="Contraseña"
          autoComplete="current-password"
          style={input()}
        />
        {error && (
          <div
            style={{
              fontSize: '0.62rem',
              letterSpacing: '0.05em',
              color: '#ff6f6f',
            }}
          >
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="pixel-btn pixel-btn-primary"
          style={{ marginTop: 6, opacity: submitting ? 0.6 : 1 }}
        >
          {submitting ? 'Verificando...' : 'Continuar'}
        </button>
      </form>
      {onChangeEntryType && (
        <button
          type="button"
          onClick={onChangeEntryType}
          style={{
            marginTop: 12,
            width: '100%',
            background: 'transparent',
            border: 0,
            cursor: 'pointer',
            fontSize: '0.6rem',
            letterSpacing: '0.06em',
            color: '#b9b2cf',
            textDecoration: 'underline',
          }}
        >
          Cambiar tipo de ingreso
        </button>
      )}
    </FormShell>
  );
}

export async function tryRegisterPasskey(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  try {
    const begin = await fetch(
      '/api/character/auth/passkey/register/begin',
      {
        method: 'POST',
      },
    );
    const opts = await begin.json();
    if (!begin.ok) return { ok: false, error: opts?.error ?? 'No autorizado' };
    const attestation = await startRegistration({ optionsJSON: opts });
    const finish = await fetch(
      '/api/character/auth/passkey/register/finish',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attestation),
      },
    );
    const j = await finish.json();
    if (!finish.ok) return { ok: false, error: j?.error ?? 'Falló registro' };
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown' };
  }
}
