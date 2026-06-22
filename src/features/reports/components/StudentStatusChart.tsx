import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { StudentPerformanceReport } from '@/features/reports/types/report';

interface StudentStatusChartProps {
  data: StudentPerformanceReport[];
}

const COLORS = {
  'most-improved': '#10b981',      // Green
  stable: '#f59e0b',               // Amber
  'needs-improvement': '#ef4444',  // Red
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-800 text-white p-3 rounded-xl shadow-xl text-xs font-sans">
        <p className="font-semibold text-slate-400 border-b border-slate-800 pb-1 mb-1">{data.name}</p>
        <div className="flex items-center justify-between gap-6 mt-1">
          <span className="text-slate-400">Students:</span>
          <span className="font-bold text-white">{data.value}</span>
        </div>
      </div>
    );
  }
  return null;
};

export const StudentStatusChart = ({ data }: StudentStatusChartProps) => {
  const studentsWithData = data.filter((s) => s.totalAssessments > 0);
  const totalStudents = studentsWithData.length;

  const improved = studentsWithData.filter((s) => s.status === 'most-improved').length;
  const stable = studentsWithData.filter((s) => s.status === 'stable').length;
  const needsWork = studentsWithData.filter((s) => s.status === 'needs-improvement').length;

  const chartData = [
    { name: 'Most Improved', value: improved, key: 'most-improved' },
    { name: 'Stable / Average', value: stable, key: 'stable' },
    { name: 'Needs Improvement', value: needsWork, key: 'needs-improvement' },
  ].filter(item => item.value > 0);

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
      <div>
        <h3 className="text-base font-bold text-gray-900">Academic Status Distribution</h3>
        <p className="text-xs text-gray-500">Overview of student academic growth classification</p>
      </div>

      {totalStudents === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[220px] text-center p-4">
          <p className="text-gray-400 text-sm">No assessment data available yet</p>
        </div>
      ) : (
        <>
          <div className="relative my-4 flex items-center justify-center min-h-[220px]">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={85}
                  paddingAngle={4}
                  dataKey="value"
                  nameKey="name"
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={`cell-${entry.key}`}
                      fill={COLORS[entry.key as keyof typeof COLORS]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Center Text */}
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Tutees Charted</span>
              <span className="text-lg font-extrabold text-gray-800 mt-0.5">
                {totalStudents}
              </span>
            </div>
          </div>

          <div className="space-y-2 mt-2">
            {[
              { label: 'Most Improved 🟢', count: improved, color: COLORS['most-improved'] },
              { label: 'Stable / Average 🟡', count: stable, color: COLORS.stable },
              { label: 'Needs Improvement 🔴', count: needsWork, color: COLORS['needs-improvement'] },
            ].map((item, index) => {
              const percent = totalStudents > 0 ? Math.round((item.count / totalStudents) * 100) : 0;
              return (
                <div key={index} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-gray-600 font-medium">
                    <span
                      className="w-2.5 h-2.5 rounded-full shadow-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.label}
                  </span>
                  <span className="text-gray-900 font-semibold">
                    {item.count} student(s) <span className="text-gray-400 font-normal ml-1">({percent}%)</span>
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
