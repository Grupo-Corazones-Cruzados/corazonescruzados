"use client";
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import styles from "app/styles/ModalAcciones2.module.css";

interface ModalPaqueteProps {
  isOpen: boolean;
  onClose: () => void;
  miembro: any;
  paquete: any;
}

const ModalPaquete: React.FC<ModalPaqueteProps> = ({ isOpen, onClose, miembro, paquete }) => {
  const [formData, setFormData] = useState({
    nombre: "",
    apellido: "",
    correo: "",
    telefono: "",
    costoNegociado: 0,
  });

  const [costoBaseMiembro, setCostoBaseMiembro] = useState(0);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [accountRequired, setAccountRequired] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Para que createPortal funcione en SSR
  useEffect(() => {
    setMounted(true);
  }, []);

  // ESC + lock scroll (solo cuando el modal está abierto)
  useEffect(() => {
    if (!isOpen) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  // Cargar costo base del miembro (no rompe si miembro/paquete no existen todavía)
  useEffect(() => {
    const fetchCosto = async () => {
      if (!miembro?.id) return;

      try {
        const response = await fetch(`/api/members/${miembro.id}`);
        const data = await response.json();

        if (response.ok && data.member?.costo) {
          setCostoBaseMiembro(data.member.costo);
          setFormData((prev) => ({ ...prev, costoNegociado: data.member.costo }));
        }
      } catch (error) {
        console.error("Error fetching member cost:", error);
      }
    };

    fetchCosto();
  }, [miembro?.id]);

  const closeAndReset = () => {
    setErrorMsg("");
    setFormData((prev) => ({
      ...prev,
      costoNegociado: costoBaseMiembro,
    }));
    onClose();
  };

  // ===== Cálculos seguros (si aún no hay paquete/miembro, quedan en 0) =====
  const costoHoraOriginal = Number(miembro?.costo || 0);
  const costoHoraNegociado = Number(formData.costoNegociado || costoHoraOriginal);
  const horas = Number(paquete?.horas || 0);
  const descuento = Number(paquete?.descuento || 0);

  const precioTotal = costoHoraNegociado * horas;
  const precioConDescuento = precioTotal * (1 - descuento / 100);
  const costoHoraReal = horas ? precioConDescuento / horas : 0;
  const ahorroHora = costoHoraNegociado - costoHoraReal;
  const ahorroTotal = precioTotal - precioConDescuento;

  // Hook SIEMPRE se ejecuta (evita error de orden de hooks)
  const canSubmit = useMemo(() => {
    return (
      isOpen &&
      !!miembro &&
      !!paquete &&
      !!formData.nombre.trim() &&
      !!formData.apellido.trim() &&
      !!formData.correo.trim() &&
      !!formData.telefono.trim() &&
      Number.isFinite(Number(formData.costoNegociado)) &&
      Number(formData.costoNegociado) > 0 &&
      !sending
    );
  }, [isOpen, miembro, paquete, formData, sending]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paquete || !miembro) return;

    setErrorMsg("");
    setSending(true);

    const numeroDestino = (miembro?.celular || "").replace("+", "") || "593992706933";
    const mensaje = `Hola, soy ${formData.nombre} ${formData.apellido}.
Estoy interesado en el paquete *${paquete.nombre}*.

He negociado un costo por hora de $${Number(formData.costoNegociado).toFixed(2)}.

Detalles del paquete:
- Horas: ${horas}
- Descuento: ${descuento}%
- Precio final: $${precioConDescuento.toFixed(2)}

Mis datos:
- Correo: ${formData.correo}
- Teléfono: ${formData.telefono}`;

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const url = isMobile
      ? `whatsapp://send?phone=${numeroDestino}&text=${encodeURIComponent(mensaje)}`
      : `https://wa.me/${numeroDestino}?text=${encodeURIComponent(mensaje)}`;

    try {
      const response = await fetch("/api/paquetes/solicitud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paqueteId: paquete.id,
          miembroId: miembro.id,
          nombre: formData.nombre,
          apellido: formData.apellido,
          correo: formData.correo,
          telefono: formData.telefono,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === "ACCOUNT_REQUIRED") {
          setAccountRequired(true);
          setSending(false);
          return;
        }
        throw new Error(data.error || "Error al crear la solicitud");
      }

      window.location.href = url;

      setFormData({
        nombre: "",
        apellido: "",
        correo: "",
        telefono: "",
        costoNegociado: costoBaseMiembro,
      });
      onClose();
    } catch (error) {
      console.error("Error en la solicitud:", error);
      setErrorMsg("Ocurrió un error al enviar la solicitud. Intenta nuevamente.");
    } finally {
      setSending(false);
    }
  };

  // ✅ Render condicional DESPUÉS de los hooks (evita error de orden)
  if (!isOpen || !miembro || !paquete || !mounted) return null;

  // Usar Portal para renderizar fuera del contexto de apilamiento del header
  return createPortal(
    <div className={styles.Overlay} role="presentation" onClick={closeAndReset}>
      <div className={styles.Modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className={styles.Cerrar} onClick={closeAndReset} aria-label="Cerrar">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        <div className={styles.ModalHeader}>
          <div>
            <div className={styles.ModalKicker}>Paquetes</div>
            <div className={styles.ModalTitle}>Solicitud de paquete</div>
            <div className={styles.ModalSubtitle}>
              Completa tus datos y envía tu solicitud. Verás el resumen del paquete y el costo final.
            </div>
          </div>
        </div>

        <div className={styles.Contenido}>
          {/* Izquierda */}
          <div className={styles.ColumnaIzquierda}>
            <div className={styles.InfoMiembro}>
              <img
                src={miembro.foto || "/default.png"}
                className={styles.MiembroFoto}
                alt={miembro.nombre}
              />
              <div>
                <div className={styles.Nombre}>{miembro.nombre}</div>
                <div className={styles.Puesto}>{miembro.puesto}</div>
              </div>
            </div>

            <div className={styles.CuadroAccion}>
              <div className={styles.TituloAccion}>{paquete.nombre}</div>
              <div className={styles.TextoAccion}>{paquete.descripcion}</div>
              <div className={styles.TextoAccionKV}>
                <strong>Horas</strong>
                <span>{horas}</span>
              </div>
              <div className={styles.TextoAccionKV}>
                <strong>Descuento</strong>
                <span>{descuento}%</span>
              </div>
            </div>

            <div className={styles.CuadroAccion}>
              <div className={styles.TituloAccion}>Resumen de costos</div>
              <div className={styles.TextoAccionKV}>
                <strong>Precio sin descuento</strong>
                <span>${precioTotal.toFixed(2)}</span>
              </div>
              <div className={styles.TextoAccionKV}>
                <strong>Precio con descuento</strong>
                <span>${precioConDescuento.toFixed(2)}</span>
              </div>
              <div className={styles.TextoAccionKV}>
                <strong>Costo por hora</strong>
                <span>${costoHoraReal.toFixed(2)}</span>
              </div>
              <div className={styles.TextoAccionKV}>
                <strong>Ahorro por hora</strong>
                <span>${ahorroHora.toFixed(2)}</span>
              </div>
              <div className={styles.TextoAccionKV}>
                <strong>Ahorro total</strong>
                <span>${ahorroTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Derecha */}
          <div className={styles.ColumnaDerecha}>
            {accountRequired ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", textAlign: "center", padding: "40px 20px" }}>
                <div style={{
                  width: "56px", height: "56px",
                  background: "rgba(220, 38, 38, 0.1)", borderRadius: "50%",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: "16px",
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="M12 8v4" />
                    <path d="M12 16h.01" />
                  </svg>
                </div>
                <h3 style={{ fontSize: "1.1rem", marginBottom: "8px" }}>Crea una cuenta para continuar</h3>
                <p style={{ color: "var(--text-muted, #6b7280)", fontSize: "0.9rem", marginBottom: "20px", lineHeight: 1.5 }}>
                  Ya solicitaste un paquete anteriormente. Para solicitar mas, necesitas una cuenta registrada.
                </p>
                <a href="/auth" className={styles.FormBtn} style={{ display: "inline-block", textDecoration: "none", textAlign: "center" }}>
                  Crear cuenta
                </a>
                <button type="button" onClick={() => { window.location.href = "/auth"; }} style={{
                  display: "block", width: "100%", marginTop: "10px",
                  background: "none", border: "none",
                  color: "var(--text-muted, #6b7280)", fontSize: "0.85rem",
                  cursor: "pointer", textDecoration: "underline",
                }}>
                  Ya tengo cuenta, iniciar sesion
                </button>
              </div>
            ) : (
              <>
                <div className={styles.FormHeader}>
                  <div className={styles.FormTitle}>Tus datos</div>
                  <div className={styles.FormSub}>
                    Completa el formulario para generar la solicitud del paquete.
                  </div>
                </div>

                <form className={styles.Form} onSubmit={handleSubmit}>
                  <label className={styles.Field}>
                    <span>Nombre</span>
                    <input
                      required
                      type="text"
                      value={formData.nombre}
                      onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                      placeholder="Tu nombre"
                    />
                  </label>

                  <label className={styles.Field}>
                    <span>Apellido</span>
                    <input
                      required
                      type="text"
                      value={formData.apellido}
                      onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                      placeholder="Tu apellido"
                    />
                  </label>

                  <label className={styles.Field}>
                    <span>Correo</span>
                    <input
                      required
                      type="email"
                      value={formData.correo}
                      onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                      placeholder="tucorreo@dominio.com"
                    />
                  </label>

                  <label className={styles.Field}>
                    <span>Telefono</span>
                    <input
                      required
                      type="tel"
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                      placeholder="+593..."
                    />
                  </label>

                  <label className={styles.Field}>
                    <span>Costo por hora negociable</span>
                    <input
                      required
                      type="number"
                      step="0.01"
                      value={formData.costoNegociado}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          costoNegociado: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </label>

                  {errorMsg && <div className={styles.FormError}>{errorMsg}</div>}

                  <button className={styles.FormBtn} type="submit" disabled={!canSubmit}>
                    {sending ? "Enviando..." : "Enviar solicitud"}
                  </button>

                  <div className={styles.FormHint}>
                    Al enviar, se guardara la solicitud y se abrira WhatsApp con el mensaje listo.
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ModalPaquete;