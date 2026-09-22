import {
  getCurrentSchoolYear,
  getDefaultSchoolYears,
  getSchoolYearFromDate,
  getSchoolYearFromMonth,
} from '@/shared/utils/schoolYear';
import { db, auth } from '@/shared/lib/firebase/config';
import { collection, doc, getDocs, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { dayPaymentService } from '@/features/attendance/services/dayPaymentService';

/**
 * School year migration / backfill.
 *
 * Existing data (created before school-year support) lacks:
 *  - `schoolYear` on records (payments, sessions, assessments, progressReports,
 *    announcements, paymentRecords, paymentTransactions)
 *  - `schoolYears` / `archivedForYears` / `totalsByYear` on tutees
 *  - documents in the `schoolYears` subcollection
 *  - `activeSchoolYear` on the tutor profile
 *
 * `belongsToSchoolYear` and `isTuteeInSchoolYear` gracefully fall back to date
 * heuristics for unstamped records, so this backfill is an optimization to make
 * per-year filtering exact and per-year totals available.
 */

type StampableRecord = {
  id: string;
  data: Record<string, any>;
};

type DateResolver = (data: Record<string, any>) => string | Date | undefined;

const resolvePaymentDate: DateResolver = (data) => data.paymentDate || data.createdAt;
const resolveSessionDate: DateResolver = (data) => data.sessionDate || data.createdAt;
const resolveAssessmentDate: DateResolver = (data) => data.date || data.createdAt;
const resolveReportDate: DateResolver = (data) => data.date || data.createdAt;
const resolveAnnouncementDate: DateResolver = (data) => data.createdAt;
const resolvePaymentRecordDate: DateResolver = (data) =>
  data.month ? `${data.month}-01` : (data.lastUpdated || data.createdAt);
const resolveTransactionDate: DateResolver = (data) =>
  data.paymentDate || (data.month ? `${data.month}-01` : null) || data.createdAt;

const COLLECTIONS: { name: string; resolve: DateResolver }[] = [
  { name: 'payments', resolve: resolvePaymentDate },
  { name: 'sessions', resolve: resolveSessionDate },
  { name: 'assessments', resolve: resolveAssessmentDate },
  { name: 'progressReports', resolve: resolveReportDate },
  { name: 'announcements', resolve: resolveAnnouncementDate },
  { name: 'paymentRecords', resolve: resolvePaymentRecordDate },
  { name: 'paymentTransactions', resolve: resolveTransactionDate },
];

function resolveSchoolYear(
  data: Record<string, any>,
  resolve: DateResolver
): string | undefined {
  if (typeof data.schoolYear === 'string' && data.schoolYear) return data.schoolYear;
  const value = resolve(data);
  if (typeof value === 'string') {
    const fromMonth = getSchoolYearFromMonth(value);
    if (fromMonth) return fromMonth;
    return getSchoolYearFromDate(value);
  }
  if ((value as any)?.toDate) {
    if (typeof data.month === 'string') return getSchoolYearFromMonth(data.month);
    return getSchoolYearFromDate((value as any).toDate());
  }
  if (value instanceof Date) {
    if (typeof data.month === 'string') return getSchoolYearFromMonth(data.month);
    return getSchoolYearFromDate(value);
  }
  return undefined;
}

async function stampRecords(userId: string): Promise<string[]> {
  const stamped: string[] = [];
  for (const { name, resolve } of COLLECTIONS) {
    const snap = await getDocs(collection(db, 'users', userId, name));
    const missing: StampableRecord[] = snap.docs
      .filter((d) => !d.data().schoolYear)
      .map((d) => ({ id: d.id, data: d.data() }));

    for (const record of missing) {
      const sy = resolveSchoolYear(record.data, resolve);
      if (!sy) continue;
      try {
        await updateDoc(doc(db, 'users', userId, name, record.id), { schoolYear: sy });
        stamped.push(`${name}/${record.id}`);
      } catch (error) {
        console.error(`Failed to stamp schoolYear on ${name}/${record.id}:`, error);
      }
    }
  }
  return stamped;
}

async function backfillTutees(userId: string): Promise<{ updated: number; years: Set<string> }> {
  const snap = await getDocs(collection(db, 'users', userId, 'tutees'));
  const years = new Set<string>();
  let updated = 0;

  for (const docSnap of snap.docs) {
    const tutee = docSnap.data();
    const id = docSnap.id;

    try {
      // Recompute per-year financial rollups from records + confirmed payments.
      await dayPaymentService.syncTuteeTotals(id, userId);
      const refreshedSnap = await getDoc(doc(db, 'users', userId, 'tutees', id));
      const refreshed = refreshedSnap.exists() ? refreshedSnap.data() : tutee;

      const totalsByYear = (refreshed.totalsByYear as Record<string, any>) || {};
      const schoolYearsSet = new Set<string>(
        Array.isArray(refreshed.schoolYears) ? refreshed.schoolYears : []
      );
      Object.keys(totalsByYear).forEach((sy) => schoolYearsSet.add(sy));

      const legacyArchived = refreshed.archived === true;
      let archivedForYears: string[] | null = null;
      if (Array.isArray(refreshed.archivedForYears)) {
        archivedForYears = refreshed.archivedForYears;
      } else if (legacyArchived) {
        archivedForYears = [getCurrentSchoolYear()];
      }

      const updates: Record<string, any> = {
        schoolYears: Array.from(schoolYearsSet).sort((a, b) => b.localeCompare(a)),
      };
      if (archivedForYears !== null) updates.archivedForYears = archivedForYears;
      if (schoolYearsSet.size > 0) years.add(Array.from(schoolYearsSet)[0]);

      await updateDoc(doc(db, 'users', userId, 'tutees', id), updates);
      schoolYearsSet.forEach((sy) => years.add(sy));
      updated++;
    } catch (error) {
      console.error(`Failed to backfill school years for tutee ${id}:`, error);
    }
  }

  return { updated, years };
}

async function seedSchoolYearDocs(userId: string, detectedYears: Set<string>): Promise<void> {
  const snap = await getDocs(collection(db, 'users', userId, 'schoolYears'));
  const existing = new Set(snap.docs.map((d) => d.id));
  const toSeed = new Set<string>(detectedYears);
  getDefaultSchoolYears().forEach((y) => toSeed.add(y));
  toSeed.add(getCurrentSchoolYear());

  for (const year of Array.from(toSeed).sort().reverse()) {
    if (existing.has(year)) continue;
    await setDoc(doc(db, 'users', userId, 'schoolYears', year), {
      value: year,
      createdAt: new Date().toISOString(),
    });
  }
}

async function ensureActiveYear(userId: string, detectedYears: Set<string>): Promise<void> {
  const userSnap = await getDoc(doc(db, 'users', userId));
  if (!userSnap.exists()) return;
  if (userSnap.data().activeSchoolYear) return;

  const sorted = Array.from(detectedYears).sort((a, b) => b.localeCompare(a));
  const defaultYears = getDefaultSchoolYears();
  const active =
    sorted.find((sy) => defaultYears.includes(sy)) || sorted[0] || getCurrentSchoolYear();

  await updateDoc(doc(db, 'users', userId), { activeSchoolYear: active });
}

export async function migrateSchoolYears(uid?: string, force = false): Promise<number> {
  if (!uid) uid = auth.currentUser?.uid;
  if (!uid) return 0;

  try {
    if (!force) {
      const userSnap = await getDoc(doc(db, 'users', uid));
      if (userSnap.exists() && userSnap.data().schoolYearsMigratedAt) return 0;
    }

    console.log('Starting school year backfill...');
    const stamped = await stampRecords(uid);
    const { updated, years } = await backfillTutees(uid);
    await seedSchoolYearDocs(uid, years);
    await ensureActiveYear(uid, years);
    await updateDoc(doc(db, 'users', uid), { schoolYearsMigratedAt: new Date().toISOString() });

    console.log(`School year backfill complete: ${stamped.length} records stamped, ${updated} tutees backfilled`);
    return stamped.length;
  } catch (error) {
    console.error('School year backfill failed:', error);
    return 0;
  }
}

// For manual re-runs via browser console
if (typeof window !== 'undefined') {
  (window as any).migrateSchoolYears = migrateSchoolYears;
}