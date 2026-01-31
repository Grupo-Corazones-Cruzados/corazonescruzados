/**
 * Project States Configuration
 * Defines all project states, their labels, and valid transitions
 */

export type ProjectState =
  | "borrador"
  | "publicado"
  | "planificado"
  | "iniciado"
  | "en_progreso"
  | "en_implementacion"
  | "en_pruebas"
  | "completado"
  | "completado_parcial"
  | "no_completado"
  | "cancelado"
  | "cancelado_sin_acuerdo"
  | "cancelado_sin_presupuesto"
  | "no_pagado"
  | "no_completado_por_miembro";

// Labels in Spanish for display
export const PROJECT_STATE_LABELS: Record<ProjectState, string> = {
  borrador: "Borrador",
  publicado: "Publicado",
  planificado: "Planificado",
  iniciado: "Iniciado",
  en_progreso: "En Progreso",
  en_implementacion: "En Implementación",
  en_pruebas: "En Pruebas",
  completado: "Completado",
  completado_parcial: "Completado Parcial",
  no_completado: "No Completado",
  cancelado: "Cancelado",
  cancelado_sin_acuerdo: "Cancelado - Sin Acuerdo",
  cancelado_sin_presupuesto: "Cancelado - Sin Presupuesto",
  no_pagado: "No Pagado",
  no_completado_por_miembro: "No Completado por Miembro",
};

// CSS class names for state badges
export const PROJECT_STATE_CLASSES: Record<ProjectState, string> = {
  borrador: "statusBorrador",
  publicado: "statusPublicado",
  planificado: "statusPlanificado",
  iniciado: "statusIniciado",
  en_progreso: "statusEnProgreso",
  en_implementacion: "statusEnImplementacion",
  en_pruebas: "statusEnPruebas",
  completado: "statusCompletado",
  completado_parcial: "statusCompletadoParcial",
  no_completado: "statusNoCompletado",
  cancelado: "statusCancelado",
  cancelado_sin_acuerdo: "statusCancelado",
  cancelado_sin_presupuesto: "statusCancelado",
  no_pagado: "statusNoPagado",
  no_completado_por_miembro: "statusNoCompletado",
};

// Active working states (where work can be done)
export const ACTIVE_WORKING_STATES: ProjectState[] = [
  "iniciado",
  "en_progreso",
  "en_implementacion",
  "en_pruebas",
];

// States where requirements can be completed
export const REQUIREMENT_COMPLETION_STATES: ProjectState[] = [
  "iniciado",
  "en_progreso",
  "en_implementacion",
  "en_pruebas",
];

// Terminal/closed states
export const TERMINAL_STATES: ProjectState[] = [
  "completado",
  "completado_parcial",
  "no_completado",
  "cancelado",
  "cancelado_sin_acuerdo",
  "cancelado_sin_presupuesto",
  "no_pagado",
  "no_completado_por_miembro",
];

/**
 * Valid state transitions for private projects (no collaborators)
 * Owner can change state manually in any direction within workflow
 */
export const PRIVATE_PROJECT_STATES: ProjectState[] = [
  "borrador",
  "iniciado",
  "en_implementacion",
  "en_pruebas",
  "completado",
];

/**
 * Valid state transitions for public/collaborative projects
 * More structured flow with team coordination
 */
export const PUBLIC_PROJECT_STATES: ProjectState[] = [
  "publicado",
  "planificado",
  "iniciado",
  "en_progreso",
  "en_implementacion",
  "en_pruebas",
  "completado",
];

/**
 * Get next valid states for a private project
 * For private projects, owner can move freely between workflow states
 */
export function getNextPrivateProjectStates(
  currentState: ProjectState
): ProjectState[] {
  // Private projects can transition freely between these states
  const workflowStates: ProjectState[] = [
    "borrador",
    "iniciado",
    "en_implementacion",
    "en_pruebas",
    "completado",
  ];

  // Can also cancel at any non-terminal state
  if (!TERMINAL_STATES.includes(currentState)) {
    return [...workflowStates.filter((s) => s !== currentState), "cancelado"];
  }

  return [];
}

/**
 * Get next valid states for a public/collaborative project
 * More restricted flow based on team coordination
 */
export function getNextPublicProjectStates(
  currentState: ProjectState
): ProjectState[] {
  const transitions: Partial<Record<ProjectState, ProjectState[]>> = {
    publicado: ["planificado", "cancelado"],
    planificado: ["iniciado", "cancelado"],
    iniciado: ["en_progreso", "en_implementacion", "cancelado"],
    en_progreso: ["en_implementacion", "en_pruebas", "completado"],
    en_implementacion: ["en_pruebas", "completado"],
    en_pruebas: ["completado", "en_implementacion"],
  };

  return transitions[currentState] || [];
}

/**
 * Check if a state transition is valid
 */
export function isValidStateTransition(
  currentState: ProjectState,
  newState: ProjectState,
  isPrivateProject: boolean
): boolean {
  if (isPrivateProject) {
    const validStates = getNextPrivateProjectStates(currentState);
    return validStates.includes(newState);
  } else {
    const validStates = getNextPublicProjectStates(currentState);
    return validStates.includes(newState);
  }
}

/**
 * Check if project is in an active working state
 */
export function isActiveWorkingState(state: ProjectState): boolean {
  return ACTIVE_WORKING_STATES.includes(state);
}

/**
 * Check if requirements can be completed in this state
 */
export function canCompleteRequirements(state: ProjectState): boolean {
  return REQUIREMENT_COMPLETION_STATES.includes(state);
}

/**
 * Check if project is in a terminal/closed state
 */
export function isTerminalState(state: ProjectState): boolean {
  return TERMINAL_STATES.includes(state);
}

/**
 * Get the display label for a state
 */
export function getStateLabel(state: ProjectState): string {
  return PROJECT_STATE_LABELS[state] || state;
}

/**
 * Get the CSS class for a state badge
 */
export function getStateClass(state: ProjectState): string {
  return PROJECT_STATE_CLASSES[state] || "statusDefault";
}
