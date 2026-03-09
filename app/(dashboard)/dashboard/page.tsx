"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import Card from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import Badge from "@/components/ui/Badge";
import styles from "./page.module.css";

interface Stats {
  [key: string]: number;
}

const STAT_CONFIG: Record<string, { label: string; href: string; color: string }> = {
  open_tickets: { label: "Tickets Abiertos", href: "/dashboard/tickets", color: "var(--accent)" },
  active_projects: { label: "Proyectos Activos", href: "/dashboard/projects", color: "#5856D6" },
  users: { label: "Usuarios", href: "/dashboard/admin", color: "var(--info)" },
  active_members: { label: "Miembros Activos", href: "/dashboard/admin", color: "var(--success)" },
  clients: { label: "Clientes", href: "/dashboard/admin", color: "#FF2D55" },
};

const QUICK_ACTIONS = [
  { label: "Nuevo Ticket", href: "/dashboard/tickets", icon: "+" },
  { label: "Nuevo Proyecto", href: "/dashboard/projects", icon: "+" },
  { label: "Marketplace", href: "/dashboard/marketplace", icon: "→" },
  { label: "Configuración", href: "/dashboard/settings", icon: "⚙" },
];

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((d) => setStats(d.data))
      .catch(() => setStats({}));
  }, []);

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div>
      <div className={styles.welcome}>
        <div>
          <h1 className={styles.title}>
            Bienvenido{user?.first_name ? `, ${user.first_name}` : ""}
          </h1>
          <p className={styles.subtitle}>
            Aquí tienes un resumen de tu actividad.
          </p>
        </div>
        {user && (
          <Badge variant={user.role === "admin" ? "info" : user.role === "member" ? "success" : "default"}>
            {user.role === "admin" ? "Administrador" : user.role === "member" ? "Miembro" : "Cliente"}
          </Badge>
        )}
      </div>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        {stats ? (
          Object.entries(stats).map(([key, value]) => {
            const cfg = STAT_CONFIG[key];
            if (!cfg) return null;
            return (
              <Link key={key} href={cfg.href}>
                <Card hover padding="lg" className={styles.statCard}>
                  <div className={styles.statDot} style={{ background: cfg.color }} />
                  <p className={styles.statLabel}>{cfg.label}</p>
                  <p className={styles.statValue}>{value}</p>
                </Card>
              </Link>
            );
          })
        ) : (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} padding="lg" className={styles.statCard}>
              <div className={styles.statSkeleton} />
            </Card>
          ))
        )}
      </div>

      {/* Quick Actions */}
      <h2 className={styles.sectionTitle}>Acciones rápidas</h2>
      <div className={styles.actionsGrid}>
        {QUICK_ACTIONS.map((action) => (
          <Link key={action.label} href={action.href}>
            <Card hover padding="md" className={styles.actionCard}>
              <span className={styles.actionIcon}>{action.icon}</span>
              <span className={styles.actionLabel}>{action.label}</span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
