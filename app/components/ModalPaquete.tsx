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
    correo: "",
    telefono: "",
    costoNegociado: 0,
  });
  const [costoBaseMiembro, setCostoBaseMiembro] = useState(0);
  const [acciones, setAcciones] = useState<any[]>([]);

  useEffect(() => {
    const fetchAcciones = async () => {
      if (!miembro?.id) return;

      const { data, error } = await supabase
        .from("Acciones")
        .select("id, Accion")
        .eq("idMiembro", miembro.id)
        .order("Accion", { ascending: true });

      if (error) {
        console.error("Error al cargar acciones:", error);
      } else {
        setAcciones(data || []);
      }

      const { data: miembroCosto, error: costoError } = await supabase
        .from("Miembros")
        .select("Costo")
        .eq("id", miembro.id)
        .single();

      if (!costoError && miembroCosto?.Costo) {
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

    try {
      // Verificar o crear cliente
      const { data: existingClient, error: selectError } = await supabase
        .from("Clientes")
        .select("*")
        .eq("CorreoElectronico", formData.correo)
        .single();

      if (selectError && selectError.code !== "PGRST116") {
        console.error("Error al verificar cliente:", selectError);
        return;
      }

      let clienteId: number;
      if (!existingClient) {
        const { data: newClient, error: insertError } = await supabase
          .from("Clientes")
          .insert({
            Nombre: formData.nombre,
            Contacto: formData.telefono,
            CorreoElectronico: formData.correo,
            idMiembro: miembro.id,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Error al crear cliente:", insertError);
          return;
        }

        clienteId = newClient.id;
      } else {
        clienteId = existingClient.id;
      }

      // Crear ticket
      const { error: ticketError } = await supabase
        .from("TicketsPaquetes")
        .insert({
          idPaquete: paquete.id,
          idMiembro: miembro.id,
          idCliente: clienteId,
        });

      if (ticketError) {
        console.error("Error al crear ticket:", ticketError);
        return;
      }

      alert("Ticket creado correctamente.");
      onClose();
    } catch (error) {
      console.error("Error general:", error);
    }
  };

  // Variables para WhatsApp accesibles en todo el componente
  const numeroDestino = miembro?.celular?.replace("+", "") || "593992706933";

  const mensaje = `Hola, soy ${formData.nombre}.
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

  // Cálculos del beneficio
  const costoHoraOriginal = miembro?.Costo || 0;
  const costoHoraNegociado = formData.costoNegociado || costoHoraOriginal;
  const horas = paquete?.Horas || 0;
  const descuento = paquete?.Descuento || 0;

  const precioTotal = costoHoraNegociado * horas;
  const precioConDescuento = costoHoraNegociado * horas * (1 - descuento / 100);
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
            }));
            onClose();
          }}
        >
          ×
        </button>

        <div className={styles.Contenido}>
          {/* Izquierda: datos */}
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

            <div className={styles.CuadroAccion}>
              <div className={styles.TituloAccion}>Acciones Disponibles</div>
              {acciones.length === 0 ? (
                <div className={styles.TextoAccion}>No hay acciones registradas.</div>
              ) : (
                <ul className={styles.ListaAcciones}>
                  {acciones.map((accion) => (
                    <li key={accion.id} className={styles.TextoAccionAccion}>
                      <img src="/Icono de Corazón.png" alt="icono" /> {accion.Accion}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Derecha: formulario */}
          <div className={styles.ColumnaDerecha}>
            <form onSubmit={handleSubmit}>
              <label>
                Nombre:
                <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} required />
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

              <button
                type="button"
                onClick={() => {
                  const url = `https://wa.me/${numeroDestino}?text=${encodeURIComponent(mensaje)}`;
                  window.open(url, "_blank");
                }}
              >
                Enviar mensaje por WhatsApp
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalPaquete;