"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import BrandLoader from "@/components/ui/BrandLoader";

function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token");
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const pixelFont = { fontFamily: "'Silkscreen', cursive" } as const;

  if (!token) {
    return (
      <div className="pixel-card text-center">
        <div className="text-4xl mb-4 text-red-400" style={pixelFont}>ERR</div>
        <h2 className="pixel-heading text-base text-white mb-2">
          Enlace Invalido
        </h2>
        <p className="text-xs opacity-50 mb-6" style={{ ...pixelFont, color: "#94A3B8" }}>
          Este enlace no contiene un token valido.
        </p>
        <Link href="/auth">
          <button className="pixel-btn pixel-btn-primary">
            Volver al Inicio
          </button>
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Las contraseñas no coinciden");
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
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pixel-card">
      <h2 className="pixel-heading text-base text-white text-center mb-1">
        Nueva Contrasena
      </h2>
      <p
        className="text-center text-xs mb-6 opacity-50"
        style={{ ...pixelFont, color: "#94A3B8" }}
      >
        Ingresa tu nueva contrasena
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label
            className="text-[10px] text-accent-glow opacity-70"
            style={pixelFont}
          >
            Nueva contrasena
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimo 8 caracteres"
            className="w-full px-3 py-2.5 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none transition-colors"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            className="text-[10px] text-accent-glow opacity-70"
            style={pixelFont}
          >
            Confirmar contrasena
          </label>
          <input
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repite la contrasena"
            className="w-full px-3 py-2.5 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none transition-colors"
            style={{ fontFamily: "'JetBrains Mono', monospace" }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="pixel-btn pixel-btn-primary w-full mt-2 disabled:opacity-50"
        >
          {loading ? "Cargando..." : "Actualizar Contrasena"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <BrandLoader size="lg" />
        </div>
      }
    >
      <ResetForm />
    </Suspense>
  );
}
