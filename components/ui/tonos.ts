/**
 * TONOS SEMÁNTICOS — definición ÚNICA del color de error / aviso / éxito / info.
 *
 * ── EL PROBLEMA QUE RESUELVE ───────────────────────────────────────────────────
 * El tema `.corp` NO remapea toda la paleta de Tailwind: solo un conjunto concreto de
 * tonos (`app/globals.css`). Escribir `text-red-800` o `text-amber-900` compila, se ve
 * "más o menos rojo" en claro… y **queda fuera de la paleta de la app**: no se adapta al
 * modo oscuro —donde acaba siendo casi negro sobre fondo oscuro— y no es ninguno de
 * nuestros colores. Eso es justo lo que pasó con los avisos del detalle de flujo.
 *
 * ── LA REGLA ───────────────────────────────────────────────────────────────────
 * Los únicos tonos semánticos que el tema redefine **en claro Y en oscuro** son los
 * `-300`/`-400` de la paleta y unas pocas superficies y bordes. Comprobado en
 * `app/globals.css`:
 *
 *   `.corp`      →  --color-red-400/300 #b3261e · --color-amber-400/300 #8a6116
 *                   --color-green-400 #0e700e · --color-blue-400 #0f6cbd
 *   `.corp.dark` →  --color-red-400/300 #f1707b · --color-amber-400/300 #e0b34d
 *                   --color-green-400 #6bb700 · --color-blue-400 #4aa3f0
 *   más overrides explícitos de `bg-*-50`, `border-*-300` y `text-*-600/700`.
 *
 * Por eso aquí **solo se usan esos**. Nada de `-800`, `-900`, `-500` ni `emerald-*`:
 * no tienen override y se salen del tema.
 *
 * ── CÓMO SE USA ────────────────────────────────────────────────────────────────
 *   import { TONO, type Tono } from '@/components/ui/tonos';
 *   <p className={TONO[t].texto}>…</p>
 *   <div className={`rounded-lg border p-4 ${TONO[t].caja}`}>…</div>
 *
 * Si un aviso necesita un color, sale de aquí. Un color escrito a mano en un componente
 * es una desviación, no una variante.
 */

export type Tono = 'error' | 'aviso' | 'exito' | 'info';

export interface EstiloTono {
  /** Texto del aviso. Legible en claro y en oscuro. */
  texto: string;
  /** Icono del tono (mismo color que el texto, separado por claridad de intención). */
  icono: string;
  /** Punto/viñeta de lista. */
  punto: string;
  /** Recuadro completo: borde + superficie teñida. Se combina con el radio y el padding. */
  caja: string;
  /** Botón o control con el tono: borde + superficie + texto + hover. */
  control: string;
  /** Anillo de foco/estado abierto. */
  anillo: string;
}

export const TONO: Record<Tono, EstiloTono> = {
  error: {
    texto: 'text-red-400',
    icono: 'text-red-400',
    punto: 'bg-red-400',
    caja: 'border-red-300 bg-red-50',
    control: 'border-red-300 bg-red-50 text-red-400 hover:bg-red-50/70',
    anillo: 'ring-red-300',
  },
  aviso: {
    texto: 'text-amber-400',
    icono: 'text-amber-400',
    punto: 'bg-amber-400',
    caja: 'border-amber-300 bg-amber-50',
    control: 'border-amber-300 bg-amber-50 text-amber-400 hover:bg-amber-50/70',
    anillo: 'ring-amber-300',
  },
  exito: {
    texto: 'text-green-400',
    icono: 'text-green-400',
    punto: 'bg-green-400',
    caja: 'border-green-300 bg-green-50',
    control: 'border-green-300 bg-green-50 text-green-400 hover:bg-green-50/70',
    anillo: 'ring-green-300',
  },
  // El informativo NO es azul: es el morado de marca, que ya vive en tokens propios y se
  // adapta solo. Un azul suelto aquí sería otro color fuera de la identidad.
  info: {
    texto: 'text-accent',
    icono: 'text-accent',
    punto: 'bg-accent',
    caja: 'border-accent/30 bg-accent-light',
    control: 'border-accent/30 bg-accent-light text-accent hover:bg-accent-light/70',
    anillo: 'ring-accent/40',
  },
};
