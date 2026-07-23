import { PaymentBehaviorReport, PaymentMethodSummary } from '@/features/reports/types/report';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { CreditCard, DollarSign, Clock, PieChart } from 'lucide-react';
import { BalanceChart } from '@/features/reports/components/BalanceChart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PaymentBehaviorTabProps {
  paymentBehavior: PaymentBehaviorReport[];
  paymentMethodSummary: PaymentMethodSummary[];
  weeklyIncome: { week: string; income: number }[];
}

const WeeklyIncomeTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-800 text-white p-3 rounded-xl shadow-xl text-xs font-sans">
        <p className="font-semibold text-slate-400 border-b border-slate-800 pb-1 mb-1">{data.week}</p>
        <div className="flex items-center justify-between gap-6 mt-1">
          <span className="text-slate-400">Weekly Revenue:</span>
          <span className="font-bold text-emerald-400">{formatCurrency(data.income)}</span>
        </div>
      </div>
    );
  }
  return null;
};


export const PaymentBehaviorTab = ({ paymentBehavior, paymentMethodSummary, weeklyIncome }: PaymentBehaviorTabProps) => {
  const studentsWithPayments = paymentBehavior.filter((s) => s.totalPayments > 0);

  // Overall stats
  const totalRevenue = studentsWithPayments.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalPayments = studentsWithPayments.reduce((sum, s) => sum + s.totalPayments, 0);
  const avgOnTime =
    studentsWithPayments.length > 0
      ? Math.round(
          studentsWithPayments.reduce((sum, s) => sum + s.onTimeRate, 0) / studentsWithPayments.length
        )
      : 0;
  const consistentPayers = studentsWithPayments.filter((s) => s.onTimeRate >= 80).length;


  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Revenue Card */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300" />
          <div className="w-12 h-12 rounded-xl bg-green-50 text-green-700 flex items-center justify-center relative shrink-0">
            <DollarSign size={22} />
          </div>
          <div className="relative">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total Revenue</p>
            <p className="text-[1.625rem] font-bold text-gray-900 mt-0.5">{formatCurrency(totalRevenue)}</p>
          </div>
        </div>

        {/* Total Transactions Card */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300" />
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center relative shrink-0">
            <CreditCard size={22} />
          </div>
          <div className="relative">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total Transactions</p>
            <p className="text-[1.625rem] font-bold text-gray-900 mt-0.5">{totalPayments}</p>
          </div>
        </div>

        {/* Avg On-Time Rate Card */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300" />
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center relative shrink-0">
            <Clock size={22} />
          </div>
          <div className="relative">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Avg On-Time Rate</p>
            <p className="text-[1.625rem] font-bold text-gray-900 mt-0.5">{avgOnTime}%</p>
          </div>
        </div>

        {/* Consistent Payers Card */}
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300" />
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center relative shrink-0">
            <PieChart size={22} />
          </div>
          <div className="relative">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Consistent Payers (≥80%)</p>
            <p className="text-[1.625rem] font-bold text-gray-900 mt-0.5">{consistentPayers}</p>
          </div>
        </div>
      </div>

      {/* Payment Method Breakdown Charts & List */}
      {paymentMethodSummary.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BalanceChart data={paymentMethodSummary} />
          
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900 mb-1">Payment Channel Breakdown</h3>
              <p className="text-xs text-gray-500 mb-4">Detailed transaction breakdown per channel</p>
            </div>
            <div className="space-y-3 flex-1 flex flex-col justify-center">
              {paymentMethodSummary.map((method) => {
                const percentage =
                  totalPayments > 0
                    ? Math.round((method.count / totalPayments) * 100)
                    : 0;

                return (
                  <div
                    key={method.method}
                    className="bg-gray-50 rounded-xl p-4 flex items-center justify-between border border-gray-100 hover:shadow-sm transition-all"
                  >
                    <div>
                      <p className="font-semibold text-sm text-gray-800">{method.method}</p>
                      <p className="text-xs text-gray-500">{method.count} transactions</p>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-sm text-gray-900">{formatCurrency(method.amount)}</p>
                      <p className="text-xs text-gray-400 font-medium">{percentage}% of volume</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Grid containing Table and Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Per-Student Payment Behavior */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 mb-4">Per-Student Payment Behavior</h3>
          {studentsWithPayments.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">No payment data available</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Student</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Payments</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Total Paid</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Full</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Partial</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Preferred</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">On-Time</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-600 uppercase">Avg/Month</th>
                  </tr>
                </thead>
                <tbody>
                  {studentsWithPayments.map((student) => (
                    <tr key={student.tuteeId} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 font-medium text-sm">{student.tuteeName}</td>
                      <td className="py-3 px-4 text-center text-sm">{student.totalPayments}</td>
                      <td className="py-3 px-4 text-center text-sm font-semibold">
                        {formatCurrency(student.totalAmount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                          {student.fullPayments}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-700">
                          {student.partialPayments}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-sm text-gray-600">{student.preferredMethod}</td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-12 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                student.onTimeRate >= 80
                                  ? 'bg-green-500'
                                  : student.onTimeRate >= 50
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${student.onTimeRate}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium">{student.onTimeRate}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center text-sm">
                        {formatCurrency(student.averageMonthlyPayment)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Weekly Income Trend Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900">Weekly Income Trend</h3>
            <p className="text-xs text-gray-500 mb-4">Revenue trend across the last 4 weeks</p>
          </div>
          {weeklyIncome && weeklyIncome.length > 0 && !weeklyIncome.every(w => w.income === 0) ? (
            <div className="relative my-4 flex items-center justify-center min-h-[220px]">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={weeklyIncome} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="weeklyIncomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `₱${v}`} tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip content={<WeeklyIncomeTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="income"
                    stroke="#10b981"
                    strokeWidth={3}
                    fill="url(#weeklyIncomeGrad)"
                    name="Income"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-400 text-xs text-center border border-dashed border-gray-200 rounded-xl bg-gray-50 p-4">
              No recent payments recorded in the last 4 weeks
            </div>
          )}
          <div className="mt-2 text-xs text-gray-500 font-medium">
            This graph highlights short-term cash flow trends based on recently tracked payments.
          </div>
        </div>
      </div>
    </div>
  );
};
