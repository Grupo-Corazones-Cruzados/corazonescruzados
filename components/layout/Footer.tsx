import Link from "next/link";
import styles from "./Footer.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <img src="/LogoCC.png" alt="CC" className={styles.logo} />
          <p className={styles.copy}>
            &copy; {new Date().getFullYear()} Corazones Cruzados.
            <br />
            Todos los derechos reservados.
          </p>
        </div>

        <div className={styles.links}>
          <div className={styles.col}>
            <h4 className={styles.colTitle}>Plataforma</h4>
            <Link href="/#servicios" className={styles.link}>Servicios</Link>
            <Link href="/#paquetes" className={styles.link}>Paquetes</Link>
            <Link href="/#faq" className={styles.link}>FAQ</Link>
          </div>
          <div className={styles.col}>
            <h4 className={styles.colTitle}>Cuenta</h4>
            <Link href="/auth" className={styles.link}>Iniciar sesión</Link>
            <Link href="/auth?tab=register" className={styles.link}>Registrarse</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
