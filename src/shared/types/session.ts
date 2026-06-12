export interface Session {
  id: string;
  tuteeId: string;
  tuteeName: string;
  subject: string;
  date: string;
  duration: number; // in minutes
  status: 'Completed' | 'Cancelled' | 'Scheduled';
  notes?: string;
  createdAt: string;
}

export interface SessionFormData {
  tuteeId: string;
  date: string;
  duration: number;
  status: 'Completed' | 'Cancelled' | 'Scheduled';
  notes?: string;
}
