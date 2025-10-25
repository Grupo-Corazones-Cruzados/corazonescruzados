"use client";

import React, { useState } from "react";
import Encabezado from "../components/Encabezado";
import Formulario2 from "app/components/Formulario2";
import style from "app/styles/Formualrio2.module.css";

export default function Nosotros() {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  return (
    <div className={`${mostrarFormulario ? style.expandido : ""}`}>
      <div className={style.encabezadoContainer}>
        <Encabezado />

          {!mostrarFormulario && (
          <div className={style.botonContainer}>
            <button
              className={style.botonInicio}
              onClick={() => setMostrarFormulario(true)}
            >
              ¿Tienes motivos para unirte a este proyecto?
            </button>
          </div>
        )}

        
        <div className={style.formularioContainer}>
        
        <Formulario2 visible={mostrarFormulario} />
        </div>
      </div>
     

      
    </div>
  );
}