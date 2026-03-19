export type IncidentStatus = 'pending' | 'approved' | 'rejected' | 'reviewing' | 'completed';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface Incident {
  id: string;
  projectId: string;
  clientName: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  images: string[]; // filenames in /data/uploads/
  status: IncidentStatus;
  createdAt: string; // ISO date
  updatedAt: string;
}
