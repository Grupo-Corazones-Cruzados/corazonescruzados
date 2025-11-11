"use client";
import React, { useState, useEffect } from "react";
import styles from "app/styles/ModalAcciones.module.css";
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

  useEffect(() => {
    const fetchAcciones = async () => {
      if (!miembro?.id) return;

      const { data: miembroCosto, error } = await supabase
        .from("Miembros")
        .select("Costo")
        .eq("id", miembro.id)
        .single();

      if (!error && miembroCosto?.Costo) {
        setCostoBaseMiembro(miembroCosto.Costo);
        setFormData((prev) => ({
          ...prev,
          costoNegociado: miembroCosto.Costo,
        }));
      }
    };

    fetchAcciones();
  }, [miembro]);

  if (!isOpen || !miembro || !paquete) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paquete || !miembro) return;

    // construir datos para el mensaje
    const numeroDestino = miembro?.celular?.replace("+", "") || "593992706933";
    const mensaje = `Hola, soy ${formData.nombre} ${formData.apellido}.
Estoy interesado en el paquete *${paquete.Nombre}*.

He negociado un costo por hora de $${formData.costoNegociado.toFixed(2)}.

Detalles del paquete:
- Horas: ${paquete.Horas}
- Descuento: ${paquete.Descuento}%
- Precio final: $${(
      miembro?.Costo * paquete.Horas * (1 - paquete.Descuento / 100)
    ).toFixed(2)}

Mis datos:
- Correo: ${formData.correo}
- Teléfono: ${formData.telefono}`;

    // abrir WhatsApp exactamente como hacía el botón anterior
    const url = `https://wa.me/${numeroDestino}?text=${encodeURIComponent(mensaje)}`;
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();

    // guardar en Supabase
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

        // 🚀 Enviar datos al flujo Power Automate solo si el cliente es nuevo
        await fetch("https://ecc5f0d6fde7ef24ade927ef544fe2.0d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/ad41a7f54b1c4c2f9cc987193a8b5496/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=KzX_ss8H8PkgEBKXqBA2R_Up8CFesQrJ08MSs6fwiXM", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: formData.nombre,
            apellido: formData.apellido,
            correo: formData.correo,
            contacto: formData.telefono
          })
        });

        clienteId = newClient.id;
      } else if (existingClient) {
        clienteId = existingClient.id;
      } else {
        throw selectError;
      }

      const { error: ticketError } = await supabase
        .from("TicketsPaquetes")
        .insert({
          idPaquete: paquete.id,
          idMiembro: miembro.id,
          idCliente: clienteId,
        });

      if (ticketError) throw ticketError;

      onClose();
    } catch (error) {
      console.error("Error en la solicitud:", error);
    }
  };

  // cálculos del paquete
  const costoHoraOriginal = miembro?.Costo || 0;
  const costoHoraNegociado = formData.costoNegociado || costoHoraOriginal;
  const horas = paquete?.Horas || 0;
  const descuento = paquete?.Descuento || 0;
  const precioTotal = costoHoraNegociado * horas;
  const precioConDescuento = precioTotal * (1 - descuento / 100);
  const costoHoraReal = horas ? precioConDescuento / horas : 0;
  const ahorroHora = formData.costoNegociado - costoHoraReal;
  const ahorroTotal = precioTotal - precioConDescuento;

  return (
    <div className={styles.Overlay}>
      <div className={styles.Modal}>
        <button
          className={styles.Cerrar}
          onClick={() => {
            setFormData((prev) => ({
              ...prev,
              costoNegociado: costoBaseMiembro,
              apellido: "",
            }));
            onClose();
          }}
        >
          ×
        </button>

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
              <div className={styles.TextoAccion}>
                <strong>Horas:</strong>
                <span className={styles.ValorDerecha}>{paquete.Horas}</span>
              </div>
              <div className={styles.TextoAccion}>
                <strong>Descuento:</strong>
                <span className={styles.ValorDerecha}>{paquete.Descuento}%</span>
              </div>
            </div>

            <div className={styles.CuadroAccion}>
              <div className={styles.TituloAccion}>Beneficios del Paquete</div>
              <div className={styles.TextoAccion}>
                <strong>Precio sin descuento:</strong>
                <span className={styles.ValorDerecha}>${precioTotal.toFixed(2)}</span>
              </div>
              <div className={styles.TextoAccion}>
                <strong>Precio con descuento:</strong>
                <span className={styles.ValorDerecha}>${precioConDescuento.toFixed(2)}</span>
              </div>
              <div className={styles.TextoAccion}>
                <strong>Costo por hora:</strong>
                <span className={styles.ValorDerecha}>${costoHoraReal.toFixed(2)}</span>
              </div>
              <div className={styles.TextoAccion}>
                <strong>Ahorro por hora:</strong>
                <span className={styles.ValorDerecha}>${ahorroHora.toFixed(2)}</span>
              </div>
              <div className={styles.TextoAccion}>
                <strong>Ahorro total:</strong>
                <span className={styles.ValorDerecha}>${ahorroTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Derecha */}
          <div className={styles.ColumnaDerecha}>
            <form onSubmit={handleSubmit}>
              <label>
                Nombre:
                <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} required />
              </label>
              <label>
                Apellido:
                <input
                  type="text"
                  name="apellido"
                  value={formData.apellido}
                  onChange={handleChange}
                  required
                />
              </label>
              <label>
                Correo:
                <input type="email" name="correo" value={formData.correo} onChange={handleChange} required />
              </label>
              <label>
                Teléfono:
                <input type="tel" name="telefono" value={formData.telefono} onChange={handleChange} required />
              </label>
              <label>
                Costo por hora negociable:
                <input
                  type="number"
                  name="costoNegociado"
                  value={formData.costoNegociado}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      costoNegociado: parseFloat(e.target.value) || 0,
                    })
                  }
                  step="0.01"
                  required
                />
              </label>
              <button type="submit">Enviar solicitud</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalPaquete;