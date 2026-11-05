import { cn } from '@/shared/components/ui/utils';

interface SystemDevelopersProps {
  className?: string;
  showTopBorder?: boolean;
}

export const SystemDevelopers = ({
  className,
  showTopBorder = true,
}: SystemDevelopersProps) => {
  return (
    <section
      className={cn(
        'w-full text-center',
        showTopBorder && 'border-t border-blue-200/60 pt-3 sm:pt-4',
        className
      )}
    >
      <h2 className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.2em] sm:tracking-[0.25em] text-gray-500">
        System Developers
      </h2>

      <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-1.5 sm:gap-4">
        <p className="text-center text-sm font-medium text-gray-700">Darrel Jay Lahoylahoy</p>
        <p className="text-center text-sm font-medium text-gray-700">Athena Clarice Damasco</p>
        <p className="text-center text-sm font-medium text-gray-700">Zyneer Moreno</p>
      </div>

      <p className="mt-2.5 text-center text-xs font-medium text-gray-400">
        © 2026 Notre Dame of Kidapawan College
      </p>
    </section>
  );
};
