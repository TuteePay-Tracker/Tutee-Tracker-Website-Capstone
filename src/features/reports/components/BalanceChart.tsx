import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { PaymentMethodSummary } from '@/features/reports/types/report';
import { formatCurrency } from '@/shared/utils/formatCurrency';

interface BalanceChartProps {
  data: PaymentMethodSummary[];
}

const COLORS = ['#15803d', '#166534', '#14532d', '#065f46'];

export const BalanceChart = ({ data }: BalanceChartProps) => {
  return (
    <div className="bg-white p-6 rounded-lg border">
      <h3 className="text-lg font-semibold mb-4">Payment Methods Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ method, percent }) => `${method} ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="amount"
            nameKey="method"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${entry.method}-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => formatCurrency(value)} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-4 space-y-2">
        {data.map((item, index) => (
          <div key={`legend-${item.method}-${index}`} className="flex justify-between text-sm">
            <span className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              {item.method}
            </span>
            <span>
              {formatCurrency(item.amount)} ({item.count} transactions)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};