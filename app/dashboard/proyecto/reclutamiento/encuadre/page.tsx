"use client";

import React from "react";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import styles from "@/app/styles/Tickets.module.css";

export default function EncuadrePage() {
  return (
    <DashboardLayout>
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Encuadre del Sujeto</h1>
            <p className={styles.pageSubtitle}>
              Define el perfil, requisitos y criterios de evaluación para los candidatos
            </p>
          </div>
        </div>

        {/* Placeholder */}
        <div className={styles.emptyState}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
          </svg>
          <h3 className={styles.emptyTitle}>Módulo en construcción</h3>
          <p className={styles.emptyText}>
            Este módulo estará disponible próximamente.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
