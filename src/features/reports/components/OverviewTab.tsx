import { ReportData } from '@/features/reports/types/report';
import { MonthlyChart } from '@/features/reports/components/MonthlyChart';
import { StudentStatusChart } from '@/features/reports/components/StudentStatusChart';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatDate } from '@/shared/utils/formatDate';
import {
  TrendingUp,
  Users,
  ShieldAlert,
  BookOpen,
  Calendar,
  ClipboardList,
} from 'lucide-react';

interface OverviewTabProps {
  data: ReportData;
}

export const OverviewTab = ({ data }: OverviewTabProps) => {
  const workload = data.tutorWorkload;

  // Compute Overall Attendance Rate
  const activeAttendance = data.attendanceSummaries.filter((s) => s.totalScheduledDays > 0);
  const overallAttendanceRate = activeAttendance.length > 0
    ? Math.round(activeAttendance.reduce((sum, s) => sum + s.attendanceRate, 0) / activeAttendance.length)
    : 0;

  // Compute Class Average Score
  const studentsWithAssessments = data.studentPerformance.filter((s) => s.totalAssessments > 0);
  const classAverageScore = studentsWithAssessments.length > 0
    ? Math.round(studentsWithAssessments.reduce((sum, s) => sum + s.averageScore, 0) / studentsWithAssessments.length)
    : 0;

  const atRiskCount = data.atRiskStudents.length;

  return (
    <div className="space-y-6">
      {/* Primary balanced stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Earnings Card */}
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 text-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <TrendingUp size={20} />
            </div>
            <h3 className="font-semibold text-emerald-100 text-sm">Monthly Earnings</h3>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(data.totalEarningsThisMonth)}</p>
          <p className="text-emerald-200 text-xs mt-1">Received this month</p>
        </div>

        {/* Attendance Card */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-800 text-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <Calendar size={20} />
            </div>
            <h3 className="font-semibold text-blue-100 text-sm">Overall Attendance</h3>
          </div>
          <p className="text-2xl font-bold">{overallAttendanceRate}%</p>
          <p className="text-blue-200 text-xs mt-1">Average present rate</p>
        </div>

        {/* Class Average Academic Score Card */}
        <div className="bg-gradient-to-br from-purple-600 to-violet-800 text-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <BookOpen size={20} />
            </div>
            <h3 className="font-semibold text-purple-100 text-sm">Class Academic Avg</h3>
          </div>
          <p className="text-2xl font-bold">{classAverageScore}%</p>
          <p className="text-purple-200 text-xs mt-1">Across all tutees</p>
        </div>

        {/* At Risk Card */}
        <div className={`bg-gradient-to-br text-white rounded-xl p-5 shadow-sm hover:shadow-md transition-all ${
          atRiskCount > 0 ? 'from-red-600 to-red-800' : 'from-gray-700 to-gray-800'
        }`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <ShieldAlert size={20} />
            </div>
            <h3 className="font-semibold text-red-100 text-sm">At-Risk Students</h3>
          </div>
          <p className="text-2xl font-bold">{atRiskCount} Student{atRiskCount !== 1 ? 's' : ''}</p>
          <p className="text-red-200 text-xs mt-1">Needs attention / intervention</p>
        </div>
      </div>

      {/* Tutor Workload Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 shadow-sm">
          <div className="p-2 bg-green-50 rounded-lg">
            <BookOpen size={18} className="text-green-700" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{workload.totalAssessments}</p>
            <p className="text-xs text-gray-500 font-medium">Total Assessments</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 shadow-sm">
          <div className="p-2 bg-blue-50 rounded-lg">
            <ClipboardList size={18} className="text-blue-700" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{workload.assessmentsThisMonth}</p>
            <p className="text-xs text-gray-500 font-medium">Assessments This Month</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 shadow-sm">
          <div className="p-2 bg-purple-50 rounded-lg">
            <Users size={18} className="text-purple-700" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{workload.activeStudentsThisWeek}</p>
            <p className="text-xs text-gray-500 font-medium">Active This Week</p>
          </div>
        </div>
      </div>

      {/* Charts Row - 1 financial, 1 academic */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MonthlyChart data={data.monthlyEarnings} />
        <StudentStatusChart data={data.studentPerformance} />
      </div>

      {/* Activity & Balances */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Active Tutees */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Most Active Tutees</h3>
            <p className="text-xs text-gray-500 mb-4">Students with highest session counts</p>
          </div>
          <div className="space-y-3">
            {data.tuteeActivity.slice(0, 5).map((activity, index) => (
              <div
                key={activity.tuteeId}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-800">{activity.tuteeName}</p>
                    <p className="text-xs text-gray-500">{activity.sessions} month{activity.sessions !== 1 ? 's' : ''} tracked</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-extrabold text-sm text-gray-900">{formatCurrency(activity.earnings)}</p>
                  <p className="text-xs text-gray-400 font-medium">total earned</p>
                </div>
              </div>
            ))}
            {data.tuteeActivity.length === 0 && (
              <p className="text-gray-400 text-center py-6 text-sm">No activity data</p>
            )}
          </div>
        </div>

        {/* Unpaid Balances */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div>
            <h3 className="text-base font-bold text-gray-900 mb-1">Pending Balances</h3>
            <p className="text-xs text-gray-500 mb-4 font-medium">Outstanding accounts requiring follow-up</p>
          </div>
          {data.unpaidBalances.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-green-600 font-bold">All balances cleared! 🎉</p>
              <p className="text-gray-500 text-sm mt-1">No outstanding payments</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.unpaidBalances.map((balance) => (
                <div
                  key={balance.tuteeId}
                  className="flex items-center justify-between p-3 bg-orange-50 rounded-xl border border-orange-100 hover:shadow-sm transition-all"
                >
                  <div>
                    <p className="font-semibold text-sm text-gray-850">{balance.tuteeName}</p>
                    {balance.lastPaymentDate && (
                      <p className="text-xs text-gray-500">
                        Last payment: {formatDate(balance.lastPaymentDate)}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-orange-600 text-sm">
                      {formatCurrency(balance.balance)}
                    </p>
                    <p className="text-xs text-gray-500 font-medium">due</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Weekly Income Breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div>
          <h3 className="text-base font-bold text-gray-900 mb-1">Weekly Income Breakdown</h3>
          <p className="text-xs text-gray-500 mb-4 font-medium">Recent weekly revenue volume analysis</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Week</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Income Volume</th>
              </tr>
            </thead>
            <tbody>
              {data.weeklyIncome.map((week) => (
                <tr key={week.week} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 text-sm font-medium text-gray-700">{week.week}</td>
                  <td className="py-3 px-4 text-right font-extrabold text-sm text-gray-900">
                    {formatCurrency(week.income)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
