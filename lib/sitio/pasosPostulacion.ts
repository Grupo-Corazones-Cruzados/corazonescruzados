/**
 * LOS APARTADOS DEL FORMULARIO DE POSTULACIÓN, en orden — una sola lista para el formulario
 * (`OnboardingSlidersModal`) y para la página Candidatos (`/candidatos/<paso>`, 2026-11-01), que
 * los enseña uno por pestaña. Módulo sin `use client`: el servidor lo necesita para las rutas.
 */
export const PASOS_POSTULACION_IDS = [
  { id: 'modelo', titulo: 'Modelo de Grupo' },
  // El Modelo 4P pasa a su propio paso (Fernando, 2026-11-11).
  { id: 'modelo-4p', titulo: 'Modelo Organizacional 4P' },
  { id: 'herramientas', titulo: 'Herramientas' },
  { id: 'motivos', titulo: 'Motivos' },
  { id: 'onboarding', titulo: 'Onboarding' },
  { id: 'metodo-crecimiento', titulo: 'Prospección' }, // Fernando, 2026-11-11 (la URL se mantiene)
  // «Lideración sobre Acciones» se quitó el 2026-11-11 (Fernando: Onboarding ya lo explica);
  // `/candidatos/lideracion` redirige a Onboarding desde next.config.ts.
  { id: 'afiliacion', titulo: 'Afiliación' },
  // El formulario ya no es un apartado de la página (2026-11-11): se postula desde la ventana del
  // botón «Postularme»; `/candidatos/postulacion` redirige a `/candidatos`.
] as const;

export type PasoPostulacionId = (typeof PASOS_POSTULACION_IDS)[number]['id'];

export const tituloDePaso = (id: PasoPostulacionId) => PASOS_POSTULACION_IDS.find((p) => p.id === id)!.titulo;
