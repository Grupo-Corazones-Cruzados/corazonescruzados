/**
 * Tipos del CHAT DE PROYECTOS (el panel donde se conversa con el agente).
 *
 * Vivían en `types/world.ts`, junto al mundo web de los agentes ("DigiMundo").
 * Ese mundo se eliminó —el mundo del juego es Godot— pero el chat sigue vivo en
 * el dashboard: lo usan los paneles de proyectos, propuestas, documentos, guion
 * de vídeo y copys. Se quedan aquí solo los campos que el chat necesita para
 * pintar quién habla.
 */

/** Quién habla en el chat: el agente que lleva el proyecto. */
export interface CitizenDef {
  agentId: string;
  name: string;
  sprite: string;
  /** Recorte de la cara para el avatar de la burbuja (píxeles del original). */
  avatarCrop?: { x: number; y: number; size: number };
}
