'use client';

/**
 * EL TEMA DEL PANEL — dueño único del estado.
 *
 * ── POR QUÉ SALE DEL LAYOUT (2026-08-28) ──────────────────────────────────────────────
 * El estado vivía en el layout, pero quien lo cambia es el botón del menú lateral: un
 * contexto deja que cualquiera lo lea o lo cambie sin pasar props por medio panel. El layout
 * sigue siendo quien PINTA las clases (`.dark` y `tema-<id>`); aquí solo se guarda cuál es.
 *
 * ── VARIOS TEMAS (2026-10-29) ─────────────────────────────────────────────────────────
 * Antes era claro/oscuro; ahora es uno del catálogo `lib/temas.ts`. `oscuro` se sigue
 * exponiendo —derivado de la base del tema— porque es lo que decide la clase `.dark`.
 */

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { TEMA_POR_DEFECTO, definicionTema, type TemaId } from '@/lib/temas';

/**
 * La preferencia se guarda POR CUENTA (`gcc_dash_theme:<id>`), no por navegador
 * (Fernando, 2026-09-21): una cuenta recién creada tiene que empezar en claro aunque
 * en ese mismo equipo otra cuenta haya elegido el oscuro. Sin cuenta se usa la llave
 * genérica, que es la de antes.
 *
 * Se recuerda en `localStorage`, no en la base: es cómo se ve la pantalla en ESTE equipo.
 */
const LLAVE = 'gcc_dash_theme';

/**
 * El ÚLTIMO tema usado en este equipo, sea de la cuenta que sea: lo lee la pantalla de carga
 * (`CargaPanel`), que se ve antes de saber quién entra (Fernando, 2026-10-30).
 */
export const LLAVE_ULTIMO_TEMA = 'gcc_dash_theme:ultimo';

/** Lo guardado antes de los temas era `dark`/`light`: se sigue entendiendo. */
function leerGuardado(valor: string | null): TemaId {
  if (valor === 'dark') return 'oscuro';
  if (valor === 'light') return 'claro';
  return definicionTema(valor)?.id ?? TEMA_POR_DEFECTO;
}

interface TemaPanel {
  tema: TemaId;
  oscuro: boolean;
  poner: (tema: TemaId) => void;
}

const Ctx = createContext<TemaPanel | null>(null);

export function ProveedorTemaPanel({ children }: { children: React.ReactNode }) {
  const [tema, setTema] = useState<TemaId>(TEMA_POR_DEFECTO);
  const { user } = useAuth();
  const llave = user?.id ? `${LLAVE}:${user.id}` : LLAVE;

  // ⚠️ Se lee DESPUÉS de montar, no en el estado inicial: `localStorage` no existe en el
  // servidor y leerlo al construir el estado rompería el render con un error de hidratación.
  // Se relee al cambiar de cuenta: cada una tiene su llave, y la que no tiene nada guardado
  // empieza en claro.
  useEffect(() => {
    try {
      const t = leerGuardado(localStorage.getItem(llave));
      setTema(t);
      if (user?.id) localStorage.setItem(LLAVE_ULTIMO_TEMA, t);
    } catch { /* sin almacenamiento: claro */ }
  }, [llave, user?.id]);

  const poner = useCallback((t: TemaId) => {
    setTema(t);
    try { localStorage.setItem(llave, t); localStorage.setItem(LLAVE_ULTIMO_TEMA, t); } catch { /* no impide cambiarlo ahora */ }
  }, [llave]);

  const oscuro = definicionTema(tema)?.base === 'oscuro';

  return <Ctx.Provider value={{ tema, oscuro, poner }}>{children}</Ctx.Provider>;
}

/**
 * El tema del panel. Fuera del panel devuelve un tema claro que no hace nada, en vez de
 * reventar: así un componente compartido con el sitio público se puede usar en los dos.
 */
export function useTemaPanel(): TemaPanel {
  return useContext(Ctx) ?? { tema: TEMA_POR_DEFECTO, oscuro: false, poner: () => {} };
}
