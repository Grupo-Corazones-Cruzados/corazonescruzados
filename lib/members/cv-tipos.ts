/**
 * CV PÚBLICO — TIPOS Y ETIQUETAS. Módulo **puro**: ni base de datos, ni red.
 *
 * ⚠️ **EXISTE PORQUE LA PÁGINA ES UN COMPONENTE DE CLIENTE.**
 * `CvCuerpo` necesita las etiquetas y `textoSalario` para pintar. Importarlas de
 * `cv-share.ts` arrastraba **`pg` entero al navegador** y el build reventaba con
 * *«Can't resolve 'fs' / 'dns' / 'net'»*. Un `import type` se borra al compilar,
 * pero una constante o una función **no**: se lleva su módulo detrás.
 *
 * Regla: lo que toquen a la vez el servidor y el navegador vive aquí; lo que hable
 * con la base, en `cv-share.ts`. Mismo patrón que los módulos puros del agente
 * (`entrante.ts`, `conocimiento.ts`, `herramientas.ts`).
 */
import { fmtInt } from '@/lib/format';
import type { Red } from '@/lib/members/redes';

/* ── Tipos de lo que se publica ─────────────────────────────────────────────── */

export type EstadoLaboral = 'immediate' | 'from_date' | 'not_available';
export type Jornada = 'full' | 'part' | 'both';
export type Modalidad = 'remote' | 'hybrid' | 'onsite' | 'any';

export interface Educacion { institucion: string; titulo: string; campo: string; desde: string; hasta: string }
export interface Experiencia { empresa: string; cargo: string; descripcion: string; desde: string; hasta: string }
export interface TalentoPublico { nombre: string; educacion: Educacion[]; experiencia: Experiencia[]; servicios: string[] }
export interface ItemPortafolio {
  id: number;
  /** De dónde sale la imagen: `propio` = `member_portfolio_items` · `proyecto` = `projects`. */
  fuente: 'propio' | 'proyecto';
  tipo: 'project' | 'product' | 'automation';
  titulo: string;
  descripcion: string | null;
  enlace: string | null;
  etiquetas: string[];
  imagenes: number;
}
export interface FranjaHoraria { dia: number; inicio: string; fin: string }

export interface CvPublico {
  /** Nombre completo tal cual se muestra. */
  nombre: string;
  titular: string | null;
  cargo: string | null;
  ubicacion: string | null;
  foto: string | null;
  bio: string | null;
  /** Solo si el miembro los encendió. Ausentes, no vacíos, cuando están apagados. */
  correo?: string;
  telefono?: string;
  /**
   * Enlaces a perfiles, ya normalizados a URL absoluta y en el orden en que se
   * pintan. Solo trae las que la persona rellenó: una red vacía no ocupa sitio.
   */
  redes: { red: Red; etiqueta: string; url: string }[];
  skills: string[];
  idiomas: string[];
  talentos: TalentoPublico[];
  portafolio: ItemPortafolio[];
  disponibilidad: {
    estado: EstadoLaboral;
    desde: string | null;
    jornada: Jornada;
    modalidad: Modalidad;
    nota: string | null;
    horario: FranjaHoraria[];
  };
  /** Ausente si no la declaró o la tiene oculta. */
  salario?: { min: number | null; max: number | null };
  actualizado: string | null;
}

/* ── Etiquetas en español (fuente única: las usan la página y el PDF) ───────── */

export const ETIQUETA_ESTADO: Record<EstadoLaboral, string> = {
  immediate: 'Disponible de inmediato',
  from_date: 'Disponible a partir de',
  not_available: 'No disponible por ahora',
};
export const ETIQUETA_JORNADA: Record<Jornada, string> = {
  full: 'Jornada completa',
  part: 'Media jornada',
  both: 'Jornada completa o parcial',
};
export const ETIQUETA_MODALIDAD: Record<Modalidad, string> = {
  remote: 'Remoto',
  hybrid: 'Híbrido',
  onsite: 'Presencial',
  any: 'Remoto, híbrido o presencial',
};
export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/**
 * Rango salarial mensual en USD, ya redactado. Fuente única para la página y el PDF:
 * el mismo número no puede escribirse de dos formas según dónde se lea.
 *
 * El formateo sale de `lib/format` (`fmtInt`, locale es-ES), que es la fuente única
 * de presentación numérica del proyecto. Sin decimales a propósito: es una
 * aspiración aproximada, y «$1.200,00» finge una precisión que nadie tiene.
 */
export function textoSalario(s: { min: number | null; max: number | null }): string {
  if (s.min != null && s.max != null) return `$${fmtInt(s.min)} – $${fmtInt(s.max)}`;
  if (s.min != null) return `Desde $${fmtInt(s.min)}`;
  if (s.max != null) return `Hasta $${fmtInt(s.max)}`;
  return '';
}
