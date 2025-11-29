"use client";
import React, { useState } from "react";
import Encabezado from "app/components/Encabezado";
import Miembros from "app/components/Miembros";
import Acciones from "app/components/Acciones";
import Formulario1 from "./components/Formulario1";
import Estructura from "app/components/Estructura"
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

  return(
    <main>
<Encabezado />

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
    objetoMiembro={objetoMiembro} // <-- agrega esta línea
  />
)}


<Miembros 
selectedMember={selectedMember}
setSelectedMember={setSelectedMember}
objetoMiembro={objetoMiembro}
setObjetoMiembro={setObjetoMiembro}
/>

<Estructura />


    </main>
  );
}