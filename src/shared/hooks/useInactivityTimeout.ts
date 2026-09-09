import { useEffect, useState, useRef, useCallback } from 'react';

const TIMEOUT_MS = 5 * 60 * 1000;
const WARNING_MS = 50 * 1000;

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
];

export function useInactivityTimeout(
  isLoggedIn: boolean,
  onLogout: () => void
) {
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(30);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const showWarningRef = useRef(showWarning);
  const onLogoutRef = useRef(onLogout);

  onLogoutRef.current = onLogout;
  showWarningRef.current = showWarning;

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    timeoutRef.current = null;
    warningRef.current = null;
    countdownRef.current = null;
  }, []);

  const startTimers = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);
    showWarningRef.current = false;
    setRemainingSeconds(30);
    lastActivityRef.current = Date.now();

    timeoutRef.current = setTimeout(() => {
      onLogoutRef.current();
    }, TIMEOUT_MS);

    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      showWarningRef.current = true;
      setRemainingSeconds(30);

      countdownRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            onLogoutRef.current();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, TIMEOUT_MS - WARNING_MS);
  }, [clearAllTimers]);

  const resetTimer = useCallback(() => {
    startTimers();
  }, [startTimers]);

  const handleActivity = useCallback(() => {
    if (showWarningRef.current) return;
    const now = Date.now();
    // Throttle activity resets to at most once per second
    if (now - lastActivityRef.current < 1000) return;
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    if (!isLoggedIn) {
      clearAllTimers();
      setShowWarning(false);
      showWarningRef.current = false;
      return;
    }

    startTimers();

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    const handleVisibility = () => {
      if (document.hidden) return;
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= TIMEOUT_MS) {
        onLogoutRef.current();
      } else if (elapsed >= TIMEOUT_MS - WARNING_MS) {
        const remaining = TIMEOUT_MS - elapsed;
        clearAllTimers();
        setShowWarning(true);
        showWarningRef.current = true;
        setRemainingSeconds(Math.ceil(remaining / 1000));
        countdownRef.current = setInterval(() => {
          setRemainingSeconds((prev) => {
            if (prev <= 1) {
              if (countdownRef.current) clearInterval(countdownRef.current);
              onLogoutRef.current();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearAllTimers();
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isLoggedIn, handleActivity, startTimers, clearAllTimers]);

  return { showWarning, remainingSeconds, resetTimer };
}

