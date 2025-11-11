"use client";
import React, { useEffect, useState } from "react";
import style from "app/styles/Formulario1.module.css";
import { supabase } from "lib/supabaseClient";

interface Formulario1Padre {
  selectedMember: number | null;
  setSelectedMember: React.Dispatch<React.SetStateAction<number | null>>;
  showForm: boolean | null;
  setShowForm: React.Dispatch<React.SetStateAction<boolean>>;
  selectedAccion: Accion | null;
  setSelectedAccion: React.Dispatch<React.SetStateAction<Accion | null>>;
  onClose: () => void;
}

interface Accion {
  id: number;
  Accion: string;
  idMiembro: number;
  idFuente: number;
}

interface Member {
  id: number;
  Nombre: string;
  Puesto: string;
  Descripcion: string;
  Foto: string | null;
  Correo: string;
  idFuentes: number;
  celular?: string;
}

const Formulario1: React.FC<Formulario1Padre> = ({
  selectedMember,
  setSelectedMember,
  showForm,
  setShowForm,
  selectedAccion,
  setSelectedAccion,
  onClose,
}) => {
  const [formData, setFormData] = useState({
    clienteNombre: "",
    clienteApellido: "",
    clienteContacto: "",
    clienteCorreo: "",
    detalle: "",
    accion: 0,
  });

  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    const fetchMembers = async () => {
      const { data, error } = await supabase
        .from("Miembros")
        .select("*")
        .order("created_at", { ascending: true });
      if (!error && data) setMembers(data);
    };
    fetchMembers();
  }, []);

  const submitTicket = async () => {
    if (!selectedAccion || selectedMember === null) return;
    if (loading) return;
    setLoading(true);

    try {
      // 1️⃣ Verificar cliente existente
      const { data: existingClient, error: selectError } = await supabase
        .from("Clientes")
        .select("*")
        .eq("CorreoElectronico", formData.clienteCorreo)
        .single();

      if (selectError && selectError.code !== "PGRST116") {
        console.error("Error al verificar cliente:", selectError);
      }

      let clienteId: number;

      // 2️⃣ Crear cliente si no existe
      if (!existingClient) {
        // 🚀 Enviar datos al flujo Power Automate solo si el cliente es nuevo
        await fetch("https://ecc5f0d6fde7ef24ade927ef544fe2.0d.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/ad41a7f54b1c4c2f9cc987193a8b5496/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=KzX_ss8H8PkgEBKXqBA2R_Up8CFesQrJ08MSs6fwiXM", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: formData.clienteNombre,
            apellido: formData.clienteApellido,
            correo: formData.clienteCorreo,
            contacto: formData.clienteContacto,
            idFuenteMiembro: selectedAccion?.idFuente
          })
        });

        const { data: newClient, error: insertClientError } = await supabase
          .from("Clientes")
          .insert({
            Nombre: formData.clienteNombre,
            Apellido: formData.clienteApellido,
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

        clienteId = newClient.id;
      } else {
        clienteId = existingClient.id;
      }

      // 3️⃣ Crear ticket
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

      // 4️⃣ Obtener número del miembro
      const { data: miembroDB, error: miembroError } = await supabase
        .from("Miembros")
        .select("celular, Nombre")
        .eq("id", selectedMember)
        .single();

      if (miembroError) {
        console.error("Error al obtener número del miembro:", miembroError);
        return;
      }

      const numeroDestino =
        miembroDB?.celular?.replace("+", "") || "593992706933";

      // 5️⃣ Generar mensaje de WhatsApp
      const mensaje = `Hola, soy ${formData.clienteNombre}.
He generado un ticket para la acción *${selectedAccion.Accion}* con ${miembroDB?.Nombre}.
Detalles del requerimiento:
${formData.detalle}

Mi correo: ${formData.clienteCorreo}
Mi contacto: ${formData.clienteContacto}`;

      // ✅ Abrir WhatsApp según el dispositivo
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const whatsappURL = isMobile
        ? `whatsapp://send?phone=${numeroDestino}&text=${encodeURIComponent(
            mensaje
          )}`
        : `https://wa.me/${numeroDestino}?text=${encodeURIComponent(mensaje)}`;

      window.location.href = whatsappURL;

      // 6️⃣ Limpiar y cerrar
      alert("Ticket creado correctamente!");
      setShowForm(false);
      setSelectedAccion(null);
      setSelectedMember(null);
      setFormData({
        clienteNombre: "",
        clienteApellido: "",
        clienteContacto: "",
        clienteCorreo: "",
        detalle: "",
        accion: 0,
      });
      onClose();
    } catch (error) {
      console.error("Error general:", error);
    }

    setLoading(false);
  };

  return (
    <div className={style.formFloating}>
      <h2 className="AccionesTitulo">GENERA TU TICKET</h2>
      <form
        className={style.FormularioSolicitud}
        onSubmit={async (e) => {
          e.preventDefault();
          await submitTicket();
        }}
      >
        <label>
          Nombre:
          <input
            type="text"
            value={formData.clienteNombre}
            onChange={(e) =>
              setFormData({ ...formData, clienteNombre: e.target.value })
            }
            required
          />
        </label>

        <label>
          Apellido:
          <input
            type="text"
            value={formData.clienteApellido}
            onChange={(e) =>
              setFormData({ ...formData, clienteApellido: e.target.value })
            }
            required
          />
        </label>

        <label>
          Número de contacto:
          <input
            type="text"
            value={formData.clienteContacto}
            onChange={(e) =>
              setFormData({ ...formData, clienteContacto: e.target.value })
            }
            required
          />
        </label>

        <label>
          Correo electrónico:
          <input
            type="email"
            value={formData.clienteCorreo}
            onChange={(e) =>
              setFormData({ ...formData, clienteCorreo: e.target.value })
            }
            required
          />
        </label>

        <label>
          Detalle del requerimiento:
          <textarea
            value={formData.detalle}
            onChange={(e) =>
              setFormData({ ...formData, detalle: e.target.value })
            }
            required
          />
        </label>

        <button type="submit" className={style.BotonEnviar} disabled={loading}>
          {loading ? "Enviando..." : "Enviar solicitud"}
        </button>
      </form>
    </div>
  );
};

export default Formulario1;