"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { toast } from "sonner";
import BrandLoader from "@/components/ui/BrandLoader";

function AuthForm() {
  const params = useSearchParams();
  const initialTab = params.get("tab") === "register" ? "register" : "login";
  const redirect = params.get("redirect") || "/dashboard";

  const [tab, setTab] = useState<"login" | "register" | "reset">(initialTab);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const { signIn, signUp, resetPassword } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (tab === "login") {
        await signIn(email, password);
        router.push(redirect);
      } else if (tab === "register") {
        await signUp(email, password, {
          first_name: firstName || undefined,
          last_name: lastName || undefined,
        });
        toast.success("Cuenta creada. Revisa tu correo para verificar.");
        setTab("login");
      } else {
        await resetPassword(email);
        toast.info(
          "Si el correo existe, recibirás un enlace para restablecer tu contraseña."
        );
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Ocurrió un error"
      );
    } finally {
      setLoading(false);
    }
  };

  const pixelFont = { fontFamily: "'Silkscreen', cursive" } as const;

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Logo / Brand */}
      <Link href="/" className="group">
        <BrandLoader size="md" label="GCC WORLD" />
      </Link>

      {/* Auth Card */}
      <div className="pixel-card w-full">
        <h1
          className="pixel-heading text-lg text-white text-center mb-1"
        >
          {tab === "login" && "Iniciar Sesion"}
          {tab === "register" && "Crear Cuenta"}
          {tab === "reset" && "Restablecer"}
        </h1>
        <p
          className="text-center text-xs mb-6 opacity-50"
          style={{ ...pixelFont, color: "#94A3B8" }}
        >
          {tab === "login" && "Ingresa a tu cuenta"}
          {tab === "register" && "Crea una cuenta para comenzar"}
          {tab === "reset" && "Te enviaremos un enlace por correo"}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {tab === "register" && (
            <div className="grid grid-cols-2 gap-3">
              <PixelInput
                label="Nombre"
                name="first_name"
                value={firstName}
                onChange={setFirstName}
                placeholder="Juan"
              />
              <PixelInput
                label="Apellido"
                name="last_name"
                value={lastName}
                onChange={setLastName}
                placeholder="Perez"
              />
            </div>
          )}

          <PixelInput
            label="Correo electronico"
            name="email"
            type="email"
            required
            value={email}
            onChange={setEmail}
            placeholder="tu@correo.com"
          />

          {tab !== "reset" && (
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
            disabled={loading}
            className="pixel-btn pixel-btn-primary w-full mt-2 disabled:opacity-50"
          >
            {loading ? "Cargando..." : (
              <>
                {tab === "login" && "Iniciar Sesion"}
                {tab === "register" && "Crear Cuenta"}
                {tab === "reset" && "Enviar Enlace"}
              </>
            )}
          </button>
        </form>

        <div className="mt-5 text-center space-y-2">
          {tab === "login" && (
            <>
              <button
                className="text-[10px] text-accent-glow opacity-60 hover:opacity-100 transition-opacity"
                style={pixelFont}
                onClick={() => setTab("reset")}
              >
                Olvidaste tu contrasena?
              </button>
              <p className="text-[10px] opacity-40" style={{ ...pixelFont, color: "#94A3B8" }}>
                No tienes cuenta?{" "}
                <button
                  className="text-accent-glow opacity-80 hover:opacity-100"
                  onClick={() => setTab("register")}
                >
                  Registrate
                </button>
              </p>
            </>
          )}
          {tab === "register" && (
            <p className="text-[10px] opacity-40" style={{ ...pixelFont, color: "#94A3B8" }}>
              Ya tienes cuenta?{" "}
              <button
                className="text-accent-glow opacity-80 hover:opacity-100"
                onClick={() => setTab("login")}
              >
                Inicia sesion
              </button>
            </p>
          )}
          {tab === "reset" && (
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
