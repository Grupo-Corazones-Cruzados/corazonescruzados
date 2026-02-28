"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
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

function MemberGallery() {
  const [members, setMembers] = useState<PublicMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PublicMember | null>(null);

  // Contact form state
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactMessage, setContactMessage] = useState("");

  useEffect(() => {
    fetch("/api/members/public")
      .then((r) => r.json())
      .then((json) => setMembers(json.data ?? []))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  }, []);

  function openContact(member: PublicMember) {
    setSelected(member);
    setContactName("");
    setContactEmail("");
    setContactPhone("");
    setContactMessage("");
  }

  function closeContact() {
    setSelected(null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selected?.phone) return;

    const phone = selected.phone.replace(/\D/g, "");
    const lines = [
      `Hola ${selected.name}, me gustaría contactarte.`,
      `Mi nombre: ${contactName}`,
      `Email: ${contactEmail}`,
      contactPhone ? `Teléfono: ${contactPhone}` : "",
      `Mensaje: ${contactMessage}`,
    ]
      .filter(Boolean)
      .join("\n");

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(lines)}`;
    window.open(url, "_blank");
    closeContact();
  }

  if (loading) {
    return (
      <div className={styles.galleryLoading}>
        <Spinner />
      </div>
    );
  }

  if (members.length === 0) return null;

  return (
    <>
      <div className={styles.membersGrid}>
        {members.map((m) => (
          <button
            key={m.id}
            className={styles.memberCard}
            onClick={() => openContact(m)}
            type="button"
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
          </button>
        ))}
      </div>

      {/* Contact modal */}
      <Modal
        open={!!selected}
        onClose={closeContact}
        title={selected ? `Contactar a ${selected.name}` : ""}
        size="sm"
      >
        {selected && (
          selected.phone ? (
            <form onSubmit={handleSubmit} className={styles.contactForm}>
              <Input
                label="Tu nombre"
                name="contactName"
                required
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
              <Input
                label="Tu email"
                name="contactEmail"
                type="email"
                required
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
              <Input
                label="Tu teléfono (opcional)"
                name="contactPhone"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
              <div className={styles.textareaField}>
                <label htmlFor="contactMessage" className={styles.textareaLabel}>
                  Mensaje
                </label>
                <textarea
                  id="contactMessage"
                  className={styles.textarea}
                  rows={3}
                  required
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                />
              </div>
              <Button type="submit" style={{ width: "100%" }}>
                Contactar por WhatsApp
              </Button>
            </form>
          ) : (
            <div className={styles.noPhone}>
              <p>Este miembro no tiene un número de WhatsApp registrado por el momento.</p>
            </div>
          )
        )}
      </Modal>
    </>
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
