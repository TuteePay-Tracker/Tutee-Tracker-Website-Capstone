import { createContext, useContext, useState, ReactNode } from 'react';
import {
  getCurrentSchoolYear,
  getAvailableSchoolYears,
  getSchoolYearRange,
  formatSchoolYear,
} from '@/shared/utils/schoolYear';

interface SchoolYearContextType {
  selectedYear: string;
  setSelectedYear: (year: string) => void;
  availableYears: string[];
  schoolYearRange: { start: Date; end: Date };
  displayLabel: string;
}

const SchoolYearContext = createContext<SchoolYearContextType | undefined>(undefined);

const STORAGE_KEY = 'tutortrack_school_year';

export const SchoolYearProvider = ({ children }: { children: ReactNode }) => {
  const [selectedYear, setSelectedYearState] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const available = getAvailableSchoolYears();
    if (saved && available.includes(saved)) return saved;
    return getCurrentSchoolYear();
  });

  const availableYears = getAvailableSchoolYears();
  const schoolYearRange = getSchoolYearRange(selectedYear);
  const displayLabel = formatSchoolYear(selectedYear);

  const setSelectedYear = (year: string) => {
    localStorage.setItem(STORAGE_KEY, year);
    setSelectedYearState(year);
  };

  return (
    <SchoolYearContext.Provider
      value={{ selectedYear, setSelectedYear, availableYears, schoolYearRange, displayLabel }}
    >
      {children}
    </SchoolYearContext.Provider>
  );
};

export const useSchoolYear = (): SchoolYearContextType => {
  const ctx = useContext(SchoolYearContext);
  if (!ctx) throw new Error('useSchoolYear must be used within SchoolYearProvider');
  return ctx;
};
