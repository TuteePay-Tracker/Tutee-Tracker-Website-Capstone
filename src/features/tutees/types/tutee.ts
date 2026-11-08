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
  /** Per-school-year schedules, e.g. { "2026-27": ScheduleItem[] }. */
  scheduleByYear?: Record<string, ScheduleItem[] | string>;
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
 * True if the student is archived for the given school year.
 * Legacy records without `archivedForYears` fall back to the flat `archived`
 * flag.
 */
export function isTuteeArchivedForYear(
  tutee: Pick<Tutee, 'archived' | 'archivedForYears'>,
  year: string
): boolean {
  if (Array.isArray(tutee.archivedForYears)) {
    return tutee.archivedForYears.includes(year);
  }
  return !!tutee.archived;
}

/**
 * Returns a student's schedule for a given school year.
 *
 * Schedules are stored per school year. When a year has no entry but the
 * student already has per-year schedules, the year is intentionally blank
 * (e.g. a newly carried-over school year should not inherit last year's
 * timetable). Only legacy records with no `scheduleByYear` fall back to the
 * flat `schedule` field.
 */
export function getTuteeScheduleForYear(
  tutee: Pick<Tutee, 'schedule' | 'scheduleByYear'>,
  year: string
): ScheduleItem[] | string {
  const byYear = tutee.scheduleByYear;
  if (byYear && typeof byYear === 'object') {
    if (year in byYear) return byYear[year];
    if (Object.keys(byYear).length > 0) return [];
  }
  return tutee.schedule ?? [];
}

export interface NormalizedScheduleItem {
  day: string;
  startTime: string;
  endTime: string;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TIME_TOKEN = '(\\d{1,2}(?::\\d{1,2})?\\s*(?:AM|PM)?)';
const TIME_RANGE_REGEX = new RegExp(`${TIME_TOKEN}\\s*(?:-|–|—|to)\\s*${TIME_TOKEN}`, 'i');
const SINGLE_TIME_REGEX = new RegExp(TIME_TOKEN, 'i');

function findScheduleDays(value: string): string[] {
  const lower = value.toLowerCase();
  const matched = new Set<string>();

  // Support common multi-day acronyms like MWF (Mon/Wed/Fri) and TTH (Tue/Thu)
  if (/\bmwf\b|\bm-w-f\b/i.test(lower)) {
    matched.add('Monday');
    matched.add('Wednesday');
    matched.add('Friday');
  }
  if (/\btth\b|\bt-th\b/i.test(lower)) {
    matched.add('Tuesday');
    matched.add('Thursday');
  }

  WEEKDAYS.forEach((day) => {
    const full = day.toLowerCase();
    const abbr = full.slice(0, 3);
    if (
      new RegExp(`\\b${full}\\b`, 'i').test(lower) ||
      new RegExp(`(^|[^a-z])${abbr}([^a-z]|$)`, 'i').test(lower)
    ) {
      matched.add(day);
    }
  });

  return Array.from(matched);
}

function parseTimeToken(value: string): string | undefined {
  const cleaned = value.trim().toUpperCase().replace(/\./g, '');
  const match = cleaned.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(AM|PM)?$/);
  if (!match) return undefined;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const meridian = match[3];

  if (isNaN(hours) || isNaN(minutes) || minutes > 59) return undefined;

  if (meridian) {
    if (hours < 1 || hours > 12) return undefined;
    if (meridian === 'PM' && hours < 12) hours += 12;
    if (meridian === 'AM' && hours === 12) hours = 0;
  }

  if (hours > 23) return undefined;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function addHour(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const total = (hours * 60 + minutes + 60) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function getMeridian(value: string): 'AM' | 'PM' | undefined {
  const match = value.toUpperCase().replace(/\./g, '').match(/(AM|PM)/);
  return match ? (match[1] as 'AM' | 'PM') : undefined;
}

function adjustRangeMeridians(
  startRaw: string,
  endRaw: string,
  startTime: string,
  endTime: string
): { startTime: string; endTime: string } {
  let [startHours, startMinutes] = startTime.split(':').map(Number);
  let [endHours, endMinutes] = endTime.split(':').map(Number);
  const startMeridian = getMeridian(startRaw);
  const endMeridian = getMeridian(endRaw);

  if (!startMeridian && endMeridian && startHours <= 12) {
    if (endMeridian === 'PM' && startHours + 12 <= endHours) {
      startHours += 12;
    } else if (endMeridian === 'AM' && startHours > endHours) {
      startHours = startHours === 12 ? 0 : startHours + 12;
    }
  } else if (startMeridian && !endMeridian && endHours < 12) {
    const candidate = endHours + 12;
    if (startMeridian === 'PM' ? candidate > startHours : endHours < startHours) {
      endHours = candidate;
    }
  }

  return {
    startTime: `${String(startHours).padStart(2, '0')}:${String(startMinutes).padStart(2, '0')}`,
    endTime: `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`,
  };
}

function extractTimeRange(value: string): { startTime: string; endTime: string } | undefined {
  const rangeMatch = value.match(TIME_RANGE_REGEX);
  if (rangeMatch) {
    const startTime = parseTimeToken(rangeMatch[1]);
    const endTime = parseTimeToken(rangeMatch[2]);
    if (startTime && endTime) {
      return adjustRangeMeridians(rangeMatch[1], rangeMatch[2], startTime, endTime);
    }
    if (startTime) return { startTime, endTime: addHour(startTime) };
  }

  const singleMatch = value.match(SINGLE_TIME_REGEX);
  if (singleMatch) {
    const startTime = parseTimeToken(singleMatch[1]);
    if (startTime) return { startTime, endTime: addHour(startTime) };
  }

  return undefined;
}

function parseScheduleText(text: string): NormalizedScheduleItem[] {
  const items: NormalizedScheduleItem[] = [];

  for (const line of text.split(/\r?\n|;+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const commaParts = trimmed.split(',').map((part) => part.trim()).filter(Boolean);
    const parts = commaParts.length > 1 && commaParts.every((part) => extractTimeRange(part))
      ? commaParts
      : [trimmed];

    for (const part of parts) {
      const days = findScheduleDays(part);
      if (days.length === 0) continue;
      const range = extractTimeRange(part) ?? { startTime: '09:00', endTime: '10:00' };
      days.forEach((day) => items.push({ day, ...range }));
    }
  }

  return items;
}

export function normalizeScheduleItems(
  schedule: ScheduleItem[] | string | null | undefined
): NormalizedScheduleItem[] {
  if (!schedule) return [];

  const items: NormalizedScheduleItem[] = [];

  const pushObject = (entry: any) => {
    if (!entry || typeof entry !== 'object') return;

    const days = findScheduleDays(String(entry.day ?? ''));
    if (days.length === 0) return;

    let range: { startTime: string; endTime: string } | undefined;
    const startTime = entry.startTime ? parseTimeToken(String(entry.startTime)) : undefined;
    const endTime = entry.endTime ? parseTimeToken(String(entry.endTime)) : undefined;

    if (startTime) {
      range = { startTime, endTime: endTime ?? addHour(startTime) };
    } else if (entry.startTime || entry.endTime || entry.time) {
      range = extractTimeRange(
        [entry.startTime, entry.endTime, entry.time].filter(Boolean).join(' ')
      );
    }

    const resolved = range ?? { startTime: '09:00', endTime: '10:00' };
    days.forEach((day) => items.push({ day, ...resolved }));
  };

  const entries = Array.isArray(schedule) ? schedule : [schedule];
  for (const entry of entries) {
    if (typeof entry === 'string') {
      items.push(...parseScheduleText(entry));
    } else {
      pushObject(entry);
    }
  }

  return items;
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
