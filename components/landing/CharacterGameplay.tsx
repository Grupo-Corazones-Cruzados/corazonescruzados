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
import MapEditor from './world/MapEditor';
import InventoryBar from './world/InventoryBar';
import NpcEditor, { type NpcRecord } from './world/NpcEditor';
import LightOverlay from './world/LightOverlay';
import {
  EQUIPPED_LIGHT_TEMPLATES,
  findItem,
  itemDataUrl,
} from './world/items';
import type { LightSource } from './world/lights';
import type { WorldMapData } from './world/sheets';

const TILE_PX_DISPLAY = TILE * WORLD_SCALE; // 64 px per tile on screen
const SPEED = 1.2 * WORLD_SCALE;
const DEFAULT_MAP: WorldMapData = {
  name: 'default',
  width: 60,
  height: 40,
  layers: [{ tiles: [] }],
  items: [],
  spawnX: 30,
  spawnY: 20,
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
};

export default function CharacterGameplay({
  config,
  initialAuth,
  isReturning = false,
}: {
  config: CharacterConfig;
  initialAuth?: AuthStatus;
  isReturning?: boolean;
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [pickedItems, setPickedItems] = useState<Set<string>>(new Set());
  const [equipped, setEquipped] = useState<string | null>(null);
  const pickingRef = useRef<Set<string>>(new Set());
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const inventoryOpenRef = useRef(false);
  useEffect(() => {
    inventoryOpenRef.current = inventoryOpen;
  }, [inventoryOpen]);
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

  // Load map + admin flag
  useEffect(() => {
    fetch('/api/world/map')
      .then((r) => r.json())
      .then((j: WorldMapData & { isAdmin?: boolean }) => {
        if (j && Array.isArray(j.layers)) {
          // Ensure items field exists (older payloads may omit it).
          const m: WorldMapData = { ...j, items: j.items ?? [] };
          setWorldMap(m);
          if (!spawnAppliedRef.current) {
            spawnAppliedRef.current = true;
            setPos(spawnToWorld(m));
          }
        }
        setIsAdmin(!!j?.isAdmin);
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
    fetch('/api/world/npcs')
      .then((r) => r.json())
      .then((j: { npcs?: NpcRecord[] }) => {
        if (Array.isArray(j?.npcs)) setNpcs(j.npcs);
      })
      .catch(() => undefined);
    fetch('/api/world/lights')
      .then((r) => r.json())
      .then((j: { lights?: LightSource[] }) => {
        if (Array.isArray(j?.lights)) setLights(j.lights);
      })
      .catch(() => undefined);
  }, []);

  // Pick up any item under the player's tile (called every frame).
  const pickupCheck = (worldX: number, worldY: number) => {
    const tx = Math.floor((worldX + HALF_W) / TILE_PX_DISPLAY);
    const ty = Math.floor((worldY + HALF_H) / TILE_PX_DISPLAY);
    const item = (worldMap.items ?? []).find(
      (it) => it.x === tx && it.y === ty && !pickedItems.has(it.id),
    );
    if (!item || pickingRef.current.has(item.id)) return;
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
    // Returning players must always re-enter their password on each
    // entry to the world, even if the auth cookie is still valid.
    return isReturning ? { ...base, authenticated: false } : base;
  });

  // Brand-new player (just created character this session) plays freely.
  // Returning players must set up password (1st return) or log in (subsequent).
  const [passkeyOffer, setPasskeyOffer] = useState(false);
  const [passkeyRegistered, setPasskeyRegistered] = useState(false);
  // Brand-new players are now also forced to create an account before
  // they can play, to lock in their progress before they leave the page.
  const showSetup = !auth.hasPassword;
  const showLogin = isReturning && auth.hasPassword && !auth.authenticated;
  const overlayVisible = showSetup || showLogin || passkeyOffer;
  const locked = overlayVisible;

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
          // Stop walking so the dialogue feels intentional.
          keysRef.current.clear();
          setWalking(false);
          e.preventDefault();
          return;
        }
        // No NPC to talk to: admin uses E to enter the world editor.
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
      // Toggle inventory with I; Escape also closes it.
      if (k === 'i') {
        setInventoryOpen((o) => !o);
        e.preventDefault();
        return;
      }
      if (k === 'escape' && inventoryOpenRef.current) {
        setInventoryOpen(false);
        e.preventDefault();
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

  // Append a synthetic light at the player's tile when they have an
  // item equipped that grants one (e.g. lantern). Uses a stable
  // negative id so it never collides with a real /api/world/lights row.
  const lightsWithEquipped = useMemo<LightSource[]>(() => {
    const tpl = equipped ? EQUIPPED_LIGHT_TEMPLATES[equipped] : null;
    if (!tpl) return lights;
    return [
      ...lights,
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
  }, [lights, equipped, playerTileX, playerTileY]);

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
  useEffect(() => {
    if (!walking || editorOpen || npcEditorOpen || activeDialogue) return;
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
    collisionGrid,
    npcs,
  ]);

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
        />
        {equipped &&
          (() => {
            const def = findItem(equipped);
            if (!def) return null;
            // Anchor the held item near the character's hip on the
            // side they're facing. Not animated frame-by-frame yet,
            // but reads as "carrying" the item.
            const offsetMap = {
              n: { x: -36, y: 18, scaleX: 1 },
              s: { x: 36, y: 18, scaleX: -1 },
              w: { x: -56, y: 18, scaleX: 1 },
              e: { x: 56, y: 18, scaleX: -1 },
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
                  width: 56,
                  height: 56,
                  imageRendering: 'pixelated',
                  pointerEvents: 'none',
                  transform: `translate(calc(-50% + ${o.x}px), calc(-50% + ${o.y}px)) scaleX(${o.scaleX})`,
                  filter: 'drop-shadow(2px 2px 0 rgba(0,0,0,0.5))',
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
          pendingEmail={auth.pendingEmail ?? null}
        />
      )}

      {showLogin && (
        <LoginForm
          onLoggedIn={async () => {
            setAuth({
              hasPassword: true,
              emailVerified: true,
              authenticated: true,
            });
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
            onClick={() => setEditorOpen(true)}
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
            onClick={() => setNpcEditorOpen(true)}
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

      {inventoryOpen &&
        !overlayVisible &&
        !editorOpen &&
        !npcEditorOpen &&
        !activeDialogue && (
          <InventoryBar
            inventory={inventory}
            equipped={equipped}
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

      {/* Lighting status badge — small diagnostic showing how many
          lights the overlay is currently painting (static + equipped).
          Helps confirm the lantern attaches its synthetic light. */}
      {!overlayVisible && !editorOpen && !npcEditorOpen && (
        <div
          style={{
            position: 'fixed',
            top: 12,
            right: 12,
            zIndex: 99996,
            padding: '4px 8px',
            background: 'rgba(19,25,35,0.78)',
            border: '1px solid rgba(225,215,255,0.25)',
            fontFamily: "'Silkscreen', cursive",
            fontSize: '0.5rem',
            letterSpacing: '0.12em',
            color: 'rgba(225,215,255,0.7)',
            pointerEvents: 'none',
          }}
        >
          ☼ {lightsWithEquipped.length} · oscuridad{' '}
          {Math.round((worldMap.ambientDarkness ?? 0) * 100)}%
        </div>
      )}

      {/* "[I] Inventario" hint when nothing else is on screen. */}
      {!inventoryOpen &&
        !overlayVisible &&
        !editorOpen &&
        !npcEditorOpen &&
        !activeDialogue && (
          <div
            style={{
              position: 'fixed',
              right: 16,
              bottom: 16,
              zIndex: 99996,
              padding: '6px 10px',
              background: 'rgba(19,25,35,0.85)',
              border: '2px solid var(--color-accent)',
              boxShadow: '3px 3px 0 rgba(0,0,0,0.5)',
              fontFamily: "'Silkscreen', cursive",
              fontSize: '0.55rem',
              letterSpacing: '0.14em',
              color: 'rgba(225,215,255,0.85)',
              pointerEvents: 'none',
            }}
          >
            <span style={{ color: '#ffcc00' }}>[I]</span> Inventario
          </div>
        )}

      {editorOpen && (
        <MapEditor
          initialMap={worldMap}
          onClose={() => setEditorOpen(false)}
          onSaved={(m) => {
            const spawnChanged =
              m.spawnX !== worldMap.spawnX || m.spawnY !== worldMap.spawnY;
            setWorldMap(m);
            if (spawnChanged) setPos(spawnToWorld(m));
          }}
        />
      )}

      {npcEditorOpen && (
        <NpcEditor
          playerTileX={playerTileX}
          playerTileY={playerTileY}
          onClose={() => setNpcEditorOpen(false)}
          onChanged={setNpcs}
        />
      )}
    </div>
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
        zIndex: 1,
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
}: {
  alias: string;
  pendingEmail: string | null;
  onSignedUp: (email: string) => void;
}) {
  const [email, setEmail] = useState(pendingEmail ?? '');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(!!pendingEmail);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Correo inválido');
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
      const r = await fetch('/api/character/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: pwd }),
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
          {submitting ? 'Enviando...' : 'Enviar correo'}
        </button>
      </form>
    </FormShell>
  );
}

function LoginForm({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const r = await fetch('/api/character/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password: pwd }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j?.error ?? 'No se pudo iniciar sesión');
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
        body: JSON.stringify(credential),
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

  return (
    <FormShell
      title="Continúa tu partida"
      subtitle="Usa tu passkey o ingresa con correo + contraseña"
    >
      {hasPasskeys && (
        <button
          type="button"
          onClick={loginWithPasskey}
          disabled={passkeyBusy}
          className="pixel-btn pixel-btn-primary"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 10,
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
          autoFocus={!hasPasskeys}
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
          className="pixel-btn pixel-btn-secondary"
          style={{ marginTop: 6, opacity: submitting ? 0.6 : 1 }}
        >
          {submitting ? 'Entrando...' : 'Entrar con contraseña'}
        </button>
      </form>
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
