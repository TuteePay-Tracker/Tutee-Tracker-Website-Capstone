import { ReportData, MonthlyEarnings, WeeklyIncome, PaymentMethodSummary, TuteeActivity } from '../types/report';
import { tuteeService } from './tuteeService';
import { paymentService } from './paymentService';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths, isWithinInterval } from 'date-fns';

class ReportService {
  async generateReport(): Promise<ReportData> {
    const tutees = await tuteeService.getAll();
    const payments = await paymentService.getAll();

    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);

    // Calculate monthly earnings for the last 6 months
    const monthlyEarnings: MonthlyEarnings[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);

      const monthPayments = payments.filter(p => {
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

    // Calculate weekly income for the last 4 weeks
    const weeklyIncome: WeeklyIncome[] = [];
    for (let i = 3; i >= 0; i--) {
      const weekDate = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const weekStart = startOfWeek(weekDate);
      const weekEnd = endOfWeek(weekDate);

      const weekPayments = payments.filter(p => {
        const paymentDate = new Date(p.paymentDate);
        return isWithinInterval(paymentDate, { start: weekStart, end: weekEnd });
      });

      const income = weekPayments.reduce((sum, p) => sum + p.amount, 0);

      weeklyIncome.push({
        week: `Week ${4 - i}`,
        income,
      });
    }

    // Payment method summary
    const paymentMethodMap = new Map<string, { amount: number; count: number }>();
    payments.forEach(p => {
      const current = paymentMethodMap.get(p.paymentMethod) || { amount: 0, count: 0 };
      paymentMethodMap.set(p.paymentMethod, {
        amount: current.amount + p.amount,
        count: current.count + 1,
      });
    });

    const paymentMethodSummary: PaymentMethodSummary[] = Array.from(paymentMethodMap.entries()).map(
      ([method, data]) => ({
        method,
        amount: data.amount,
        count: data.count,
      })
    );

    // Tutee activity
    const tuteeActivity: TuteeActivity[] = tutees
      .map(tutee => {
        const tuteePayments = payments.filter(p => p.tuteeId === tutee.id);
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
      .filter(t => t.balance > 0)
      .map(t => ({
        tuteeId: t.id,
        tuteeName: `${t.firstName} ${t.surname}`,
        balance: t.balance,
        lastPaymentDate: t.lastPaymentDate,
      }))
      .sort((a, b) => b.balance - a.balance);

    // Summary stats
    const currentMonthPayments = payments.filter(p => {
      const paymentDate = new Date(p.paymentDate);
      return isWithinInterval(paymentDate, { start: currentMonthStart, end: currentMonthEnd });
    });

    const totalEarningsThisMonth = currentMonthPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalSessions = tutees.reduce((sum, t) => sum + t.totalSessions, 0);
    const totalTutees = tutees.length;
    const totalPendingBalance = tutees.reduce((sum, t) => sum + t.balance, 0);

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
    };
  }
}

export const reportService = new ReportService();