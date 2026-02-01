"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { usePurchasePackage } from "@/lib/hooks/usePackages";
import { useAuth } from "@/lib/AuthProvider";
import styles from "@/app/styles/Packages.module.css";

interface Miembro {
  id: number;
  nombre: string;
  puesto: string | null;
  foto: string | null;
  costo: number | null;
}

interface Paquete {
  id: number;
  nombre: string;
  horas: number;
  descripcion: string | null;
  contenido: string | null;
  descuento: number | null;
}

const ArrowLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </svg>
);

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const PackageIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16.5 9.4 7.55 4.24" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.29 7 12 12 20.71 7" />
    <line x1="12" x2="12" y1="22" y2="12" />
  </svg>
);

export default function ComprarPaquetePage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { purchasePackage, loading: purchasing } = usePurchasePackage();

  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [success, setSuccess] = useState(false);
  const [createdPurchaseId, setCreatedPurchaseId] = useState<number | null>(null);

  // Form state
  const [selectedMiembro, setSelectedMiembro] = useState<Miembro | null>(null);
  const [selectedPaquete, setSelectedPaquete] = useState<Paquete | null>(null);
  const [notas, setNotas] = useState("");

  useEffect(() => {
    const loadData = async () => {
      if (!isAuthenticated) return;

      try {
        const [membersRes, packagesRes] = await Promise.all([
          fetch("/api/members"),
          fetch("/api/paquetes"),
        ]);

        const membersData = await membersRes.json();
        const packagesData = await packagesRes.json();

        if (membersRes.ok && membersData.members) {
          setMiembros(membersData.members);
        }

        if (packagesRes.ok && packagesData.paquetes) {
          setPaquetes(packagesData.paquetes);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoadingData(false);
      }
    };

    loadData();
  }, [isAuthenticated]);

  const handleSubmit = async () => {
    if (!selectedMiembro || !selectedPaquete) return;

    const result = await purchasePackage({
      id_miembro: selectedMiembro.id,
      id_paquete: selectedPaquete.id,
      notas: notas || undefined,
    });

    if (result.data && !result.error) {
      setSuccess(true);
      setCreatedPurchaseId(result.data.id);
    } else {
      alert(result.error || "Error al comprar el paquete");
    }
  };

  if (loadingData) {
    return (
      <DashboardLayout>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p style={{ color: "var(--text-muted)" }}>Cargando...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (success) {
    return (
      <DashboardLayout>
        <div className={styles.page}>
          <div className={styles.successState}>
            <div className={styles.successIcon}>
              <CheckIcon />
            </div>
            <h2 className={styles.successTitle}>¡Compra Registrada!</h2>
            <p className={styles.successText}>
              Tu solicitud de paquete ha sido enviada a {selectedMiembro?.nombre}.
              Te notificaremos cuando responda.
            </p>
            <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "center" }}>
              <Link href={`/dashboard/mis-paquetes/${createdPurchaseId}`} className={styles.primaryButton}>
                Ver mi paquete
              </Link>
              <Link href="/dashboard/mis-paquetes" className={styles.secondaryButton}>
                Ir a Mis Paquetes
              </Link>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <Link href="/dashboard/mis-paquetes" className={styles.backButton}>
          <ArrowLeftIcon />
          Volver a mis paquetes
        </Link>

        <h1 className={styles.pageTitle}>Comprar Paquete</h1>
        <p className={styles.pageSubtitle}>
          Selecciona un miembro y un paquete de horas para trabajar
        </p>

        <div className={styles.purchaseGrid}>
          {/* Step 1: Select Member */}
          <div className={styles.purchaseSection}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.stepNumber}>1</span>
              Selecciona un Miembro
            </h2>
            <div className={styles.membersGrid}>
              {miembros.map((miembro) => (
                <button
                  key={miembro.id}
                  className={`${styles.memberCard} ${
                    selectedMiembro?.id === miembro.id ? styles.memberCardSelected : ""
                  }`}
                  onClick={() => setSelectedMiembro(miembro)}
                >
                  {miembro.foto ? (
                    <img src={miembro.foto} alt={miembro.nombre} className={styles.memberAvatar} />
                  ) : (
                    <div className={styles.memberAvatarPlaceholder}>
                      {miembro.nombre.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className={styles.memberInfo}>
                    <div className={styles.memberName}>{miembro.nombre}</div>
                    <div className={styles.memberRole}>{miembro.puesto || "Miembro"}</div>
                  </div>
                  {selectedMiembro?.id === miembro.id && (
                    <div className={styles.selectedCheck}>
                      <CheckIcon />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Step 2: Select Package */}
          <div className={styles.purchaseSection}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.stepNumber}>2</span>
              Selecciona un Paquete
            </h2>
            <div className={styles.packagesGrid}>
              {paquetes.map((paquete) => (
                <button
                  key={paquete.id}
                  className={`${styles.packageCard} ${
                    selectedPaquete?.id === paquete.id ? styles.packageCardSelected : ""
                  }`}
                  onClick={() => setSelectedPaquete(paquete)}
                >
                  <div className={styles.packageIcon}>
                    <PackageIcon />
                  </div>
                  <div className={styles.packageContent}>
                    <div className={styles.packageName}>{paquete.nombre}</div>
                    <div className={styles.packageHours}>{paquete.horas} horas</div>
                    {paquete.descripcion && (
                      <div className={styles.packageDescription}>{paquete.descripcion}</div>
                    )}
                  </div>
                  {selectedPaquete?.id === paquete.id && (
                    <div className={styles.selectedCheck}>
                      <CheckIcon />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Step 3: Notes */}
          <div className={styles.purchaseSection}>
            <h2 className={styles.sectionTitle}>
              <span className={styles.stepNumber}>3</span>
              Notas (Opcional)
            </h2>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Describe brevemente lo que necesitas o agrega informacion relevante para el miembro..."
              className={styles.notesTextarea}
              rows={4}
            />
          </div>

          {/* Summary */}
          {selectedMiembro && selectedPaquete && (
            <div className={styles.purchaseSummary}>
              <h3 className={styles.summaryTitle}>Resumen de la Compra</h3>
              <div className={styles.summaryRow}>
                <span>Miembro:</span>
                <span className={styles.summaryValue}>{selectedMiembro.nombre}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Paquete:</span>
                <span className={styles.summaryValue}>{selectedPaquete.nombre}</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Horas:</span>
                <span className={styles.summaryValueHighlight}>{selectedPaquete.horas}h</span>
              </div>

              <button
                className={styles.confirmButton}
                onClick={handleSubmit}
                disabled={purchasing}
              >
                {purchasing ? "Procesando..." : "Confirmar Compra"}
              </button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
