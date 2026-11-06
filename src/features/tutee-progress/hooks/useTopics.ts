import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Topic } from '@/features/tutee-progress/types/topic';
import { topicService } from '@/features/tutee-progress/services/topicService';
import { logActivity } from '@/shared/utils/auditLogger';
import { useSchoolYear } from '@/shared/contexts/SchoolYearContext';

export function useTopics() {
  const { user } = useAuth();
  const { selectedYear } = useSchoolYear();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const tutorId =
    user?.role === 'tutor'
      ? user.id
      : user?.createdByTutorId ?? null;

  useEffect(() => {
    if (!tutorId) {
      setTopics([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribe = topicService.subscribeTopics(tutorId, (data) => {
      setTopics(data);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [tutorId]);

  /**
   * Returns topics filtered to the given school year.
   * Legacy topics (no schoolYear field) are always included for backward compatibility.
   */
  const getTopicsForYear = useCallback(
    (year: string) =>
      topics.filter((t) => !t.schoolYear || t.schoolYear === year),
    [topics]
  );

  /** All topics for the currently selected school year (legacy topics always included). */
  const topicsForSelectedYear = useMemo(
    () => topics.filter((t) => !t.schoolYear || t.schoolYear === selectedYear),
    [topics, selectedYear]
  );

  const addTopic = useCallback(
    async (subject: string, name: string, description?: string, gradeLevel?: string) => {
      if (!tutorId) throw new Error('Not authenticated');
      const id = await topicService.addTopic(tutorId, {
        subject,
        name,
        description,
        schoolYear: selectedYear,
        gradeLevel,
      });
      if (user) {
        await logActivity(
          user.id,
          user.name,
          user.role,
          'Topic Created',
          'Tutee Progress',
          `Created topic "${name}" for subject ${subject}${gradeLevel ? ` (${gradeLevel})` : ''}`
        );
      }
      return id;
    },
    [tutorId, user, selectedYear]
  );

  const updateTopic = useCallback(
    async (topicId: string, name: string, description?: string, subject?: string, gradeLevel?: string) => {
      if (!tutorId) throw new Error('Not authenticated');
      await topicService.updateTopic(tutorId, topicId, { name, description, gradeLevel });
      if (user) {
        await logActivity(
          user.id,
          user.name,
          user.role,
          'Topic Updated',
          'Tutee Progress',
          `Updated topic "${name}" ${subject ? `in ${subject}` : ''}`
        );
      }
    },
    [tutorId, user]
  );

  const deleteTopic = useCallback(
    async (topicId: string, topicName: string, subject?: string) => {
      if (!tutorId) throw new Error('Not authenticated');
      await topicService.deleteTopic(tutorId, topicId);
      if (user) {
        await logActivity(
          user.id,
          user.name,
          user.role,
          'Topic Deleted',
          'Tutee Progress',
          `Deleted topic "${topicName}" ${subject ? `from ${subject}` : ''}`
        );
      }
    },
    [tutorId, user]
  );

  const getTopicsForSubject = useCallback(
    (subject: string) => {
      const lower = subject.trim().toLowerCase();
      return topicsForSelectedYear.filter(
        (t) => t.subject.trim().toLowerCase() === lower
      );
    },
    [topicsForSelectedYear]
  );

  /**
   * Returns topics for a given subject filtered by grade level.
   * Topics with no gradeLevel set are always included (backward-compatible).
   */
  const getTopicsForSubjectAndGrade = useCallback(
    (subject: string, gradeLevel?: string) => {
      const lower = subject.trim().toLowerCase();
      return topicsForSelectedYear.filter((t) => {
        if (t.subject.trim().toLowerCase() !== lower) return false;
        if (!gradeLevel || !t.gradeLevel) return true;
        return t.gradeLevel === gradeLevel;
      });
    },
    [topicsForSelectedYear]
  );

  const topicsBySubject = useMemo(() => {
    const map: Record<string, Topic[]> = {};
    topicsForSelectedYear.forEach((t) => {
      if (!map[t.subject]) map[t.subject] = [];
      map[t.subject].push(t);
    });
    return map;
  }, [topicsForSelectedYear]);

  return {
    topics: topicsForSelectedYear,
    topicsBySubject,
    isLoading,
    tutorId,
    addTopic,
    updateTopic,
    deleteTopic,
    getTopicsForSubject,
    getTopicsForSubjectAndGrade,
    getTopicsForYear,
  };
}

