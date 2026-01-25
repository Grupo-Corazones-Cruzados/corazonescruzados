"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Acciones from "./Acciones";
import Formulario1 from "./Formulario1";
import styles from "app/styles/ModalAcciones.module.css";

interface Accion {
  id: number;
  nombre: string;
  id_miembro: number;
  id_fuente: number;
}

interface ModalAccionesProps {
  selectedMember: number | null;
  showForm: boolean;
  setShowForm: React.Dispatch<React.SetStateAction<boolean>>;
  selectedAccion: Accion | null;
  setSelectedAccion: React.Dispatch<React.SetStateAction<Accion | null>>;
  onClose: () => void;
  objetoMiembro: any;
}

const ModalAcciones: React.FC<ModalAccionesProps> = ({
  selectedMember,
  showForm,
  setShowForm,
  selectedAccion,
  setSelectedAccion,
  onClose,
  objetoMiembro,
}) => {
  const [mounted, setMounted] = useState(false);

  // Para que createPortal funcione en SSR
  useEffect(() => {
    setMounted(true);
  }, []);

  // Bloquea scroll + ESC para cerrar
  useEffect(() => {
    if (!selectedMember) return;

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
  }, [onClose, selectedMember]);

  // No renderiza si no hay miembro (después de hooks)
  if (!selectedMember || !mounted) return null;

  const nombre = objetoMiembro?.nombre || "Miembro";
  const puesto = objetoMiembro?.puesto || "";
  const usuario = objetoMiembro?.cod_usuario || "";
  const descripcion = objetoMiembro?.descripcion || "";
  const foto = objetoMiembro?.foto || null;

  return createPortal(
    <div className={styles.Overlay} role="presentation" onClick={onClose}>
      <div className={styles.Modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className={styles.ModalHeader}>
          <div>
            <div className={styles.ModalKicker}>Soporte & Tickets</div>
          </div>

          <button className={styles.Cerrar} onClick={onClose} aria-label="Cerrar">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </header>

        <div className={styles.Contenido}>
          {/* Columna izquierda: info del miembro */}
          <aside className={styles.ColumnaIzquierda}>
            <div className={styles.InfoMiembro}>
              {foto ? (
                <img src={foto} alt={nombre} className={styles.MiembroFoto} />
              ) : (
                <div className={styles.MiembroAvatarPlaceholder} aria-hidden="true">
                  {(nombre?.[0] || "?").toUpperCase()}
                </div>
              )}

              <div>
                <p className={styles.Nombre}>{nombre}</p>
                {puesto && <p className={styles.Puesto}>{puesto}</p>}
                {usuario && <p className={styles.MemberUser}>{usuario}</p>}
              </div>
            </div>

            {descripcion && <p className={styles.MemberDesc}>{descripcion}</p>}

            

                       <div className={styles.AccionesFooterBtns}>
                <button
                  type="button"
                  className={styles.CrearTicketBtn}
                  disabled={!selectedAccion}
                  onClick={() => setShowForm(true)}
                >
                  Crear ticket
                </button>

<a
  className={styles.MarketBtn}
  href={`/mercado?miembro=${encodeURIComponent(String(selectedMember))}`}
>
  Ir a Portafolio
</a>
              </div>
              




            <div className={styles.HelpBox}>
              <div className={styles.HelpTitle}>Flujo</div>
              <ol className={styles.HelpList}>
                <li>Selecciona una acción.</li>
                <li>Completa el formulario.</li>
                <li>Se crea el ticket y se abre WhatsApp con el mensaje listo.</li>
              </ol>
            </div>
          </aside>



          {/* Columna derecha: acciones */}
          <section className={styles.ColumnaDerecha}>
            <Acciones
              selectedMember={selectedMember}
              selectedAccion={selectedAccion}
              setSelectedAccion={setSelectedAccion}
            />
            <div className={styles.AccionesFooter}>
              <div className={styles.AccionSeleccionInfo}>
                {selectedAccion ? (
                  <span>
                    Acción seleccionada: <b>{selectedAccion.nombre}</b>
                  </span>
                ) : (
                  <span className={styles.AccionSeleccionMuted}>Selecciona una acción para continuar.</span>
                )}
              </div>

     
            </div>
          </section>
        </div>

        {/* Formulario (modal propio) */}
        <Formulario1
          selectedMember={selectedMember}
          setSelectedMember={() => {}}
          showForm={showForm}
          setShowForm={setShowForm}
          selectedAccion={selectedAccion as any}
          setSelectedAccion={setSelectedAccion as any}
          onClose={onClose}
        />
      </div>
    </div>,
    document.body
  );
};

export default ModalAcciones;