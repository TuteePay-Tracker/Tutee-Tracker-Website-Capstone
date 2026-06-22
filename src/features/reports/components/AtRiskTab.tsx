import { AtRiskStudent } from '@/features/reports/types/report';
import { AlertTriangle, ShieldAlert, UserX } from 'lucide-react';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface AtRiskTabProps {
  atRiskStudents: AtRiskStudent[];
}

const RiskLevel = ({ score }: { score: number }) => {
  if (score >= 4)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700">
        🔴 Critical
      </span>
    );
  if (score >= 3)
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
        🟠 High
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">
      🟡 Moderate
    </span>
  );
};

const RiskTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-800 text-white p-3 rounded-xl shadow-xl text-xs font-sans">
        <p className="font-semibold text-slate-400 border-b border-slate-800 pb-1 mb-1">{data.name}</p>
        <div className="flex items-center justify-between gap-6 mt-1">
          <span className="text-slate-400">Flagged Count:</span>
          <span className="font-bold text-red-400">{payload[0].value} student(s)</span>
        </div>
      </div>
    );
  }
  return null;
};

export const AtRiskTab = ({ atRiskStudents }: AtRiskTabProps) => {
  const critical = atRiskStudents.filter((s) => s.riskScore >= 4).length;
  const high = atRiskStudents.filter((s) => s.riskScore === 3).length;
  const moderate = atRiskStudents.filter((s) => s.riskScore === 2).length;

  // Cohort Risk Factors Breakdown
  const lowAttendanceCount = atRiskStudents.filter((s) => s.attendanceRate < 70).length;
  const lowAcademicCount = atRiskStudents.filter((s) => s.averageScore > 0 && s.averageScore < 75).length;
  const unpaidBalanceCount = atRiskStudents.filter((s) => s.unpaidBalance > 0).length;
  const inactiveCount = atRiskStudents.filter((s) => s.daysSinceLastAssessment === null || s.daysSinceLastAssessment > 30).length;

  const chartData = [
    { name: 'Low Attendance', count: lowAttendanceCount, key: 'attendance', fill: '#ef4444' },
    { name: 'Low Grades', count: lowAcademicCount, key: 'academic', fill: '#ec4899' },
    { name: 'Pending Balance', count: unpaidBalanceCount, key: 'balance', fill: '#f59e0b' },
    { name: 'No Recent Test', count: inactiveCount, key: 'inactive', fill: '#3b82f6' },
  ].filter(item => item.count > 0);

  return (
    <div className="space-y-6">
      {/* Risk Analysis Dashboard */}
      {atRiskStudents.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stacked Risk Level Cards */}
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-red-650 to-red-800 bg-red-700 text-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-extrabold text-red-100 tracking-wider">Critical Risk</span>
                <ShieldAlert size={20} />
              </div>
              <p className="text-3xl font-black mt-2">{critical}</p>
              <p className="text-[10px] text-red-100/90 mt-1 font-medium">Students with 4+ risk indicators</p>
            </div>
            <div className="bg-gradient-to-br from-orange-500 to-orange-700 text-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-extrabold text-orange-100 tracking-wider">High Risk</span>
                <AlertTriangle size={20} />
              </div>
              <p className="text-3xl font-black mt-2">{high}</p>
              <p className="text-[10px] text-orange-100/90 mt-1 font-medium">Students with 3 risk indicators</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase font-extrabold text-yellow-100 tracking-wider">Moderate Risk</span>
                <UserX size={20} />
              </div>
              <p className="text-3xl font-black mt-2">{moderate}</p>
              <p className="text-[10px] text-yellow-100/90 mt-1 font-medium">Students with 2 risk indicators</p>
            </div>
          </div>

          {/* Risk Factors Chart */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900">Cohort Risk Factors Distribution</h3>
              <p className="text-xs text-gray-500 mb-4 font-medium">Frequency of indicators flagged across at-risk students</p>
            </div>
            <div className="flex-1 flex items-center min-h-[180px]">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={110} tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 550 }} />
                  <Tooltip content={<RiskTooltip />} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={16}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* At-Risk Students Detail Cards */}
      {atRiskStudents.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-50 rounded-full flex items-center justify-center">
            <ShieldAlert size={32} className="text-green-500" />
          </div>
          <h3 className="text-lg font-semibold text-green-700 mb-1">No At-Risk Students</h3>
          <p className="text-gray-500 text-sm">
            All students are performing well. Great job!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-base font-bold text-gray-900">Flagged Student Details</h3>
          {atRiskStudents.map((student) => (
            <div
              key={student.tuteeId}
              className={`bg-white rounded-xl border-l-4 p-5 shadow-sm ${
                student.riskScore >= 4
                  ? 'border-l-red-500 border border-red-100'
                  : student.riskScore >= 3
                  ? 'border-l-orange-500 border border-orange-100'
                  : 'border-l-yellow-500 border border-yellow-100'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h4 className="font-bold text-sm text-gray-900">{student.tuteeName}</h4>
                    <RiskLevel score={student.riskScore} />
                  </div>

                  {/* Risk Factors */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {student.riskFactors.map((factor, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-700 rounded-lg text-xs font-semibold border border-red-100/50"
                      >
                        <AlertTriangle size={12} className="text-red-500" />
                        {factor}
                      </span>
                    ))}
                  </div>

                  {/* Quick Stats */}
                  <div className="flex flex-wrap gap-4 pt-2 border-t border-gray-50 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-550 font-medium text-gray-500">Attendance:</span>
                      <span
                        className={`font-bold ${
                          student.attendanceRate < 70 ? 'text-red-650 font-black' : 'text-gray-900'
                        }`}
                      >
                        {student.attendanceRate}%
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-550 font-medium text-gray-500">Avg Score:</span>
                      <span
                        className={`font-bold ${
                          student.averageScore < 75 ? 'text-red-650 font-black' : 'text-gray-900'
                        }`}
                      >
                        {student.averageScore > 0 ? `${student.averageScore}%` : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-550 font-medium text-gray-500">Balance:</span>
                      <span
                        className={`font-bold ${
                          student.unpaidBalance > 0 ? 'text-orange-600' : 'text-gray-900'
                        }`}
                      >
                        {student.unpaidBalance > 0
                          ? formatCurrency(student.unpaidBalance)
                          : 'Cleared'}
                      </span>
                    </div>
                    {student.daysSinceLastAssessment !== null && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-550 font-medium text-gray-500">Last Assessment:</span>
                        <span
                          className={`font-bold ${
                            student.daysSinceLastAssessment > 30 ? 'text-red-650 font-black' : 'text-gray-900'
                          }`}
                        >
                          {student.daysSinceLastAssessment}d ago
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
