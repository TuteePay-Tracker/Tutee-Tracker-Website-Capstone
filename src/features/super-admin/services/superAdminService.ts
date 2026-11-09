import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit as limitTo,
  orderBy,
  query,
  where,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/shared/lib/firebase/config';
import { getDayAttendance, type PaymentRecord } from '@/features/attendance/types/dayPayment';
import type { Payment } from '@/features/payments/types/payment';
import type { Assessment } from '@/features/tutee-progress/types/assessment';
import type { Tutee } from '@/features/tutees/types/tutee';
import type {
  ActivityFilters,
  ActivityLogEntry,
  AcademicSummary,
  AttendanceSummary,
  ParentAccount,
  PaymentSummary,
  PlatformStats,
  SuperAdminTutorSummary,
  TutorAccount,
  TutorMonitoringDetail,
} from '../types/superAdmin';

const isActiveStatus = (status?: string): boolean => !status || status === 'active';

const toDate = (value: any): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') {
    try {
      return value.toDate();
    } catch {
      return null;
    }
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value?.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }
  return null;
};

const mapTutor = (id: string, data: Record<string, any>): TutorAccount => ({
  id,
  name: data.name || 'Unnamed Tutor',
  email: data.email || '',
  createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
  status: typeof data.status === 'string' ? data.status : 'active',
  contactNumber: data.contactNumber,
  photoUrl: data.photoUrl,
});

const mapParent = (id: string, data: Record<string, any>): ParentAccount => ({
  id,
  name: data.name || 'Unnamed Parent',
  email: data.email || '',
  createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
  status: typeof data.status === 'string' ? data.status : 'active',
  createdByTutorId: data.createdByTutorId,
  linkedStudentIds: Array.isArray(data.linkedStudentIds) ? data.linkedStudentIds : [],
});

const mapActivity = (id: string, data: Record<string, any>): ActivityLogEntry => ({
  id,
  tutorId: data.tutorId || '',
  tutorName: data.tutorName || data.userName || 'Unknown Tutor',
  userId: data.userId || '',
  userName: data.userName || '',
  userRole: data.userRole || '',
  actionType: data.actionType || 'Unknown',
  module: data.module || '',
  description: data.description || '',
  timestamp: toDate(data.timestamp),
});

const getAllTutors = async (): Promise<TutorAccount[]> => {
  const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'tutor')));
  return snap.docs.map((d) => mapTutor(d.id, d.data()));
};

const getAllParents = async (): Promise<ParentAccount[]> => {
  const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'parent')));
  return snap.docs.map((d) => mapParent(d.id, d.data()));
};

const getRecentActivityForTutor = async (
  tutorId: string,
  max = 1
): Promise<ActivityLogEntry[]> => {
  const snap = await getDocs(
    query(
      collection(db, 'audit_logs'),
      where('tutorId', '==', tutorId),
      orderBy('timestamp', 'desc'),
      limitTo(max)
    )
  );
  return snap.docs.map((d) => mapActivity(d.id, d.data()));
};

const getPlatformStats = async (): Promise<PlatformStats> => {
  const [tutors, parents, activityCount] = await Promise.all([
    getAllTutors(),
    getAllParents(),
    getCountFromServer(collection(db, 'audit_logs')),
  ]);

  const tuteeCounts = await Promise.all(
    tutors.map((tutor) =>
      getCountFromServer(collection(db, 'users', tutor.id, 'tutees'))
    )
  );

  return {
    totalTutors: tutors.length,
    activeTutors: tutors.filter((tutor) => isActiveStatus(tutor.status)).length,
    totalTutees: tuteeCounts.reduce((sum, snap) => sum + snap.data().count, 0),
    totalParents: parents.length,
    totalActivities: activityCount.data().count,
  };
};

const getTutorSummaries = async (): Promise<SuperAdminTutorSummary[]> => {
  const [tutors, parents] = await Promise.all([getAllTutors(), getAllParents()]);

  const parentsByTutor = new Map<string, number>();
  parents.forEach((parent) => {
    if (!parent.createdByTutorId) return;
    parentsByTutor.set(
      parent.createdByTutorId,
      (parentsByTutor.get(parent.createdByTutorId) || 0) + 1
    );
  });

  const summaries = await Promise.all(
    tutors.map(async (tutor) => {
      const [tuteeCount, recent] = await Promise.all([
        getCountFromServer(collection(db, 'users', tutor.id, 'tutees')),
        getRecentActivityForTutor(tutor.id, 1),
      ]);

      const last = recent[0] ?? null;

      return {
        id: tutor.id,
        name: tutor.name,
        email: tutor.email,
        createdAt: tutor.createdAt,
        status: tutor.status,
        totalTutees: tuteeCount.data().count,
        totalParents: parentsByTutor.get(tutor.id) || 0,
        lastActivityAt: last?.timestamp ?? null,
        lastActivityAction: last
          ? `${last.actionType}${last.description ? ` — ${last.description}` : ''}`
          : null,
      } satisfies SuperAdminTutorSummary;
    })
  );

  return summaries.sort((a, b) =>
    (b.createdAt || '').localeCompare(a.createdAt || '')
  );
};

const getActivityLogs = async (
  filters: ActivityFilters = {}
): Promise<ActivityLogEntry[]> => {
  const constraints: QueryConstraint[] = [];

  if (filters.tutorId) {
    constraints.push(where('tutorId', '==', filters.tutorId));
  }

  constraints.push(orderBy('timestamp', 'desc'), limitTo(filters.limit ?? 250));

  const snap = await getDocs(query(collection(db, 'audit_logs'), ...constraints));
  let logs = snap.docs.map((d) => mapActivity(d.id, d.data()));

  if (filters.actionType) {
    logs = logs.filter((log) => log.actionType === filters.actionType);
  }

  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom);
    if (!Number.isNaN(from.getTime())) {
      logs = logs.filter((log) => log.timestamp !== null && log.timestamp >= from);
    }
  }

  if (filters.dateTo) {
    const to = new Date(filters.dateTo);
    if (!Number.isNaN(to.getTime())) {
      to.setHours(23, 59, 59, 999);
      logs = logs.filter((log) => log.timestamp !== null && log.timestamp <= to);
    }
  }

  return logs;
};

const getTutorMonitoringDetail = async (
  tutorId: string
): Promise<TutorMonitoringDetail> => {
  const tutorSnap = await getDoc(doc(db, 'users', tutorId));
  if (!tutorSnap.exists()) {
    throw new Error('Tutor not found');
  }

  const tutor = mapTutor(tutorSnap.id, tutorSnap.data());

  const [tuteesSnap, allParents, recordsSnap, paymentsSnap, assessmentsSnap, recentActivities] =
    await Promise.all([
      getDocs(collection(db, 'users', tutorId, 'tutees')),
      getAllParents(),
      getDocs(collection(db, 'users', tutorId, 'paymentRecords')),
      getDocs(collection(db, 'users', tutorId, 'payments')),
      getDocs(collection(db, 'users', tutorId, 'assessments')),
      getRecentActivityForTutor(tutorId, 20),
    ]);

  const tutees = tuteesSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as unknown as Tutee)
  );
  const records = recordsSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as unknown as PaymentRecord)
  );
  const paymentsList = paymentsSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as unknown as Payment)
  );
  const assessments = assessmentsSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as unknown as Assessment)
  );

  const attendance: AttendanceSummary = {
    totalDays: 0,
    present: 0,
    absent: 0,
    noClass: 0,
    unmarked: 0,
    attendanceRate: 0,
  };

  records.forEach((record) => {
    (record.dayPayments || []).forEach((day) => {
      attendance.totalDays += 1;
      const status = getDayAttendance(day);
      if (status === 'present') attendance.present += 1;
      else if (status === 'absent') attendance.absent += 1;
      else if (status === 'no-class') attendance.noClass += 1;
      else attendance.unmarked += 1;
    });
  });

  const markedDays = attendance.present + attendance.absent;
  attendance.attendanceRate =
    markedDays > 0 ? (attendance.present / markedDays) * 100 : 0;

  // Compute financial totals:
  // 1. Total paid: sum of confirmed/verified payments from the payments collection
  const confirmedPayments = paymentsList.filter(
    (p) => p.status !== 'pending' && p.status !== 'rejected'
  );
  const totalPaidFromPayments = confirmedPayments.reduce(
    (sum, p) => sum + (typeof p.amount === 'number' ? p.amount : 0),
    0
  );

  // Fallback for totalPaid: sum of tutee.totalPaid or record.totalPaid
  const totalPaidFromTutees = tutees.reduce(
    (sum, t) => sum + (typeof t.totalPaid === 'number' ? t.totalPaid : 0),
    0
  );
  const totalPaidFromRecords = records.reduce(
    (sum, r) => sum + (typeof r.totalPaid === 'number' ? r.totalPaid : 0),
    0
  );
  const totalPaid = totalPaidFromPayments > 0
    ? totalPaidFromPayments
    : Math.max(totalPaidFromTutees, totalPaidFromRecords);

  // 2. Total due: compute from tutees rate & sessions, or monthly records
  const totalDueFromRecords = records.reduce((sum, r) => {
    if (typeof r.totalDue === 'number' && r.totalDue > 0) return sum + r.totalDue;
    const daysDue = (r.dayPayments || []).reduce((dSum, d) => dSum + (d.amountDue || 0), 0);
    return sum + daysDue;
  }, 0);

  const totalDueFromTutees = tutees.reduce((sum, t) => {
    const rate = typeof t.ratePerSession === 'number' ? t.ratePerSession : 0;
    const sessions = typeof t.totalSessions === 'number' ? t.totalSessions : 0;
    const paid = typeof t.totalPaid === 'number' ? t.totalPaid : 0;
    const balance = typeof t.balance === 'number' ? t.balance : 0;
    // If rate and sessions are set:
    if (rate > 0 && sessions > 0) {
      return sum + (rate * sessions);
    }
    // Alternatively from paid + balance:
    if (paid > 0 || balance > 0) {
      return sum + (paid + balance);
    }
    return sum;
  }, 0);

  const totalDue = totalDueFromRecords > 0
    ? totalDueFromRecords
    : (totalDueFromTutees > 0 ? totalDueFromTutees : totalPaid);

  // 3. Outstanding balance:
  const totalBalanceFromTutees = tutees.reduce(
    (sum, t) => sum + (typeof t.balance === 'number' ? t.balance : 0),
    0
  );
  const totalBalance = totalBalanceFromTutees > 0
    ? totalBalanceFromTutees
    : Math.max(totalDue - totalPaid, 0);

  const payments: PaymentSummary = {
    totalDue,
    totalPaid,
    totalBalance,
    collectionRate: totalDue > 0 ? (totalPaid / totalDue) * 100 : (totalPaid > 0 ? 100 : 0),
  };

  const scores = assessments
    .map((assessment) => assessment.score)
    .filter((score): score is number => typeof score === 'number' && !Number.isNaN(score));

  const academic: AcademicSummary = {
    totalAssessments: assessments.length,
    averageScore:
      scores.length > 0
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : null,
    studentsAssessed: new Set(
      assessments.map((assessment) => assessment.tuteeId).filter(Boolean)
    ).size,
  };

  const parents = allParents.filter(
    (parent) => parent.createdByTutorId === tutorId
  );

  return {
    tutor,
    totalTutees: tutees.length,
    totalParents: parents.length,
    attendance,
    payments,
    academic,
    recentActivities,
    tutees: tutees
      .map((tutee) => ({
        id: tutee.id,
        name: `${tutee.firstName || ''} ${tutee.surname || ''}`.trim() || 'Unnamed Tutee',
        subject: tutee.subject || '',
        balance: typeof tutee.balance === 'number' ? tutee.balance : 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    parents,
  };
};

export const superAdminService = {
  getAllTutors,
  getAllParents,
  getPlatformStats,
  getTutorSummaries,
  getActivityLogs,
  getTutorMonitoringDetail,
};
