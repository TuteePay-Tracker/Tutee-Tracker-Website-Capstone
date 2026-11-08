import { useState, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router';
import { ArrowLeft, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useAssessments } from '@/features/tutee-progress/hooks/useAssessments';
import { useTutees } from '@/features/tutees/hooks/useTutees';
import { useSubjects } from '@/features/tutees/hooks/useSubjects';
import { assessmentService } from '@/features/tutee-progress/services/assessmentService';
import { logActivity } from '@/shared/utils/auditLogger';
import { LoadingScreen } from '@/shared/components/LoadingScreen';
import {
  Assessment,
  AssessmentFormData,
  scoreToRemarks,
} from '@/features/tutee-progress/types/assessment';
import { useTopics } from '@/features/tutee-progress/hooks/useTopics';
import { useTopicProgress } from '@/features/tutee-progress/hooks/useTopicProgress';
import { scoreToPerformanceLevel } from '@/features/tutee-progress/types/topic';
import { Tutee } from '@/features/tutees/types/tutee';

function tuteeSubjects(tutee: Tutee): string[] {
  if (tutee.subjects && tutee.subjects.length > 0) return tutee.subjects;
  return tutee.subject ? [tutee.subject] : [];
}

/** Score fields are kept as strings while editing so the input can be empty. */
interface AssessmentScoreDraft {
  name: string;
  score: string;
  totalScore: string;
}

type AssessmentFormDraft = Omit<AssessmentFormData, 'assessmentScores'> & {
  assessmentScores: AssessmentScoreDraft[];
};

const emptyScoreDraft = (): AssessmentScoreDraft => ({ name: '', score: '', totalScore: '' });

/** Convert saved numeric scores into editable string drafts. */
const toScoreDrafts = (editing?: Assessment | null): AssessmentScoreDraft[] => {
  if (!editing?.assessmentScores || editing.assessmentScores.length === 0) {
    return [emptyScoreDraft()];
  }
  return editing.assessmentScores.map((s) => ({
    name: s.name || '',
    score: s.score === 0 || s.score ? String(s.score) : '',
    totalScore: s.totalScore ? String(s.totalScore) : '',
  }));
};

/** Parse an editable score string into a number (empty/invalid counts as 0). */
const toScoreNumber = (value: string): number => {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Keep only digits and drop leading zeros so "080" becomes "80". */
const sanitizeScoreInput = (value: string): string =>
  value.replace(/[^\d]/g, '').replace(/^0+(?=\d)/, '');

interface AssessmentFormProps {
  tutorId: string;
  tutees: Tutee[];
  subjects: string[];
  defaultSubject: string;
  editing?: Assessment | null;
  onCancel: () => void;
}

function AssessmentForm({ tutorId, tutees, subjects, defaultSubject, editing, onCancel }: AssessmentFormProps) {
  const { user } = useAuth();
  const { getTopicsForSubjectAndGrade } = useTopics();
  const { saveProgress } = useTopicProgress();
  const getInitialScores = (): AssessmentScoreDraft[] => toScoreDrafts(editing);

  const [form, setForm] = useState<AssessmentFormDraft>({
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
  const [isCustomTopic, setIsCustomTopic] = useState(false);

  /** Returns an error string for a row, or null if valid. */
  const getRowError = (scoreItem: AssessmentScoreDraft): string | null => {
    const score = toScoreNumber(scoreItem.score);
    const max = toScoreNumber(scoreItem.totalScore);
    if (scoreItem.score.trim() !== '' && scoreItem.totalScore.trim() !== '' && max > 0 && score > max) {
      return `Score cannot exceed the maximum score of ${max}.`;
    }
    return null;
  };

  const hasAnyScoreError = form.assessmentScores.some((s) => getRowError(s) !== null);

  const calculateScoreAndRemarks = (scores: AssessmentScoreDraft[]) => {
    const earnedPoints = scores.reduce((sum, s) => sum + toScoreNumber(s.score), 0);
    const totalPoints = scores.reduce((sum, s) => sum + toScoreNumber(s.totalScore), 0);
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

  const handleSubjectChange = (subject: string) => {
    setIsCustomTopic(false);
    setForm((f) => {
      const tutee = tutees.find((t) => t.id === f.tuteeId);
      const stillEnrolled =
        tutee != null &&
        tuteeSubjects(tutee).some((s) => s?.toLowerCase() === subject.trim().toLowerCase());
      return {
        ...f,
        subject,
        topic: '',
        ...(stillEnrolled ? {} : { tuteeId: '', tuteeName: '' }),
      };
    });
  };

  const handleTuteeChange = (id: string) => {
    const found = tutees.find((t) => t.id === id);
    setForm((f) => ({
      ...f,
      tuteeId: id,
      tuteeName: found ? `${found.firstName} ${found.surname}` : '',
      // Automatically reset topic when switching student if not editing or custom
      topic: isCustomTopic ? f.topic : '',
    }));
  };

  // Currently selected student object
  const selectedStudent = useMemo(
    () => tutees.find((t) => t.id === form.tuteeId),
    [tutees, form.tuteeId]
  );

  // Students enrolled in the currently selected subject.
  const enrolledTutees = useMemo(
    () =>
      tutees.filter((t) =>
        tuteeSubjects(t).some((s) => s?.toLowerCase() === form.subject.trim().toLowerCase())
      ),
    [tutees, form.subject]
  );

  // Always keep the record's existing student in the list when editing,
  // even if they no longer match the selected subject filter.
  const visibleTutees = useMemo(() => {
    if (!form.tuteeId) return enrolledTutees;
    if (enrolledTutees.some((t) => t.id === form.tuteeId)) return enrolledTutees;
    const selected = tutees.find((t) => t.id === form.tuteeId);
    return selected ? [...enrolledTutees, selected] : enrolledTutees;
  }, [enrolledTutees, tutees, form.tuteeId]);

  // Tutor-configured topics filtered by subject and the selected student's grade level
  const availableTopics = useMemo(
    () => getTopicsForSubjectAndGrade(form.subject, selectedStudent?.gradeLevel),
    [getTopicsForSubjectAndGrade, form.subject, selectedStudent?.gradeLevel]
  );

  const updateAssessmentScore = (index: number, field: 'name' | 'score' | 'totalScore', value: string) => {
    const nextValue = field === 'name' ? value : sanitizeScoreInput(value);
    setForm((prev) => {
      const newScores = prev.assessmentScores.map((score, idx) => {
        if (idx !== index) return score;
        return { ...score, [field]: nextValue };
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
      const newScores = [...prev.assessmentScores, emptyScoreDraft()];
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
        ? [emptyScoreDraft()]
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
    if (form.assessmentScores.length === 0 || form.assessmentScores.some(s => !s.name.trim())) {
      toast.error('Please enter a name for all assessment scores');
      return;
    }
    if (form.assessmentScores.some(s => s.score.trim() === '' || s.totalScore.trim() === '')) {
      toast.error('Please enter a score and maximum points for all assessments');
      return;
    }
    if (form.assessmentScores.some(s => toScoreNumber(s.score) < 0 || toScoreNumber(s.totalScore) <= 0)) {
      toast.error('Scores and total possible points must be positive numbers');
      return;
    }
    if (form.assessmentScores.some(s => toScoreNumber(s.score) > toScoreNumber(s.totalScore))) {
      toast.error('Student score cannot exceed the maximum possible points');
      return;
    }

    setSaving(true);
    try {
      const dataToSave: AssessmentFormData = {
        ...form,
        assessmentScores: form.assessmentScores.map((s) => ({
          name: s.name,
          score: toScoreNumber(s.score),
          totalScore: toScoreNumber(s.totalScore),
        })),
        topicsCovered: form.topic,
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

      // If the lesson topic matches a tutor-configured topic, sync student topic progress
      const matchingTopic = availableTopics.find(
        (t) => t.name.trim().toLowerCase() === form.topic.trim().toLowerCase()
      );
      if (matchingTopic && form.tuteeId) {
        try {
          await saveProgress({
            tuteeId: form.tuteeId,
            tuteeName: form.tuteeName,
            subject: form.subject,
            topicId: matchingTopic.id,
            topicName: matchingTopic.name,
            score: dataToSave.score,
            performanceLevel: scoreToPerformanceLevel(dataToSave.score),
            notes: form.notes || '',
          });
        } catch (progErr) {
          console.warn('Unable to auto-sync topic progress:', progErr);
        }
      }

      onCancel();
    } catch {
      toast.error('Failed to save assessment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Student selection + Subject + Date + Topic */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <option value="">
              {enrolledTutees.length === 0
                ? 'No students enrolled in this subject'
                : 'Select student…'}
            </option>
            {visibleTutees.map((t) => (
              <option key={t.id} value={t.id}>
                {t.firstName} {t.surname}
              </option>
            ))}
          </select>
          {form.tuteeId === '' && enrolledTutees.length === 0 && (
            <p className="text-[11px] text-amber-600 mt-1.5 font-medium">
              No students are enrolled in {form.subject} yet.
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold uppercase text-gray-500 mb-1.5">
            Subject
          </label>
          <select
            value={form.subject}
            onChange={(e) => handleSubjectChange(e.target.value)}
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
          <div className="flex items-center justify-between mb-1.5 gap-1.5">
            <label className="block text-xs font-bold uppercase text-gray-500 whitespace-nowrap">
              Lesson Topic *
            </label>
            {availableTopics.length > 0 && (
              <span className="text-[10px] text-green-700 font-semibold whitespace-nowrap">
                {availableTopics.length} topic{availableTopics.length > 1 ? 's' : ''} available
                {selectedStudent?.gradeLevel ? ` (${selectedStudent.gradeLevel})` : ''}
              </span>
            )}
          </div>
          {isCustomTopic ? (
            <div className="flex gap-1.5">
              <input
                type="text"
                required
                autoFocus
                placeholder="Enter topic name…"
                value={form.topic}
                onChange={(e) => setForm((prev) => ({ ...prev, topic: e.target.value }))}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none font-medium"
              />
              <button
                type="button"
                onClick={() => {
                  setIsCustomTopic(false);
                  setForm((prev) => ({ ...prev, topic: '' }));
                }}
                className="px-2.5 py-1 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl font-medium shrink-0"
                title="Back to dropdown"
              >
                List
              </button>
            </div>
          ) : (
            <select
              required
              value={form.topic}
              onChange={(e) => {
                if (e.target.value === '__custom__') {
                  setIsCustomTopic(true);
                  setForm((prev) => ({ ...prev, topic: '' }));
                } else {
                  setForm((prev) => ({ ...prev, topic: e.target.value }));
                }
              }}
              className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none font-medium"
            >
              <option value="">
                {availableTopics.length === 0
                  ? selectedStudent?.gradeLevel
                    ? `No topics created for ${selectedStudent.gradeLevel} in ${form.subject}`
                    : 'No topics available for this subject'
                  : 'Select topic…'}
              </option>
              {availableTopics.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
              {form.topic &&
                !availableTopics.some(
                  (t) => t.name.trim().toLowerCase() === form.topic.trim().toLowerCase()
                ) && (
                  <option value={form.topic}>{form.topic}</option>
                )}
              
            </select>
          )}
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
            const totalPoints = toScoreNumber(scoreItem.totalScore);
            const pct = totalPoints > 0
              ? Math.round((toScoreNumber(scoreItem.score) / totalPoints) * 100)
              : 0;
            const rowError = getRowError(scoreItem);
            const scoreExceedsMax = rowError !== null;
            return (
              <div key={index} className={`flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full p-3.5 border rounded-2xl bg-gray-50/40 shadow-sm relative ${scoreExceedsMax ? 'border-red-300 bg-red-50/30' : 'border-gray-200/80'}`}>
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
                <div className="flex flex-col gap-1 w-full sm:w-auto shrink-0 pt-3 sm:pt-0">
                  <div className="flex items-end gap-2">
                    <div className="relative w-20">
                      <label className={`block text-[9px] uppercase font-extrabold tracking-wider mb-1 ${scoreExceedsMax ? 'text-red-500' : 'text-gray-400'}`}>Score *</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        value={scoreItem.score}
                        onChange={(e) => updateAssessmentScore(index, 'score', e.target.value)}
                        placeholder="Score"
                        className={`w-full px-2 py-2 bg-white border rounded-xl text-center focus:outline-none focus:ring-2 font-bold text-sm shadow-inner ${
                          scoreExceedsMax
                            ? 'border-red-400 ring-red-200 focus:ring-red-400 text-red-600'
                            : 'border-gray-200 focus:ring-green-500'
                        }`}
                      />
                    </div>

                    <span className="text-gray-400 font-bold mb-2">/</span>

                    <div className="relative w-20">
                      <label className={`block text-[9px] uppercase font-extrabold tracking-wider mb-1 ${scoreExceedsMax ? 'text-red-500' : 'text-gray-400'}`}>Max *</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        value={scoreItem.totalScore}
                        onChange={(e) => updateAssessmentScore(index, 'totalScore', e.target.value)}
                        placeholder="Max"
                        className={`w-full px-2 py-2 bg-white border rounded-xl text-center focus:outline-none focus:ring-2 font-bold text-sm shadow-inner ${
                          scoreExceedsMax
                            ? 'border-red-400 ring-red-200 focus:ring-red-400 text-red-600'
                            : 'border-gray-200 focus:ring-green-500'
                        }`}
                      />
                    </div>

                    {/* Computed Percentage (Read-only) */}
                    <div className="relative w-20">
                      <label className="block text-[9px] uppercase font-extrabold text-blue-400 tracking-wider mb-1 text-center">Percentage</label>
                      <div className={`h-9 flex items-center justify-center border rounded-xl font-extrabold text-xs select-none ${
                        scoreExceedsMax
                          ? 'bg-red-50 border-red-200 text-red-500'
                          : 'bg-blue-50 border-blue-100 text-blue-700'
                      }`}>
                        {scoreExceedsMax ? '—' : `${pct}%`}
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

                  {/* Inline error message */}
                  {rowError && (
                    <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5 mt-0.5">
                      <AlertCircle size={13} className="shrink-0" />
                      {rowError}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Overall Calculations Live Preview */}
      {(() => {
        const overallEarned = form.assessmentScores.reduce((sum, s) => sum + toScoreNumber(s.score), 0);
        const overallTotal = form.assessmentScores.reduce((sum, s) => sum + toScoreNumber(s.totalScore), 0);
        return (
          <div className={`border rounded-2xl p-4 grid grid-cols-3 gap-4 text-center shadow-sm ${hasAnyScoreError ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200/80'}`}>
            <div>
              <span className="block text-[9px] uppercase font-extrabold text-gray-400 tracking-wider">Overall Score</span>
              <span className={`text-base font-black mt-1 block ${hasAnyScoreError ? 'text-red-400' : 'text-gray-900'}`}>
                {hasAnyScoreError ? '—' : <>{overallEarned} <span className="text-gray-400 font-normal">/</span> {overallTotal}</>}
              </span>
            </div>
            <div>
              <span className="block text-[9px] uppercase font-extrabold text-gray-400 tracking-wider">Overall Percentage</span>
              <span className={`text-base font-black mt-1 block ${hasAnyScoreError ? 'text-red-400' : 'text-blue-600'}`}>
                {hasAnyScoreError ? '—' : `${form.score}%`}
              </span>
            </div>
            <div>
              <span className="block text-[9px] uppercase font-extrabold text-gray-400 tracking-wider">Performance Status</span>
              {hasAnyScoreError ? (
                <span className="inline-block text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border mt-1 bg-red-50 text-red-600 border-red-200">
                  Fix Errors
                </span>
              ) : (
                <span className={`inline-block text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border mt-1 ${
                  form.remarks === 'Excellent' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  form.remarks === 'Good' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {form.remarks}
                </span>
              )}
            </div>
          </div>
        );
      })()}

      {/* Tutor Notes */}
      <div>
        <label className="block text-xs uppercase font-extrabold text-gray-400 tracking-wider mb-1.5">Tutor Notes &amp; Observations <span className="normal-case font-semibold">(Optional)</span></label>
        <textarea
          rows={3}
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
          onClick={onCancel}
          className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold text-sm transition-colors text-gray-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || hasAnyScoreError}
          className="px-6 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : editing ? 'Save Changes' : 'Save Report'}
        </button>
      </div>
    </form>
  );
}

export function AssessmentFormPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { assessments, isLoading: assessmentsLoading, tutorId } = useAssessments();
  const { tutees, isLoading: tuteesLoading } = useTutees();
  const { subjects: rawSubjects, isLoading: subjectsLoading } = useSubjects();

  const isTutor = user?.role === 'tutor';
  const editing = id ? assessments.find((a) => a.id === id) ?? null : null;

  // For parents, useSubjects fetches the parent's own subjects (empty),
  // so we derive subjects from assessment data instead.
  const subjectNames = isTutor
    ? rawSubjects.map((s) => s.name)
    : Array.from(new Set(assessments.map((a) => a.subject)));

  const defaultSubject =
    (location.state as { subject?: string } | null)?.subject ??
    editing?.subject ??
    subjectNames[0] ??
    '';

  const goBack = () => navigate('/tutee-progress');

  if (assessmentsLoading || tuteesLoading || (isTutor && subjectsLoading)) {
    return <LoadingScreen message="Loading assessment..." />;
  }

  if (id && !editing) {
    return (
      <div className="max-w-4xl mx-auto bg-white rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
        <p className="text-gray-500 font-medium">Assessment not found.</p>
        <button
          onClick={goBack}
          className="mt-4 px-6 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-xl font-semibold text-sm transition-colors inline-flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          Back to Tutee Progress
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-3">
          <button
            onClick={goBack}
            className="mt-1 p-2 hover:bg-gray-100 rounded-xl text-gray-500 hover:text-gray-900 transition-colors"
            title="Back to Tutee Progress"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {editing ? 'Edit Assessment' : 'Add Assessment'}
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Record student performance in {editing ? editing.subject : defaultSubject || 'the selected subject'}
            </p>
          </div>
        </div>
      </div>

      {tutorId ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <AssessmentForm
            key={editing?.id ?? 'new'}
            tutorId={tutorId}
            tutees={tutees}
            subjects={subjectNames}
            defaultSubject={defaultSubject}
            editing={editing}
            onCancel={goBack}
          />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
          <p className="text-gray-500 font-medium">Unable to load tutor data.</p>
        </div>
      )}
    </div>
  );
}