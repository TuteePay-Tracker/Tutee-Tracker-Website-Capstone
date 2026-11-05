import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Topic } from '@/features/tutee-progress/types/topic';
import { topicService } from '@/features/tutee-progress/services/topicService';
import { logActivity } from '@/shared/utils/auditLogger';

export function useTopics() {
  const { user } = useAuth();
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

  const addTopic = useCallback(
    async (subject: string, name: string, description?: string) => {
      if (!tutorId) throw new Error('Not authenticated');
      const id = await topicService.addTopic(tutorId, { subject, name, description });
      if (user) {
        await logActivity(
          user.id,
          user.name,
          user.role,
          'Topic Created',
          'Tutee Progress',
          `Created topic "${name}" for subject ${subject}`
        );
      }
      return id;
    },
    [tutorId, user]
  );

  const updateTopic = useCallback(
    async (topicId: string, name: string, description?: string, subject?: string) => {
      if (!tutorId) throw new Error('Not authenticated');
      await topicService.updateTopic(tutorId, topicId, { name, description });
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
      return topics.filter((t) => t.subject.trim().toLowerCase() === lower);
    },
    [topics]
  );

  const topicsBySubject = useMemo(() => {
    const map: Record<string, Topic[]> = {};
    topics.forEach((t) => {
      if (!map[t.subject]) map[t.subject] = [];
      map[t.subject].push(t);
    });
    return map;
  }, [topics]);

  return {
    topics,
    topicsBySubject,
    isLoading,
    tutorId,
    addTopic,
    updateTopic,
    deleteTopic,
    getTopicsForSubject,
  };
}

