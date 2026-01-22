"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import styles from "../styles/Header.module.css";

const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

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

        <button
          className={styles.BotonLogin}
          onClick={() =>
            window.open(
              "https://apps.powerapps.com/play/e/ecc5f0d6-fde7-ef24-ade9-27ef544fe20d/a/0b621e15-f30c-4e9a-9488-6670107b484e?tenantId=9ce49709-ae4e-4000-be0f-c9f7d1aa98e9&hint=d0412594-0a6a-4ba2-a31e-bed394a822bf&sourcetime=1762026792024&hideNavBar=true#",
              "_blank"
            )
          }
        >
          Iniciar Sesión
        </button>
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