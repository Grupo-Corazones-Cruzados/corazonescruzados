import Link from "next/link";

export default function DashboardNotFound() {
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
      <p
        style={{
          fontSize: "64px",
          fontWeight: 700,
          color: "var(--accent)",
          margin: 0,
          lineHeight: 1,
        }}
      >
        404
      </p>
      <h1
        style={{
          fontSize: "20px",
          fontWeight: 600,
          color: "var(--text-primary)",
          margin: "12px 0 8px",
        }}
      >
        Página no encontrada
      </h1>
      <p
        style={{
          fontSize: "14px",
          color: "var(--text-secondary)",
          margin: "0 0 24px",
        }}
      >
        Esta sección no existe o no tienes acceso.
      </p>
      <Link
        href="/dashboard"
        style={{
          display: "inline-block",
          background: "var(--accent)",
          color: "#fff",
          textDecoration: "none",
          padding: "10px 28px",
          borderRadius: "9999px",
          fontWeight: 600,
          fontSize: "14px",
        }}
      >
        Ir al Dashboard
      </Link>
    </div>
  );
}
