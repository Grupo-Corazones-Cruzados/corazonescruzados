"use client";

import React, { useState } from "react";
import Encabezado from "app/components/Encabezado";
import Formulario2 from "app/components/Formulario2";
import ScrollReveal from "app/components/ScrollReveal";
import style from "app/styles/Formualrio2.module.css";

export default function Nosotros() {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  return (
    <main className="appMain">
      <div className="container stack">
        {/* Header (cerrado por defecto en esta página) */}
        <Encabezado />

        {/* CTA + Modal */}
        <ScrollReveal>
          <section className="section">
            {!mostrarFormulario && (
              <div className={style.botonContainer}>
                <button
                  type="button"
                  className={style.botonInicio}
                  onClick={() => setMostrarFormulario(true)}
                >
                  ¿Tienes motivos para unirte a este proyecto?
                </button>
              </div>
            )}

            <Formulario2
              visible={mostrarFormulario}
              setVisible={setMostrarFormulario}
              onClose={() => setMostrarFormulario(false)}
            />
          </section>
        </ScrollReveal>
      </div>
    </main>
  );
}
