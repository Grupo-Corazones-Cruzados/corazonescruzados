"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import Link from "next/link";

function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const router = useRouter();
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  if (!token) {
    return (
      <Card padding="lg" style={{ maxWidth: 420, width: "100%", textAlign: "center" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600, marginBottom: "var(--space-4)" }}>
          Enlace inválido
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", marginBottom: "var(--space-6)" }}>
          Este enlace no contiene un token válido.
        </p>
        <Link href="/auth">
          <Button>Volver al inicio</Button>
        </Link>
      </Card>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast("Las contraseñas no coinciden", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast("Contraseña actualizada. Ya puedes iniciar sesión.", "success");
      router.push("/auth");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card padding="lg" style={{ maxWidth: 420, width: "100%" }}>
      <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600, textAlign: "center" }}>
        Nueva contraseña
      </h2>
      <p style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)", textAlign: "center", marginTop: "var(--space-2)" }}>
        Ingresa tu nueva contraseña
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", marginTop: "var(--space-6)" }}>
        <Input
          label="Nueva contraseña"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mínimo 8 caracteres"
        />
        <Input
          label="Confirmar contraseña"
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repite la contraseña"
        />
        <Button type="submit" isLoading={loading} style={{ width: "100%" }}>
          Actualizar contraseña
        </Button>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-20)" }}>
          <Spinner size="lg" />
        </div>
      }
    >
      <ResetForm />
    </Suspense>
  );
}
