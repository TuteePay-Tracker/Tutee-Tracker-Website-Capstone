export type PerformanceLevel = 'mastered' | 'in-progress' | 'needs-improvement' | 'not-started';

export interface Topic {
  id: string;
  subject: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
  /** School year this topic belongs to (e.g. "2026-27"). Undefined for legacy records. */
  schoolYear?: string;
}

export interface StudentTopicProgress {
  id: string; // `${tuteeId}_${topicId}`
  tuteeId: string;
  tuteeName: string;
  subject: string;
  topicId: string;
  topicName: string;
  score: number; // 0 - 100 percentage
  performanceLevel: PerformanceLevel;
  strengths?: string;
  areasForImprovement?: string;
  notes?: string;
  lastUpdated: string;
  schoolYear?: string;
}

export interface TopicProgressFormData {
  tuteeId: string;
  tuteeName: string;
  subject: string;
  topicId: string;
  topicName: string;
  score: number;
  performanceLevel: PerformanceLevel;
  strengths?: string;
  areasForImprovement?: string;
  notes?: string;
  schoolYear?: string;
}

export const PERFORMANCE_LEVELS: {
  level: PerformanceLevel;
  label: string;
  badgeClass: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  description: string;
}[] = [
  {
    level: 'mastered',
    label: 'Mastered',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bgClass: 'bg-emerald-500',
    borderClass: 'border-emerald-200',
    textClass: 'text-emerald-700',
    description: 'Demonstrates thorough understanding and consistent proficiency (≥ 85%)',
  },
  {
    level: 'in-progress',
    label: 'In Progress',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    bgClass: 'bg-blue-500',
    borderClass: 'border-blue-200',
    textClass: 'text-blue-700',
    description: 'Developing competence with solid foundational knowledge (70–84%)',
  },
  {
    level: 'needs-improvement',
    label: 'Needs Improvement',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    bgClass: 'bg-amber-500',
    borderClass: 'border-amber-200',
    textClass: 'text-amber-700',
    description: 'Requires additional practice, guided instruction, or reinforcement (< 70%)',
  },
  {
    level: 'not-started',
    label: 'Not Started',
    badgeClass: 'bg-gray-50 text-gray-500 border-gray-200',
    bgClass: 'bg-gray-400',
    borderClass: 'border-gray-200',
    textClass: 'text-gray-500',
    description: 'Not yet evaluated or introduced in lessons',
  },
];

export function getPerformanceLevelConfig(level: PerformanceLevel) {
  return (
    PERFORMANCE_LEVELS.find((p) => p.level === level) ??
    PERFORMANCE_LEVELS[PERFORMANCE_LEVELS.length - 1]
  );
}

export function scoreToPerformanceLevel(score: number): PerformanceLevel {
  if (score >= 85) return 'mastered';
  if (score >= 70) return 'in-progress';
  if (score > 0) return 'needs-improvement';
  return 'not-started';
}

export interface TopicProgressSummary {
  totalTopics: number;
  masteredCount: number;
  inProgressCount: number;
  needsImprovementCount: number;
  notStartedCount: number;
  averageScore: number;
  masteryRate: number; // percentage of mastered topics (0-100)
}

