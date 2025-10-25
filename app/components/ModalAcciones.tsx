"use client";
import React from "react";
import Acciones from "./Acciones";
import Formulario1 from "./Formulario1";
import style from "app/styles/ModalAcciones.module.css";

interface ModalAccionesProps {
  selectedMember: number | null;
  showForm: boolean;
  setShowForm: React.Dispatch<React.SetStateAction<boolean>>;
  selectedAccion: any;
  setSelectedAccion: React.Dispatch<React.SetStateAction<any>>;
  onClose: () => void;
  objetoMiembro: any; // <-- nueva prop
}

const ModalAcciones: React.FC<ModalAccionesProps> = ({
  selectedMember,
  showForm,
  setShowForm,
  selectedAccion,
  setSelectedAccion,
  onClose,
  objetoMiembro, // <-- agrégalo aquí
}) => {
  if (!selectedMember) return null;

  return (
    <div className={style.Overlay}>

      <div className={style.Modal}>
        <button className={style.Cerrar} onClick={onClose}>✕</button>

        <div className={style.Contenido}>
          {/* Columna izquierda: información del miembro */}
          <div className={style.ColumnaIzquierda}>
            <div className={style.InfoMiembro}>
              {objetoMiembro?.Foto && (
                <img
                  src={objetoMiembro.Foto}
                  alt={objetoMiembro.Nombre}
                  className={style.MiembroFoto}
                />
              )}
              <div>
                <p className={style.Nombre}>{objetoMiembro?.Nombre}</p>
                <p className={style.Puesto}>{objetoMiembro?.Puesto}</p>
              </div>
            </div>

            {selectedAccion && (
              <div className={style.CuadroAccion}>
                <p className={style.TituloAccion}>Acción seleccionada</p>
                <p className={style.TextoAccion}>{selectedAccion.Accion}</p>
              </div>
            )}
          </div>

          {/* Columna derecha: selección de acción o formulario */}
          <div className={style.ColumnaDerecha}>
            {!showForm ? (
              <Acciones
                selectedMember={selectedMember}
                showForm={showForm}
                setShowForm={setShowForm}
                selectedAccion={selectedAccion}
                setSelectedAccion={setSelectedAccion}
              />
            ) : (
              <Formulario1
                selectedMember={selectedMember}
                setSelectedMember={() => { }}
                showForm={showForm}
                setShowForm={setShowForm}
                selectedAccion={selectedAccion}
                setSelectedAccion={setSelectedAccion}
                onClose={onClose}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalAcciones;