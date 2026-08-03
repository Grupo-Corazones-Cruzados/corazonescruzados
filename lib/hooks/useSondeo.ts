'use client';

/**
 * SONDEO PERIÓDICO — «vuelve a pedir esto cada tantos segundos».
 *
 * ── QUÉ RESUELVE ───────────────────────────────────────────────────────────────
 * El patrón estaba escrito a mano en `ChatDock`, `PersonalPanel`, `GroupPanel` y algún
 * sitio más: un `setInterval`, un `visibilitychange` que lo para y lo arranca, y la
 * limpieza al desmontar. Son quince líneas fáciles de copiar mal, y copiarlas mal no se
 * nota — solo deja un temporizador corriendo con la pestaña de fondo, o dos a la vez.
 *
 * ── LAS TRES COSAS QUE HACE Y QUE UN `setInterval` PELADO NO ───────────────────
 * 1. **Para con la pestaña oculta y refresca al volver.** Sondear una pestaña que nadie
 *    mira gasta batería y peticiones para nada; y al volver, lo que interesa es el dato
 *    de AHORA, no esperar al siguiente ciclo.
 * 2. **No solapa.** Si una vuelta tarda más que el intervalo, la siguiente espera. Sin
 *    esto, una respuesta lenta acumula peticiones que se pisan entre sí y pintan datos
 *    viejos encima de los nuevos.
 * 3. **Calla los fallos.** Un sondeo que falla no es un error del usuario: se reintenta
 *    solo a los pocos segundos. Sacar un aviso por cada corte de red convertiría un
 *    túnel en una lluvia de mensajes rojos.
 *
 * La llamada inicial NO la hace el hook: quien lo usa ya carga en su propio efecto, y
 * hacerlo aquí duplicaría la primera petición.
 */

import { useEffect, useRef } from 'react';

export function useSondeo(fn: () => void | Promise<void>, intervaloMs: number, activo = true) {
  // La función se guarda en una ref para que cambiar de dependencias no reinicie el reloj:
  // si el intervalo se recreara en cada render, en la práctica no dispararía nunca.
  const guardada = useRef(fn);
  useEffect(() => { guardada.current = fn; }, [fn]);

  useEffect(() => {
    if (!activo) return;
    let id: ReturnType<typeof setInterval> | null = null;
    let enVuelo = false;

    const vuelta = async () => {
      if (enVuelo || document.hidden) return;
      enVuelo = true;
      try { await guardada.current(); } catch { /* se reintenta en la siguiente vuelta */ }
      finally { enVuelo = false; }
    };

    const arrancar = () => { if (!id) id = setInterval(vuelta, intervaloMs); };
    const parar = () => { if (id) { clearInterval(id); id = null; } };

    const alCambiarVisibilidad = () => {
      if (document.hidden) parar();
      else { void vuelta(); arrancar(); }
    };

    if (!document.hidden) arrancar();
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    return () => { parar(); document.removeEventListener('visibilitychange', alCambiarVisibilidad); };
  }, [intervaloMs, activo]);
}
