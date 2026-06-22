import { ReportData } from '@/features/reports/types/report';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatDate } from '@/shared/utils/formatDate';

export const exportAcademicReport = (reportData: ReportData, filename: string = 'academic_report.csv') => {
  // Student Performance CSV
  const performanceCSV = [
    'Student Name,Average Score (%),Latest Score (%),Status,Total Assessments,Last Assessment Date',
    ...reportData.studentPerformance.map(item =>
      `"${item.tuteeName}",${item.averageScore}%,${item.latestScore !== null ? `${item.latestScore}%` : 'N/A'},"${item.status}",${item.totalAssessments},${item.lastAssessmentDate || 'N/A'}`
    )
  ].join('\n');

  // Subject Performance Summary CSV
  const subjectCSV = [
    'Subject,Class Average (%),Student Count,Best Performer,Lowest Performer',
    ...reportData.subjectReports.map(item =>
      `"${item.subject}",${item.classAverage}%,${item.studentCount},"${item.bestStudent}","${item.worstStudent}"`
    )
  ].join('\n');

  const content = `
TUTEEPAY TRACKER - ACADEMIC PERFORMANCE REPORT
Generated: ${formatDate(new Date())}

STUDENT PERFORMANCE SUMMARIES
${performanceCSV}

SUBJECT ANALYTICS
${subjectCSV}
`;

  downloadFile(content, filename);
};

export const exportAttendanceReport = (reportData: ReportData, filename: string = 'attendance_report.csv') => {
  const attendanceCSV = [
    'Student Name,Total Scheduled Sessions,Present (Paid) Sessions,Absent (Unpaid) Sessions,Attendance Rate (%)',
    ...reportData.attendanceSummaries.map(item =>
      `"${item.tuteeName}",${item.totalScheduledDays},${item.totalPaidDays},${item.totalUnpaidDays},${item.attendanceRate}%`
    )
  ].join('\n');

  const content = `
TUTEEPAY TRACKER - ATTENDANCE REPORT
Generated: ${formatDate(new Date())}

ATTENDANCE SUMMARIES
${attendanceCSV}
`;

  downloadFile(content, filename);
};

export const exportPaymentsReport = (reportData: ReportData, filename: string = 'payments_report.csv') => {
  const monthlyEarningsCSV = [
    'Month,Earnings,Months Covered',
    ...reportData.monthlyEarnings.map(item =>
      `"${item.month}",${item.earnings},${item.sessions}`
    )
  ].join('\n');

  const paymentMethodCSV = [
    'Payment Method,Amount,Count',
    ...reportData.paymentMethodSummary.map(item =>
      `"${item.method}",${item.amount},${item.count}`
    )
  ].join('\n');

  const unpaidBalancesCSV = [
    'Tutee Name,Balance,Last Payment Date',
    ...reportData.unpaidBalances.map(item =>
      `"${item.tuteeName}",${item.balance},${item.lastPaymentDate || 'N/A'}`
    )
  ].join('\n');

  const behaviorCSV = [
    'Student Name,Total Payments,Total Amount,Full Payments,Partial Payments,Preferred Method,On-Time Rate (%)',
    ...reportData.paymentBehavior.map(item =>
      `"${item.tuteeName}",${item.totalPayments},${item.totalAmount},${item.fullPayments},${item.partialPayments},"${item.preferredMethod}",${item.onTimeRate}%`
    )
  ].join('\n');

  const content = `
TUTEEPAY TRACKER - PAYMENTS & EARNINGS REPORT
Generated: ${formatDate(new Date())}

SUMMARY
Total Earnings This Month: ${formatCurrency(reportData.totalEarningsThisMonth)}
Total Tutees: ${reportData.totalTutees}
Total Sessions: ${reportData.totalSessions}
Pending Balance: ${formatCurrency(reportData.totalPendingBalance)}

MONTHLY EARNINGS
${monthlyEarningsCSV}

PAYMENT METHOD SUMMARY
${paymentMethodCSV}

UNPAID BALANCES
${unpaidBalancesCSV}

PAYMENT BEHAVIOR (PER STUDENT)
${behaviorCSV}
`;

  downloadFile(content, filename);
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
