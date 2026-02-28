"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', sans-serif",
        background: "var(--bg-secondary, #F9FAFB)",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "var(--error-bg, #FEE2E2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "24px",
          marginBottom: "20px",
        }}
      >
        !
      </div>
      <h1
        style={{
          fontSize: "22px",
          fontWeight: 600,
          color: "var(--text-primary, #111827)",
          margin: "0 0 8px",
        }}
      >
        Algo salió mal
      </h1>
      <p
        style={{
          fontSize: "15px",
          color: "var(--text-secondary, #6B7280)",
          maxWidth: "400px",
          lineHeight: 1.6,
          margin: "0 0 28px",
        }}
      >
        Ocurrió un error inesperado. Puedes intentar de nuevo o volver al inicio.
      </p>
      <div style={{ display: "flex", gap: "12px" }}>
        <button
          onClick={reset}
          style={{
            background: "var(--accent, #0071E3)",
            color: "#fff",
            border: "none",
            padding: "12px 28px",
            borderRadius: "9999px",
            fontWeight: 600,
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          Intentar de nuevo
        </button>
        <a
          href="/"
          style={{
            background: "transparent",
            color: "var(--text-primary, #111827)",
            border: "1px solid var(--border, #E5E7EB)",
            padding: "12px 28px",
            borderRadius: "9999px",
            fontWeight: 600,
            fontSize: "14px",
            textDecoration: "none",
          }}
        >
          Ir al inicio
        </a>
      </div>
    </div>
  );
}
