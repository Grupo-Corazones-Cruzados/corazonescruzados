"use client"

import React, { useEffect, useState } from "react";
import style from "app/styles/Estructura.module.css"

const Estructura = () => {
  const [activeCard, setActiveCard] = useState<number | null>(null);

    const cards = [
    {
        id: 1,
        title: "Desarrollo Humano",
        summary: "Nos apasiona crear soluciones sostenibles para el progreso de cada persona.",
        details: "El grupo corazones cruzados es un proyecto de desarrollo humano que tiene la finalidad de ofrecer un espacio de crecimiento para sus miembros. Para lograr este objetivo, el grupo se enfoca en descubrir, y aplicar estrategias que logren mejorar las competencias que tiene cada sujeto para gestionar sus problemas."
    },
    {
        id: 2,
        title: "Modelo Organizacional",
        summary: "Buscamos liderar la gestión del talento a través de un proyecto centralizado.",
        details: "El grupo está gestionado por un modelo organizacional que sirve para organizar a la gente a través de un proyecto centralizado. Para controlar este proyecto, se utilizan sistemas que entregan beneficios a los miembros, a cambio de logros por completar tareas o sostener proyectos. Su principal función en la organización, es aplicar un modelo de gestión sostenible que aproveche la necesidad de cada sujeto; siendo ésta, el motor principal de transformación."
    },
    {
        id: 3,
        title: "Estructura Organizacional",
        summary: "Basado en el Modelo 4P (pisos y pasos) para guiar el crecimiento del grupo.",
        details: "El grupo está compuesto por roles que establecen las características de cada miembro. Dichos roles sirven para realizar diversas composiciones según el proyecto y la necesidad. Cada rol puede tener un listado de tareas a completar según el área de acción, y solo cuando las tareas han sido asignadas a cada rol, se puede definir cada piso del proyecto. Luego de eso, cuando el área de acción de cada piso esté funcionando sin errores o problemas, se puede agrupar los pisos en diferentes pasos. Estos pisos y pasos definen la fórmula de éxito para cada proyecto."
    },
    {
        id: 4,
        title: "Metodología",
        summary: "Usamos la Condiciología como fundamento para estructurar, diseñar, y gestionar las acciones.",
        details: "Esta metodología buscar reconocer, aprovechar y predecir las condiciones; ésto, con el fin de establecer una lógica del comportamiento, ya que cada proyecto requiere una interpretación para justificar sus resultados. Por otra parte, cada sujeto es evaluado mediante la metodología condiciológica, permitiendo valorar su dominio en la ejecución de tareas, y su aplicación para hacer sostenible una acción o proyecto."
    }

];



return (
<div>
    <div className={style.ContenedorTarjeta}>
        {cards.map(card => (
            <div
                key={card.id}
                className={style.Tarjeta}
                onClick={() => setActiveCard(card.id)}
                onMouseEnter={e => e.currentTarget.classList.add(style.TarjetaHover)}
                onMouseLeave={e => e.currentTarget.classList.remove(style.TarjetaHover)}
            >
                <h3 className={style.TarjetaTitulo}>{card.title}</h3>
                <p className={style.TarjetaResumen}>{card.summary}</p>
            </div>
        ))}
    </div>

      {activeCard !== null && (
        <div className={style.Overlay} onClick={() => setActiveCard(null)}>
            <div onClick={e => e.stopPropagation()} className={style.OverlayContenido}>
                <button onClick={() => setActiveCard(null)} className={style.CerrarBoton} aria-label="Cerrar">×</button>
                <h2 className={style.OverlayTitulo}>{cards.find(c => c.id === activeCard)?.title}</h2>
                <p className={style.OverlayDetalles}>{cards.find(c => c.id === activeCard)?.details}</p>
            </div>
        </div>
    
    )};
</div>
);};


export default Estructura;


