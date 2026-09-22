import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { assessmentService } from '@/features/tutee-progress/services/assessmentService';
import { Assessment } from '@/features/tutee-progress/types/assessment';
import { belongsToSchoolYear } from '@/shared/utils/schoolYear';
import { useSchoolYear } from '@/shared/contexts/SchoolYearContext';

interface UseAssessmentsResult {
  assessments: Assessment[];
  isLoading: boolean;
  tutorId: string | null;
}

export function useAssessments(): UseAssessmentsResult {
  const { user } = useAuth();
  const { selectedYear } = useSchoolYear();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Determine which tutor ID to use:
  // - If tutor: their own ID
  // - If parent: their tutor's ID (createdByTutorId)
  const tutorId =
    user?.role === 'tutor'
      ? user.id
      : user?.createdByTutorId ?? null;

  useEffect(() => {
    if (!tutorId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const unsubscribe = assessmentService.subscribeAll(tutorId, (data) => {
      setAssessments(data.filter((a) => belongsToSchoolYear(selectedYear, a)));
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [tutorId, selectedYear]);

  return { assessments, isLoading, tutorId };
}
