import logoRemoveBg from '@/assets/logo removebg.png';
import { cn } from '@/shared/components/ui/utils';

interface LoadingScreenProps {
  message?: string;
  fullScreen?: boolean;
  className?: string;
}

export const LoadingScreen = ({
  message = 'Loading...',
  fullScreen = false,
  className,
}: LoadingScreenProps) => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={message}
      className={cn(
        'relative flex w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-blue-50/40 via-white to-slate-50 px-4 select-none',
        fullScreen ? 'fixed inset-0 z-[99999]' : 'min-h-[60vh]',
        className
      )}
    >
      <div className="absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

      <div className="relative flex items-center justify-center">
        <img
          src={logoRemoveBg}
          alt="TutorTrack Logo"
          className="w-28 h-28 sm:w-36 sm:h-36 object-contain drop-shadow-md select-none pointer-events-none"
        />
      </div>

      <div className="mt-6 flex items-center gap-2.5">
        <div className="w-4 h-4 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
        <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">TutorTrack</span>
        <div className="flex items-center gap-1 ml-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" />
        </div>
      </div>

      <p className="mt-2 text-xs sm:text-sm text-gray-500 font-medium">{message}</p>
    </div>
  );
};
