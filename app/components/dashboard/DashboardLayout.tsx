"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { getIcono } from "@/lib/icons";
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
