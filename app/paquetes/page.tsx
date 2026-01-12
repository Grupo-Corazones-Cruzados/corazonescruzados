/* =========================
   app/paquetes/page.tsx (CORREGIDO)
   - Encabezado se renderiza EXACTAMENTE igual que en la página de inicio,
     porque lo envolvemos con los mismos wrappers: appMain + container + sectionHero.
   Copia y pega COMPLETO (reemplaza tu archivo actual)
   ========================= */

"use client";

import React, { useState } from "react";
import Encabezado from "app/components/Encabezado";
import CPaquetes, { ObjetoResumenPaquete } from "app/components/CtPaquetes";
import ModalPaquete from "app/components/ModalPaquete";

export default function Paquetes() {
  const [selectedMember, setSelectedMember] = useState<number | null>(null);
  const [objetoMiembro, setObjetoMiembro] = useState<ObjetoResumenPaquete | null>(null);
  const [selectedPaquete, setSelectedPaquete] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleSetObjetoMiembro = (m: ObjetoResumenPaquete | null) => {
    setObjetoMiembro(m);
    setSelectedMember(m ? m.id : null);
  };

  const handleSetSelectedPaquete = (p: any | null) => {
    setSelectedPaquete(p);
  };

  return (
    <main className="appMain">
      <div className="container stack">
        {/* ✅ Encabezado igual que en Home */}
        <section className="section sectionHero">
          <Encabezado />
        </section>

        {/* Contenido de paquetes */}
        <section className="section">
          <CPaquetes
            setSelectedPaquete={handleSetSelectedPaquete}
            selectedPaquete={selectedPaquete}
            selectedMember={selectedMember}
            setSelectedMember={setSelectedMember}
            setObjetoMiembro={handleSetObjetoMiembro}
            objetoMiembro={objetoMiembro}
            onOpenSolicitud={() => setIsModalOpen(true)}
          />
        </section>

        <ModalPaquete
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedMember(null);
            setObjetoMiembro(null);
          }}
          miembro={objetoMiembro}
          paquete={selectedPaquete}
        />
      </div>
    </main>
  );
}