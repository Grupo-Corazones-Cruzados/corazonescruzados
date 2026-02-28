"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import Avatar from "@/components/ui/Avatar";
import styles from "./Sidebar.module.css";

const NAV_ITEMS = [
  { path: "/dashboard", label: "Inicio", icon: "home", roles: ["client", "member", "admin"] },
  { path: "/dashboard/tickets", label: "Tickets", icon: "ticket", roles: ["client", "member", "admin"] },
  { path: "/dashboard/projects", label: "Proyectos", icon: "folder", roles: ["client", "member", "admin"] },
  { path: "/dashboard/packages", label: "Paquetes", icon: "package", roles: ["client", "member", "admin"] },
  { path: "/dashboard/invoices", label: "Facturas", icon: "receipt", roles: ["client", "member", "admin"] },
  { path: "/dashboard/marketplace", label: "Marketplace", icon: "store", roles: ["client", "member", "admin"] },
  { path: "/dashboard/recruitment", label: "Reclutamiento", icon: "users", roles: ["member", "admin"] },
  { path: "/dashboard/settings", label: "Configuración", icon: "settings", roles: ["client", "member", "admin"] },
  { path: "/dashboard/admin", label: "Admin", icon: "shield", roles: ["admin"] },
] as const;

const ICONS: Record<string, string> = {
  home: "M3 9.5L10 3l7 6.5V17a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z",
  ticket: "M4 4h12a2 2 0 012 2v1a2 2 0 000 4v1a2 2 0 01-2 2H4a2 2 0 01-2-2v-1a2 2 0 000-4V6a2 2 0 012-2z",
  folder: "M4 4h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z",
  package: "M3 7l7-4 7 4v6l-7 4-7-4V7z",
  receipt: "M5 3h10a2 2 0 012 2v12l-3-2-2 2-2-2-2 2-2-2-3 2V5a2 2 0 012-2z",
  store: "M3 3h14l1 7H2L3 3zM4 10v7a1 1 0 001 1h10a1 1 0 001-1v-7",
  users: "M12 4.5a3 3 0 110 6 3 3 0 010-6zM4 7.5a2.5 2.5 0 110 5 2.5 2.5 0 010-5zM20 7.5a2.5 2.5 0 110 5 2.5 2.5 0 010-5z",
  settings: "M12 15a3 3 0 100-6 3 3 0 000 6z",
  shield: "M12 2l7 4v4c0 5.25-3.5 9.74-7 11-3.5-1.26-7-5.75-7-11V6l7-4z",
};

export default function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  if (!user) return null;

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.roles.includes(user.role)
  );

  return (
    <aside className={styles.sidebar}>
      <div className={styles.top}>
        <Link href="/" className={styles.logo}>
          <img src="/LogoCC.png" alt="CC" className={styles.logoImg} />
          <span className={styles.logoText}>CC</span>
        </Link>
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
              <span>{item.label}</span>
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
          <div className={styles.userInfo}>
            <span className={styles.userName}>
              {user.first_name || user.email.split("@")[0]}
            </span>
            <span className={styles.userRole}>{user.role}</span>
          </div>
        </div>
        <button className={styles.signOut} onClick={signOut}>
          Salir
        </button>
      </div>
    </aside>
  );
}
