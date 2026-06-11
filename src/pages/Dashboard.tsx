import { usePayments } from '../hooks/usePayments';
import { useReports } from '../hooks/useReports';
import { useTutees } from '../hooks/useTutees';
import { formatCurrency } from '../utils/formatCurrency';
import { DollarSign, Users, AlertCircle, BookOpen, TrendingUp, GraduationCap, Calendar } from 'lucide-react';
import { Link } from 'react-router';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '../hooks/useAuth';

// Parent portal view: read-only summary of linked children
const ParentDashboard = () => {
  const { tutees, isLoading } = useTutees();
  const { user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Welcome, {user?.name?.split(' ')[0]}!</h1>
        <p className="text-gray-600 mt-1">Here's an overview of your child's tutoring progress</p>
      </div>

      {tutees.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-16 text-center">
          <GraduationCap size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">No linked students yet</p>
          <p className="text-gray-400 text-sm mt-1">Contact your tutor to link your child's account</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tutees.map(tutee => (
            <div key={tutee.id} className="bg-white rounded-2xl border p-6 shadow-sm">
              <div className="flex items-start gap-4 mb-5">
                <div className="w-14 h-14 bg-green-700 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-green-700/20">
                  {tutee.firstName.charAt(0)}{tutee.surname.charAt(0)}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{tutee.firstName} {tutee.surname}</h2>
                  <p className="text-gray-500 text-sm">{tutee.gradeLevel}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(tutee.subjects?.length ? tutee.subjects : [tutee.subject]).map(s => (
                      <span key={s} className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">{s}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">{tutee.totalSessions}</p>
                  <p className="text-xs text-gray-500 mt-1">Sessions</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">₱{tutee.totalPaid.toFixed(0)}</p>
                  <p className="text-xs text-gray-500 mt-1">Total Paid</p>
                </div>
                <div className={`rounded-xl p-3 text-center ${
                  tutee.totalPaid > 0 && tutee.balance <= 0
                    ? 'bg-green-50'
                    : tutee.totalPaid > 0 && tutee.balance > 0
                    ? 'bg-orange-50'
                    : 'bg-gray-50'
                }`}>
                  <p className={`text-2xl font-bold ${
                    tutee.totalPaid > 0 && tutee.balance <= 0
                      ? 'text-green-600'
                      : tutee.totalPaid > 0 && tutee.balance > 0
                      ? 'text-orange-600'
                      : 'text-gray-400'
                  }`}>
                    {tutee.totalPaid > 0 && tutee.balance <= 0
                      ? 'Paid'
                      : tutee.totalPaid > 0 && tutee.balance > 0
                      ? `₱${tutee.balance.toFixed(0)}`
                      : 'Unpaid'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Balance</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-xl p-3 mb-4">
                <Calendar size={16} className="text-green-700 shrink-0" />
                <span className="text-gray-700">
                  Rate: <strong>₱{tutee.ratePerSession}/month</strong>
                </span>
              </div>

              <Link
                to={`/tutees/${tutee.id}`}
                className="w-full flex items-center justify-center bg-green-700 hover:bg-green-800 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors shadow-sm shadow-green-700/10"
              >
                View Details & Reports
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const Dashboard = () => {
  const { user } = useAuth();
  const { payments } = usePayments();
  const { reportData, isLoading } = useReports();

  // Show parent-specific view
  if (user?.role === 'parent') return <ParentDashboard />;

  if (isLoading || !reportData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  const mostActiveTutee = reportData.tuteeActivity[0];
  const recentPayments = payments.slice(0, 5);

  const summaryCards = [
    {
      title: 'Total Earnings This Month',
      value: formatCurrency(reportData.totalEarningsThisMonth),
      icon: DollarSign,
      color: 'bg-green-700',
      trend: '+12%',
    },
    {
      title: 'Total Tutees',
      value: reportData.totalTutees.toString(),
      icon: Users,
      color: 'bg-green-700',
    },
    {
      title: 'Pending Balances',
      value: formatCurrency(reportData.totalPendingBalance),
      icon: AlertCircle,
      color: 'bg-green-700',
      link: '/tutees',
    },
    {
      title: 'Total Months',
      value: reportData.totalSessions.toString(),
      icon: BookOpen,
      color: 'bg-green-700',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Overview of your tutoring business</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/tutees?action=add"
            className="bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800"
          >
            Add Tutee
          </Link>
          <Link
            to="/payments"
            className="bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800"
          >
            Track Payments
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="bg-white p-6 rounded-lg border shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className={`${card.color} p-3 rounded-lg`}>
                  <Icon size={24} className="text-white" />
                </div>
                {card.trend && (
                  <span className="text-green-700 text-sm flex items-center gap-1">
                    <TrendingUp size={16} />
                    {card.trend}
                  </span>
                )}
              </div>
              <h3 className="text-gray-600 text-sm">{card.title}</h3>
              <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
              {card.link && (
                <Link to={card.link} className="text-green-700 text-sm mt-2 inline-block hover:underline">
                  View details →
                </Link>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">Weekly Income Trend</h2>
          {reportData.weeklyIncome.every(w => w.income === 0) ? (
            <div className="h-[250px] flex items-center justify-center text-gray-400">
              No payment data for the last 4 weeks
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={reportData.weeklyIncome}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis tickFormatter={(value) => `₱${value}`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Line
                  key="income-line"
                  type="monotone"
                  dataKey="income"
                  stroke="#15803d"
                  strokeWidth={2}
                  name="Income"
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg border">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Most Active Tutee</h2>
            <Link to="/reports" className="text-green-700 text-sm hover:underline">
              View all →
            </Link>
          </div>
          {mostActiveTutee ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="font-medium text-lg">{mostActiveTutee.tuteeName}</p>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <p className="text-sm text-gray-600">Months</p>
                    <p className="text-xl font-semibold">{mostActiveTutee.sessions}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Earnings</p>
                    <p className="text-xl font-semibold">{formatCurrency(mostActiveTutee.earnings)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-medium text-sm text-gray-700">Top 3 Tutees</h3>
                {reportData.tuteeActivity.slice(1, 4).map((tutee, index) => (
                  <div key={tutee.tuteeId} className="flex justify-between text-sm p-2 hover:bg-gray-50 rounded">
                    <span>{index + 2}. {tutee.tuteeName}</span>
                    <span className="text-gray-600">{tutee.sessions} months</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No tutee data available</p>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg border">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Recent Payments</h2>
          <Link to="/payments" className="text-green-700 text-sm hover:underline">
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-4">Student</th>
                <th className="text-left py-3 px-4">Date</th>
                <th className="text-left py-3 px-4">Amount</th>
                <th className="text-left py-3 px-4">Method</th>
              </tr>
            </thead>
            <tbody>
              {recentPayments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-400">No payments recorded yet</td>
                </tr>
              ) : (
                recentPayments.map((payment) => (
                  <tr key={payment.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">{payment.tuteeName}</td>
                    <td className="py-3 px-4 text-gray-600">{new Date(payment.paymentDate).toLocaleDateString()}</td>
                    <td className="py-3 px-4 font-medium">{formatCurrency(payment.amount)}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">
                        {payment.paymentMethod}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};