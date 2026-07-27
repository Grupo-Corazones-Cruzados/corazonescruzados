/**
 * Entrada validada al juego (NIVEL APP → NIVEL MOTOR)
 * ---------------------------------------------------
 * `/juego` solo debe abrirse cuando la landing acaba de validar al jugador con
 * un inicio de sesión real (candidato / cliente / miembro). Antes bastaba con
 * que el servidor reconociera la cookie de jugador o la IP para caer directo en
 * el juego; eso se eliminó a propósito: "Entrar" siempre pide login, igual que
 * "Colaborar".
 *
 * La marca vive en `sessionStorage`, no en una cookie, y eso define su alcance:
 * - sobrevive a recargas de ESA pestaña (recargar el juego no expulsa a nadie),
 * - no sobrevive a una pestaña nueva ni a cerrar el navegador → volver al juego
 *   pasa otra vez por la landing y por iniciar sesión.
 *
 * Es un control de flujo (que no se entre al juego sin pasar por el login), no
 * una barrera de seguridad: los datos del jugador los siguen protegiendo las
 * rutas de `/api/character/*` con su cookie de sesión.
 */

export const GAME_ENTRY_KEY = 'gcc_game_entry';

/** La landing la llama justo antes de navegar a `/juego`. */
export function markGameEntry(): void {
  try {
    window.sessionStorage.setItem(GAME_ENTRY_KEY, '1');
  } catch {
    /* sessionStorage bloqueado (modo privado / cookies off): se deja pasar */
  }
}

/** `/juego` la consulta al montar; si es `false`, devuelve al visitante a `/`. */
export function hasGameEntry(): boolean {
  try {
    return window.sessionStorage.getItem(GAME_ENTRY_KEY) === '1';
  } catch {
    // Si el navegador no deja leer sessionStorage no podemos distinguir a un
    // jugador validado de uno que escribió la URL: no bloqueamos el juego.
    return true;
  }
}

/** Al cerrar sesión: la siguiente entrada al juego vuelve a exigir login. */
export function clearGameEntry(): void {
  try {
    window.sessionStorage.removeItem(GAME_ENTRY_KEY);
  } catch {
    /* ignore */
  }
}
