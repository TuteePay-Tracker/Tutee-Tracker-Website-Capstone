import { useReports } from '@/features/reports/hooks/useReports';
import { MonthlyChart } from '@/features/reports/components/MonthlyChart';
import { BalanceChart } from '@/features/reports/components/BalanceChart';
import { ExportButton } from '@/features/reports/components/ExportButton';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatDate } from '@/shared/utils/formatDate';
import { TrendingUp, Users, AlertTriangle } from 'lucide-react';

export const Reports = () => {
  const { reportData, isLoading } = useReports();

  if (isLoading || !reportData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading reports...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600 mt-1">Comprehensive insights into your tutoring business</p>
        </div>
        <ExportButton reportData={reportData} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-green-700 text-white rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp size={24} />
            <h3 className="font-semibold">Monthly Earnings</h3>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(reportData.totalEarningsThisMonth)}</p>
          <p className="text-green-100 text-sm mt-1">This month</p>
        </div>

        <div className="bg-green-700 text-white rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <Users size={24} />
            <h3 className="font-semibold">Total Tutees</h3>
          </div>
          <p className="text-3xl font-bold">{reportData.totalTutees}</p>
          <p className="text-green-100 text-sm mt-1">Active students</p>
        </div>

        <div className="bg-green-700 text-white rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp size={24} />
            <h3 className="font-semibold">Total Months</h3>
          </div>
          <p className="text-3xl font-bold">{reportData.totalSessions}</p>
          <p className="text-green-100 text-sm mt-1">All time</p>
        </div>

        <div className="bg-green-700 text-white rounded-lg p-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle size={24} />
            <h3 className="font-semibold">Pending Balance</h3>
          </div>
          <p className="text-3xl font-bold">{formatCurrency(reportData.totalPendingBalance)}</p>
          <p className="text-green-100 text-sm mt-1">Outstanding</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MonthlyChart data={reportData.monthlyEarnings} />
        <BalanceChart data={reportData.paymentMethodSummary} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Most Active Tutees</h2>
          <div className="space-y-3">
            {reportData.tuteeActivity.slice(0, 5).map((activity, index) => (
              <div key={activity.tuteeId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="bg-green-700 text-white w-8 h-8 rounded-full flex items-center justify-center font-semibold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{activity.tuteeName}</p>
                    <p className="text-sm text-gray-600">{activity.sessions} months</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatCurrency(activity.earnings)}</p>
                  <p className="text-sm text-gray-600">earned</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Unpaid Balances</h2>
          {reportData.unpaidBalances.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-green-600 font-medium">All balances cleared!</p>
              <p className="text-gray-500 text-sm mt-1">No outstanding payments</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reportData.unpaidBalances.map((balance) => (
                <div key={balance.tuteeId} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div>
                    <p className="font-medium">{balance.tuteeName}</p>
                    {balance.lastPaymentDate && (
                      <p className="text-sm text-gray-600">
                        Last paid: {formatDate(balance.lastPaymentDate)}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-orange-600">{formatCurrency(balance.balance)}</p>
                    <p className="text-sm text-gray-600">due</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Weekly Income Breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Week</th>
                <th className="text-right py-3 px-4">Income</th>
              </tr>
            </thead>
            <tbody>
              {reportData.weeklyIncome.map((week) => (
                <tr key={week.week} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4">{week.week}</td>
                  <td className="py-3 px-4 text-right font-semibold">
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
