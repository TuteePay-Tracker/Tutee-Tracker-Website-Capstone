import { useState, useEffect } from 'react';
import { useTutees } from '@/features/tutees/hooks/useTutees';
import { Tutee, ScheduleItem } from '@/features/tutees/types/tutee';
import { Calendar, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';

export const Schedule = () => {
  const { tutees, isLoading } = useTutees();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Schedule & Timetable</h1>
          <p className="text-gray-600 mt-1">View and manage your tutoring schedule</p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded-lg border">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={previousWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={today}
              className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800"
            >
              Today
            </button>
            <button
              onClick={nextWeek}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronRight size={20} />
            </button>
            <span className="font-semibold text-gray-900 ml-4">
              {format(weekStart, 'MMM dd')} - {format(addDays(weekStart, 6), 'MMM dd, yyyy')}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-gray-400" />
              <select
                value={selectedStudent}
                onChange={(e) => setSelectedStudent(e.target.value)}
                className="px-4 py-2 border rounded-lg"
              >
                <option value="">All Students</option>
                {tutees.map(tutee => (
                  <option key={tutee.id} value={tutee.id}>
                    {tutee.firstName} {tutee.surname}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('week')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  viewMode === 'week'
                    ? 'bg-white text-green-700 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => setViewMode('day')}
                className={`px-4 py-2 rounded-md transition-colors ${
                  viewMode === 'day'
                    ? 'bg-white text-green-700 shadow-sm'
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
                  return (
                    <div
                      key={day}
                      className={`p-3 text-center ${isToday ? 'bg-green-50' : ''}`}
                    >
                      <div className="text-sm font-semibold text-gray-900">{day.slice(0, 3)}</div>
                      <div className={`text-xs ${isToday ? 'text-green-700 font-semibold' : 'text-gray-500'}`}>
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
                    <div className="p-3 text-sm text-gray-600 border-r bg-gray-50">
                      {time}
                    </div>
                    {daysOfWeek.map((day, index) => {
                      const date = weekDays[index];
                      const isToday = isSameDay(date, new Date());
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
                            isToday ? 'bg-green-50/30' : ''
                          }`}
                        >
                          {sessionsInSlot.map(({ tutee, schedule }) => (
                            <div
                              key={tutee.id}
                              className="bg-green-100 border border-green-300 rounded px-2 py-1 mb-1 text-xs"
                            >
                              <div className="font-semibold text-green-900">
                                {tutee.firstName} {tutee.surname}
                              </div>
                              <div className="text-green-700">{tutee.subject}</div>
                              <div className="text-green-600 text-xs">
                                {schedule.startTime} - {schedule.endTime}
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
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Calendar size={20} className="text-green-700" />
            {format(currentDate, 'EEEE, MMMM dd, yyyy')}
          </h2>

          {(() => {
            const dayName = format(currentDate, 'EEEE');
            const schedules = getScheduleForDay(dayName);

            if (schedules.length === 0) {
              return (
                <p className="text-gray-500 text-center py-8">
                  No sessions scheduled for this day
                </p>
              );
            }

            return (
              <div className="space-y-3">
                {schedules
                  .sort((a, b) => a.schedule.startTime.localeCompare(b.schedule.startTime))
                  .map(({ tutee, schedule }) => (
                    <div
                      key={tutee.id}
                      className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex-shrink-0 w-20 text-center">
                        <div className="text-sm font-semibold text-gray-900">
                          {schedule.startTime}
                        </div>
                        <div className="text-xs text-gray-500">{schedule.endTime}</div>
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
                        <span className="inline-block px-3 py-1 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-200">
                          Scheduled
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
