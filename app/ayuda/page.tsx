"use client";

import React, { useEffect, useState } from "react";
import styles from "app/styles/Ayuda.module.css";
import Encabezado from "app/components/Encabezado";
import ScrollReveal from "app/components/ScrollReveal";

interface Pregunta {
  id: number;
  pregunta: string;
  respuesta: string;
  video_url?: string;
}

const AyudaPage: React.FC = () => {
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetchPreguntas = async () => {
      try {
        const response = await fetch("/api/faq");
        const data = await response.json();
        if (response.ok) {
          setPreguntas(data.preguntas || []);
        } else {
          console.error("Error al cargar preguntas frecuentes:", data.error);
        }
      } catch (error) {
        console.error("Error al cargar preguntas frecuentes:", error);
      }
    };

    fetchPreguntas();
  }, []);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <main className="appMain">
      <div className="container stack">
        <Encabezado />

        <ScrollReveal>
          <section className="section">
            <div className={styles.container}>
              <h1 className={styles.title}>Preguntas Frecuentes</h1>
              <p className={styles.subtitle}>
                Encuentra respuestas rápidas. Si necesitas ayuda adicional, crea un ticket desde el inicio.
              </p>

              <div className={styles.faqList}>
                {preguntas.map((item, index) => {
                  const isOpen = openIndex === index;

                  return (
                    <div key={item.id} className={styles.faqItem}>
                      <button
                        type="button"
                        className={`${styles.faqQuestion} ${isOpen ? styles.active : ""}`}
                        onClick={() => toggleFaq(index)}
                        aria-expanded={isOpen}
                      >
                        {item.pregunta}
                      </button>

                      <div className={`${styles.faqAnswer} ${isOpen ? styles.open : ""}`}>
                        <div className={styles.faqAnswerInner}>
                          {item.respuesta}

                          {item.video_url && (
                            <div className={styles.videoWrapper}>
                              <iframe
                                src={item.video_url.replace("watch?v=", "embed/")}
                                title="YouTube video player"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </ScrollReveal>
      </div>
    </main>
  );
};

export default AyudaPage;
