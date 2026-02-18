"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import styles from "@/app/styles/Tickets.module.css";

const CRITERIOS = [
  "valor", "coraje", "pureza", "fe", "paciencia",
  "seriedad", "empatia", "espontaneidad", "autonomia",
];

interface Invitacion {
  id: number;
  created_at: string;
  participo: boolean;
  id_postulacion: number;
  motivo: string;
  id_usuario: string;
  nombre: string;
  apellido: string;
  email: string;
  avatar_url: string | null;
}

export default function EventoDetallePage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [evento, setEvento] = useState<any>(null);
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showInvitarModal, setShowInvitarModal] = useState(false);
  const [showPuntuarModal, setShowPuntuarModal] = useState(false);
  const [showConvertirModal, setShowConvertirModal] = useState(false);

  // Invitar state
  const [postulaciones, setPostulaciones] = useState<any[]>([]);

  // Puntuar state
  const [puntuarTarget, setPuntuarTarget] = useState<Invitacion | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});

  // Convertir state
  const [convertirTarget, setConvertirTarget] = useState<Invitacion | null>(null);
  const [convertirForm, setConvertirForm] = useState({ puesto: "", descripcion: "", costo: 0 });
  const [submitting, setSubmitting] = useState(false);

  const fetchEvento = useCallback(async () => {
    try {
      const [evRes, invRes] = await Promise.all([
        fetch(`/api/reclutamiento/eventos/${id}`),
        fetch(`/api/reclutamiento/eventos/${id}/invitaciones`),
      ]);

      if (evRes.ok) {
        const evData = await evRes.json();
        setEvento(evData.evento);
      } else if (evRes.status === 403) {
        router.push("/dashboard/proyecto/reclutamiento/encuadre");
        return;
      }

      if (invRes.ok) {
        const invData = await invRes.json();
        setInvitaciones(invData.invitaciones);
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, [id, router]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchEvento();
    }
  }, [authLoading, user, fetchEvento]);

  const handleInvitar = async () => {
    // Fetch available postulaciones
    try {
      const res = await fetch("/api/reclutamiento/postulaciones");
      if (res.ok) {
        const data = await res.json();
        // Filter out already invited ones
        const invitedIds = new Set(invitaciones.map((i) => i.id_postulacion));
        const available = data.postulaciones.filter(
          (p: any) => !invitedIds.has(p.id) && p.estado === "activo"
        );
        setPostulaciones(available);
        setShowInvitarModal(true);
      }
    } catch {
      alert("Error al cargar postulaciones");
    }
  };

  const handleInvitarPostulante = async (postulacionId: number) => {
    try {
      const res = await fetch(`/api/reclutamiento/eventos/${id}/invitaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_postulacion: postulacionId }),
      });
      if (res.ok) {
        setShowInvitarModal(false);
        fetchEvento();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch {
      alert("Error de conexión");
    }
  };

  const handleToggleParticipacion = async (invitacionId: number, participo: boolean) => {
    try {
      await fetch(`/api/reclutamiento/eventos/${id}/participacion`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_invitacion: invitacionId, participo }),
      });
      fetchEvento();
    } catch {
      // ignore
    }
  };

  const handleOpenPuntuar = (inv: Invitacion) => {
    setPuntuarTarget(inv);
    // Reset scores
    const initial: Record<string, number> = {};
    CRITERIOS.forEach((c) => (initial[c] = 5));
    setScores(initial);
    setShowPuntuarModal(true);
  };

  const handleGuardarPuntuacion = async () => {
    if (!puntuarTarget || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/reclutamiento/eventos/${id}/puntuaciones`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_invitacion: puntuarTarget.id, ...scores }),
      });
      if (res.ok) {
        setShowPuntuarModal(false);
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch {
      alert("Error de conexión");
    }
    setSubmitting(false);
  };

  const handleOpenConvertir = (inv: Invitacion) => {
    setConvertirTarget(inv);
    setConvertirForm({ puesto: "", descripcion: "", costo: 0 });
    setShowConvertirModal(true);
  };

  const handleConvertir = async () => {
    if (!convertirTarget || !convertirForm.puesto || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/reclutamiento/aspirantes/${convertirTarget.id_postulacion}/convertir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(convertirForm),
      });
      if (res.ok) {
        setShowConvertirModal(false);
        alert("Aspirante convertido a miembro exitosamente");
        fetchEvento();
      } else {
        const data = await res.json();
        alert(data.error);
      }
    } catch {
      alert("Error de conexión");
    }
    setSubmitting(false);
  };

  const handleUpdateEstado = async (estado: string) => {
    try {
      await fetch(`/api/reclutamiento/eventos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado }),
      });
      fetchEvento();
    } catch {
      // ignore
    }
  };

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className={styles.page}>
          <div className={styles.emptyState}>
            <p style={{ color: "var(--text-muted)" }}>Cargando...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!evento) {
    return (
      <DashboardLayout>
        <div className={styles.page}>
          <div className={styles.emptyState}>
            <h3 className={styles.emptyTitle}>Evento no encontrado</h3>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.pageHeader}>
          <div>
            <button
              onClick={() => router.push("/dashboard/proyecto/reclutamiento/encuadre/eventos")}
              style={{
                background: "none", border: "none", color: "var(--text-muted)",
                fontSize: "0.85rem", cursor: "pointer", padding: 0, marginBottom: "8px",
                display: "flex", alignItems: "center", gap: "4px",
              }}
            >
              ← Volver a eventos
            </button>
            <h1 className={styles.pageTitle}>{evento.nombre}</h1>
            <p className={styles.pageSubtitle}>
              {new Date(evento.fecha).toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              {evento.descripcion && ` — ${evento.descripcion}`}
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{
              padding: "6px 14px", borderRadius: "9999px", fontSize: "0.8rem", fontWeight: 600,
              background: evento.estado === "activo" ? "rgba(34, 197, 94, 0.15)" : evento.estado === "finalizado" ? "rgba(59, 130, 246, 0.15)" : "rgba(239, 68, 68, 0.15)",
              color: evento.estado === "activo" ? "#22c55e" : evento.estado === "finalizado" ? "#3b82f6" : "#ef4444",
            }}>
              {evento.estado}
            </span>
            {evento.estado === "activo" && (
              <button
                onClick={() => handleUpdateEstado("finalizado")}
                style={{
                  padding: "8px 16px", borderRadius: "8px",
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                  background: "transparent", color: "#3b82f6", fontSize: "0.85rem", cursor: "pointer",
                }}
              >
                Finalizar
              </button>
            )}
          </div>
        </div>

        {/* Actions Bar */}
        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
          <button
            onClick={handleInvitar}
            style={{
              padding: "10px 20px", borderRadius: "8px",
              border: "none", background: "#00CED1", color: "#000",
              fontWeight: 600, fontSize: "0.9rem", cursor: "pointer",
            }}
          >
            + Invitar Aspirante
          </button>
        </div>

        {/* Invitados Table */}
        <div style={{
          marginTop: "20px",
          borderRadius: "12px",
          border: "1px solid var(--border-color, rgba(255, 255, 255, 0.06))",
          background: "var(--surface-1, #141414)",
          overflow: "hidden",
        }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color, rgba(255, 255, 255, 0.06))" }}>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "var(--text-primary)" }}>
              Invitados ({invitaciones.length})
            </h3>
          </div>

          {invitaciones.length === 0 ? (
            <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
              No hay invitados aún. Invita aspirantes para comenzar.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Aspirante", "Participó", "Acciones"].map((h) => (
                      <th key={h} style={{
                        padding: "10px 16px", textAlign: "left",
                        fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase",
                        letterSpacing: "0.05em", color: "var(--text-muted)",
                        borderBottom: "1px solid var(--border-color, rgba(255, 255, 255, 0.06))",
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invitaciones.map((inv) => (
                    <tr key={inv.id} style={{ borderBottom: "1px solid var(--border-color, rgba(255, 255, 255, 0.03))" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: "50%",
                            background: "var(--surface-2, #1A1A1A)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)",
                            overflow: "hidden", flexShrink: 0,
                          }}>
                            {inv.avatar_url ? (
                              <img src={inv.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            ) : (
                              (inv.nombre?.[0] || inv.email[0]).toUpperCase()
                            )}
                          </div>
                          <div>
                            <div style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: "0.9rem" }}>
                              {[inv.nombre, inv.apellido].filter(Boolean).join(" ") || inv.email}
                            </div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{inv.email}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <button
                          onClick={() => handleToggleParticipacion(inv.id, !inv.participo)}
                          style={{
                            padding: "4px 12px", borderRadius: "9999px", fontSize: "0.8rem",
                            fontWeight: 500, cursor: "pointer", border: "none",
                            background: inv.participo ? "rgba(34, 197, 94, 0.15)" : "rgba(156, 163, 175, 0.15)",
                            color: inv.participo ? "#22c55e" : "#9ca3af",
                          }}
                        >
                          {inv.participo ? "Si" : "No"}
                        </button>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            onClick={() => handleOpenPuntuar(inv)}
                            style={{
                              padding: "6px 12px", borderRadius: "6px",
                              border: "1px solid rgba(0, 206, 209, 0.3)",
                              background: "transparent", color: "#00CED1", fontSize: "0.8rem", cursor: "pointer",
                            }}
                          >
                            Puntuar
                          </button>
                          <button
                            onClick={() => handleOpenConvertir(inv)}
                            style={{
                              padding: "6px 12px", borderRadius: "6px",
                              border: "1px solid rgba(139, 92, 246, 0.3)",
                              background: "transparent", color: "#8b5cf6", fontSize: "0.8rem", cursor: "pointer",
                            }}
                          >
                            Seleccionar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Invitar Modal */}
      {showInvitarModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "24px", background: "rgba(0, 0, 0, 0.85)", backdropFilter: "blur(20px)",
        }} onClick={() => setShowInvitarModal(false)}>
          <div style={{
            width: "min(500px, 96vw)", maxHeight: "80vh", overflow: "auto",
            borderRadius: "20px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            background: "linear-gradient(180deg, #1A1A1A 0%, #141414 100%)",
            padding: "28px",
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 20px", color: "#FFF", fontSize: "1.1rem" }}>Invitar Aspirante</h3>

            {postulaciones.length === 0 ? (
              <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "20px" }}>
                No hay aspirantes disponibles para invitar
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {postulaciones.map((p: any) => (
                  <div key={p.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "12px 16px", borderRadius: "10px",
                    background: "var(--surface-2, #1A1A1A)",
                    border: "1px solid var(--border-color, rgba(255, 255, 255, 0.06))",
                  }}>
                    <div>
                      <div style={{ fontWeight: 500, color: "var(--text-primary)", fontSize: "0.9rem" }}>
                        {[p.nombre, p.apellido].filter(Boolean).join(" ") || p.email}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{p.email}</div>
                    </div>
                    <button
                      onClick={() => handleInvitarPostulante(p.id)}
                      style={{
                        padding: "6px 14px", borderRadius: "6px",
                        border: "none", background: "#00CED1", color: "#000",
                        fontWeight: 600, fontSize: "0.8rem", cursor: "pointer",
                      }}
                    >
                      Invitar
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Puntuar Modal */}
      {showPuntuarModal && puntuarTarget && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "24px", background: "rgba(0, 0, 0, 0.85)", backdropFilter: "blur(20px)",
        }} onClick={() => setShowPuntuarModal(false)}>
          <div style={{
            width: "min(600px, 96vw)", maxHeight: "88vh", overflow: "auto",
            borderRadius: "20px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            background: "linear-gradient(180deg, #1A1A1A 0%, #141414 100%)",
            padding: "28px",
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 4px", color: "#FFF", fontSize: "1.1rem" }}>Encuadre Cruzado</h3>
            <p style={{ margin: "0 0 20px", color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Puntuando a: {[puntuarTarget.nombre, puntuarTarget.apellido].filter(Boolean).join(" ") || puntuarTarget.email}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {CRITERIOS.map((criterio) => (
                <div key={criterio}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <label style={{ fontSize: "0.9rem", color: "var(--text-primary)", textTransform: "capitalize", fontWeight: 500 }}>
                      {criterio}
                    </label>
                    <span style={{ fontSize: "0.9rem", color: "#00CED1", fontWeight: 700 }}>
                      {scores[criterio] || 5}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={scores[criterio] || 5}
                    onChange={(e) => setScores({ ...scores, [criterio]: parseInt(e.target.value) })}
                    style={{ width: "100%", accentColor: "#00CED1" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--text-muted)" }}>
                    <span>1</span>
                    <span>10</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "24px" }}>
              <button
                onClick={() => setShowPuntuarModal(false)}
                style={{
                  padding: "10px 20px", borderRadius: "8px",
                  border: "1px solid var(--border-color, rgba(255, 255, 255, 0.1))",
                  background: "transparent", color: "var(--text-primary)", cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarPuntuacion}
                disabled={submitting}
                style={{
                  padding: "10px 20px", borderRadius: "8px",
                  border: "none", background: "#00CED1", color: "#000",
                  fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? "Guardando..." : "Guardar Puntuación"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Convertir Modal */}
      {showConvertirModal && convertirTarget && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "24px", background: "rgba(0, 0, 0, 0.85)", backdropFilter: "blur(20px)",
        }} onClick={() => setShowConvertirModal(false)}>
          <div style={{
            width: "min(500px, 96vw)", borderRadius: "20px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            background: "linear-gradient(180deg, #1A1A1A 0%, #141414 100%)",
            padding: "28px",
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 4px", color: "#FFF", fontSize: "1.1rem" }}>Seleccionar como Miembro</h3>
            <p style={{ margin: "0 0 20px", color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Convirtiendo a: {[convertirTarget.nombre, convertirTarget.apellido].filter(Boolean).join(" ") || convertirTarget.email}
            </p>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "6px" }}>Puesto *</label>
              <input
                type="text"
                value={convertirForm.puesto}
                onChange={(e) => setConvertirForm({ ...convertirForm, puesto: e.target.value })}
                placeholder="Ej: Diseñador, Desarrollador..."
                style={{
                  width: "100%", padding: "10px", borderRadius: "8px",
                  border: "1px solid var(--border-color, rgba(255, 255, 255, 0.1))",
                  background: "var(--surface-2, #1A1A1A)",
                  color: "var(--text-primary)", fontSize: "0.9rem",
                }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "6px" }}>Descripción</label>
              <textarea
                value={convertirForm.descripcion}
                onChange={(e) => setConvertirForm({ ...convertirForm, descripcion: e.target.value })}
                rows={3}
                style={{
                  width: "100%", padding: "10px", borderRadius: "8px",
                  border: "1px solid var(--border-color, rgba(255, 255, 255, 0.1))",
                  background: "var(--surface-2, #1A1A1A)",
                  color: "var(--text-primary)", fontSize: "0.9rem",
                  resize: "vertical", fontFamily: "inherit",
                }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "6px" }}>Costo por hora</label>
              <input
                type="number"
                min={0}
                value={convertirForm.costo}
                onChange={(e) => setConvertirForm({ ...convertirForm, costo: parseInt(e.target.value) || 0 })}
                style={{
                  width: "100%", padding: "10px", borderRadius: "8px",
                  border: "1px solid var(--border-color, rgba(255, 255, 255, 0.1))",
                  background: "var(--surface-2, #1A1A1A)",
                  color: "var(--text-primary)", fontSize: "0.9rem",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowConvertirModal(false)}
                style={{
                  padding: "10px 20px", borderRadius: "8px",
                  border: "1px solid var(--border-color, rgba(255, 255, 255, 0.1))",
                  background: "transparent", color: "var(--text-primary)", cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConvertir}
                disabled={!convertirForm.puesto || submitting}
                style={{
                  padding: "10px 20px", borderRadius: "8px", border: "none",
                  background: !convertirForm.puesto || submitting ? "rgba(139, 92, 246, 0.3)" : "#8b5cf6",
                  color: "#FFF", fontWeight: 600,
                  cursor: !convertirForm.puesto || submitting ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? "Convirtiendo..." : "Convertir a Miembro"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
