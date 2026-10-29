/**
 * ⇒ CATÁLOGO DE AVISOS (Fernando, 2026-10-29): la lista ÚNICA de lo que la plataforma avisa.
 *
 * *«todo lo de la campanita»* llega también al teléfono y al Mac, y *«que yo elija qué recibo»*:
 * cada aviso tiene una clave y cada persona lo enciende o lo apaga por CANAL desde
 * Configuración → Notificaciones. Lo que no ha tocado está ENCENDIDO (decisión de Fernando: que
 * nadie se pierda un aviso por no haber entrado a configurar).
 *
 * - `push`: notificación del sistema (app nativa del iPhone/Mac/Android y navegador con
 *   «Activar avisos»).
 * - `campana`: la campanita del panel. Los avisos que solo existen como notificación del sistema
 *   (chats, reuniones a punto de empezar, invitaciones a proyectos, que la campanita deriva en
 *   vivo) no la tienen.
 *
 * `alcance` decide quién VE el aviso en sus preferencias y quién puede recibirlo:
 * - `todos`: cualquiera con cuenta.
 * - `equipo`: candidatos, miembros y admin (no los clientes puros).
 * - `reclutamiento`: quien accede al sistema «Reclutamiento y Selección» del Centralizado
 *   (admin y miembros por piso/paso o acceso compartido; Fernando, 2026-10-29).
 *
 * Sin dependencias de servidor: lo importan la API y la pantalla.
 */

export type Canal = 'push' | 'campana';
export type Alcance = 'todos' | 'equipo' | 'reclutamiento';

export type ClaseAviso =
  | 'postulacion_nueva' | 'postulacion_verificada' | 'postulacion_decidida' | 'candidato_perfil'
  | 'candidato_a_miembro' | 'miembro_a_candidato'
  | 'ticket_request' | 'ticket_proposal' | 'ticket_accepted' | 'ticket_taken'
  | 'project_invitation' | 'project_taken'
  | 'quote_decided' | 'quote_budget'
  | 'reunion' | 'calendar_proposal'
  | 'reminder'
  | 'chat'
  | 'subscription';

export type DefinicionAviso = {
  clase: ClaseAviso;
  grupo: string;
  nombre: string;
  canales: Canal[];
  alcance: Alcance;
};

export const SLUG_RECLUTAMIENTO = 'reclutamiento-y-seleccion';

export const AVISOS: DefinicionAviso[] = [
  { clase: 'postulacion_nueva', grupo: 'Reclutamiento y Selección', nombre: 'Nueva postulación', canales: ['push', 'campana'], alcance: 'reclutamiento' },
  { clase: 'postulacion_verificada', grupo: 'Reclutamiento y Selección', nombre: 'Postulante verificó su correo', canales: ['push', 'campana'], alcance: 'reclutamiento' },
  { clase: 'postulacion_decidida', grupo: 'Reclutamiento y Selección', nombre: 'Postulación aprobada o rechazada', canales: ['push', 'campana'], alcance: 'reclutamiento' },
  { clase: 'candidato_perfil', grupo: 'Reclutamiento y Selección', nombre: 'Candidato completó su perfil', canales: ['push', 'campana'], alcance: 'reclutamiento' },
  { clase: 'candidato_a_miembro', grupo: 'Reclutamiento y Selección', nombre: 'Candidato pasa a miembro', canales: ['push', 'campana'], alcance: 'reclutamiento' },
  { clase: 'miembro_a_candidato', grupo: 'Reclutamiento y Selección', nombre: 'Miembro vuelve a candidato', canales: ['push', 'campana'], alcance: 'reclutamiento' },

  { clase: 'ticket_request', grupo: 'Tickets', nombre: 'Te solicitan atender un ticket', canales: ['push', 'campana'], alcance: 'equipo' },
  { clase: 'ticket_proposal', grupo: 'Tickets', nombre: 'Propuesta nueva a tu ticket', canales: ['push', 'campana'], alcance: 'equipo' },
  { clase: 'ticket_accepted', grupo: 'Tickets', nombre: 'Aceptaron tu propuesta', canales: ['push', 'campana'], alcance: 'equipo' },
  { clase: 'ticket_taken', grupo: 'Tickets', nombre: 'Tomaron tu ticket', canales: ['push', 'campana'], alcance: 'equipo' },

  { clase: 'project_invitation', grupo: 'Proyectos', nombre: 'Invitación a un proyecto', canales: ['push'], alcance: 'equipo' },
  { clase: 'project_taken', grupo: 'Proyectos', nombre: 'Tomaron tu proyecto', canales: ['push', 'campana'], alcance: 'equipo' },

  { clase: 'quote_decided', grupo: 'Cotizaciones', nombre: 'Cliente aceptó o rechazó una cotización', canales: ['push', 'campana'], alcance: 'equipo' },
  { clase: 'quote_budget', grupo: 'Cotizaciones', nombre: 'Cliente envió su presupuesto', canales: ['push', 'campana'], alcance: 'equipo' },

  { clase: 'reunion', grupo: 'Mi día', nombre: 'Reunión a punto de empezar', canales: ['push'], alcance: 'todos' },
  { clase: 'calendar_proposal', grupo: 'Mi día', nombre: 'Propuesta de reunión', canales: ['push', 'campana'], alcance: 'equipo' },
  { clase: 'reminder', grupo: 'Mi día', nombre: 'Recordatorios', canales: ['push', 'campana'], alcance: 'todos' },

  { clase: 'chat', grupo: 'Chats', nombre: 'Mensaje nuevo', canales: ['push'], alcance: 'todos' },

  { clase: 'subscription', grupo: 'Suscripciones', nombre: 'Suscripción por vencer', canales: ['push', 'campana'], alcance: 'todos' },
];

const POR_CLASE = new Map(AVISOS.map((a) => [a.clase, a]));
export const definicionDe = (clase: string): DefinicionAviso | undefined => POR_CLASE.get(clase as ClaseAviso);
