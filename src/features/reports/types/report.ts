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
}
