"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "../Auth.module.css";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Token de restablecimiento no proporcionado");
    }
  }, [token]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError("Token de restablecimiento no proporcionado");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (formData.password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          token,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess("Contraseña actualizada exitosamente. Redirigiendo...");
        setTimeout(() => {
          router.push("/auth");
        }, 2000);
      } else {
        setError(data.error || "Error al restablecer la contraseña");
      }
    } catch (err) {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

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
          </div>
        </div>

        {/* Right side - Form */}
        <div className={styles.formSection}>
          <div className={styles.formCard}>
            <div className={styles.formHeader}>
              <h2 className={styles.formTitle}>Restablecer contraseña</h2>
              <p className={styles.formSubtitle}>
                Ingresa tu nueva contraseña
              </p>
            </div>

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
            {!success && token && (
              <form className={styles.form} onSubmit={handleSubmit}>
                <label className={styles.field}>
                  <span>Nueva contraseña</span>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    minLength={6}
                  />
                </label>

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
                    minLength={6}
                  />
                </label>

                <button type="submit" className={styles.submitBtn} disabled={loading}>
                  {loading ? (
                    <>
                      <span className={styles.btnSpinner} />
                      Procesando...
                    </>
                  ) : (
                    "Restablecer contraseña"
                  )}
                </button>
              </form>
            )}

            <button
              type="button"
              className={styles.backLink}
              onClick={() => router.push("/auth")}
            >
              Volver al inicio de sesión
            </button>
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className={styles.page}>
        <div className={styles.bgGlow} aria-hidden="true" />
        <div className={styles.bgPattern} aria-hidden="true" />
        <div className={styles.container}>
          <div className={styles.branding}>
            <div className={styles.brandingContent}>
              <img src="/LogoCC.png" alt="Corazones Cruzados" className={styles.logo} />
              <h1 className={styles.brandTitle}>Corazones Cruzados</h1>
            </div>
          </div>
          <div className={styles.formSection}>
            <div className={styles.formCard}>
              <div className={styles.formHeader}>
                <h2 className={styles.formTitle}>Cargando...</h2>
              </div>
            </div>
          </div>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
