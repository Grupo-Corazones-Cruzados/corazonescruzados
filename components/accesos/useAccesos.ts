'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Gamepad2, LayoutDashboard, Network, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRutasEspacio } from '@/components/espacio/useRutasEspacio';
import { accessRoleOf } from '@/lib/dashboard/access';
import { herramientasPara, type Herramienta } from '@/lib/herramientas/catalogo';
import { appDeTelefono, type AppDeTelefono } from '@/lib/sitio/appDeTelefono';
import { markGameEntry } from '@/lib/world/gameEntry';
import type { Plataforma } from '@/lib/productos/plataformas';
import type { TemaId } from '@/lib/temas';

export type AppAcceso = { id: string; titulo: string; Icono: LucideIcon; tema: TemaId; abrir: () => void };

/** Cada producto sirve su icono de app en `/apple-icon.png` (180 px), el mismo del teléfono. */
export function iconoDeProducto(url: string): string | null {
  try { return `${new URL(url).origin}/apple-icon.png`; } catch { return null; }
}

/**
 * LO QUE OFRECE ACCESOS a esta cuenta en esta app: las apps (Progreso, Aventura y, en GCC Miembros,
 * Centralizado), los productos contratados y las herramientas. Lo usa el menú lateral de Accesos
 * (`MenuAccesos`, Fernando, 2026-11-08: «mover el header a un menú lateral izquierdo»).
 */
export function useAccesos() {
  const router = useRouter();
  const { user } = useAuth();
  const rol = accessRoleOf(user);
  const esEquipo = rol === 'admin' || rol === 'member';
  const [app, setApp] = useState<AppDeTelefono | null>(null);
  const [productos, setProductos] = useState<Plataforma[] | null>(null);
  const [entrandoAlJuego, setEntrandoAlJuego] = useState(false);
  const rutasEspacio = useRutasEspacio();

  useEffect(() => { setApp(appDeTelefono()); }, []);
  useEffect(() => {
    if (!user) return;
    fetch('/api/plataformas')
      .then((r) => (r.ok ? r.json() : { plataformas: [] }))
      .then((j) => setProductos(j.plataformas ?? []))
      .catch(() => setProductos([]));
  }, [user]);

  /** Con personaje y cuenta en regla se entra directo; si no, la portada lleva por la intro. */
  const entrarAlJuego = async () => {
    if (entrandoAlJuego) return;
    setEntrandoAlJuego(true);
    // Aventura usa el tema negro: se funde a negro mientras se decide a dónde entrar.
    await new Promise((r) => window.setTimeout(r, 320));
    try {
      const j = await fetch('/api/character/me', { cache: 'no-store' }).then((r) => r.json());
      const enRegla = j?.isMember || j?.hasAccount || (j?.approved && j?.emailVerified);
      if (j?.exists && j.characterData && enRegla) {
        markGameEntry();
        window.location.href = '/juego';
        return;
      }
    } catch { /* sin respuesta: la portada lo resuelve */ }
    window.location.href = '/?acceso=videojuego';
  };

  const apps: AppAcceso[] = [
    { id: 'progreso', titulo: 'Progreso', Icono: LayoutDashboard, tema: 'claro',
      abrir: () => router.push(rol === 'client' ? '/dashboard/marketplace' : '/dashboard') },
    { id: 'aventura', titulo: 'Aventura', Icono: Gamepad2, tema: 'negro', abrir: entrarAlJuego },
    // Centralizado solo en GCC Miembros (y en la web): en GCC World no se ofrece a nadie.
    ...(esEquipo && app !== 'progreso'
      ? [{ id: 'centralizado', titulo: 'Centralizado', Icono: Network, tema: 'orquidea' as TemaId, abrir: () => router.push('/dashboard/centralized') }]
      : []),
  ];

  // En la app el producto se abre aquí mismo; en el navegador, en otra pestaña (como Plataformas).
  const abrirProducto = (url: string) => {
    if (app) window.location.href = url;
    else window.open(url, '_blank', 'noopener');
  };

  const herramientas: Herramienta[] = herramientasPara({ esEquipo, esAdmin: rol === 'admin', app, conEspacio: !!rutasEspacio });
  const rutaHerramienta = (h: Herramienta) => (h.abre && rutasEspacio ? rutasEspacio[h.abre] : `/dashboard/tools?herramienta=${h.id}`);

  return { apps, productos, herramientas, rutaHerramienta, abrirProducto, entrandoAlJuego };
}
