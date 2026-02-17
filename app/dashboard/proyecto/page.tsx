"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { getIcono } from "@/lib/icons";
import styles from "@/app/styles/Tickets.module.css";

interface Paso {
  id: number;
  nombre: string;
  secuencia: number;
}

interface Piso {
  id: number;
  nombre: string;
  secuencia: number;
}

interface Sistema {
  id: number;
  nombre: string;
  id_paso: number | null;
  id_piso: number | null;
  descripcion: string | null;
  icono: string | null;
  ruta: string | null;
}

function SistemaCard({ sistema }: { sistema: Sistema }) {
  const content = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        padding: "20px",
        borderRadius: "14px",
        border: "1px solid var(--border-color, rgba(255, 255, 255, 0.06))",
        background: "var(--surface-1, #141414)",
        textDecoration: "none",
        color: "inherit",
        transition: "transform 200ms ease, border-color 200ms ease, box-shadow 200ms ease",
        cursor: sistema.ruta ? "pointer" : "default",
        height: "100%",
      }}
      onMouseEnter={(e) => {
        if (sistema.ruta) {
          e.currentTarget.style.transform = "translateY(-4px)";
          e.currentTarget.style.borderColor = "rgba(0, 206, 209, 0.3)";
          e.currentTarget.style.boxShadow = "0 12px 40px rgba(0, 0, 0, 0.4)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = "var(--border-color, rgba(255, 255, 255, 0.06))";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{ color: "#00CED1" }}>
        {getIcono(sistema.icono || "layers", 48)}
      </div>
      <div>
        <h3 style={{
          margin: 0,
          fontSize: "1.05rem",
          fontWeight: 700,
          color: "var(--text-primary, #FFFFFF)",
        }}>
          {sistema.nombre}
        </h3>
        {sistema.descripcion && (
          <p style={{
            margin: "6px 0 0",
            fontSize: "0.85rem",
            color: "var(--text-secondary, #8A8A8A)",
            lineHeight: 1.5,
          }}>
            {sistema.descripcion}
          </p>
        )}
      </div>
      {sistema.ruta && (
        <span style={{
          marginTop: "auto",
          fontSize: "0.85rem",
          fontWeight: 600,
          color: "#00CED1",
        }}>
          Acceder →
        </span>
      )}
    </div>
  );

  if (sistema.ruta) {
    return (
      <Link href={sistema.ruta} style={{ textDecoration: "none", color: "inherit" }}>
        {content}
      </Link>
    );
  }

  return content;
}

function EmptyCell() {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      minHeight: "120px",
      borderRadius: "14px",
      border: "1px dashed var(--border-color, rgba(255, 255, 255, 0.06))",
      color: "var(--text-secondary, #8A8A8A)",
      fontSize: "1.2rem",
      opacity: 0.4,
    }}>
      —
    </div>
  );
}

export default function ProyectoCentralizadoPage() {
  const [pasos, setPasos] = useState<Paso[]>([]);
  const [pisos, setPisos] = useState<Piso[]>([]);
  const [sistemas, setSistemas] = useState<Sistema[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/proyecto/sistemas");
        if (!response.ok) throw new Error("Error al cargar datos");
        const data = await response.json();
        setPasos(data.pasos || []);
        setPisos(data.pisos || []);
        setSistemas(data.sistemas || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  // Build lookup: "pisoId-pasoId" → Sistema
  const sistemaMap = new Map<string, Sistema>();
  for (const s of sistemas) {
    if (s.id_piso != null && s.id_paso != null) {
      sistemaMap.set(`${s.id_piso}-${s.id_paso}`, s);
    }
  }

  return (
    <DashboardLayout>
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Proyecto Centralizado</h1>
            <p className={styles.pageSubtitle}>
              Visualiza los sistemas organizados por pisos y pasos
            </p>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p>Cargando sistemas...</p>
          </div>
        ) : error ? (
          <div className={styles.emptyState}>
            <p>{error}</p>
          </div>
        ) : pasos.length === 0 || pisos.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No hay pasos o pisos configurados.</p>
          </div>
        ) : (
          <div style={{ marginTop: "24px", overflowX: "auto" }}>
            <table style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: "8px",
            }}>
              <thead>
                <tr>
                  <th style={{
                    padding: "12px 16px",
                    textAlign: "left",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "var(--text-secondary, #8A8A8A)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    minWidth: "120px",
                  }}>
                    Piso / Paso
                  </th>
                  {pasos.map((paso) => (
                    <th key={paso.id} style={{
                      padding: "12px 16px",
                      textAlign: "center",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      color: "#00CED1",
                      minWidth: "200px",
                    }}>
                      {paso.nombre}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pisos.map((piso) => (
                  <tr key={piso.id}>
                    <td style={{
                      padding: "12px 16px",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      color: "var(--text-primary, #FFFFFF)",
                      verticalAlign: "top",
                      whiteSpace: "nowrap",
                    }}>
                      {piso.nombre}
                    </td>
                    {pasos.map((paso) => {
                      const sistema = sistemaMap.get(`${piso.id}-${paso.id}`);
                      return (
                        <td key={paso.id} style={{
                          padding: "4px",
                          verticalAlign: "top",
                        }}>
                          {sistema ? (
                            <SistemaCard sistema={sistema} />
                          ) : (
                            <EmptyCell />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
