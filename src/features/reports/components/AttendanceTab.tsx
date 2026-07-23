import { AttendanceSummary } from '@/features/reports/types/report';
import { Calendar, CheckCircle, XCircle, BarChart3 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell,
} from 'recharts';

const RateTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-800 text-white p-3 rounded-xl shadow-xl text-xs font-sans">
        <p className="font-semibold text-slate-400 border-b border-slate-800 pb-1 mb-1">{data.name}</p>
        <div className="flex items-center justify-between gap-6 mt-1">
          <span className="text-slate-400">Attendance Rate:</span>
          <span className="font-bold text-emerald-400">{payload[0].value}%</span>
        </div>
      </div>
    );
  }
  return null;
};

const TrendTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-800 text-white p-3 rounded-xl shadow-xl text-xs font-sans">
        <p className="font-semibold text-slate-400 border-b border-slate-800 pb-1 mb-1">{data.month}</p>
        <div className="flex items-center justify-between gap-6 mt-1">
          <span className="text-slate-400">Average Rate:</span>
          <span className="font-bold text-blue-400">{payload[0].value}%</span>
        </div>
      </div>
    );
  }
  return null;
};


interface AttendanceTabProps {
  attendanceSummaries: AttendanceSummary[];
}

export const AttendanceTab = ({ attendanceSummaries }: AttendanceTabProps) => {
  const studentsWithData = attendanceSummaries.filter((s) => s.totalScheduledDays > 0);

  // Sort by attendance rate ascending to highlight who needs attention
  const sortedByRate = [...studentsWithData].sort((a, b) => a.attendanceRate - b.attendanceRate);

  // Overall averages
  const avgRate =
    studentsWithData.length > 0
      ? Math.round(
          studentsWithData.reduce((sum, s) => sum + s.attendanceRate, 0) / studentsWithData.length
        )
      : 0;
  const totalScheduled = studentsWithData.reduce((sum, s) => sum + s.totalScheduledDays, 0);
  const totalAttended = studentsWithData.reduce((sum, s) => sum + s.totalPaidDays, 0);
  const totalAbsent = totalScheduled - totalAttended;

  // Chart data: all students' rates
  const rateChartData = [...studentsWithData]
    .sort((a, b) => b.attendanceRate - a.attendanceRate)
    .slice(0, 10)
    .map((s) => ({
      name: s.tuteeName.split(' ')[0],
      rate: s.attendanceRate,
    }));

  // Aggregate monthly trend across all students
  const monthlyMap = new Map<string, { totalRate: number; count: number }>();
  studentsWithData.forEach((s) => {
    s.monthlyTrend.forEach((m) => {
      const existing = monthlyMap.get(m.month) || { totalRate: 0, count: 0 };
      monthlyMap.set(m.month, {
        totalRate: existing.totalRate + m.rate,
        count: existing.count + 1,
      });
    });
  });
  const aggregatedTrend = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      rate: Math.round(data.totalRate / data.count),
    }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Average Attendance Rate Card */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300" />
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center relative shrink-0">
            <BarChart3 size={22} />
          </div>
          <div className="relative">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Average Attendance Rate</p>
            <p className="text-[1.625rem] font-bold text-gray-900 mt-0.5">{avgRate}%</p>
          </div>
        </div>

        {/* Total Scheduled Days Card */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300" />
          <div className="w-12 h-12 rounded-xl bg-green-50 text-green-700 flex items-center justify-center relative shrink-0">
            <Calendar size={22} />
          </div>
          <div className="relative">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total Scheduled Days</p>
            <p className="text-[1.625rem] font-bold text-gray-900 mt-0.5">{totalScheduled}</p>
          </div>
        </div>

        {/* Days Attended Card */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300" />
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center relative shrink-0">
            <CheckCircle size={22} />
          </div>
          <div className="relative">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Days Attended</p>
            <p className="text-[1.625rem] font-bold text-gray-900 mt-0.5">{totalAttended}</p>
          </div>
        </div>

        {/* Days Absent Card */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300" />
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-700 flex items-center justify-center relative shrink-0">
            <XCircle size={22} />
          </div>
          <div className="relative">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Days Absent</p>
            <p className="text-[1.625rem] font-bold text-gray-900 mt-0.5">{totalAbsent}</p>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Rate by Student */}
        {rateChartData.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 mb-4">Attendance Rate by Student</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={rateChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip content={<RateTooltip />} />
                <Bar dataKey="rate" radius={[6, 6, 0, 0]} barSize={28}>
                  {rateChartData.map((entry, index) => (
                    <Cell
                      key={`bar-cell-${index}`}
                      fill={entry.rate < 70 ? '#ef4444' : entry.rate < 85 ? '#f59e0b' : '#10b981'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Monthly Attendance Trend */}
        {aggregatedTrend.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 mb-4">Monthly Attendance Trend</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={aggregatedTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="attendanceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip content={<TrendTooltip />} />
                <Area
                  type="monotone"
                  dataKey="rate"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fill="url(#attendanceGrad)"
                  name="Attendance Rate"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Detailed Student Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Per-Student Attendance Breakdown</h3>
        {studentsWithData.length === 0 ? (
          <div className="text-center py-12">
            <Calendar size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No attendance data available</p>
            <p className="text-gray-400 text-sm mt-1">Billing records will populate attendance analytics</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Student</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Scheduled</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Attended</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Absent</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Rate</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedByRate.map((student) => (
                  <tr key={student.tuteeId} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-medium text-sm">{student.tuteeName}</td>
                    <td className="py-3 px-4 text-center text-sm">{student.totalScheduledDays}</td>
                    <td className="py-3 px-4 text-center text-sm text-green-600 font-medium">
                      {student.totalPaidDays}
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-red-600 font-medium">
                      {student.totalUnpaidDays}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              student.attendanceRate >= 85
                                ? 'bg-green-500'
                                : student.attendanceRate >= 70
                                ? 'bg-yellow-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${student.attendanceRate}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium">{student.attendanceRate}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          student.attendanceRate >= 85
                            ? 'bg-green-100 text-green-700'
                            : student.attendanceRate >= 70
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {student.attendanceRate >= 85 ? 'Good' : student.attendanceRate >= 70 ? 'Fair' : 'Low'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
