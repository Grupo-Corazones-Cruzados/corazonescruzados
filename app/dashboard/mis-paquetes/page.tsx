"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { useClientPackages, PackagePurchase } from "@/lib/hooks/usePackages";
import styles from "@/app/styles/Packages.module.css";

const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" x2="12" y1="5" y2="19" />
    <line x1="5" x2="19" y1="12" y2="12" />
  </svg>
);

const PackageIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16.5 9.4 7.55 4.24" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.29 7 12 12 20.71 7" />
    <line x1="12" x2="12" y1="22" y2="12" />
  </svg>
);

const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const getStatusClass = (estado: string): string => {
  switch (estado) {
    case "pendiente":
      return styles.statusPendiente;
    case "aprobado":
      return styles.statusAprobado;
    case "en_espera":
      return styles.statusEnEspera;
    case "en_progreso":
      return styles.statusEnProgreso;
    case "completado":
      return styles.statusCompletado;
    case "rechazado":
      return styles.statusRechazado;
    case "cancelado":
      return styles.statusCancelado;
    default:
      return styles.statusPendiente;
  }
};

const getStatusLabel = (estado: string): string => {
  switch (estado) {
    case "pendiente":
      return "Pendiente";
    case "aprobado":
      return "Aprobado";
    case "en_espera":
      return "En Espera";
    case "en_progreso":
      return "En Progreso";
    case "completado":
      return "Completado";
    case "rechazado":
      return "Rechazado";
    case "cancelado":
      return "Cancelado";
    case "expirado":
      return "Expirado";
    default:
      return estado;
  }
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

function PackageCard({ purchase }: { purchase: PackagePurchase }) {
  const router = useRouter();
  const progress = purchase.horas_totales > 0
    ? (Number(purchase.horas_consumidas) / Number(purchase.horas_totales)) * 100
    : 0;

  return (
    <article
      className={styles.packageCard}
      onClick={() => router.push(`/dashboard/mis-paquetes/${purchase.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          router.push(`/dashboard/mis-paquetes/${purchase.id}`);
        }
      }}
    >
      <div className={styles.packageCardHeader}>
        <span className={`${styles.packageStatus} ${getStatusClass(purchase.estado)}`}>
          {getStatusLabel(purchase.estado)}
        </span>
        <span className={styles.packageId}>#{purchase.id}</span>
      </div>

      <h3 className={styles.packageCardTitle}>{purchase.paquete.nombre}</h3>

      <div className={styles.packageCardMeta}>
        {purchase.miembro && (
          <div className={styles.packageMetaItem}>
            <UserIcon />
            <span>{purchase.miembro.nombre}</span>
          </div>
        )}
        <div className={styles.packageMetaItem}>
          <ClockIcon />
          <span>{Number(purchase.horas_restantes).toFixed(1)}h restantes</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className={styles.progressContainer}>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
        <span className={styles.progressText}>
          {Number(purchase.horas_consumidas).toFixed(1)} / {purchase.horas_totales}h
        </span>
      </div>

      <div className={styles.packageCardFooter}>
        <span className={styles.packageDate}>{formatDate(purchase.created_at)}</span>
      </div>
    </article>
  );
}

export default function MisPaquetesPage() {
  const { purchases, loading, error, stats, refetch } = useClientPackages();
  const [activeTab, setActiveTab] = useState<"activos" | "cerrados">("activos");

  const filteredPurchases = purchases.filter((p) => {
    if (activeTab === "activos") {
      return ["pendiente", "aprobado", "en_espera", "en_progreso"].includes(p.estado);
    } else {
      return ["completado", "cancelado", "rechazado", "expirado"].includes(p.estado);
    }
  });

  return (
    <DashboardLayout>
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Mis Paquetes</h1>
            <p className={styles.pageSubtitle}>
              Gestiona tus paquetes de horas contratados
            </p>
          </div>
          <Link href="/dashboard/paquetes/comprar" className={styles.primaryButton}>
            <PlusIcon />
            Comprar Paquete
          </Link>
        </div>

        {/* Stats */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconTotal}`}>
              <PackageIcon />
            </div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{stats.total}</div>
              <div className={styles.statLabel}>Total</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconPending}`}>
              <ClockIcon />
            </div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{stats.pendientes}</div>
              <div className={styles.statLabel}>Pendientes</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconActive}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v4" />
                <path d="m16.2 7.8 2.9-2.9" />
                <path d="M18 12h4" />
                <path d="m16.2 16.2 2.9 2.9" />
                <path d="M12 18v4" />
                <path d="m4.9 19.1 2.9-2.9" />
                <path d="M2 12h4" />
                <path d="m4.9 4.9 2.9 2.9" />
              </svg>
            </div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{stats.activos}</div>
              <div className={styles.statLabel}>Activos</div>
            </div>
          </div>

          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconCompleted}`}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{stats.completados}</div>
              <div className={styles.statLabel}>Completados</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabsBar}>
          <button
            className={`${styles.tab} ${activeTab === "activos" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("activos")}
          >
            Activos
          </button>
          <button
            className={`${styles.tab} ${activeTab === "cerrados" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("cerrados")}
          >
            Cerrados
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p style={{ color: "var(--text-muted)" }}>Cargando paquetes...</p>
          </div>
        ) : error ? (
          <div className={styles.emptyState}>
            <p style={{ color: "var(--primary-red)" }}>{error}</p>
            <button className={styles.secondaryButton} onClick={() => refetch()}>
              Reintentar
            </button>
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className={styles.emptyState}>
            <PackageIcon />
            <h3 className={styles.emptyTitle}>
              {activeTab === "activos" ? "No tienes paquetes activos" : "No tienes paquetes cerrados"}
            </h3>
            <p className={styles.emptyText}>
              {activeTab === "activos"
                ? "Compra un paquete de horas para comenzar a trabajar con un miembro"
                : "Los paquetes completados o cancelados aparecerán aquí"}
            </p>
            {activeTab === "activos" && (
              <Link href="/dashboard/paquetes/comprar" className={styles.primaryButton}>
                <PlusIcon />
                Comprar Paquete
              </Link>
            )}
          </div>
        ) : (
          <div className={styles.packagesGrid}>
            {filteredPurchases.map((purchase) => (
              <PackageCard key={purchase.id} purchase={purchase} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
