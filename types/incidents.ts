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
}
