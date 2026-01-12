"use client";
import React, { useEffect, useMemo, useState } from "react";
import styles from "app/styles/ModalAcciones2.module.css";
import { supabase } from "lib/supabaseClient";

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

      const { data: miembroCosto, error } = await supabase
        .from("Miembros")
        .select("Costo")
        .eq("id", miembro.id)
        .single();

      if (!error && miembroCosto?.Costo) {
        setCostoBaseMiembro(miembroCosto.Costo);
        setFormData((prev) => ({ ...prev, costoNegociado: miembroCosto.Costo }));
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
  const costoHoraOriginal = Number(miembro?.Costo || 0);
  const costoHoraNegociado = Number(formData.costoNegociado || costoHoraOriginal);
  const horas = Number(paquete?.Horas || 0);
  const descuento = Number(paquete?.Descuento || 0);

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
Estoy interesado en el paquete *${paquete.Nombre}*.

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
      const { data: existingClient, error: selectError } = await supabase
        .from("Clientes")
        .select("*")
        .eq("CorreoElectronico", formData.correo)
        .single();

      let clienteId: number;

      if (selectError && selectError.code === "PGRST116") {
        const { data: newClient, error: insertError } = await supabase
          .from("Clientes")
          .insert({
            Nombre: formData.nombre,
            Apellido: formData.apellido,
            Contacto: formData.telefono,
            CorreoElectronico: formData.correo,
            idMiembro: miembro.id,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        try {
          await fetch(
            "https://ecc5f0d6fde7ef24ade927ef544fe2.0d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/ad41a7f54b1c4c2f9cc987193a8b5496/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=KzX_ss8H8PkgEBKXqBA2R_Up8CFesQrJ08MSs6fwiXM",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                nombre: formData.nombre,
                apellido: formData.apellido,
                correo: formData.correo,
                contacto: formData.telefono,
              }),
            }
          );
        } catch (err) {
          console.warn("Power Automate webhook falló (continuando):", err);
        }

        clienteId = newClient.id;
      } else if (existingClient) {
        clienteId = existingClient.id;
      } else {
        throw selectError;
      }

      const { error: ticketError } = await supabase.from("TicketsPaquetes").insert({
        idPaquete: paquete.id,
        idMiembro: miembro.id,
        idCliente: clienteId,
      });

      if (ticketError) throw ticketError;

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
  if (!isOpen || !miembro || !paquete) return null;

  return (
    <div className={styles.Overlay} role="presentation" onClick={closeAndReset}>
      <div className={styles.Modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className={styles.Cerrar} onClick={closeAndReset} aria-label="Cerrar">
          ×
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
                src={miembro.Foto || "/default.png"}
                className={styles.MiembroFoto}
                alt={miembro.Nombre}
              />
              <div>
                <div className={styles.Nombre}>{miembro.Nombre}</div>
                <div className={styles.Puesto}>{miembro.Puesto}</div>
              </div>
            </div>

            <div className={styles.CuadroAccion}>
              <div className={styles.TituloAccion}>{paquete.Nombre}</div>
              <div className={styles.TextoAccion}>{paquete.Descripcion}</div>
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
                <span>Teléfono</span>
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
                {sending ? "Enviando…" : "Enviar solicitud"}
              </button>

              <div className={styles.FormHint}>
                Al enviar, se guardará la solicitud y se abrirá WhatsApp con el mensaje listo.
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalPaquete;