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
import type { AccesoProducto } from '@/lib/productos/tipos';
import { PRODUCTOS_EMBEBIDOS, rutaDelProducto } from '@/lib/productos/modulos';
import type { TemaId } from '@/lib/temas';

export type AppAcceso = { id: string; titulo: string; Icono: LucideIcon; tema: TemaId; abrir: () => void };

/**
 * El icono de app de cada producto, servido desde la PROPIA plataforma (`public/productos-iconos/`,
 * 96 px): pedirlo a cada producto (`<producto>.grupocc.org/apple-icon.png`) hacía esperar a cinco
 * servicios distintos y a veces llegaba tarde (Fernando, 2026-11-08). Son copias del
 * `src/app/apple-icon.png` de cada producto: si uno cambia de icono, se vuelve a copiar
 * (`sips -Z 96 productos/<p>/src/app/apple-icon.png --out public/productos-iconos/<p>.png`).
 */
export const iconoDeProducto = (producto: string) => `/productos-iconos/${producto}.png`;

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
  const [productos, setProductos] = useState<AccesoProducto[] | null>(null);
  const [entrandoAlJuego, setEntrandoAlJuego] = useState(false);
  const rutasEspacio = useRutasEspacio();

  useEffect(() => { setApp(appDeTelefono()); }, []);
  // La última lista conocida se pinta al instante y la del servidor la reemplaza al llegar: los
  // productos de una cuenta casi nunca cambian. `/api/productos/accesos` es la consulta ligera (sin
  // portadas ni soluciones, que el menú no usa).
  useEffect(() => {
    if (!user) return;
    const llave = `gcc_accesos_productos:${user.id}`;
    try { const g = localStorage.getItem(llave); if (g) setProductos(JSON.parse(g)); } catch { /* sin caché */ }
    fetch('/api/productos/accesos')
      .then((r) => (r.ok ? r.json() : { data: {} }))
      .then((j) => {
        const lista = Object.values(j.data ?? {}).flat() as AccesoProducto[];
        setProductos(lista);
        try { localStorage.setItem(llave, JSON.stringify(lista)); } catch { /* da igual */ }
      })
      .catch(() => setProductos((p) => p ?? []));
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

  // En la app, un producto que sabe entrar con la sesión de GCC World se abre DENTRO, con su menú como
  // segunda capa (`/dashboard/producto/…`); los demás, aquí mismo como antes. En el navegador, en otra
  // pestaña (como Plataformas).
  const abrirProducto = (p: AccesoProducto) => {
    if (app && PRODUCTOS_EMBEBIDOS.has(p.producto)) router.push(rutaDelProducto(p.producto, p.slug));
    else if (app) window.location.href = p.url;
    else window.open(p.url, '_blank', 'noopener');
  };

  const herramientas: Herramienta[] = herramientasPara({ esEquipo, esAdmin: rol === 'admin', app, conEspacio: !!rutasEspacio });
  const rutaHerramienta = (h: Herramienta) => (h.abre && rutasEspacio ? rutasEspacio[h.abre] : `/dashboard/tools?herramienta=${h.id}`);

  return { apps, productos, herramientas, rutaHerramienta, abrirProducto, entrandoAlJuego };
}
