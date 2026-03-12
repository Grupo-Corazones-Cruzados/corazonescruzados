"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import type { PublicMember } from "@/lib/types";
import styles from "./page.module.css";

// --- Member Gallery (client component) ---

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatWhatsAppUrl(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

function MemberGallery() {
  const [members, setMembers] = useState<PublicMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/members/public")
      .then((r) => r.json())
      .then((json) => setMembers(json.data ?? []))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={styles.galleryLoading}>
        <Spinner />
      </div>
    );
  }

  if (members.length === 0) return null;

  return (
    <div className={styles.membersGrid}>
      {members.map((m) => (
        <div key={m.id} className={styles.memberCard}>
          {m.photo_url ? (
            <img
              src={m.photo_url}
              alt={m.name}
              className={styles.memberPhoto}
            />
          ) : (
            <div className={styles.memberInitials}>
              {getInitials(m.name)}
            </div>
          )}
          <div className={styles.memberInfo}>
            <h3 className={styles.memberName}>{m.name}</h3>
            {m.position && (
              <p className={styles.memberPosition}>{m.position}</p>
            )}
            {m.bio && (
              <p className={styles.memberBio}>{m.bio}</p>
            )}
            {m.skills.length > 0 && (
              <div className={styles.memberSkills}>
                {m.skills.slice(0, 3).map((skill) => (
                  <span key={skill} className={styles.skillChip}>
                    {skill}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className={styles.memberActions}>
            <Link href={`/portfolio/${m.id}`} className={styles.cvButton}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Ver CV
            </Link>
            <a
              className={styles.waButton}
              href={formatWhatsAppUrl(m.phone!)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Contactar
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Main Page ---

export default function HomePage() {
  return (
    <div className={styles.page}>
      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            Un Corazón puede
            <br />
            <span className={styles.heroAccent}>cruzar al mundo.</span>
          </h1>
          <p className={styles.heroDesc}>
            Proyecto de Desarrollo Humano
          </p>
          <div className={styles.heroCta}>
            <Link href="/auth?tab=register">
              <Button size="lg">Comenzar gratis</Button>
            </Link>
            <Link href="#equipo">
              <Button variant="secondary" size="lg">
                Conocer más
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Servicios */}
      <section id="servicios" className={styles.section} style={{ background: "var(--bg-secondary)" }}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <h2 className="heading-2">Servicios</h2>
          </div>
          <div className={styles.servicesGrid}>
            <div className={styles.serviceCard}>
              <div className={styles.serviceIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
              </div>
              <h3 className={styles.serviceTitle}>
                Descubrimos el talento de las personas{" "}
                <span className={styles.serviceAccent}>a través de su propósito</span>
              </h3>
            </div>
            <div className={styles.serviceCard}>
              <div className={styles.serviceIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </div>
              <h3 className={styles.serviceTitle}>
                Ofrecemos lo mejor que tenemos{" "}
                <span className={styles.serviceAccent}>para quienes más lo necesitan</span>
              </h3>
            </div>
            <div className={styles.serviceCard}>
              <div className={styles.serviceIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12l2 2 4-4" />
                  <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
                </svg>
              </div>
              <h3 className={styles.serviceTitle}>
                Entregamos y garantizamos{" "}
                <span className={styles.serviceAccent}>soluciones de calidad para tus problemas</span>
              </h3>
            </div>
            <div className={styles.serviceCard}>
              <div className={styles.serviceIcon}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20V10M6 20V4M18 20v-6" />
                </svg>
              </div>
              <h3 className={styles.serviceTitle}>
                Aplicamos una metodología moderna y humanizada{" "}
                <span className={styles.serviceAccent}>para un progreso continuo y satisfactorio para todos</span>
              </h3>
            </div>
          </div>
        </div>
      </section>

      {/* Members Gallery */}
      <section id="equipo" className={styles.section}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <h2 className="heading-2">Nuestro Equipo</h2>
            <p className="text-secondary">
              Conoce a los profesionales que te acompañarán en tus problemas.
            </p>
          </div>
          <MemberGallery />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className={styles.section}>
        <div className="container" style={{ maxWidth: "680px" }}>
          <div className={styles.sectionHeader}>
            <h2 className="heading-2">Preguntas frecuentes</h2>
          </div>
          <div className={styles.faqList}>
            <details className={styles.faqItem}>
              <summary className={styles.faqQuestion}>
                ¿Qué es Corazones Cruzados?
              </summary>
              <p className={styles.faqAnswer}>
                Es una plataforma de desarrollo humano que conecta personas que
                buscan soluciones con profesionales capacitados. Puedes agendar
                consultorías, publicar proyectos o adquirir productos y
                servicios del marketplace, todo desde un solo lugar.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary className={styles.faqQuestion}>
                ¿Qué servicios puedo encontrar?
              </summary>
              <p className={styles.faqAnswer}>
                Puedes agendar sesiones individuales con un profesional a través
                de tickets, publicar proyectos para recibir propuestas de
                nuestro equipo, o explorar el marketplace donde encontrarás
                productos y trabajos listos para adquirir.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary className={styles.faqQuestion}>
                ¿La plataforma es gratuita?
              </summary>
              <p className={styles.faqAnswer}>
                Crear tu cuenta y explorar la plataforma es completamente gratis.
                Solo pagas cuando contratas un servicio, apruebas una propuesta
                de proyecto o realizas una compra en el marketplace.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary className={styles.faqQuestion}>
                ¿Cómo me registro y comienzo?
              </summary>
              <p className={styles.faqAnswer}>
                Haz clic en &quot;Crear cuenta&quot;, completa tus datos y
                verifica tu correo electrónico. Una vez dentro, podrás explorar
                los servicios disponibles, agendar tickets, publicar proyectos y
                comprar en el marketplace desde tu panel de control.
              </p>
            </details>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.ctaSection}>
        <div className="container" style={{ textAlign: "center" }}>
          <h2 className="heading-2">¿Listo para comenzar?</h2>
          <p className="text-secondary" style={{ marginTop: "var(--space-3)" }}>
            Crea tu cuenta gratis y gestiona todo desde un solo lugar.
          </p>
          <div style={{ marginTop: "var(--space-6)" }}>
            <Link href="/auth?tab=register">
              <Button size="lg">Crear cuenta gratis</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
