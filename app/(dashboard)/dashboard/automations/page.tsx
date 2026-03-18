"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { Spinner } from "@/components/ui";
import PageHeader from "@/components/layout/PageHeader";
import styles from "./page.module.css";

export default function AutomationsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/dashboard");
    }
  }, [user, isLoading, router]);

  if (isLoading) return <div className={styles.loading}><Spinner /></div>;
  if (!user) return null;

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

        <Link href="/dashboard/automations/whatsapp" className={styles.hubCard}>
          <div className={styles.hubCardIcon} style={{ background: "rgba(37, 211, 102, 0.1)", color: "#25D366" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" fill="currentColor" />
              <path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className={styles.hubCardBody}>
            <h3 className={styles.hubCardTitle}>Envío de mensajes por WhatsApp</h3>
            <p className={styles.hubCardDesc}>
              Envía mensajes masivos por WhatsApp usando la API de Meta Business.
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
