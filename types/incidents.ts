export type IncidentStatus = 'pending' | 'approved' | 'rejected' | 'completed';

export interface Incident {
  id: string;
  projectId: string;
  clientName: string;
  title: string;
  description: string;
  images: string[]; // filenames in /data/uploads/
  status: IncidentStatus;
  createdAt: string; // ISO date
  updatedAt: string;
}
