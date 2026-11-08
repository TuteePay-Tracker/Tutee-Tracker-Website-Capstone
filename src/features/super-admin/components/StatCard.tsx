import type { LucideIcon } from 'lucide-react';

type Accent = 'blue' | 'emerald' | 'violet' | 'amber' | 'rose';

const accentClasses: Record<Accent, string> = {
  blue: 'bg-blue-50 text-blue-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  violet: 'bg-violet-50 text-violet-700',
  amber: 'bg-amber-50 text-amber-700',
  rose: 'bg-rose-50 text-rose-700',
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: Accent;
  hint?: string;
}

export const StatCard = ({
  label,
  value,
  icon: Icon,
  accent = 'blue',
  hint,
}: StatCardProps) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </p>
        <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
        {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
      </div>
      <div className={`shrink-0 rounded-xl p-3 ${accentClasses[accent]}`}>
        <Icon size={22} />
      </div>
    </div>
  </div>
);
