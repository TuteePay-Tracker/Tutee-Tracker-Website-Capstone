import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { CalendarClock, X } from 'lucide-react';
import { toast } from 'sonner';
import { makeUpService } from '@/features/attendance/services/makeUpService';
import type { MakeUpCredit } from '@/features/attendance/types/makeUpCredit';

interface MakeUpScheduleModalProps {
  credit: MakeUpCredit;
  onClose: () => void;
  onScheduled?: () => void;
}

const DURATION_OPTIONS = [30, 45, 60, 90, 120];

const toMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const toTime = (minutes: number): string => {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

export const MakeUpScheduleModal = ({
  credit,
  onClose,
  onScheduled,
}: MakeUpScheduleModalProps) => {
  const [scheduledDate, setScheduledDate] = useState(
    credit.scheduledDate || format(new Date(), 'yyyy-MM-dd')
  );
  const [startTime, setStartTime] = useState(credit.startTime || '09:00');
  const [durationMinutes, setDurationMinutes] = useState(
    DURATION_OPTIONS.includes(credit.durationMinutes) ? credit.durationMinutes : 60
  );
  const [saving, setSaving] = useState(false);

  const endTime = useMemo(
    () => toTime(toMinutes(startTime) + durationMinutes),
    [startTime, durationMinutes]
  );

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await makeUpService.scheduleCredit({
        creditId: credit.id,
        scheduledDate,
        startTime,
        endTime,
        durationMinutes,
      });
      toast.success('Make-up class scheduled');
      onScheduled?.();
      onClose();
    } catch (error: any) {
      console.error('Error scheduling make-up class:', error);
      toast.error(error?.message || 'Failed to schedule make-up class');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
              <CalendarClock size={18} className="text-amber-600" />
              Schedule Make-Up Class
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {credit.tuteeName} · credit from {credit.sourceDate}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700">Date</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(event) => setScheduledDate(event.target.value)}
              required
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="mt-1 text-[11px] text-gray-400">
              Billing for this month must exist in Billing first.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">Start time</label>
              <input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                required
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">Duration</label>
              <select
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(Number(event.target.value))}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {DURATION_OPTIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} minutes
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600">
            Session: <span className="font-bold">{startTime}–{endTime}</span>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-green-700 px-4 py-2 text-sm font-bold text-white hover:bg-green-800 disabled:opacity-50"
            >
              {saving ? 'Scheduling…' : 'Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
