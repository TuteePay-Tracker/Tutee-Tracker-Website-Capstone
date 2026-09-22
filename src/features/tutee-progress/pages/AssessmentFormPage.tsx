import { useState, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router';
import { ArrowLeft, X } from 'lucide-react';
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
  scoreToRemarks,
} from '@/features/tutee-progress/types/assessment';
import { Tutee } from '@/features/tutees/types/tutee';

function tuteeSubjects(tutee: Tutee): string[] {
  if (tutee.subjects && tutee.subjects.length > 0) return tutee.subjects;
  return tutee.subject ? [tutee.subject] : [];
}

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

  const handleSubjectChange = (subject: string) => {
    setForm((f) => {
      const tutee = tutees.find((t) => t.id === f.tuteeId);
      const stillEnrolled =
        tutee != null &&
        tuteeSubjects(tutee).some((s) => s?.toLowerCase() === subject.trim().toLowerCase());
      return {
        ...f,
        subject,
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
    }));
  };

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
          onClick={onCancel}
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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700" />
        <span className="ml-3 text-gray-500 font-medium">Loading…</span>
      </div>
    );
  }

  if (id && !editing) {
    return (
      <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
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
    <div className="max-w-3xl">
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