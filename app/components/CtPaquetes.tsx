"use client";
import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import styles from "app/styles/Paquetes.module.css";
import Miembros from "app/components/Miembros";

export interface ObjetoResumenPaquete {
  id: number;
  Nombre: string;
  Puesto: string;
  Descripcion: string;
  Foto: string | null;
  Correo: string;
  idFuentes: number;
  Costo: number;
}

interface Paquete {
  id: number;
  Nombre: string;
  Contenido: string;
  Horas: number;
  Descripcion: string;
  Descuento: number;
  precioTotal?: number;
  precioConDescuento?: number;
  costoHora?: number;
  ahorroHora?: number;
}

interface PaquetesMiembros2 {
  selectedMember: number | null;
  setSelectedMember: React.Dispatch<React.SetStateAction<number | null>>;

  // ✅ Cambia esta línea
  setObjetoMiembro: (m: ObjetoResumenPaquete | null) => void;

  objetoMiembro: ObjetoResumenPaquete | null;
  selectedPaquete: Paquete | null;
  setSelectedPaquete: React.Dispatch<React.SetStateAction<Paquete | null>>;
}

const CPaquetes: React.FC<PaquetesMiembros2> = ({
  selectedMember,
  setSelectedMember,
  objetoMiembro,
  setObjetoMiembro,
  selectedPaquete,
  setSelectedPaquete,
}) => {
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);

  useEffect(() => {
    const fetchPaquetes = async () => {
      const { data, error } = await supabase
        .from("Paquetes")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error al cargar paquetes:", error);
      } else if (data) {
        setPaquetes(data);
      }
    };

    fetchPaquetes();
  }, []);

  return (
    <>
      {/* Componente de miembros */}
      {selectedPaquete ? <Miembros
        selectedMember={selectedMember}
        setSelectedMember={setSelectedMember}
        objetoMiembro={objetoMiembro}
        setObjetoMiembro={setObjetoMiembro}
      />:""}

      {/* Tarjetas de paquetes */}
      <div className={styles.cardsContainer}>
        {paquetes.map((p) => (
          <div
            key={p.id}
            className={`${styles.paqueteCard} ${
              selectedPaquete?.id === p.id ? styles.paqueteSeleccionado : ""
            }`}
            onClick={() => setSelectedPaquete(p)} // ← enviamos el objeto completo
          >
            <div className={styles.paqueteHeader}>
              <h3>{p.Nombre}</h3>
            </div>

            <ul className={styles.paqueteLista}>
              {p.Contenido.split(";").map((texto, i) => (
                <li key={i}>
                  <img src="/Icono de Corazón.png" alt="icono" /> {texto}
                </li>
              ))}
            </ul>

            <p className={styles.paqueteDescripcion}>{p.Descripcion}</p>
          </div>
        ))}
      </div>
    </>
  );
};

export default CPaquetes;