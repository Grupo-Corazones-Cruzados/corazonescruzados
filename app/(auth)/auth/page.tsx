"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { startAuthentication } from "@simplewebauthn/browser";
import { toast } from "sonner";
import Link from "next/link";
import BrandLoader from "@/components/ui/BrandLoader";

function AuthForm() {
  const params = useSearchParams();
  const redirect = params.get("redirect") || "/dashboard";

  const [tab, setTab] = useState<"login" | "reset">("login");
  const [loading, setLoading] = useState(false);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { signIn, resetPassword, refreshUser } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (tab === "login") {
        await signIn(email, password);
        router.push(redirect);
      } else {
        await resetPassword(email);
        toast.info(
          "Si el correo existe, recibirás un enlace para restablecer tu contraseña."
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ocurrió un error");
    } finally {
      setLoading(false);
    }
  };

  const handlePasskey = async () => {
    // El correo es opcional: si está vacío el servidor resuelve por
    // cookie/IP (igual que el passkey del juego).
    setPasskeyBusy(true);
    try {
      const begin = await fetch("/api/auth/passkey/begin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const opts = await begin.json();
      if (!begin.ok) {
        toast.error(opts?.error ?? "No se pudo iniciar passkey");
        return;
      }

      const credential = await startAuthentication({ optionsJSON: opts });

      const finish = await fetch("/api/auth/passkey/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, credential }),
      });
      const fJson = await finish.json();
      if (!finish.ok) {
        toast.error(fJson?.error ?? "Passkey rechazada");
        return;
      }

      await refreshUser();
      router.push(redirect);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Error de passkey";
      // El usuario canceló el prompt → ignorar en silencio.
      if (!/cancel|abort|timeout|allowed/i.test(msg)) {
        toast.error(msg);
      }
    } finally {
      setPasskeyBusy(false);
    }
  };

  const pixelFont = { fontFamily: "'Silkscreen', cursive" } as const;
  const busy = loading || passkeyBusy;

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Logo / Brand */}
      <Link href="/" className="group">
        <BrandLoader size="md" label="GCC WORLD" />
      </Link>

      {/* Auth Card */}
      <div className="pixel-card w-full">
        <h1 className="pixel-heading text-lg text-white text-center mb-1">
          {tab === "login" ? "Iniciar Sesion" : "Restablecer"}
        </h1>
        <p
          className="text-center text-xs mb-6 opacity-50"
          style={{ ...pixelFont, color: "#94A3B8" }}
        >
          {tab === "login"
            ? "Ingresa a tu cuenta"
            : "Te enviaremos un enlace por correo"}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <PixelInput
            label="Correo electronico"
            name="email"
            type="email"
            required
            value={email}
            onChange={setEmail}
            placeholder="tu@correo.com"
          />

          {tab === "login" && (
            <PixelInput
              label="Contrasena"
              name="password"
              type="password"
              required
              value={password}
              onChange={setPassword}
              placeholder="Minimo 8 caracteres"
              minLength={8}
            />
          )}

          <button
            type="submit"
            disabled={busy}
            className="pixel-btn pixel-btn-primary w-full mt-2 disabled:opacity-50"
          >
            {loading
              ? "Cargando..."
              : tab === "login"
                ? "Iniciar Sesion"
                : "Enviar Enlace"}
          </button>
        </form>

        {tab === "login" && (
          <>
            <div className="flex items-center gap-3 my-4">
              <span className="flex-1 h-px bg-digi-border" />
              <span
                className="text-[9px] opacity-40"
                style={{ ...pixelFont, color: "#94A3B8" }}
              >
                o
              </span>
              <span className="flex-1 h-px bg-digi-border" />
            </div>
            <button
              type="button"
              onClick={handlePasskey}
              disabled={busy}
              className="pixel-btn pixel-btn-primary w-full"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: busy ? 0.6 : 1,
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="square"
                aria-hidden="true"
              >
                <path d="M12 2a5 5 0 0 1 5 5v3" />
                <path d="M12 2a5 5 0 0 0-5 5v3" />
                <rect x="5" y="10" width="14" height="11" rx="1" />
                <path d="M12 14v4" />
              </svg>
              {passkeyBusy ? "Autenticando..." : "Usar passkey"}
            </button>
          </>
        )}

        <div className="mt-5 text-center space-y-2">
          {tab === "login" ? (
            <button
              className="text-[10px] text-accent-glow opacity-60 hover:opacity-100 transition-opacity"
              style={pixelFont}
              onClick={() => setTab("reset")}
            >
              Olvidaste tu contrasena?
            </button>
          ) : (
            <button
              className="text-[10px] text-accent-glow opacity-60 hover:opacity-100 transition-opacity"
              style={pixelFont}
              onClick={() => setTab("login")}
            >
              Volver a iniciar sesion
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PixelInput({
  label,
  name,
  type = "text",
  required,
  value,
  onChange,
  placeholder,
  minLength,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minLength?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={name}
        className="text-[10px] text-accent-glow opacity-70"
        style={{ fontFamily: "'Silkscreen', cursive" }}
      >
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        minLength={minLength}
        className="w-full px-3 py-2.5 bg-digi-darker border-2 border-digi-border text-sm text-digi-text placeholder:text-digi-muted/50 focus:border-accent focus:outline-none transition-colors"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      />
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <BrandLoader size="lg" />
        </div>
      }
    >
      <AuthForm />
    </Suspense>
  );
}
