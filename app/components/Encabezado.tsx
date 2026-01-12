"use client";

import React from "react";
import styles from "app/styles/Encabezado.module.css";

export default function Encabezado() {
  console.log("Encabezado cargado:", styles);
  return (
    <header className={styles.header}>
      <div className={styles.bgGlow} aria-hidden="true" />

      <div className={styles.inner}>
        <div className={styles.left}>
          <div className={styles.kicker}>@grupocc.org</div>

          <h1 className={styles.title}>Un corazón puede cruzar el mundo</h1>

          <p className={styles.subtitle}>Proyecto de desarrollo humano</p>
        </div>

        <div className={styles.right}>
          <div className={styles.logoCard}>
            <img className={styles.logo} src="/animacion-corazon.gif" alt="Corazón" />
          </div>
        </div>
      </div>
      
    </header>
    
  );
}