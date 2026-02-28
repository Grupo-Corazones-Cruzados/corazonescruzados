"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Spinner from "@/components/ui/Spinner";
import styles from "./page.module.css";

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
  const { toast } = useToast();
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
        toast("Cuenta creada. Revisa tu correo para verificar.", "success");
        setTab("login");
      } else {
        await resetPassword(email);
        toast(
          "Si el correo existe, recibirás un enlace para restablecer tu contraseña.",
          "info"
        );
      }
    } catch (err) {
      toast(
        err instanceof Error ? err.message : "Ocurrió un error",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <Link href="/" className={styles.logo}>
        <img src="/LogoCC.png" alt="CC" className={styles.logoImg} />
      </Link>

      <Card padding="lg" className={styles.card}>
        <h1 className={styles.title}>
          {tab === "login" && "Iniciar sesión"}
          {tab === "register" && "Crear cuenta"}
          {tab === "reset" && "Restablecer contraseña"}
        </h1>
        <p className={styles.subtitle}>
          {tab === "login" && "Ingresa a tu cuenta de Corazones Cruzados"}
          {tab === "register" && "Crea una cuenta para comenzar"}
          {tab === "reset" && "Te enviaremos un enlace por correo"}
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {tab === "register" && (
            <div className={styles.nameRow}>
              <Input
                label="Nombre"
                name="first_name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Juan"
              />
              <Input
                label="Apellido"
                name="last_name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Pérez"
              />
            </div>
          )}

          <Input
            label="Correo electrónico"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
          />

          {tab !== "reset" && (
            <Input
              label="Contraseña"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
              minLength={8}
            />
          )}

          <Button type="submit" isLoading={loading} style={{ width: "100%" }}>
            {tab === "login" && "Iniciar sesión"}
            {tab === "register" && "Crear cuenta"}
            {tab === "reset" && "Enviar enlace"}
          </Button>
        </form>

        <div className={styles.footer}>
          {tab === "login" && (
            <>
              <button
                className={styles.textBtn}
                onClick={() => setTab("reset")}
              >
                ¿Olvidaste tu contraseña?
              </button>
              <p className={styles.switchText}>
                ¿No tienes cuenta?{" "}
                <button
                  className={styles.textBtn}
                  onClick={() => setTab("register")}
                >
                  Regístrate
                </button>
              </p>
            </>
          )}
          {tab === "register" && (
            <p className={styles.switchText}>
              ¿Ya tienes cuenta?{" "}
              <button
                className={styles.textBtn}
                onClick={() => setTab("login")}
              >
                Inicia sesión
              </button>
            </p>
          )}
          {tab === "reset" && (
            <p className={styles.switchText}>
              <button
                className={styles.textBtn}
                onClick={() => setTab("login")}
              >
                Volver a iniciar sesión
              </button>
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: "flex", justifyContent: "center", padding: "var(--space-20)" }}>
          <Spinner size="lg" />
        </div>
      }
    >
      <AuthForm />
    </Suspense>
  );
}
