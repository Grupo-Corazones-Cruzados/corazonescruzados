"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import styles from "./Dashboard.module.css";

interface Modulo {
  id: number;
  nombre: string;
  descripcion: string;
  icono: string;
  ruta: string;
  orden: number;
  requiere_verificacion: boolean;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, profile, isAuthenticated, loading: authLoading } = useAuth();

  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [loading, setLoading] = useState(true);

  // Verificar si el email está confirmado
  const emailVerificado = user?.verificado === true;

  // Redirigir si no está autenticado
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth");
    }
  }, [authLoading, isAuthenticated, router]);

  // Cargar módulos
  useEffect(() => {
    const fetchModulos = async () => {
      try {
        const response = await fetch("/api/modulos");
        const data = await response.json();
        if (response.ok) {
          setModulos(data.modulos || []);
        } else {
          console.error("Error al cargar módulos:", data.error);
        }
      } catch (error) {
        console.error("Error al cargar módulos:", error);
      }
      setLoading(false);
    };

    if (isAuthenticated) {
      fetchModulos();
    }
  }, [isAuthenticated]);

  const handleModuloClick = (modulo: Modulo) => {
    if (modulo.requiere_verificacion && !emailVerificado) {
      return; // No hacer nada si requiere verificación y no está verificado
    }
    router.push(modulo.ruta);
  };

  const getIcono = (icono: string) => {
    switch (icono) {
      case "tickets":
        return (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5C15 6.10457 14.1046 7 13 7H11C9.89543 7 9 6.10457 9 5Z" stroke="currentColor" strokeWidth="2"/>
            <path d="M9 12H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M9 16H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        );
      case "proyecto":
        return (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M9 22V12H15V22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case "mercado":
        return (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M6 2L3 6V20C3 20.5304 3.21071 21.0391 3.58579 21.4142C3.96086 21.7893 4.46957 22 5 22H19C19.5304 22 20.0391 21.7893 20.4142 21.4142C20.7893 21.0391 21 20.5304 21 20V6L18 2H6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M16 10C16 11.0609 15.5786 12.0783 14.8284 12.8284C14.0783 13.5786 13.0609 14 12 14C10.9391 14 9.92172 13.5786 9.17157 12.8284C8.42143 12.0783 8 11.0609 8 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case "admin":
        return (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      default:
        return (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
            <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
            <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
            <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
          </svg>
        );
    }
  };

  const resendVerificationEmail = async () => {
    if (!user?.email) return;

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });

      if (!response.ok) {
        alert("Error al reenviar el correo. Intenta más tarde.");
      } else {
        alert("Correo de verificación enviado. Revisa tu bandeja de entrada.");
      }
    } catch {
      alert("Error al reenviar el correo. Intenta más tarde.");
    }
  };

  if (authLoading || loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className={styles.page}>
      <div className={styles.bgGlow} aria-hidden="true" />

      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <a href="/" className={styles.backLink}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Inicio
            </a>
          </div>

          <div className={styles.headerCenter}>
            <img src="/LogoCC.png" alt="Logo" className={styles.logo} />
            <h1 className={styles.title}>GCC</h1>
          </div>

          <div className={styles.headerRight}>
            <div className={styles.userInfo}>
              <span className={styles.userName}>
                {profile?.nombre || user?.email?.split("@")[0]}
              </span>
              <span className={`${styles.statusBadge} ${emailVerificado ? styles.verified : styles.unverified}`}>
                {emailVerificado ? "Verificado" : "No verificado"}
              </span>
            </div>
          </div>
        </header>

        {/* Alerta de verificación */}
        {!emailVerificado && (
          <div className={styles.verificationAlert}>
            <div className={styles.alertIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 9V13M12 17H12.01M12 3L2 20H22L12 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className={styles.alertContent}>
              <h3>Verifica tu correo electrónico</h3>
              <p>
                Enviamos un correo de verificación a <strong>{user?.email}</strong>.
                Debes confirmar tu cuenta para acceder a todos los módulos.
              </p>
            </div>
            <button className={styles.resendBtn} onClick={resendVerificationEmail}>
              Reenviar correo
            </button>
          </div>
        )}

        {/* Welcome */}
        <section className={styles.welcome}>
          <h2 className={styles.welcomeTitle}>
            Bienvenido{profile?.nombre ? `, ${profile.nombre}` : ""}
          </h2>
          <p className={styles.welcomeSubtitle}>
            Selecciona un módulo para comenzar
          </p>
        </section>

        {/* Módulos */}
        <section className={styles.modulosGrid}>
          {modulos
            .filter((modulo) => !["/dashboard/invoices", "/dashboard/settings", "/dashboard/admin", "/dashboard/miembro"].includes(modulo.ruta))
            .map((modulo) => {
            const bloqueado = modulo.requiere_verificacion && !emailVerificado;

            return (
              <button
                key={modulo.id}
                className={`${styles.moduloCard} ${bloqueado ? styles.moduloBloqueado : ""}`}
                onClick={() => handleModuloClick(modulo)}
                disabled={bloqueado}
                aria-disabled={bloqueado}
              >
                {bloqueado && (
                  <div className={styles.lockOverlay}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2"/>
                      <path d="M7 11V7C7 4.23858 9.23858 2 12 2C14.7614 2 17 4.23858 17 7V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <span>Verifica tu email</span>
                  </div>
                )}

                <div className={styles.moduloIcon}>
                  {getIcono(modulo.icono)}
                </div>

                <div className={styles.moduloContent}>
                  <h3 className={styles.moduloNombre}>{modulo.nombre}</h3>
                  <p className={styles.moduloDescripcion}>{modulo.descripcion}</p>
                </div>

                <div className={styles.moduloArrow}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </button>
            );
          })}
        </section>

        {/* Footer */}
        <footer className={styles.footer}>
          <p>Corazones Cruzados &copy; {new Date().getFullYear()}</p>
        </footer>
      </div>
    </div>
  );
}
