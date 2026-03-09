import styles from "./layout.module.css";

export const metadata = {
  title: "Envío masivo de correos — Corazones Cruzados",
};

export default function EmailMasivoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.titleIcon}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M2 6l8 5 8-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
          <h1 className={styles.title}>Envío masivo de correos</h1>
        </div>
      </header>
      <main className={styles.main}>{children}</main>
    </>
  );
}
