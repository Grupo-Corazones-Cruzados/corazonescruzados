"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import styles from "@/app/styles/DashboardLayout.module.css";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

// Icons
const HomeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const TicketIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
  </svg>
);

interface NavTab {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles?: string[];
}

const ProjectIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const InvoiceIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

const AdminIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const navTabs: NavTab[] = [
  { label: "Inicio", href: "/dashboard", icon: <HomeIcon /> },
  { label: "Tickets", href: "/dashboard/tickets", icon: <TicketIcon /> },
  { label: "Proyectos", href: "/dashboard/projects", icon: <ProjectIcon /> },
  { label: "Facturas", href: "/dashboard/invoices", icon: <InvoiceIcon /> },
  { label: "Admin", href: "/dashboard/admin", icon: <AdminIcon />, roles: ["admin"] },
  { label: "Ajustes", href: "/dashboard/settings", icon: <SettingsIcon /> },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, loading: authLoading, profile } = useAuth();

  const userRole = profile?.rol || "cliente";

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth");
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading) {
    return (
      <div className={styles.layout}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner} />
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  const filteredTabs = navTabs.filter((tab) => {
    if (!tab.roles) return true;
    return tab.roles.includes(userRole);
  });

  return (
    <div className={styles.layout}>
      {/* Navigation Tabs */}
      <nav className={styles.tabsNav} aria-label="Dashboard navigation">
        <div className={styles.tabsContainer}>
          {filteredTabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`${styles.tab} ${isActive(tab.href) ? styles.tabActive : ""}`}
            >
              <span className={styles.tabIcon}>{tab.icon}</span>
              <span className={styles.tabLabel}>{tab.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <main className={styles.main}>
        <div className={styles.content}>{children}</div>
      </main>
    </div>
  );
}
