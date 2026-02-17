"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { useCreateSolicitud, calculateTier } from "@/lib/hooks/usePaqueteSolicitudes";
import { useAuth } from "@/lib/AuthProvider";
import styles from "@/app/styles/PaqueteSolicitudes.module.css";

interface Miembro {
  id: number;
  nombre: string;
  puesto: string | null;
  foto: string | null;
}

const ArrowLeftIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
  </svg>
);

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const STEPS = [
  { id: 1, label: "Horas" },
  { id: 2, label: "Miembros" },
  { id: 3, label: "Distribucion" },
  { id: 4, label: "Detalles" },
  { id: 5, label: "Confirmar" },
];

const DAYS = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
};

export default function NuevoPaquetePage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { createSolicitud, loading: creating } = useCreateSolicitud();

  const [currentStep, setCurrentStep] = useState(1);
  const [miembros, setMiembros] = useState<Miembro[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [success, setSuccess] = useState(false);
  const [createdId, setCreatedId] = useState<number | null>(null);

  // Form state
  const [horasTotales, setHorasTotales] = useState<number>(10);
  const [selectedMiembros, setSelectedMiembros] = useState<Miembro[]>([]);
  const [horasPorMiembro, setHorasPorMiembro] = useState<Record<number, number>>({});
  const [tareasPorMiembro, setTareasPorMiembro] = useState<Record<number, string>>({});
  const [diasPorMiembro, setDiasPorMiembro] = useState<Record<number, number[]>>({});
  const [notasCliente, setNotasCliente] = useState("");

  // Tier calculation
  const tier = calculateTier(horasTotales);
  const costoBase = horasTotales * 10;
  const costoFinal = costoBase * (1 - tier.descuento / 100);

  // Load members
  useEffect(() => {
    const loadData = async () => {
      if (!isAuthenticated) return;
      try {
        const res = await fetch("/api/miembros-public");
        const data = await res.json();
        if (res.ok && data.miembros) {
          setMiembros(data.miembros);
        }
      } catch (error) {
        console.error("Error loading members:", error);
      } finally {
        setLoadingData(false);
      }
    };
    loadData();
  }, [isAuthenticated]);

  // Calculate unassigned hours
  const totalAsignadas = Object.values(horasPorMiembro).reduce((sum, h) => sum + (h || 0), 0);
  const horasSinAsignar = horasTotales - totalAsignadas;

  const toggleMiembro = (miembro: Miembro) => {
    if (selectedMiembros.find((m) => m.id === miembro.id)) {
      setSelectedMiembros(selectedMiembros.filter((m) => m.id !== miembro.id));
      const newHoras = { ...horasPorMiembro };
      delete newHoras[miembro.id];
      setHorasPorMiembro(newHoras);
      const newTareas = { ...tareasPorMiembro };
      delete newTareas[miembro.id];
      setTareasPorMiembro(newTareas);
      const newDias = { ...diasPorMiembro };
      delete newDias[miembro.id];
      setDiasPorMiembro(newDias);
    } else {
      setSelectedMiembros([...selectedMiembros, miembro]);
    }
  };

  const toggleDia = (miembroId: number, dia: number) => {
    const current = diasPorMiembro[miembroId] || [];
    if (current.includes(dia)) {
      setDiasPorMiembro({ ...diasPorMiembro, [miembroId]: current.filter((d) => d !== dia) });
    } else {
      setDiasPorMiembro({ ...diasPorMiembro, [miembroId]: [...current, dia].sort() });
    }
  };

  // Step validation
  const canProceed = () => {
    switch (currentStep) {
      case 1: return horasTotales > 0;
      case 2: return selectedMiembros.length > 0;
      case 3: return totalAsignadas > 0 && totalAsignadas <= horasTotales;
      case 4: return true;
      case 5: return true;
      default: return false;
    }
  };

  const handleSubmit = async () => {
    const asignaciones = selectedMiembros.map((m) => ({
      id_miembro: m.id,
      horas_asignadas: horasPorMiembro[m.id] || 0,
      descripcion_tarea: tareasPorMiembro[m.id] || undefined,
      dias_semana: diasPorMiembro[m.id] || [],
    })).filter((a) => a.horas_asignadas > 0);

    const result = await createSolicitud({
      horas_totales: horasTotales,
      notas_cliente: notasCliente || undefined,
      asignaciones,
    });

    if (result.data && !result.error) {
      setSuccess(true);
      setCreatedId(result.data.id);
    } else {
      alert(result.error || "Error al crear el paquete");
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
            <div className={styles.successIcon}><CheckIcon /></div>
            <h2 className={styles.successTitle}>Paquete Creado</h2>
            <p className={styles.successText}>
              Tu solicitud de paquete ha sido enviada. Los miembros asignados revisaran tu solicitud pronto.
            </p>
            <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "center" }}>
              <Link href={`/dashboard/tickets/paquetes/${createdId}`} className={styles.nextButton}>Ver Paquete</Link>
              <Link href="/dashboard/tickets/paquetes" className={styles.prevButton}>Ir a Paquetes</Link>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
        <Link href="/dashboard/tickets/paquetes" className={styles.backButton}>
          <ArrowLeftIcon /> Volver a paquetes
        </Link>

        <h1 className={styles.pageTitle}>Nuevo Paquete</h1>
        <p className={styles.pageSubtitle}>Crea un paquete de horas y asignalo a multiples miembros</p>

        {/* Steps Bar */}
        <div className={styles.stepsBar}>
          {STEPS.map((step, index) => (
            <React.Fragment key={step.id}>
              {index > 0 && (
                <div className={`${styles.stepConnector} ${currentStep > step.id - 1 ? styles.stepConnectorActive : ""}`} />
              )}
              <div className={`${styles.wizardStep} ${currentStep === step.id ? styles.stepActive : ""} ${currentStep > step.id ? styles.stepCompleted : ""}`}>
                <div className={styles.stepNumber}>
                  {currentStep > step.id ? <CheckIcon /> : step.id}
                </div>
                <span className={styles.stepLabel}>{step.label}</span>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Step Content */}
        <div className={styles.wizardContent}>
          {/* Step 1: Hours */}
          {currentStep === 1 && (
            <div>
              <h2 className={styles.sectionTitle}>Horas del Paquete</h2>
              <p className={styles.sectionSubtitle}>Define cuantas horas necesitas. El descuento se aplica automaticamente.</p>

              <div className={styles.hoursInputGroup}>
                <input
                  type="number"
                  min="1"
                  value={horasTotales}
                  onChange={(e) => setHorasTotales(Math.max(1, parseInt(e.target.value) || 1))}
                  className={styles.hoursInput}
                  placeholder="Horas"
                />

                {/* Tier Indicator */}
                <div className={styles.tierIndicator}>
                  <span className={`${styles.tierBadge} ${
                    tier.tierName === "Premium" ? styles.tierPremium :
                    tier.tierName === "Profesional" ? styles.tierProfesional :
                    styles.tierBasico
                  }`}>
                    {tier.tierName}
                  </span>
                  <div className={styles.tierInfo}>
                    <div className={styles.tierName}>{tier.tierName}</div>
                    {tier.descuento > 0 ? (
                      <div className={styles.tierDiscount}>{tier.descuento}% de descuento</div>
                    ) : (
                      <div className={styles.tierHint}>Sin descuento</div>
                    )}
                  </div>
                </div>

                {/* Discount hints */}
                {horasTotales < 25 && (
                  <p className={styles.tierHint}>Agrega {25 - horasTotales}h mas para obtener 10% de descuento</p>
                )}
                {horasTotales >= 25 && horasTotales < 50 && (
                  <p className={styles.tierHint}>Agrega {50 - horasTotales}h mas para obtener 20% de descuento</p>
                )}

                {/* Quote */}
                <div className={styles.quoteSummary}>
                  <div className={styles.quoteRow}>
                    <span className={styles.quoteLabel}>Subtotal ({horasTotales}h x $10/h)</span>
                    <span className={styles.quoteValue}>{formatCurrency(costoBase)}</span>
                  </div>
                  {tier.descuento > 0 && (
                    <div className={styles.quoteRow}>
                      <span className={styles.quoteLabel}>Descuento ({tier.descuento}%)</span>
                      <span className={styles.quoteValue} style={{ color: "#22c55e" }}>-{formatCurrency(costoBase - costoFinal)}</span>
                    </div>
                  )}
                  <div className={styles.quoteTotal}>
                    <span>Total</span>
                    <span className={styles.quoteTotalValue}>
                      {tier.descuento > 0 && <span className={styles.quoteStrikethrough}>{formatCurrency(costoBase)}</span>}
                      {formatCurrency(costoFinal)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Select Members */}
          {currentStep === 2 && (
            <div>
              <h2 className={styles.sectionTitle}>Selecciona Miembros</h2>
              <p className={styles.sectionSubtitle}>Elige uno o mas miembros para asignar horas.</p>
              <div className={styles.membersGrid}>
                {miembros.map((miembro) => (
                  <button
                    key={miembro.id}
                    className={`${styles.memberCard} ${selectedMiembros.find((m) => m.id === miembro.id) ? styles.memberCardSelected : ""}`}
                    onClick={() => toggleMiembro(miembro)}
                    type="button"
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
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Distribution */}
          {currentStep === 3 && (
            <div>
              <h2 className={styles.sectionTitle}>Distribuir Horas</h2>
              <p className={styles.sectionSubtitle}>Asigna horas a cada miembro. Total disponible: {horasTotales}h</p>
              <div className={styles.distributionSection}>
                {selectedMiembros.map((miembro) => {
                  const horas = horasPorMiembro[miembro.id] || 0;
                  const percent = horasTotales > 0 ? (horas / horasTotales) * 100 : 0;
                  return (
                    <div key={miembro.id} className={styles.distributionRow}>
                      <div className={styles.distributionMember}>
                        {miembro.foto ? (
                          <img src={miembro.foto} alt={miembro.nombre} className={styles.memberAvatarSmall} style={{ marginLeft: 0 }} />
                        ) : (
                          <div className={styles.memberAvatarPlaceholderSmall} style={{ marginLeft: 0 }}>
                            {miembro.nombre.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className={styles.distributionMemberName}>{miembro.nombre}</span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max={horasTotales}
                        value={horas || ""}
                        onChange={(e) => setHorasPorMiembro({
                          ...horasPorMiembro,
                          [miembro.id]: Math.max(0, parseFloat(e.target.value) || 0),
                        })}
                        className={styles.distributionInput}
                        placeholder="0"
                      />
                      <div className={styles.distributionBar}>
                        <div className={styles.distributionBarFill} style={{ width: `${percent}%` }} />
                      </div>
                      <span className={styles.distributionHoursLabel}>{horas}h</span>
                    </div>
                  );
                })}

                {horasSinAsignar > 0 && (
                  <div className={styles.unassignedHours}>
                    <span className={styles.unassignedLabel}>Horas sin asignar</span>
                    <span className={styles.unassignedValue}>{horasSinAsignar}h</span>
                  </div>
                )}

                {horasSinAsignar < 0 && (
                  <div className={styles.unassignedHours} style={{ borderColor: "rgba(239, 68, 68, 0.3)", background: "rgba(239, 68, 68, 0.08)" }}>
                    <span style={{ color: "#ef4444", fontWeight: 500 }}>Horas excedidas</span>
                    <span style={{ color: "#ef4444", fontWeight: 600 }}>{Math.abs(horasSinAsignar)}h</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Details per member */}
          {currentStep === 4 && (
            <div>
              <h2 className={styles.sectionTitle}>Detalles por Miembro</h2>
              <p className={styles.sectionSubtitle}>Describe la tarea y dias de trabajo para cada miembro.</p>
              <div className={styles.detailsPerMember}>
                {selectedMiembros.filter((m) => (horasPorMiembro[m.id] || 0) > 0).map((miembro) => (
                  <div key={miembro.id} className={styles.memberDetailCard}>
                    <div className={styles.memberDetailHeader}>
                      {miembro.foto ? (
                        <img src={miembro.foto} alt={miembro.nombre} className={styles.memberAvatarSmall} style={{ marginLeft: 0 }} />
                      ) : (
                        <div className={styles.memberAvatarPlaceholderSmall} style={{ marginLeft: 0 }}>
                          {miembro.nombre.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className={styles.memberDetailName}>{miembro.nombre}</span>
                      <span className={styles.memberDetailHours}>{horasPorMiembro[miembro.id]}h</span>
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Descripcion de la tarea</label>
                      <textarea
                        value={tareasPorMiembro[miembro.id] || ""}
                        onChange={(e) => setTareasPorMiembro({ ...tareasPorMiembro, [miembro.id]: e.target.value })}
                        className={styles.formTextarea}
                        placeholder="Describe que necesitas que haga este miembro..."
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Dias de la semana</label>
                      <div className={styles.daysBadges}>
                        {DAYS.map((day, i) => (
                          <button
                            key={i}
                            type="button"
                            className={`${styles.dayBadge} ${(diasPorMiembro[miembro.id] || []).includes(i) ? styles.dayBadgeSelected : ""}`}
                            onClick={() => toggleDia(miembro.id, i)}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Notas generales (opcional)</label>
                  <textarea
                    value={notasCliente}
                    onChange={(e) => setNotasCliente(e.target.value)}
                    className={styles.formTextarea}
                    placeholder="Notas adicionales para el paquete..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Confirmation */}
          {currentStep === 5 && (
            <div>
              <h2 className={styles.sectionTitle}>Confirmar Paquete</h2>
              <div className={styles.confirmationCard}>
                <div className={styles.confirmationSection}>
                  <div className={styles.confirmationLabel}>Horas Totales</div>
                  <div className={styles.confirmationValue}>{horasTotales}h - {tier.tierName}</div>
                </div>

                <div className={styles.confirmationSection}>
                  <div className={styles.confirmationLabel}>Miembros Asignados</div>
                  {selectedMiembros.filter((m) => (horasPorMiembro[m.id] || 0) > 0).map((miembro) => (
                    <div key={miembro.id} className={styles.confirmationMemberRow}>
                      {miembro.foto ? (
                        <img src={miembro.foto} alt={miembro.nombre} className={styles.memberAvatarSmall} style={{ marginLeft: 0 }} />
                      ) : (
                        <div className={styles.memberAvatarPlaceholderSmall} style={{ marginLeft: 0 }}>
                          {miembro.nombre.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span>{miembro.nombre}</span>
                      <span style={{ color: "var(--turquoise)", fontWeight: 600 }}>{horasPorMiembro[miembro.id]}h</span>
                    </div>
                  ))}
                </div>

                {notasCliente && (
                  <div className={styles.confirmationSection}>
                    <div className={styles.confirmationLabel}>Notas</div>
                    <div className={styles.confirmationValue}>{notasCliente}</div>
                  </div>
                )}

                <div className={styles.quoteSummary} style={{ marginTop: "var(--space-4)" }}>
                  <div className={styles.quoteRow}>
                    <span className={styles.quoteLabel}>Subtotal</span>
                    <span className={styles.quoteValue}>{formatCurrency(costoBase)}</span>
                  </div>
                  {tier.descuento > 0 && (
                    <div className={styles.quoteRow}>
                      <span className={styles.quoteLabel}>Descuento ({tier.descuento}%)</span>
                      <span className={styles.quoteValue} style={{ color: "#22c55e" }}>-{formatCurrency(costoBase - costoFinal)}</span>
                    </div>
                  )}
                  <div className={styles.quoteTotal}>
                    <span>Total</span>
                    <span className={styles.quoteTotalValue}>{formatCurrency(costoFinal)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className={styles.navigationButtons}>
          {currentStep > 1 ? (
            <button className={styles.prevButton} onClick={() => setCurrentStep(currentStep - 1)}>
              <ArrowLeftIcon /> Anterior
            </button>
          ) : (
            <div />
          )}

          {currentStep < 5 ? (
            <button
              className={styles.nextButton}
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={!canProceed()}
            >
              Siguiente <ArrowRightIcon />
            </button>
          ) : (
            <button
              className={styles.nextButton}
              onClick={handleSubmit}
              disabled={creating || !canProceed()}
            >
              {creating ? "Creando..." : "Enviar Solicitud"} <CheckIcon />
            </button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
