import {
  getDayAttendance,
  isMakeUpDay,
  type PaymentRecord,
} from '@/features/attendance/types/dayPayment';
import type { MakeUpCredit } from '@/features/attendance/types/makeUpCredit';

export interface MonthlySessionSummary {
  month: string;
  regularSessions: number;
  makeUpSessions: number;
  totalSessions: number;
  present: number;
  absent: number;
  noClass: number;
  unmarked: number;
  /** Credits earned from absences in this month that have not been used yet. */
  availableCredits: number;
  /** Credits from this month currently scheduled into a make-up class. */
  scheduledCredits: number;
  /** Completed make-up credits earned from this month. */
  completedCredits: number;
  attendanceRate: number;
}

export function summarizeMonth(
  record: PaymentRecord,
  credits: MakeUpCredit[] = []
): MonthlySessionSummary {
  const days = record.dayPayments || [];
  const regularDays = days.filter((day) => !isMakeUpDay(day));
  const makeUpDays = days.filter(isMakeUpDay);

  let present = 0;
  let absent = 0;
  let noClass = 0;
  let unmarked = 0;

  days.forEach((day) => {
    const attendance = getDayAttendance(day);
    if (attendance === 'present') present += 1;
    else if (attendance === 'absent') absent += 1;
    else if (attendance === 'no-class') noClass += 1;
    else unmarked += 1;
  });

  const monthCredits = credits.filter((credit) => credit.sourceMonth === record.month);
  const availableCredits = monthCredits.filter((credit) => credit.status === 'pending').length;
  const scheduledCredits = monthCredits.filter((credit) => credit.status === 'scheduled').length;
  const completedCredits = monthCredits.filter((credit) => credit.status === 'completed').length;

  const totalSessions = regularDays.length + makeUpDays.length;
  const countable = Math.max(totalSessions - noClass, 0);

  return {
    month: record.month,
    regularSessions: regularDays.length,
    makeUpSessions: makeUpDays.length,
    totalSessions,
    present,
    absent,
    noClass,
    unmarked,
    availableCredits,
    scheduledCredits,
    completedCredits,
    attendanceRate: countable > 0 ? Math.round((present / countable) * 100) : 0,
  };
}

export function buildSessionSummaries(
  records: PaymentRecord[],
  credits: MakeUpCredit[] = []
): MonthlySessionSummary[] {
  return records
    .map((record) => summarizeMonth(record, credits))
    .sort((a, b) => b.month.localeCompare(a.month));
}
