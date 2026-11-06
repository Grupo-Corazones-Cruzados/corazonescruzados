/**
 * QUÉ APP DE TELÉFONO ES ESTA (Fernando, 2026-11-05). La web es la misma en todas; cada app lo dice
 * con la cookie `gcc_app`, que escribe antes de cargar la página (`MainActivity`). En el navegador
 * no existe: eso es GCC World.
 */
export type AppDeTelefono = 'progreso' | 'aventura' | 'centralizado';

export function appDeTelefono(): AppDeTelefono | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)gcc_app=(progreso|aventura|centralizado)(?:;|$)/);
  return (m?.[1] as AppDeTelefono) ?? null;
}
