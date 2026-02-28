"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import Button from "@/components/ui/Button";
import Link from "next/link";

function VerifyContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Token no proporcionado.");
      return;
    }

    fetch(`/api/auth/verify?token=${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setStatus("success");
          setMessage(data.message);
          setTimeout(() => router.push("/dashboard"), 2000);
        } else {
          setStatus("error");
          setMessage(data.error);
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Error de conexión.");
      });
  }, [token, router]);

  return (
    <Card padding="lg" style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
      {status === "loading" && (
        <>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "var(--space-4)" }}>
            <Spinner size="lg" />
          </div>
          <p style={{ color: "var(--text-secondary)" }}>Verificando tu cuenta...</p>
        </>
      )}
      {status === "success" && (
        <>
          <div style={{ fontSize: 48, marginBottom: "var(--space-4)" }}>&#10003;</div>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600, marginBottom: "var(--space-2)" }}>
            Cuenta verificada
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>{message}</p>
          <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-xs)", marginTop: "var(--space-4)" }}>
            Redirigiendo al dashboard...
          </p>
        </>
      )}
      {status === "error" && (
        <>
          <div style={{ fontSize: 48, marginBottom: "var(--space-4)" }}>&#10007;</div>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600, marginBottom: "var(--space-2)" }}>
            Error de verificación
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", marginBottom: "var(--space-6)" }}>
            {message}
          </p>
          <Link href="/auth">
            <Button>Volver al inicio</Button>
          </Link>
        </>
      )}
    </Card>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-20)" }}>
          <Spinner size="lg" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
