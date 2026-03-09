import type { OrderStatus, ProjectStatus, UserRole } from "./types";

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
  open: "Abierto",
  in_progress: "En Progreso",
  review: "En Revisión",
  completed: "Completado",
  cancelled: "Cancelado",
  on_hold: "En Espera",
};

export const ACTIVE_PROJECT_STATES: ProjectStatus[] = [
  "in_progress",
  "review",
];

export const TERMINAL_PROJECT_STATES: ProjectStatus[] = [
  "completed",
  "cancelled",
];

export const PRIVATE_PROJECT_FLOW: ProjectStatus[] = [
  "draft",
  "in_progress",
  "review",
  "completed",
];

export const PUBLIC_PROJECT_TRANSITIONS: Partial<
  Record<ProjectStatus, ProjectStatus[]>
> = {
  open: ["in_progress"],
  in_progress: ["review", "completed"],
  review: ["in_progress", "completed"],
};

export type CancellationReason =
  | "no_agreement"
  | "no_budget"
  | "member_failure"
  | "not_completed"
  | "other";

export const CANCELLATION_REASON_LABELS: Record<CancellationReason, string> = {
  no_agreement: "Sin Acuerdo",
  no_budget: "Sin Presupuesto",
  member_failure: "Fallo del Miembro",
  not_completed: "No Completado",
  other: "Otro",
};

// ----- Invoice statuses -----

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  sent: "Enviada",
  paid: "Pagada",
  cancelled: "Cancelada",
};

// ----- Order statuses -----

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pendiente",
  pending_confirmation: "Pendiente de Confirmación",
  awaiting_acceptance: "Esperando Aceptación",
  awaiting_payment: "Pendiente de Pago",
  paid: "Pagado",
  shipped: "Enviado",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export const ORDER_STATUS_BADGE: Record<OrderStatus, "default" | "success" | "warning" | "error" | "info"> = {
  pending: "warning",
  pending_confirmation: "warning",
  awaiting_acceptance: "info",
  awaiting_payment: "warning",
  paid: "success",
  shipped: "info",
  delivered: "success",
  cancelled: "error",
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

// ----- Campaign statuses -----

export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  draft: "Borrador",
  sending: "Enviando",
  sent: "Enviado",
  failed: "Fallido",
};

export const CAMPAIGN_STATUS_BADGE: Record<string, "default" | "success" | "warning" | "error" | "info"> = {
  draft: "default",
  sending: "warning",
  sent: "success",
  failed: "error",
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
