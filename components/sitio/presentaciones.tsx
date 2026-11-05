/**
 * LAS PRESENTACIONES DE LAS PÁGINAS PÚBLICAS — una por página, compartida por todas sus secciones
 * (Fernando, 2026-10-29: «más estilo sitio web… pon tu toque a cada página»).
 *
 * SIN BOTONES (Fernando, 2026-10-29: «solo la pestaña de Inicio debe tener el acceso»).
 *
 * Los textos salen de lo que ya dice el sitio (las secciones de `lib/sitio/contenido.ts`): nada
 * que no sea verificable, la regla de siempre. Van en `.tsx` y no en `contenido.ts` porque
 * Candidatos lleva un sello con los iconos de la portada.
 */

import type { ComponentProps } from 'react';
import { IconoCorazon, IconoMundo } from '@/components/landing/IconosTitular';
import type { PresentacionPagina } from './piezas';
import type { SolucionConContenido } from './SolucionesExplorador';

type Presentacion = ComponentProps<typeof PresentacionPagina>;

/* Clientes no lleva pieza a la derecha: la tarjeta «Así funciona un ticket» se quitó el 2026-10-29
   (Fernando: «este contenido no me gusta»). Para verla: `git show 054f6e22:components/sitio/presentaciones.tsx`. */
export const PRESENTACION_CLIENTES: Presentacion = {
  etiqueta: 'Clientes',
  titulo: 'Impulsa tu proyecto o negocio, a medida de lo que necesitas',
  texto:
    'Creemos que tanto las ideas ingeniosas, como el talento que trabaja para hacerlo realidad son el motor del progreso de este mundo, y ambos deberían ser justamente recompensados. En la actualidad el sistema laboral hace de intermediario, complicando la adquisición de talento, el progreso de cualquier negocio, y además robándose recursos que deberían ser dirigidos para quienes realmente se lo merecen.',
};

/**
 * Candidatos (Fernando, 2026-11-01): el corazón sobre la Tierra a la derecha y su texto, literal.
 */
export const PRESENTACION_CANDIDATOS: Presentacion = {
  etiqueta: 'Candidatos',
  titulo: 'Un corazón puede cruzar al mundo',
  texto:
    'El Proyecto del Grupo Corazones Cruzados, es un Proyecto de Desarrollo Humano que aplica Sistemas de Gobernanza Innovadores con el fin de Reconocer y Aprovechar las Condiciones de los Sujetos, generando como resultado las Soluciones que requerimos implementar para confrontar o corregir Problemas Individuales, y Problemáticas Sociales que hoy están siendo la causa de nuestra degeneración como Sociedad y nos alejan cada vez más que nuestro objetivo principal, el cual es la Unión de la Humanidad.',
  visual: (
    <span className="visual-cruce" aria-hidden>
      <span className="visual-cruce-halo" />
      <span className="sello-cruce">
        <span className="sello-mundo"><IconoMundo idRecorte="mundo-candidatos" /></span>
        <span className="sello-corazon"><IconoCorazon /></span>
      </span>
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
    titulo: 'Cuando tengas problemas, conecta con nosotros',
    texto:
      'Las soluciones que ofrecemos aprovechan las estrategias aplicadas previamente con clientes experimentales para publicar versiones que se actualizan según la experiencia; además, te damos acceso a la guía del proyecto para que conozcas el alcance y resultados esperados.',
    cifras: [
      { valor: proyectos, etiqueta: 'Proyectos' },
      { valor: tickets, etiqueta: 'Tickets' },
      { valor: productos, etiqueta: 'Productos' },
      { valor: talentos.size, etiqueta: talentos.size === 1 ? 'Talento' : 'Talentos' },
    ].filter((c) => c.valor > 0),
  };
}
