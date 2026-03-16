"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import Avatar from "@/components/ui/Avatar";
import NotificationBell from "./NotificationBell";
import styles from "./Sidebar.module.css";

const NAV_ITEMS = [
  { path: "/dashboard", label: "Inicio", icon: "home", roles: ["client", "member", "admin"] },
  { path: "/dashboard/tickets", label: "Tickets", icon: "ticket", roles: ["client", "member", "admin"] },
  { path: "/dashboard/projects", label: "Proyectos", icon: "folder", roles: ["client", "member", "admin"] },

  { path: "/dashboard/marketplace", label: "Marketplace", icon: "store", roles: ["client", "member", "admin"] },
  { path: "/dashboard/centralized-project", label: "Proyecto Centralizado", icon: "users", roles: ["member", "admin"] },
  { path: "/dashboard/automations", label: "Automatizaciones", icon: "zap", roles: ["member", "admin"] },
  { path: "/dashboard/settings", label: "Configuración", icon: "settings", roles: ["client", "member", "admin"] },
  { path: "/dashboard/support", label: "Soporte", icon: "helpCircle", roles: ["client", "member", "admin"] },
  { path: "/dashboard/admin", label: "Admin", icon: "shield", roles: ["admin"] },
] as const;

const ICONS: Record<string, string> = {
  home: "M3 9.5L10 3l7 6.5V17a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z",
  ticket: "M4 4h12a2 2 0 012 2v1a2 2 0 000 4v1a2 2 0 01-2 2H4a2 2 0 01-2-2v-1a2 2 0 000-4V6a2 2 0 012-2z",
  folder: "M4 4h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z",

  receipt: "M5 3h10a2 2 0 012 2v12l-3-2-2 2-2-2-2 2-2-2-3 2V5a2 2 0 012-2z",
  store: "M3 3h14l1 7H2L3 3zM4 10v7a1 1 0 001 1h10a1 1 0 001-1v-7",
  users: "M7 10a3 3 0 100-6 3 3 0 000 6zM1 17v-1a4 4 0 014-4h4a4 4 0 014 4v1M13 4.5a3 3 0 010 5.5M17 17v-1a4 4 0 00-3-3.87",
  settings: "M10 13a3 3 0 100-6 3 3 0 000 6zM16.5 10a6.5 6.5 0 01-.7 2.8l1.5 1.5-1.4 1.4-1.5-1.5A6.5 6.5 0 0110 16.5a6.5 6.5 0 01-4.4-1.8l-1.5 1.5-1.4-1.4 1.5-1.5A6.5 6.5 0 013.5 10a6.5 6.5 0 011.3-3.8L3.3 4.7l1.4-1.4 1.5 1.5A6.5 6.5 0 0110 3.5a6.5 6.5 0 013.8 1.3l1.5-1.5 1.4 1.4-1.5 1.5A6.5 6.5 0 0116.5 10z",
  zap: "M11 2L4 12h5l-1 6 7-10H10l1-6z",
  helpCircle: "M10 18a8 8 0 100-16 8 8 0 000 16zM7.5 7.5a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 3.5M10 14.5v.01",
  shield: "M12 2l7 4v4c0 5.25-3.5 9.74-7 11-3.5-1.26-7-5.75-7-11V6l7-4z",
};

export default function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (!user) return null;

  const visibleItems = NAV_ITEMS.filter((item) =>
    (item.roles as readonly string[]).includes(user.role)
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className={styles.mobileBar}>
        <button
          className={styles.hamburger}
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <Link href="/dashboard" className={styles.mobileLogo}>
          <img src="/LogoCC.png" alt="GCC" className={styles.logoImg} />
          <span className={styles.logoText}>GCC</span>
        </Link>
        <NotificationBell collapsed={false} />
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className={styles.overlay} onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""} ${mobileOpen ? styles.mobileOpen : ""}`}
        data-collapsed={collapsed || undefined}
      >
        <div className={styles.top}>
          <Link href="/" className={styles.logo}>
            <img src="/LogoCC.png" alt="GCC" className={styles.logoImg} />
            {!collapsed && <span className={styles.logoText}>GCC</span>}
          </Link>
          <div className={styles.topActions}>
            <NotificationBell collapsed={collapsed} />
            <button
              className={styles.mobileClose}
              onClick={() => setMobileOpen(false)}
              aria-label="Cerrar menú"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <nav className={styles.nav}>
          {visibleItems.map((item) => {
            const isActive =
              item.path === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`${styles.link} ${isActive ? styles.active : ""}`}
                title={collapsed ? item.label : undefined}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className={styles.icon}>
                  <path
                    d={ICONS[item.icon] || ICONS.home}
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className={styles.bottom}>
          <div className={styles.user}>
            <Avatar
              src={user.avatar_url}
              name={`${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email}
              size="sm"
            />
            {!collapsed && (
              <div className={styles.userInfo}>
                <span className={styles.userName}>
                  {user.first_name || user.email.split("@")[0]}
                </span>
                <span className={styles.userRole}>{user.role}</span>
              </div>
            )}
          </div>
          <div className={styles.bottomActions}>
            {!collapsed && (
              <button className={styles.signOut} onClick={signOut}>
                Salir
              </button>
            )}
            {collapsed && (
              <button
                className={styles.signOut}
                onClick={signOut}
                title="Salir"
              >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M7 3H4a1 1 0 00-1 1v12a1 1 0 001 1h3M10 10h7m0 0l-3-3m3 3l-3 3"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
            <button
              className={styles.toggle}
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
              title={collapsed ? "Expandir" : "Colapsar"}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path
                  d={collapsed
                    ? "M7 4l6 6-6 6"   /* chevron right */
                    : "M13 16l-6-6 6-6" /* chevron left */
                  }
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
