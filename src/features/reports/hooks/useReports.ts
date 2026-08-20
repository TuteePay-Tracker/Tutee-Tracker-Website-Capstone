import { useState, useEffect } from 'react';
import { ReportData } from '@/features/reports/types/report';
import { reportService } from '@/features/reports/services/reportService';
import { toast } from 'sonner';
import { shouldShowFirestoreError } from '@/shared/utils/firestoreErrors';
import { getSchoolYearRange } from '@/shared/utils/schoolYear';

export const useReports = (schoolYear?: string) => {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadReports = async () => {
      try {
        setIsLoading(true);
        const dateRange = schoolYear ? getSchoolYearRange(schoolYear) : undefined;
        const data = await reportService.generateReport(dateRange);
        if (cancelled) return;
        setReportData(data);
        setError(null);
      } catch (err: any) {
        if (cancelled) return;
        const errorMessage = err?.message || 'Failed to load reports';
        setError(errorMessage);
        console.error(err);
        if (shouldShowFirestoreError(err)) {
          toast.error(errorMessage);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadReports();

    return () => {
      cancelled = true;
    };
  }, [schoolYear]);

  const loadReports = async () => {
    try {
      setIsLoading(true);
      const dateRange = schoolYear ? getSchoolYearRange(schoolYear) : undefined;
      const data = await reportService.generateReport(dateRange);
      setReportData(data);
      setError(null);
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to load reports';
      setError(errorMessage);
      console.error(err);
      if (shouldShowFirestoreError(err)) {
        toast.error(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    reportData,
    isLoading,
    error,
    refreshReports: loadReports,
  };
};