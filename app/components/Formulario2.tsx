"use client";

import React, { useEffect, useMemo, useState } from "react";
import style from "app/styles/Formualrio2.module.css";

type Props = {
  visible: boolean;
  onClose?: () => void;
  setVisible?: (v: boolean) => void;
};

export default function Formulario2({ visible, onClose, setVisible }: Props) {
  const [motivo, setMotivo] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [sending, setSending] = useState(false);

  const close = () => {
    setVisible?.(false);
    onClose?.();
  };

  const canSubmit = useMemo(() => motivo.trim().length > 0 && !sending, [motivo, sending]);

  useEffect(() => {
    if (!visible) return;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!motivo.trim()) {
      setSuccessMsg("");
      setErrorMsg("Por favor, escribe tu motivo antes de enviar.");
      return;
    }

    setErrorMsg("");
    setSuccessMsg("");
    setSending(true);

    try {
      const response = await fetch("/api/aspirantes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivo.trim() }),
      });

      setSending(false);

      if (!response.ok) {
        const data = await response.json();
        console.error("Error al guardar:", data.error);
        setErrorMsg("Ocurrió un error al enviar. Intenta nuevamente.");
        return;
      }

      setMotivo("");
      setSuccessMsg("¡Listo! Recibimos tu información. Pronto nos pondremos en contacto.");
    } catch (error) {
      setSending(false);
      console.error("Error al guardar:", error);
      setErrorMsg("Ocurrió un error al enviar. Intenta nuevamente.");
    }
  };

  if (!visible) return null;

  return (
    <div className={style.overlay} role="presentation" onClick={close} aria-label="Formulario aspirantes">
      <div className={style.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button type="button" className={style.closeButton} aria-label="Cerrar" onClick={close}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        <div className={style.header}>
          <div className={style.kicker}>Aspirantes</div>
          <h2 className={style.title}>Cuéntanos quién eres</h2>
          <p className={style.subtitle}>
            Escribe brevemente tus motivos para unirte al proyecto. Responderemos por el canal más adecuado.
          </p>
        </div>

        <form className={style.formulario} onSubmit={handleSubmit}>
          <label className={style.field}>
            <span className={style.label}>Motivo</span>
            <textarea
              className={style.areaTexto}
              placeholder="Escribe aquí tus motivos para unirte al proyecto..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
          </label>

          {errorMsg && <p className={style.mensajeError}>{errorMsg}</p>}
          {successMsg && <p className={style.mensajeOk}>{successMsg}</p>}

          <button className={style.botones} type="submit" disabled={!canSubmit}>
            {sending ? "Enviando…" : "Enviar"}
          </button>
        </form>
      </div>
    </div>
  );
}