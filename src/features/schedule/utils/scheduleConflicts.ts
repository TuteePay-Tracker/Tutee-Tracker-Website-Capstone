import {
  getTuteeScheduleForYear,
  getTuteeGradeLevelForYear,
  isTuteeArchivedForYear,
  isTuteeInSchoolYear,
  normalizeScheduleItems,
  type NormalizedScheduleItem,
  type ScheduleItem,
  type Tutee,
} from '@/features/tutees/types/tutee';
import { formatTime12h } from '@/shared/utils/formatDate';

export type GradeRelation = 'same' | 'different' | 'unknown';
export type ConflictSeverity = 'blocking' | 'warning';

export interface ScheduleConflict {
  day: string;
  firstTuteeId: string;
  firstTuteeName: string;
  firstGradeLevel?: string;
  firstSubjects?: string[];
  firstStartTime: string;
  firstEndTime: string;
  secondTuteeId: string;
  secondTuteeName: string;
  secondGradeLevel?: string;
  secondSubject?: string;
  secondSubjects?: string[];
  secondStartTime: string;
  secondEndTime: string;
  gradeRelation: GradeRelation;
  severity: ConflictSeverity;
  message: string;
}

export interface ScheduleEntry {
  tutee: Tutee;
  slot: NormalizedScheduleItem;
}

export interface FindScheduleConflictsOptions {
  candidateSchedule: ScheduleItem[] | string | null | undefined;
  candidateGradeLevel?: string;
  candidateSubject?: string;
  candidateSubjects?: string[];
  candidateName?: string;
  candidateTuteeId?: string;
  tutees: Tutee[];
  schoolYear: string;
  /** The tutee being edited — never compared against itself. */
  excludeTuteeId?: string;
}

const WEEKDAY_ORDER: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const DAY_ALIASES: Record<string, string> = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  tues: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  thur: 'Thursday',
  thurs: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
};

/** Converts an `HH:mm` or `HH:mm AM/PM` value to minutes since midnight. */
export function toMinutes(time: string): number {
  if (!time) return 0;
  const raw = String(time).trim().toUpperCase();
  const meridianMatch = raw.match(/(AM|PM)/);
  const cleaned = raw.replace(/(AM|PM)/g, '').trim();
  const [hStr, mStr] = cleaned.split(':');
  let hours = parseInt(hStr, 10);
  const minutes = parseInt(mStr, 10);

  if (isNaN(hours)) hours = 0;
  const validMinutes = !isNaN(minutes) && minutes >= 0 && minutes <= 59 ? minutes : 0;

  if (meridianMatch) {
    const isPM = meridianMatch[1] === 'PM';
    const isAM = meridianMatch[1] === 'AM';
    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
  }

  return (hours % 24) * 60 + validMinutes;
}

function normalizeRange(startTime: string, endTime: string): { start: number; end: number } {
  const start = toMinutes(startTime);
  let end = toMinutes(endTime);
  // Treat an end at/before the start as an overnight range.
  if (end <= start) end += 24 * 60;
  return { start, end };
}

/**
 * True when two time ranges overlap. Ranges that only touch end-to-end
 * (e.g. 09:00-10:00 and 10:00-11:00) do not conflict. Handles overnight ranges.
 */
export function rangesOverlap(
  aStartTime: string,
  aEndTime: string,
  bStartTime: string,
  bEndTime: string
): boolean {
  const a = normalizeRange(aStartTime, aEndTime);
  const b = normalizeRange(bStartTime, bEndTime);
  const day = 24 * 60;

  return (
    (a.start < b.end && b.start < a.end) ||
    // One range may cross midnight while the other sits on the next day.
    (a.start < b.end + day && b.start + day < a.end) ||
    (a.start + day < b.end && b.start < a.end + day)
  );
}

function normalizeDay(day: string): string {
  const value = (day || '').trim();
  if (!value) return '';
  const lower = value.toLowerCase();
  const alias = DAY_ALIASES[lower.slice(0, 4)] ?? DAY_ALIASES[lower.slice(0, 3)];
  if (alias) return alias;
  const full = Object.keys(WEEKDAY_ORDER).find((name) => name === lower);
  if (full) return full.charAt(0).toUpperCase() + full.slice(1);
  return value;
}

function sameDay(a: string, b: string): boolean {
  return normalizeDay(a).toLowerCase() === normalizeDay(b).toLowerCase();
}

function normalizeGrade(grade?: string): string {
  if (!grade) return '';
  const cleaned = String(grade).trim().toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ');
  const numMatch = cleaned.match(/\b(?:grade|gr|g|level)?\s*(\d+)\b/i);
  if (numMatch) {
    return `grade${parseInt(numMatch[1], 10)}`;
  }
  return cleaned.replace(/\s+/g, '');
}

function getGradeRelation(first?: string, second?: string): GradeRelation {
  const a = normalizeGrade(first);
  const b = normalizeGrade(second);
  // Schedules are validated strictly by grade level. If either student's grade
  // is missing or differs, they cannot share a schedule (blocking conflict).
  if (!a || !b) return 'different';
  return a === b ? 'same' : 'different';
}

function isExactScheduleMatch(
  firstStartTime: string,
  firstEndTime: string,
  secondStartTime: string,
  secondEndTime: string
): boolean {
  return (
    toMinutes(firstStartTime) === toMinutes(secondStartTime) &&
    toMinutes(firstEndTime) === toMinutes(secondEndTime)
  );
}

function formatRange(startTime: string, endTime: string): string {
  return `${formatTime12h(startTime)} – ${formatTime12h(endTime)}`;
}

export function normalizeSubjectName(subject: string): string {
  return (subject || '').trim().toLowerCase();
}

export function areSubjectsExactMatch(
  firstSubjects?: string[] | string,
  secondSubjects?: string[] | string
): boolean {
  const toList = (s?: string[] | string): string[] => {
    if (!s) return [];
    const arr = Array.isArray(s) ? s : [s];
    return arr
      .map(normalizeSubjectName)
      .filter(Boolean)
      .sort();
  };

  const listA = toList(firstSubjects);
  const listB = toList(secondSubjects);

  if (listA.length !== listB.length) return false;
  return listA.every((val, idx) => val === listB[idx]);
}

/**
 * True when two tutees belong to the same regular group session, i.e. they are
 * in the same grade level, enrolled in exactly the same subjects, and share at
 * least one identical regular schedule slot (same day, start and end time).
 * This mirrors the group-session rule used by `buildConflict`.
 */
export function areTuteesInSameRegularGroup(
  first: Pick<Tutee, 'gradeLevel' | 'gradeLevelByYear' | 'subject' | 'subjects' | 'schedule' | 'scheduleByYear'>,
  second: Pick<Tutee, 'gradeLevel' | 'gradeLevelByYear' | 'subject' | 'subjects' | 'schedule' | 'scheduleByYear'>,
  schoolYear: string
): boolean {
  const firstGrade = normalizeGrade(getTuteeGradeLevelForYear(first, schoolYear));
  const secondGrade = normalizeGrade(getTuteeGradeLevelForYear(second, schoolYear));
  if (!firstGrade || !secondGrade || firstGrade !== secondGrade) return false;

  const firstSubjects =
    first.subjects && first.subjects.length > 0
      ? first.subjects
      : first.subject
      ? [first.subject]
      : [];
  const secondSubjects =
    second.subjects && second.subjects.length > 0
      ? second.subjects
      : second.subject
      ? [second.subject]
      : [];
  if (!areSubjectsExactMatch(firstSubjects, secondSubjects)) return false;

  const firstSlots = normalizeScheduleItems(getTuteeScheduleForYear(first, schoolYear));
  const secondSlots = normalizeScheduleItems(getTuteeScheduleForYear(second, schoolYear));

  return firstSlots.some((a) =>
    secondSlots.some(
      (b) =>
        sameDay(a.day, b.day) &&
        isExactScheduleMatch(a.startTime, a.endTime, b.startTime, b.endTime)
    )
  );
}

function buildConflict(params: {
  day: string;
  firstTuteeId: string;
  firstTuteeName: string;
  firstGradeLevel?: string;
  firstSubjects?: string[];
  firstStartTime: string;
  firstEndTime: string;
  secondTuteeId: string;
  secondTuteeName: string;
  secondGradeLevel?: string;
  secondSubject?: string;
  secondSubjects?: string[];
  secondStartTime: string;
  secondEndTime: string;
}): ScheduleConflict {
  const relation = getGradeRelation(params.firstGradeLevel, params.secondGradeLevel);
  const exactMatch = isExactScheduleMatch(
    params.firstStartTime,
    params.firstEndTime,
    params.secondStartTime,
    params.secondEndTime
  );
  const exactSubjects = areSubjectsExactMatch(params.firstSubjects, params.secondSubjects);

  // Group session is ONLY allowed when:
  // 1. Both students are in the SAME grade level
  // 2. Their schedule times match EXACTLY (start and end times)
  // 3. Their enrolled subjects match EXACTLY (e.g. English + Math vs English + Math + Filipino is a conflict)
  const severity: ConflictSeverity =
    relation === 'same' && exactMatch && exactSubjects ? 'warning' : 'blocking';

  const secondGrade = params.secondGradeLevel ? ` (${params.secondGradeLevel})` : '';
  const firstRange = formatRange(params.firstStartTime, params.firstEndTime);
  const secondRange = formatRange(params.secondStartTime, params.secondEndTime);

  let message: string;
  if (relation === 'different') {
    message = `${normalizeDay(params.day)} ${firstRange} conflicts with ${params.secondTuteeName}${secondGrade} scheduled at ${secondRange} (different grade level)`;
  } else if (!exactMatch) {
    message = `${normalizeDay(params.day)} ${firstRange} partially overlaps with ${params.secondTuteeName}${secondGrade} scheduled at ${secondRange} (partially overlapping time — same-grade group sessions must match start and end times exactly)`;
  } else if (!exactSubjects) {
    const secondSubStr = params.secondSubjects?.length ? params.secondSubjects.join(', ') : (params.secondSubject || 'none');
    const firstSubStr = params.firstSubjects?.length ? params.firstSubjects.join(', ') : 'none';
    message = `${normalizeDay(params.day)} ${firstRange} conflicts with ${params.secondTuteeName}${secondGrade} (${secondSubStr}) — subject mismatch with (${firstSubStr}); group sessions require identical subjects`;
  } else {
    message = `${normalizeDay(params.day)} ${firstRange} shared with ${params.secondTuteeName}${secondGrade} (exact matching schedule & subjects — group session allowed)`;
  }

  return {
    ...params,
    gradeRelation: relation,
    severity,
    message,
  };
}

function sortConflicts(conflicts: ScheduleConflict[]): ScheduleConflict[] {
  return conflicts.sort((a, b) => {
    const dayDiff =
      (WEEKDAY_ORDER[normalizeDay(a.day).toLowerCase()] ?? 99) -
      (WEEKDAY_ORDER[normalizeDay(b.day).toLowerCase()] ?? 99);
    if (dayDiff !== 0) return dayDiff;
    return toMinutes(a.firstStartTime) - toMinutes(b.firstStartTime);
  });
}

/**
 * Compares a candidate weekly schedule against every other active tutee in the
 * given school year based strictly on grade level, selected days, and time ranges.
 *
 * - Subjects (single or multiple) are NEVER used to bypass conflict detection.
 * - Same-grade tutees are allowed to share the same schedule (e.g. group sessions).
 * - Different-grade tutees with overlapping schedules are rejected as blocking conflicts,
 *   even with differing start/end times or durations (e.g. 9:00-10:00 vs 9:00-11:00).
 */
export function findScheduleConflicts({
  candidateSchedule,
  candidateGradeLevel,
  candidateSubject,
  candidateSubjects,
  candidateName = 'This tutee',
  candidateTuteeId = 'candidate',
  tutees,
  schoolYear,
  excludeTuteeId,
}: FindScheduleConflictsOptions): ScheduleConflict[] {
  const candidateSlots = normalizeScheduleItems(candidateSchedule);
  if (candidateSlots.length === 0) return [];

  const candidateSubjectList =
    candidateSubjects && candidateSubjects.length > 0
      ? candidateSubjects
      : candidateSubject
      ? [candidateSubject]
      : [];

  const conflicts: ScheduleConflict[] = [];
  const seen = new Set<string>();

  tutees.forEach((tutee) => {
    if (tutee.id === excludeTuteeId) return;
    if (!isTuteeInSchoolYear(tutee, schoolYear)) return;
    if (isTuteeArchivedForYear(tutee, schoolYear)) return;

    const existingSlots = normalizeScheduleItems(getTuteeScheduleForYear(tutee, schoolYear));
    const tuteeName = `${tutee.firstName || ''} ${tutee.surname || ''}`.trim() || 'Unnamed tutee';
    const existingSubjects =
      tutee.subjects && tutee.subjects.length > 0
        ? tutee.subjects
        : tutee.subject
        ? [tutee.subject]
        : [];

    existingSlots.forEach((existing) => {
      candidateSlots.forEach((slot) => {
        if (!sameDay(slot.day, existing.day)) return;
        if (!rangesOverlap(slot.startTime, slot.endTime, existing.startTime, existing.endTime)) return;

        const key = [
          tutee.id,
          normalizeDay(slot.day),
          slot.startTime,
          slot.endTime,
          existing.startTime,
          existing.endTime,
        ].join('|');
        if (seen.has(key)) return;
        seen.add(key);

        conflicts.push(
          buildConflict({
            day: slot.day,
            firstTuteeId: candidateTuteeId,
            firstTuteeName: candidateName,
            firstGradeLevel: candidateGradeLevel,
            firstSubjects: candidateSubjectList,
            firstStartTime: slot.startTime,
            firstEndTime: slot.endTime,
            secondTuteeId: tutee.id,
            secondTuteeName: tuteeName,
            secondGradeLevel: getTuteeGradeLevelForYear(tutee, schoolYear),
            secondSubject: tutee.subject,
            secondSubjects: existingSubjects,
            secondStartTime: existing.startTime,
            secondEndTime: existing.endTime,
          })
        );
      });
    });
  });

  return sortConflicts(conflicts);
}

/** True when at least one blocking conflict (cross-grade overlap) is detected. */
export function hasBlockingConflicts(conflicts: ScheduleConflict[]): boolean {
  return conflicts.some((conflict) => conflict.severity === 'blocking');
}

/** True when at least one blocking schedule conflict is detected. */
export function hasScheduleConflicts(conflicts: ScheduleConflict[]): boolean {
  return conflicts.some((conflict) => conflict.severity === 'blocking');
}

/**
 * Pairwise conflict detection for a flat list of sessions (used by the
 * Schedule calendar to badge overlapping entries on screen).
 */
export function findDayConflicts(entries: ScheduleEntry[]): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const first = entries[i];
      const second = entries[j];
      if (first.tutee.id === second.tutee.id) continue;
      if (!sameDay(first.slot.day, second.slot.day)) continue;
      if (
        !rangesOverlap(
          first.slot.startTime,
          first.slot.endTime,
          second.slot.startTime,
          second.slot.endTime
        )
      ) {
        continue;
      }

      const key = [
        normalizeDay(first.slot.day),
        first.tutee.id,
        first.slot.startTime,
        first.slot.endTime,
        second.tutee.id,
        second.slot.startTime,
        second.slot.endTime,
      ].join('|');
      if (seen.has(key)) continue;
      seen.add(key);

      const firstName = `${first.tutee.firstName || ''} ${first.tutee.surname || ''}`.trim() || 'Unnamed tutee';
      const secondName = `${second.tutee.firstName || ''} ${second.tutee.surname || ''}`.trim() || 'Unnamed tutee';

      const firstSubjects =
        first.tutee.subjects && first.tutee.subjects.length > 0
          ? first.tutee.subjects
          : first.tutee.subject
          ? [first.tutee.subject]
          : [];
      const secondSubjects =
        second.tutee.subjects && second.tutee.subjects.length > 0
          ? second.tutee.subjects
          : second.tutee.subject
          ? [second.tutee.subject]
          : [];

      conflicts.push(
        buildConflict({
          day: first.slot.day,
          firstTuteeId: first.tutee.id,
          firstTuteeName: firstName,
          firstGradeLevel: first.tutee.gradeLevel,
          firstSubjects,
          firstStartTime: first.slot.startTime,
          firstEndTime: first.slot.endTime,
          secondTuteeId: second.tutee.id,
          secondTuteeName: secondName,
          secondGradeLevel: second.tutee.gradeLevel,
          secondSubject: second.tutee.subject,
          secondSubjects,
          secondStartTime: second.slot.startTime,
          secondEndTime: second.slot.endTime,
        })
      );
    }
  }

  return sortConflicts(conflicts);
}

/** True when the conflict involves the given tutee's session. */
export function conflictTouchesSession(
  conflict: ScheduleConflict,
  tuteeId: string,
  slot: NormalizedScheduleItem
): boolean {
  return (
    (conflict.firstTuteeId === tuteeId &&
      conflict.firstStartTime === slot.startTime &&
      conflict.firstEndTime === slot.endTime) ||
    (conflict.secondTuteeId === tuteeId &&
      conflict.secondStartTime === slot.startTime &&
      conflict.secondEndTime === slot.endTime)
  );
}

/**
 * Returns the most severe conflict touching a session, or `undefined` when the
 * session is clear. Blocking conflicts take precedence over warnings.
 */
export function getSessionConflict(
  conflicts: ScheduleConflict[],
  tuteeId: string,
  slot: NormalizedScheduleItem
): ScheduleConflict | undefined {
  const touching = conflicts.filter((conflict) => conflictTouchesSession(conflict, tuteeId, slot));
  return touching.find((conflict) => conflict.severity === 'blocking') ?? touching[0];
}
