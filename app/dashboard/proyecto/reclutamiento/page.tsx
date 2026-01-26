"use client";

import React from "react";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import styles from "@/app/styles/Tickets.module.css";

export default function ReclutamientoPage() {
  return (
    <DashboardLayout>
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Reclutamiento y Selección</h1>
            <p className={styles.pageSubtitle}>
              Gestiona el proceso de reclutamiento y selección de nuevos miembros
            </p>
          </div>
        </div>

        {/* Placeholder */}
        <div className={styles.emptyState}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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
