"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import style from "app/styles/Formulario1.module.css";

interface Accion {
  id: number;
  nombre: string;
  id_miembro: number;
  id_fuente: number;
}

interface Formulario1Props {
  selectedMember: number | null;
  setSelectedMember?: React.Dispatch<React.SetStateAction<number | null>>;

  showForm: boolean;
  setShowForm: React.Dispatch<React.SetStateAction<boolean>>;

  selectedAccion: Accion | null;
  setSelectedAccion: React.Dispatch<React.SetStateAction<Accion | null>>;

  onClose: () => void;
}

export default function Formulario1({
  selectedMember,
  setSelectedMember,
  showForm,
  setShowForm,
  selectedAccion,
  setSelectedAccion,
  onClose,
}: Formulario1Props) {
  const [formData, setFormData] = useState({
    clienteNombre: "",
    clienteApellido: "",
    clienteContacto: "",
    clienteCorreo: "",
    detalle: "",
  });

  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [accountRequired, setAccountRequired] = useState(false);

  const accionLabel = useMemo(() => selectedAccion?.nombre ?? "", [selectedAccion]);
  const canSubmit = useMemo(
    () => !!selectedAccion && selectedMember !== null && !loading,
    [selectedAccion, selectedMember, loading]
  );

  const close = () => {
    setShowForm(false);
    onClose();
  };

  // Para que createPortal funcione en SSR
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!showForm) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showForm]);

  if (!showForm || !mounted) return null;

  const submitTicket = async () => {
    if (!selectedAccion || selectedMember === null) return;
    if (loading) return;

    setLoading(true);

    try {
      // Create ticket via API
      const response = await fetch("/api/public-tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteNombre: formData.clienteNombre,
          clienteApellido: formData.clienteApellido,
          clienteContacto: formData.clienteContacto,
          clienteCorreo: formData.clienteCorreo,
          detalle: formData.detalle,
          id_miembro: selectedMember,
          id_accion: selectedAccion.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === "ACCOUNT_REQUIRED") {
          setAccountRequired(true);
        } else {
          console.error("Error al crear ticket:", data.error);
        }
        return;
      }

      // (Opcional) Power Automate webhook — solo si el ticket se creó exitosamente
      try {
        await fetch(
          "https://ecc5f0d6fde7ef24ade927ef544fe2.0d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/ad41a7f54b1c4c2f9cc987193a8b5496/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=KzX_ss8H8PkgEBKXqBA2R_Up8CFesQrJ08MSs6fwiXM",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nombre: formData.clienteNombre,
              apellido: formData.clienteApellido,
              correo: formData.clienteCorreo,
              contacto: formData.clienteContacto,
            }),
          }
        );
      } catch (e) {
        console.warn("Power Automate webhook fallo (continuando):", e);
      }

      const numeroDestino = data.miembro?.celular?.replace("+", "") || "593992706933";

      // Mensaje WhatsApp
      const mensaje = `Hola, soy ${formData.clienteNombre} ${formData.clienteApellido}.
He generado un ticket para la acción *${selectedAccion.nombre}* con ${data.miembro?.nombre}.
Detalles del requerimiento:
${formData.detalle}

Mi correo: ${formData.clienteCorreo}
Mi contacto: ${formData.clienteContacto}`;

      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const whatsappURL = isMobile
        ? `whatsapp://send?phone=${numeroDestino}&text=${encodeURIComponent(mensaje)}`
        : `https://wa.me/${numeroDestino}?text=${encodeURIComponent(mensaje)}`;

      window.location.href = whatsappURL;

      // Reset local
      setFormData({
        clienteNombre: "",
        clienteApellido: "",
        clienteContacto: "",
        clienteCorreo: "",
        detalle: "",
      });

      setSelectedAccion(null);
      if (setSelectedMember) setSelectedMember(null);
      setShowForm(false);
      onClose();
    } catch (error) {
      console.error("Error general:", error);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className={style.overlay} role="presentation" onClick={close}>
      <div
        className={style.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Generar ticket"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className={style.closeButton} aria-label="Cerrar" onClick={close}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        <div className={style.header}>
          <div className={style.kicker}>Soporte</div>
          <h2 className={style.title}>Genera tu ticket</h2>
          <p className={style.subtitle}>
            Completa tus datos y describe el requerimiento. Te conectaremos con el miembro seleccionado.
          </p>

          {accionLabel && (
            <div className={style.badge}>
              Acción: <b>{accionLabel}</b>
            </div>
          )}
        </div>

        {accountRequired ? (
          <div className={style.form} style={{ textAlign: "center" }}>
            <div style={{
              width: "56px",
              height: "56px",
              background: "rgba(220, 38, 38, 0.1)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="M12 8v4" />
                <path d="M12 16h.01" />
              </svg>
            </div>
            <h3 style={{ color: "var(--text-primary)", fontSize: "1.1rem", marginBottom: "8px" }}>
              Crea una cuenta para continuar
            </h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "20px", lineHeight: 1.5 }}>
              Ya generaste un ticket anteriormente. Para crear mas tickets necesitas una cuenta registrada.
            </p>
            <a
              href="/auth"
              className={style.submitBtn}
              style={{ display: "inline-block", textDecoration: "none", textAlign: "center" }}
            >
              Crear cuenta
            </a>
            <button
              type="button"
              onClick={() => {
                const loginUrl = "/auth";
                window.location.href = loginUrl;
              }}
              style={{
                display: "block",
                width: "100%",
                marginTop: "10px",
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                fontSize: "0.85rem",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Ya tengo cuenta, iniciar sesion
            </button>
          </div>
        ) : (
          <form
            className={style.form}
            onSubmit={async (e) => {
              e.preventDefault();
              await submitTicket();
            }}
          >
            <div className={style.grid2}>
              <label className={style.field}>
                <span>Nombre</span>
                <input
                  type="text"
                  value={formData.clienteNombre}
                  onChange={(e) => setFormData({ ...formData, clienteNombre: e.target.value })}
                  required
                  placeholder="Tu nombre"
                  autoComplete="given-name"
                />
              </label>

              <label className={style.field}>
                <span>Apellido</span>
                <input
                  type="text"
                  value={formData.clienteApellido}
                  onChange={(e) => setFormData({ ...formData, clienteApellido: e.target.value })}
                  required
                  placeholder="Tu apellido"
                  autoComplete="family-name"
                />
              </label>

              <label className={style.field}>
                <span>Numero de contacto</span>
                <input
                  type="text"
                  value={formData.clienteContacto}
                  onChange={(e) => setFormData({ ...formData, clienteContacto: e.target.value })}
                  required
                  placeholder="Ej: +593..."
                  autoComplete="tel"
                />
              </label>

              <label className={style.field}>
                <span>Correo electronico</span>
                <input
                  type="email"
                  value={formData.clienteCorreo}
                  onChange={(e) => setFormData({ ...formData, clienteCorreo: e.target.value })}
                  required
                  placeholder="tucorreo@dominio.com"
                  autoComplete="email"
                />
              </label>
            </div>

            <label className={style.field}>
              <span>Detalle del requerimiento</span>
              <textarea
                value={formData.detalle}
                onChange={(e) => setFormData({ ...formData, detalle: e.target.value })}
                required
                placeholder="Describe el contexto, objetivo, detalles técnicos, enlaces, fechas, etc."
              />
            </label>

            <button type="submit" className={style.submitBtn} disabled={!canSubmit}>
              {loading ? "Enviando..." : "Enviar solicitud"}
            </button>

            <div className={style.hint}>
              Al enviar, se crea el ticket y se abrira WhatsApp con el mensaje listo para enviar.
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}