import { useState } from 'react';
import { CalendarClock, CheckCircle2, ChevronDown, ChevronUp, Clock3, RefreshCw, XCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import {
  MAKE_UP_STATUS_LABELS,
  MAKE_UP_STATUS_STYLES,
  type MakeUpCredit,
} from '@/features/attendance/types/makeUpCredit';

interface AbsentDateOption {
  date: string;
  durationMinutes: number;
}

interface MakeUpCreditPanelProps {
  credits: MakeUpCredit[];
  absentDates: AbsentDateOption[];
  busyCreditId?: string | null;
  grantingDate?: string | null;
  onGrant: (date: string, durationMinutes: number) => void;
  onSchedule: (credit: MakeUpCredit) => void;
  onCancel: (credit: MakeUpCredit) => void;
}

const formatDate = (date: string) => {
  try {
    return format(parseISO(date), 'MMM d, yyyy');
  } catch {
    return date;
  }
};

export const MakeUpCreditPanel = ({
  credits,
  absentDates,
  busyCreditId,
  grantingDate,
  onGrant,
  onSchedule,
  onCancel,
}: MakeUpCreditPanelProps) => {
  const [expanded, setExpanded] = useState(true);
  const available = credits.filter((credit) => credit.status === 'pending');
  const scheduled = credits.filter((credit) => credit.status === 'scheduled');
  const completed = credits.filter((credit) => credit.status === 'completed');
  const hasAnything = available.length > 0 || scheduled.length > 0 || absentDates.length > 0;

  if (!hasAnything) {
    return null;
  }

  return (
    <div className="mx-6 mb-5 rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <CalendarClock size={16} className="text-amber-700" />
          <p className="text-sm font-bold text-amber-900">Make-Up Classes</p>
          {expanded ? (
            <ChevronUp size={14} className="text-amber-700" />
          ) : (
            <ChevronDown size={14} className="text-amber-700" />
          )}
        </div>
        <span className="text-[11px] font-semibold text-amber-700">
          {available.length} available · {scheduled.length} scheduled · {completed.length} completed
        </span>
      </button>

      <div className={`space-y-2 ${expanded ? 'mt-3' : 'hidden'}`}>
        {scheduled.map((credit) => (
          <div
            key={credit.id}
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border px-3 py-2 ${MAKE_UP_STATUS_STYLES.scheduled}`}
          >
            <div className="text-xs">
              <span className="font-bold">Scheduled</span>
              <span className="mx-1.5 opacity-50">·</span>
              {credit.scheduledDate ? formatDate(credit.scheduledDate) : 'No date'}
              {credit.startTime && credit.endTime && (
                <span> at {credit.startTime}–{credit.endTime}</span>
              )}
              <span className="ml-2 opacity-70">from {formatDate(credit.sourceDate)}</span>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                onClick={() => onSchedule(credit)}
                disabled={busyCreditId === credit.id}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
              >
                <RefreshCw size={12} />
                Reschedule
              </button>
              <button
                onClick={() => onCancel(credit)}
                disabled={busyCreditId === credit.id}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-white px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-50 disabled:opacity-50"
              >
                <XCircle size={12} />
                {busyCreditId === credit.id ? 'Cancelling…' : 'Cancel'}
              </button>
            </div>
          </div>
        ))}

        {available.map((credit) => (
          <div
            key={credit.id}
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border px-3 py-2 ${MAKE_UP_STATUS_STYLES.pending}`}
          >
            <div className="text-xs">
              <span className="font-bold">{MAKE_UP_STATUS_LABELS.pending}</span>
              <span className="mx-1.5 opacity-50">·</span>
              {formatDate(credit.sourceDate)} · {credit.durationMinutes} min
            </div>
            <button
              onClick={() => onSchedule(credit)}
              className="inline-flex items-center gap-1 self-start sm:self-auto rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-100"
            >
              <Clock3 size={12} />
              Schedule
            </button>
          </div>
        ))}

        {absentDates.map((option) => (
          <div
            key={option.date}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-red-200 bg-white px-3 py-2 text-red-700"
          >
            <div className="text-xs">
              <span className="font-bold">Absent</span>
              <span className="mx-1.5 opacity-50">·</span>
              {formatDate(option.date)} · {option.durationMinutes} min
              <span className="ml-2 text-red-500/80">Grant a make-up credit for this absence</span>
            </div>
            <button
              onClick={() => onGrant(option.date, option.durationMinutes)}
              disabled={grantingDate === option.date}
              className="inline-flex items-center gap-1 self-start sm:self-auto rounded-lg border border-red-300 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              <CheckCircle2 size={12} />
              {grantingDate === option.date ? 'Granting…' : 'Grant credit'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
