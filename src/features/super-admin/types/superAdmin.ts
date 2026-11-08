export type TutorAccountStatus = 'active' | 'inactive';

export interface TutorAccount {
  id: string;
  name: string;
  email: string;
  createdAt: string | null;
  status: string;
  contactNumber?: string;
  photoUrl?: string;
}

export interface SetTutorAccountStatusResult {
  ok: boolean;
  uid: string;
  status: TutorAccountStatus;
  disabled: boolean;
}

export interface DeletedTutorParentSummary {
  uid: string;
  email: string | null;
}

export interface DeleteTutorAccountResult {
  ok: boolean;
  uid: string;
  email: string | null;
  alreadyDeleted: boolean;
  deletedParents: DeletedTutorParentSummary[];
  deletedCollections: string[];
  deletedChatThreads: number;
}

export interface ParentAccount {
  id: string;
  name: string;
  email: string;
  createdAt: string | null;
  status: string;
  createdByTutorId?: string;
  linkedStudentIds: string[];
}

export interface SuperAdminTutorSummary {
  id: string;
  name: string;
  email: string;
  createdAt: string | null;
  status: string;
  totalTutees: number;
  totalParents: number;
  lastActivityAt: Date | null;
  lastActivityAction: string | null;
}

export interface PlatformStats {
  totalTutors: number;
  activeTutors: number;
  totalTutees: number;
  totalParents: number;
  totalActivities: number;
}

export interface ActivityLogEntry {
  id: string;
  tutorId: string;
  tutorName: string;
  userId: string;
  userName: string;
  userRole: string;
  actionType: string;
  module: string;
  description: string;
  timestamp: Date | null;
}

export interface AttendanceSummary {
  totalDays: number;
  present: number;
  absent: number;
  noClass: number;
  unmarked: number;
  attendanceRate: number;
}

export interface PaymentSummary {
  totalDue: number;
  totalPaid: number;
  totalBalance: number;
  collectionRate: number;
}

export interface AcademicSummary {
  totalAssessments: number;
  averageScore: number | null;
  studentsAssessed: number;
}

export interface TutorMonitoringDetail {
  tutor: TutorAccount;
  totalTutees: number;
  totalParents: number;
  attendance: AttendanceSummary;
  payments: PaymentSummary;
  academic: AcademicSummary;
  recentActivities: ActivityLogEntry[];
  tutees: Array<{ id: string; name: string; subject: string; balance: number }>;
  parents: ParentAccount[];
}

export interface ActivityFilters {
  tutorId?: string;
  actionType?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}
