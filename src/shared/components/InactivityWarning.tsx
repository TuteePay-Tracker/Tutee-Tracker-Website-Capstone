import { Clock, LogIn } from 'lucide-react';

interface InactivityWarningProps {
  remainingSeconds: number;
  onStayLoggedIn: () => void;
}

export const InactivityWarning = ({ remainingSeconds, onStayLoggedIn }: InactivityWarningProps) => {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <Clock size={32} className="text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Session Expiring</h2>
        <p className="text-sm text-gray-500 mb-4">
          You've been inactive for a while. You will be logged out in{' '}
          <span className="font-bold text-amber-600">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>.
        </p>
        <button
          onClick={onStayLoggedIn}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors"
        >
          <LogIn size={18} />
          <span>Stay Logged In</span>
        </button>
      </div>
    </div>
  );
};
