"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Badge, Card, Spinner } from "@/components/ui";
import { PROJECT_STATUS_LABELS } from "@/lib/constants";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { ProjectStatus } from "@/lib/types";
import styles from "./page.module.css";

interface PublicProject {
  id: number;
  title: string;
  description: string | null;
  status: string;
  budget_min: number | null;
  budget_max: number | null;
  deadline: string | null;
  client_name: string | null;
  member_name: string | null;
  created_at: string;
  requirements: {
    id: number;
    title: string;
    description: string | null;
    cost: number | null;
    completed_at: string | null;
  }[];
  bids: {
    id: number;
    member_name: string;
    bid_amount: number;
    estimated_days: number | null;
    status: string;
    created_at: string;
  }[];
}

const BADGE_VARIANT: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  draft: "default",
  open: "info",
  in_progress: "warning",
  review: "warning",
  completed: "success",
  cancelled: "error",
  on_hold: "default",
};

export default function PublicProjectPage() {
  const params = useParams();
  const token = params.token as string;
  const [project, setProject] = useState<PublicProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/projects/public/${token}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        setProject(json.data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  if (loading) {
    return (
      <div className={styles.center}>
        <Spinner />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className={styles.center}>
        <h2 className={styles.errorTitle}>Proyecto no encontrado</h2>
        <p className={styles.errorDesc}>
          El enlace es inválido o el proyecto ya no está disponible.
        </p>
      </div>
    );
  }

  const completedReqs = project.requirements.filter((r) => r.completed_at).length;
  const totalReqCost = project.requirements.reduce((s, r) => s + (r.cost || 0), 0);

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <Badge variant={BADGE_VARIANT[project.status] || "default"}>
          {PROJECT_STATUS_LABELS[project.status as ProjectStatus] || project.status}
        </Badge>
        <h1 className={styles.title}>{project.title}</h1>
        {project.description && (
          <p className={styles.description}>{project.description}</p>
        )}
      </div>

      <div className={styles.grid}>
        <div className={styles.main}>
          {/* Requirements */}
          <Card padding="lg">
            <h2 className={styles.sectionTitle}>
              Requerimientos ({completedReqs}/{project.requirements.length})
            </h2>
            {project.requirements.length === 0 ? (
              <p className={styles.empty}>Sin requerimientos definidos</p>
            ) : (
              <div className={styles.reqList}>
                {project.requirements.map((req) => (
                  <div
                    key={req.id}
                    className={`${styles.reqItem} ${req.completed_at ? styles.reqDone : ""}`}
                  >
                    <div className={styles.reqCheck}>
                      <span
                        className={`${styles.checkIcon} ${req.completed_at ? styles.checked : ""}`}
                      >
                        {req.completed_at ? "✓" : "○"}
                      </span>
                      <div>
                        <span className={styles.reqTitle}>{req.title}</span>
                        {req.description && (
                          <p className={styles.reqDesc}>{req.description}</p>
                        )}
                      </div>
                    </div>
                    {req.cost != null && (
                      <span className={styles.reqCost}>{formatCurrency(req.cost)}</span>
                    )}
                  </div>
                ))}
                {totalReqCost > 0 && (
                  <div className={styles.totalRow}>
                    Total estimado: <strong>{formatCurrency(totalReqCost)}</strong>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Bids (visible on public view) */}
          {project.bids.length > 0 && (
            <Card padding="lg">
              <h2 className={styles.sectionTitle}>Propuestas ({project.bids.length})</h2>
              <div className={styles.bidList}>
                {project.bids.map((bid) => (
                  <div key={bid.id} className={styles.bidItem}>
                    <div className={styles.bidHeader}>
                      <strong>{bid.member_name}</strong>
                      <Badge
                        variant={
                          bid.status === "accepted"
                            ? "success"
                            : bid.status === "rejected"
                            ? "error"
                            : "warning"
                        }
                      >
                        {bid.status === "accepted"
                          ? "Aceptada"
                          : bid.status === "rejected"
                          ? "Rechazada"
                          : "Pendiente"}
                      </Badge>
                    </div>
                    <div className={styles.bidMeta}>
                      <span>{formatCurrency(bid.bid_amount)}</span>
                      {bid.estimated_days && <span>{bid.estimated_days} días</span>}
                      <span>{formatDate(bid.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className={styles.sidebar}>
          <Card padding="lg">
            <h3 className={styles.sideTitle}>Información</h3>
            <div className={styles.detailList}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Cliente</span>
                <span className={styles.detailValue}>{project.client_name || "—"}</span>
              </div>
              {project.member_name && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Asignado</span>
                  <span className={styles.detailValue}>{project.member_name}</span>
                </div>
              )}
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Presupuesto</span>
                <span className={styles.detailValue}>
                  {project.budget_min && project.budget_max
                    ? `${formatCurrency(project.budget_min)} — ${formatCurrency(project.budget_max)}`
                    : project.budget_max
                    ? formatCurrency(project.budget_max)
                    : "—"}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Fecha límite</span>
                <span className={styles.detailValue}>
                  {project.deadline ? formatDate(project.deadline) : "—"}
                </span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>Publicado</span>
                <span className={styles.detailValue}>{formatDate(project.created_at)}</span>
              </div>
            </div>
          </Card>

          {/* Progress bar */}
          {project.requirements.length > 0 && (
            <Card padding="lg">
              <h3 className={styles.sideTitle}>Progreso</h3>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{
                    width: `${(completedReqs / project.requirements.length) * 100}%`,
                  }}
                />
              </div>
              <p className={styles.progressText}>
                {completedReqs} de {project.requirements.length} completados (
                {Math.round((completedReqs / project.requirements.length) * 100)}%)
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
