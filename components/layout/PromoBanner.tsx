"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "./PromoBanner.module.css";

export default function PromoBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  if (user || dismissed) return null;

  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        <span className={styles.badge}>5% OFF</span>
        <p className={styles.text}>
          Crea tu cuenta y obtén un <strong>5% de descuento</strong> en todos nuestros servicios y proyectos.
        </p>
        <Link href="/auth?tab=register" className={styles.cta}>
          Crear cuenta
        </Link>
      </div>
      <button
        className={styles.close}
        onClick={() => setDismissed(true)}
        aria-label="Cerrar"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
          <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
