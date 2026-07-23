import { StudentPerformanceReport, SubjectReport } from '@/features/reports/types/report';
import { TrendingUp, TrendingDown, Minus, Award, BookOpen, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';

interface AcademicTabProps {
  studentPerformance: StudentPerformanceReport[];
  subjectReports: SubjectReport[];
  monthlyAcademicTrend: { month: string; average: number }[];
}

const StatusBadge = ({ status }: { status: string }) => {
  const config = {
    'most-improved': { label: 'Most Improved', bg: 'bg-green-100', text: 'text-green-700', icon: '🟢' },
    stable: { label: 'Stable', bg: 'bg-yellow-100', text: 'text-yellow-700', icon: '🟡' },
    'needs-improvement': { label: 'Needs Improvement', bg: 'bg-red-100', text: 'text-red-700', icon: '🔴' },
  }[status] || { label: status, bg: 'bg-gray-100', text: 'text-gray-700', icon: '⚪' };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.icon} {config.label}
    </span>
  );
};

const TrendIcon = ({ trend }: { trend: number }) => {
  if (trend > 1) return <TrendingUp size={16} className="text-green-600" />;
  if (trend < -1) return <TrendingDown size={16} className="text-red-600" />;
  return <Minus size={16} className="text-gray-400" />;
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-800 text-white p-3 rounded-xl shadow-xl text-xs font-sans">
        <p className="font-semibold text-slate-400 border-b border-slate-800 pb-1 mb-1">{payload[0].payload.subject}</p>
        <div className="flex items-center justify-between gap-6 mt-1">
          <span className="text-slate-400">Class Average:</span>
          <span className="font-bold text-emerald-400">{data.average}%</span>
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
          <span className="text-slate-400">Class Average:</span>
          <span className="font-bold text-indigo-400">{payload[0].value}%</span>
        </div>
      </div>
    );
  }
  return null;
};

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

export const AcademicTab = ({ studentPerformance, subjectReports, monthlyAcademicTrend }: AcademicTabProps) => {
  const studentsWithData = studentPerformance.filter((s) => s.totalAssessments > 0);

  // Summary counts
  const improved = studentsWithData.filter((s) => s.status === 'most-improved').length;
  const stable = studentsWithData.filter((s) => s.status === 'stable').length;
  const needsWork = studentsWithData.filter((s) => s.status === 'needs-improvement').length;

  // Chart data for subject averages
  const subjectChartData = subjectReports.map((s) => ({
    subject: s.subject.length > 12 ? s.subject.substring(0, 12) + '…' : s.subject,
    average: s.classAverage,
  }));

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Most Improved Card */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300" />
          <div className="w-12 h-12 rounded-xl bg-green-50 text-green-700 flex items-center justify-center relative shrink-0">
            <Award size={22} />
          </div>
          <div className="relative">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Most Improved</p>
            <p className="text-[1.625rem] font-bold text-gray-900 mt-0.5">{improved}</p>
          </div>
        </div>

        {/* Stable / Average Card */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300" />
          <div className="w-12 h-12 rounded-xl bg-yellow-50 text-yellow-700 flex items-center justify-center relative shrink-0">
            <Target size={22} />
          </div>
          <div className="relative">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Stable / Average</p>
            <p className="text-[1.625rem] font-bold text-gray-900 mt-0.5">{stable}</p>
          </div>
        </div>

        {/* Needs Improvement Card */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300" />
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-700 flex items-center justify-center relative shrink-0">
            <BookOpen size={22} />
          </div>
          <div className="relative">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Needs Improvement</p>
            <p className="text-[1.625rem] font-bold text-gray-900 mt-0.5">{needsWork}</p>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overall Academic Progress Trend */}
        {monthlyAcademicTrend && monthlyAcademicTrend.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 mb-4">Overall Academic Progress Trend</h3>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={monthlyAcademicTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="academicTrendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }} />
                <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip content={<TrendTooltip />} />
                <Area
                  type="monotone"
                  dataKey="average"
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  fill="url(#academicTrendGrad)"
                  name="Class Average"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Subject Class Averages Chart */}
        {subjectChartData.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 mb-4">Subject Class Averages</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={subjectChartData} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis type="category" dataKey="subject" width={100} tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="average" radius={[0, 6, 6, 0]} barSize={20}>
                  {subjectChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Subject Breakdown Table */}
      {subjectReports.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Subject Performance Details</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Subject</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Class Average</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Assessments</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Students</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Best Student</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Needs Support</th>
                </tr>
              </thead>
              <tbody>
                {subjectReports.map((subject) => (
                  <tr key={subject.subject} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-medium text-sm">{subject.subject}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                          subject.classAverage >= 90
                            ? 'bg-green-100 text-green-700'
                            : subject.classAverage >= 75
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {subject.classAverage}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-gray-600">{subject.totalAssessments}</td>
                    <td className="py-3 px-4 text-center text-sm text-gray-600">{subject.studentCount}</td>
                    <td className="py-3 px-4 text-sm text-green-700">{subject.bestStudent}</td>
                    <td className="py-3 px-4 text-sm text-orange-600">
                      {subject.worstStudent !== subject.bestStudent ? subject.worstStudent : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Student Performance Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Student Performance Rankings</h3>
        {studentsWithData.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">No assessment data available yet</p>
            <p className="text-gray-400 text-sm mt-1">Add assessments to see performance insights</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Rank</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Student</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Avg Score</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Latest</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Trend</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Top Subject</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Weakest</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {studentsWithData.map((student, index) => (
                  <tr key={student.tuteeId} className="border-b hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="w-7 h-7 rounded-full bg-green-700 text-white flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium text-sm">{student.tuteeName}</p>
                      <p className="text-xs text-gray-500">{student.totalAssessments} assessments</p>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-bold text-sm">{student.averageScore}%</span>
                    </td>
                    <td className="py-3 px-4 text-center text-sm">
                      {student.latestScore !== null ? `${student.latestScore}%` : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <TrendIcon trend={student.trend} />
                        <span className="text-xs text-gray-500">
                          {student.trend > 0 ? '+' : ''}{student.trend.toFixed(1)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-green-700">{student.topSubject || '—'}</td>
                    <td className="py-3 px-4 text-sm text-orange-600">{student.lowestSubject || '—'}</td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={student.status} />
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
