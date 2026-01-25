"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "lib/supabaseClient";
import styles from "app/styles/Acciones.module.css";

interface Accion {
  id: number;
  nombre: string;
  id_miembro: number;
  id_fuente: number;
}

interface Props {
  selectedMember: number | null;
  selectedAccion: Accion | null;
  setSelectedAccion: React.Dispatch<React.SetStateAction<Accion | null>>;
}

export default function Acciones({
  selectedMember,
  selectedAccion,
  setSelectedAccion,
}: Props) {
  const [acciones, setAcciones] = useState<Accion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAcciones = async () => {
      if (!selectedMember) {
        setAcciones([]);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from("acciones")
        .select("*")
        .eq("id_miembro", Number(selectedMember))
        .order("nombre", { ascending: true });

      if (error) {
        console.error("Error al cargar acciones:", error);
        setAcciones([]);
      } else {
        setAcciones((data as Accion[]) || []);
      }
      setLoading(false);
    };

    fetchAcciones();
  }, [selectedMember]);

  return (
    <section className={styles.section} aria-label="Acciones disponibles">
      <div className={styles.headerRow}>
        <div>
          <div className={styles.kicker}>Acciones</div>
          <h2 className={styles.title}>Selecciona la acción requerida</h2>
       
        </div>
      </div>

      {loading ? (
        <div className={styles.state}>
          <div className={styles.spinner} aria-hidden="true" />
          <p>Cargando acciones…</p>
        </div>
      ) : acciones.length === 0 ? (
        <div className={styles.state}>
          <p>No hay acciones registradas.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {acciones.map((accion) => {
            const selected = selectedAccion?.id === accion.id;

            return (
              <button
                key={accion.id}
                type="button"
                className={`${styles.card} ${selected ? styles.cardSelected : ""}`}
                onClick={() => {
                  setSelectedAccion(accion);
                }}
                aria-pressed={selected}
              >
                <div className={styles.cardTitle}>{accion.nombre}</div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}