"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { XCircle } from "lucide-react";
import { PANEL_AUTH, TITULO_AUTH, TEXTO_AUTH, CAMPO_AUTH, ERROR_AUTH } from "@/components/landing/authEstilos";

/**
 * RESTABLECER LA CONTRASEÑA — la página del enlace del correo «¿olvidaste tu contraseña?». Con
 * el aspecto del diálogo de acceso (ver `app/(auth)/layout.tsx`): campos sin etiqueta, el
 * marcador hace de rótulo, y el botón primario a todo el ancho.
 */
function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <div style={PANEL_AUTH}>
        <h1 style={TITULO_AUTH} className="flex items-center gap-2">
          <XCircle className="w-5 h-5 text-red-400 shrink-0" /> Enlace no válido
        </h1>
        <p style={TEXTO_AUTH}>Este enlace no trae el código para cambiar la contraseña. Pide uno nuevo desde «¿Olvidaste tu contraseña?».</p>
        <a href="/auth" className="pixel-btn pixel-btn-primary w-full flex items-center justify-center">Ir a iniciar sesión</a>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
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
      toast.success("Contraseña actualizada. Ya puedes iniciar sesión.");
      router.push("/auth");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cambiar la contraseña.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={PANEL_AUTH}>
      <h1 style={TITULO_AUTH}>Nueva contraseña</h1>
      <p style={TEXTO_AUTH}>Escribe la contraseña con la que entrarás desde ahora.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        <input
          type="password" required minLength={8} autoComplete="new-password" autoFocus
          value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Nueva contraseña (mín. 8)" aria-label="Nueva contraseña"
          style={CAMPO_AUTH}
        />
        <input
          type="password" required minLength={8} autoComplete="new-password"
          value={confirm} onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repite la contraseña" aria-label="Repite la contraseña"
          style={CAMPO_AUTH}
        />
        {error && <div role="alert" style={ERROR_AUTH}>{error}</div>}
        <button type="submit" disabled={loading} className="pixel-btn pixel-btn-primary w-full" style={{ marginTop: 4, opacity: loading ? 0.6 : 1 }}>
          {loading ? "Guardando…" : "Cambiar contraseña"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={PANEL_AUTH} />}>
      <ResetForm />
    </Suspense>
  );
}
