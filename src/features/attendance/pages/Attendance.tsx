import { useState, useEffect } from 'react';
import { useTutees } from '@/features/tutees/hooks/useTutees';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { logActivity } from '@/shared/utils/auditLogger';
import { dayPaymentService } from '@/features/attendance/services/dayPaymentService';
import { PaymentRecord } from '@/features/attendance/types/dayPayment';
import { Tutee } from '@/features/tutees/types/tutee';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Users,
  Filter,
  User,
  Calendar,
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from 'date-fns';
import { toast } from 'sonner';
import { db, auth } from '@/shared/lib/firebase/config';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

type AttendanceStatus = 'present' | 'absent' | 'none';

interface DayAttendance {
  date: string;
  status: AttendanceStatus;
}

// Map dayPayment status to attendance status
const toAttendance = (status: string): AttendanceStatus => {
  if (status === 'paid') return 'present';
  if (status === 'partial') return 'absent';
  return 'none';
};

const fromAttendance = (current: AttendanceStatus): string => {
  if (current === 'present') return 'partial'; // paid -> partial means toggling to absent
  if (current === 'absent') return 'unpaid';   // partial -> unpaid means back to none
  return 'paid';                                // none -> paid means present
};

export const Attendance = () => {
  const { tutees, isLoading } = useTutees();
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedTuteeId, setSelectedTuteeId] = useState<string>('');
  const [records, setRecords] = useState<Record<string, PaymentRecord | null>>({});
  const [loadingRecords, setLoadingRecords] = useState<Record<string, boolean>>({});
  const [togglingDay, setTogglingDay] = useState<string | null>(null);

  const monthKey = format(selectedMonth, 'yyyy-MM');
  const filteredTutees = selectedTuteeId
    ? tutees.filter(t => t.id === selectedTuteeId)
    : tutees;

  // Load attendance records for all visible tutees in real-time when month changes
  useEffect(() => {
    if (tutees.length === 0) return;

    const userId = auth.currentUser?.uid;
    if (!userId) return;

    setLoadingRecords(
      tutees.reduce((acc, t) => ({ ...acc, [t.id]: true }), {})
    );

    const recordsRef = collection(db, 'users', userId, 'paymentRecords');
    const q = query(recordsRef, where('month', '==', monthKey));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const results: Record<string, PaymentRecord | null> = {};

      // Default all to null first
      tutees.forEach(t => {
        results[`${t.id}_${monthKey}`] = null;
      });

      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        const tuteeId = data.tuteeId;
        results[`${tuteeId}_${monthKey}`] = {
          id: docSnap.id,
          ...data,
          lastUpdated: data.lastUpdated?.toDate?.()?.toISOString() || new Date().toISOString(),
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        } as PaymentRecord;
      });

      setRecords(results);
      setLoadingRecords({});
    }, (error) => {
      console.error('Error listening to all records:', error);
      toast.error('Failed to load attendance records');
      setLoadingRecords({});
    });

    return () => unsubscribe();
  }, [tutees, monthKey]);

  const getScheduledDays = (tutee: Tutee): DayAttendance[] => {
    const record = records[`${tutee.id}_${monthKey}`];
    if (!record) {
      // Compute from schedule if no record yet
      const monthStart = startOfMonth(selectedMonth);
      const monthEnd = endOfMonth(selectedMonth);
      const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
      const scheduleDays = Array.isArray(tutee.schedule)
        ? tutee.schedule.map(s => s.day)
        : [];

      return allDays
        .filter(day => scheduleDays.includes(format(day, 'EEEE')))
        .map(day => ({
          date: format(day, 'yyyy-MM-dd'),
          status: 'none' as AttendanceStatus,
        }));
    }

    return record.dayPayments.map(dp => ({
      date: dp.date,
      status: toAttendance(dp.status),
    }));
  };

  const handleToggleDay = async (tutee: Tutee, date: string, currentStatus: AttendanceStatus) => {
    const key = `${tutee.id}_${date}`;
    if (togglingDay === key) return;
    setTogglingDay(key);

    try {
      await dayPaymentService.toggleDayStatus(tutee.id, monthKey, date);
      const label = currentStatus === 'none' ? 'Marked Present ✓' : currentStatus === 'present' ? 'Marked Absent ✗' : 'Status cleared';
      toast.success(label);

      if (user) {
        const isNew = currentStatus === 'none';
        const newStatusStr = currentStatus === 'none' ? 'Present' : currentStatus === 'present' ? 'Absent' : 'None';
        await logActivity(
          user.id,
          user.name,
          user.role,
          isNew ? 'Attendance Recorded' : 'Attendance Updated',
          'Attendance',
          `Marked student ${tutee.firstName} ${tutee.surname} on ${date} as ${newStatusStr}`
        );
      }
    } catch (error) {
      console.error('Error updating attendance:', error);
      toast.error('Failed to update attendance');
    } finally {
      setTogglingDay(null);
    }
  };

  const getPresentCount = (tutee: Tutee) => {
    const days = getScheduledDays(tutee);
    return days.filter(d => d.status === 'present').length;
  };
  const getAbsentCount = (tutee: Tutee) => {
    const days = getScheduledDays(tutee);
    return days.filter(d => d.status === 'absent').length;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-green-700 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 font-medium">Loading students...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
          <CheckCircle2 className="text-green-700" size={36} />
          Attendance
        </h1>
        <p className="text-gray-500 mt-2">Mark Present or Absent for each student's scheduled sessions</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-sm">
        {/* Month Navigator */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedMonth(prev => subMonths(prev, 1))}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors border border-gray-200 text-gray-600"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-center min-w-[140px]">
            <p className="font-bold text-gray-900 text-base">{format(selectedMonth, 'MMMM yyyy')}</p>
          </div>
          <button
            onClick={() => setSelectedMonth(prev => addMonths(prev, 1))}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors border border-gray-200 text-gray-600"
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => setSelectedMonth(new Date())}
            className="px-3 py-1.5 text-xs font-semibold bg-green-700 text-white rounded-lg hover:bg-green-800 transition-colors"
          >
            This Month
          </button>
        </div>

        {/* Student Filter */}
        <div className="flex items-center gap-2 flex-1 max-w-xs">
          <Filter size={16} className="text-gray-400 flex-shrink-0" />
          <select
            value={selectedTuteeId}
            onChange={e => setSelectedTuteeId(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">All Students</option>
            {tutees.map(t => (
              <option key={t.id} value={t.id}>{t.firstName} {t.surname}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs font-semibold text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-green-100 border-2 border-green-400 flex items-center justify-center">
            <CheckCircle2 size={14} className="text-green-600" />
          </div>
          <span>Present — click to mark absent</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-100 border-2 border-red-400 flex items-center justify-center">
            <XCircle size={14} className="text-red-500" />
          </div>
          <span>Absent — click to clear</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
            <Clock size={14} className="text-gray-400" />
          </div>
          <span>Not yet marked — click to mark present</span>
        </div>
      </div>

      {/* Tutee Attendance Cards */}
      {filteredTutees.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl border-2 border-dashed border-gray-300 p-16 text-center">
          <Users className="mx-auto text-gray-300 mb-4" size={64} />
          <p className="text-gray-500 text-lg font-medium">No students found</p>
          <p className="text-gray-400 text-sm mt-2">Add students first to track attendance</p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredTutees.map(tutee => {
            const days = getScheduledDays(tutee);
            const presentCount = days.filter(d => d.status === 'present').length;
            const absentCount = days.filter(d => d.status === 'absent').length;
            const totalDays = days.length;
            const isLoadingThis = loadingRecords[tutee.id];

            return (
              <div
                key={tutee.id}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
              >
                {/* Student Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-gray-100 bg-gray-50/60">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center shadow-md shadow-green-700/20 text-white font-bold text-sm">
                      {tutee.firstName.slice(0, 1)}{tutee.surname.slice(0, 1)}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-base">{tutee.firstName} {tutee.surname}</h3>
                      <p className="text-xs text-gray-500">
                        {(tutee.subjects?.length ? tutee.subjects : [tutee.subject]).join(', ')}
                        {' · '}
                        {Array.isArray(tutee.schedule) && tutee.schedule.length > 0
                          ? tutee.schedule.map(s => s.day.slice(0, 3)).join(', ')
                          : 'No schedule'}
                      </p>
                    </div>
                  </div>

                  {/* Summary Badges */}
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-xl px-3 py-1.5">
                      <CheckCircle2 size={14} className="text-green-600" />
                      <span className="text-xs font-bold text-green-700">{presentCount} Present</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-3 py-1.5">
                      <XCircle size={14} className="text-red-500" />
                      <span className="text-xs font-bold text-red-600">{absentCount} Absent</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-gray-100 border border-gray-200 rounded-xl px-3 py-1.5">
                      <Calendar size={14} className="text-gray-500" />
                      <span className="text-xs font-bold text-gray-600">{totalDays} Sessions</span>
                    </div>
                  </div>
                </div>

                {/* Day Grid */}
                <div className="px-6 py-5">
                  {isLoadingThis ? (
                    <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
                      <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading attendance...</span>
                    </div>
                  ) : days.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      <Clock className="mx-auto mb-2" size={32} />
                      <p>No scheduled sessions this month</p>
                      <p className="text-xs mt-1">Set a schedule for this student to track attendance</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-10 gap-2">
                      {days.map(day => {
                        const dayKey = `${tutee.id}_${day.date}`;
                        const isToggling = togglingDay === dayKey;

                        const baseDate = parseISO(day.date);
                        const isToday = format(baseDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

                        let cardClass = 'border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300 text-gray-500';
                        let statusIcon = <Clock size={14} className="text-gray-400" />;
                        let statusLabel = 'Unmarked';

                        if (day.status === 'present') {
                          cardClass = 'border-green-300 bg-green-50 hover:bg-green-100 text-green-800';
                          statusIcon = <CheckCircle2 size={14} className="text-green-600" />;
                          statusLabel = 'Present';
                        } else if (day.status === 'absent') {
                          cardClass = 'border-red-300 bg-red-50 hover:bg-red-100 text-red-700';
                          statusIcon = <XCircle size={14} className="text-red-500" />;
                          statusLabel = 'Absent';
                        }

                        return (
                          <button
                            key={day.date}
                            onClick={() => handleToggleDay(tutee, day.date, day.status)}
                            disabled={isToggling}
                            className={`relative flex flex-col items-center justify-center gap-1 p-2.5 rounded-xl border-2 transition-all cursor-pointer active:scale-95 ${cardClass} ${isToday ? 'ring-2 ring-green-500 ring-offset-1' : ''} ${isToggling ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={`${format(baseDate, 'EEEE, MMM dd')} — Click to mark ${day.status === 'none' ? 'Present' : day.status === 'present' ? 'Absent' : 'Unmarked'}`}
                          >
                            {isToggling ? (
                              <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                              statusIcon
                            )}
                            <span className="text-[10px] font-bold leading-none">{format(baseDate, 'EEE')}</span>
                            <span className="text-[9px] leading-none opacity-75">{format(baseDate, 'MMM d')}</span>
                            <span className={`text-[8px] font-extrabold uppercase tracking-wider leading-none mt-0.5 ${
                              day.status === 'present' ? 'text-green-700' : day.status === 'absent' ? 'text-red-600' : 'text-gray-400'
                            }`}>{statusLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Progress Bar */}
                {days.length > 0 && (
                  <div className="px-6 pb-4">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Attendance Rate</span>
                      <span className="font-bold text-gray-700">
                        {totalDays > 0 ? Math.round((presentCount / totalDays) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-500"
                        style={{ width: `${totalDays > 0 ? (presentCount / totalDays) * 100 : 0}%` }}
                      />
                    </div>
                    {absentCount > 0 && (
                      <div
                        className="h-full bg-gradient-to-r from-red-400 to-red-500 rounded-full transition-all duration-500"
                        style={{ width: `${totalDays > 0 ? (absentCount / totalDays) * 100 : 0}%`, marginTop: '-8px', height: '8px' }}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
