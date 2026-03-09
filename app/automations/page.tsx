import Link from "next/link";
import styles from "./page.module.css";

export default function AutomationsPage() {
  return (
    <>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.titleIcon}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M11 2L4 12h5l-1 6 7-10H10l1-6z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className={styles.title}>Automatizaciones</h1>
        </div>
      </header>

      <main className={styles.main}>
        <p className={styles.subtitle}>
          Selecciona una herramienta para comenzar.
        </p>

        <div className={styles.hubGrid}>
          <Link href="/automations/email-masivo" className={styles.hubCard}>
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
      </main>
    </>
  );
}
