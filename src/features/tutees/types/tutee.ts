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
  /** School years this student is enrolled in, e.g. ["2025-26", "2026-27"]. */
  schoolYears?: string[];
  /** School years in which this student is archived (per-year archive state). */
  archivedForYears?: string[];
  /** Per-school-year financial rollups maintained by syncTuteeTotals. */
  totalsByYear?: Record<
    string,
    { totalSessions: number; totalPaid: number; balance: number; lastPaymentDate?: string }
  >;
  totalSessions: number;
  totalPaid: number;
  balance: number;
  lastPaymentDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TuteeTotalsByYear {
  totalSessions: number;
  totalPaid: number;
  balance: number;
  lastPaymentDate?: string;
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

/**
 * True if the student is enrolled in the given school year.
 * Students without a `schoolYears` array (pre-migration) are considered enrolled.
 */
export function isTuteeInSchoolYear(
  tutee: Pick<Tutee, 'schoolYears'>,
  year: string
): boolean {
  const years = tutee.schoolYears;
  if (!Array.isArray(years) || years.length === 0) return true;
  return years.includes(year);
}

/**
 * Returns a student's financial state for a given school year.
 * Uses the per-year rollup when available, falling back to the flat (all-years)
 * fields for legacy records.
 */
export function getTuteeYearTotals(
  tutee: Tutee,
  year: string
): TuteeTotalsByYear {
  if (tutee.totalsByYear && year in tutee.totalsByYear) {
    return tutee.totalsByYear[year];
  }
  if (tutee.totalsByYear && Object.keys(tutee.totalsByYear).length > 0) {
    return {
      totalSessions: 0,
      totalPaid: 0,
      balance: 0,
      lastPaymentDate: undefined,
    };
  }
  if (Array.isArray(tutee.schoolYears) && tutee.schoolYears.length > 0) {
    return {
      totalSessions: 0,
      totalPaid: 0,
      balance: 0,
      lastPaymentDate: undefined,
    };
  }
  return {
    totalSessions: tutee.totalSessions || 0,
    totalPaid: tutee.totalPaid || 0,
    balance: tutee.balance || 0,
    lastPaymentDate: tutee.lastPaymentDate,
  };
}

/**
 * Returns the yearly financial rollup object with the given year initialized.
 * Used as the mutation helper when writing per-year totals.
 */
export function initTotalsByYear(year: string): Record<string, TuteeTotalsByYear> {
  return {
    [year]: { totalSessions: 0, totalPaid: 0, balance: 0 },
  };
}
