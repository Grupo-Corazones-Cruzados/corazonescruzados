/* =========================
   app/components/CtPaquetes.tsx (REDISEÑO PRO SaaS)
   - Paquetes arriba (cards)
   - Miembros abajo SOLO cuando hay paquete seleccionado
   - Mejor UX: botones accesibles, resumen de selección
   Copia y pega COMPLETO (reemplaza tu archivo actual)
   ========================= */

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import styles from "app/styles/Paquetes.module.css";
import Miembros from "app/components/Miembros";

export interface ObjetoResumenPaquete {
  id: number;
  nombre: string;
  puesto: string;
  descripcion: string;
  foto: string | null;
  correo: string;
  id_fuente: number;
  costo: number;
  cod_usuario?: string;
}

interface Paquete {
  id: number;
  nombre: string;
  contenido: string;
  horas: number;
  descripcion: string;
  descuento: number;
}

interface Props {
  selectedMember: number | null;
  setSelectedMember: React.Dispatch<React.SetStateAction<number | null>>;

  setObjetoMiembro: (m: ObjetoResumenPaquete | null) => void;
  objetoMiembro: ObjetoResumenPaquete | null;

  selectedPaquete: Paquete | null;
  setSelectedPaquete: React.Dispatch<React.SetStateAction<Paquete | null>>;

  onOpenSolicitud: () => void;
}

export default function CPaquetes({
  selectedMember,
  setSelectedMember,
  objetoMiembro,
  setObjetoMiembro,
  selectedPaquete,
  setSelectedPaquete,
  onOpenSolicitud,
}: Props) {
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPaquetes = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("paquetes")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error al cargar paquetes:", error);
        setError("No se pudieron cargar los paquetes.");
        setPaquetes([]);
      } else {
        setPaquetes((data as Paquete[]) ?? []);
      }

      setLoading(false);
    };

    fetchPaquetes();
  }, []);

  const contenidoList = useMemo(() => {
    if (!selectedPaquete?.contenido) return [];
    return selectedPaquete.contenido.split(";").map((t) => t.trim()).filter(Boolean);
  }, [selectedPaquete]);

  return (
    <section className={styles.page}>
      {/* ===== Header / Resumen ===== */}
      <div className={styles.sectionHeader}>
        <div>
          <div className={styles.kicker}>Paquetes</div>
          <h1 className={styles.sectionTitle}>Selecciona un paquete</h1>
          <p className={styles.sectionSubtitle}>
            Elige el paquete y luego selecciona un miembro para continuar.
          </p>
        </div>

        <div className={styles.summaryBar}>
          <div className={styles.summaryPill}>
            <span className={styles.summaryLabel}>Paquete</span>
            <span className={styles.summaryValue}>{selectedPaquete?.nombre ?? "—"}</span>
          </div>
          <div className={styles.summaryPill}>
            <span className={styles.summaryLabel}>Miembro</span>
            <span className={styles.summaryValue}>{objetoMiembro?.nombre ?? "—"}</span>
          </div>
        </div>
      </div>

      {/* ===== Grid de paquetes ===== */}
      {loading ? (
        <div className={styles.state}>
          <div className={styles.spinner} aria-hidden="true" />
          <p>Cargando paquetes…</p>
        </div>
      ) : error ? (
        <div className={styles.stateError} role="alert">
          <p className={styles.errorTitle}>Error</p>
          <p className={styles.errorText}>{error}</p>
        </div>
      ) : (
        <div className={styles.cardsContainer}>
          {paquetes.map((p) => {
            const isSelected = selectedPaquete?.id === p.id;
            const benefits = p.contenido
              ? p.contenido.split(";").map((t) => t.trim()).filter(Boolean).slice(0, 6)
              : [];

            return (
              <button
                key={p.id}
                type="button"
                className={`${styles.paqueteCard} ${isSelected ? styles.paqueteSeleccionado : ""}`}
                onClick={() => {
                  setSelectedPaquete(p);
                  // Si cambias de paquete, reset de miembro seleccionado para evitar confusión
                  setSelectedMember(null);
                  setObjetoMiembro(null);
                }}
              >
                <div className={styles.paqueteHeader}>
                  <h3>{p.nombre}</h3>
                  <span className={styles.paqueteMeta}>
                    {p.horas ? `${p.horas}h` : "—"} · {p.descuento ? `${p.descuento}%` : "0%"}
                  </span>
                </div>

                <ul className={styles.paqueteLista}>
                  {benefits.map((texto, i) => (
                    <li key={i}>
                      <img src="/Icono de Corazón.png" alt="icono" /> {texto}
                    </li>
                  ))}
                </ul>

                <p className={styles.paqueteDescripcion}>{p.descripcion}</p>

                <div className={styles.paqueteCta}>
                  {isSelected ? "Seleccionado" : "Elegir paquete →"}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ===== Sección miembros (solo si hay paquete seleccionado) ===== */}
      <div className={styles.membersWrap}>
        {!selectedPaquete ? (
          <div className={styles.state}>
            <p>Selecciona un paquete para ver y elegir miembros disponibles.</p>
          </div>
        ) : (
          <div className={styles.membersCard}>
            <div className={styles.membersHeader}>
              <div>
                <div className={styles.kicker}>Miembros</div>
              
              </div>
            </div>

            <Miembros
              selectedMember={selectedMember}
              setSelectedMember={setSelectedMember}
              objetoMiembro={objetoMiembro}
              setObjetoMiembro={setObjetoMiembro}
            />

            <div className={styles.membersFooterBtns}>
              <button
                type="button"
                className={styles.primaryBtn}
                disabled={!selectedPaquete || !objetoMiembro}
                onClick={onOpenSolicitud}
              >
                Solicitar paquete
              </button>

              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => {
                  setSelectedPaquete(null);
                  setSelectedMember(null);
                  setObjetoMiembro(null);
                }}
              >
                Cambiar paquete
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}