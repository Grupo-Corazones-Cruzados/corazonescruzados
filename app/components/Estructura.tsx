/* =========================
   app/components/Estructura.tsx (REDISEÑO PRO)
   - Misma funcionalidad: cards + modal
   - Mejor UX: ESC para cerrar, bloqueo de scroll, ARIA dialog
   Copia y pega completo
   ========================= */

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import style from "app/styles/Estructura.module.css";

type Card = {
  id: number;
  title: string;
  summary: string;
  details: string;
};

const CARDS: Card[] = [
  {
    id: 1,
    title: "Desarrollo Humano",
    summary: "Nos apasiona crear soluciones sostenibles para el progreso de cada persona.",
    details:
      "El grupo corazones cruzados es un proyecto de desarrollo humano que tiene la finalidad de ofrecer un espacio de crecimiento para sus miembros. Para lograr este objetivo, el grupo se enfoca en descubrir, y aplicar estrategias que logren mejorar las competencias que tiene cada sujeto para gestionar sus problemas.",
  },
  {
    id: 2,
    title: "Modelo Organizacional",
    summary: "Buscamos liderar la gestión del talento a través de un proyecto centralizado.",
    details:
      "El grupo está gestionado por un modelo organizacional que sirve para organizar a la gente a través de un proyecto centralizado. Para controlar este proyecto, se utilizan sistemas que entregan beneficios a los miembros, a cambio de logros por completar tareas o sostener proyectos. Su principal función en la organización, es aplicar un modelo de gestión sostenible que aproveche la necesidad de cada sujeto; siendo ésta, el motor principal de transformación.",
  },
  {
    id: 3,
    title: "Estructura Organizacional",
    summary: "Basado en el Modelo 4P (pisos y pasos) para guiar el crecimiento del grupo.",
    details:
      "El grupo está compuesto por roles que establecen las características de cada miembro. Dichos roles sirven para realizar diversas composiciones según el proyecto y la necesidad. Cada rol puede tener un listado de tareas a completar según el área de acción, y solo cuando las tareas han sido asignadas a cada rol, se puede definir cada piso del proyecto. Luego de eso, cuando el área de acción de cada piso esté funcionando sin errores o problemas, se puede agrupar los pisos en diferentes pasos. Estos pisos y pasos definen la fórmula de éxito para cada proyecto.",
  },
  {
    id: 4,
    title: "Metodología",
    summary: "Usamos la Condiciología como fundamento para estructurar, diseñar, y gestionar las acciones.",
    details:
      "Esta metodología buscar reconocer, aprovechar y predecir las condiciones; ésto, con el fin de establecer una lógica del comportamiento, ya que cada proyecto requiere una interpretación para justificar sus resultados. Por otra parte, cada sujeto es evaluado mediante la metodología condiciológica, permitiendo valorar su dominio en la ejecución de tareas, y su aplicación para hacer sostenible una acción o proyecto.",
  },
];

function iconFor(id: number) {
  switch (id) {
    case 1:
      return "🧠";
    case 2:
      return "🏛️";
    case 3:
      return "🧩";
    case 4:
      return "🧭";
    default:
      return "📌";
  }
}

export default function Estructura() {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  const activeCard = useMemo(
    () => (activeId ? CARDS.find((c) => c.id === activeId) ?? null : null),
    [activeId]
  );

  // Para que createPortal funcione en SSR
  useEffect(() => {
    setMounted(true);
  }, []);

  // Cerrar con ESC + bloquear scroll cuando modal está abierto
  useEffect(() => {
    if (!activeId) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveId(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeId]);

  return (
    <section className={style.wrapper} aria-label="Estructura">
      <div className={style.grid}>
        {CARDS.map((card) => (
          <button
            key={card.id}
            type="button"
            className={style.card}
            onClick={() => setActiveId(card.id)}
          >
            <div className={style.cardTop}>
              <div className={style.icon} aria-hidden="true">
                {iconFor(card.id)}
              </div>
              <div className={style.cardText}>
                <h3 className={style.title}>{card.title}</h3>
                <p className={style.summary}>{card.summary}</p>
              </div>
            </div>
            <div className={style.cardCta}>Ver detalle →</div>
          </button>
        ))}
      </div>

      {activeCard && mounted && createPortal(
        <div
          className={style.overlay}
          onClick={() => setActiveId(null)}
          role="presentation"
        >
          <div
            className={style.modal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={activeCard.title}
          >
            <div className={style.modalHeader}>
              <div className={style.modalHeading}>
                <div className={style.modalIcon} aria-hidden="true">
                  {iconFor(activeCard.id)}
                </div>
                <h2 className={style.modalTitle}>{activeCard.title}</h2>
              </div>

              <button
                type="button"
                className={style.close}
                onClick={() => setActiveId(null)}
                aria-label="Cerrar"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            <div className={style.modalBody}>
              <p className={style.details}>{activeCard.details}</p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}