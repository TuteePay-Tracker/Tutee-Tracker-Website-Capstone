import {
  ReportData,
  MonthlyEarnings,
  WeeklyIncome,
  PaymentMethodSummary,
  TuteeActivity,
  AttendanceSummary,
  StudentPerformanceReport,
  SubjectBreakdownItem,
  SubjectReport,
  AtRiskStudent,
  PaymentBehaviorReport,
  TutorWorkloadSummary,
} from '@/features/reports/types/report';
import { tuteeService } from '@/features/tutees/services/tuteeService';
import { paymentService } from '@/features/payments/services/paymentService';
import { Assessment } from '@/features/tutee-progress/types/assessment';
import { PaymentRecord } from '@/features/attendance/types/dayPayment';
import { Tutee } from '@/features/tutees/types/tutee';
import { Payment } from '@/features/payments/types/payment';
import {
  collection,
  getDocs,
  query,
  orderBy,
} from 'firebase/firestore';
import { db, auth } from '@/shared/lib/firebase/config';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  subMonths,
  isWithinInterval,
  differenceInDays,
} from 'date-fns';

// ── Helpers ────────────────────────────────────────────

/** Simple linear-regression slope over an array of numbers. */
function linearSlope(values: number[]): number {
  if (values.length < 2) return 0;
  const n = values.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

// ── Service ────────────────────────────────────────────

class ReportService {
  private getUserId(): string {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User not authenticated');
    return uid;
  }

  /** Fetch all assessments for the current tutor */
  private async fetchAssessments(tutorId: string): Promise<Assessment[]> {
    const colRef = collection(db, 'users', tutorId, 'assessments');
    const q = query(colRef, orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        tuteeId: data.tuteeId || '',
        tuteeName: data.tuteeName || '',
        subject: data.subject || '',
        date: data.date || '',
        assessmentScores: data.assessmentScores || [],
        topicsCovered: data.topicsCovered || '',
        notes: data.notes || '',
        recommendations: data.recommendations || '',
        score: typeof data.score === 'number' ? data.score : 0,
        remarks: data.remarks || 'Good',
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      } as Assessment;
    });
  }

  /** Fetch all payment records (monthly billing) for the current tutor */
  private async fetchPaymentRecords(tutorId: string): Promise<PaymentRecord[]> {
    const colRef = collection(db, 'users', tutorId, 'paymentRecords');
    const snap = await getDocs(colRef);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ...data,
        lastUpdated: data.lastUpdated?.toDate?.()?.toISOString() || new Date().toISOString(),
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      } as PaymentRecord;
    });
  }

  // ── Attendance Analytics ─────────────────────────────

  private computeAttendanceSummaries(
    tutees: Tutee[],
    records: PaymentRecord[]
  ): AttendanceSummary[] {
    const recordsByTutee = new Map<string, PaymentRecord[]>();
    records.forEach((r) => {
      const arr = recordsByTutee.get(r.tuteeId) || [];
      arr.push(r);
      recordsByTutee.set(r.tuteeId, arr);
    });

    return tutees.map((tutee) => {
      const tuteeRecords = recordsByTutee.get(tutee.id) || [];
      let totalScheduled = 0;
      let totalPaid = 0;

      const monthlyMap = new Map<string, { scheduled: number; paid: number }>();

      tuteeRecords.forEach((record) => {
        const days = record.dayPayments || [];
        const scheduled = days.length;
        const paid = days.filter((d) => d.status === 'paid').length;
        totalScheduled += scheduled;
        totalPaid += paid;

        const month = record.month; // YYYY-MM
        const existing = monthlyMap.get(month) || { scheduled: 0, paid: 0 };
        monthlyMap.set(month, {
          scheduled: existing.scheduled + scheduled,
          paid: existing.paid + paid,
        });
      });

      const monthlyTrend = Array.from(monthlyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([month, data]) => ({
          month,
          rate: data.scheduled > 0 ? Math.round((data.paid / data.scheduled) * 100) : 0,
        }));

      return {
        tuteeId: tutee.id,
        tuteeName: `${tutee.firstName} ${tutee.surname}`,
        totalScheduledDays: totalScheduled,
        totalPaidDays: totalPaid,
        totalUnpaidDays: totalScheduled - totalPaid,
        attendanceRate: totalScheduled > 0 ? Math.round((totalPaid / totalScheduled) * 100) : 0,
        monthlyTrend,
      };
    });
  }

  // ── Academic Performance ─────────────────────────────

  private computeStudentPerformance(
    tutees: Tutee[],
    assessments: Assessment[]
  ): StudentPerformanceReport[] {
    const assessmentsByTutee = new Map<string, Assessment[]>();
    assessments.forEach((a) => {
      const arr = assessmentsByTutee.get(a.tuteeId) || [];
      arr.push(a);
      assessmentsByTutee.set(a.tuteeId, arr);
    });

    return tutees
      .map((tutee) => {
        const tuteeAssessments = (assessmentsByTutee.get(tutee.id) || [])
          .sort((a, b) => a.date.localeCompare(b.date));

        if (tuteeAssessments.length === 0) {
          return {
            tuteeId: tutee.id,
            tuteeName: `${tutee.firstName} ${tutee.surname}`,
            averageScore: 0,
            latestScore: null,
            trend: 0,
            improvement: 0,
            topSubject: null,
            lowestSubject: null,
            totalAssessments: 0,
            lastAssessmentDate: null,
            status: 'stable' as const,
            subjectBreakdown: [],
          };
        }

        const scores = tuteeAssessments.map((a) => a.score);
        const averageScore = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
        const latestScore = scores[scores.length - 1];
        const trend = linearSlope(scores);
        const improvement = Math.max(...scores) - Math.min(...scores);

        // Subject breakdown
        const subjectMap = new Map<string, { scores: number[] }>();
        tuteeAssessments.forEach((a) => {
          const entry = subjectMap.get(a.subject) || { scores: [] };
          entry.scores.push(a.score);
          subjectMap.set(a.subject, entry);
        });

        const subjectBreakdown: SubjectBreakdownItem[] = Array.from(subjectMap.entries()).map(
          ([subject, data]) => ({
            subject,
            averageScore: Math.round(data.scores.reduce((s, v) => s + v, 0) / data.scores.length),
            count: data.scores.length,
            trend: linearSlope(data.scores),
          })
        );

        const sortedSubjects = [...subjectBreakdown].sort((a, b) => b.averageScore - a.averageScore);
        const topSubject = sortedSubjects.length > 0 ? sortedSubjects[0].subject : null;
        const lowestSubject = sortedSubjects.length > 1
          ? sortedSubjects[sortedSubjects.length - 1].subject
          : null;

        // Status classification
        let status: 'most-improved' | 'stable' | 'needs-improvement' = 'stable';
        if (trend > 2 && improvement > 10) {
          status = 'most-improved';
        } else if (trend < -2 || averageScore < 75) {
          status = 'needs-improvement';
        }

        const lastAssessmentDate = tuteeAssessments[tuteeAssessments.length - 1].date;

        return {
          tuteeId: tutee.id,
          tuteeName: `${tutee.firstName} ${tutee.surname}`,
          averageScore,
          latestScore,
          trend,
          improvement,
          topSubject,
          lowestSubject,
          totalAssessments: tuteeAssessments.length,
          lastAssessmentDate,
          status,
          subjectBreakdown,
        };
      })
      .sort((a, b) => b.averageScore - a.averageScore);
  }

  // ── Subject Reports (Class-wide) ────────────────────

  private computeSubjectReports(assessments: Assessment[]): SubjectReport[] {
    const subjectMap = new Map<string, { scores: number[]; students: Map<string, number[]> }>();

    assessments.forEach((a) => {
      const entry = subjectMap.get(a.subject) || {
        scores: [] as number[],
        students: new Map<string, number[]>(),
      };
      entry.scores.push(a.score);

      const studentScores = entry.students.get(a.tuteeName) || ([] as number[]);
      studentScores.push(a.score);
      entry.students.set(a.tuteeName, studentScores);

      subjectMap.set(a.subject, entry);
    });

    return Array.from(subjectMap.entries())
      .map(([subject, data]) => {
        const classAverage = Math.round(
          data.scores.reduce((s, v) => s + v, 0) / data.scores.length
        );

        // Find best and worst performing students in this subject
        let bestStudent = '';
        let worstStudent = '';
        let bestAvg = -1;
        let worstAvg = 101;

        data.students.forEach((scores, name) => {
          const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
          if (avg > bestAvg) {
            bestAvg = avg;
            bestStudent = name;
          }
          if (avg < worstAvg) {
            worstAvg = avg;
            worstStudent = name;
          }
        });

        return {
          subject,
          classAverage,
          totalAssessments: data.scores.length,
          studentCount: data.students.size,
          bestStudent,
          worstStudent,
        };
      })
      .sort((a, b) => b.classAverage - a.classAverage);
  }

  // ── At-Risk Detection ───────────────────────────────

  private computeAtRiskStudents(
    tutees: Tutee[],
    attendanceSummaries: AttendanceSummary[],
    studentPerformance: StudentPerformanceReport[]
  ): AtRiskStudent[] {
    const now = new Date();
    const attendanceMap = new Map(attendanceSummaries.map((a) => [a.tuteeId, a]));
    const perfMap = new Map(studentPerformance.map((p) => [p.tuteeId, p]));

    return tutees
      .map((tutee) => {
        const attendance = attendanceMap.get(tutee.id);
        const perf = perfMap.get(tutee.id);
        const riskFactors: string[] = [];

        const attendanceRate = attendance?.attendanceRate ?? 100;
        const averageScore = perf?.averageScore ?? 0;
        const unpaidBalance = Math.max(tutee.balance || 0, 0);

        // Factor 1: Low attendance
        if (attendanceRate < 70) {
          riskFactors.push('Low attendance rate (<70%)');
        }

        // Factor 2: Low academic performance
        if (perf && perf.totalAssessments > 0 && averageScore < 75) {
          riskFactors.push('Average score below 75');
        }

        // Factor 3: Unpaid balance
        if (unpaidBalance > 0) {
          riskFactors.push(`Outstanding balance: ₱${unpaidBalance.toLocaleString()}`);
        }

        // Factor 4: No recent assessment (30+ days)
        let daysSinceLastAssessment: number | null = null;
        if (perf?.lastAssessmentDate) {
          daysSinceLastAssessment = differenceInDays(now, new Date(perf.lastAssessmentDate));
          if (daysSinceLastAssessment > 30) {
            riskFactors.push(`No assessment in ${daysSinceLastAssessment} days`);
          }
        } else if (perf && perf.totalAssessments === 0) {
          riskFactors.push('No assessments recorded');
          daysSinceLastAssessment = null;
        }

        return {
          tuteeId: tutee.id,
          tuteeName: `${tutee.firstName} ${tutee.surname}`,
          riskFactors,
          riskScore: riskFactors.length,
          attendanceRate,
          averageScore,
          unpaidBalance,
          daysSinceLastAssessment,
        };
      })
      .filter((s) => s.riskScore >= 2)
      .sort((a, b) => b.riskScore - a.riskScore);
  }

  // ── Payment Behavior ────────────────────────────────

  private computePaymentBehavior(
    tutees: Tutee[],
    payments: Payment[],
    records: PaymentRecord[]
  ): PaymentBehaviorReport[] {
    const paymentsByTutee = new Map<string, Payment[]>();
    payments.forEach((p) => {
      const arr = paymentsByTutee.get(p.tuteeId) || [];
      arr.push(p);
      paymentsByTutee.set(p.tuteeId, arr);
    });

    const recordsByTutee = new Map<string, PaymentRecord[]>();
    records.forEach((r) => {
      const arr = recordsByTutee.get(r.tuteeId) || [];
      arr.push(r);
      recordsByTutee.set(r.tuteeId, arr);
    });

    return tutees.map((tutee) => {
      const tuteePayments = paymentsByTutee.get(tutee.id) || [];
      const tuteeRecords = recordsByTutee.get(tutee.id) || [];

      const totalPayments = tuteePayments.length;
      const totalAmount = tuteePayments.reduce((sum, p) => sum + p.amount, 0);

      const fullPayments = tuteePayments.filter((p) => p.coverageType === 'full').length;
      const partialPayments = tuteePayments.filter((p) => p.coverageType === 'partial').length;

      // Preferred method
      const methodCount = new Map<string, number>();
      tuteePayments.forEach((p) => {
        methodCount.set(p.paymentMethod, (methodCount.get(p.paymentMethod) || 0) + 1);
      });
      let preferredMethod = 'N/A';
      let maxCount = 0;
      methodCount.forEach((count, method) => {
        if (count > maxCount) {
          maxCount = count;
          preferredMethod = method;
        }
      });

      // On-time rate: % of monthly records that are fully paid
      const totalMonths = tuteeRecords.length;
      const paidMonths = tuteeRecords.filter((r) => r.totalBalance <= 0).length;
      const onTimeRate = totalMonths > 0 ? Math.round((paidMonths / totalMonths) * 100) : 0;

      const averageMonthlyPayment = totalMonths > 0
        ? Math.round(totalAmount / totalMonths)
        : 0;

      return {
        tuteeId: tutee.id,
        tuteeName: `${tutee.firstName} ${tutee.surname}`,
        totalPayments,
        totalAmount,
        fullPayments,
        partialPayments,
        preferredMethod,
        onTimeRate,
        averageMonthlyPayment,
      };
    }).sort((a, b) => b.onTimeRate - a.onTimeRate);
  }

  // ── Tutor Workload ──────────────────────────────────

  private computeTutorWorkload(
    tutees: Tutee[],
    assessments: Assessment[],
    records: PaymentRecord[]
  ): TutorWorkloadSummary {
    const now = new Date();
    const currentMonth = format(now, 'yyyy-MM');
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);

    const assessmentsThisMonth = assessments.filter(
      (a) => a.date.startsWith(currentMonth)
    ).length;

    // Active students this week: those with a day payment in the current week
    const activeThisWeek = new Set<string>();
    records.forEach((r) => {
      (r.dayPayments || []).forEach((day) => {
        const dayDate = new Date(day.date);
        if (isWithinInterval(dayDate, { start: weekStart, end: weekEnd }) && day.status === 'paid') {
          activeThisWeek.add(r.tuteeId);
        }
      });
    });

    const subjects = new Set<string>();
    assessments.forEach((a) => subjects.add(a.subject));

    return {
      totalStudents: tutees.length,
      totalAssessments: assessments.length,
      totalMonthlyRecords: records.length,
      assessmentsThisMonth,
      activeStudentsThisWeek: activeThisWeek.size,
      subjectsManaged: subjects.size,
    };
  }

  // ── Monthly Academic Trend ─────────────────────────

  private computeMonthlyAcademicTrend(
    assessments: Assessment[]
  ): { month: string; average: number }[] {
    const byMonth: Record<string, number[]> = {};
    assessments.forEach((a) => {
      if (!a.date) return;
      const m = a.date.slice(0, 7); // "YYYY-MM"
      if (!byMonth[m]) byMonth[m] = [];
      byMonth[m].push(a.score);
    });

    return Object.entries(byMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, scores]) => {
        const average = scores.length > 0
          ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
          : 0;
        const [year, mStr] = month.split('-');
        const dateObj = new Date(parseInt(year), parseInt(mStr) - 1, 1);
        return {
          month: format(dateObj, 'MMM yyyy'),
          average,
        };
      });
  }

  // ── Main Generator ──────────────────────────────────

  async generateReport(): Promise<ReportData> {
    const userId = this.getUserId();
    const [tutees, payments, assessments, records] = await Promise.all([
      tuteeService.getAll(),
      paymentService.getAll(),
      this.fetchAssessments(userId),
      this.fetchPaymentRecords(userId),
    ]);

    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);

    // ── Existing analytics (preserved) ────────────────

    // Monthly earnings for the last 6 months
    const monthlyEarnings: MonthlyEarnings[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const monthPayments = payments.filter((p) => {
        const paymentDate = new Date(p.paymentDate);
        return isWithinInterval(paymentDate, { start: monthStart, end: monthEnd });
      });

      const earnings = monthPayments.reduce((sum, p) => sum + p.amount, 0);
      const sessions = monthPayments.reduce((sum, p) => sum + p.sessionsCovered, 0);

      monthlyEarnings.push({
        month: format(monthDate, 'MMM yyyy'),
        earnings,
        sessions,
      });
    }

    // Weekly income for the last 4 weeks
    const weeklyIncome: WeeklyIncome[] = [];
    for (let i = 3; i >= 0; i--) {
      const weekDate = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const wStart = startOfWeek(weekDate);
      const wEnd = endOfWeek(weekDate);

      const weekPayments = payments.filter((p) => {
        const paymentDate = new Date(p.paymentDate);
        return isWithinInterval(paymentDate, { start: wStart, end: wEnd });
      });

      const income = weekPayments.reduce((sum, p) => sum + p.amount, 0);
      weeklyIncome.push({ week: `Week ${4 - i}`, income });
    }

    // Payment method summary
    const paymentMethodMap = new Map<string, { amount: number; count: number }>();
    payments.forEach((p) => {
      const current = paymentMethodMap.get(p.paymentMethod) || { amount: 0, count: 0 };
      paymentMethodMap.set(p.paymentMethod, {
        amount: current.amount + p.amount,
        count: current.count + 1,
      });
    });
    const paymentMethodSummary: PaymentMethodSummary[] = Array.from(
      paymentMethodMap.entries()
    ).map(([method, data]) => ({ method, amount: data.amount, count: data.count }));

    // Tutee activity
    const tuteeActivity: TuteeActivity[] = tutees
      .map((tutee) => {
        const tuteePayments = payments.filter((p) => p.tuteeId === tutee.id);
        const earnings = tuteePayments.reduce((sum, p) => sum + p.amount, 0);
        return {
          tuteeId: tutee.id,
          tuteeName: `${tutee.firstName} ${tutee.surname}`,
          sessions: tutee.totalSessions,
          earnings,
        };
      })
      .sort((a, b) => b.sessions - a.sessions);

    // Unpaid balances
    const unpaidBalances = tutees
      .map((tutee) => {
        const balance =
          Math.round(
            ((tutee.totalSessions || 0) * (tutee.ratePerSession || 0) - (tutee.totalPaid || 0)) * 100
          ) / 100;
        return {
          tuteeId: tutee.id,
          tuteeName: `${tutee.firstName} ${tutee.surname}`,
          balance,
          lastPaymentDate: tutee.lastPaymentDate,
        };
      })
      .filter((t) => t.balance > 0)
      .sort((a, b) => b.balance - a.balance);

    // Summary stats
    const currentMonthPayments = payments.filter((p) => {
      const paymentDate = new Date(p.paymentDate);
      return isWithinInterval(paymentDate, { start: currentMonthStart, end: currentMonthEnd });
    });
    const totalEarningsThisMonth = currentMonthPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalSessions = tutees.reduce((sum, t) => sum + t.totalSessions, 0);
    const totalTutees = tutees.length;
    const totalPendingBalance = tutees.reduce((sum, t) => {
      const balance =
        Math.round(
          ((t.totalSessions || 0) * (t.ratePerSession || 0) - (t.totalPaid || 0)) * 100
        ) / 100;
      return sum + Math.max(balance, 0);
    }, 0);

    // ── New analytics ─────────────────────────────────

    const attendanceSummaries = this.computeAttendanceSummaries(tutees, records);
    const studentPerformance = this.computeStudentPerformance(tutees, assessments);
    const subjectReports = this.computeSubjectReports(assessments);
    const atRiskStudents = this.computeAtRiskStudents(tutees, attendanceSummaries, studentPerformance);
    const paymentBehavior = this.computePaymentBehavior(tutees, payments, records);
    const tutorWorkload = this.computeTutorWorkload(tutees, assessments, records);
    const monthlyAcademicTrend = this.computeMonthlyAcademicTrend(assessments);

    return {
      monthlyEarnings,
      weeklyIncome,
      paymentMethodSummary,
      tuteeActivity,
      unpaidBalances,
      totalEarningsThisMonth,
      totalSessions,
      totalTutees,
      totalPendingBalance,
      attendanceSummaries,
      studentPerformance,
      subjectReports,
      atRiskStudents,
      paymentBehavior,
      tutorWorkload,
      monthlyAcademicTrend,
    };
  }
}

export const reportService = new ReportService();