'use client';

/**
 * EL TEMA DEL PANEL (claro / oscuro) — dueño único del estado.
 *
 * ── POR QUÉ SALE DEL LAYOUT (2026-08-28) ──────────────────────────────────────────────
 * El interruptor de tema vivía como un botón en el pie del menú lateral, y el estado en el
 * layout. Al quitar ese botón —el pie del menú se quedó con lo imprescindible— el tema se
 * ajusta desde **Configuración**, que es donde uno va a buscar sus preferencias.
 *
 * Pero Configuración es una página, no el layout: no puede tocar un `useState` que vive
 * dos niveles por encima. De ahí este contexto. El layout sigue siendo quien PINTA la
 * clase `.corp.dark`; aquí solo se guarda cuál es y quién puede cambiarlo.
 *
 * Se recuerda en `localStorage` por navegador, no en la base: es una preferencia de cómo
 * se ve la pantalla en ESTE equipo, no un dato de la cuenta. Quien entre desde otro
 * ordenador empieza en claro, y está bien.
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';

/**
 * La preferencia se guarda POR CUENTA (`gcc_dash_theme:<id>`), no por navegador
 * (Fernando, 2026-09-21): una cuenta recién creada tiene que empezar en claro aunque
 * en ese mismo equipo otra cuenta haya elegido el oscuro. Sin cuenta se usa la llave
 * genérica, que es la de antes.
 */
const LLAVE = 'gcc_dash_theme';

interface TemaPanel {
  oscuro: boolean;
  poner: (oscuro: boolean) => void;
  alternar: () => void;
}

const Ctx = createContext<TemaPanel | null>(null);

export function ProveedorTemaPanel({ children }: { children: React.ReactNode }) {
  const [oscuro, setOscuro] = useState(false);
  const { user } = useAuth();
  const llave = user?.id ? `${LLAVE}:${user.id}` : LLAVE;

  // ⚠️ Se lee DESPUÉS de montar, no en el estado inicial: `localStorage` no existe en el
  // servidor y leerlo al construir el estado rompería el render con un error de hidratación.
  // Se relee al cambiar de cuenta: cada una tiene su llave, y la que no tiene nada guardado
  // empieza en claro.
  useEffect(() => {
    try { setOscuro(localStorage.getItem(llave) === 'dark'); } catch { /* sin almacenamiento: claro */ }
  }, [llave]);

  const poner = useCallback((v: boolean) => {
    setOscuro(v);
    try { localStorage.setItem(llave, v ? 'dark' : 'light'); } catch { /* no impide cambiarlo ahora */ }
  }, [llave]);

  const alternar = useCallback(() => poner(!oscuro), [oscuro, poner]);

  return <Ctx.Provider value={{ oscuro, poner, alternar }}>{children}</Ctx.Provider>;
}

/**
 * El tema del panel. Fuera del panel devuelve un tema claro que no hace nada, en vez de
 * reventar: así un componente compartido con el sitio público se puede usar en los dos.
 */
export function useTemaPanel(): TemaPanel {
  return useContext(Ctx) ?? { oscuro: false, poner: () => {}, alternar: () => {} };
}
