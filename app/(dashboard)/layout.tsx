import Sidebar from "@/components/layout/Sidebar";
import AuthGuard from "@/components/providers/AuthGuard";
import styles from "./layout.module.css";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      <div className={styles.wrapper}>
        <Sidebar />
        <main className={styles.main}>
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
