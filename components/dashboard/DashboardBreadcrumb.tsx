'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ChevronRight } from 'lucide-react';
import { RanuraAcciones } from './PieAcciones';
import { PISOS, PASOS } from '@/lib/centralized/systems';
import { RUTAS_HERRAMIENTA } from '@/lib/herramientas/catalogo';

const mf = { fontFamily: 'var(--font-body)' } as const;

// Etiquetas legibles por segmento de ruta (coinciden con el sidebar y subpáginas).
const LABELS: Record<string, string> = {
  tickets: 'Tickets', projects: 'Proyectos', subscriptions: 'Suscripciones', clients: 'Clientes',
  invoices: 'Facturas', marketplace: 'Marketplace', plataformas: 'Plataformas', automatizaciones: 'Automatizaciones',
  tools: 'Herramientas', enlaces: 'Enlaces de un solo uso', entregas: 'Entregas de un solo uso', centralized: 'Centralizado', settings: 'Configuración', support: 'Soporte', admin: 'Admin',
  availability: 'Disponibilidad', cv: 'Mi CV', portfolio: 'Portafolio', calendar: 'Calendario',
  incidents: 'Incidentes', espacio: 'Espacio de trabajo', 'espacio-app': 'Espacio de trabajo', 'gumdramon-app': 'Gumdramon',
};

function labelFor(seg: string): string {
  if (/^\d+$/.test(seg)) return `#${seg}`;
  if (seg.length >= 20) return 'Detalle'; // tokens/ids largos
  return LABELS[seg] || seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
}

type Miga = { label: string; href: string | null };

/** Rutas que son su propia sección (no Progreso): sus tramos cuelgan directamente de «Inicio». */
const SECCIONES_PROPIAS = ['/dashboard/producto', ...RUTAS_HERRAMIENTA];

/**
 * LA RUTA DEL PIE (Fernando, 2026-11-09):
 *  · «Inicio» lleva a Comunicados (`/dashboard/accesos`), la portada de las apps y de la web.
 *  · Después, la sección con su NOMBRE y su propio inicio: «Centralizado» → su dashboard, «Progreso» →
 *    el de Progreso (`/dashboard`, que antes se llamaba «Inicio»).
 *  · En Centralizado el piso y el paso del 4P son solo texto: no son páginas (pulsar «Implementación»
 *    daba 404). Lo que viene después del paso sí se puede pulsar.
 */
function migas(pathname: string): Miga[] {
  const seg = pathname.replace(/^\/+|\/+$/g, '').split('/'); // ['dashboard', ...]
  const out: Miga[] = [{ label: 'Inicio', href: '/dashboard/accesos' }];
  if (pathname === '/dashboard/accesos') return out;
  const tramos = (desde: number) => seg.slice(desde).map((s, i) => ({ label: labelFor(s), href: '/' + seg.slice(0, desde + i + 1).join('/') }));

  if (seg[1] === 'centralized') {
    out.push({ label: 'Centralizado', href: '/dashboard/centralized' });
    const piso = PISOS.find((p) => p.key === seg[2]);
    const paso = PASOS.find((p) => p.key === seg[3]);
    if (seg[2]) out.push({ label: piso?.label ?? labelFor(seg[2]), href: null });
    if (seg[3]) out.push({ label: paso?.label ?? labelFor(seg[3]), href: null });
    // El sistema por su nombre («Generacion de contenido»), no «Detalle» por ser una palabra larga.
    const resto = tramos(4);
    if (resto[0] && seg[4]) resto[0].label = seg[4].charAt(0).toUpperCase() + seg[4].slice(1).replace(/-/g, ' ');
    return [...out, ...resto];
  }
  if (SECCIONES_PROPIAS.some((r) => pathname === r || pathname.startsWith(r + '/'))) return [...out, ...tramos(1)];
  out.push({ label: 'Progreso', href: '/dashboard' });
  return [...out, ...tramos(1)];
}

export default function DashboardBreadcrumb({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname() || '/dashboard';
  if (!pathname.startsWith('/dashboard')) return null;
  const crumbs = migas(pathname);

  return (
    <nav
      aria-label="Ruta"
      /* Marca para que quien se estire hasta abajo (p. ej. `PixelDataTable`) MIDA este pie y
         no termine por debajo. Se mide en vez de codificar los 36 px: si el pie cambia de
         alto o no existe (páginas fuera del dashboard), el cálculo sigue siendo correcto. */
      data-app-footer=""
      /* `overflow-visible` a propósito: la ranura de acciones lleva un contador que sale
         un poco por arriba del botón, y con `overflow-x-auto` quedaba recortado. La ruta,
         que es lo que podía desbordar, se desplaza en su propio contenedor. */
      className={`fixed bottom-0 right-0 left-0 z-20 h-[var(--pie-panel)] pb-[var(--seguro-abajo)] flex items-center gap-1 px-3 sm:px-4 border-t border-digi-border bg-digi-card whitespace-nowrap transition-[left] duration-200 ${
        collapsed ? 'lg:left-16' : 'lg:left-56'
      }`}
      style={mf}
    >
      {/* ⚠️ SIN DESPLAZAMIENTO (Fernando, 2026-10-23). Era `overflow-x-auto` y en el teléfono,
          con los destinos táctiles de 44 px, el contenido desbordaba y el navegador pintaba una
          barrita de desplazamiento dentro del pie. Ahora no se desplaza nada: el último tramo
          se recorta con «…» y, en el teléfono, solo quedan Inicio y la página actual: con el
          tramo anterior, «Entregas de un solo uso» se quedaba en «Entr…» (y para volver un
          paso ya está la flecha de la cabecera). */}
      <div className="flex items-center gap-1 min-w-0 self-stretch overflow-hidden">
      <Home className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-digi-muted shrink-0" />
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        const intermedio = i > 0 && !last;
        return (
          <span key={i} className={`items-center gap-1 ${last ? 'flex min-w-0' : intermedio ? 'hidden sm:flex shrink-0' : 'flex shrink-0'}`}>
            {i > 0 && <ChevronRight className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-digi-muted/60 shrink-0" />}
            {last ? (
              <span className="text-[13px] sm:text-[12px] font-medium text-digi-text truncate">{c.label}</span>
            ) : !c.href ? (
              <span className="text-[13px] sm:text-[12px] text-digi-muted">{c.label}</span>
            ) : (
              <Link href={c.href!} className="destino-tactil inline-flex items-center text-[13px] sm:text-[12px] text-digi-muted hover:text-accent transition-colors">{c.label}</Link>
            )}
          </span>
        );
      })}
      </div>

      {/* Aquí se portan los lanzadores de chat, notificaciones y el bot de cotizaciones.
          Antes flotaban sobre el contenido y se colocaban midiéndose entre ellos. */}
      <RanuraAcciones />
    </nav>
  );
}
