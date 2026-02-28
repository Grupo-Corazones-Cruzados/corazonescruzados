import Link from "next/link";

export default function NotFound() {
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
      <p
        style={{
          fontSize: "80px",
          fontWeight: 700,
          color: "var(--accent, #0071E3)",
          margin: 0,
          lineHeight: 1,
        }}
      >
        404
      </p>
      <h1
        style={{
          fontSize: "24px",
          fontWeight: 600,
          color: "var(--text-primary, #111827)",
          margin: "16px 0 8px",
        }}
      >
        Página no encontrada
      </h1>
      <p
        style={{
          fontSize: "15px",
          color: "var(--text-secondary, #6B7280)",
          maxWidth: "400px",
          lineHeight: 1.6,
          margin: "0 0 32px",
        }}
      >
        La página que buscas no existe o fue movida.
      </p>
      <Link
        href="/"
        style={{
          display: "inline-block",
          background: "var(--accent, #0071E3)",
          color: "#fff",
          textDecoration: "none",
          padding: "12px 32px",
          borderRadius: "9999px",
          fontWeight: 600,
          fontSize: "15px",
        }}
      >
        Volver al inicio
      </Link>
    </div>
  );
}
