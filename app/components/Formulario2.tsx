"use client";

import React, { useState } from "react";
import style from "app/styles/Formualrio2.module.css";
import { supabase } from "lib/supabaseClient";

export default function Formulario2({ visible }: { visible: boolean }) {
  const [motivo, setMotivo] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!motivo.trim()) {
      setErrorMsg("Por favor, escribe tu motivo antes de enviar.");
      return;
    }

    setErrorMsg("");

    const { error } = await supabase
      .from("Aspirantes")
      .insert([{ Motivo: motivo }]);

    if (error) console.error("Error al guardar:", error.message);
    else {
      setMotivo("");
      alert("Motivo enviado correctamente");
    }
  };

  return (
    <div>
      {visible && (
        <div className={style.formWrapper}>
          <form className={style.formulario} onSubmit={handleSubmit}>
            <label className={style.etiquetas}>
              Dinos quién eres
              <textarea
                className={style.areaTexto}
                placeholder="Escribe aquí tus motivos para unirte al proyecto..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
              {errorMsg && (
                <p className={style.mensajeError}>{errorMsg}</p>
              )}
            </label>

            <button className={style.botones} type="submit">
              Enviar
            </button>
          </form>
        </div>
      )}
    </div>
  );
}