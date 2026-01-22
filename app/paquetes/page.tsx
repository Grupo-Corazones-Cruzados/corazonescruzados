"use client";

import React, { useState } from "react";
import Encabezado from "app/components/Encabezado";
import CPaquetes, { ObjetoResumenPaquete } from "app/components/CtPaquetes";
import ModalPaquete from "app/components/ModalPaquete";
import ScrollReveal from "app/components/ScrollReveal";

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
        {/* Encabezado (cerrado por defecto en esta página) */}
        <Encabezado />

        {/* Contenido de paquetes */}
        <ScrollReveal>
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
        </ScrollReveal>

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
