'use client';

/**
 * LOS DOS MUNDOS COMO SECCIONES — la pantalla de inicio en TODA la app (Fernando, 2026-10-28:
 * le gustó el panel de texto en escritorio y no las imágenes; «reformula por completo para una
 * app completa»). Cada mundo se presenta solo con texto: etiqueta, título grande, descripción,
 * tres ventajas y un botón. Escritorio: una mitad cada uno, centrado en ella. Teléfono: Aventura
 * arriba (cielo) y Progreso abajo (Plataforma), con la frontera líquida entre los dos.
 * Sustituye a `TarjetasMundo` (borrada) y a las vistas previas con dibujos.
 */

import { useState } from 'react';
import { ArrowRight, BarChart3, CheckCircle2, Compass, FolderKanban, Swords, Users } from 'lucide-react';

type Mundo = 'aventura' | 'progreso';

const MUNDOS: Record<Mundo, {
  etiqueta: string;
  titulo: string;
  descripcion: string;
  ventajas: { Icono: typeof Compass; texto: string }[];
  boton: string;
}> = {
  aventura: {
    etiqueta: 'Juego',
    titulo: 'Aventura',
    descripcion: 'Explora el mundo de GCC con tu personaje y crece con cada decisión.',
    ventajas: [
      { Icono: Compass, texto: 'Misiones y retos de desarrollo' },
      { Icono: Swords, texto: 'Tu personaje, a tu manera' },
      { Icono: Users, texto: 'Comunidad y compañeros' },
    ],
    boton: 'Entrar a la Aventura',
  },
  progreso: {
    etiqueta: 'Plataforma',
    titulo: 'Progreso',
    descripcion: 'Tu espacio de trabajo y desarrollo, con todo tu avance en un solo lugar.',
    ventajas: [
      { Icono: FolderKanban, texto: 'Proyectos y tareas' },
      { Icono: BarChart3, texto: 'El avance de tu crecimiento' },
      { Icono: CheckCircle2, texto: 'Productos y servicios del grupo' },
    ],
    boton: 'Ir a mi Progreso',
  },
};

export default function PanelesMundo({ onElegir, bloqueado }: { onElegir: (m: Mundo) => void; bloqueado?: boolean }) {
  const [eligiendo, setEligiendo] = useState<Mundo | null>(null);
  const elegir = (m: Mundo) => {
    if (bloqueado || eligiendo) return;
    setEligiendo(m);
    window.setTimeout(() => { onElegir(m); setEligiendo(null); }, 260);
  };

  const panel = (m: Mundo) => {
    const d = MUNDOS[m];
    return (
      <section className={`panel-mundo panel-mundo-${m} ${eligiendo === m ? 'es-elegido' : ''}`}>
        <div className="panel-mundo-texto">
          <span className="panel-mundo-etiqueta">{d.etiqueta}</span>
          <h2 className="panel-mundo-titulo">{d.titulo}</h2>
          <p className="panel-mundo-desc">{d.descripcion}</p>
          <ul className="panel-mundo-ventajas">
            {d.ventajas.map(({ Icono, texto }) => (
              <li key={texto}>
                <Icono aria-hidden="true" />
                {texto}
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => elegir(m)} disabled={bloqueado} className="panel-mundo-boton">
            {d.boton}
            <ArrowRight aria-hidden="true" />
          </button>
        </div>
      </section>
    );
  };

  return (
    <div className="paneles-mundo">
      {panel('aventura')}
      {panel('progreso')}
    </div>
  );
}
