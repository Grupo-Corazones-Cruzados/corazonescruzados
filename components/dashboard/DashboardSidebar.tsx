'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import ModuleTutorialsModal from '@/components/dashboard/ModuleTutorialsModal';
import { accessRoleOf, canAccessModule, isPathBlocked, type AccessRole } from '@/lib/dashboard/access';
import { DASHBOARD_MODULES, MODULE_GROUPS } from '@/lib/dashboard/modules';
import { usePolicyEffects } from '@/components/providers/PolicyEffectsProvider';
import {
  Home, Ticket, FolderKanban, CalendarClock, Store, Users, ReceiptText, Network, Wrench,
  Settings, LifeBuoy, ShieldCheck, Workflow, Menu,
  LogOut, CalendarDays, PartyPopper, BrainCircuit, AlarmClock, Info,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}
interface NavGroup { title: string; items: NavItem[]; }

// Etiqueta del rol efectivo (candidato/cliente/miembro/admin) para mostrar al usuario.
const ROLE_LABEL_ES: Record<AccessRole, string> = {
  candidate: 'Candidato',
  client: 'Cliente',
  member: 'Miembro',
  admin: 'Admin',
};

// Iconos por nombre: el catálogo de módulos (`lib/dashboard/modules.ts`) es data pura
// (también lo usan rutas de servidor), así que el componente resuelve el icono aquí.
const ICONS: Record<string, LucideIcon> = {
  Home, CalendarDays, PartyPopper, BrainCircuit, AlarmClock, Ticket, FolderKanban,
  CalendarClock, Users, ReceiptText, Store, Workflow, Wrench, Network, Settings,
  LifeBuoy, ShieldCheck,
};

// La visibilidad por rol se decide con `canAccessModule` (lib/dashboard/access.ts),
// la MISMA fuente de verdad que usa el guard de rutas. El orden y las etiquetas salen
// del catálogo compartido `DASHBOARD_MODULES`.
const NAV_GROUPS: NavGroup[] = MODULE_GROUPS.map((title) => ({
  title,
  items: DASHBOARD_MODULES
    .filter((m) => m.group === title)
    .map((m) => ({ label: m.label, href: m.href, icon: ICONS[m.icon] ?? Home })),
}));

const mf = { fontFamily: 'var(--font-body)' } as const;

export default function DashboardSidebar() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  /**
   * ⇒ EL MENÚ SE ABRE AL PASAR EL PUNTERO Y SE CIERRA AL SALIR.
   *
   * Antes se abría con un botón ««» que había que buscar, acertar y volver a pulsar: tres
   * decisiones para algo que uno solo quiere mientras mira. Ahora el raíl es estrecho por
   * defecto —iconos, que es como se navega el 90 % del tiempo— y se despliega al acercarse.
   *
   * ⚠️ Se monta ENCIMA del contenido, no lo empuja: el `main` conserva siempre el margen
   * del raíl estrecho (ver el layout). Si empujara, la página se movería entera cada vez
   * que el ratón cruza la izquierda camino de otra cosa.
   *
   * En táctil no hay puntero y `hover` no existe: allí manda el botón de hamburguesa
   * (`mobileOpen`), que abre el menú entero y ya funcionaba así.
   */
  const [sobreElMenu, setSobreElMenu] = useState(false);
  const collapsed = !(sobreElMenu || mobileOpen);
  // Módulo cuyo modal de tutoriales está abierto (null = ninguno). Al cerrarlo el
  // modal se DESMONTA, así el iframe de YouTube deja de reproducir.
  const [tutorialFor, setTutorialFor] = useState<NavItem | null>(null);
  // Cuántos videos activos tiene cada módulo — solo para resaltar el botón ⓘ de los
  // módulos que ya tienen tutorial publicado.
  const [tutorialCounts, setTutorialCounts] = useState<Record<string, number>>({});

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetch('/api/tutoriales?counts=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j?.data) setTutorialCounts(j.data); })
      .catch(() => {});
    return () => { alive = false; };
  }, [user]);

  const accessRole = accessRoleOf(user);
  const { blockedModules } = usePolicyEffects();
  const groups = NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((it) => canAccessModule(accessRole, it.href) && (accessRole === 'admin' || !isPathBlocked(it.href, blockedModules))) }))
    .filter((g) => g.items.length > 0);

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-30 lg:hidden w-10 h-10 flex items-center justify-center rounded-lg border border-digi-border bg-digi-card text-accent shadow-sm hover:border-accent transition-colors"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Backdrop */}
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside
        onMouseEnter={() => setSobreElMenu(true)}
        onMouseLeave={() => setSobreElMenu(false)}
        /* `rail` redefine los tokens de color SOLO aquí dentro (ver globals.css). Por eso
           ni una de las clases de abajo cambia: `bg-digi-card`, `text-digi-muted` y demás
           leen la variable del ancestro más cercano, que pasa a ser el raíl. */
        className={`rail fixed top-0 left-0 h-full z-40 bg-digi-card border-r border-digi-border flex flex-col transition-all duration-200
          ${collapsed ? 'w-16' : 'w-56 shadow-2xl'}
          ${mobileOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Brand */}
        <Link href="/" className={`flex items-center gap-2.5 h-14 border-b border-digi-border hover:bg-white/[0.05] transition-colors shrink-0 ${collapsed ? 'justify-center px-0' : 'px-4'}`}>
          {/* El LOGO, no el indicador de carga. Eran el mismo componente y dejaron de
              serlo (2026-08-28): un anillo girando en la esquina de la marca no dice
              «GCC World», dice «espera». Aquí el logo gira despacio porque es la firma
              de la casa; en las pantallas de carga hay un spinner de verdad. */}
          <Image
            src="/logo-gcc.png" alt="" width={30} height={30} priority
            className="rounded-full select-none shrink-0 motion-reduce:animate-none"
            style={{ animation: 'slowSpin 12s linear infinite reverse' }}
          />
          {!collapsed && <span className="text-[14px] font-bold text-digi-text tracking-tight truncate" style={mf}>GCC WORLD</span>}
        </Link>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {groups.map((group, gi) => (
            <div key={group.title} className={gi > 0 ? 'mt-2' : ''}>
              {!collapsed ? (
                <p className="text-[10px] font-semibold uppercase tracking-wide text-digi-muted/70 px-2.5 pt-2 pb-1" style={mf}>{group.title}</p>
              ) : gi > 0 ? (
                <div className="h-px bg-digi-border/60 mx-2 my-2" />
              ) : null}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActive(item.href);
                  const hasTutorials = (tutorialCounts[item.href] ?? 0) > 0;
                  return (
                    <div key={item.href} className="relative">
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={`relative flex items-center gap-2.5 rounded-md py-2 text-[13px] font-medium transition-colors ${collapsed ? 'justify-center px-0' : 'pl-2.5 pr-9'} ${
                          active ? 'bg-accent-light text-accent' : 'text-digi-muted hover:text-digi-text hover:bg-white/[0.06]'
                        }`}
                        style={mf}
                      >
                        {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-accent" />}
                        <item.icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-accent' : ''}`} strokeWidth={2} />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </Link>

                      {/* Botón de información: abre los videos tutoriales del módulo.
                          Va al borde derecho del botón del módulo; se oculta con el
                          sidebar colapsado (no hay ancho). Se resalta si ya hay video. */}
                      {!collapsed && (
                        <button
                          type="button"
                          onClick={() => setTutorialFor(item)}
                          title={`Tutoriales de ${item.label}`}
                          aria-label={`Tutoriales de ${item.label}`}
                          className={`absolute right-1 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-md transition-colors hover:bg-accent-light hover:text-accent ${
                            hasTutorials ? 'text-accent' : 'text-digi-muted/40'
                          }`}
                        >
                          <Info className="w-[15px] h-[15px]" strokeWidth={2} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User section */}
        <div className="border-t border-digi-border p-2.5 shrink-0">
          {user && (
            <div className={`flex items-center gap-2.5 mb-2 ${collapsed ? 'justify-center' : ''}`}>
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full border border-digi-border object-cover shrink-0" />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-accent-light border border-accent/20 text-accent text-[12px] font-semibold shrink-0" style={mf}>
                  {(user.first_name?.[0] || user.email[0]).toUpperCase()}
                </div>
              )}
              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-digi-text truncate" style={mf}>{user.first_name || user.email.split('@')[0]}</p>
                  <p className="text-[10px] text-digi-muted" style={mf}>{ROLE_LABEL_ES[accessRole]}</p>
                </div>
              )}
            </div>
          )}

          {/* El pie se queda con UNA sola cosa. El interruptor de tema se fue a
              Configuración —es una preferencia, no una herramienta de uso diario— y el
              botón de contraer sobra desde que el menú se abre al pasar el puntero. */}
          <button
            onClick={signOut}
            aria-label="Cerrar sesión"
            title="Cerrar sesión"
            /* ⚠️ El hover NO cambia el relleno ni el borde: solo sube el brillo. Antes se
               teñía de rojo claro y movía el borde, y sobre el raíl oscuro ese recuadro
               saltaba a la vista más que el propio menú. Con `brightness` el botón se
               queda igual —los mismos colores en los dos temas— y solo se ilumina, que es
               todo lo que un hover tiene que decir. */
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12px] font-medium
                       transition-[filter] duration-150 hover:brightness-125 focus-visible:brightness-125"
            style={{ ...mf, color: '#F0A6AE', background: 'rgba(224, 90, 106, 0.14)' }}
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && 'Salir'}
          </button>
        </div>
      </aside>

      {/* Modal de tutoriales del módulo (isla corp: el sidebar ya vive dentro de `.corp`) */}
      {tutorialFor && (
        <ModuleTutorialsModal
          module={tutorialFor.href}
          label={tutorialFor.label}
          onClose={() => setTutorialFor(null)}
        />
      )}
    </>
  );
}
