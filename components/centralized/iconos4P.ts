import {
  Globe, Landmark, ClipboardList, Wrench,
  Layers, Sparkles, Rocket, Gauge,
  Brain, ShieldCheck, Network, HeartPulse,
  GraduationCap, Cpu, Building2, Megaphone,
  BookOpen, Hammer, Target, Lightbulb,
  Microscope, Code2, CalendarRange, Flag,
  type LucideIcon,
} from 'lucide-react';

/**
 * LOS ICONOS DEL MODELO 4P — definición única (Fernando, 2026-11-08: «reemplazar los textos por
 * iconos» en el mapa del cajón de Centralizado). El nombre sigue en `CELL_MAP`/`PISOS`/`PASOS`: el
 * icono no lo sustituye en la accesibilidad (`aria-label`/`title`) ni en la cabecera de la lista.
 */

/** Pisos (filas). Los mismos que el raíl de la web de Centralizado. */
export const ICONO_PISO: Record<string, LucideIcon> = {
  global: Globe, pilar: Landmark, controlador: ClipboardList, colaborador: Wrench,
};

/** Pasos (columnas): de la base al resultado. */
export const ICONO_PASO: Record<string, LucideIcon> = {
  fundamentacion: Layers, creacion: Sparkles, implementacion: Rocket, gestion: Gauge,
};

/** Cada celda piso × paso, por lo que significa su nombre. */
export const ICONO_CELDA: Record<string, Record<string, LucideIcon>> = {
  global: { fundamentacion: Brain, creacion: ShieldCheck, implementacion: Network, gestion: HeartPulse },
  pilar: { fundamentacion: GraduationCap, creacion: Cpu, implementacion: Building2, gestion: Megaphone },
  controlador: { fundamentacion: BookOpen, creacion: Hammer, implementacion: Target, gestion: Lightbulb },
  colaborador: { fundamentacion: Microscope, creacion: Code2, implementacion: CalendarRange, gestion: Flag },
};
