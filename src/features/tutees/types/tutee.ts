export interface ScheduleItem {
  day: string;
  startTime: string;
  endTime: string;
}

export interface Tutee {
  id: string;
  firstName: string;
  surname: string;
  subject: string;
  subjects?: string[];
  gradeLevel?: string;
  ratePerSession: number;
  schedule: ScheduleItem[] | string; // Support both new array and old string format
  email?: string;
  guardianNumber?: string;
  guardianEmail?: string;
  address?: string;
  parentId?: string;
  photoUrl?: string;
  archived?: boolean;
  totalSessions: number;
  totalPaid: number;
  balance: number;
  lastPaymentDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TuteeFormData {
  firstName: string;
  surname: string;
  subject: string;
  subjects: string[];
  gradeLevel?: string;
  ratePerSession: number;
  schedule: ScheduleItem[];
  email?: string;
  guardianNumber?: string;
  guardianEmail?: string;
  address?: string;
  parentId?: string;
  photoUrl?: string;
}

export const GRADE_LEVELS = [
  'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6',
] as const;
