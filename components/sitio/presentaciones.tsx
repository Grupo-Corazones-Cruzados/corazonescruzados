/**
 * LAS PRESENTACIONES DE LAS PÁGINAS PÚBLICAS — una por página, compartida por todas sus secciones
 * (Fernando, 2026-10-29: «más estilo sitio web… pon tu toque a cada página»).
 *
 * SIN BOTONES (Fernando, 2026-10-29: «solo la pestaña de Inicio debe tener el acceso»).
 *
 * Los textos salen de lo que ya dice el sitio (las secciones de `lib/sitio/contenido.ts`): nada
 * que no sea verificable, la regla de siempre. Van en `.tsx` y no en `contenido.ts` porque
 * Desarrollo Humano lleva un sello con los iconos de la portada.
 */

import type { ComponentProps } from 'react';
import { IconoCorazon, IconoMundo } from '@/components/landing/IconosTitular';
import { ICONOS, type PresentacionPagina } from './piezas';
import { ACCESOS } from '@/lib/sitio/contenido';
import type { SolucionConContenido } from './SolucionesExplorador';

type Presentacion = ComponentProps<typeof PresentacionPagina>;

/**
 * La pieza de Clientes: «así funciona un ticket», con los tres pasos REALES de la primera pregunta
 * de Plataforma (los mismos que se leen más abajo), como una tarjeta de la Plataforma.
 */
function VisualClientes() {
  const tema = ACCESOS[0]?.temas?.[0];
  if (!tema?.pasos?.length) return null;
  return (
    <div className="visual-tarjeta">
      <p className="visual-rotulo">Así funciona un {tema.etiqueta.toLowerCase().replace(/s$/, '')}</p>
      <ol className="visual-pasos">
        {tema.pasos.slice(0, 3).map((p, i) => {
          const Icono = p.icono ? ICONOS[p.icono] : null;
          return (
            <li key={p.titulo} style={{ ['--i' as string]: i }}>
              <span className="visual-paso-num">{Icono ? <Icono aria-hidden /> : String(i + 1).padStart(2, '0')}</span>
              <span>
                <span className="visual-paso-titulo">{p.titulo}</span>
                <span className="visual-paso-texto">{p.texto}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export const PRESENTACION_CLIENTES: Presentacion = {
  visual: <VisualClientes />,
  etiqueta: 'Clientes',
  titulo: 'Lo que tu organización puede hacer con nosotros',
  texto:
    'Publica tickets y proyectos para que los resuelva quien tiene el talento, pon a prueba a tus colaboradores en el videojuego, compra en el marketplace y vota sobre las mejoras de la organización.',
};

/**
 * Desarrollo Humano abre con la frase de la portada y su imagen: el corazón ya posado sobre la
 * Tierra, como queda tras «el cruce del corazón».
 */
export const PRESENTACION_DESARROLLO: Presentacion = {
  etiqueta: 'Proyecto de desarrollo humano',
  titulo: 'Un corazón puede cruzar al mundo',
  texto:
    'Un proyecto que usa tus condiciones como ancla para tu progreso mental, laboral, social y corporal, con logros individuales y colectivos. No hace falta un título ni experiencia: tu talento lo descubrimos juntos.',
  // La pieza de Desarrollo Humano: el cruce del corazón en grande, ya posado sobre la Tierra.
  visual: (
    <span className="visual-cruce" aria-hidden>
      <span className="visual-cruce-halo" />
      <span className="sello-cruce">
        <span className="sello-mundo"><IconoMundo idRecorte="mundo-presentacion" /></span>
        <span className="sello-corazon"><IconoCorazon /></span>
      </span>
    </span>
  ),
  sello: (
    <span className="sello-cruce" aria-hidden>
      <span className="sello-mundo"><IconoMundo idRecorte="mundo-sello" /></span>
      <span className="sello-corazon"><IconoCorazon /></span>
    </span>
  ),
};

/**
 * Soluciones abre con CIFRAS REALES de lo que ya está hecho, contadas del mismo contenido que
 * enseña el explorador (nada escrito a mano). Una cifra a cero no se enseña.
 */
export function presentacionSoluciones(soluciones: SolucionConContenido[]): Presentacion {
  // Por id y no sumando listas: un mismo trabajo puede colgar de varios talentos.
  const proyectosV = new Set<number | string>(), ticketsV = new Set<number | string>(), productosV = new Set<number | string>();
  const talentos = new Set<string>();
  for (const s of soluciones) {
    for (const t of s.talentos) talentos.add(t.talento);
    for (const c of Object.values(s.contenido)) {
      c.proyectos.forEach((x) => proyectosV.add(x.id));
      c.tickets.forEach((x) => ticketsV.add(x.id));
      c.productos.forEach((x) => productosV.add(x.id));
    }
  }
  const proyectos = proyectosV.size, tickets = ticketsV.size, productos = productosV.size;
  return {
    etiqueta: 'Soluciones',
    titulo: 'Lo que sabemos hacer, con trabajo terminado',
    texto:
      'Cada solución reúne los talentos del grupo y lo que ya entregaron con ellos: proyectos, tickets y productos. Elige un talento y mira lo hecho.',
    cifras: [
      { valor: proyectos, etiqueta: 'Proyectos' },
      { valor: tickets, etiqueta: 'Tickets' },
      { valor: productos, etiqueta: 'Productos' },
      { valor: talentos.size, etiqueta: talentos.size === 1 ? 'Talento' : 'Talentos' },
    ].filter((c) => c.valor > 0),
  };
}
