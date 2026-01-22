"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import styles from "app/styles/Encabezado.module.css";

export default function Encabezado() {
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  // En inicio: abierto por defecto. En otras páginas: cerrado por defecto
  const [isOpen, setIsOpen] = useState(isHomePage);

  // Actualizar estado cuando cambia la ruta
  useEffect(() => {
    setIsOpen(pathname === "/");
  }, [pathname]);

  const toggleOpen = () => setIsOpen((prev) => !prev);

  return (
    <section className={`${styles.hero} ${isOpen ? styles.heroOpen : styles.heroClosed}`}>
      {/* Fondo con efectos (solo visible cuando está abierto) */}
      <div className={`${styles.bgLayer} ${isOpen ? styles.bgVisible : ""}`} aria-hidden="true">
        <div className={styles.gridPattern} />
        <div className={styles.glowOrb1} />
        <div className={styles.glowOrb2} />
      </div>

      {/* Contenido principal */}
      <div className={`${styles.content} ${isOpen ? styles.contentVisible : styles.contentHidden}`}>
        {/* Badge / Kicker */}
        <div className={styles.badge}>
          <span className={styles.badgeDot} />
          <span>@grupocc.org</span>
        </div>

        {/* Título principal */}
        <h1 className={styles.headline}>
          Un corazón puede
          <br />
          <span className={styles.headlineAccent}>cruzar el mundo</span>
        </h1>

        {/* Subtítulo */}
        <p className={styles.tagline}>
          Proyecto de desarrollo humano
        </p>
      </div>

      {/* Botón del corazón (siempre visible) */}
      <button
        type="button"
        className={`${styles.heartButton} ${isOpen ? styles.heartButtonOpen : ""}`}
        onClick={toggleOpen}
        aria-expanded={isOpen}
        aria-label={isOpen ? "Ocultar encabezado" : "Mostrar encabezado"}
      >
        <div className={styles.heartWrapper}>
          <img
            className={styles.heartIcon}
            src="/animacion-corazon.gif"
            alt=""
            aria-hidden="true"
          />
        </div>
        <span className={styles.heartHint}>
          {isOpen ? "Ocultar" : "Mostrar"}
        </span>
      </button>

      {/* Línea decorativa inferior */}
      <div className={`${styles.bottomLine} ${isOpen ? styles.bottomLineVisible : ""}`} aria-hidden="true" />
    </section>
  );
}
