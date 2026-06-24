export type Remarks = 'Excellent' | 'Good' | 'Needs Improvement';

export interface AssessmentScore {
  name: string;
  score: number;
}

export interface Assessment {
  id: string;
  tuteeId: string;
  tuteeName: string;
  subject: string;
  date: string; // ISO date string e.g. "2026-06-18"
  assessmentScores: AssessmentScore[];
  totalScore?: number; // Optional overall total / max score for this assessment
  topicsCovered: string;
  notes: string;
  recommendations?: string;
  score: number; // calculated average score (0–100) or total average if totalScore is set
  remarks: Remarks;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentFormData {
  tuteeId: string;
  tuteeName: string;
  subject: string;
  date: string;
  assessmentScores: AssessmentScore[];
  totalScore?: number;
  topicsCovered: string;
  notes: string;
  recommendations?: string;
  score: number;
  remarks: Remarks;
}

export const SUBJECTS = [
  'Mathematics',
  'English',
  'Science',
  'Filipino',
  'Other Subjects',
] as const;

export type Subject = (typeof SUBJECTS)[number];

export const REMARKS_OPTIONS: Remarks[] = [
  'Excellent',
  'Good',
  'Needs Improvement',
];

export const REMARKS_THRESHOLDS = {
  Excellent: 90,
  Good: 75,
  'Needs Improvement': 0,
} as const;

/** Auto-derive a remark from a numeric score */
export function scoreToRemarks(score: number): Remarks {
  if (score >= REMARKS_THRESHOLDS.Excellent) return 'Excellent';
  if (score >= REMARKS_THRESHOLDS.Good) return 'Good';
  return 'Needs Improvement';
}

/** Student-level aggregated performance */
export interface StudentPerformance {
  tuteeId: string;
  tuteeName: string;
  assessments: Assessment[];
  averageScore: number;
  trend: number; // positive = improving, negative = declining
  improvement: number; // max - min score (for "Most Improved" ranking)
  latestScore: number | null;
}

/** Subject-level aggregated performance */
export interface SubjectSummary {
  subject: string;
  averageScore: number;
  count: number;
}
