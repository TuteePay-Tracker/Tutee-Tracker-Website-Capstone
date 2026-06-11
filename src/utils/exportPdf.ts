import { ReportData } from '../types/report';
import { formatCurrency } from './formatCurrency';
import { formatDate } from './formatDate';

export const exportReportToCSV = (reportData: ReportData, filename: string = 'report.csv') => {
  // Monthly Earnings CSV
  const monthlyEarningsCSV = [
    'Month,Earnings,Months Covered',
    ...reportData.monthlyEarnings.map(item =>
      `${item.month},${item.earnings},${item.sessions}`
    )
  ].join('\n');

  // Payment Method Summary CSV
  const paymentMethodCSV = [
    'Payment Method,Amount,Count',
    ...reportData.paymentMethodSummary.map(item =>
      `${item.method},${item.amount},${item.count}`
    )
  ].join('\n');

  // Unpaid Balances CSV
  const unpaidBalancesCSV = [
    'Tutee Name,Balance,Last Payment Date',
    ...reportData.unpaidBalances.map(item =>
      `${item.tuteeName},${item.balance},${item.lastPaymentDate || 'N/A'}`
    )
  ].join('\n');

  const fullReport = `
TUTEEPAY TRACKER - MONTHLY REPORT
Generated: ${formatDate(new Date())}

SUMMARY
Total Earnings This Month: ${formatCurrency(reportData.totalEarningsThisMonth)}
Total Tutees: ${reportData.totalTutees}
Total Months: ${reportData.totalSessions}
Pending Balance: ${formatCurrency(reportData.totalPendingBalance)}

MONTHLY EARNINGS
${monthlyEarningsCSV}

PAYMENT METHOD SUMMARY
${paymentMethodCSV}

UNPAID BALANCES
${unpaidBalancesCSV}
`;

  downloadFile(fullReport, filename);
};

const downloadFile = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
