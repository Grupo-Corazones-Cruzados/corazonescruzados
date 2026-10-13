export type IncidentStatus = 'pending' | 'approved' | 'rejected' | 'reviewing' | 'completed';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Incident {
  id: string;
  projectId: string;
  clientName: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  images: string[];
  imageCount: number; // present in list responses (images stripped for performance)
  status: IncidentStatus;
  createdAt: string; // ISO date
  updatedAt: string;
  /** Solo en el detalle (GET /api/incidents/[id]): nombre en Drive de cada foto, por fileId. */
  nombres?: Record<string, string>;
  /** Solo en el detalle: quien mira es del equipo y puede renombrar las fotos. */
  puedeRenombrar?: boolean;
}
