export interface MonthlyEarnings {
  month: string;
  earnings: number;
  sessions: number;
}

export interface WeeklyIncome {
  week: string;
  income: number;
}

export interface PaymentMethodSummary {
  method: string;
  amount: number;
  count: number;
}

export interface TuteeActivity {
  tuteeId: string;
  tuteeName: string;
  sessions: number;
  earnings: number;
}

export interface UnpaidBalance {
  tuteeId: string;
  tuteeName: string;
  balance: number;
  lastPaymentDate?: string;
}

// ── New Analytics Types ────────────────────────────────

/** Per-student attendance summary */
export interface AttendanceSummary {
  tuteeId: string;
  tuteeName: string;
  totalScheduledDays: number;
  totalPaidDays: number;     // days marked as paid (attended)
  totalUnpaidDays: number;   // days marked as unpaid (absent)
  attendanceRate: number;    // 0–100
  monthlyTrend: { month: string; rate: number }[];
}

/** Per-student academic performance report */
export interface StudentPerformanceReport {
  tuteeId: string;
  tuteeName: string;
  averageScore: number;
  latestScore: number | null;
  trend: number;             // slope: positive = improving
  improvement: number;       // max - min score
  topSubject: string | null;
  lowestSubject: string | null;
  totalAssessments: number;
  lastAssessmentDate: string | null;
  status: 'most-improved' | 'stable' | 'needs-improvement';
  subjectBreakdown: SubjectBreakdownItem[];
}

export interface SubjectBreakdownItem {
  subject: string;
  averageScore: number;
  count: number;
  trend: number;
}

/** Class-wide subject analytics */
export interface SubjectReport {
  subject: string;
  classAverage: number;
  totalAssessments: number;
  studentCount: number;
  bestStudent: string;
  worstStudent: string;
}

/** At-risk student detection */
export interface AtRiskStudent {
  tuteeId: string;
  tuteeName: string;
  riskFactors: string[];
  riskScore: number;         // 0–4 based on how many factors triggered
  attendanceRate: number;
  averageScore: number;
  unpaidBalance: number;
  daysSinceLastAssessment: number | null;
}

/** Per-student payment behavior */
export interface PaymentBehaviorReport {
  tuteeId: string;
  tuteeName: string;
  totalPayments: number;
  totalAmount: number;
  fullPayments: number;
  partialPayments: number;
  preferredMethod: string;
  onTimeRate: number;        // % of months paid in full
  averageMonthlyPayment: number;
}

/** Tutor workload summary */
export interface TutorWorkloadSummary {
  totalStudents: number;
  totalAssessments: number;
  totalMonthlyRecords: number;
  assessmentsThisMonth: number;
  activeStudentsThisWeek: number;
  subjectsManaged: number;
}

export interface ReportData {
  monthlyEarnings: MonthlyEarnings[];
  weeklyIncome: WeeklyIncome[];
  paymentMethodSummary: PaymentMethodSummary[];
  tuteeActivity: TuteeActivity[];
  unpaidBalances: UnpaidBalance[];
  totalEarningsThisMonth: number;
  totalSessions: number;
  totalTutees: number;
  totalPendingBalance: number;

  // New analytics
  attendanceSummaries: AttendanceSummary[];
  studentPerformance: StudentPerformanceReport[];
  subjectReports: SubjectReport[];
  atRiskStudents: AtRiskStudent[];
  paymentBehavior: PaymentBehaviorReport[];
  tutorWorkload: TutorWorkloadSummary;
  monthlyAcademicTrend: { month: string; average: number }[];
}
