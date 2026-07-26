'use client';

import { useEffect, useRef, useState } from 'react';
import EncuadreCondiciologicoSystem from '@/components/centralized/systems/EncuadreCondiciologicoSystem';

/**
 * Pestaña "Listas" del admin — las LISTAS GLOBALES del proyecto (talentos, valores,
 * materias, situaciones, acciones, intenciones, estados, lugares, procesos mentales y
 * moldes).
 *
 * NO reimplementa el editor: monta el mismo componente que usa el sistema Encuadre
 * Condiciológico (`components/centralized/systems/EncuadreCondiciologicoSystem.tsx`),
 * que es la definición única. Las listas son las mismas y viven en las tablas `gd_*`;
 * editarlas aquí o allá es idéntico. Este panel solo aporta el **alto**: mide el espacio
 * libre hasta la barra de ruta fija del dashboard, igual que el panel de Fuentes.
 */
export default function ListasPanel() {
  const boxRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();

  useEffect(() => {
    const compute = () => {
      const el = boxRef.current;
      if (!el) return;
      const bar = document.querySelector('nav[aria-label="Ruta"]');
      const barH = bar ? bar.getBoundingClientRect().height : 0;
      const h = Math.max(window.innerHeight - el.getBoundingClientRect().top - barH - 12, 320);
      setHeight((prev) => (prev === undefined || Math.abs(prev - h) > 1 ? h : prev));
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);

  return (
    <div ref={boxRef} style={{ height }}>
      <EncuadreCondiciologicoSystem fill />
    </div>
  );
}
