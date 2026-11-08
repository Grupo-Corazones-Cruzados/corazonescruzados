'use client';

import { useEffect, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Gamepad2, LayoutDashboard, LayoutGrid, Network, Wrench } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import Segmentado from '@/components/ui/Segmentado';
import Miniatura from '@/components/productos/Miniatura';
import { accessRoleOf } from '@/lib/dashboard/access';
import { herramientasPara } from '@/lib/herramientas/catalogo';
import { useRutasEspacio } from '@/components/espacio/useRutasEspacio';
import { appDeTelefono, type AppDeTelefono } from '@/lib/sitio/appDeTelefono';
import { markGameEntry } from '@/lib/world/gameEntry';
import type { Plataforma } from '@/lib/productos/plataformas';
import { definicionTema, type TemaId } from '@/lib/temas';

const mf = { fontFamily: 'var(--font-body)' } as const;

type Pestana = 'apps' | 'productos' | 'herramientas';
const PESTANAS: { valor: Pestana; texto: string }[] = [
  { valor: 'apps', texto: 'Apps' },
  { valor: 'productos', texto: 'Productos' },
  { valor: 'herramientas', texto: 'Herramientas' },
];
const CLAVE_PESTANA = 'gcc_accesos_pestana';

/**
 * ACCESOS — la pantalla de inicio de las apps GCC World y GCC Miembros (Fernando, 2026-11-08: «la
 * interfaz tipo Power Apps»). Se inicia sesión como siempre y se llega aquí; según lo que se elige,
 * se entra. Todo se abre dentro de la misma app y con la misma sesión.
 *
 * · Apps: Progreso (la plataforma), Aventura (el juego) y, para miembros, Centralizado. En GCC World
 *   Centralizado lleva a `PuertaCentralizado`, que manda a GCC Miembros.
 * · Productos: los contratados por la cuenta (`/api/plataformas`, la misma regla que Plataformas).
 * · Herramientas: el catálogo de `lib/herramientas/catalogo.ts`; en GCC World sin las de GCC Miembros.
 *
 * Al arrancar la app o al iniciar sesión, `/dashboard` redirige aquí (`middleware.ts`).
 */
export default function AccesosPage() {
  const router = useRouter();
  const { user } = useAuth();
  const rol = accessRoleOf(user);
  const esEquipo = rol === 'admin' || rol === 'member';
  const [app, setApp] = useState<AppDeTelefono | null>(null);
  const [pestana, setPestana] = useState<Pestana>('apps');
  const [productos, setProductos] = useState<Plataforma[] | null>(null);
  const [entrandoAlJuego, setEntrandoAlJuego] = useState(false);

  useEffect(() => {
    setApp(appDeTelefono());
    try {
      const g = window.localStorage.getItem(CLAVE_PESTANA) as Pestana | null;
      if (g && PESTANAS.some((p) => p.valor === g)) setPestana(g);
    } catch { /* sin almacenamiento: empieza en Apps */ }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch('/api/plataformas')
      .then((r) => (r.ok ? r.json() : { plataformas: [] }))
      .then((j) => setProductos(j.plataformas ?? []))
      .catch(() => setProductos([]));
  }, [user]);

  const elegir = (p: Pestana) => {
    setPestana(p);
    try { window.localStorage.setItem(CLAVE_PESTANA, p); } catch { /* da igual */ }
  };

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

  // En la app el producto se abre aquí mismo; en el navegador, en otra pestaña (como Plataformas).
  const abrirProducto = (url: string) => {
    if (app) window.location.href = url;
    else window.open(url, '_blank', 'noopener');
  };

  const rutasEspacio = useRutasEspacio();
  const herramientas = herramientasPara({ esEquipo, esAdmin: rol === 'admin', app, conEspacio: !!rutasEspacio });

  return (
    <div className="flex flex-col gap-4 max-w-5xl" style={mf}>
      {/* Fijas arriba al desplazarse (Fernando, 2026-11-08). El fondo tapa lo que pasa por debajo. */}
      <div className="sticky -top-4 md:-top-6 z-10 -mx-4 md:-mx-6 -mt-4 md:-mt-6 px-4 md:px-6 pt-4 md:pt-6 pb-2 bg-digi-dark">
        <Segmentado opciones={PESTANAS} valor={pestana} onChange={elegir} etiqueta="Accesos" className="w-full max-w-md" />
      </div>

      {pestana === 'apps' && (
        <Rejilla>
          <Mosaico Icono={LayoutDashboard} tema="claro" titulo="Progreso" texto="La plataforma: tickets, proyectos y tu día."
            onClick={() => router.push(rol === 'client' ? '/dashboard/marketplace' : '/dashboard')} />
          <Mosaico Icono={Gamepad2} tema="negro" titulo="Aventura" texto={entrandoAlJuego ? 'Entrando…' : 'El videojuego del grupo.'}
            onClick={entrarAlJuego} />
          {/* Centralizado solo en GCC Miembros (y en la web): en GCC World no se ofrece a nadie. */}
          {esEquipo && app !== 'progreso' && (
            <Mosaico Icono={Network} tema="orquidea" titulo="Centralizado" texto="Los sistemas de los miembros."
              onClick={() => router.push('/dashboard/centralized')} />
          )}
        </Rejilla>
      )}

      {pestana === 'productos' && (
        productos === null ? (
          <p className="text-[13px] text-digi-muted py-12 text-center">Cargando…</p>
        ) : productos.length === 0 ? (
          <Vacio Icono={LayoutGrid} titulo="Aún no tienes productos" texto="Cuando te suscribas a uno, aparecerá aquí." />
        ) : (
          <Rejilla>
            {productos.map((p) => (
              <Mosaico key={p.url} imagen={p.portada} titulo={p.productoNombre} texto={p.nombre} onClick={() => abrirProducto(p.url)} />
            ))}
          </Rejilla>
        )
      )}

      {pestana === 'herramientas' && (
        herramientas.length === 0 ? (
          <Vacio Icono={Wrench} titulo="Sin herramientas" texto="Aún no hay herramientas para tu cuenta." />
        ) : (
          <Rejilla>
            {herramientas.map((h) => (
              <Mosaico key={h.id} Icono={h.Icon} titulo={h.name} texto={h.description}
                href={h.abre && rutasEspacio ? rutasEspacio[h.abre] : `/dashboard/tools?herramienta=${h.id}`} />
            ))}
          </Rejilla>
        )
      )}
      {entrandoAlJuego && <div aria-hidden className="cambio-tema entra" style={{ background: '#000' }} />}
    </div>
  );
}

function Rejilla({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">{children}</div>;
}

const MOSAICO = 'flex flex-col items-start gap-3 p-4 min-h-[140px] rounded-xl border border-digi-border bg-digi-card text-left transition-colors hover:border-accent/40';

/** Un acceso: icono (o portada del producto), nombre y una línea. */
function Mosaico({ Icono, imagen, titulo, texto, onClick, href, tema }: {
  Icono?: ComponentType<{ className?: string }>;
  /** Las apps llevan el color del tema con que se abren (Fernando, 2026-11-08). */
  tema?: TemaId;
  imagen?: string | null;
  titulo: string;
  texto: string;
  onClick?: () => void;
  href?: string;
}) {
  const contenido = (
    <>
      {Icono && tema ? (
        <span className="w-12 h-12 shrink-0 rounded-lg grid place-items-center border border-white/15"
          style={{ background: definicionTema(tema)?.muestra.acento === '#fafafa' ? '#000' : definicionTema(tema)?.muestra.acento }}>
          <Icono className="w-6 h-6 text-white" />
        </span>
      ) : Icono ? (
        <span className="w-12 h-12 shrink-0 rounded-lg bg-accent-light border border-accent/15 grid place-items-center">
          <Icono className="w-6 h-6 text-accent" />
        </span>
      ) : (
        <Miniatura src={imagen ?? null} grande />
      )}
      <span className="min-w-0 w-full">
        <span className="block text-[14px] font-semibold text-digi-text truncate">{titulo}</span>
        <span className="text-[12px] leading-snug text-digi-muted mt-0.5 line-clamp-2">{texto}</span>
      </span>
    </>
  );
  if (href) return <Link href={href} className={MOSAICO}>{contenido}</Link>;
  return <button type="button" onClick={onClick} className={MOSAICO}>{contenido}</button>;
}

function Vacio({ Icono, titulo, texto }: { Icono: ComponentType<{ className?: string }>; titulo: string; texto: string }) {
  return (
    <div className="pixel-card text-center py-12 max-w-md w-full">
      <Icono className="w-8 h-8 mx-auto text-digi-muted/40 mb-2" />
      <p className="text-[14px] font-semibold text-digi-text">{titulo}</p>
      <p className="text-[12.5px] text-digi-muted mt-1">{texto}</p>
    </div>
  );
}
