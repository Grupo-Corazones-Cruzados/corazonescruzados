import styles from "./layout.module.css";

export const metadata = {
  title: "Automatizaciones — Corazones Cruzados",
};

export default function AutomationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.wrapper}>
      {children}
    </div>
  );
}
