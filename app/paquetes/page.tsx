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

  // ✅ Manejador para cuando se selecciona un miembro
  const handleSetObjetoMiembro = (m: ObjetoResumenPaquete | null) => {
    setObjetoMiembro(m);
    setSelectedMember(m ? m.id : null);

    // Si ya hay un paquete seleccionado, abrir el modal
    if (selectedPaquete) {
      setIsModalOpen(true);
    }
  };

  // ✅ Manejador para cuando se selecciona un paquete
  const handleSetSelectedPaquete = (p: any | null) => {
    setSelectedPaquete(p);

    // Si ya hay un miembro seleccionado, abrir el modal
    if (objetoMiembro) {
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <Encabezado />

      <CPaquetes
        setSelectedPaquete={handleSetSelectedPaquete}
        selectedPaquete={selectedPaquete}
        selectedMember={selectedMember}
        setSelectedMember={setSelectedMember}
        setObjetoMiembro={handleSetObjetoMiembro}
        objetoMiembro={objetoMiembro}
      />

      <ModalPaquete
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        miembro={objetoMiembro}
        paquete={selectedPaquete}
      />
    </>
  );
}