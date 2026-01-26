"use client";

import React from "react";
import Link from "next/link";
import DashboardLayout from "@/app/components/dashboard/DashboardLayout";
import styles from "@/app/styles/Tickets.module.css";

const UsersIcon = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const submodulos = [
  {
    id: "reclutamiento",
    nombre: "Reclutamiento y Selección",
    descripcion: "Gestiona el proceso de reclutamiento y selección de nuevos miembros.",
    ruta: "/dashboard/proyecto/reclutamiento",
    icono: <UsersIcon />,
  },
];

export default function ProyectoCentralizadoPage() {
  return (
    <DashboardLayout>
      <div className={styles.page}>
        {/* Header */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Proyecto Centralizado</h1>
            <p className={styles.pageSubtitle}>
              Accede a los diferentes módulos del proyecto
            </p>
          </div>
        </div>

        {/* Submódulos Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "20px",
          marginTop: "24px"
        }}>
          {submodulos.map((modulo) => (
            <Link
              key={modulo.id}
              href={modulo.ruta}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                padding: "24px",
                borderRadius: "16px",
                border: "1px solid rgba(255, 255, 255, 0.06)",
                background: "#141414",
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
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.06)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{ color: "#00CED1" }}>
                {modulo.icono}
              </div>
              <div>
                <h3 style={{
                  margin: 0,
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  color: "#FFFFFF"
                }}>
                  {modulo.nombre}
                </h3>
                <p style={{
                  margin: "8px 0 0",
                  fontSize: "0.9rem",
                  color: "#8A8A8A",
                  lineHeight: 1.5
                }}>
                  {modulo.descripcion}
                </p>
              </div>
              <span style={{
                marginTop: "auto",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "#00CED1"
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
