'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/components/providers/AuthProvider';
import { useTemaPanel } from '@/components/providers/TemaPanel';
import ModuleTutorialsModal from '@/components/dashboard/ModuleTutorialsModal';
import DialogoVerComoOtro from '@/components/dashboard/DialogoVerComoOtro';
import { accessRoleOf, canAccessModule, isPathBlocked, type AccessRole } from '@/lib/dashboard/access';
import { DASHBOARD_MODULES, MODULE_GROUPS } from '@/lib/dashboard/modules';
import { usePolicyEffects } from '@/components/providers/PolicyEffectsProvider';
import {
  Home, Ticket, FolderKanban, CalendarClock, Store, Users, ReceiptText, Network, Wrench,
  Settings, LifeBuoy, ShieldCheck, Workflow, Menu,
  LogOut, Sun, Moon, Eye, Undo2, CalendarDays, PartyPopper, BrainCircuit, AlarmClock, Info,
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
  const { user, signOut, suplantacion } = useAuth();
  const { oscuro, alternar } = useTemaPanel();
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
  /** Diálogo para tomar la vista de otro usuario. Solo lo abre un administrador. */
  const [verComoOtro, setVerComoOtro] = useState(false);
  const [volviendo, setVolviendo] = useState(false);

  /**
   * ⚠️ `suplantacion` manda sobre el rol. Mientras un administrador mira como otro, su
   * sesión TIENE el rol del otro —así ve lo que el otro ve— así que `user.role` dice
   * «client» aunque delante haya un administrador. Ofrecer el diálogo por el rol lo
   * escondería justo cuando hace falta para volver.
   */
  const esAdmin = user?.role === 'admin';

  const volverAMiCuenta = async () => {
    setVolviendo(true);
    try {
      const r = await fetch('/api/admin/suplantar', { method: 'DELETE' });
      if (!r.ok) { const d = await r.json().catch(() => ({})); toast.error(d.error ?? 'No se pudo volver'); return; }
      // Recarga completa: la sesión cambia de identidad y no queda nada fiable en memoria.
      window.location.href = '/dashboard';
    } finally { setVolviendo(false); }
  };
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
        /* `transition-[width]` y no `transition-all`: lo único que cambia al abrirse es
           el ancho. Animar «todo» hace que el navegador vigile cada propiedad del
           elemento durante la transición — más trabajo por fotograma justo en el momento
           en que se está reordenando el contenido. */
        className={`rail fixed top-0 left-0 h-full z-40 bg-digi-card border-r border-digi-border flex flex-col transition-[width] duration-200
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
          {/* ── DENTRO DE LA CUENTA DE OTRO ────────────────────────────────────────
              Un aviso que no se puede pasar por alto. Sin él, un administrador se olvida
              de que está mirando como un cliente y escribe algo que quedará firmado por
              esa persona — y el registro dirá que lo hizo ella. */}
          {suplantacion && (
            <div className="mb-2 rounded-md px-2 py-2" style={{ background: 'rgba(224, 176, 90, 0.16)' }}>
              {!collapsed && (
                <p className="text-[11px] leading-snug mb-1.5" style={{ ...mf, color: '#E9C07A' }}>
                  Estás viendo la plataforma <strong>como este usuario</strong>.
                </p>
              )}
              <button
                onClick={volverAMiCuenta}
                disabled={volviendo}
                title="Volver a mi cuenta"
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[11.5px] font-medium
                           transition-[filter] duration-150 hover:brightness-125 disabled:opacity-60"
                style={{ ...mf, color: '#1F1A2E', background: '#E9C07A' }}
              >
                <Undo2 className="w-3.5 h-3.5" />
                {!collapsed && (volviendo ? 'Volviendo…' : 'Volver a mi cuenta')}
              </button>
            </div>
          )}

          {user && (() => {
            /* La ficha del usuario. Para un ADMINISTRADOR es además el botón que abre
               «ver como otro usuario»: la foto de perfil es donde uno busca «quién soy»,
               así que es también donde tiene sentido preguntar «¿y si fuera otro?».
               Para el resto es texto, no un botón muerto que no hace nada al pulsarlo. */
            const contenido = (
              <>
                {user.avatar_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full border border-digi-border object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-accent-light border border-accent/20 text-accent text-[12px] font-semibold shrink-0" style={mf}>
                    {(user.first_name?.[0] || user.email[0]).toUpperCase()}
                  </div>
                )}
                {!collapsed && (
                  <div className="min-w-0 text-left">
                    <p className="text-[12px] font-medium text-digi-text truncate" style={mf}>{user.first_name || user.email.split('@')[0]}</p>
                    <p className="text-[10px] text-digi-muted" style={mf}>{ROLE_LABEL_ES[accessRole]}</p>
                  </div>
                )}
                {esAdmin && !collapsed && <Eye className="w-3.5 h-3.5 text-digi-muted ml-auto shrink-0" />}
              </>
            );

            const clases = `flex items-center gap-2.5 mb-2 w-full ${collapsed ? 'justify-center' : ''}`;

            return esAdmin ? (
              <button
                type="button"
                onClick={() => setVerComoOtro(true)}
                title="Ver la plataforma como otro usuario"
                className={`${clases} rounded-md p-1 -m-1 transition-[filter] duration-150 hover:brightness-125`}
              >
                {contenido}
              </button>
            ) : (
              <div className={clases}>{contenido}</div>
            );
          })()}

          {/* Dos botones, con el MISMO comportamiento al pasar por encima: no cambian de
              relleno ni de borde, solo suben el brillo. El botón de contraer sigue fuera,
              que ya no hace falta desde que el menú se abre al acercar el puntero.

              El tema está también en Configuración → Apariencia, y los dos mandan sobre el
              mismo contexto: se toque donde se toque, quedan de acuerdo. */}
          <div className="flex flex-col gap-1.5">
          <button
            onClick={alternar}
            aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            title={oscuro ? 'Modo claro' : 'Modo oscuro'}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[12px] font-medium
                       transition-[filter] duration-150 hover:brightness-125 focus-visible:brightness-125"
            style={{ ...mf, color: '#C9B8FF', background: 'rgba(201, 184, 255, 0.12)' }}
          >
            {oscuro ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {!collapsed && (oscuro ? 'Modo claro' : 'Modo oscuro')}
          </button>

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
        </div>
      </aside>

      {/* Modal de tutoriales del módulo (isla corp: el sidebar ya vive dentro de `.corp`) */}
      <DialogoVerComoOtro abierto={verComoOtro} alCerrar={() => setVerComoOtro(false)} />

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
