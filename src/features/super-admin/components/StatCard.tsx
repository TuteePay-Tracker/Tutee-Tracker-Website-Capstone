import type { LucideIcon } from 'lucide-react';

type Accent = 'blue' | 'emerald' | 'violet' | 'amber' | 'rose' | 'teal';

const accentClasses: Record<Accent, { bgCircle: string; iconBg: string }> = {
  blue: { bgCircle: 'bg-blue-50', iconBg: 'bg-blue-50 text-blue-700' },
  emerald: { bgCircle: 'bg-emerald-50', iconBg: 'bg-emerald-50 text-emerald-700' },
  teal: { bgCircle: 'bg-teal-50', iconBg: 'bg-teal-50 text-teal-700' },
  violet: { bgCircle: 'bg-purple-50', iconBg: 'bg-purple-50 text-purple-700' },
  amber: { bgCircle: 'bg-amber-50', iconBg: 'bg-amber-50 text-amber-700' },
  rose: { bgCircle: 'bg-rose-50', iconBg: 'bg-rose-50 text-rose-700' },
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
}: StatCardProps) => {
  const styles = accentClasses[accent] || accentClasses.blue;

  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all relative overflow-hidden group">
      <div
        className={`absolute top-0 right-0 w-24 h-24 ${styles.bgCircle} rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300`}
      />
      <div
        className={`w-12 h-12 rounded-xl ${styles.iconBg} flex items-center justify-center relative shrink-0`}
      >
        <Icon size={22} />
      </div>
      <div className="relative min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider truncate">
          {label}
        </p>
        <p className="text-[1.625rem] font-bold text-gray-900 mt-0.5 leading-none">
          {value}
        </p>
        {hint && (
          <p className="text-[11px] text-gray-400 font-medium mt-1 truncate">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
};
