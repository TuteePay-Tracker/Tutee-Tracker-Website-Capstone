import { useEffect, useState } from 'react';
import { usePayments } from '@/features/payments/hooks/usePayments';
import { useReports } from '@/features/reports/hooks/useReports';
import { useTutees } from '@/features/tutees/hooks/useTutees';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { DollarSign, Users, AlertCircle, TrendingUp, GraduationCap, Calendar, Megaphone, Plus, Pencil, Trash2, X, Bell } from 'lucide-react';
import { Link } from 'react-router';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase/config';
import { Announcement, AnnouncementFormData } from '@/features/announcements/types/announcement';
import { announcementService } from '@/features/announcements/services/announcementService';
import { toast } from 'sonner';

// Parent portal view: read-only summary of linked children
const ParentDashboard = () => {
  const { tutees, isLoading } = useTutees();
  const { user } = useAuth();
  const [transactionTotals, setTransactionTotals] = useState<Record<string, number>>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    if (user?.createdByTutorId) {
      return announcementService.subscribe(user.createdByTutorId, setAnnouncements);
    }
  }, [user?.createdByTutorId]);

  useEffect(() => {
    if (!user?.createdByTutorId || tutees.length === 0) {
      setTransactionTotals({});
      return;
    }

    setTransactionTotals({});

    const initialTotals: Record<string, number> = {};
    tutees.forEach((tutee) => {
      initialTotals[tutee.id] = 0;
    });
    setTransactionTotals(initialTotals);

    const unsubscribes = tutees.map((tutee) => {
      const transactionsRef = collection(db, 'users', user.createdByTutorId!, 'paymentTransactions');
      const transactionsQuery = query(transactionsRef, where('tuteeId', '==', tutee.id));

      return onSnapshot(
        transactionsQuery,
        (snapshot) => {
          const totalAmount = snapshot.docs.reduce((sum, docSnap) => {
            const data = docSnap.data();
            return sum + (typeof data.totalAmount === 'number' ? data.totalAmount : 0);
          }, 0);

          setTransactionTotals((prev) => ({
            ...prev,
            [tutee.id]: totalAmount,
          }));
        },
        (error) => {
          console.warn('Unable to load payment transactions for tutee:', tutee.id, error);
          setTransactionTotals((prev) => ({
            ...prev,
            [tutee.id]: 0,
          }));
        }
      );
    });

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [user?.createdByTutorId, tutees.map((tutee) => tutee.id).join('|')]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div>
        <span className="ml-3 text-gray-500 font-medium">Loading child summaries...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Welcome, {user?.name?.split(' ')[0]}!</h1>
        <p className="text-gray-600 mt-1">Here's an overview of your child's tutoring progress</p>
      </div>

      {announcements.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-4 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-amber-100 p-3 rounded-xl h-fit">
            <Megaphone className="text-amber-700" size={24} />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <h3 className="font-bold text-amber-900 text-lg">{announcements[0].title}</h3>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                New Announcement
              </span>
            </div>
            <p className="text-amber-800/90 text-sm mt-1 leading-relaxed">{announcements[0].content}</p>
            <p className="text-amber-600 text-[10px] mt-3 font-medium italic">Posted on {new Date(announcements[0].createdAt).toLocaleDateString()}</p>
          </div>
        </div>
      )}

      {tutees.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-16 text-center">
          <GraduationCap size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">No linked students yet</p>
          <p className="text-gray-400 text-sm mt-1">Contact your tutor to link your child's account</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tutees.map(tutee => {
            const totalPaid = Math.round((transactionTotals[tutee.id] || 0) * 100) / 100;
            const totalDue = Math.round((tutee.totalSessions || 0) * (tutee.ratePerSession || 0) * 100) / 100;
            const remainingBalance = Math.max(Math.round((totalDue - totalPaid) * 100) / 100, 0);
            const hasOutstandingBalance = remainingBalance > 0;
            const isFull = totalPaid > 0 && !hasOutstandingBalance;
            const isPartial = totalPaid > 0 && hasOutstandingBalance;

            return (
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
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-green-700">{formatCurrency(totalPaid)}</p>
                  <p className="text-xs text-gray-500 mt-1">Total Paid</p>
                </div>
                {(() => (
                  <div className="bg-orange-50 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-orange-700">{formatCurrency(remainingBalance)}</p>
                    <p className="text-xs text-gray-500 mt-1">Balance</p>
                  </div>
                ))()}
                {(() => (
                  <div className={`rounded-xl p-3 text-center ${
                    isFull
                      ? 'bg-green-50'
                      : isPartial
                      ? 'bg-orange-50'
                      : 'bg-gray-50'
                  }`}>
                    <p className={`text-lg font-bold leading-tight ${
                      isFull
                        ? 'text-green-600'
                        : isPartial
                        ? 'text-orange-600'
                        : 'text-gray-400'
                    }`}>
                      {isFull
                        ? 'Full Payment'
                        : isPartial
                        ? 'Partial Payment'
                        : 'Unpaid'}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-1 uppercase font-bold tracking-wider">
                      Status
                    </p>
                  </div>
                ))()}
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
            );
          })}
        </div>
      )}
    </div>
  );
};

export const Dashboard = () => {
  const { user } = useAuth();
  const { payments } = usePayments();
  const { reportData, isLoading } = useReports();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isAnnounceModalOpen, setIsAnnounceModalOpen] = useState(false);
  const [editingAnnounce, setEditingAnnounce] = useState<Announcement | null>(null);
  const [announceForm, setAnnounceForm] = useState<AnnouncementFormData>({
    title: '',
    content: '',
    priority: 'medium'
  });

  useEffect(() => {
    if (user?.id && user.role === 'tutor') {
      return announcementService.subscribe(user.id, setAnnouncements);
    }
  }, [user?.id, user?.role]);

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    try {
      if (editingAnnounce) {
        await announcementService.update(user.id, editingAnnounce.id, announceForm);
        toast.success('Announcement updated');
      } else {
        await announcementService.create(user.id, announceForm);
        toast.success('Announcement posted to parents');
      }
      setIsAnnounceModalOpen(false);
      setEditingAnnounce(null);
      setAnnounceForm({ title: '', content: '', priority: 'medium' });
    } catch (error) {
      toast.error('Failed to save announcement');
    }
  };

  const handleDeleteAnnounce = async (id: string) => {
    if (!user?.id || !window.confirm('Delete this announcement?')) return;
    try {
      await announcementService.delete(user.id, id);
      toast.success('Announcement removed');
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const openEditAnnounce = (a: Announcement) => {
    setEditingAnnounce(a);
    setAnnounceForm({
      title: a.title,
      content: a.content,
      priority: a.priority
    });
    setIsAnnounceModalOpen(true);
  };

  const totalLifetimeEarnings = payments
    .filter(p => p.status === 'verified' || !p.status)
    .reduce((sum, p) => sum + (p.amount || 0), 0);

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
      title: 'Total Lifetime Earnings',
      value: formatCurrency(totalLifetimeEarnings),
      icon: TrendingUp,
      color: 'bg-green-700',
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-lg border shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <Megaphone className="text-green-700" size={20} />
              <h2 className="text-lg font-semibold">Broadcast Announcements</h2>
            </div>
            <button
              onClick={() => {
                setEditingAnnounce(null);
                setAnnounceForm({ title: '', content: '', priority: 'medium' });
                setIsAnnounceModalOpen(true);
              }}
              className="flex items-center gap-2 text-sm bg-green-700 text-white px-3 py-1.5 rounded-lg hover:bg-green-800 transition-colors"
            >
              <Plus size={16} /> Post New
            </button>
          </div>

          <div className="space-y-4">
            {announcements.length === 0 ? (
              <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed">
                <Bell className="mx-auto text-gray-300 mb-2" size={32} />
                <p className="text-gray-500 text-sm">No announcements sent to parents yet.</p>
              </div>
            ) : (
              announcements.map((a) => (
                <div key={a.id} className="p-4 border rounded-xl hover:bg-gray-50 transition-colors group">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900">{a.title}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase border ${
                          a.priority === 'high' ? 'bg-red-50 border-red-100 text-red-600' :
                          a.priority === 'medium' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                          'bg-blue-50 border-blue-100 text-blue-600'
                        }`}>
                          {a.priority}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{a.content}</p>
                      <p className="text-[10px] text-gray-400 mt-2 font-medium">
                        Updated {new Date(a.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditAnnounce(a)} className="p-1.5 text-gray-400 hover:text-green-700 hover:bg-green-50 rounded-lg">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => handleDeleteAnnounce(a.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {isAnnounceModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-green-700 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold">{editingAnnounce ? 'Edit Announcement' : 'New Announcement'}</h3>
              <button onClick={() => setIsAnnounceModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveAnnouncement} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Title</label>
                <input
                  required
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-700 outline-none"
                  value={announceForm.title}
                  onChange={e => setAnnounceForm({...announceForm, title: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Content</label>
                <textarea
                  required
                  rows={4}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-700 outline-none resize-none"
                  value={announceForm.content}
                  onChange={e => setAnnounceForm({...announceForm, content: e.target.value})}
                />
              </div>
              <div className="flex gap-4 pt-2">
                <button type="submit" className="flex-1 bg-green-700 text-white py-2 rounded-xl font-bold hover:bg-green-800 transition-colors">
                  {editingAnnounce ? 'Save Changes' : 'Post Announcement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};