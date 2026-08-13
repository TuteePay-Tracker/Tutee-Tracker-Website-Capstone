import { useState, useMemo, useEffect } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  AreaChart,
  Area,
  Cell,
} from 'recharts';

const ProgressTrendTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-800 text-white p-3 rounded-xl shadow-xl text-xs font-sans">
        <p className="font-semibold text-slate-400 border-b border-slate-800 pb-1 mb-1">{data.month}</p>
        <div className="flex items-center justify-between gap-6 mt-1">
          <span className="text-slate-400">Class Average:</span>
          <span className="font-bold text-indigo-400">{payload[0].value}%</span>
        </div>
      </div>
    );
  }
  return null;
};

const SubjectPerformanceTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-800 text-white p-3 rounded-xl shadow-xl text-xs font-sans">
        <p className="font-semibold text-slate-400 border-b border-slate-800 pb-1 mb-1">{data.subject}</p>
        <div className="flex items-center justify-between gap-6 mt-1">
          <span className="text-slate-400">Class Average:</span>
          <span className="font-bold text-emerald-400">{payload[0].value}%</span>
        </div>
      </div>
    );
  }
  return null;
};

const MiniScoreTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 border border-slate-800 text-white p-2.5 rounded-lg shadow-lg text-[10px] font-sans">
        <p className="font-semibold text-slate-400 border-b border-slate-800 pb-0.5 mb-0.5">{new Date(data.date).toLocaleDateString()}</p>
        <div className="flex items-center justify-between gap-4 mt-0.5">
          <span className="text-slate-400">Score:</span>
          <span className="font-bold text-emerald-400">{payload[0].value}%</span>
        </div>
      </div>
    );
  }
  return null;
};

import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Star,
  BookOpen,
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  Activity,
  BarChart2,
  Clock,
  Edit2,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useAssessments } from '@/features/tutee-progress/hooks/useAssessments';
import { useTutees } from '@/features/tutees/hooks/useTutees';
import { useSubjects } from '@/features/tutees/hooks/useSubjects';
import { assessmentService } from '@/features/tutee-progress/services/assessmentService';
import { logActivity } from '@/shared/utils/auditLogger';
import {
  Assessment,
  AssessmentFormData,
  AssessmentScore,
  REMARKS_OPTIONS,
  scoreToRemarks,
  StudentPerformance,
  SubjectSummary,
} from '@/features/tutee-progress/types/assessment';

// ─── Analytics helpers ───────────────────────────────────────────────────────

function calcAverage(scores: number[]): number {
  if (!scores.length) return 0;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

/** Linear slope (simple linear regression) over an array of numbers */
function calcSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = calcAverage(values);
  let num = 0;
  let den = 0;
  values.forEach((y, x) => {
    num += (x - xMean) * (y - yMean);
    den += (x - xMean) ** 2;
  });
  return den === 0 ? 0 : Math.round((num / den) * 10) / 10;
}

function buildStudentPerformances(
  assessments: Assessment[],
  subjectFilter?: string
): StudentPerformance[] {
  const byStudent: Record<string, Assessment[]> = {};

  assessments.forEach((a) => {
    if (subjectFilter && a.subject !== subjectFilter) return;
    if (!byStudent[a.tuteeId]) byStudent[a.tuteeId] = [];
    byStudent[a.tuteeId].push(a);
  });

  return Object.entries(byStudent).map(([tuteeId, items]) => {
    // Sort chronologically
    const sorted = [...items].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const scores = sorted.map((a) => a.score);
    const avg = calcAverage(scores);
    const trend = calcSlope(scores);
    const improvement =
      scores.length >= 2 ? Math.max(...scores) - Math.min(...scores) : 0;

    return {
      tuteeId,
      tuteeName: items[0].tuteeName,
      assessments: sorted,
      averageScore: avg,
      trend,
      improvement,
      latestScore: scores.length ? scores[scores.length - 1] : null,
    };
  });
}

function buildSubjectSummaries(assessments: Assessment[]): SubjectSummary[] {
  const bySubject: Record<string, number[]> = {};
  assessments.forEach((a) => {
    if (!bySubject[a.subject]) bySubject[a.subject] = [];
    bySubject[a.subject].push(a.score);
  });

  return Object.entries(bySubject).map(([subject, scores]) => ({
    subject,
    averageScore: calcAverage(scores),
    count: scores.length,
  }));
}

/** Build monthly average score series for the overall performance line chart */
function buildMonthlyTrend(
  assessments: Assessment[]
): { month: string; average: number }[] {
  const byMonth: Record<string, number[]> = {};
  assessments.forEach((a) => {
    const m = a.date.slice(0, 7); // "YYYY-MM"
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(a.score);
  });

  return Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, scores]) => ({
      month: new Date(month + '-01').toLocaleString('default', {
        month: 'short',
        year: '2-digit',
      }),
      average: calcAverage(scores),
    }));
}

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 90
      ? 'bg-emerald-100 text-emerald-700'
      : score >= 75
      ? 'bg-blue-100 text-blue-700'
      : 'bg-red-100 text-red-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold ${color}`}>
      {score}
    </span>
  );
}

function TrendIcon({ slope }: { slope: number }) {
  if (slope > 1) return <TrendingUp size={16} className="text-emerald-600" />;
  if (slope < -1) return <TrendingDown size={16} className="text-red-500" />;
  return <Minus size={16} className="text-gray-400" />;
}

function RemarksBadge({ remarks }: { remarks: Assessment['remarks'] }) {
  const map: Record<Assessment['remarks'], string> = {
    Excellent: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Good: 'bg-blue-50 text-blue-700 border-blue-200',
    'Needs Improvement': 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${map[remarks]}`}>
      {remarks}
    </span>
  );
}

// ─── Assessment Form Modal ────────────────────────────────────────────────────

interface AssessmentModalProps {
  tutorId: string;
  tutees: { id: string; firstName: string; surname: string }[];
  subjects: string[];
  defaultSubject?: string;
  editing?: Assessment | null;
  onClose: () => void;
}

function AssessmentModal({
  tutorId,
  tutees,
  subjects,
  defaultSubject,
  editing,
  onClose,
}: AssessmentModalProps) {
  const { user } = useAuth();
  const getInitialScores = (): AssessmentScore[] => {
    if (!editing?.assessmentScores || editing.assessmentScores.length === 0) {
      return [{ name: '', score: 0, totalScore: 100 }];
    }
    return editing.assessmentScores.map(s => ({
      name: s.name || '',
      score: s.score || 0,
      totalScore: s.totalScore || 100
    }));
  };

  const [form, setForm] = useState<AssessmentFormData>({
    tuteeId: editing?.tuteeId ?? '',
    tuteeName: editing?.tuteeName ?? '',
    subject: editing?.subject ?? defaultSubject ?? subjects[0] ?? '',
    date: editing?.date ?? new Date().toISOString().slice(0, 10),
    topic: editing?.topic ?? '',
    assessmentScores: getInitialScores(),
    totalScore: editing?.totalScore ?? undefined,
    topicsCovered: editing?.topicsCovered ?? '',
    notes: editing?.notes ?? '',
    recommendations: editing?.recommendations ?? '',
    score: editing?.score ?? 0,
    remarks: editing?.remarks ?? 'Good',
  });
  const [saving, setSaving] = useState(false);

  const calculateScoreAndRemarks = (scores: AssessmentScore[]) => {
    const earnedPoints = scores.reduce((sum, s) => sum + (Number(s.score) || 0), 0);
    const totalPoints = scores.reduce((sum, s) => sum + (Number(s.totalScore) || 0), 0);
    let avgPercentage = 0;
    if (totalPoints > 0) {
      avgPercentage = Math.round((earnedPoints / totalPoints) * 100);
    }
    return {
      score: avgPercentage,
      totalScore: totalPoints,
      remarks: scoreToRemarks(avgPercentage),
    };
  };

  const handleTuteeChange = (id: string) => {
    const found = tutees.find((t) => t.id === id);
    setForm((f) => ({
      ...f,
      tuteeId: id,
      tuteeName: found ? `${found.firstName} ${found.surname}` : '',
    }));
  };

  const updateAssessmentScore = (index: number, field: 'name' | 'score' | 'totalScore', value: string | number) => {
    setForm((prev) => {
      const newScores = prev.assessmentScores.map((score, idx) => {
        if (idx !== index) return score;
        return { ...score, [field]: value };
      });
      const { score, totalScore, remarks } = calculateScoreAndRemarks(newScores);
      return {
        ...prev,
        assessmentScores: newScores,
        score,
        totalScore,
        remarks,
      };
    });
  };

  const addAssessmentScore = () => {
    setForm((prev) => {
      const newScores = [...prev.assessmentScores, { name: '', score: 0, totalScore: 100 }];
      const { score, totalScore, remarks } = calculateScoreAndRemarks(newScores);
      return {
        ...prev,
        assessmentScores: newScores,
        score,
        totalScore,
        remarks,
      };
    });
  };

  const removeAssessmentScore = (index: number) => {
    setForm((prev) => {
      const newScores = prev.assessmentScores.length === 1
        ? [{ name: '', score: 0, totalScore: 100 }]
        : prev.assessmentScores.filter((_, idx) => idx !== index);
      const { score, totalScore, remarks } = calculateScoreAndRemarks(newScores);
      return {
        ...prev,
        assessmentScores: newScores,
        score,
        totalScore,
        remarks,
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tuteeId) {
      toast.error('Please select a student');
      return;
    }
    if (!form.topic.trim()) {
      toast.error('Please enter a lesson Topic');
      return;
    }
    if (!form.notes.trim()) {
      toast.error('Please fill out all required fields');
      return;
    }
    if (form.assessmentScores.length === 0 || form.assessmentScores.some(s => !s.name.trim())) {
      toast.error('Please enter a name for all assessment scores');
      return;
    }
    if (form.assessmentScores.some(s => s.score < 0 || s.totalScore <= 0)) {
      toast.error('Scores and total possible points must be positive numbers');
      return;
    }
    if (form.assessmentScores.some(s => s.score > s.totalScore)) {
      toast.error('Student score cannot exceed the maximum possible points');
      return;
    }

    setSaving(true);
    try {
      const dataToSave = {
        ...form,
        topicsCovered: form.topic
      };
      if (editing) {
        await assessmentService.update(tutorId, editing.id, dataToSave);
        toast.success('Assessment updated');
        if (user) {
          await logActivity(
            user.id,
            user.name,
            user.role,
            'Assessment Updated',
            'Tutee Progress',
            `Updated assessment for student ${form.tuteeName} in ${form.subject}`
          );
          await logActivity(
            user.id,
            user.name,
            user.role,
            'Scores Recorded',
            'Tutee Progress',
            `Recorded scores for student ${form.tuteeName} in ${form.subject}`
          );
        }
      } else {
        await assessmentService.add(tutorId, dataToSave);
        toast.success('Assessment recorded!');
        if (user) {
          await logActivity(
            user.id,
            user.name,
            user.role,
            'Assessment Created',
            'Tutee Progress',
            `Created assessment for student ${form.tuteeName} in ${form.subject}`
          );
          await logActivity(
            user.id,
            user.name,
            user.role,
            'Scores Recorded',
            'Tutee Progress',
            `Recorded scores for student ${form.tuteeName} in ${form.subject}`
          );
        }
      }
      onClose();
    } catch {
      toast.error('Failed to save assessment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100 my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-700 to-emerald-600 p-5 text-white flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg">
              {editing ? 'Edit Assessment' : 'Add Assessment'}
            </h3>
            <p className="text-green-100 text-xs mt-0.5">Record student performance</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Student selection + Date & Subject */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1.5">
                Student
              </label>
              <select
                required
                value={form.tuteeId}
                onChange={(e) => handleTuteeChange(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none font-medium"
              >
                <option value="">Select student…</option>
                {tutees.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.firstName} {t.surname}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1.5">
                Subject
              </label>
              <select
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none font-medium"
              >
                {subjects.length === 0 ? (
                  <option value="" disabled>No subjects configured</option>
                ) : (
                  subjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1.5">
                Date
              </label>
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-gray-500 mb-1.5">
                Lesson Topic *
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Fractions"
                value={form.topic}
                onChange={(e) => setForm((prev) => ({ ...prev, topic: e.target.value }))}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none font-semibold"
              />
            </div>
          </div>

          {/* Assessment scores dynamic layout */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs uppercase font-extrabold text-gray-400 tracking-wider">
                Assessment Scores <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={addAssessmentScore}
                className="text-xs font-semibold text-green-700 hover:text-green-800 flex items-center gap-1"
              >
                <span>+ Add Score</span>
              </button>
            </div>

            <div className="space-y-4">
              {form.assessmentScores.map((scoreItem, index) => {
                const pct = scoreItem.totalScore > 0 
                  ? Math.round((scoreItem.score / scoreItem.totalScore) * 100) 
                  : 0;
                return (
                  <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full p-3.5 border border-gray-200/80 rounded-2xl bg-gray-50/40 shadow-sm relative">
                    {/* Assessment Name */}
                    <div className="flex-1 w-full">
                      <label className="block text-[9px] uppercase font-extrabold text-gray-400 tracking-wider mb-1">Assessment Name *</label>
                      <input
                        type="text"
                        required
                        value={scoreItem.name}
                        onChange={(e) => updateAssessmentScore(index, 'name', e.target.value)}
                        placeholder="e.g. Quiz 1, Seatwork"
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 font-medium text-sm shadow-inner"
                      />
                    </div>
                    
                    {/* Scores Inputs & Percentage */}
                    <div className="flex items-end gap-2 w-full sm:w-auto shrink-0 pt-3 sm:pt-0">
                      <div className="relative w-20">
                        <label className="block text-[9px] uppercase font-extrabold text-gray-400 tracking-wider mb-1">Score *</label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={scoreItem.score}
                          onChange={(e) => updateAssessmentScore(index, 'score', Number(e.target.value))}
                          placeholder="Score"
                          className="w-full px-2 py-2 bg-white border border-gray-200 rounded-xl text-center focus:outline-none focus:ring-2 focus:ring-green-500 font-bold text-sm shadow-inner"
                        />
                      </div>
                      
                      <span className="text-gray-400 font-bold mb-2">/</span>
                      
                      <div className="relative w-20">
                        <label className="block text-[9px] uppercase font-extrabold text-gray-400 tracking-wider mb-1">Max *</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={scoreItem.totalScore}
                          onChange={(e) => updateAssessmentScore(index, 'totalScore', Number(e.target.value))}
                          placeholder="Max"
                          className="w-full px-2 py-2 bg-white border border-gray-200 rounded-xl text-center focus:outline-none focus:ring-2 focus:ring-green-500 font-bold text-sm shadow-inner"
                        />
                      </div>

                      {/* Computed Percentage (Read-only) */}
                      <div className="relative w-20">
                        <label className="block text-[9px] uppercase font-extrabold text-blue-400 tracking-wider mb-1 text-center">Percentage</label>
                        <div className="h-9 flex items-center justify-center bg-blue-50 border border-blue-100 rounded-xl text-blue-700 font-extrabold text-xs select-none">
                          {pct}%
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeAssessmentScore(index)}
                        className="text-red-400 hover:text-red-600 p-2 rounded-xl transition-colors shrink-0 mb-0.5"
                        title="Remove score"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Overall Calculations Live Preview */}
          {(() => {
            const overallEarned = form.assessmentScores.reduce((sum, s) => sum + (Number(s.score) || 0), 0);
            const overallTotal = form.assessmentScores.reduce((sum, s) => sum + (Number(s.totalScore) || 0), 0);
            return (
              <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-4 grid grid-cols-3 gap-4 text-center shadow-sm">
                <div>
                  <span className="block text-[9px] uppercase font-extrabold text-gray-400 tracking-wider">Overall Score</span>
                  <span className="text-base font-black text-gray-900 mt-1 block">
                    {overallEarned} <span className="text-gray-400 font-normal">/</span> {overallTotal}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-extrabold text-gray-400 tracking-wider">Overall Percentage</span>
                  <span className="text-base font-black text-blue-600 mt-1 block">
                    {form.score}%
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase font-extrabold text-gray-400 tracking-wider">Performance Status</span>
                  <span className={`inline-block text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border mt-1 ${
                    form.remarks === 'Excellent' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    form.remarks === 'Good' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {form.remarks}
                  </span>
                </div>
              </div>
            );
          })()}


          {/* Tutor Notes */}
          <div>
            <label className="block text-xs uppercase font-extrabold text-gray-400 tracking-wider mb-1.5">Tutor Notes & Observations *</label>
            <textarea
              rows={3}
              required
              placeholder="How did the student perform? Any strengths or areas they struggled with?"
              value={form.notes}
              onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 font-medium text-sm"
            />
          </div>

          {/* Recommendations */}
          <div>
            <label className="block text-xs uppercase font-extrabold text-gray-400 tracking-wider mb-1.5">Recommendations (Optional)</label>
            <textarea
              rows={2}
              placeholder="Suggested homework, study plans, or target practices..."
              value={form.recommendations}
              onChange={(e) => setForm(prev => ({ ...prev, recommendations: e.target.value }))}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 font-medium text-sm"
            />
          </div>

          {/* Horizontal Line and Actions */}
          <div className="pt-4 border-t flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold text-sm transition-colors text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Save Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Dashboard Section ────────────────────────────────────────────────────────

function DashboardSection({
  assessments,
  isTutor,
}: {
  assessments: Assessment[];
  isTutor: boolean;
}) {
  const monthlyTrend = useMemo(() => buildMonthlyTrend(assessments), [assessments]);
  const subjectSummaries = useMemo(() => buildSubjectSummaries(assessments), [assessments]);
  const allStudents = useMemo(
    () => buildStudentPerformances(assessments),
    [assessments]
  );

  const [improvedPage, setImprovedPage] = useState(0);
  const [recentPage, setRecentPage] = useState(0);
  const PAGE_SIZE = 3;

  const mostImproved = useMemo(
    () =>
      [...allStudents]
        .filter((s) => s.assessments.length >= 2)
        .sort((a, b) => b.improvement - a.improvement)
        .slice(0, 5),
    [allStudents]
  );

  const needsIntervention = useMemo(
    () =>
      allStudents.filter((s) => {
        // Last 3 assessments declining or all below 75
        const last3 = s.assessments.slice(-3).map((a) => a.score);
        const allLow = last3.length >= 2 && last3.every((sc) => sc < 75);
        const declining = s.trend < -2;
        return allLow || declining;
      }),
    [allStudents]
  );

  const allRecentAssessments = useMemo(
    () => [...assessments].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    ).slice(0, 10),
    [assessments]
  );

  const recentAssessments = allRecentAssessments.slice(recentPage * PAGE_SIZE, (recentPage + 1) * PAGE_SIZE);
  const recentTotalPages = Math.ceil(allRecentAssessments.length / PAGE_SIZE);

  const improvedVisible = mostImproved.slice(improvedPage * PAGE_SIZE, (improvedPage + 1) * PAGE_SIZE);
  const improvedTotalPages = Math.ceil(mostImproved.length / PAGE_SIZE);

  const overallAvg = useMemo(() => calcAverage(assessments.map((a) => a.score)), [assessments]);

  if (assessments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-20 h-20 bg-green-50 rounded-3xl flex items-center justify-center mb-5">
          <BookOpen size={36} className="text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">No Assessments Yet</h3>
        <p className="text-gray-500 text-sm max-w-xs">
          {isTutor
            ? 'Start by adding assessment records in the Subject Performance section below.'
            : 'Your tutor hasn\'t recorded any assessments yet. Check back later.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Overall Avg Score',
            value: `${overallAvg}%`,
            icon: Activity,
            bgCircle: 'bg-purple-50',
            iconBg: 'bg-purple-50 text-purple-700',
            sub: `${assessments.length} total records`,
          },
          {
            label: 'Students Tracked',
            value: allStudents.length,
            icon: BookOpen,
            bgCircle: 'bg-blue-50',
            iconBg: 'bg-blue-50 text-blue-700',
            sub: `Across ${subjectSummaries.length} subjects`,
          },
          {
            label: 'Most Improved',
            value: mostImproved[0]?.tuteeName?.split(' ')[0] ?? '—',
            icon: Star,
            bgCircle: 'bg-emerald-50',
            iconBg: 'bg-emerald-50 text-emerald-700',
            sub: mostImproved[0]
              ? `+${mostImproved[0].improvement} pts`
              : 'No data yet',
          },
          {
            label: 'Need Attention',
            value: needsIntervention.length,
            icon: AlertTriangle,
            bgCircle: needsIntervention.length > 0 ? 'bg-red-50' : 'bg-gray-50',
            iconBg: needsIntervention.length > 0 ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-500',
            sub: needsIntervention.length > 0 ? 'Students flagged' : 'All on track',
          },
        ].map((card) => {
          const Icon = card.icon;
          const statusClass = 
            card.label === 'Overall Avg Score' ? 'stat-primary' :
            card.label === 'Students Tracked' ? 'stat-primary' :
            card.label === 'Most Improved' ? 'stat-success' :
            card.label === 'Need Attention' && needsIntervention.length > 0 ? 'stat-danger' : 'stat-muted';

          return (
            <div
              key={card.label}
              className={`glass-panel stat-card-premium ${statusClass} p-5 flex items-center gap-4 relative overflow-hidden group`}
            >
              <div className={`absolute top-0 right-0 w-24 h-24 ${card.bgCircle} dark:opacity-10 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300`} />
              <div className={`w-12 h-12 rounded-xl ${card.iconBg} dark:bg-opacity-10 flex items-center justify-center relative shrink-0`}>
                <Icon size={22} />
              </div>
              <div className="relative flex-1">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-slate-400 uppercase tracking-wider">{card.label}</p>
                <p className="text-[1.625rem] font-bold text-gray-900 dark:text-white mt-0.5">{card.value}</p>
                <p className="text-[10px] text-gray-500 dark:text-slate-455 mt-1 font-medium">{card.sub}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Overall Performance Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-green-700" />
            <h2 className="font-semibold text-gray-900">Overall Performance Trend</h2>
          </div>
          {monthlyTrend.length < 2 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              Not enough data for trend analysis
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={monthlyTrend} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="tuteeProgressTrendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip content={<ProgressTrendTooltip />} />
                <ReferenceLine y={75} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: '75', fontSize: 10, fill: '#f59e0b', position: 'insideBottomLeft' }} />
                <Area
                  type="monotone"
                  dataKey="average"
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  fill="url(#tuteeProgressTrendGrad)"
                  name="Avg Score"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Subject Performance Bar Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={18} className="text-indigo-650" />
            <h2 className="font-semibold text-gray-900">Subject Performance Summary</h2>
          </div>
          {subjectSummaries.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              No subject data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={subjectSummaries} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="subject" tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <Tooltip content={<SubjectPerformanceTooltip />} />
                <Bar dataKey="averageScore" radius={[6, 6, 0, 0]} barSize={28}>
                  {subjectSummaries.map((_, index) => {
                    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];
                    return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Most Improved + Needs Intervention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Improved */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Star size={18} className="text-amber-500" />
            <h2 className="font-semibold text-gray-900">Most Improved Students</h2>
          </div>
          {mostImproved.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">
              Need ≥ 2 assessments per student to rank improvement
            </p>
          ) : (
            <div className="space-y-3">
              {improvedVisible.map((s, i) => (
                <div key={s.tuteeId} className="flex items-center gap-3 p-3 bg-amber-50/50 rounded-xl border border-amber-100">
                  <div className="w-7 h-7 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {improvedPage * PAGE_SIZE + i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{s.tuteeName}</p>
                    <p className="text-xs text-gray-500">{s.assessments.length} assessments · avg {s.averageScore}%</p>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-600 font-bold text-sm">
                    <ChevronUp size={16} />
                    +{s.improvement} pts
                  </div>
                </div>
              ))}
              {improvedTotalPages > 1 && (
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <button
                    onClick={() => setImprovedPage((p) => Math.max(0, p - 1))}
                    disabled={improvedPage === 0}
                    className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg disabled:opacity-40 hover:bg-gray-200 transition-colors"
                  >
                    ← Prev
                  </button>
                  <span className="text-xs text-gray-400 font-medium">
                    {improvedPage + 1} / {improvedTotalPages}
                  </span>
                  <button
                    onClick={() => setImprovedPage((p) => Math.min(improvedTotalPages - 1, p + 1))}
                    disabled={improvedPage === improvedTotalPages - 1}
                    className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg disabled:opacity-40 hover:bg-gray-200 transition-colors"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Needs Intervention */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-red-500" />
            <h2 className="font-semibold text-gray-900">Students Requiring Intervention</h2>
          </div>
          {needsIntervention.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <TrendingUp size={22} className="text-emerald-600" />
              </div>
              <p className="text-emerald-700 font-semibold text-sm">All students on track!</p>
              <p className="text-gray-400 text-xs mt-1">No intervention needed currently</p>
            </div>
          ) : (
            <div className="space-y-3">
              {needsIntervention.map((s) => (
                <div key={s.tuteeId} className="flex items-center gap-3 p-3 bg-red-50/50 rounded-xl border border-red-100">
                  <div className="w-7 h-7 rounded-full bg-red-500 text-white flex items-center justify-center flex-shrink-0">
                    <AlertTriangle size={12} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{s.tuteeName}</p>
                    <p className="text-xs text-gray-500">avg {s.averageScore}% · trend {s.trend > 0 ? '+' : ''}{s.trend}</p>
                  </div>
                  <div className="flex items-center gap-1 text-red-500 text-xs font-bold">
                    <ChevronDown size={14} />
                    Low/declining
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Assessments */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-gray-500" />
            <h2 className="font-semibold text-gray-900">Recent Assessments</h2>
          </div>
          <span className="text-xs text-gray-400 font-medium">
            Showing {Math.min(recentPage * PAGE_SIZE + 1, allRecentAssessments.length)}–{Math.min((recentPage + 1) * PAGE_SIZE, allRecentAssessments.length)} of {allRecentAssessments.length}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-3 text-xs font-bold uppercase text-gray-400">Student</th>
                <th className="text-left py-2 px-3 text-xs font-bold uppercase text-gray-400">Subject</th>
                <th className="text-left py-2 px-3 text-xs font-bold uppercase text-gray-400">Date</th>
                <th className="text-left py-2 px-3 text-xs font-bold uppercase text-gray-400">Score</th>
                <th className="text-left py-2 px-3 text-xs font-bold uppercase text-gray-400">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {recentAssessments.map((a) => (
                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="py-2.5 px-3 font-medium text-gray-900">{a.tuteeName}</td>
                  <td className="py-2.5 px-3 text-gray-600">{a.subject}</td>
                  <td className="py-2.5 px-3 text-gray-500 text-xs">
                    {new Date(a.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="py-2.5 px-3">
                    <ScoreBadge score={a.score} />
                  </td>
                  <td className="py-2.5 px-3">
                    <RemarksBadge remarks={a.remarks} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {recentTotalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <button
              onClick={() => setRecentPage((p) => Math.max(0, p - 1))}
              disabled={recentPage === 0}
              className="px-4 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg disabled:opacity-40 hover:bg-gray-200 transition-colors"
            >
              ← Previous
            </button>
            <span className="text-xs text-gray-400 font-semibold">
              Page {recentPage + 1} of {recentTotalPages}
            </span>
            <button
              onClick={() => setRecentPage((p) => Math.min(recentTotalPages - 1, p + 1))}
              disabled={recentPage === recentTotalPages - 1}
              className="px-4 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg disabled:opacity-40 hover:bg-gray-200 transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Subject Performance Section ──────────────────────────────────────────────

function SubjectSection({
  assessments,
  tutees,
  tutorId,
  isTutor,
  subjects,
}: {
  assessments: Assessment[];
  tutees: any[];
  tutorId: string | undefined;
  isTutor: boolean;
  subjects: string[];
}) {
  const { user } = useAuth();
  const [activeSubject, setActiveSubject] = useState<string>(subjects[0] ?? '');
  const [showModal, setShowModal] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [studentPage, setStudentPage] = useState(0);
  const STUDENT_PAGE_SIZE = 3;

  // Sync activeSubject when subjects list loads or changes
  useEffect(() => {
    if (subjects.length > 0 && !subjects.includes(activeSubject)) {
      setActiveSubject(subjects[0]);
    }
  }, [subjects]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // Reset student page when subject changes
  useEffect(() => {
    setStudentPage(0);
  }, [activeSubject]);

  const filtered = useMemo(
    () => assessments.filter((a) => a.subject === activeSubject),
    [assessments, activeSubject]
  );

  const students = useMemo(
    () => buildStudentPerformances(filtered),
    [filtered]
  );

  const studentTotalPages = Math.ceil(students.length / STUDENT_PAGE_SIZE);
  const visibleStudents = students.slice(studentPage * STUDENT_PAGE_SIZE, (studentPage + 1) * STUDENT_PAGE_SIZE);

  const handleDelete = async (a: Assessment) => {
    if (!tutorId) return;
    if (!window.confirm(`Delete this assessment for ${a.tuteeName}?`)) return;
    try {
      await assessmentService.delete(tutorId, a.id);
      toast.success('Assessment deleted');
      if (user) {
        await logActivity(
          user.id,
          user.name,
          user.role,
          'Assessment Deleted',
          'Tutee Progress',
          `Deleted assessment for student ${a.tuteeName} in ${a.subject}`
        );
      }
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="space-y-6">
      {/* Subject Tab Bar */}
      <div className="flex flex-wrap gap-2">
        {subjects.length === 0 ? (
          <div className="w-full bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
            No subjects configured yet. Go to <strong>Settings</strong> to add custom subjects first.
          </div>
        ) : (
          subjects.map((s) => {
            const count = assessments.filter((a) => a.subject === s).length;
            return (
              <button
                key={s}
                onClick={() => setActiveSubject(s)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
                  activeSubject === s
                    ? 'bg-green-700 text-white border-green-700 shadow-md shadow-green-700/20'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-green-300 hover:text-green-700'
                }`}
              >
                {s}
                {count > 0 && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      activeSubject === s
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })
        )}

        {/* Add Assessment button (tutor only) */}
        {isTutor && tutorId && (
          <button
            onClick={() => {
              setEditingAssessment(null);
              setShowModal(true);
            }}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm"
          >
            <Plus size={16} />
            Add Assessment
          </button>
        )}
      </div>

      {/* Student Cards */}
      {students.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
          <BookOpen size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No assessments recorded for {activeSubject}</p>
          {isTutor && (
            <p className="text-gray-400 text-sm mt-1">
              Click "Add Assessment" to record the first entry.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {visibleStudents.map((student) => {
            // Per-student scores chart data (chronological)
            const chartData = student.assessments.map((a) => ({
              date: new Date(a.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              }),
              score: a.score,
            }));

            return (
              <div
                key={student.tuteeId}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
              >
                {/* Student Header */}
                <div className="flex items-center justify-between p-5 border-b border-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-700 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                      {student.tuteeName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{student.tuteeName}</p>
                      <p className="text-xs text-gray-500">
                        {student.assessments.length} assessments · avg{' '}
                        <span className="font-semibold text-gray-700">{student.averageScore}%</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-sm">
                      <TrendIcon slope={student.trend} />
                      <span
                        className={`text-xs font-semibold ${
                          student.trend > 1
                            ? 'text-emerald-600'
                            : student.trend < -1
                            ? 'text-red-500'
                            : 'text-gray-400'
                        }`}
                      >
                        {student.trend > 0 ? '+' : ''}{student.trend} slope
                      </span>
                    </div>
                    <ScoreBadge score={student.latestScore ?? 0} />
                  </div>
                </div>

                <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Mini trend chart */}
                  {chartData.length >= 2 ? (
                    <div>
                      <p className="text-xs font-bold uppercase text-gray-400 mb-2">Score Trend</p>
                      <ResponsiveContainer width="100%" height={120}>
                        <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                          <defs>
                            <linearGradient id={`miniScoreGrad-${student.tuteeId}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                              <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="#f3f4f6" strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: '#9ca3af', fontSize: 9 }} />
                          <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: '#9ca3af', fontSize: 9 }} />
                          <Tooltip content={<MiniScoreTooltip />} />
                          <Area
                            type="monotone"
                            dataKey="score"
                            stroke="#10b981"
                            strokeWidth={2.5}
                            fill={`url(#miniScoreGrad-${student.tuteeId})`}
                            dot={{ r: 3, fill: '#10b981', stroke: '#fff', strokeWidth: 1 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center bg-gray-50 rounded-xl h-28 text-xs text-gray-400">
                      Need ≥ 2 records for trend
                    </div>
                  )}

                  {/* Assessment Records Table */}
                  <div>
                    <p className="text-xs font-bold uppercase text-gray-400 mb-2">Assessment Records</p>
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {[...student.assessments].reverse().map((a) => (
                        <div key={a.id} className="border border-gray-100 rounded-xl bg-gray-50/50 overflow-hidden shadow-sm">
                          <button
                            type="button"
                            onClick={() => toggleExpand(a.id)}
                            className="w-full flex items-center justify-between text-xs px-3 py-2.5 hover:bg-gray-100/70 transition-colors text-left"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-gray-550 font-medium text-gray-500">
                                {new Date(a.date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </span>
                              {a.topic && (
                                <span className="font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded text-[10px] truncate max-w-[120px]">
                                  {a.topic}
                                </span>
                              )}
                              <ScoreBadge score={a.score} />
                              <RemarksBadge remarks={a.remarks} />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400">
                                {expandedId === a.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              </span>
                              {isTutor && tutorId && (
                                <div className="flex gap-1 ml-1" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingAssessment(a);
                                      setShowModal(true);
                                    }}
                                    className="p-1 text-gray-400 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
                                    title="Edit assessment"
                                  >
                                    <Edit2 size={11} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(a)}
                                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Delete assessment"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </button>

                          {expandedId === a.id && (
                            <div className="px-4 pb-3.5 pt-2 border-t border-gray-100 bg-white space-y-3 text-xs text-gray-700">
                              {a.assessmentScores && a.assessmentScores.length > 0 && (
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-gray-400 uppercase text-[10px] tracking-wider block">
                                      Scores Breakdown:
                                    </span>
                                    {a.totalScore !== undefined && a.totalScore > 0 && (
                                      <span className="font-bold text-[10px] text-gray-500">
                                        Total: {a.assessmentScores.reduce((sum, s) => sum + s.score, 0)} / {a.totalScore} pts ({a.score}%)
                                      </span>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {a.assessmentScores.map((s, idx) => {
                                      const rowPct = s.totalScore > 0 
                                        ? Math.round((s.score / s.totalScore) * 100) 
                                        : 0;
                                      return (
                                        <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 flex justify-between items-center">
                                          <span className="font-semibold text-gray-650 truncate">{s.name || `Score ${idx+1}`}</span>
                                          <span className="font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">
                                            {s.score} / {s.totalScore} pts ({rowPct}%)
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              {a.topicsCovered && a.topicsCovered !== a.topic && (
                                <div>
                                  <span className="font-bold text-gray-400 uppercase text-[10px] tracking-wider block text-gray-500">Topics Covered:</span>
                                  <p className="mt-0.5 font-medium whitespace-pre-line bg-gray-50 p-2 rounded-lg border border-gray-100">{a.topicsCovered}</p>
                                </div>
                              )}
                              {a.notes && (
                                <div>
                                  <span className="font-bold text-gray-400 uppercase text-[10px] tracking-wider block text-gray-500">Tutor Notes & Observations:</span>
                                  <p className="mt-0.5 font-medium whitespace-pre-line bg-gray-50 p-2 rounded-lg border border-gray-100">{a.notes}</p>
                                </div>
                              )}
                              {a.recommendations && (
                                <div>
                                  <span className="font-bold text-gray-400 uppercase text-[10px] tracking-wider block text-gray-500">Recommendations:</span>
                                  <p className="mt-0.5 font-medium whitespace-pre-line bg-blue-50/50 text-blue-900 p-2 rounded-lg border border-blue-100">{a.recommendations}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {studentTotalPages > 1 && (
            <div className="flex items-center justify-between pt-4 pb-2">
              <button
                onClick={() => setStudentPage((p) => Math.max(0, p - 1))}
                disabled={studentPage === 0}
                className="px-4 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
              >
                ← Previous
              </button>
              <span className="text-xs text-gray-500 font-medium">
                Showing {studentPage * STUDENT_PAGE_SIZE + 1}–{Math.min((studentPage + 1) * STUDENT_PAGE_SIZE, students.length)} of {students.length} students
              </span>
              <button
                onClick={() => setStudentPage((p) => Math.min(studentTotalPages - 1, p + 1))}
                disabled={studentPage === studentTotalPages - 1}
                className="px-4 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl disabled:opacity-40 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Assessment Modal */}
      {showModal && tutorId && (
        <AssessmentModal
          tutorId={tutorId}
          tutees={tutees}
          subjects={subjects}
          defaultSubject={activeSubject}
          editing={editingAssessment}
          onClose={() => {
            setShowModal(false);
            setEditingAssessment(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function TuteeProgress() {
  const { user } = useAuth();
  const { assessments, isLoading, tutorId } = useAssessments();
  const { tutees } = useTutees();
  // Load subjects from Firestore `users/{tutorId}/subjects` collection.
  // useSubjects uses the current auth user internally; for parents the tutor's
  // subjects are fetched via a separate lookup using tutorId below.
  const { subjects: rawSubjects, isLoading: subjectsLoading } = useSubjects();

  const isTutor = user?.role === 'tutor';

  // For parents, useSubjects fetches the parent's own subjects (empty),
  // so we derive subjects from assessment data instead.
  const subjectNames = isTutor
    ? rawSubjects.map((s) => s.name)
    : Array.from(new Set(assessments.map((a) => a.subject)));

  if (isLoading || (isTutor && subjectsLoading)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700" />
        <span className="ml-3 text-gray-500 font-medium">Loading progress data…</span>
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-7xl">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tutee Progress</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Track student performance, trends, and academic growth across all subjects
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2">
          <Activity size={16} className="text-green-700" />
          <span className="text-sm font-semibold text-green-800">
            {assessments.length} total records
          </span>
        </div>
      </div>

      {/* ── Dashboard Section ── */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-1 h-6 bg-green-700 rounded-full" />
          <h2 className="text-xl font-bold text-gray-900">Dashboard Overview</h2>
        </div>
        <DashboardSection assessments={assessments} isTutor={isTutor} />
      </section>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-gray-50 px-4 text-sm text-gray-500 font-medium">
            Subject Performance
          </span>
        </div>
      </div>

      {/* ── Subject Performance Section ── */}
      <section>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-1 h-6 bg-indigo-600 rounded-full" />
          <h2 className="text-xl font-bold text-gray-900">Subject Performance</h2>
          {!isTutor && (
            <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full font-medium">
              View only
            </span>
          )}
        </div>
        <SubjectSection
          assessments={assessments}
          tutees={tutees}
          tutorId={tutorId || undefined}
          isTutor={isTutor}
          subjects={subjectNames}
        />
      </section>
    </div>
  );
}
