"use client";

import React, { useState, useRef, useEffect } from "react";
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

function IconFor({ id }: { id: number }) {
  const props = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (id) {
    case 1:
      return (
        <svg {...props}>
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      );
    case 2:
      return (
        <svg {...props}>
          <path d="M3 21h18" />
          <path d="M5 21V7l7-4 7 4v14" />
          <path d="M9 21v-6h6v6" />
          <path d="M9 9h1" />
          <path d="M14 9h1" />
          <path d="M9 13h1" />
          <path d="M14 13h1" />
        </svg>
      );
    case 3:
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 4:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2v4" />
          <path d="M12 18v4" />
          <path d="M2 12h4" />
          <path d="M18 12h4" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
}

function AccordionItem({
  card,
  index,
  isOpen,
  onToggle,
}: {
  card: Card;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(contentRef.current.scrollHeight);
    }
  }, [isOpen]);

  return (
    <div className={`${style.item} ${isOpen ? style.itemOpen : ""}`}>
      <button
        type="button"
        className={style.itemHeader}
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <div className={style.itemLeft}>
          <span className={style.itemNumber}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className={style.itemIcon} aria-hidden="true">
            <IconFor id={card.id} />
          </div>
          <div className={style.itemText}>
            <h3 className={style.itemTitle}>{card.title}</h3>
            <p className={style.itemSummary}>{card.summary}</p>
          </div>
        </div>

        <div className={style.itemToggle}>
          <svg
            className={style.chevron}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      <div
        className={style.itemContent}
        style={{ maxHeight: isOpen ? `${height}px` : "0px" }}
      >
        <div ref={contentRef} className={style.itemBody}>
          <p className={style.itemDetails}>{card.details}</p>
        </div>
      </div>
    </div>
  );
}

export default function Estructura() {
  const [openId, setOpenId] = useState<number | null>(null);

  const handleToggle = (id: number) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <section className={style.wrapper} aria-label="Estructura">
      <div className={style.accordion}>
        {CARDS.map((card, index) => (
          <AccordionItem
            key={card.id}
            card={card}
            index={index}
            isOpen={openId === card.id}
            onToggle={() => handleToggle(card.id)}
          />
        ))}
      </div>
    </section>
  );
}
