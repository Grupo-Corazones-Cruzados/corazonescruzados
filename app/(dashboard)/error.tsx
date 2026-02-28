"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "5rem 2rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          background: "var(--error-bg, #FEE2E2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "20px",
          color: "var(--error, #FF3B30)",
          fontWeight: 700,
          marginBottom: "16px",
        }}
      >
        !
      </div>
      <h2
        style={{
          fontSize: "18px",
          fontWeight: 600,
          color: "var(--text-primary)",
          margin: "0 0 8px",
        }}
      >
        Error en el panel
      </h2>
      <p
        style={{
          fontSize: "14px",
          color: "var(--text-secondary)",
          margin: "0 0 24px",
          maxWidth: "360px",
        }}
      >
        Hubo un problema al cargar esta sección. Puedes intentar de nuevo.
      </p>
      <div style={{ display: "flex", gap: "12px" }}>
        <button
          onClick={reset}
          style={{
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            padding: "10px 24px",
            borderRadius: "9999px",
            fontWeight: 600,
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
        <a
          href="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
            padding: "10px 24px",
            borderRadius: "9999px",
            fontWeight: 600,
            fontSize: "14px",
            textDecoration: "none",
          }}
        >
          Ir al Dashboard
        </a>
      </div>
    </div>
  );
}
