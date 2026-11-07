import { useState, useEffect, useMemo } from 'react';
import { useTutees } from '@/features/tutees/hooks/useTutees';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Tutee, NormalizedScheduleItem, getTuteeScheduleForYear, normalizeScheduleItems, isTuteeArchivedForYear } from '@/features/tutees/types/tutee';
import { useSchoolYear } from '@/shared/contexts/SchoolYearContext';
import { Calendar, ChevronLeft, ChevronRight, Filter, AlertTriangle, Users } from 'lucide-react';
import {
  findDayConflicts,
  getSessionConflict,
  type ScheduleConflict,
  type ScheduleEntry,
} from '@/features/schedule/utils/scheduleConflicts';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { getSchoolYearRange, isInSchoolYear } from '@/shared/utils/schoolYear';
import { formatTime12h } from '@/shared/utils/formatDate';
import { LoadingScreen } from '@/shared/components/LoadingScreen';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase/config';

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

export const Schedule = () => {
  const { tutees, isLoading } = useTutees();
  const { user } = useAuth();
  const { selectedYear, startMonth } = useSchoolYear();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [chargedTuteeMonths, setChargedTuteeMonths] = useState<Set<string>>(new Set());

  // Keep the timetable inside the selected school year. Switching years (or
  // changing the start month) snaps back to the start of that school year.
  useEffect(() => {
    setCurrentDate((prev) => {
      if (isInSchoolYear(prev, selectedYear, startMonth)) return prev;
      return getSchoolYearRange(selectedYear, startMonth).start;
    });
  }, [selectedYear, startMonth]);

  // Listen to payment records to know which months each tutee has been charged for
  useEffect(() => {
    const tutorId = user?.role === 'parent' ? user.createdByTutorId : user?.id;
    if (!tutorId) return;

    const recordsRef = collection(db, 'users', tutorId, 'paymentRecords');
    const unsubscribe = onSnapshot(recordsRef, (snapshot) => {
      const set = new Set<string>();
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.tuteeId && data.month) {
          set.add(`${data.tuteeId}_${data.month}`);
        }
      });
      setChargedTuteeMonths(set);
    });

    return () => unsubscribe();
  }, [user?.id, user?.role, user?.createdByTutorId]);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 }); // Sunday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  // Filter tutees based on selected student
  const filteredTutees = selectedStudent
    ? tutees.filter(t => t.id === selectedStudent)
    : tutees;

  let earliestHour = 7;
  let latestHour = 21;
  tutees.forEach(tutee => {
    normalizeScheduleItems(getTuteeScheduleForYear(tutee, selectedYear)).forEach(slot => {
      const start = toMinutes(slot.startTime);
      let end = toMinutes(slot.endTime);
      if (end <= start) end += 24 * 60;
      earliestHour = Math.min(earliestHour, Math.max(0, Math.floor(start / 60)));
      latestHour = Math.max(latestHour, Math.min(24, Math.ceil(end / 60)));
    });
  });

  const timeSlots = Array.from({ length: Math.max(1, latestHour - earliestHour) }, (_, i) => {
    const hour = earliestHour + i;
    return `${hour.toString().padStart(2, '0')}:00`;
  });

  // Detect conflicts from every active tutee's weekly timetable, independently
  // of the billing filter so an uncharged session can't silently overlap.
  const conflictsByDay = useMemo(() => {
    const entriesByDay: Record<string, ScheduleEntry[]> = {};

    tutees.forEach((tutee) => {
      if (isTuteeArchivedForYear(tutee, selectedYear)) return;
      normalizeScheduleItems(getTuteeScheduleForYear(tutee, selectedYear)).forEach((slot) => {
        if (!entriesByDay[slot.day]) entriesByDay[slot.day] = [];
        entriesByDay[slot.day].push({ tutee, slot });
      });
    });

    const result: Record<string, ScheduleConflict[]> = {};
    Object.entries(entriesByDay).forEach(([day, entries]) => {
      result[day] = findDayConflicts(entries);
    });
    return result;
  }, [tutees, selectedYear]);

  const getConflictsForDay = (dayName: string) => conflictsByDay[dayName] ?? [];

  const getSessionConflictForDay = (
    dayName: string,
    tutee: Tutee,
    schedule: NormalizedScheduleItem
  ) => getSessionConflict(getConflictsForDay(dayName), tutee.id, schedule);

  // Get schedule for a specific day and date (only include if charged for that month)
  const getScheduleForDay = (dayName: string, date: Date) => {
    // Never paint a school year's timetable onto dates from another school year.
    if (!isInSchoolYear(date, selectedYear, startMonth)) {
      return [];
    }

    const monthKey = format(date, 'yyyy-MM');
    const schedules: Array<{ tutee: Tutee; schedule: NormalizedScheduleItem }> = [];

    filteredTutees.forEach(tutee => {
      // If tutee wasn't added to this month in payments, don't show on schedule
      if (!chargedTuteeMonths.has(`${tutee.id}_${monthKey}`)) {
        return;
      }

      normalizeScheduleItems(getTuteeScheduleForYear(tutee, selectedYear))
        .filter(slot => slot.day === dayName)
        .forEach(schedule => schedules.push({ tutee, schedule }));
    });

    return schedules;
  };

  const canNavigateTo = (date: Date) => isInSchoolYear(date, selectedYear, startMonth);

  // Navigate within the selected school year only
  const previousWeek = () => {
    const previous = addDays(currentDate, -7);
    if (canNavigateTo(previous)) setCurrentDate(previous);
  };

  const nextWeek = () => {
    const next = addDays(currentDate, 7);
    if (canNavigateTo(next)) setCurrentDate(next);
  };

  const today = () => {
    const now = new Date();
    setCurrentDate(canNavigateTo(now) ? now : getSchoolYearRange(selectedYear, startMonth).start);
  };

  const canGoPrevious = canNavigateTo(addDays(currentDate, -7));
  const canGoNext = canNavigateTo(addDays(currentDate, 7));

  const visibleDayNames =
    viewMode === 'week' ? daysOfWeek : [format(currentDate, 'EEEE')];
  const visibleTuteeIds = new Set(filteredTutees.map((tutee) => tutee.id));
  const visibleConflicts = visibleDayNames
    .flatMap((day) => getConflictsForDay(day))
    .filter(
      (conflict) =>
        visibleTuteeIds.has(conflict.firstTuteeId) ||
        visibleTuteeIds.has(conflict.secondTuteeId)
    );
  const visibleBlockingConflicts = visibleConflicts.filter(
    (conflict) => conflict.severity === 'blocking'
  );
  const visibleWarningConflicts = visibleConflicts.filter(
    (conflict) => conflict.severity === 'warning'
  );

  if (isLoading) {
    return <LoadingScreen message="Loading schedule..." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Schedule & Timetable</h1>
        <p className="text-gray-600 mt-1 text-sm sm:text-base">View and manage your tutoring schedule</p>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="flex flex-col gap-3">
          {/* Row 1: Navigation + date */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={previousWeek}
              disabled={!canGoPrevious}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={today}
              className="px-3 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 text-sm font-semibold"
            >
              Today
            </button>
            <button
              onClick={nextWeek}
              disabled={!canGoNext}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <ChevronRight size={20} />
            </button>
            <span className="font-semibold text-gray-900 text-sm">
              {format(weekStart, 'MMM dd')} - {format(addDays(weekStart, 6), 'MMM dd, yyyy')}
            </span>
          </div>

          {/* Row 2: Filter + View toggle */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[160px]">
              <Filter size={16} className="text-gray-400 shrink-0" />
              <select
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm w-full"
              >
                <option value="">All Students</option>
                {tutees.map(tutee => (
                  <option key={tutee.id} value={tutee.id}>
                    {tutee.firstName} {tutee.surname}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex bg-gray-100 rounded-lg p-1 shrink-0">
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1.5 rounded-md transition-colors text-sm ${
                  viewMode === 'week'
                    ? 'bg-white text-green-700 shadow-sm font-semibold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setViewMode('day')}
                className={`px-3 py-1.5 rounded-md transition-colors text-sm ${
                  viewMode === 'day'
                    ? 'bg-white text-green-700 shadow-sm font-semibold'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Day
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Conflict summary + legend */}
      <div className="flex flex-col gap-2">
        {visibleBlockingConflicts.length > 0 && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <div className="min-w-0 text-xs text-red-700">
              <p className="text-sm font-bold text-red-800">
                {visibleBlockingConflicts.length} different-grade conflict
                {visibleBlockingConflicts.length === 1 ? '' : 's'}
              </p>
              <ul className="mt-1 space-y-0.5">
                {visibleBlockingConflicts.map((conflict, index) => (
                  <li key={`${conflict.firstTuteeId}-${conflict.secondTuteeId}-${index}`}>
                    {conflict.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {visibleWarningConflicts.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="min-w-0 text-xs text-amber-700">
              <p className="text-sm font-bold text-amber-800">
                {visibleWarningConflicts.length} same-grade overlap
                {visibleWarningConflicts.length === 1 ? '' : 's'}
              </p>
              <ul className="mt-1 space-y-0.5">
                {visibleWarningConflicts.map((conflict, index) => (
                  <li key={`${conflict.firstTuteeId}-${conflict.secondTuteeId}-${index}`}>
                    {conflict.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            Different grade conflict
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            Same grade / group session
          </span>
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === 'week' ? (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Header */}
              <div className="grid grid-cols-8 border-b bg-gray-50">
                <div className="p-3 text-sm font-semibold text-gray-600">Time</div>
                {daysOfWeek.map((day, index) => {
                  const date = weekDays[index];
                  const isToday = isSameDay(date, new Date());
                  const isWeekend = day === 'Sunday' || day === 'Saturday';
                  const dayConflicts = getConflictsForDay(day).filter(
                    (conflict) =>
                      visibleTuteeIds.has(conflict.firstTuteeId) ||
                      visibleTuteeIds.has(conflict.secondTuteeId)
                  );
                  const hasBlocking = dayConflicts.some((conflict) => conflict.severity === 'blocking');
                  return (
                    <div
                      key={day}
                      className={`p-3 text-center ${
                        isToday 
                          ? 'bg-green-50' 
                          : isWeekend 
                            ? 'bg-red-50/40' 
                            : ''
                      }`}
                    >
                      <div className={`text-sm font-semibold ${isWeekend ? 'text-red-600' : 'text-gray-900'}`}>{day.slice(0, 3)}</div>
                      <div className={`text-xs ${
                        isToday 
                          ? (isWeekend ? 'text-red-700 font-semibold' : 'text-green-700 font-semibold') 
                          : (isWeekend ? 'text-red-400 font-semibold' : 'text-gray-500')
                      }`}>
                        {format(date, 'MMM dd')}
                      </div>
                      {dayConflicts.length > 0 && (
                        <div
                          className={`mt-1 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
                            hasBlocking
                              ? 'border-red-200 bg-red-50 text-red-700'
                              : 'border-amber-200 bg-amber-50 text-amber-700'
                          }`}
                        >
                          {hasBlocking ? <AlertTriangle size={10} /> : <Users size={10} />}
                          {dayConflicts.length}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Time slots */}
              <div className="divide-y">
                {timeSlots.map(time => (
                  <div key={time} className="grid grid-cols-8">
                    <div className="p-3 text-sm text-gray-600 border-r bg-gray-50 flex items-center">
                      {formatTime12h(time)}
                    </div>
                    {daysOfWeek.map((day, index) => {
                      const date = weekDays[index];
                      const isToday = isSameDay(date, new Date());
                      const isWeekend = day === 'Sunday' || day === 'Saturday';
                      const schedules = getScheduleForDay(day, date);
                      const sessionsInSlot = schedules.filter(({ schedule }) => {
                        const slotHour = parseInt(time.split(':')[0]);
                        const startHour = Math.floor(toMinutes(schedule.startTime) / 60);
                        let endHour = Math.ceil(toMinutes(schedule.endTime) / 60);
                        if (endHour <= startHour) endHour += 24;
                        return slotHour >= startHour && slotHour < endHour;
                      });

                      return (
                        <div
                          key={`${day}-${time}`}
                          className={`p-2 border-r min-h-[60px] ${
                            isToday 
                              ? 'bg-green-50/20' 
                              : isWeekend 
                                ? 'bg-red-50/10' 
                                : ''
                          }`}
                        >
                          {sessionsInSlot.map(({ tutee, schedule }, index) => {
                            const sessionConflict = getSessionConflictForDay(day, tutee, schedule);
                            return (
                              <div
                                key={`${tutee.id}-${schedule.startTime}-${schedule.endTime}-${index}`}
                                className={`border rounded px-2 py-1 mb-1 text-xs ${
                                  sessionConflict?.severity === 'blocking'
                                    ? 'bg-red-50 border-red-300 text-red-950 shadow-sm ring-2 ring-red-300'
                                    : sessionConflict
                                      ? 'bg-amber-50 border-amber-300 text-amber-950 ring-2 ring-amber-200'
                                      : isWeekend
                                        ? 'bg-red-50 border-red-200 text-red-950 shadow-sm'
                                        : 'bg-green-100 border-green-300 text-green-950'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <div className={`font-semibold ${sessionConflict?.severity === 'blocking' ? 'text-red-900' : isWeekend ? 'text-red-900' : 'text-green-900'}`}>
                                    {tutee.firstName} {tutee.surname}
                                  </div>
                                  {sessionConflict && (
                                    <span
                                      className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                                        sessionConflict.severity === 'blocking'
                                          ? 'border-red-300 bg-red-100 text-red-700'
                                          : 'border-amber-300 bg-amber-100 text-amber-700'
                                      }`}
                                    >
                                      {sessionConflict.severity === 'blocking' ? 'Conflict' : 'Group'}
                                    </span>
                                  )}
                                </div>
                                <div className={isWeekend ? 'text-red-700 font-medium' : 'text-green-700'}>{tutee.subject}</div>
                                <div className={`${isWeekend ? 'text-red-600' : 'text-green-600'} text-[10px] mt-0.5`}>
                                  {formatTime12h(schedule.startTime)} - {formatTime12h(schedule.endTime)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Day View - List of sessions for current day
        <div className="bg-white rounded-lg border p-6">
          {(() => {
            const dayName = format(currentDate, 'EEEE');
            const isWeekend = dayName === 'Sunday' || dayName === 'Saturday';
            const schedules = getScheduleForDay(dayName, currentDate);

            return (
              <>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Calendar size={20} className={isWeekend ? 'text-red-600' : 'text-green-700'} />
                  <span className={isWeekend ? 'text-red-950 font-bold' : ''}>
                    {format(currentDate, 'EEEE, MMMM dd, yyyy')}
                  </span>
                </h2>

                {schedules.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No sessions scheduled for this day
                  </p>
                ) : (
                  <div className="space-y-3">
                    {schedules
                      .sort((a, b) => a.schedule.startTime.localeCompare(b.schedule.startTime))
                      .map(({ tutee, schedule }, index) => {
                        const sessionConflict = getSessionConflictForDay(dayName, tutee, schedule);
                        return (
                          <div
                            key={`${tutee.id}-${schedule.startTime}-${schedule.endTime}-${index}`}
                            className={`flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50/80 transition-colors ${
                              sessionConflict?.severity === 'blocking'
                                ? 'border-red-300 bg-red-50/40 ring-2 ring-red-200'
                                : sessionConflict
                                  ? 'border-amber-300 bg-amber-50/40 ring-2 ring-amber-200'
                                  : isWeekend
                                    ? 'border-red-150 bg-red-50/10'
                                    : ''
                            }`}
                          >
                            <div className="flex-shrink-0 w-24 text-center">
                              <div className={`text-sm font-semibold ${isWeekend ? 'text-red-700' : 'text-gray-900'}`}>
                                {formatTime12h(schedule.startTime)}
                              </div>
                              <div className="text-xs text-gray-500">{formatTime12h(schedule.endTime)}</div>
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900">
                                {tutee.firstName} {tutee.surname}
                              </h3>
                              <p className="text-sm text-gray-600">{tutee.subject}</p>
                              {tutee.gradeLevel && (
                                <p className="text-xs text-gray-500">{tutee.gradeLevel}</p>
                              )}
                            </div>
                            <div className="text-right">
                              {sessionConflict && (
                                <span className={`mb-1 inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold rounded-full border ${
                                  sessionConflict.severity === 'blocking'
                                    ? 'bg-red-100 text-red-700 border-red-300'
                                    : 'bg-amber-100 text-amber-700 border-amber-300'
                                }`}>
                                  {sessionConflict.severity === 'blocking' ? (
                                    <AlertTriangle size={12} />
                                  ) : (
                                    <Users size={12} />
                                  )}
                                  {sessionConflict.severity === 'blocking' ? 'Conflict' : 'Group'}
                                </span>
                              )}
                              <div>
                                <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full border ${
                                  isWeekend 
                                    ? 'bg-red-50 text-red-700 border-red-200' 
                                    : 'bg-green-50 text-green-700 border-green-200'
                                }`}>
                                  Scheduled
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};
