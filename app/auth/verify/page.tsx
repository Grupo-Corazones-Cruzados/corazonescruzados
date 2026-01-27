"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Token de verificación no encontrado");
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch(`/api/auth/verify?token=${token}`);
        const data = await response.json();

        if (response.ok && data.success) {
          setStatus("success");
          setMessage(data.message || "Cuenta verificada correctamente");
        } else {
          setStatus("error");
          setMessage(data.error || "Error al verificar la cuenta");
        }
      } catch {
        setStatus("error");
        setMessage("Error de conexión. Intenta de nuevo.");
      }
    };

    verifyEmail();
  }, [token]);

  // Countdown and auto-close on success
  useEffect(() => {
    if (status !== "success") return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          window.close();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
      padding: "20px",
    }}>
      <div style={{
        background: "#ffffff",
        borderRadius: "16px",
        padding: "40px",
        maxWidth: "400px",
        width: "100%",
        textAlign: "center",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        {status === "loading" && (
          <>
            <div style={{
              width: "60px",
              height: "60px",
              border: "4px solid #e5e7eb",
              borderTopColor: "#dc2626",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 20px",
            }} />
            <h1 style={{ color: "#1f2937", fontSize: "1.5rem", marginBottom: "10px" }}>
              Verificando...
            </h1>
            <p style={{ color: "#6b7280" }}>
              Por favor espera mientras verificamos tu cuenta
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div style={{
              width: "60px",
              height: "60px",
              background: "#dcfce7",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h1 style={{ color: "#16a34a", fontSize: "1.5rem", marginBottom: "10px" }}>
              Cuenta verificada
            </h1>
            <p style={{ color: "#6b7280", marginBottom: "20px" }}>
              {message}
            </p>
            <p style={{ color: "#9ca3af", fontSize: "0.875rem" }}>
              Ya puedes cerrar esta pagina.
            </p>
            <p style={{ color: "#d1d5db", fontSize: "0.8rem", marginTop: "8px" }}>
              Se cerrara automaticamente en {countdown}s
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div style={{
              width: "60px",
              height: "60px",
              background: "#fee2e2",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h1 style={{ color: "#dc2626", fontSize: "1.5rem", marginBottom: "10px" }}>
              Error de verificación
            </h1>
            <p style={{ color: "#6b7280", marginBottom: "20px" }}>
              {message}
            </p>
            <Link href="/auth" style={{
              display: "inline-block",
              background: "#dc2626",
              color: "#ffffff",
              padding: "12px 24px",
              borderRadius: "8px",
              textDecoration: "none",
              fontWeight: "600",
            }}>
              Volver al inicio
            </Link>
          </>
        )}

        <style jsx global>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}
