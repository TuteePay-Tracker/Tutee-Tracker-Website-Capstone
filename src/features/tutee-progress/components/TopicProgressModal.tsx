import { useState, useEffect } from 'react';
import { X, Check, Award, TrendingUp, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  PerformanceLevel,
  PERFORMANCE_LEVELS,
  scoreToPerformanceLevel,
  StudentTopicProgress,
  TopicProgressFormData,
} from '@/features/tutee-progress/types/topic';

interface TopicProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  subject: string;
  topicId: string;
  topicName: string;
  currentProgress?: StudentTopicProgress;
  onSaveProgress: (data: TopicProgressFormData) => Promise<void>;
}

export function TopicProgressModal({
  isOpen,
  onClose,
  studentId,
  studentName,
  subject,
  topicId,
  topicName,
  currentProgress,
  onSaveProgress,
}: TopicProgressModalProps) {
  const [score, setScore] = useState<number>(currentProgress?.score ?? 80);
  const [level, setLevel] = useState<PerformanceLevel>(
    currentProgress?.performanceLevel ?? (currentProgress?.score ? scoreToPerformanceLevel(currentProgress.score) : 'in-progress')
  );
  const [strengths, setStrengths] = useState<string>(currentProgress?.strengths ?? '');
  const [areasForImprovement, setAreasForImprovement] = useState<string>(
    currentProgress?.areasForImprovement ?? ''
  );
  const [notes, setNotes] = useState<string>(currentProgress?.notes ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const initialScore = currentProgress?.score ?? 80;
      setScore(initialScore);
      setLevel(currentProgress?.performanceLevel ?? scoreToPerformanceLevel(initialScore));
      setStrengths(currentProgress?.strengths ?? '');
      setAreasForImprovement(currentProgress?.areasForImprovement ?? '');
      setNotes(currentProgress?.notes ?? '');
    }
  }, [isOpen, currentProgress]);

  if (!isOpen) return null;

  const handleScoreChange = (newScore: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(newScore)));
    setScore(clamped);
    setLevel(scoreToPerformanceLevel(clamped));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSaveProgress({
        tuteeId: studentId,
        tuteeName: studentName,
        subject,
        topicId,
        topicName,
        score,
        performanceLevel: level,
        strengths: strengths.trim() || '',
        areasForImprovement: areasForImprovement.trim() || '',
        notes: notes.trim() || '',
      });
      toast.success(`Progress updated for ${studentName} on "${topicName}"`);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save progress');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-green-50 to-white">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-green-700 bg-green-50 px-2 py-0.5 rounded-md border border-green-200">
                {subject}
              </span>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs font-semibold text-gray-600 truncate max-w-[200px]">
                {studentName}
              </span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mt-1 truncate">
              Update Progress: {topicName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Progress / Mastery Level Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
              Performance Level *
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {PERFORMANCE_LEVELS.filter((p) => p.level !== 'not-started').map((p) => {
                const isSelected = level === p.level;
                const Icon =
                  p.level === 'mastered'
                    ? Award
                    : p.level === 'in-progress'
                    ? TrendingUp
                    : AlertTriangle;

                return (
                  <button
                    key={p.level}
                    type="button"
                    onClick={() => {
                      setLevel(p.level);
                      if (p.level === 'mastered' && score < 85) setScore(90);
                      if (p.level === 'in-progress' && (score < 70 || score >= 85)) setScore(75);
                      if (p.level === 'needs-improvement' && score >= 70) setScore(60);
                    }}
                    className={`flex items-start gap-2.5 p-3 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? `${p.badgeClass} ring-2 ring-green-500/20 font-semibold shadow-sm`
                        : 'bg-gray-50/80 border-gray-200 text-gray-600 hover:bg-gray-100/70'
                    }`}
                  >
                    <Icon size={16} className={`shrink-0 mt-0.5 ${p.textClass}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold leading-tight">{p.label}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">
                        {p.level === 'mastered'
                          ? '≥ 85% Mastery'
                          : p.level === 'in-progress'
                          ? '70%–84% Developing'
                          : '< 70% Needs Support'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Measurable Progress / Percentage Score */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-600">
                Measurable Score / Percentage
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={score}
                  onChange={(e) => handleScoreChange(Number(e.target.value))}
                  className="w-16 px-2 py-1 text-right text-sm font-bold bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <span className="text-xs font-bold text-gray-500">%</span>
              </div>
            </div>

            {/* Slider */}
            <input
              type="range"
              min="0"
              max="100"
              value={score}
              onChange={(e) => handleScoreChange(Number(e.target.value))}
              className="w-full accent-green-700 cursor-pointer"
            />

            {/* Visual Progress Bar Preview */}
            <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  score >= 85
                    ? 'bg-green-600'
                    : score >= 70
                    ? 'bg-blue-600'
                    : 'bg-amber-500'
                }`}
                style={{ width: `${score}%` }}
              />
            </div>
          </div>

          {/* Strengths */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
              Student Strengths
            </label>
            <p className="text-[11px] text-gray-400 mb-1.5">
              Specific concepts, questions, or skills the student mastered in this topic
            </p>
            <textarea
              rows={2}
              placeholder="e.g., Quickly grasps fundamental definitions; accurately solves basic problems..."
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-gray-800 placeholder:text-gray-400"
            />
          </div>

          {/* Areas for Improvement */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
              Areas for Improvement
            </label>
            <p className="text-[11px] text-gray-400 mb-1.5">
              Specific challenges, common errors, or areas that require continued practice
            </p>
            <textarea
              rows={2}
              placeholder="e.g., Needs more drill on multi-step problems; tends to rush word problem analysis..."
              value={areasForImprovement}
              onChange={(e) => setAreasForImprovement(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-gray-800 placeholder:text-gray-400"
            />
          </div>

          {/* Tutor Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1">
              Tutor Notes & Next Steps (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g., Provide supplementary worksheet; re-assess in 2 weeks..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none text-gray-800 placeholder:text-gray-400"
            />
          </div>

          {/* Submit buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-green-700 hover:bg-green-800 text-white text-xs font-semibold rounded-lg transition-all shadow-sm disabled:opacity-50 flex items-center gap-1.5"
            >
              <Check size={14} />
              <span>{isSubmitting ? 'Saving...' : 'Save Progress'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
