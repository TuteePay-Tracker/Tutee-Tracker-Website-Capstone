export interface ProgressReport {
  id: string;
  tuteeId: string;
  tutorId: string;
  date: string; // YYYY-MM-DD
  subject: string;
  topicsCovered: string;
  performance: 'excellent' | 'very-good' | 'good' | 'needs-improvement';
  behavior: 'excellent' | 'very-good' | 'good' | 'needs-improvement';
  notes: string;
  recommendations?: string;
  createdAt: string;
}

export interface ProgressReportFormData {
  date: string;
  subject: string;
  topicsCovered: string;
  performance: 'excellent' | 'very-good' | 'good' | 'needs-improvement';
  behavior: 'excellent' | 'very-good' | 'good' | 'needs-improvement';
  notes: string;
  recommendations?: string;
}
