"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { Spinner } from "@/components/ui";
import PageHeader from "@/components/layout/PageHeader";
import styles from "./page.module.css";

export default function AutomationsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role === "client")) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  if (loading) return <div className={styles.loading}><Spinner /></div>;
  if (!user || user.role === "client") return null;

  return (
    <div>
      <PageHeader
        title="Automatizaciones"
        description="Selecciona una herramienta para comenzar."
      />

      <div className={styles.hubGrid}>
        <Link href="/dashboard/automations/email-masivo" className={styles.hubCard}>
          <div className={styles.hubCardIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M2 7l10 6 10-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
          <div className={styles.hubCardBody}>
            <h3 className={styles.hubCardTitle}>Envío masivo de correos</h3>
            <p className={styles.hubCardDesc}>
              Crea listas de contactos, diseña campañas y envía emails masivos con seguimiento de entregas.
            </p>
          </div>
          <svg className={styles.hubCardArrow} width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
