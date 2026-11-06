'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/browser';

/**
 * LA PASSKEY SE PIDE AL SERVIDOR ANTES DEL TOQUE, NO DESPUÉS.
 *
 * ── POR QUÉ HIZO FALTA (2026-10-29) ──────────────────────────────────────────────
 * Fernando, en el iPhone: *«al darle clic al botón no pasa nada y me obliga a usar la
 * opción de enviar código»*. Safari solo abre el diálogo de la passkey si
 * `navigator.credentials.get()` se llama **dentro del gesto** del usuario. El botón
 * hacía primero `await fetch(…/begin)` y solo después llamaba a `startAuthentication`:
 * para entonces el gesto ya había caducado, Safari lo rechazaba con `NotAllowedError`
 * y ese error se callaba (es el mismo que da «cancelar»), así que no pasaba nada. En el
 * ordenador funciona porque Chrome es más tolerante.
 *
 * Por eso las opciones (el reto) se piden en cuanto se muestra el botón, y el toque llama
 * a `startAuthentication` sin esperar nada antes. El reto dura 5 minutos en el servidor y
 * sirve una sola vez: se usa con margen (4 min) y tras cada intento se pide otro.
 */
const VIGENCIA_MS = 4 * 60 * 1000;

type Preparada =
  | { ok: true; opts: PublicKeyCredentialRequestOptionsJSON; en: number }
  | { ok: false; status: number; error: string | null; en: number };

export type ResultadoPasskey =
  | { ok: true; credential: AuthenticationResponseJSON }
  | { ok: false; status: number; error: string | null };

/**
 * `activo`: el botón de la passkey está a la vista. `pedir`: la llamada a la ruta `begin`.
 * `autenticar()` se llama como PRIMERA cosa del `onClick`.
 */
export function usePasskeyPreparada(activo: boolean, pedir: () => Promise<Response>) {
  const preparada = useRef<Preparada | null>(null);
  const pedirRef = useRef(pedir);
  pedirRef.current = pedir;

  const preparar = useCallback(async () => {
    try {
      const r = await pedirRef.current();
      const j = await r.json().catch(() => null);
      preparada.current = r.ok
        ? { ok: true, opts: j, en: Date.now() }
        : { ok: false, status: r.status, error: j?.error ?? null, en: Date.now() };
    } catch {
      preparada.current = null;
    }
  }, []);

  useEffect(() => {
    if (!activo) { preparada.current = null; return; }
    void preparar();
    const t = setInterval(() => void preparar(), VIGENCIA_MS);
    return () => clearInterval(t);
  }, [activo, preparar]);

  const autenticar = useCallback(async (): Promise<ResultadoPasskey> => {
    const p = preparada.current;
    preparada.current = null;
    const fresca = p && Date.now() - p.en < VIGENCIA_MS ? p : null;
    try {
      if (fresca?.ok) {
        // Sin ningún `await` antes: así sigue dentro del gesto en Safari.
        return { ok: true, credential: await startAuthentication({ optionsJSON: fresca.opts }) };
      }
      if (fresca && !fresca.ok) return { ok: false, status: fresca.status, error: fresca.error };
      // Aún no había llegado: se pide ahora (en Chrome sirve igual).
      const r = await pedirRef.current();
      const j = await r.json().catch(() => null);
      if (!r.ok) return { ok: false, status: r.status, error: j?.error ?? null };
      return { ok: true, credential: await startAuthentication({ optionsJSON: j }) };
    } catch (e) {
      // Cancelado o rechazado: el reto se gastó, el siguiente toque necesita otro. Tras un
      // intento que SÍ firmó no se pide aquí: pisaría el reto que `finish` va a comprobar.
      void preparar();
      throw e;
    }
  }, [preparar]);

  /** `preparar()` tras un `finish` fallido, para que el siguiente toque tenga reto. */
  return { autenticar, preparar };
}

/**
 * ¿Puede este aparato usar una passkey? Un botón que solo sabe fallar no se ofrece.
 * · Android: la WebView de las apps instaladas antes de la versión 1.8 no trae WebAuthn.
 * · App de iPhone: necesita `webcredentials` en sus entitlements y hoy no los lleva. Safari sí puede.
 */
export function passkeyDisponible(): boolean {
  if (typeof window === 'undefined' || !browserSupportsWebAuthn()) return false;
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  return cap?.getPlatform?.() !== 'ios';
}

/** Qué decirle a la persona cuando la passkey no se completó. El sistema no distingue cancelar de rechazar. */
export function motivoPasskey(e: unknown): 'ya-registrada' | 'no-completada' | 'otro' {
  const nombre = e instanceof Error ? e.name : '';
  if (nombre === 'InvalidStateError') return 'ya-registrada';
  if (nombre === 'NotAllowedError' || nombre === 'AbortError') return 'no-completada';
  return 'otro';
}

export type ResultadoRegistroPasskey =
  | { ok: true; credential: RegistrationResponseJSON }
  | { ok: false; status: number; error: string | null };

/**
 * Lo mismo para CREAR la passkey (2026-11-05): con el `await fetch(…/begin)` dentro del toque, Safari
 * rechazaba el diálogo, ese rechazo se leía como «canceló» y se entraba al panel sin crear nada.
 */
export function usePasskeyRegistro(activo: boolean, pedir: () => Promise<Response>) {
  const preparada = useRef<
    | { ok: true; opts: PublicKeyCredentialCreationOptionsJSON; en: number }
    | { ok: false; status: number; error: string | null; en: number }
    | null
  >(null);
  const pedirRef = useRef(pedir);
  pedirRef.current = pedir;

  const preparar = useCallback(async () => {
    try {
      const r = await pedirRef.current();
      const j = await r.json().catch(() => null);
      preparada.current = r.ok
        ? { ok: true, opts: j, en: Date.now() }
        : { ok: false, status: r.status, error: j?.error ?? null, en: Date.now() };
    } catch {
      preparada.current = null;
    }
  }, []);

  useEffect(() => {
    if (!activo) { preparada.current = null; return; }
    void preparar();
    const t = setInterval(() => void preparar(), VIGENCIA_MS);
    return () => clearInterval(t);
  }, [activo, preparar]);

  const crear = useCallback(async (): Promise<ResultadoRegistroPasskey> => {
    const p = preparada.current;
    preparada.current = null;
    const fresca = p && Date.now() - p.en < VIGENCIA_MS ? p : null;
    try {
      if (fresca?.ok) return { ok: true, credential: await startRegistration({ optionsJSON: fresca.opts }) };
      if (fresca && !fresca.ok) return { ok: false, status: fresca.status, error: fresca.error };
      const r = await pedirRef.current();
      const j = await r.json().catch(() => null);
      if (!r.ok) return { ok: false, status: r.status, error: j?.error ?? null };
      return { ok: true, credential: await startRegistration({ optionsJSON: j }) };
    } catch (e) {
      void preparar();
      throw e;
    }
  }, [preparar]);

  return { crear, preparar };
}
