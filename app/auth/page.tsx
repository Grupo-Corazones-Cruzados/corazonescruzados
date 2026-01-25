"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import styles from "./Auth.module.css";

type AuthMode = "login" | "register" | "forgot";

export default function AuthPage() {
  const router = useRouter();
  const { signIn, signUp, resetPassword, isAuthenticated, loading: authLoading } = useAuth();

  const [mode, setMode] = useState<AuthMode>("login");
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    nombre: "",
    apellido: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Redirigir si ya está autenticado
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, authLoading, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (mode === "login") {
        const result = await signIn(formData.email, formData.password);
        if (!result.success) {
          setError(result.error || "Credenciales inválidas");
        }
      } else if (mode === "register") {
        if (formData.password !== formData.confirmPassword) {
          setError("Las contraseñas no coinciden");
          setLoading(false);
          return;
        }
        if (formData.password.length < 6) {
          setError("La contraseña debe tener al menos 6 caracteres");
          setLoading(false);
          return;
        }

        const result = await signUp(formData.email, formData.password, {
          nombre: formData.nombre,
          apellido: formData.apellido,
        });

        if (result.success) {
          // Redirigir al dashboard - el usuario verá los módulos bloqueados
          // hasta que confirme su email
          router.push("/dashboard");
        } else {
          setError(result.error || "Error al crear la cuenta");
        }
      } else if (mode === "forgot") {
        const result = await resetPassword(formData.email);
        if (result.success) {
          setSuccess("Se envió un enlace de recuperación a tu correo.");
        } else {
          setError(result.error || "Error al enviar el correo");
        }
      }
    } catch (err: any) {
      setError(err?.message || "Ocurrió un error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError("");
    setSuccess("");
  };

  if (authLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Background decorations */}
      <div className={styles.bgGlow} aria-hidden="true" />
      <div className={styles.bgPattern} aria-hidden="true" />

      <div className={styles.container}>
        {/* Left side - Branding */}
        <div className={styles.branding}>
          <div className={styles.brandingContent}>
            <img src="/LogoCC.png" alt="Corazones Cruzados" className={styles.logo} />
            <h1 className={styles.brandTitle}>Corazones Cruzados</h1>
            <p className={styles.brandSubtitle}>
              Conectamos talento con oportunidades. Únete a nuestra comunidad de profesionales.
            </p>

            <div className={styles.features}>
              <div className={styles.feature}>
                <div className={styles.featureIcon}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <h3>Profesionales verificados</h3>
                  <p>Trabaja con expertos en su área</p>
                </div>
              </div>

              <div className={styles.feature}>
                <div className={styles.featureIcon}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" strokeWidth="2"/>
                    <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <h3>Gestión de tickets</h3>
                  <p>Seguimiento completo de tus solicitudes</p>
                </div>
              </div>

              <div className={styles.feature}>
                <div className={styles.featureIcon}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20.84 4.61C20.3292 4.099 19.7228 3.69364 19.0554 3.41708C18.3879 3.14052 17.6725 2.99817 16.95 2.99817C16.2275 2.99817 15.5121 3.14052 14.8446 3.41708C14.1772 3.69364 13.5708 4.099 13.06 4.61L12 5.67L10.94 4.61C9.9083 3.57831 8.50903 2.99871 7.05 2.99871C5.59096 2.99871 4.19169 3.57831 3.16 4.61C2.1283 5.64169 1.54871 7.04097 1.54871 8.5C1.54871 9.95903 2.1283 11.3583 3.16 12.39L12 21.23L20.84 12.39C21.351 11.8792 21.7563 11.2728 22.0329 10.6054C22.3095 9.93789 22.4518 9.22249 22.4518 8.5C22.4518 7.77751 22.3095 7.0621 22.0329 6.39464C21.7563 5.72718 21.351 5.12075 20.84 4.61Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <h3>Comunidad activa</h3>
                  <p>Forma parte de algo más grande</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Form */}
        <div className={styles.formSection}>
          <div className={styles.formCard}>
            <div className={styles.formHeader}>
              <h2 className={styles.formTitle}>
                {mode === "login" && "Bienvenido de vuelta"}
                {mode === "register" && "Crea tu cuenta"}
                {mode === "forgot" && "Recuperar contraseña"}
              </h2>
              <p className={styles.formSubtitle}>
                {mode === "login" && "Ingresa tus credenciales para continuar"}
                {mode === "register" && "Completa el formulario para registrarte"}
                {mode === "forgot" && "Te enviaremos un enlace de recuperación"}
              </p>
            </div>

            {/* Tabs */}
            {mode !== "forgot" && (
              <div className={styles.tabs}>
                <button
                  type="button"
                  className={`${styles.tab} ${mode === "login" ? styles.tabActive : ""}`}
                  onClick={() => switchMode("login")}
                >
                  Iniciar sesión
                </button>
                <button
                  type="button"
                  className={`${styles.tab} ${mode === "register" ? styles.tabActive : ""}`}
                  onClick={() => switchMode("register")}
                >
                  Registrarse
                </button>
              </div>
            )}

            {/* Messages */}
            {error && (
              <div className={styles.alert} role="alert">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 8V12M12 16H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {error}
              </div>
            )}

            {success && (
              <div className={styles.alertSuccess} role="status">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.85999" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M22 4L12 14.01L9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {success}
              </div>
            )}

            {/* Form */}
            <form className={styles.form} onSubmit={handleSubmit}>
              {mode === "register" && (
                <div className={styles.formRow}>
                  <label className={styles.field}>
                    <span>Nombre</span>
                    <input
                      type="text"
                      name="nombre"
                      value={formData.nombre}
                      onChange={handleChange}
                      placeholder="Tu nombre"
                      required
                      autoComplete="given-name"
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Apellido</span>
                    <input
                      type="text"
                      name="apellido"
                      value={formData.apellido}
                      onChange={handleChange}
                      placeholder="Tu apellido"
                      required
                      autoComplete="family-name"
                    />
                  </label>
                </div>
              )}

              <label className={styles.field}>
                <span>Correo electrónico</span>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="tucorreo@ejemplo.com"
                  required
                  autoComplete="email"
                />
              </label>

              {mode !== "forgot" && (
                <label className={styles.field}>
                  <span>Contraseña</span>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                  />
                </label>
              )}

              {mode === "register" && (
                <label className={styles.field}>
                  <span>Confirmar contraseña</span>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                  />
                </label>
              )}

              {mode === "login" && (
                <div className={styles.formOptions}>
                  <button
                    type="button"
                    className={styles.forgotLink}
                    onClick={() => switchMode("forgot")}
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}

              <button type="submit" className={styles.submitBtn} disabled={loading}>
                {loading ? (
                  <>
                    <span className={styles.btnSpinner} />
                    Procesando...
                  </>
                ) : (
                  <>
                    {mode === "login" && "Iniciar sesión"}
                    {mode === "register" && "Crear cuenta"}
                    {mode === "forgot" && "Enviar enlace"}
                  </>
                )}
              </button>

              {mode === "forgot" && (
                <button
                  type="button"
                  className={styles.backLink}
                  onClick={() => switchMode("login")}
                >
                  Volver al inicio de sesión
                </button>
              )}
            </form>

            {/* Footer */}
            <div className={styles.formFooter}>
              <p>
                {mode === "login" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}
                <button
                  type="button"
                  className={styles.switchLink}
                  onClick={() => switchMode(mode === "login" ? "register" : "login")}
                >
                  {mode === "login" ? "Regístrate" : "Inicia sesión"}
                </button>
              </p>
            </div>
          </div>

          {/* Back to home */}
          <a href="/" className={styles.homeLink}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Volver al inicio
          </a>
        </div>
      </div>
    </div>
  );
}
