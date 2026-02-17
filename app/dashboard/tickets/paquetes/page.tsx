"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { useClientSolicitudes, PaqueteSolicitud } from "@/lib/hooks/usePaqueteSolicitudes";
import styles from "@/app/styles/PaqueteSolicitudes.module.css";

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

const getStatusClass = (estado: string): string => {
  const map: Record<string, string> = {
    borrador: styles.statusBorrador,
    pendiente: styles.statusPendiente,
    parcial: styles.statusParcial,
    en_progreso: styles.statusEnProgreso,
    completado: styles.statusCompletado,
    cancelado: styles.statusCancelado,
  };
  return map[estado] || styles.statusPendiente;
};

const getStatusLabel = (estado: string): string => {
  const map: Record<string, string> = {
    borrador: "Borrador",
    pendiente: "Pendiente",
    parcial: "Parcial",
    en_progreso: "En Progreso",
    completado: "Completado",
    cancelado: "Cancelado",
  };
  return map[estado] || estado;
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
};

function SolicitudCard({ solicitud }: { solicitud: PaqueteSolicitud }) {
  const router = useRouter();
  const asignaciones = solicitud.asignaciones || [];
  const totalConsumidas = asignaciones.reduce((sum, a: any) => sum + Number(a.horas_consumidas || 0), 0);
  const progress = Number(solicitud.horas_totales) > 0
    ? (totalConsumidas / Number(solicitud.horas_totales)) * 100
    : 0;
  const costoBase = Number(solicitud.horas_totales) * Number(solicitud.costo_hora);
  const costoFinal = costoBase * (1 - Number(solicitud.descuento) / 100);

  return (
    <article
      className={styles.solicitudCard}
      onClick={() => router.push(`/dashboard/tickets/paquetes/${solicitud.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          router.push(`/dashboard/tickets/paquetes/${solicitud.id}`);
        }
      }}
    >
      <div className={styles.solicitudCardHeader}>
        <span className={`${styles.statusBadge} ${getStatusClass(solicitud.estado)}`}>
          {getStatusLabel(solicitud.estado)}
        </span>
        <span className={styles.solicitudId}>#{solicitud.id}</span>
      </div>

      <h3 className={styles.solicitudCardTitle}>
        {Number(solicitud.horas_totales)}h - {solicitud.tier_nombre || "Paquete"}
      </h3>

      <div className={styles.solicitudCardMeta}>
        <div className={styles.solicitudMetaItem}>
          <ClockIcon />
          <span>{Number(solicitud.horas_totales) - totalConsumidas}h restantes</span>
        </div>
        {Number(solicitud.descuento) > 0 && (
          <span className={styles.discountBadge}>-{solicitud.descuento}%</span>
        )}
        <span className={styles.costInfo}>{formatCurrency(costoFinal)}</span>
      </div>

      {/* Member avatars */}
      {asignaciones.length > 0 && (
        <div className={styles.memberAvatars}>
          {asignaciones.slice(0, 4).map((a: any) => (
            a.miembro?.foto ? (
              <img key={a.id} src={a.miembro.foto} alt={a.miembro.nombre} className={styles.memberAvatarSmall} />
            ) : (
              <div key={a.id} className={styles.memberAvatarPlaceholderSmall}>
                {a.miembro?.nombre?.charAt(0)?.toUpperCase() || "?"}
              </div>
            )
          ))}
          {asignaciones.length > 4 && (
            <div className={styles.memberAvatarPlaceholderSmall}>+{asignaciones.length - 4}</div>
          )}
        </div>
      )}

      {/* Progress bar */}
      <div className={styles.progressContainer}>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
        <span className={styles.progressText}>
          {totalConsumidas.toFixed(1)} / {Number(solicitud.horas_totales)}h
        </span>
      </div>

      <div className={styles.solicitudCardFooter}>
        <span className={styles.solicitudDate}>{formatDate(solicitud.created_at)}</span>
      </div>
    </article>
  );
}

export default function PaqueteSolicitudesPage() {
  const { solicitudes, loading, error, stats, refetch } = useClientSolicitudes();
  const [activeTab, setActiveTab] = useState<"activos" | "cerrados">("activos");

  const filteredSolicitudes = solicitudes.filter((s) => {
    if (activeTab === "activos") {
      return ["borrador", "pendiente", "parcial", "en_progreso"].includes(s.estado);
    } else {
      return ["completado", "cancelado"].includes(s.estado);
    }
  });

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Paquetes</h1>
            <p className={styles.pageSubtitle}>Gestiona tus paquetes de horas multi-miembro</p>
          </div>
          <Link href="/dashboard/tickets/paquetes/nuevo" className={styles.primaryButton}>
            <PlusIcon />
            Nuevo Paquete
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
                <path d="M12 2v4" /><path d="m16.2 7.8 2.9-2.9" /><path d="M18 12h4" />
                <path d="m16.2 16.2 2.9 2.9" /><path d="M12 18v4" /><path d="m4.9 19.1 2.9-2.9" />
                <path d="M2 12h4" /><path d="m4.9 4.9 2.9 2.9" />
              </svg>
            </div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{stats.en_progreso}</div>
              <div className={styles.statLabel}>En Progreso</div>
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
            <button className={styles.secondaryButton} onClick={() => refetch()}>Reintentar</button>
          </div>
        ) : filteredSolicitudes.length === 0 ? (
          <div className={styles.emptyState}>
            <PackageIcon />
            <h3 className={styles.emptyTitle}>
              {activeTab === "activos" ? "No tienes paquetes activos" : "No tienes paquetes cerrados"}
            </h3>
            <p className={styles.emptyText}>
              {activeTab === "activos"
                ? "Crea un paquete de horas para comenzar a trabajar con multiples miembros"
                : "Los paquetes completados o cancelados apareceran aqui"}
            </p>
            {activeTab === "activos" && (
              <Link href="/dashboard/tickets/paquetes/nuevo" className={styles.primaryButton}>
                <PlusIcon /> Nuevo Paquete
              </Link>
            )}
          </div>
        ) : (
          <div className={styles.solicitudesGrid}>
            {filteredSolicitudes.map((s) => (
              <SolicitudCard key={s.id} solicitud={s} />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
