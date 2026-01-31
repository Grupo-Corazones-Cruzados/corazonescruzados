"use client";

import React, { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { useTheme } from "@/lib/ThemeProvider";
import styles from "../styles/Header.module.css";

// Iconos de tema
const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { user, profile, signOut, isAuthenticated, loading } = useAuth();
  const { theme, toggleTheme, mounted } = useTheme();
  const userMenuRef = useRef<HTMLDivElement>(null);

  const menuItems = [
    { label: "Inicio", icon: "/IcInicio.png", href: "/" },
    { label: "Paquetes", icon: "/IcPaquetes.png", href: "/paquetes" },
    { label: "Nosotros", icon: "/IcNosotros.png", href: "/nosotros" },
    { label: "Ayuda", icon: "/IcAyuda.png", href: "/ayuda" },
  ];

  const closeMenu = () => setMenuOpen(false);

  const handleClick = (href: string) => {
    router.push(href);
    closeMenu();
  };

  // ESC + bloquear scroll cuando el menú está abierto
  useEffect(() => {
    if (!menuOpen) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenu();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  // Cerrar menú de usuario al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };

    if (userMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userMenuOpen]);

  const handleSignOut = async () => {
    await signOut();
    setUserMenuOpen(false);
    router.push("/");
  };

  const getInitials = () => {
    if (profile?.nombre && profile?.apellido) {
      return `${profile.nombre[0]}${profile.apellido[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  return (
    <>
      {/* Overlay (click para cerrar) */}
      <div
        className={`${styles.Overlay} ${menuOpen ? styles["Overlay-Abierto"] : ""}`}
        onClick={closeMenu}
        role="presentation"
      />

      {/* Topbar */}
      <header className={styles.BarraSuperior} aria-label="Header">
        <button
          type="button"
          className={styles.LogoButton}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menuOpen}
          aria-controls="cc-drawer"
        >
          <img
            src="/LogoCC.png"
            alt="Logo Corazones Cruzados"
            className={`${styles.Logo} ${menuOpen ? styles["Logo-Activo"] : ""}`}
          />
        </button>

        <h2 className={styles["BarraSuperior-Titulo"]}>Corazones Cruzados</h2>

        <div className={styles.Spacer} />

        {/* Theme Toggle */}
        {mounted && (
          <button
            className={styles.ThemeToggle}
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
            title={theme === "dark" ? "Tema claro" : "Tema oscuro"}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
        )}

        {/* Admin Button - Solo visible para admins */}
        {isAuthenticated && profile?.rol === "admin" && (
          <button
            className={styles.AdminButton}
            onClick={() => router.push("/dashboard/admin")}
            aria-label="Panel de administración"
            title="Administración"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </button>
        )}

        {/* Auth Button / User Menu */}
        {loading ? (
          <div className={styles.AuthLoading}>
            <div className={styles.AuthSpinner} />
          </div>
        ) : isAuthenticated ? (
          <div className={styles.UserMenu} ref={userMenuRef}>
            <button
              className={styles.UserButton}
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              aria-expanded={userMenuOpen}
              aria-haspopup="true"
            >
              <div className={styles.UserAvatar}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" />
                ) : (
                  <span>{getInitials()}</span>
                )}
              </div>
              <span className={styles.UserName}>
                {profile?.nombre || user?.email?.split("@")[0]}
              </span>
              <svg
                className={`${styles.UserChevron} ${userMenuOpen ? styles.UserChevronOpen : ""}`}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
              >
                <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {userMenuOpen && (
              <div className={styles.UserDropdown}>
                <div className={styles.UserDropdownHeader}>
                  <p className={styles.UserDropdownName}>
                    {profile?.nombre} {profile?.apellido}
                  </p>
                  <p className={styles.UserDropdownEmail}>{user?.email}</p>
                </div>
                <div className={styles.UserDropdownDivider} />
                <button
                  className={styles.UserDropdownItem}
                  onClick={() => {
                    router.push("/perfil");
                    setUserMenuOpen(false);
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  Mi perfil
                </button>
                <button
                  className={styles.UserDropdownItem}
                  onClick={() => {
                    router.push("/dashboard");
                    setUserMenuOpen(false);
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                    <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                    <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                    <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2"/>
                  </svg>
                  Panel de gestión
                </button>
                {(profile?.rol === "miembro" || profile?.rol === "admin") && (
                  <>
                    <button
                      className={styles.UserDropdownItem}
                      onClick={() => {
                        router.push("/dashboard/miembro");
                        setUserMenuOpen(false);
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Mi Espacio
                    </button>
                    <button
                      className={styles.UserDropdownItem}
                      onClick={() => {
                        router.push("/dashboard/settings/availability");
                        setUserMenuOpen(false);
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
                        <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/>
                      </svg>
                      Disponibilidad
                    </button>
                  </>
                )}
                <div className={styles.UserDropdownDivider} />
                <button
                  className={`${styles.UserDropdownItem} ${styles.UserDropdownItemDanger}`}
                  onClick={handleSignOut}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            className={styles.BotonLogin}
            onClick={() => router.push("/auth")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M15 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 17L15 12L10 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M15 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Ingresar
          </button>
        )}
      </header>

      {/* Drawer / Sidebar */}
      <aside
        id="cc-drawer"
        className={`${styles.Menu} ${menuOpen ? styles["Menu-Abierto"] : ""}`}
        aria-label="Menú de navegación"
      >
        <div className={styles.MenuHeader}>
          <div className={styles.MenuTitulo}>GCC</div>
          <button type="button" className={styles.MenuClose} onClick={closeMenu} aria-label="Cerrar menú">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <ul className={styles["Menu-Lista"]}>
          {menuItems.map((opcion) => {
            const active = opcion.href === pathname;
            return (
              <li
                key={opcion.label}
                className={`${styles["Menu-Elemento"]} ${active ? styles["Menu-Elemento-Activo"] : ""}`}
              >
                <button
                  type="button"
                  className={styles["Menu-Elemento-Boton"]}
                  onClick={() => handleClick(opcion.href)}
                  aria-current={active ? "page" : undefined}
                >
                  <span className={styles["Menu-Elemento-Contenido"]}>
                    <img
                      src={opcion.icon}
                      alt=""
                      className={active ? styles.MenuElementoIconoSeleccionado : styles["Menu-Elemento-Icono"]}
                    />
                    {opcion.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>
    </>
  );
};

export default Header;