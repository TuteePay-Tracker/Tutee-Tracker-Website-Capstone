export type MakeUpStatus = 'pending' | 'scheduled' | 'completed' | 'reversed';

export interface MakeUpCredit {
  id: string;
  tuteeId: string;
  tuteeName: string;
  /** The absent session this credit originated from (YYYY-MM-DD). */
  sourceDate: string;
  /** Billing month of the absent session (YYYY-MM). */
  sourceMonth: string;
  /** Billing month where the make-up session was placed (YYYY-MM). */
  targetMonth?: string;
  durationMinutes: number;
  status: MakeUpStatus;
  scheduledDate?: string;
  startTime?: string;
  endTime?: string;
  /** Payment record id (${tuteeId}_${targetMonth}) that holds the make-up day. */
  attendanceRecordId?: string;
  completedAt?: string;
  schoolYear?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MakeUpCreditInput {
  tuteeId: string;
  tuteeName: string;
  sourceDate: string;
  durationMinutes: number;
  schoolYear?: string;
  notes?: string;
}

export interface ScheduleMakeUpInput {
  creditId: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  durationMinutes?: number;
  notes?: string;
}

export const makeUpCreditId = (tuteeId: string, sourceDate: string): string =>
  `${tuteeId}_${sourceDate.slice(0, 7)}_${sourceDate}`;

export const isActiveMakeUpStatus = (status: MakeUpStatus): boolean =>
  status === 'pending' || status === 'scheduled';

export const MAKE_UP_STATUS_LABELS: Record<MakeUpStatus, string> = {
  pending: 'Available',
  scheduled: 'Scheduled',
  completed: 'Completed',
  reversed: 'Reversed',
};

export const MAKE_UP_STATUS_STYLES: Record<MakeUpStatus, string> = {
  pending: 'bg-amber-50 border-amber-200 text-amber-700',
  scheduled: 'bg-blue-50 border-blue-200 text-blue-700',
  completed: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  reversed: 'bg-gray-50 border-gray-200 text-gray-500',
};
