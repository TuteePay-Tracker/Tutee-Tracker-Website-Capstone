import { useEffect, useState } from 'react';
import { usePayments } from '@/features/payments/hooks/usePayments';
import { useReports } from '@/features/reports/hooks/useReports';
import { useTutees } from '@/features/tutees/hooks/useTutees';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { DollarSign, Users, AlertCircle, TrendingUp, GraduationCap, Calendar, Megaphone, Plus, Pencil, Trash2, X, Bell, CheckSquare } from 'lucide-react';
import { Link } from 'react-router';
import { LineChart, Line, BarChart, Bar, Cell, Legend, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase/config';
import { Announcement, AnnouncementFormData } from '@/features/announcements/types/announcement';
import { announcementService } from '@/features/announcements/services/announcementService';
import { toast } from 'sonner';
import { ScheduleItem } from '@/features/tutees/types/tutee';
import { Assessment } from '@/features/tutee-progress/types/assessment';

// Parent portal view: aggregated summary of all children
const ParentDashboard = () => {
  const { tutees, isLoading } = useTutees();
  const { user } = useAuth();
  const [transactionTotals, setTransactionTotals] = useState<Record<string, number>>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [tuteeAttendance, setTuteeAttendance] = useState<Record<string, { presentCount: number; totalSessions: number }>>({});
  const [tuteeAssessments, setTuteeAssessments] = useState<Record<string, Assessment[]>>({});
  const [assessmentPage, setAssessmentPage] = useState(0);
  const ASSESSMENT_PAGE_SIZE = 3;

  useEffect(() => {
    if (user?.createdByTutorId) {
      return announcementService.subscribe(user.createdByTutorId, setAnnouncements);
    }
  }, [user?.createdByTutorId]);

  useEffect(() => {
    if (!user?.createdByTutorId || tutees.length === 0) {
      setTransactionTotals({});
      setTuteeAttendance({});
      setTuteeAssessments({});
      return;
    }

    // Set up transactions subscriptions
    const unsubTransactions = tutees.map((tutee) => {
      const transactionsRef = collection(db, 'users', user.createdByTutorId!, 'paymentTransactions');
      const transactionsQuery = query(transactionsRef, where('tuteeId', '==', tutee.id));
      return onSnapshot(
        transactionsQuery,
        (snapshot) => {
          const totalAmount = snapshot.docs.reduce((sum, docSnap) => {
            const data = docSnap.data();
            return sum + (typeof data.totalAmount === 'number' ? data.totalAmount : 0);
          }, 0);
          setTransactionTotals((prev) => ({ ...prev, [tutee.id]: totalAmount }));
        },
        (error) => {
          console.warn('Unable to load payment transactions for tutee:', tutee.id, error);
          setTransactionTotals((prev) => ({ ...prev, [tutee.id]: 0 }));
        }
      );
    });

    // Set up attendance subscriptions
    const unsubAttendance = tutees.map((tutee) => {
      const recordsRef = collection(db, 'users', user.createdByTutorId!, 'paymentRecords');
      const recordsQuery = query(recordsRef, where('tuteeId', '==', tutee.id));
      return onSnapshot(
        recordsQuery,
        (snapshot) => {
          let present = 0;
          let total = 0;
          snapshot.docs.forEach((docSnap) => {
            const recData = docSnap.data();
            const dayPayments = (recData.dayPayments || []) as any[];
            dayPayments.forEach((dp) => {
              if (dp.status === 'paid') present++;
              total++;
            });
          });
          setTuteeAttendance((prev) => ({
            ...prev,
            [tutee.id]: { presentCount: present, totalSessions: total }
          }));
        },
        (error) => {
          console.warn('Unable to load payment records for tutee:', tutee.id, error);
        }
      );
    });

    // Set up assessments subscriptions
    const unsubAssessments = tutees.map((tutee) => {
      const assessmentsRef = collection(db, 'users', user.createdByTutorId!, 'assessments');
      const assessmentsQuery = query(assessmentsRef, where('tuteeId', '==', tutee.id));
      return onSnapshot(
        assessmentsQuery,
        (snapshot) => {
          const list = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data()
          })) as Assessment[];
          setTuteeAssessments((prev) => ({
            ...prev,
            [tutee.id]: list
          }));
        },
        (error) => {
          console.warn('Unable to load assessments for tutee:', tutee.id, error);
        }
      );
    });

    return () => {
      unsubTransactions.forEach((unsub) => unsub());
      unsubAttendance.forEach((unsub) => unsub());
      unsubAssessments.forEach((unsub) => unsub());
    };
  }, [user?.createdByTutorId, tutees]);

  // Compute aggregated stats
  const totalChildren = tutees.length;
  
  const totalPaid = Object.values(transactionTotals).reduce((sum, val) => sum + val, 0);
  
  const totalOutstandingBalance = tutees.reduce((sum, tutee) => {
    const paid = transactionTotals[tutee.id] || 0;
    const due = (tutee.totalSessions || 0) * (tutee.ratePerSession || 0);
    return sum + Math.max(due - paid, 0);
  }, 0);

  let totalPresent = 0;
  let totalSessions = 0;
  Object.values(tuteeAttendance).forEach((att) => {
    totalPresent += att.presentCount;
    totalSessions += att.totalSessions;
  });
  const overallAttendanceRate = totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100) : 100;

  // Flatten assessments and sort chronologically
  const allAssessmentsList = Object.values(tuteeAssessments).flat().sort((a, b) => b.date.localeCompare(a.date));
  const recentAssessments = allAssessmentsList.slice(assessmentPage * ASSESSMENT_PAGE_SIZE, (assessmentPage + 1) * ASSESSMENT_PAGE_SIZE);
  const assessmentTotalPages = Math.ceil(Math.min(allAssessmentsList.length, 15) / ASSESSMENT_PAGE_SIZE);
  const assessmentTotalSource = allAssessmentsList.slice(0, 15);

  // Group assessments by month for LineChart
  const monthlyDataMap: Record<string, Record<string, { sum: number; count: number }>> = {};
  Object.entries(tuteeAssessments).forEach(([tuteeId, list]) => {
    const tutee = tutees.find((t) => t.id === tuteeId);
    if (!tutee) return;
    const childName = `${tutee.firstName} ${tutee.surname.charAt(0)}.`;

    list.forEach((assessment) => {
      if (typeof assessment.score !== 'number') return;
      const dateObj = new Date(assessment.date);
      const monthKey = !isNaN(dateObj.getTime())
        ? assessment.date.substring(0, 7) // "YYYY-MM"
        : 'Unknown';

      if (monthKey === 'Unknown') return;

      if (!monthlyDataMap[monthKey]) {
        monthlyDataMap[monthKey] = {};
      }
      if (!monthlyDataMap[monthKey][childName]) {
        monthlyDataMap[monthKey][childName] = { sum: 0, count: 0 };
      }
      monthlyDataMap[monthKey][childName].sum += assessment.score;
      monthlyDataMap[monthKey][childName].count += 1;
    });
  });

  const sortedMonths = Object.keys(monthlyDataMap).sort();
  const performanceChartData = sortedMonths.map((monthKey) => {
    const [year, month] = monthKey.split('-');
    const monthLabel = new Date(parseInt(year), parseInt(month) - 1, 1).toLocaleString('default', { month: 'short' }) + ' ' + year.substring(2);

    const row: Record<string, any> = { month: monthLabel };
    Object.entries(monthlyDataMap[monthKey]).forEach(([childName, stats]) => {
      row[childName] = Math.round(stats.sum / stats.count);
    });
    return row;
  });

  const childNames = Array.from(new Set(tutees.map((t) => `${t.firstName} ${t.surname.charAt(0)}.`)));

  // Calculate subject averages across all children
  const subjectStats: Record<string, { sum: number; count: number }> = {};
  Object.values(tuteeAssessments).flat().forEach((assessment) => {
    if (typeof assessment.score !== 'number' || !assessment.subject) return;
    const sub = assessment.subject;
    if (!subjectStats[sub]) {
      subjectStats[sub] = { sum: 0, count: 0 };
    }
    subjectStats[sub].sum += assessment.score;
    subjectStats[sub].count += 1;
  });

  const subjectChartData = Object.entries(subjectStats).map(([subject, stats]) => ({
    subject,
    average: Math.round(stats.sum / stats.count),
  }));

  // Parse combined tutoring schedule
  interface CombinedScheduleItem {
    id: string;
    childName: string;
    subject: string;
    day: string;
    time: string;
  }

  const combinedSchedule: CombinedScheduleItem[] = [];
  tutees.forEach((tutee) => {
    const childName = `${tutee.firstName} ${tutee.surname}`;
    const firstSubject = tutee.subjects?.[0] || tutee.subject || 'Tutoring';

    if (Array.isArray(tutee.schedule)) {
      tutee.schedule.forEach((slot, index) => {
        if (typeof slot === 'object' && slot !== null) {
          if ('startTime' in slot && 'endTime' in slot) {
            combinedSchedule.push({
              id: `${tutee.id}-s-${index}`,
              childName,
              subject: firstSubject,
              day: slot.day,
              time: `${slot.startTime} - ${slot.endTime}`,
            });
          } else if ('time' in slot) {
            combinedSchedule.push({
              id: `${tutee.id}-s-${index}`,
              childName,
              subject: firstSubject,
              day: (slot as any).day,
              time: (slot as any).time,
            });
          } else {
            combinedSchedule.push({
              id: `${tutee.id}-s-${index}`,
              childName,
              subject: firstSubject,
              day: (slot as any).day || 'Unknown Day',
              time: 'Scheduled',
            });
          }
        } else if (typeof slot === 'string') {
          const parts = (slot as string).split(':');
          if (parts.length >= 2) {
            combinedSchedule.push({
              id: `${tutee.id}-s-${index}`,
              childName,
              subject: firstSubject,
              day: parts[0].trim(),
              time: parts.slice(1).join(':').trim(),
            });
          } else {
            combinedSchedule.push({
              id: `${tutee.id}-s-${index}`,
              childName,
              subject: firstSubject,
              day: slot,
              time: 'Scheduled',
            });
          }
        }
      });
    } else if (typeof tutee.schedule === 'string') {
      const lines = tutee.schedule.split(/\r?\n|,/);
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        const parts = trimmed.split(':');
        if (parts.length >= 2) {
          combinedSchedule.push({
            id: `${tutee.id}-string-${index}`,
            childName,
            subject: firstSubject,
            day: parts[0].trim(),
            time: parts.slice(1).join(':').trim(),
          });
        } else {
          combinedSchedule.push({
            id: `${tutee.id}-string-${index}`,
            childName,
            subject: firstSubject,
            day: trimmed,
            time: 'Scheduled',
          });
        }
      });
    }
  });

  const dayIndex = (day: string) => {
    const normalized = day.trim().toLowerCase();
    if (normalized.startsWith('mon')) return 0;
    if (normalized.startsWith('tue')) return 1;
    if (normalized.startsWith('wed')) return 2;
    if (normalized.startsWith('thu')) return 3;
    if (normalized.startsWith('fri')) return 4;
    if (normalized.startsWith('sat')) return 5;
    if (normalized.startsWith('sun')) return 6;
    return 7;
  };

  combinedSchedule.sort((a, b) => dayIndex(a.day) - dayIndex(b.day));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div>
        <span className="ml-3 text-gray-500 font-medium">Loading parent dashboard...</span>
      </div>
    );
  }

  const hasAssessments = allAssessmentsList.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Parent Dashboard</h1>
          <p className="text-gray-500 mt-1">Aggregated statistics, progress history, and tutoring schedules for your children.</p>
        </div>
        <Link
          to="/my-children"
          className="bg-green-700 hover:bg-green-800 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-green-700/10 flex items-center gap-2 self-start md:self-auto"
        >
          <Users size={16} />
          <span>View My Children Cards</span>
        </Link>
      </div>

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-4 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-amber-100 p-3 rounded-xl h-fit">
            <Megaphone className="text-amber-700 animate-bounce" size={24} />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <h3 className="font-bold text-amber-900 text-lg">{announcements[0].title}</h3>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-200 text-amber-800 px-2.5 py-1 rounded-full">
                New Announcement
              </span>
            </div>
            <p className="text-amber-800/90 text-sm mt-2 leading-relaxed">{announcements[0].content}</p>
            <p className="text-amber-600 text-[10px] mt-4 font-semibold italic">
              Posted on {new Date(announcements[0].createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}
            </p>
          </div>
        </div>
      )}

      {/* Empty State when no children are linked */}
      {tutees.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-16 text-center">
          <GraduationCap size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg font-semibold">No children linked to your account</p>
          <p className="text-gray-400 text-sm mt-1">Please ask your tutor to invite or register your child using your email.</p>
        </div>
      ) : (
        <>
          {/* KPI Dashboard Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white p-5 rounded-2xl border shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="bg-green-100 p-3.5 rounded-2xl text-green-700 shrink-0">
                <Users size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Linked Children</p>
                <p className="text-2xl font-black text-gray-900 mt-1">{totalChildren}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="bg-emerald-100 p-3.5 rounded-2xl text-emerald-700 shrink-0">
                <DollarSign size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Paid</p>
                <p className="text-2xl font-black text-gray-900 mt-1">{formatCurrency(totalPaid)}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="bg-orange-100 p-3.5 rounded-2xl text-orange-700 shrink-0">
                <AlertCircle size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Outstanding Balance</p>
                <p className="text-2xl font-black text-gray-900 mt-1">{formatCurrency(totalOutstandingBalance)}</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
              <div className="bg-indigo-100 p-3.5 rounded-2xl text-indigo-700 shrink-0">
                <CheckSquare size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Average Attendance</p>
                <p className="text-2xl font-black text-gray-900 mt-1">{overallAttendanceRate}%</p>
              </div>
            </div>
          </div>

          {/* Recharts Analytics Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Overall Progress Trend */}
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900">Overall Progress History</h3>
                <p className="text-xs text-gray-500">Monthly assessment scores per child</p>
              </div>
              {!hasAssessments || performanceChartData.length === 0 ? (
                <div className="h-[280px] flex flex-col items-center justify-center text-center p-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <TrendingUp className="text-gray-300 mb-2" size={32} />
                  <p className="text-sm font-medium text-gray-500">No score history</p>
                  <p className="text-xs text-gray-400 mt-0.5">Progress chart will populate when assessments are added.</p>
                </div>
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={performanceChartData} margin={{ left: -15, right: 10, top: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(val) => [`${val}%`, 'Score']} contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                      {childNames.map((name, index) => {
                        const colors = ['#15803d', '#4f46e5', '#d97706', '#2563eb', '#db2777'];
                        const strokeColor = colors[index % colors.length];
                        return (
                          <Line
                            key={name}
                            type="monotone"
                            dataKey={name}
                            stroke={strokeColor}
                            strokeWidth={3}
                            connectNulls
                            activeDot={{ r: 6 }}
                            dot={{ r: 3, strokeWidth: 2 }}
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Subject Average Scores */}
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900">Subject Performance Averages</h3>
                <p className="text-xs text-gray-500">Average grades across all subjects studied</p>
              </div>
              {!hasAssessments || subjectChartData.length === 0 ? (
                <div className="h-[280px] flex flex-col items-center justify-center text-center p-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <GraduationCap className="text-gray-300 mb-2" size={32} />
                  <p className="text-sm font-medium text-gray-500">No subject averages</p>
                  <p className="text-xs text-gray-400 mt-0.5">Performance averages appear as soon as grades are recorded.</p>
                </div>
              ) : (
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subjectChartData} margin={{ left: -15, right: 10, top: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                      <XAxis dataKey="subject" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(val) => [`${val}%`, 'Avg Score']} contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }} />
                      <Bar dataKey="average" radius={[6, 6, 0, 0]} barSize={36}>
                        {subjectChartData.map((_entry, index) => {
                          const colors = ['#16a34a', '#4f46e5', '#ea580c', '#2563eb', '#db2777'];
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Recent Assessments and Tutoring Schedule */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Assessments */}
            <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Recent Assessments</h3>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">Latest assessment scores across all children</p>
                  </div>
                  {assessmentTotalSource.length > 0 && (
                    <span className="text-xs text-gray-400 font-medium">
                      {assessmentPage * ASSESSMENT_PAGE_SIZE + 1}–{Math.min((assessmentPage + 1) * ASSESSMENT_PAGE_SIZE, assessmentTotalSource.length)} of {assessmentTotalSource.length}
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b text-left text-xs font-bold uppercase tracking-wider text-gray-400">
                        <th className="pb-3 pr-2">Child</th>
                        <th className="pb-3 px-2">Subject</th>
                        <th className="pb-3 px-2">Score</th>
                        <th className="pb-3 px-2">Remarks</th>
                        <th className="pb-3 pl-2 text-right">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm">
                      {recentAssessments.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-gray-400 font-medium">
                            No assessments recorded yet.
                          </td>
                        </tr>
                      ) : (
                        recentAssessments.map((a) => (
                          <tr key={a.id} className="hover:bg-gray-50/50">
                            <td className="py-3.5 pr-2 font-semibold text-gray-800">{a.tuteeName}</td>
                            <td className="py-3.5 px-2 text-gray-600 font-medium">{a.subject}</td>
                            <td className="py-3.5 px-2 font-bold text-gray-950">{a.score}%</td>
                            <td className="py-3.5 px-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                a.remarks === 'Excellent' ? 'bg-green-55 border-green-200 text-green-700' :
                                a.remarks === 'Good' ? 'bg-blue-55 border-blue-200 text-blue-700' :
                                'bg-orange-55 border-orange-200 text-orange-700'
                              }`}>
                                {a.remarks}
                              </span>
                            </td>
                            <td className="py-3.5 pl-2 text-right text-gray-500 text-xs font-medium">
                              {new Date(a.date).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {hasAssessments && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  {assessmentTotalPages > 1 ? (
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => setAssessmentPage((p) => Math.max(0, p - 1))}
                        disabled={assessmentPage === 0}
                        className="px-4 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg disabled:opacity-40 hover:bg-gray-200 transition-colors"
                      >
                        ← Previous
                      </button>
                      <span className="text-xs text-gray-400 font-semibold">
                        Page {assessmentPage + 1} of {assessmentTotalPages}
                      </span>
                      <button
                        onClick={() => setAssessmentPage((p) => Math.min(assessmentTotalPages - 1, p + 1))}
                        disabled={assessmentPage === assessmentTotalPages - 1}
                        className="px-4 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg disabled:opacity-40 hover:bg-gray-200 transition-colors"
                      >
                        Next →
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 font-medium text-center">
                      Detailed performance parameters and feedback notes can be viewed inside each child's detailed reports.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Combined Schedule Agenda */}
            <div className="bg-white p-6 rounded-2xl border shadow-sm">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-900">Weekly Tutoring Schedule</h3>
                <p className="text-xs text-gray-500">Unified schedule overview for all children</p>
              </div>

              {combinedSchedule.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center text-center p-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <Calendar className="text-gray-300 mb-2" size={32} />
                  <p className="text-sm font-medium text-gray-500">No scheduled sessions</p>
                  <p className="text-xs text-gray-400 mt-0.5">Schedule sessions will appear here once defined by the tutor.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {combinedSchedule.map((item) => (
                    <div key={item.id} className="flex border-l-4 border-green-700 bg-gray-50 hover:bg-gray-100/70 transition-colors p-3.5 rounded-r-xl items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{item.childName}</p>
                        <p className="text-xs font-medium text-gray-500 mt-0.5">Subject: {item.subject}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-green-800 uppercase tracking-wide bg-green-50 border border-green-100 px-2 py-0.5 rounded-md inline-block">
                          {item.day}
                        </p>
                        <p className="text-xs font-bold text-gray-700 mt-1">{item.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
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
            Enroll Tutee
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