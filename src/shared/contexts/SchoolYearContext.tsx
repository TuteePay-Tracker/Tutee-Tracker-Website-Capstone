import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import {
  getCurrentSchoolYear,
  getSchoolYearRange,
  formatSchoolYear,
  getDefaultSchoolYears,
  getNextSchoolYear,
  DEFAULT_START_MONTH,
} from '@/shared/utils/schoolYear';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { db } from '@/shared/lib/firebase/config';
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

interface SchoolYearContextType {
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  startMonth: number;
  setStartMonth: (month: number) => Promise<void>;
  availableYears: string[];
  schoolYears: string[];
  schoolYearRange: { start: Date; end: Date };
  displayLabel: string;
  isLoading: boolean;
  addSchoolYear: (year: string) => Promise<void>;
  removeSchoolYear: (year: string) => Promise<void>;
  refreshSchoolYears: () => Promise<void>;
}

const SchoolYearContext = createContext<SchoolYearContextType | undefined>(undefined);

const STORAGE_KEY = 'tutortrack_school_year';
const START_MONTH_KEY = 'tutortrack_school_year_start_month';

export const SchoolYearProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [startMonth, setStartMonthState] = useState<number>(() => {
    const saved = localStorage.getItem(START_MONTH_KEY);
    const parsed = saved ? parseInt(saved, 10) : NaN;
    return !isNaN(parsed) && parsed >= 1 && parsed <= 12 ? parsed : DEFAULT_START_MONTH;
  });
  const [schoolYears, setSchoolYears] = useState<string[]>(() => getDefaultSchoolYears(3, 1, startMonth));
  const [isLoading, setIsLoading] = useState(true);
  const migrationTriggered = useRef(false);
  const [selectedYear, setSelectedYearState] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const defaults = getDefaultSchoolYears(3, 1, startMonth);
    if (saved && defaults.includes(saved)) return saved;
    return getCurrentSchoolYear(startMonth);
  });

  // Resolve the school-year list + active year + start month for the current user.
  useEffect(() => {
    let cancelled = false;

    const loadForUser = async () => {
      setIsLoading(true);
      try {
        if (!user) {
          if (!cancelled) {
            setSchoolYears(getDefaultSchoolYears(3, 1, startMonth));
            setIsLoading(false);
          }
          return;
        }

        const resolvedUid = user.role === 'tutor' ? user.id : user.createdByTutorId;
        if (!resolvedUid) {
          if (!cancelled) {
            setSchoolYears(getDefaultSchoolYears(3, 1, startMonth));
            setIsLoading(false);
          }
          return;
        }

        // Fetch tutor doc to check active school year and configured start month
        const tutorSnap = await getDoc(doc(db, 'users', resolvedUid));
        let userStartMonth = startMonth;
        let activeYear: string | undefined;

        if (tutorSnap.exists()) {
          const tutorData = tutorSnap.data();
          activeYear = tutorData.activeSchoolYear as string | undefined;
          if (typeof tutorData.schoolYearStartMonth === 'number' && tutorData.schoolYearStartMonth >= 1 && tutorData.schoolYearStartMonth <= 12) {
            userStartMonth = tutorData.schoolYearStartMonth;
            if (!cancelled) {
              setStartMonthState(userStartMonth);
              localStorage.setItem(START_MONTH_KEY, String(userStartMonth));
            }
          }
        }

        // Load the per-tutor school-year list.
        const sySnap = await getDocs(collection(db, 'users', resolvedUid, 'schoolYears'));
        let years = sySnap.docs.map((d) => d.id).sort((a, b) => b.localeCompare(a));

        // Seed defaults (current + next) if nothing exists yet.
        if (years.length === 0) {
          const defaults = getDefaultSchoolYears(0, 1, userStartMonth);
          for (const year of defaults) {
            await setDoc(doc(db, 'users', resolvedUid, 'schoolYears', year), {
              value: year,
              createdAt: new Date().toISOString(),
            });
          }
          years = defaults;
        }

        if (!cancelled) setSchoolYears(years);

        const saved = localStorage.getItem(STORAGE_KEY);
        let next = activeYear || saved || getCurrentSchoolYear(userStartMonth);
        if (!years.includes(next)) next = years[0] || getCurrentSchoolYear(userStartMonth);

        if (user.role === 'parent') {
          localStorage.setItem(STORAGE_KEY, next);
          setSelectedYearState(next);
        } else if (saved && years.includes(saved)) {
          setSelectedYearState(saved);
        } else {
          localStorage.setItem(STORAGE_KEY, next);
          setSelectedYearState(next);
        }

        // One-time backfill: stamp schoolYear on existing records and compute
        // per-year tutee totals.
        if (user.role === 'tutor' && !migrationTriggered.current) {
          migrationTriggered.current = true;
          import('@/shared/utils/migrateSchoolYears')
            .then((mod) => mod.migrateSchoolYears(resolvedUid))
            .catch((error) => console.error('School year backfill error:', error));
        }
      } catch (error) {
        console.error('Error loading school years:', error);
        const defaults = getDefaultSchoolYears(3, 1, startMonth);
        if (!cancelled) {
          setSchoolYears(defaults);
          if (!selectedYear) setSelectedYearState(getCurrentSchoolYear(startMonth));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadForUser();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role, user?.createdByTutorId]);

  const schoolYearRange = getSchoolYearRange(selectedYear, startMonth);
  const displayLabel = formatSchoolYear(selectedYear);

  const setSelectedYear = (year: string) => {
    localStorage.setItem(STORAGE_KEY, year);
    setSelectedYearState(year);
    if (user?.role === 'tutor') {
      updateDoc(doc(db, 'users', user.id), { activeSchoolYear: year }).catch((err) =>
        console.error('Error persisting active school year:', err)
      );
    }
  };

  const setStartMonth = async (month: number) => {
    if (month < 1 || month > 12) return;
    setStartMonthState(month);
    localStorage.setItem(START_MONTH_KEY, String(month));

    if (user?.role === 'tutor') {
      try {
        await updateDoc(doc(db, 'users', user.id), { schoolYearStartMonth: month });
      } catch (err) {
        console.error('Error saving school year start month:', err);
      }
    }
  };

  const refreshSchoolYears = async () => {
    if (!user) return;
    const resolvedUid = user.role === 'tutor' ? user.id : user.createdByTutorId;
    if (!resolvedUid) return;
    const sySnap = await getDocs(collection(db, 'users', resolvedUid, 'schoolYears'));
    const years = sySnap.docs.map((d) => d.id).sort((a, b) => b.localeCompare(a));
    setSchoolYears(years);
  };

  const addSchoolYear = async (year: string) => {
    const resolvedUid = user?.role === 'tutor' ? user?.id : user?.createdByTutorId;
    if (!resolvedUid) throw new Error('User not authenticated');
    if (schoolYears.includes(year)) throw new Error('This school year already exists');
    await setDoc(doc(db, 'users', resolvedUid, 'schoolYears', year), {
      value: year,
      createdAt: new Date().toISOString(),
    });
    await refreshSchoolYears();
  };

  const removeSchoolYear = async (year: string) => {
    const resolvedUid = user?.role === 'tutor' ? user?.id : user?.createdByTutorId;
    if (!resolvedUid) throw new Error('User not authenticated');
    await deleteDoc(doc(db, 'users', resolvedUid, 'schoolYears', year));
    await refreshSchoolYears();
  };

  const value: SchoolYearContextType = {
    selectedYear,
    setSelectedYear,
    startMonth,
    setStartMonth,
    availableYears: schoolYears,
    schoolYears,
    schoolYearRange,
    displayLabel,
    isLoading,
    addSchoolYear,
    removeSchoolYear,
    refreshSchoolYears,
  };

  return <SchoolYearContext.Provider value={value}>{children}</SchoolYearContext.Provider>;
};

export const useSchoolYear = (): SchoolYearContextType => {
  const ctx = useContext(SchoolYearContext);
  if (!ctx) throw new Error('useSchoolYear must be used within SchoolYearProvider');
  return ctx;
};

export { getNextSchoolYear };