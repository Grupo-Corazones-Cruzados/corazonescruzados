/**
 * LOS APARTADOS DEL FORMULARIO DE POSTULACIÓN, en orden — una sola lista para el formulario
 * (`OnboardingSlidersModal`) y para la página Candidatos (`/candidatos/<paso>`, 2026-11-01), que
 * los enseña uno por pestaña. Módulo sin `use client`: el servidor lo necesita para las rutas.
 */
export const PASOS_POSTULACION_IDS = [
  { id: 'modelo', titulo: 'Modelo de Grupo' },
  { id: 'herramientas', titulo: 'Herramientas' },
  { id: 'motivos', titulo: 'Motivos' },
  { id: 'onboarding', titulo: 'Onboarding' },
  { id: 'metodo-crecimiento', titulo: 'Método de crecimiento' },
  { id: 'lideracion', titulo: 'Lideración sobre Acciones' },
  { id: 'afiliacion', titulo: 'Afiliación' },
] as const;

export type PasoPostulacionId = (typeof PASOS_POSTULACION_IDS)[number]['id'];

export const tituloDePaso = (id: PasoPostulacionId) => PASOS_POSTULACION_IDS.find((p) => p.id === id)!.titulo;
