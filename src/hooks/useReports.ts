import { useState, useEffect } from 'react';
import { ReportData } from '../types/report';
import { reportService } from '../services/reportService';
import { toast } from 'sonner';

export const useReports = () => {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setIsLoading(true);
      const data = await reportService.generateReport();
      setReportData(data);
      setError(null);
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to load reports';
      setError(errorMessage);
      console.error(err);
      if (err?.message !== 'User not authenticated') {
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