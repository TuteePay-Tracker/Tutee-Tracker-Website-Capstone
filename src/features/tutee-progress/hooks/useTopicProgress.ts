import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  StudentTopicProgress,
  TopicProgressFormData,
  TopicProgressSummary,
} from '@/features/tutee-progress/types/topic';
import { topicService } from '@/features/tutee-progress/services/topicService';
import { logActivity } from '@/shared/utils/auditLogger';
import { useSchoolYear } from '@/shared/contexts/SchoolYearContext';
import { belongsToSchoolYear } from '@/shared/utils/schoolYear';

export function useTopicProgress() {
  const { user } = useAuth();
  const { selectedYear } = useSchoolYear();
  const [progressList, setProgressList] = useState<StudentTopicProgress[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const tutorId =
    user?.role === 'tutor'
      ? user.id
      : user?.createdByTutorId ?? null;

  useEffect(() => {
    if (!tutorId) {
      setProgressList([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribe = topicService.subscribeTopicProgress(tutorId, (data) => {
      // Filter by school year if present on the record
      const scoped = data.filter((item) =>
        belongsToSchoolYear(selectedYear, item as any)
      );
      setProgressList(scoped);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [tutorId, selectedYear]);

  const saveProgress = useCallback(
    async (data: TopicProgressFormData) => {
      if (!tutorId) throw new Error('Not authenticated');
      await topicService.saveTopicProgress(tutorId, {
        ...data,
        schoolYear: selectedYear,
      });

      if (user) {
        await logActivity(
          user.id,
          user.name,
          user.role,
          'Topic Progress Updated',
          'Tutee Progress',
          `Updated progress for student ${data.tuteeName} in ${data.subject} - ${data.topicName} (${data.score}%, ${data.performanceLevel})`
        );
      }
    },
    [tutorId, user, selectedYear]
  );

  const deleteProgress = useCallback(
    async (progressId: string, studentName: string, topicName: string) => {
      if (!tutorId) throw new Error('Not authenticated');
      await topicService.deleteTopicProgress(tutorId, progressId);
      if (user) {
        await logActivity(
          user.id,
          user.name,
          user.role,
          'Topic Progress Deleted',
          'Tutee Progress',
          `Deleted progress evaluation for ${studentName} on topic ${topicName}`
        );
      }
    },
    [tutorId, user]
  );

  /** Map progress records by `${tuteeId}_${topicId}` */
  const progressMap = useMemo(() => {
    const map = new Map<string, StudentTopicProgress>();
    progressList.forEach((p) => {
      map.set(`${p.tuteeId}_${p.topicId}`, p);
    });
    return map;
  }, [progressList]);

  /** Helper to compute a student's summary in a given subject */
  const computeStudentSummary = useCallback(
    (studentId: string, subject: string, topicIds: string[]): TopicProgressSummary => {
      const records = topicIds
        .map((tid) => progressMap.get(`${studentId}_${tid}`))
        .filter((r): r is StudentTopicProgress => r !== undefined);

      let mastered = 0;
      let inProgress = 0;
      let needsImprovement = 0;
      let totalScores = 0;
      let scoredCount = 0;

      records.forEach((r) => {
        if (r.performanceLevel === 'mastered') mastered++;
        else if (r.performanceLevel === 'in-progress') inProgress++;
        else if (r.performanceLevel === 'needs-improvement') needsImprovement++;

        if (r.score > 0 || r.performanceLevel !== 'not-started') {
          totalScores += r.score;
          scoredCount++;
        }
      });

      const totalTopics = topicIds.length;
      const notStarted = Math.max(0, totalTopics - records.length);
      const avgScore = scoredCount > 0 ? Math.round((totalScores / scoredCount) * 10) / 10 : 0;
      const masteryRate = totalTopics > 0 ? Math.round((mastered / totalTopics) * 100) : 0;

      return {
        totalTopics,
        masteredCount: mastered,
        inProgressCount: inProgress,
        needsImprovementCount: needsImprovement,
        notStartedCount: notStarted,
        averageScore: avgScore,
        masteryRate,
      };
    },
    [progressMap]
  );

  return {
    progressList,
    progressMap,
    isLoading,
    saveProgress,
    deleteProgress,
    computeStudentSummary,
  };
}

