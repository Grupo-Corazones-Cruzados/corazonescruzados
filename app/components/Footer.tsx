"use client";

import React from "react";
import styles from "app/styles/Footer.module.css";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer} aria-label="Footer">
      
      <div className={styles.inner}>
        <div className={styles.left}>
          <div className={styles.brand}>
            <span className={styles.dot} aria-hidden="true" />
            Corazones Cruzados
          </div>
          <p className={styles.tagline}>Proyecto de Desarrollo Humano</p>
        </div>

        <nav className={styles.nav} aria-label="Enlaces">
      
        </nav>

        <div className={styles.right}>
          <span className={styles.copy}>© {year} Corazones Cruzados</span>
          <span className={styles.sep} aria-hidden="true">·</span>
          <span className={styles.muted}>Todos los derechos reservados</span>
        </div>
      </div>
    </footer>
  );
}