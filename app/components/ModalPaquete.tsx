"use client";
import React, { useState } from "react";
import styles from "app/styles/ModalAcciones.module.css";
import { useEffect } from "react";
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
    costoNegociado: 0, // nuevo campo
  });
  const [costoBaseMiembro, setCostoBaseMiembro] = useState(0);

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

      // 🔹 Obtener el costo por hora del miembro
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

  const [acciones, setAcciones] = useState<any[]>([]);



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
      // 1️⃣ Verificar si el cliente ya existe
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

      // 2️⃣ Crear cliente si no existe
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

      // 3️⃣ Crear registro en TicketsPaquetes
      const { error: ticketError } = await supabase
        .from("TicketsPaquetes")
        .insert({
          idPaquete: paquete.id,
          idMiembro: miembro.id,
          idCliente: clienteId
        });

      if (ticketError) {
        console.error("Error al crear ticket:", ticketError);
        return;
      }



      // 4️⃣ Obtener número de celular del miembro desde la base de datos
      const { data: miembroDB, error: miembroError } = await supabase
        .from("Miembros")
        .select("celular")
        .eq("id", miembro.id)
        .single();

      if (miembroError) {
        console.error("Error al obtener celular del miembro:", miembroError);
        return;
      }

      const numeroDestino = miembroDB?.celular?.replace("+", "") || "593992706933";



      // ya tenemos numeroDestino desde la base
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

      const url = `https://wa.me/${numeroDestino}?text=${encodeURIComponent(
        mensaje
      )}`;
      window.open(url, "_blank");

      // 5️⃣ Limpiar formulario
      setFormData({
        nombre: "",
        correo: "",
        telefono: "",
        costoNegociado: 0
      });

      alert("Ticket creado correctamente.");
      onClose();
    } catch (error) {
      console.error("Error general:", error);
    }
  };

  // Cálculos del beneficio
  // valores base
// valores base
const costoHoraOriginal = miembro?.Costo || 0;
const costoHoraNegociado = formData.costoNegociado || costoHoraOriginal;
const horas = paquete?.Horas || 0;
const descuento = paquete?.Descuento || 0;

// precios con y sin descuento aplicando cada costo
const precioTotal = costoHoraNegociado * horas; // precio sin descuento
const precioOriginalConDescuento = costoHoraOriginal * horas * (1 - descuento / 100);
const precioNegociadoConDescuento = costoHoraNegociado * horas * (1 - descuento / 100);
const precioConDescuento = precioNegociadoConDescuento;

// costo promedio por hora luego del descuento
const costoHoraReal = horas ? precioNegociadoConDescuento / horas : 0;

// ahorro por hora (comparación entre el original y el negociado)
// nuevo cálculo del ahorro por hora y total
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
      costoNegociado: costoBaseMiembro, // restaura el costo original
    }));
    onClose();
  }}
>
  ×
</button>

        <div className={styles.Contenido}>
          {/* Columna izquierda: datos del miembro y paquete */}
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
  <strong>Ahorro total en el paquete:</strong>
  <span className={styles.ValorDerecha}>${ahorroTotal.toFixed(2)}</span>
</div>
            </div>
            <div className={styles.CuadroAccion}>
              <div className={styles.TituloAccion}>Acciones Disponibles</div>

              {acciones.length === 0 ? (
                <div className={styles.TextoAccion}>No hay acciones registradas para este miembro.</div>
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



          {/* Columna derecha: formulario */}
          <div className={styles.ColumnaDerecha}>
            <form onSubmit={handleSubmit}>
              <label>
                Nombre:
                <input
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                Correo:
                <input
                  type="email"
                  name="correo"
                  value={formData.correo}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                Teléfono:
                <input
                  type="tel"
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  required
                />
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