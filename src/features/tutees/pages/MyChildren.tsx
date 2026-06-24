import { useEffect, useState } from 'react';
import { useTutees } from '@/features/tutees/hooks/useTutees';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { GraduationCap, Calendar, TrendingUp, CheckSquare } from 'lucide-react';
import { Link } from 'react-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase/config';
import { ScheduleItem } from '@/features/tutees/types/tutee';
import { formatTime12h } from '@/shared/utils/formatDate';

export const MyChildren = () => {
  const { tutees, isLoading } = useTutees();
  const { user } = useAuth();
  const [transactionTotals, setTransactionTotals] = useState<Record<string, number>>({});
  const [tuteeMetrics, setTuteeMetrics] = useState<Record<string, {
    presentCount: number;
    absentCount: number;
    totalSessions: number;
    attendanceRate: number;
    averageScore: number;
    latestAssessment: { score: number; remarks: string; date: string } | null;
  }>>({});

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
  }, [user?.createdByTutorId, tutees]);

  useEffect(() => {
    if (!user?.createdByTutorId || tutees.length === 0) {
      setTuteeMetrics({});
      return;
    }

    const initialMetrics: Record<string, any> = {};
    tutees.forEach((tutee) => {
      initialMetrics[tutee.id] = {
        presentCount: 0,
        absentCount: 0,
        totalSessions: 0,
        attendanceRate: 100,
        averageScore: 0,
        latestAssessment: null,
      };
    });
    setTuteeMetrics(initialMetrics);

    const unsubscribes = tutees.flatMap((tutee) => {
      const recordsRef = collection(db, 'users', user.createdByTutorId!, 'paymentRecords');
      const recordsQuery = query(recordsRef, where('tuteeId', '==', tutee.id));

      const unsubRecords = onSnapshot(
        recordsQuery,
        (snapshot) => {
          let present = 0;
          let absent = 0;
          let total = 0;

          snapshot.docs.forEach((docSnap) => {
            const recData = docSnap.data();
            const dayPayments = (recData.dayPayments || []) as any[];
            dayPayments.forEach((dp) => {
              if (dp.status === 'paid') present++;
              else if (dp.status === 'partial') absent++;
              
              if (dp.status !== 'no-class') total++;
            });
          });

          const rate = total > 0 ? Math.round((present / total) * 100) : 100;

          setTuteeMetrics((prev) => ({
            ...prev,
            [tutee.id]: {
              ...(prev[tutee.id] || {}),
              presentCount: present,
              absentCount: absent,
              totalSessions: total,
              attendanceRate: rate,
            },
          }));
        },
        (error) => {
          console.warn('Unable to load payment records for tutee:', tutee.id, error);
        }
      );

      const assessmentsRef = collection(db, 'users', user.createdByTutorId!, 'assessments');
      const assessmentsQuery = query(assessmentsRef, where('tuteeId', '==', tutee.id));

      const unsubAssessments = onSnapshot(
        assessmentsQuery,
        (snapshot) => {
          const list = snapshot.docs.map((d) => d.data()).sort((a, b) => b.date.localeCompare(a.date));
          const validScores = list.map((a) => a.score).filter((s) => typeof s === 'number');
          const avg = validScores.length ? Math.round(validScores.reduce((sum, s) => sum + s, 0) / validScores.length) : 0;
          const latest = list.length > 0 ? {
            score: list[0].score || 0,
            remarks: list[0].remarks || 'Good',
            date: list[0].date || '',
          } : null;

          setTuteeMetrics((prev) => ({
            ...prev,
            [tutee.id]: {
              ...(prev[tutee.id] || {}),
              averageScore: avg,
              latestAssessment: latest,
            },
          }));
        },
        (error) => {
          console.warn('Unable to load assessments for tutee:', tutee.id, error);
        }
      );

      return [unsubRecords, unsubAssessments];
    });

    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [user?.createdByTutorId, tutees]);

  const renderSchedule = (schedule: string | ScheduleItem[]) => {
    if (Array.isArray(schedule)) {
      return schedule.map((slot, index) => {
        if (typeof slot === 'object' && slot !== null && 'startTime' in slot && 'endTime' in slot) {
          return (
            <div key={index}>{slot.day}: {formatTime12h(slot.startTime)} - {formatTime12h(slot.endTime)}</div>
          );
        }
        else if (typeof slot === 'object' && slot !== null && 'time' in slot) {
          return (
            <div key={index}>{(slot as any).day} - {formatTime12h((slot as any).time)}</div>
          );
        }
        return <div key={index}>{typeof slot === 'string' ? slot : (slot as any).day}</div>;
      });
    }
    return <div>{schedule}</div>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div>
        <span className="ml-3 text-gray-500 font-medium">Loading children listing...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Children</h1>
        <p className="text-gray-600 mt-1">Manage and view details for each of your linked children</p>
      </div>

      {tutees.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-16 text-center">
          <GraduationCap size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">No linked children yet</p>
          <p className="text-gray-400 text-sm mt-1">Contact your tutor to link your children's accounts</p>
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
            const metrics = tuteeMetrics[tutee.id] || {
              presentCount: 0,
              absentCount: 0,
              totalSessions: 0,
              attendanceRate: 100,
              averageScore: 0,
              latestAssessment: null,
            };

            return (
              <div key={tutee.id} className="bg-white rounded-2xl border p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                <div>
                  <div className="flex items-start gap-4 mb-5">
                    {tutee.photoUrl ? (
                      <img
                        src={tutee.photoUrl}
                        alt={`${tutee.firstName} ${tutee.surname}`}
                        className="w-14 h-14 rounded-2xl object-cover shrink-0 border-2 border-gray-100 shadow-md shadow-emerald-700/10"
                      />
                    ) : (
                      <div className="w-14 h-14 bg-green-700 rounded-2xl flex items-center justify-center text-white text-xl font-bold shrink-0 shadow-lg shadow-green-700/20">
                        {tutee.firstName.charAt(0)}{tutee.surname.charAt(0)}
                      </div>
                    )}
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

                  {/* KPI Metrics overview grid */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {/* Attendance Summary */}
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 flex items-center gap-3">
                      <div className="bg-emerald-100 p-2 rounded-lg text-emerald-800 shrink-0">
                        <CheckSquare size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Attendance</p>
                        <p className="text-base font-bold text-emerald-800 mt-0.5">{metrics.attendanceRate}%</p>
                        <p className="text-[9px] text-gray-400 truncate mt-0.5">
                          {metrics.presentCount} present · {metrics.absentCount} absent
                        </p>
                      </div>
                    </div>

                    {/* Progress Summary */}
                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 flex items-center gap-3">
                      <div className="bg-indigo-100 p-2 rounded-lg text-indigo-800 shrink-0">
                        <TrendingUp size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Avg Progress</p>
                        <p className="text-base font-bold text-indigo-800 mt-0.5">
                          {metrics.averageScore > 0 ? `${metrics.averageScore}%` : 'No scores'}
                        </p>
                        <p className="text-[9px] text-gray-400 truncate mt-0.5">
                          {metrics.latestAssessment 
                            ? `Latest: ${metrics.latestAssessment.score}%` 
                            : 'No assessments'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-green-50 rounded-xl p-3 text-center">
                      <p className="text-sm font-bold text-green-700">{formatCurrency(totalPaid)}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">Total Paid</p>
                    </div>
                    <div className="bg-orange-50 rounded-xl p-3 text-center">
                      <p className="text-sm font-bold text-orange-700">{formatCurrency(remainingBalance)}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">Balance</p>
                    </div>
                    <div className={`rounded-xl p-3 text-center ${
                      isFull ? 'bg-green-50' : isPartial ? 'bg-orange-50' : 'bg-gray-50'
                    }`}>
                      <p className={`text-xs font-bold leading-tight truncate mt-0.5 ${
                        isFull ? 'text-green-600' : isPartial ? 'text-orange-600' : 'text-gray-400'
                      }`}>
                        {isFull ? 'Paid' : isPartial ? 'Partial' : 'Unpaid'}
                      </p>
                      <p className="text-[9px] text-gray-555 mt-1 uppercase font-bold tracking-wider">
                        Status
                      </p>
                    </div>
                  </div>

                  {/* Schedule Info */}
                  <div className="bg-gray-50 rounded-xl p-3 mb-4 flex gap-2.5 items-start border border-gray-100/70">
                    <Calendar size={15} className="text-green-700 mt-0.5 shrink-0" />
                    <div className="text-xs text-gray-650 min-w-0">
                      <span className="block font-bold uppercase tracking-wider text-[9px] text-gray-400">Tutoring Schedule</span>
                      <div className="font-semibold text-gray-700 mt-0.5 space-y-0.5 leading-relaxed">
                        {renderSchedule(tutee.schedule)}
                      </div>
                    </div>
                  </div>
                </div>

                <Link
                  to={`/tutees/${tutee.id}`}
                  className="w-full flex items-center justify-center bg-green-700 hover:bg-green-800 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors shadow-sm shadow-green-700/10 mt-1"
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
