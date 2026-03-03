"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import type { PublicMember } from "@/lib/types";
import styles from "./page.module.css";

const PACKAGES = [
  {
    name: "Basic",
    price: "$99",
    hours: "5 horas",
    features: ["Soporte por email", "1 proyecto activo", "Facturación básica"],
  },
  {
    name: "Enfoque",
    price: "$249",
    hours: "15 horas",
    features: [
      "Soporte prioritario",
      "3 proyectos activos",
      "Facturación completa",
      "Google Calendar",
    ],
    featured: true,
  },
  {
    name: "Elite",
    price: "$499",
    hours: "40 horas",
    features: [
      "Soporte dedicado",
      "Proyectos ilimitados",
      "Facturación automática",
      "Google Calendar",
      "Marketplace incluido",
    ],
  },
];

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
        <a
          key={m.id}
          className={styles.memberCard}
          href={formatWhatsAppUrl(m.phone!)}
          target="_blank"
          rel="noopener noreferrer"
        >
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
          <span className={styles.waButton}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Contactar
          </span>
        </a>
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
              Conoce a los profesionales que te acompañarán en tu proceso.
            </p>
          </div>
          <MemberGallery />
        </div>
      </section>

      {/* Packages */}
      <section id="paquetes" className={styles.section} style={{ background: "var(--bg-secondary)" }}>
        <div className="container">
          <div className={styles.sectionHeader}>
            <h2 className="heading-2">Paquetes</h2>
            <p className="text-secondary">
              Elige el plan que mejor se adapte a tus necesidades.
            </p>
          </div>
          <div className={styles.packagesGrid}>
            {PACKAGES.map((pkg) => (
              <Card
                key={pkg.name}
                padding="lg"
                className={pkg.featured ? styles.featuredPkg : ""}
              >
                <h3 className={styles.pkgName}>{pkg.name}</h3>
                <div className={styles.pkgPrice}>
                  <span className={styles.priceAmount}>{pkg.price}</span>
                  <span className={styles.priceUnit}>/ {pkg.hours}</span>
                </div>
                <ul className={styles.pkgFeatures}>
                  {pkg.features.map((f) => (
                    <li key={f} className={styles.pkgFeature}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M4 8l3 3 5-6" stroke="var(--success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/auth?tab=register" style={{ width: "100%" }}>
                  <Button
                    variant={pkg.featured ? "primary" : "secondary"}
                    style={{ width: "100%" }}
                  >
                    Seleccionar
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
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
                ¿Cómo funciona el sistema de tickets?
              </summary>
              <p className={styles.faqAnswer}>
                Creas un ticket seleccionando el servicio y miembro del equipo.
                Reservas un horario disponible y recibes confirmación con enlace
                de Google Meet.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary className={styles.faqQuestion}>
                ¿Puedo publicar proyectos?
              </summary>
              <p className={styles.faqAnswer}>
                Sí. Los clientes publican proyectos y los miembros envían
                propuestas con precio y tiempo estimado.
              </p>
            </details>
            <details className={styles.faqItem}>
              <summary className={styles.faqQuestion}>
                ¿Cómo funcionan los paquetes de horas?
              </summary>
              <p className={styles.faqAnswer}>
                Compras un paquete con horas incluidas. Luego creas solicitudes
                que se descuentan de tu saldo.
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
