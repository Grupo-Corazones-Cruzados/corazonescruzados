"use client";

import React, { useEffect, useMemo, useState } from "react";
import style from "app/styles/Formulario1.module.css";
import { supabase } from "lib/supabaseClient";

interface Accion {
  id: number;
  Accion: string;
  idMiembro: number;
  idFuente: number;
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

  const accionLabel = useMemo(() => selectedAccion?.Accion ?? "", [selectedAccion]);
  const canSubmit = useMemo(
    () => !!selectedAccion && selectedMember !== null && !loading,
    [selectedAccion, selectedMember, loading]
  );

  const close = () => {
    setShowForm(false);
    onClose();
  };

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

  if (!showForm) return null;

  const submitTicket = async () => {
    if (!selectedAccion || selectedMember === null) return;
    if (loading) return;

    setLoading(true);

    try {
      // 1) Verificar cliente existente
      const { data: existingClient, error: selectError } = await supabase
        .from("Clientes")
        .select("*")
        .eq("CorreoElectronico", formData.clienteCorreo)
        .single();

      if (selectError && selectError.code !== "PGRST116") {
        console.error("Error al verificar cliente:", selectError);
      }

      let clienteId: number;

      // 2) Crear cliente si no existe
      if (!existingClient) {
        // (Opcional) Power Automate webhook (no detiene el flujo si falla)
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
          console.warn("Power Automate webhook falló (continuando):", e);
        }

        const { data: newClient, error: insertClientError } = await supabase
          .from("Clientes")
          .insert({
            Nombre: formData.clienteNombre,
            Contacto: formData.clienteContacto,
            CorreoElectronico: formData.clienteCorreo,
            idMiembro: selectedMember,
            idAccion: selectedAccion.id,
          })
          .select()
          .single();

        if (insertClientError) {
          console.error("Error al crear cliente:", insertClientError);
          return;
        }

        clienteId = (newClient as any).id;
      } else {
        clienteId = (existingClient as any).id;
      }

      // 3) Crear ticket
      const { error: ticketError } = await supabase.from("Tickets").insert({
        idCliente: clienteId,
        idAccion: selectedAccion.id,
        Detalle: formData.detalle,
        Estado: "Pendiente",
      });

      if (ticketError) {
        console.error("Error al crear ticket:", ticketError);
        return;
      }

      // 4) Obtener número del miembro
      const { data: miembroDB, error: miembroError } = await supabase
        .from("Miembros")
        .select("celular, Nombre")
        .eq("id", selectedMember)
        .single();

      if (miembroError) {
        console.error("Error al obtener número del miembro:", miembroError);
        return;
      }

      const numeroDestino = (miembroDB as any)?.celular?.replace("+", "") || "593992706933";

      // 5) Mensaje WhatsApp
      const mensaje = `Hola, soy ${formData.clienteNombre} ${formData.clienteApellido}.
He generado un ticket para la acción *${selectedAccion.Accion}* con ${(miembroDB as any)?.Nombre}.
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

  return (
    <div className={style.overlay} role="presentation" onClick={close}>
      <div
        className={style.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Generar ticket"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className={style.closeButton} aria-label="Cerrar" onClick={close}>
          ×
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
              <span>Número de contacto</span>
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
              <span>Correo electrónico</span>
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
            {loading ? "Enviando…" : "Enviar solicitud"}
          </button>

          <div className={style.hint}>
            Al enviar, se crea el ticket y se abrirá WhatsApp con el mensaje listo para enviar.
          </div>
        </form>
      </div>
    </div>
  );
}