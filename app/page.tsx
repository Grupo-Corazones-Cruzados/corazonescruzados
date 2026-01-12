/* app/page.tsx (COPIA Y PEGA COMPLETO)
   FIX: tenías un typo en el contenedor:
   "containes" -> "container"
*/

"use client";

import React, { useState } from "react";
import Encabezado from "app/components/Encabezado";
import Miembros from "app/components/Miembros";
import Estructura from "app/components/Estructura";
import ModalAcciones from "app/components/ModalAcciones";
import type { ObjetoResumenPaquete } from "app/components/CtPaquetes";

interface Accion {
  id: number;
  Accion: string;
  idMiembro: number;
  idFuente: number;
}

export default function Page() {
  const [selectedMember, setSelectedMember] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedAccion, setSelectedAccion] = useState<Accion | null>(null);
  const [objetoMiembro, setObjetoMiembro] = useState<ObjetoResumenPaquete | null>(null);

  return (
    <main className="appMain">
      {/* ✅ AQUÍ ESTÁ EL FIX */}
      <div className="container stack">
        {/* HERO / HEADER */}
        <section className="section sectionHero">
          <Encabezado />
        </section>

        {/* MODAL (solo cuando hay selección) */}
        {selectedMember && objetoMiembro && (
          <ModalAcciones
            selectedMember={selectedMember}
            showForm={showForm}
            setShowForm={setShowForm}
            selectedAccion={selectedAccion}
            setSelectedAccion={setSelectedAccion}
            onClose={() => {
              setSelectedMember(null);
              setShowForm(false);
              setSelectedAccion(null);
              setObjetoMiembro(null);
            }}
            objetoMiembro={objetoMiembro}
          />
        )}

        {/* SECCIÓN: Miembros */}
        <section className="section">
          <div className="sectionHeader">
            <div>
              <h2 className="sectionTitle">Miembros</h2>
              <p className="sectionSubtitle">
                Selecciona un miembro para ver acciones, solicitar ayuda o iniciar un ticket.
              </p>
            </div>
          </div>

          <Miembros
            selectedMember={selectedMember}
            setSelectedMember={setSelectedMember}
            objetoMiembro={objetoMiembro}
            setObjetoMiembro={setObjetoMiembro}
          />
        </section>

        {/* SECCIÓN: Estructura / Servicios */}
        <section className="section">
          <div className="sectionHeader">
            <div>
              <h2 className="sectionTitle">Organización</h2>
              <p className="sectionSubtitle">Conoce más sobre el proyecto...</p>
            </div>
          </div>

          <Estructura />
        </section>

        <div style={{ height: 18 }} />
      </div>
    </main>
  );
}