"use client";

import React from "react";
import Link from "next/link";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import { getIcono } from "@/lib/icons";
import styles from "@/app/styles/Tickets.module.css";

const secciones = [
  {
    id: "encuadre",
    nombre: "Encuadre del Sujeto",
    descripcion: "Define y gestiona el perfil, requisitos y criterios de evaluación para los candidatos.",
    ruta: "/dashboard/proyecto/reclutamiento/encuadre",
    icono: "clipboard",
  },
];

export default function ReclutamientoPage() {
  return (
    <DashboardLayout>
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Reclutamiento y Selección</h1>
            <p className={styles.pageSubtitle}>
              Gestiona el proceso de reclutamiento y selección de nuevos miembros
            </p>
          </div>
        </div>

        {/* Secciones Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "20px",
          marginTop: "24px",
        }}>
          {secciones.map((seccion) => (
            <Link
              key={seccion.id}
              href={seccion.ruta}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                padding: "24px",
                borderRadius: "16px",
                border: "1px solid var(--border-color, rgba(255, 255, 255, 0.06))",
                background: "var(--surface-1, #141414)",
                textDecoration: "none",
                color: "inherit",
                transition: "transform 200ms ease, border-color 200ms ease, box-shadow 200ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.borderColor = "rgba(0, 206, 209, 0.3)";
                e.currentTarget.style.boxShadow = "0 12px 40px rgba(0, 0, 0, 0.4)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.borderColor = "var(--border-color, rgba(255, 255, 255, 0.06))";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{ color: "#00CED1" }}>
                {getIcono(seccion.icono, 48)}
              </div>
              <div>
                <h3 style={{
                  margin: 0,
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  color: "var(--text-primary, #FFFFFF)",
                }}>
                  {seccion.nombre}
                </h3>
                <p style={{
                  margin: "8px 0 0",
                  fontSize: "0.9rem",
                  color: "var(--text-secondary, #8A8A8A)",
                  lineHeight: 1.5,
                }}>
                  {seccion.descripcion}
                </p>
              </div>
              <span style={{
                marginTop: "auto",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "#00CED1",
              }}>
                Acceder →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
