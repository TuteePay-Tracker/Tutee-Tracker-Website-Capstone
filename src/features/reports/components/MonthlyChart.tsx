import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { MonthlyEarnings } from '@/features/reports/types/report';
import { formatCurrency } from '@/shared/utils/formatCurrency';

interface MonthlyChartProps {
  data: MonthlyEarnings[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-800 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 font-sans">
        <p className="font-semibold text-slate-400 border-b border-slate-800 pb-1 mb-1">{label}</p>
        {payload.map((item: any) => (
          <div key={item.name} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5" style={{ color: item.color || item.fill }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color || item.fill }} />
              {item.name}
            </span>
            <span className="font-bold text-white">
              {item.dataKey === 'earnings' ? formatCurrency(item.value) : `${item.value} sessions`}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const MonthlyChart = ({ data }: MonthlyChartProps) => {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-bold text-gray-900">Revenue & Sessions</h3>
        <p className="text-xs text-gray-500">Monthly earnings compared with session counts</p>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.85} />
              <stop offset="100%" stopColor="#15803d" stopOpacity={0.15} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }}
          />
          <YAxis
            yAxisId="left"
            tickFormatter={(value) => `₱${value}`}
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#6b7280', fontSize: 11 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#6b7280', fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(243, 244, 246, 0.6)' }} />
          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: '12px', fontWeight: 500 }}
          />
          <Bar
            yAxisId="left"
            dataKey="earnings"
            fill="url(#earningsGrad)"
            name="Earnings (₱)"
            radius={[6, 6, 0, 0]}
            barSize={36}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="sessions"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={{ r: 4, stroke: '#3b82f6', strokeWidth: 2, fill: '#fff' }}
            activeDot={{ r: 6, stroke: '#1d4ed8', strokeWidth: 2, fill: '#fff' }}
            name="Sessions"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};