'use client';

/**
 * EL MENÚ DEL TELÉFONO: abierto o cerrado, compartido por la cabecera y el propio menú.
 *
 * ── POR QUÉ UN CONTEXTO Y NO UN `useState` EN LA BARRA LATERAL ────────────────────────
 * El botón de menú vive ahora en una CABECERA que está en el flujo de la página —arriba
 * del contenido, no flotando encima—, y esa cabecera la monta el layout. El menú que abre
 * lo monta `DashboardSidebar`. Son dos componentes hermanos que necesitan el mismo dato, y
 * ninguno es padre del otro.
 *
 * La alternativa era subir el estado al layout y pasarlo por props a los dos. Se hace así
 * en su lugar porque el layout no tiene por qué saber que existe un menú que se abre: solo
 * coloca las piezas.
 */

import { createContext, useCallback, useContext, useState } from 'react';

interface MenuMovil {
  abierto: boolean;
  abrir: () => void;
  cerrar: () => void;
}

const Ctx = createContext<MenuMovil | null>(null);

export function ProveedorMenuMovil({ children }: { children: React.ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const abrir = useCallback(() => setAbierto(true), []);
  const cerrar = useCallback(() => setAbierto(false), []);
  return <Ctx.Provider value={{ abierto, abrir, cerrar }}>{children}</Ctx.Provider>;
}

/** Fuera del panel devuelve un menú cerrado que no hace nada, en vez de reventar. */
export function useMenuMovil(): MenuMovil {
  return useContext(Ctx) ?? { abierto: false, abrir: () => {}, cerrar: () => {} };
}
