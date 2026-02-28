"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import styles from "./Header.module.css";

export default function Header() {
  const { user, signOut } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ""}`}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          <img src="/LogoCC.png" alt="CC" className={styles.logoImg} />
          <span className={styles.logoText}>Corazones Cruzados</span>
        </Link>

        <nav className={`${styles.nav} ${menuOpen ? styles.navOpen : ""}`}>
          <Link href="/#servicios" className={styles.link} onClick={() => setMenuOpen(false)}>
            Servicios
          </Link>
          <Link href="/#paquetes" className={styles.link} onClick={() => setMenuOpen(false)}>
            Paquetes
          </Link>
          <Link href="/#faq" className={styles.link} onClick={() => setMenuOpen(false)}>
            FAQ
          </Link>
        </nav>

        <div className={styles.actions}>
          {user ? (
            <div className={styles.userMenu}>
              <Link href="/dashboard" className={styles.dashLink}>
                <Avatar
                  src={user.avatar_url}
                  name={`${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email}
                  size="sm"
                />
                <span className={styles.userName}>
                  {user.first_name || user.email.split("@")[0]}
                </span>
              </Link>
              <button className={styles.signOutBtn} onClick={signOut}>
                Salir
              </button>
            </div>
          ) : (
            <>
              <Link href="/auth">
                <Button variant="ghost" size="sm">
                  Iniciar sesión
                </Button>
              </Link>
              <Link href="/auth?tab=register">
                <Button size="sm">Registrarse</Button>
              </Link>
            </>
          )}
        </div>

        <button
          className={styles.burger}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menú"
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}
