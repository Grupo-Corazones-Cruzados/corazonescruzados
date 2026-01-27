export default function BlockedPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--background, #0a0a0a)",
        color: "var(--text-primary, #fff)",
        padding: "2rem",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: "480px" }}>
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: "rgba(239, 68, 68, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.5rem",
            fontSize: "2rem",
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" x2="19.07" y1="4.93" y2="19.07" />
          </svg>
        </div>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "1rem" }}>
          Acceso Bloqueado
        </h1>
        <p style={{ color: "var(--text-muted, #999)", lineHeight: 1.6, marginBottom: "2rem" }}>
          Tu acceso ha sido restringido. Si crees que esto es un error, por favor contacta al administrador.
        </p>
        <a
          href="mailto:admin@corazonescruzados.com"
          style={{
            display: "inline-block",
            padding: "0.75rem 1.5rem",
            background: "rgba(239, 68, 68, 0.15)",
            color: "#ef4444",
            borderRadius: "8px",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          Contactar Administrador
        </a>
      </div>
    </div>
  );
}
