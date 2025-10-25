"use client";
import React, { useState, useEffect } from "react";
import styles from "app/styles/Ayuda.module.css";
import { supabase } from "@/lib/supabaseClient";
import Encabezado from "app/components/Encabezado";

interface Pregunta {
  id: number;
  Pregunta: string;
  Respuesta: string;
}

const AyudaPage: React.FC = () => {
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchPreguntas = async () => {
      const { data, error } = await supabase
        .from("PreguntasFrecuentes")
        .select("id, Pregunta, Respuesta")
        .order("id", { ascending: true });

      if (error) {
        console.error("Error al cargar preguntas frecuentes:", error);
      } else if (data) {
        setPreguntas(data);
      }
    };

    fetchPreguntas();
  }, []);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (

    <>
    <Encabezado />
    <div className={styles.container}>
      <h1 className={styles.title}>Preguntas Frecuentes</h1>
      <div>
        {preguntas.map((item, index) => (
          <div key={item.id} className={styles.faqItem}>
            <div
              className={`${styles.faqQuestion} ${openIndex === index ? styles.active : ""}`}
              onClick={() => toggleFaq(index)}
            >
              {item.Pregunta}
            </div>
            <div className={`${styles.faqAnswer} ${openIndex === index ? styles.open : ""}`}>
              {item.Respuesta}
            </div>
          </div>
        ))}
      </div>
    </div>
    </>
  );
};

export default AyudaPage;