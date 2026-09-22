/**
 * School Year utilities — Philippine convention.
 * A school year runs from June 1 of year N to May 31 of year N+1.
 * Format: "2026-27" (short form of SY 2026–2027)
 */

/**
 * Returns the current active school year string based on today's date.
 * E.g. in June–December 2026 → "2026-27", in Jan–May 2027 → "2026-27"
 */
export function getCurrentSchoolYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed

  // June (6) onwards → SY starts this calendar year
  // January–May → SY started previous calendar year
  const startYear = month >= 6 ? year : year - 1;
  const endYear = startYear + 1;
  return `${startYear}-${String(endYear).slice(-2)}`;
}

/**
 * Returns the start and end Date for a given school year string.
 * SY "2026-27" → { start: June 1 2026, end: May 31 2027 }
 */
export function getSchoolYearRange(sy: string): { start: Date; end: Date } {
  const parts = sy.split('-');
  const startYear = parseInt(parts[0], 10);
  const endYear = startYear + 1;

  const start = new Date(startYear, 5, 1, 0, 0, 0, 0); // June 1
  const end = new Date(endYear, 4, 31, 23, 59, 59, 999); // May 31

  return { start, end };
}

/**
 * Returns an array of school year strings centered around the current SY.
 * Goes 3 years back and 1 year forward from the current SY.
 */
export function getAvailableSchoolYears(): string[] {
  return getDefaultSchoolYears();
}

/**
 * The fallback/default list of school years (current ± range) used when no
 * per-tutor school year list exists yet.
 */
export function getDefaultSchoolYears(back = 3, forward = 1): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentStartYear = month >= 6 ? year : year - 1;

  const years: string[] = [];
  for (let i = -back; i <= forward; i++) {
    const sy = currentStartYear + i;
    const endYearShort = String(sy + 1).slice(-2);
    years.push(`${sy}-${endYearShort}`);
  }
  return years;
}

/**
 * Returns the next consecutive school year string after the given one.
 * "2026-27" → "2027-28". Returns undefined for invalid input.
 */
export function getNextSchoolYear(sy: string): string | undefined {
  if (!/^\d{4}-\d{2}$/.test(sy)) return undefined;
  const startYear = parseInt(sy.slice(0, 4), 10);
  if (isNaN(startYear)) return undefined;
  const nextStart = startYear + 1;
  return `${nextStart}-${String(nextStart + 1).slice(-2)}`;
}

/**
 * Formats a school year string for display.
 * "2026-27" → "SY 2026–27"
 */
export function formatSchoolYear(sy: string): string {
  return `SY ${sy.replace('-', '–')}`;
}

/**
 * Returns true if a given date falls within the specified school year.
 */
export function isInSchoolYear(date: Date | string, sy: string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const { start, end } = getSchoolYearRange(sy);
  return d >= start && d <= end;
}

/**
 * Derives the school year string from a given date.
 * June–May convention: "2026-06-15" → "2026-27", "2027-03-10" → "2026-27".
 * Returns undefined for invalid/empty input.
 */
export function getSchoolYearFromDate(date: Date | string | undefined | null): string | undefined {
  if (!date) return undefined;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return undefined;
  const startYear = d.getMonth() + 1 >= 6 ? d.getFullYear() : d.getFullYear() - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

/**
 * Derives the school year from a "YYYY-MM" month key.
 * NB: the June boundary splits months cleanly — "2027-05" → "2026-27",
 * "2027-06" → "2027-28".
 */
export function getSchoolYearFromMonth(month: string | undefined | null): string | undefined {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return undefined;
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  if (isNaN(year) || isNaN(monthNum)) return undefined;
  const startYear = monthNum >= 6 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

/**
 * Returns true if a "YYYY-MM" month key falls within the given school year.
 */
export function isMonthInSchoolYear(month: string, sy: string): boolean {
  return getSchoolYearFromMonth(month) === sy;
}

/**
 * Normalizes a Firestore Timestamp-like value into an ISO date string.
 */
function toDateInput(value: unknown): Date | string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && typeof (value as any).toDate === 'function') {
    return (value as any).toDate();
  }
  return undefined;
}

/**
 * Returns true if a record belongs to the given school year.
 * Uses the explicitly stamped `schoolYear` when present, otherwise derives it
 * from available date-ish fields (paymentDate → date → createdAt → month).
 * Records with no detectable date default to TRUE (all years) for backwards
 * compatibility with pre-backfill data.
 */
export function belongsToSchoolYear(
  sy: string,
  record: {
    schoolYear?: string | null;
    paymentDate?: unknown;
    date?: unknown;
    createdAt?: unknown;
    month?: string | null;
  } = {}
): boolean {
  if (record.schoolYear) return record.schoolYear === sy;
  const src = toDateInput(record.paymentDate) ?? toDateInput(record.date) ?? toDateInput(record.createdAt);
  const derived = src !== undefined ? getSchoolYearFromDate(src) : undefined;
  if (derived !== undefined) return derived === sy;
  if (record.month) return getSchoolYearFromMonth(record.month) === sy;
  return true;
}
