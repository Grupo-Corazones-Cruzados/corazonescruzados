import type { ProjectStatus, UserRole } from "./types";

// ----- Roles -----

export const ROLES: UserRole[] = ["client", "member", "admin"];

export const ROLE_LABELS: Record<UserRole, string> = {
  client: "Cliente",
  member: "Miembro",
  admin: "Administrador",
};

// ----- Ticket statuses -----

export const TICKET_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  in_progress: "En Progreso",
  completed: "Completado",
  cancelled: "Cancelado",
};

// ----- Project statuses -----

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "Borrador",
  published: "Publicado",
  planned: "Planificado",
  started: "Iniciado",
  in_progress: "En Progreso",
  in_development: "En Desarrollo",
  in_testing: "En Pruebas",
  completed: "Completado",
  partially_completed: "Completado Parcial",
  not_completed: "No Completado",
  cancelled: "Cancelado",
  cancelled_no_agreement: "Cancelado - Sin Acuerdo",
  cancelled_no_budget: "Cancelado - Sin Presupuesto",
  unpaid: "No Pagado",
  not_completed_by_member: "No Completado por Miembro",
};

export const ACTIVE_PROJECT_STATES: ProjectStatus[] = [
  "started",
  "in_progress",
  "in_development",
  "in_testing",
];

export const TERMINAL_PROJECT_STATES: ProjectStatus[] = [
  "completed",
  "partially_completed",
  "not_completed",
  "cancelled",
  "cancelled_no_agreement",
  "cancelled_no_budget",
  "unpaid",
  "not_completed_by_member",
];

export const PRIVATE_PROJECT_FLOW: ProjectStatus[] = [
  "draft",
  "started",
  "in_development",
  "in_testing",
  "completed",
];

export const PUBLIC_PROJECT_TRANSITIONS: Partial<
  Record<ProjectStatus, ProjectStatus[]>
> = {
  published: ["planned"],
  planned: ["started"],
  started: ["in_progress", "in_development"],
  in_progress: ["in_development", "in_testing", "completed"],
  in_development: ["in_testing", "completed"],
  in_testing: ["completed", "in_development"],
};

// ----- Invoice statuses -----

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  sent: "Enviada",
  paid: "Pagada",
  cancelled: "Cancelada",
};

// ----- Order statuses -----

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  paid: "Pagado",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

// ----- Applicant statuses -----

export const APPLICANT_STATUS_LABELS: Record<string, string> = {
  applied: "Aplicó",
  screening: "En Revisión",
  interview: "Entrevista",
  evaluation: "Evaluación",
  accepted: "Aceptado",
  rejected: "Rechazado",
  withdrawn: "Retirado",
};

// ----- Days of week -----

export const DAYS_OF_WEEK = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;
