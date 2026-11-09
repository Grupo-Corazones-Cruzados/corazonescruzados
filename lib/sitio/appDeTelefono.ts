/**
 * QUÉ APP ES ESTA (Fernando, 2026-11-05). La web es la misma en todas; cada app lo dice con la cookie
 * `gcc_app`, que escribe antes de cargar la página (`MainActivity`, `VistaPrincipal`, `/app/<cual>`).
 */
export type AppDeTelefono = 'progreso' | 'aventura' | 'centralizado';

/** La app instalada de verdad (su cookie), o `null` en el navegador. Para lo que SOLO pasa en una app. */
export function appInstalada(): AppDeTelefono | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)gcc_app=(progreso|aventura|centralizado)(?:;|$)/);
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
