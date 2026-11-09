/**
 * QUÉ APP ES ESTA (Fernando, 2026-11-05). La web es la misma en todas; cada app lo dice con la cookie
 * `gcc_app`, que escribe antes de cargar la página (`MainActivity`, `VistaPrincipal`, `/app/<cual>`).
 */
export type AppDeTelefono = 'progreso' | 'aventura' | 'centralizado';

/**
 * ¿Estamos DENTRO de una app? La del teléfono (Capacitor), la nativa de la Mac (puente `gccEscritorio`) o la
 * web instalada (sin barra del navegador). Lo mismo que `esAppInstalada` (components/espacio/api.ts).
 */
export function dentroDeUnaApp(): boolean {
  const w = window as any;
  return !!w.Capacitor?.isNativePlatform?.() || !!w.webkit?.messageHandlers?.gccEscritorio
    || window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

/**
 * La app instalada de verdad (su cookie), o `null` en el navegador. Para lo que SOLO pasa en una app.
 * ⚠️ La cookie dura un año: si llegó a una pestaña normal (p. ej. abriendo `/app/miembros`), esa pestaña se
 * comportaba como la app y no enseñaba la portada (Fernando, 2026-11-09, en Arc). Fuera de una app no
 * cuenta y se borra.
 */
export function appInstalada(): AppDeTelefono | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)gcc_app=(progreso|aventura|centralizado)(?:;|$)/);
  if (m && !dentroDeUnaApp()) {
    document.cookie = 'gcc_app=; Path=/; Max-Age=0; Secure; SameSite=Lax';
    return null;
  }
  return (m?.[1] as AppDeTelefono) ?? null;
}

/**
 * Cómo se comporta el panel. ⇒ DESDE EL 2026-11-08 LA WEB ES GCC MIEMBROS (Fernando: «en la web es
 * equivalente a la app de GCC Miembros»): Accesos con sus pestañas, menús en dos capas y el pie. Por eso
 * en el navegador es `'centralizado'`. Lo único que la web conserva es la portada para elegir mundo: esa
 * pregunta por `appInstalada()`. `null` solo en el servidor.
 */
export function appDeTelefono(): AppDeTelefono | null {
  if (typeof document === 'undefined') return null;
  return appInstalada() ?? 'centralizado';
}
