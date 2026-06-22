import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { PaymentMethodSummary } from '@/features/reports/types/report';
import { formatCurrency } from '@/shared/utils/formatCurrency';

interface BalanceChartProps {
  data: PaymentMethodSummary[];
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-800 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 font-sans">
        <p className="font-semibold text-slate-400 border-b border-slate-800 pb-1 mb-1">{data.method}</p>
        <div className="flex items-center justify-between gap-6">
          <span className="text-slate-400">Total Amount:</span>
          <span className="font-bold text-emerald-400">{formatCurrency(data.amount)}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-slate-400">Transactions:</span>
          <span className="font-bold text-white">{data.count}</span>
        </div>
      </div>
    );
  }
  return null;
};

export const BalanceChart = ({ data }: BalanceChartProps) => {
  const totalAmount = data.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
      <div>
        <h3 className="text-base font-bold text-gray-900">Payment Methods</h3>
        <p className="text-xs text-gray-500">Distribution of revenue by payment channel</p>
      </div>
      
      <div className="relative my-4 flex items-center justify-center min-h-[220px]">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={85}
              paddingAngle={4}
              dataKey="amount"
              nameKey="method"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${entry.method}-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Center Text displaying total */}
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Total Revenue</span>
          <span className="text-lg font-extrabold text-gray-800 mt-0.5">
            {formatCurrency(totalAmount)}
          </span>
        </div>
      </div>

      <div className="space-y-2 mt-2">
        {data.map((item, index) => {
          const percent = totalAmount > 0 ? Math.round((item.amount / totalAmount) * 100) : 0;
          return (
            <div key={`legend-${item.method}-${index}`} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-gray-600 font-medium">
                <span
                  className="w-2.5 h-2.5 rounded-full shadow-sm"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                {item.method}
              </span>
              <span className="text-gray-900 font-semibold">
                {formatCurrency(item.amount)} <span className="text-gray-400 font-normal ml-1">({percent}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};