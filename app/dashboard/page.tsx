"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { getIcono } from "@/lib/icons";
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
                  {getIcono(modulo.icono, 32)}
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
