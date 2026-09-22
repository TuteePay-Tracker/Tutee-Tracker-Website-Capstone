import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import {
  getCurrentSchoolYear,
  getSchoolYearRange,
  formatSchoolYear,
  getDefaultSchoolYears,
  getNextSchoolYear,
} from '@/shared/utils/schoolYear';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { db } from '@/shared/lib/firebase/config';
import { collection, doc, getDocs, getDoc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';

interface SchoolYearContextType {
  selectedYear: string;
  setSelectedYear: (year: string) => void;
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

export const SchoolYearProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [schoolYears, setSchoolYears] = useState<string[]>(() => getDefaultSchoolYears());
  const [isLoading, setIsLoading] = useState(true);
  const migrationTriggered = useRef(false);
  const [selectedYear, setSelectedYearState] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const defaults = getDefaultSchoolYears();
    if (saved && defaults.includes(saved)) return saved;
    return getCurrentSchoolYear();
  });

  // Resolve the school-year list + active year for the current user.
  useEffect(() => {
    let cancelled = false;

    const loadForUser = async () => {
      setIsLoading(true);
      try {
        // No user yet — fall back to the static defaults, keep localStorage selection.
        if (!user) {
          if (!cancelled) {
            setSchoolYears(getDefaultSchoolYears());
            setIsLoading(false);
          }
          return;
        }

        // For parents, follow the tutor's active school year.
        const resolvedUid = user.role === 'tutor' ? user.id : user.createdByTutorId;
        if (!resolvedUid) {
          if (!cancelled) {
            setSchoolYears(getDefaultSchoolYears());
            setIsLoading(false);
          }
          return;
        }

        // Load the per-tutor school-year list.
        const sySnap = await getDocs(collection(db, 'users', resolvedUid, 'schoolYears'));
        let years = sySnap.docs.map((d) => d.id).sort((a, b) => b.localeCompare(a));

        // Seed defaults (current + next) if nothing exists yet.
        if (years.length === 0) {
          const defaults = getDefaultSchoolYears(0, 1);
          for (const year of defaults) {
            await setDoc(doc(db, 'users', resolvedUid, 'schoolYears', year), {
              value: year,
              createdAt: new Date().toISOString(),
            });
          }
          years = defaults;
        }

        if (!cancelled) setSchoolYears(years);

        // Resolve the active year.
        const tutorSnap = await getDoc(doc(db, 'users', resolvedUid));
        const activeYear = tutorSnap.exists() ? (tutorSnap.data().activeSchoolYear as string | undefined) : undefined;

        const saved = localStorage.getItem(STORAGE_KEY);
        let next = activeYear || saved || getCurrentSchoolYear();
        if (!years.includes(next)) next = years[0] || getCurrentSchoolYear();

        if (user.role === 'parent') {
          // Parents always follow the tutor's active year.
          localStorage.setItem(STORAGE_KEY, next);
          setSelectedYearState(next);
        } else if (saved && years.includes(saved)) {
          setSelectedYearState(saved);
        } else {
          localStorage.setItem(STORAGE_KEY, next);
          setSelectedYearState(next);
        }

        // One-time backfill: stamp schoolYear on existing records and compute
        // per-year tutee totals. Fire-and-forget; guarded by a per-tutor flag.
        if (user.role === 'tutor' && !migrationTriggered.current) {
          migrationTriggered.current = true;
          import('@/shared/utils/migrateSchoolYears')
            .then((mod) => mod.migrateSchoolYears(resolvedUid))
            .catch((error) => console.error('School year backfill error:', error));
        }
      } catch (error) {
        console.error('Error loading school years:', error);
        const defaults = getDefaultSchoolYears();
        if (!cancelled) {
          setSchoolYears(defaults);
          if (!selectedYear) setSelectedYearState(getCurrentSchoolYear());
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

  const schoolYearRange = getSchoolYearRange(selectedYear);
  const displayLabel = formatSchoolYear(selectedYear);

  const setSelectedYear = (year: string) => {
    localStorage.setItem(STORAGE_KEY, year);
    setSelectedYearState(year);
    // Persist the tutor's active year so the parent portal matches.
    if (user?.role === 'tutor') {
      updateDoc(doc(db, 'users', user.id), { activeSchoolYear: year }).catch((err) =>
        console.error('Error persisting active school year:', err)
      );
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