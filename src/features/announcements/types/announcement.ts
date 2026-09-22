export interface Announcement {
  id: string;
  title: string;
  content: string;
  priority: 'low' | 'medium' | 'high';
  tutorId: string;
  /** School year this announcement belongs to, e.g. "2026-27". */
  schoolYear?: string;
  createdAt: string;
  updatedAt: string;
}

export type AnnouncementFormData = Omit<Announcement, 'id' | 'createdAt' | 'updatedAt' | 'tutorId'>;
