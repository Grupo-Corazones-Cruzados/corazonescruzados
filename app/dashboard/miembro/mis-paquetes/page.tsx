"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { useMemberPackages, PackagePurchase } from "@/lib/hooks/usePackages";
import styles from "@/app/styles/Packages.module.css";

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

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" x2="6" y1="6" y2="18" />
    <line x1="6" x2="18" y1="6" y2="18" />
  </svg>
);

const PauseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="4" height="16" x="6" y="4" />
    <rect width="4" height="16" x="14" y="4" />
  </svg>
);

const getStatusClass = (estado: string): string => {
  switch (estado) {
    case "pendiente": return styles.statusPendiente;
    case "aprobado": return styles.statusAprobado;
    case "en_espera": return styles.statusEnEspera;
    case "en_progreso": return styles.statusEnProgreso;
    case "completado": return styles.statusCompletado;
    case "rechazado": return styles.statusRechazado;
    case "cancelado": return styles.statusCancelado;
    default: return styles.statusPendiente;
  }
};

const getStatusLabel = (estado: string): string => {
  switch (estado) {
    case "pendiente": return "Pendiente";
    case "aprobado": return "Aprobado";
    case "en_espera": return "En Espera";
    case "en_progreso": return "En Progreso";
    case "completado": return "Completado";
    case "rechazado": return "Rechazado";
    case "cancelado": return "Cancelado";
    case "expirado": return "Expirado";
    default: return estado;
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

function PackageCard({
  purchase,
  onApprove,
  onReject,
  onHold,
  responding,
}: {
  purchase: PackagePurchase;
  onApprove: (id: number) => void;
  onReject: (id: number, motivo: string) => void;
  onHold: (id: number, motivo: string) => void;
  responding: boolean;
}) {
  const router = useRouter();
  const [showActions, setShowActions] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [actionType, setActionType] = useState<"reject" | "hold" | null>(null);

  const progress = purchase.horas_totales > 0
    ? (Number(purchase.horas_consumidas) / Number(purchase.horas_totales)) * 100
    : 0;

  const isPending = purchase.estado === "pendiente";

  const handleAction = () => {
    if (actionType === "reject") {
      onReject(purchase.id, motivo);
    } else if (actionType === "hold") {
      onHold(purchase.id, motivo);
    }
    setShowActions(false);
    setMotivo("");
    setActionType(null);
  };

  return (
    <article className={styles.packageCard}>
      <div
        className={styles.packageCardClickable}
        onClick={() => router.push(`/dashboard/miembro/mis-paquetes/${purchase.id}`)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            router.push(`/dashboard/miembro/mis-paquetes/${purchase.id}`);
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
          {purchase.cliente && (
            <div className={styles.packageMetaItem}>
              <UserIcon />
              <span>{purchase.cliente.nombre}</span>
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

        {purchase.notas_cliente && (
          <div className={styles.clientNotes}>
            <strong>Notas del cliente:</strong> {purchase.notas_cliente}
          </div>
        )}

        <div className={styles.packageCardFooter}>
          <span className={styles.packageDate}>{formatDate(purchase.created_at)}</span>
        </div>
      </div>

      {/* Quick actions for pending packages */}
      {isPending && !showActions && (
        <div className={styles.quickActions}>
          <button
            className={styles.approveButton}
            onClick={(e) => {
              e.stopPropagation();
              onApprove(purchase.id);
            }}
            disabled={responding}
          >
            <CheckIcon /> Aprobar
          </button>
          <button
            className={styles.rejectButton}
            onClick={(e) => {
              e.stopPropagation();
              setActionType("reject");
              setShowActions(true);
            }}
            disabled={responding}
          >
            <XIcon /> Rechazar
          </button>
          <button
            className={styles.holdButton}
            onClick={(e) => {
              e.stopPropagation();
              setActionType("hold");
              setShowActions(true);
            }}
            disabled={responding}
          >
            <PauseIcon /> En Espera
          </button>
        </div>
      )}

      {/* Motivo input */}
      {showActions && (
        <div className={styles.motivoSection} onClick={(e) => e.stopPropagation()}>
          <label className={styles.motivoLabel}>
            {actionType === "reject" ? "Motivo del rechazo:" : "Motivo de espera:"}
          </label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className={styles.motivoInput}
            placeholder={actionType === "reject" ? "Explica por que no puedes atender esta solicitud..." : "Explica por que necesitas tiempo..."}
            rows={3}
          />
          <div className={styles.motivoActions}>
            <button className={styles.cancelButton} onClick={() => { setShowActions(false); setMotivo(""); setActionType(null); }}>
              Cancelar
            </button>
            <button
              className={actionType === "reject" ? styles.rejectButton : styles.holdButton}
              onClick={handleAction}
              disabled={responding || !motivo.trim()}
            >
              {responding ? "Enviando..." : "Confirmar"}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export default function MiembroMisPaquetesPage() {
  const { purchases, loading, error, stats, refetch, respondToPackage } = useMemberPackages();
  const [activeTab, setActiveTab] = useState<"pendientes" | "activos" | "cerrados">("pendientes");
  const [responding, setResponding] = useState(false);

  const filteredPurchases = purchases.filter((p) => {
    if (activeTab === "pendientes") {
      return p.estado === "pendiente";
    } else if (activeTab === "activos") {
      return ["aprobado", "en_espera", "en_progreso"].includes(p.estado);
    } else {
      return ["completado", "cancelado", "rechazado", "expirado"].includes(p.estado);
    }
  });

  const handleApprove = async (id: number) => {
    setResponding(true);
    const result = await respondToPackage(id, "aprobado");
    if (result.error) {
      alert(result.error);
    }
    setResponding(false);
  };

  const handleReject = async (id: number, motivo: string) => {
    setResponding(true);
    const result = await respondToPackage(id, "rechazado", motivo);
    if (result.error) {
      alert(result.error);
    }
    setResponding(false);
  };

  const handleHold = async (id: number, motivo: string) => {
    setResponding(true);
    const result = await respondToPackage(id, "en_espera", motivo);
    if (result.error) {
      alert(result.error);
    }
    setResponding(false);
  };

  return (
    <DashboardLayout>
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Mis Paquetes</h1>
            <p className={styles.pageSubtitle}>
              Gestiona los paquetes que los clientes han contratado contigo
            </p>
          </div>
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
            className={`${styles.tab} ${activeTab === "pendientes" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("pendientes")}
          >
            Pendientes
            {stats.pendientes > 0 && <span className={styles.tabBadge}>{stats.pendientes}</span>}
          </button>
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
              {activeTab === "pendientes"
                ? "No tienes solicitudes pendientes"
                : activeTab === "activos"
                ? "No tienes paquetes activos"
                : "No tienes paquetes cerrados"}
            </h3>
            <p className={styles.emptyText}>
              {activeTab === "pendientes"
                ? "Las nuevas solicitudes de clientes aparecerán aquí"
                : activeTab === "activos"
                ? "Los paquetes aprobados y en progreso aparecerán aquí"
                : "Los paquetes completados o cancelados aparecerán aquí"}
            </p>
          </div>
        ) : (
          <div className={styles.packagesGrid}>
            {filteredPurchases.map((purchase) => (
              <PackageCard
                key={purchase.id}
                purchase={purchase}
                onApprove={handleApprove}
                onReject={handleReject}
                onHold={handleHold}
                responding={responding}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
