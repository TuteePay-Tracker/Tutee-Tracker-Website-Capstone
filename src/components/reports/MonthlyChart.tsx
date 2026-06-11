import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { MonthlyEarnings } from '../../types/report';
import { formatCurrency } from '../../utils/formatCurrency';

interface MonthlyChartProps {
  data: MonthlyEarnings[];
}

export const MonthlyChart = ({ data }: MonthlyChartProps) => {
  return (
    <div className="bg-white p-6 rounded-lg border">
      <h3 className="text-lg font-semibold mb-4">Monthly Earnings</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis tickFormatter={(value) => `₱${value}`} />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            labelStyle={{ color: '#000' }}
          />
          <Legend />
          <Bar dataKey="earnings" fill="#15803d" name="Earnings (₱)" radius={[8, 8, 0, 0]} />
          <Bar dataKey="sessions" fill="#166534" name="Sessions" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};