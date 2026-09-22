export interface Session {
  id: string;
  tuteeId: string;
  tuteeName: string;
  subject: string;
  date: string;
  duration: number; // in minutes
  status: 'Completed' | 'Cancelled' | 'Scheduled';
  notes?: string;
  /** School year this session belongs to, e.g. "2026-27". */
  schoolYear?: string;
  createdAt: string;
}

export interface SessionFormData {
  tuteeId: string;
  date: string;
  duration: number;
  status: 'Completed' | 'Cancelled' | 'Scheduled';
  notes?: string;
}
