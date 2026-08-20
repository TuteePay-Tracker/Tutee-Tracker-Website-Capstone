import { useState, useEffect } from 'react';
import { useTutees } from '@/features/tutees/hooks/useTutees';
import { Tutee, ScheduleItem } from '@/features/tutees/types/tutee';
import { Calendar, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { formatTime12h } from '@/shared/utils/formatDate';

export const Schedule = () => {
  const { tutees, isLoading } = useTutees();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 }); // Sunday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const timeSlots = Array.from({ length: 14 }, (_, i) => {
    const hour = i + 7; // Start from 7 AM
    return `${hour.toString().padStart(2, '0')}:00`;
  });

  // Filter tutees based on selected student
  const filteredTutees = selectedStudent
    ? tutees.filter(t => t.id === selectedStudent)
    : tutees;

  // Get schedule for a specific day
  const getScheduleForDay = (dayName: string) => {
    const schedules: Array<{ tutee: Tutee; schedule: ScheduleItem }> = [];

    filteredTutees.forEach(tutee => {
      if (Array.isArray(tutee.schedule)) {
        const daySchedule = tutee.schedule.find(s => s.day === dayName);
        if (daySchedule && 'startTime' in daySchedule && 'endTime' in daySchedule) {
          schedules.push({ tutee, schedule: daySchedule });
        }
      }
    });

    return schedules;
  };

  // Navigate week
  const previousWeek = () => {
    setCurrentDate(addDays(currentDate, -7));
  };

  const nextWeek = () => {
    setCurrentDate(addDays(currentDate, 7));
  };

  const today = () => {
    setCurrentDate(new Date());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Loading schedule...</div>
      </div>
    );
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
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
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
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
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
                      const schedules = getScheduleForDay(day);
                      const sessionsInSlot = schedules.filter(({ schedule }) => {
                        const slotHour = parseInt(time.split(':')[0]);
                        const startHour = parseInt(schedule.startTime.split(':')[0]);
                        const endHour = parseInt(schedule.endTime.split(':')[0]);
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
                          {sessionsInSlot.map(({ tutee, schedule }) => (
                            <div
                              key={tutee.id}
                              className={`border rounded px-2 py-1 mb-1 text-xs ${
                                isWeekend
                                  ? 'bg-red-50 border-red-200 text-red-950 shadow-sm'
                                  : 'bg-green-100 border-green-300 text-green-950'
                              }`}
                            >
                              <div className={`font-semibold ${isWeekend ? 'text-red-900' : 'text-green-900'}`}>
                                {tutee.firstName} {tutee.surname}
                              </div>
                              <div className={isWeekend ? 'text-red-700 font-medium' : 'text-green-700'}>{tutee.subject}</div>
                              <div className={`${isWeekend ? 'text-red-600' : 'text-green-600'} text-[10px] mt-0.5`}>
                                {formatTime12h(schedule.startTime)} - {formatTime12h(schedule.endTime)}
                              </div>
                            </div>
                          ))}
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
            const schedules = getScheduleForDay(dayName);

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
                      .map(({ tutee, schedule }) => (
                        <div
                          key={tutee.id}
                          className={`flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50/80 transition-colors ${
                            isWeekend ? 'border-red-150 bg-red-50/10' : ''
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
                            <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full border ${
                              isWeekend 
                                ? 'bg-red-50 text-red-700 border-red-200' 
                                : 'bg-green-50 text-green-700 border-green-200'
                            }`}>
                              Scheduled
                            </span>
                          </div>
                        </div>
                      ))}
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
