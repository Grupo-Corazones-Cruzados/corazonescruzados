"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import styles from "@/app/styles/DashboardLayout.module.css";

interface DashboardLayoutProps {
  children: React.ReactNode;
  rightContent?: React.ReactNode;
}

interface Seccion {
  id: string;
  label: string;
  href: string;
  icono: string;
}

interface Modulo {
  id: number;
  nombre: string;
  ruta: string;
  secciones: Seccion[];
  roles_permitidos: string[];
}

// Icons
const HomeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const getIcono = (icono: string) => {
  switch (icono) {
    case "ticket":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
        </svg>
      );
    case "plus":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" x2="12" y1="5" y2="19" />
          <line x1="5" x2="19" y1="12" y2="12" />
        </svg>
      );
    case "users":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case "user-check":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <polyline points="16 11 18 13 22 9" />
        </svg>
      );
    case "shield":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case "folder":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      );
    case "shopping-bag":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" x2="21" y1="6" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      );
    case "database":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3" />
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
        </svg>
      );
    case "zap":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case "settings":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case "package":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16.5 9.4 7.55 4.24" />
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.29 7 12 12 20.71 7" />
          <line x1="12" x2="12" y1="22" y2="12" />
        </svg>
      );
    case "cart":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="21" r="1" />
          <circle cx="19" cy="21" r="1" />
          <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
        </svg>
      );
    case "mercado":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
          <line x1="3" x2="21" y1="6" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      );
    case "file-text":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" x2="8" y1="13" y2="13" />
          <line x1="16" x2="8" y1="17" y2="17" />
          <line x1="10" x2="8" y1="9" y2="9" />
        </svg>
      );
    default:
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
};

function DashboardLayoutInner({ children, rightContent }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading: authLoading, profile } = useAuth();

  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [loadingModulos, setLoadingModulos] = useState(true);

  const userRole = profile?.rol || "cliente";

  // Cargar módulos con secciones
  useEffect(() => {
    const fetchModulos = async () => {
      try {
        const response = await fetch("/api/modulos");
        const data = await response.json();
        if (response.ok) {
          setModulos(data.modulos || []);
        }
      } catch (error) {
        console.error("Error al cargar módulos:", error);
      }
      setLoadingModulos(false);
    };

    if (isAuthenticated) {
      fetchModulos();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth");
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading || loadingModulos) {
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

  // Encontrar el módulo actual basado en el pathname
  const fromParam = searchParams.get("from");
  const currentModulo = (() => {
    // Si viene desde "Mi Espacio", usar ese módulo para las tabs
    if (fromParam === "miembro") {
      const miEspacio = modulos.find((m) => m.ruta === "/dashboard/miembro");
      if (miEspacio) return miEspacio;
    }
    return modulos.find((m) => {
      if (pathname === "/dashboard") return false;
      if (pathname.startsWith(m.ruta)) return true;
      if (m.secciones?.some((s: Seccion) => pathname === s.href || pathname.startsWith(s.href + "/"))) return true;
      return false;
    });
  })();

  // Filtrar módulos por rol
  const canAccessModulo = (modulo: Modulo) => {
    if (!modulo.roles_permitidos || modulo.roles_permitidos.length === 0) return true;
    return modulo.roles_permitidos.includes(userRole);
  };

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    // Cuando viene desde Mi Espacio y estamos en detalle de proyecto,
    // marcar "Mis Proyectos" como activo
    if (fromParam === "miembro" && href === "/dashboard/miembro/proyectos" && pathname.startsWith("/dashboard/projects/")) {
      return true;
    }
    // Coincidencia exacta
    if (pathname === href) {
      return true;
    }
    // Para subrutas, verificar que sea la más específica
    // Buscar si hay alguna otra sección que sea más específica
    const isMoreSpecificMatch = secciones.some(
      (s) => s.href !== href && pathname.startsWith(s.href) && s.href.length > href.length
    );
    // Solo marcar como activo si no hay una coincidencia más específica
    return pathname.startsWith(href + "/") && !isMoreSpecificMatch;
  };

  // Obtener secciones del módulo actual
  const secciones = currentModulo?.secciones || [];

  return (
    <div className={styles.layout}>
      {/* Navigation Tabs */}
      <nav className={styles.tabsNav} aria-label="Dashboard navigation">
        <div className={styles.tabsWrapper}>
          <div className={styles.tabsContainer}>
            {/* Siempre mostrar Inicio */}
            <Link
              href="/dashboard"
              className={`${styles.tab} ${isActive("/dashboard") ? styles.tabActive : ""}`}
            >
              <span className={styles.tabIcon}><HomeIcon /></span>
              <span className={styles.tabLabel}>Inicio</span>
            </Link>

            {/* Mostrar secciones del módulo actual */}
            {currentModulo && canAccessModulo(currentModulo) && secciones.map((seccion) => (
              <Link
                key={seccion.id}
                href={seccion.href}
                className={`${styles.tab} ${isActive(seccion.href) ? styles.tabActive : ""}`}
              >
                <span className={styles.tabIcon}>{getIcono(seccion.icono)}</span>
                <span className={styles.tabLabel}>{seccion.label}</span>
              </Link>
            ))}
          </div>
          {rightContent && (
            <div className={styles.tabsRight}>{rightContent}</div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className={styles.main}>
        <div className={styles.content}>{children}</div>
      </main>
    </div>
  );
}

export default function DashboardLayout({ children, rightContent }: DashboardLayoutProps) {
  return (
    <Suspense
      fallback={
        <div className={styles.layout}>
          <div className={styles.loadingContainer}>
            <div className={styles.spinner} />
            <p>Cargando...</p>
          </div>
        </div>
      }
    >
      <DashboardLayoutInner rightContent={rightContent}>{children}</DashboardLayoutInner>
    </Suspense>
  );
}
