"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { useMemberAsignaciones, PaqueteAsignacion } from "@/lib/hooks/usePaqueteSolicitudes";
import styles from "@/app/styles/PaqueteSolicitudes.module.css";

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
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" x2="6" y1="6" y2="18" /><line x1="6" x2="18" y1="6" y2="18" />
  </svg>
);

const UserIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
);

const getStatusClass = (estado: string): string => {
  const map: Record<string, string> = {
    pendiente: styles.statusPendiente,
    aprobado: styles.statusAprobado,
    en_progreso: styles.statusEnProgreso,
    pre_confirmado: styles.statusPreConfirmado,
    completado: styles.statusCompletado,
    rechazado: styles.statusRechazado,
  };
  return map[estado] || styles.statusPendiente;
};

const getStatusLabel = (estado: string): string => {
  const map: Record<string, string> = {
    pendiente: "Pendiente",
    aprobado: "Aprobado",
    en_progreso: "En Progreso",
    pre_confirmado: "Pre-Confirmado",
    completado: "Completado",
    rechazado: "Rechazado",
  };
  return map[estado] || estado;
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString("es-ES", {
    day: "numeric", month: "short", year: "numeric",
  });
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
};

function AsignacionCard({
  asignacion,
  onApprove,
  onReject,
  responding,
}: {
  asignacion: PaqueteAsignacion;
  onApprove: (id: number) => void;
  onReject: (id: number, motivo: string) => void;
  responding: boolean;
}) {
  const router = useRouter();
  const [showReject, setShowReject] = useState(false);
  const [motivo, setMotivo] = useState("");

  const progress = Number(asignacion.horas_asignadas) > 0
    ? (Number(asignacion.horas_consumidas) / Number(asignacion.horas_asignadas)) * 100
    : 0;
  const beneficio = Number(asignacion.horas_asignadas) * 10;
  const isPending = asignacion.estado === "pendiente";

  return (
    <article className={styles.solicitudCard}>
      <div
        style={{ cursor: "pointer" }}
        onClick={() => router.push(`/dashboard/miembro/paquetes/${asignacion.id}`)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            router.push(`/dashboard/miembro/paquetes/${asignacion.id}`);
          }
        }}
      >
        <div className={styles.solicitudCardHeader}>
          <span className={`${styles.statusBadge} ${getStatusClass(asignacion.estado)}`}>
            {getStatusLabel(asignacion.estado)}
          </span>
          <span className={styles.solicitudId}>#{asignacion.id}</span>
        </div>

        <div className={styles.solicitudCardMeta}>
          {asignacion.cliente && (
            <div className={styles.solicitudMetaItem}>
              <UserIcon />
              <span>{asignacion.cliente.nombre}</span>
            </div>
          )}
          <div className={styles.solicitudMetaItem}>
            <ClockIcon />
            <span>{Number(asignacion.horas_asignadas)}h asignadas</span>
          </div>
          <span className={styles.benefitBadge}>{formatCurrency(beneficio)}</span>
        </div>

        {asignacion.descripcion_tarea && (
          <p className={styles.allocationTask} style={{ margin: "var(--space-2) 0" }}>
            {asignacion.descripcion_tarea.length > 100
              ? asignacion.descripcion_tarea.substring(0, 100) + "..."
              : asignacion.descripcion_tarea}
          </p>
        )}

        <div className={styles.progressContainer}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
          <span className={styles.progressText}>
            {Number(asignacion.horas_consumidas).toFixed(1)} / {Number(asignacion.horas_asignadas)}h
          </span>
        </div>

        <div className={styles.solicitudCardFooter}>
          <span className={styles.solicitudDate}>{formatDate(asignacion.created_at)}</span>
        </div>
      </div>

      {/* Quick actions for pending */}
      {isPending && !showReject && (
        <div className={styles.quickActions}>
          <button
            className={styles.approveButton}
            onClick={(e) => { e.stopPropagation(); onApprove(asignacion.id); }}
            disabled={responding}
          >
            <CheckIcon /> Aprobar
          </button>
          <button
            className={styles.rejectButton}
            onClick={(e) => { e.stopPropagation(); setShowReject(true); }}
            disabled={responding}
          >
            <XIcon /> Rechazar
          </button>
        </div>
      )}

      {showReject && (
        <div className={styles.motivoSection} onClick={(e) => e.stopPropagation()}>
          <label className={styles.motivoLabel}>Motivo del rechazo:</label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className={styles.motivoInput}
            placeholder="Explica por que no puedes atender esta solicitud..."
            rows={3}
          />
          <div className={styles.motivoActions}>
            <button className={styles.cancelButton} onClick={() => { setShowReject(false); setMotivo(""); }}>
              Cancelar
            </button>
            <button
              className={styles.rejectButton}
              onClick={() => {
                onReject(asignacion.id, motivo);
                setShowReject(false);
                setMotivo("");
              }}
              disabled={responding || !motivo.trim()}
            >
              {responding ? "Enviando..." : "Confirmar Rechazo"}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export default function MiembroPaquetesPage() {
  const { asignaciones, loading, error, stats, refetch, respondToAsignacion } = useMemberAsignaciones();
  const [activeTab, setActiveTab] = useState<"pendientes" | "activos" | "cerrados">("pendientes");
  const [responding, setResponding] = useState(false);

  const filteredAsignaciones = asignaciones.filter((a) => {
    if (activeTab === "pendientes") return a.estado === "pendiente";
    if (activeTab === "activos") return ["aprobado", "en_progreso", "pre_confirmado"].includes(a.estado);
    return ["completado", "rechazado"].includes(a.estado);
  });

  const handleApprove = async (id: number) => {
    setResponding(true);
    const result = await respondToAsignacion(id, "aprobado");
    if (result.error) alert(result.error);
    setResponding(false);
  };

  const handleReject = async (id: number, motivo: string) => {
    setResponding(true);
    const result = await respondToAsignacion(id, "rechazado", motivo);
    if (result.error) alert(result.error);
    setResponding(false);
  };

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Paquetes</h1>
            <p className={styles.pageSubtitle}>Gestiona las asignaciones de paquetes de clientes</p>
          </div>
        </div>

        {/* Stats */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconTotal}`}><PackageIcon /></div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{stats.total}</div>
              <div className={styles.statLabel}>Total</div>
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={`${styles.statIcon} ${styles.statIconPending}`}><ClockIcon /></div>
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
            <p style={{ color: "var(--text-muted)" }}>Cargando asignaciones...</p>
          </div>
        ) : error ? (
          <div className={styles.emptyState}>
            <p style={{ color: "var(--primary-red)" }}>{error}</p>
            <button className={styles.secondaryButton} onClick={() => refetch()}>Reintentar</button>
          </div>
        ) : filteredAsignaciones.length === 0 ? (
          <div className={styles.emptyState}>
            <PackageIcon />
            <h3 className={styles.emptyTitle}>
              {activeTab === "pendientes"
                ? "No tienes solicitudes pendientes"
                : activeTab === "activos"
                ? "No tienes asignaciones activas"
                : "No tienes asignaciones cerradas"}
            </h3>
            <p className={styles.emptyText}>
              {activeTab === "pendientes"
                ? "Las nuevas solicitudes de clientes apareceran aqui"
                : activeTab === "activos"
                ? "Las asignaciones aprobadas y en progreso apareceran aqui"
                : "Las asignaciones completadas o rechazadas apareceran aqui"}
            </p>
          </div>
        ) : (
          <div className={styles.solicitudesGrid}>
            {filteredAsignaciones.map((a) => (
              <AsignacionCard
                key={a.id}
                asignacion={a}
                onApprove={handleApprove}
                onReject={handleReject}
                responding={responding}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
