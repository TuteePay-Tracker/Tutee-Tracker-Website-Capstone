import { useRef, useState } from 'react';
import { X, Download, Award, AlertTriangle, CheckCircle2, BookOpen } from 'lucide-react';
import { Topic, StudentTopicProgress, getPerformanceLevelConfig } from '@/features/tutee-progress/types/topic';
import { Assessment } from '@/features/tutee-progress/types/assessment';

interface ProgressReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  studentId: string;
  subject: string;
  topics: Topic[];
  progressMap: Map<string, StudentTopicProgress>;
  assessments: Assessment[];
  schoolYear?: string;
  tutorName?: string;
}

export function ProgressReportModal({
  isOpen,
  onClose,
  studentName,
  studentId,
  subject,
  topics,
  progressMap,
  assessments,
  schoolYear,
  tutorName,
}: ProgressReportModalProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isOpen) return null;

  const studentAssessments = assessments.filter(
    (a) => a.tuteeId === studentId && a.subject.trim().toLowerCase() === subject.trim().toLowerCase()
  );

  const topicDetails = topics.map((topic) => {
    const progress = progressMap.get(`${studentId}_${topic.id}`);
    const relatedAssessments = studentAssessments.filter(
      (a) => a.topic?.trim().toLowerCase() === topic.name.trim().toLowerCase()
    );
    const assessmentAvg =
      relatedAssessments.length > 0
        ? Math.round(
            (relatedAssessments.reduce((sum, a) => sum + a.score, 0) / relatedAssessments.length) * 10
          ) / 10
        : null;

    return {
      topic,
      progress,
      assessmentAvg,
      assessmentsCount: relatedAssessments.length,
    };
  });

  const masteredTopics = topicDetails.filter(
    (td) => td.progress?.performanceLevel === 'mastered' || (td.progress?.score ?? 0) >= 85
  );
  const inProgressTopics = topicDetails.filter(
    (td) =>
      td.progress?.performanceLevel === 'in-progress' ||
      ((td.progress?.score ?? 0) >= 70 && (td.progress?.score ?? 0) < 85)
  );
  const needsImprovementTopics = topicDetails.filter(
    (td) =>
      td.progress?.performanceLevel === 'needs-improvement' ||
      ((td.progress?.score ?? 0) > 0 && (td.progress?.score ?? 0) < 70)
  );

  const scoredEntries = topicDetails
    .map((td) => td.progress?.score)
    .filter((s): s is number => typeof s === 'number' && s > 0);

  const overallAvg =
    scoredEntries.length > 0
      ? Math.round((scoredEntries.reduce((a, b) => a + b, 0) / scoredEntries.length) * 10) / 10
      : studentAssessments.length > 0
      ? Math.round(
          (studentAssessments.reduce((a, b) => a + b.score, 0) / studentAssessments.length) * 10
        ) / 10
      : 0;

  const masteryRate =
    topics.length > 0 ? Math.round((masteredTopics.length / topics.length) * 100) : 0;

  const strengthsList: { topic: string; note: string }[] = [];
  const improvementsList: { topic: string; note: string }[] = [];

  topicDetails.forEach((td) => {
    if (td.progress?.strengths) {
      strengthsList.push({ topic: td.topic.name, note: td.progress.strengths });
    } else if (td.progress?.performanceLevel === 'mastered') {
      strengthsList.push({
        topic: td.topic.name,
        note: `Mastered with high proficiency (${td.progress.score}%).`,
      });
    }

    if (td.progress?.areasForImprovement) {
      improvementsList.push({ topic: td.topic.name, note: td.progress.areasForImprovement });
    } else if (td.progress?.performanceLevel === 'needs-improvement') {
      improvementsList.push({
        topic: td.topic.name,
        note: `Needs continued practice and reinforcement (${td.progress.score}%).`,
      });
    }
  });

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setIsDownloading(true);
    try {
      const html2canvas = (await import('html2canvas-pro')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let yOffset = 0;
      let remainingHeight = imgHeight;

      while (remainingHeight > 0) {
        pdf.addImage(imgData, 'PNG', 0, -yOffset, imgWidth, imgHeight);
        remainingHeight -= pageHeight;
        yOffset += pageHeight;
        if (remainingHeight > 0) pdf.addPage();
      }

      const safeName = studentName.replace(/\s+/g, '_');
      const safeSubject = subject.replace(/\s+/g, '_');
      pdf.save(`Progress_Report_${safeName}_${safeSubject}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[95vh] sm:max-h-[92vh] shadow-2xl flex flex-col overflow-hidden border border-gray-100">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-green-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-green-700 text-white flex items-center justify-center shadow-sm">
              <Award size={18} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                Student Progress Report
              </h2>
              <p className="text-xs text-gray-500">
                Detailed learning & topic mastery evaluation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              title="Download as PDF"
            >
              <Download size={14} />
              <span>{isDownloading ? 'Generating...' : 'Download PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Report Body */}
        <div ref={reportRef} className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-gray-800">
          {/* Report Meta Card */}
          <div className="bg-gradient-to-br from-green-700 via-green-800 to-gray-900 text-white rounded-2xl p-6 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-green-200 bg-white/10 px-2.5 py-0.5 rounded-full">
                  Academic Progress Report
                </span>
                <h1 className="text-2xl font-black mt-1.5 tracking-tight">{studentName}</h1>
                <p className="text-sm font-semibold text-green-100 mt-0.5">
                  Subject: <span className="text-white font-bold">{subject}</span>
                  {schoolYear && ` • SY ${schoolYear}`}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-[11px] text-green-200">Date Generated</p>
                <p className="text-xs font-bold">
                  {new Date().toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
                {tutorName && (
                  <p className="text-[11px] text-green-100 mt-1 font-medium">
                    Instructor: {tutorName}
                  </p>
                )}
              </div>
            </div>

            {/* Quick KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/20">
              <div>
                <p className="text-[10px] uppercase font-bold text-green-200">Overall Average</p>
                <p className="text-2xl font-black">{overallAvg}%</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-green-200">Topic Mastery</p>
                <p className="text-2xl font-black">{masteryRate}%</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-green-200">Mastered Topics</p>
                <p className="text-2xl font-black">
                  {masteredTopics.length} <span className="text-sm font-normal">/ {topics.length}</span>
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-green-200">Needs Focus</p>
                <p className="text-2xl font-black">
                  {needsImprovementTopics.length} <span className="text-sm font-normal">topics</span>
                </p>
              </div>
            </div>
          </div>

          {/* Strengths and Areas for Improvement 2-Column Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Strengths */}
            <div className="bg-green-50/60 border border-green-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-green-700 text-white flex items-center justify-center shadow-sm">
                  <CheckCircle2 size={16} />
                </div>
                <h3 className="font-bold text-green-900 text-sm">Key Strengths & Mastery</h3>
              </div>
              {strengthsList.length === 0 ? (
                <p className="text-xs text-gray-500 italic">
                  Continue recording topic evaluations to highlight student strengths.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {strengthsList.map((item, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-xl border border-green-200 shadow-xs">
                      <p className="text-xs font-bold text-green-900">{item.topic}</p>
                      <p className="text-xs text-green-800 mt-0.5 leading-relaxed">{item.note}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Areas for Improvement */}
            <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-sm">
                  <AlertTriangle size={16} />
                </div>
                <h3 className="font-bold text-amber-900 text-sm">Areas for Improvement</h3>
              </div>
              {improvementsList.length === 0 ? (
                <p className="text-xs text-gray-500 italic">
                  {topicDetails.length === 0
                    ? 'No topics configured for this subject yet.'
                    : 'No specific areas for improvement identified. Student is meeting or exceeding expectations.'}
                </p>
              ) : (
                <div className="space-y-2.5">
                  {improvementsList.map((item, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs">
                      <p className="text-xs font-bold text-amber-900">{item.topic}</p>
                      <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">{item.note}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Topic-by-Topic Detailed Breakdown */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <BookOpen size={16} className="text-green-700" />
                Topic-by-Topic Learning Breakdown ({topics.length})
              </h3>
              <span className="text-[11px] text-gray-400 font-medium">
                Organized by tutor-defined syllabus
              </span>
            </div>

            {topicDetails.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-gray-200 rounded-2xl bg-gray-50">
                <p className="text-xs text-gray-500">
                  No topics have been added to {subject} yet. Add topics to view detailed learning breakdowns.
                </p>
              </div>
            ) : (
              <>
                {/* ── Mobile card layout (< sm) ── */}
                <div className="sm:hidden space-y-3">
                  {topicDetails.map(({ topic, progress }) => {
                    const score = progress?.score ?? 0;
                    const level = progress?.performanceLevel ?? (score > 0 ? 'in-progress' : 'not-started');
                    const levelConfig = getPerformanceLevelConfig(level);

                    return (
                      <div
                        key={topic.id}
                        className="border border-gray-200 rounded-2xl bg-white p-4 space-y-3 shadow-xs"
                      >
                        {/* Topic name + badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 leading-snug">{topic.name}</p>
                            {topic.description && (
                              <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
                                {topic.description}
                              </p>
                            )}
                          </div>
                          <span
                            className={`shrink-0 inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${levelConfig.badgeClass}`}
                          >
                            {levelConfig.label}
                          </span>
                        </div>

                        {/* Progress bar */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] text-gray-500 font-medium">Progress</span>
                            <span className="text-xs font-bold text-gray-800">{score}%</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                score >= 85
                                  ? 'bg-green-600'
                                  : score >= 70
                                  ? 'bg-blue-600'
                                  : score > 0
                                  ? 'bg-amber-500'
                                  : 'bg-gray-300'
                              }`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                        </div>

                        {/* Notes */}
                        {(progress?.strengths || progress?.areasForImprovement || progress?.notes) ? (
                          <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                            {progress.strengths && (
                              <p className="text-[11px] text-green-900">
                                <strong className="text-green-950">Strength:</strong> {progress.strengths}
                              </p>
                            )}
                            {progress.areasForImprovement && (
                              <p className="text-[11px] text-amber-800">
                                <strong className="text-amber-900">Focus:</strong> {progress.areasForImprovement}
                              </p>
                            )}
                            {progress.notes && (
                              <p className="text-[11px] text-gray-600">
                                <strong className="text-gray-700">Remarks:</strong> {progress.notes}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-gray-400 italic">
                            {progress ? 'No written remarks' : 'Evaluation pending'}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* ── Desktop table layout (≥ sm) ── */}
                <div className="hidden sm:block border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase font-bold text-[10px] tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Topic / Learning Area</th>
                        <th className="py-3 px-3">Progress</th>
                        <th className="py-3 px-3">Performance Level</th>
                        <th className="py-3 px-4">Notes & Observations</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {topicDetails.map(({ topic, progress }) => {
                        const score = progress?.score ?? 0;
                        const level = progress?.performanceLevel ?? (score > 0 ? 'in-progress' : 'not-started');
                        const levelConfig = getPerformanceLevelConfig(level);

                        return (
                          <tr key={topic.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="py-3.5 px-4 font-semibold text-gray-900">
                              <div>
                                <span>{topic.name}</span>
                                {topic.description && (
                                  <p className="text-[10px] text-gray-400 font-normal mt-0.5">
                                    {topic.description}
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-3 min-w-[120px]">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-gray-800 w-9">{score}%</span>
                                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${
                                      score >= 85
                                        ? 'bg-green-600'
                                        : score >= 70
                                        ? 'bg-blue-600'
                                        : score > 0
                                        ? 'bg-amber-500'
                                        : 'bg-gray-300'
                                    }`}
                                    style={{ width: `${score}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-3">
                              <span
                                className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border ${levelConfig.badgeClass}`}
                              >
                                {levelConfig.label}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-gray-600 text-xs">
                              {progress?.strengths || progress?.areasForImprovement || progress?.notes ? (
                                <div className="space-y-0.5">
                                  {progress.strengths && (
                                    <p className="text-[11px] text-green-900">
                                      <strong className="text-green-950">Strength:</strong> {progress.strengths}
                                    </p>
                                  )}
                                  {progress.areasForImprovement && (
                                    <p className="text-[11px] text-amber-800">
                                      <strong className="text-amber-900">Focus:</strong> {progress.areasForImprovement}
                                    </p>
                                  )}
                                  {progress.notes && (
                                    <p className="text-[11px] text-gray-600">
                                      <strong className="text-gray-700">Remarks:</strong> {progress.notes}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-400 text-[11px] italic">
                                  {progress ? 'No written remarks' : 'Evaluation pending'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Parent Guidance */}
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 text-xs text-gray-600 space-y-1">
            <p className="font-bold text-gray-800">Understanding This Report:</p>
            <p>
              • <strong>Mastered (≥ 85%):</strong> Student demonstrates independent comprehension and accuracy.
            </p>
            <p>
              • <strong>In Progress (70%–84%):</strong> Student grasps key ideas but benefits from periodic review.
            </p>
            <p>
              • <strong>Needs Improvement (&lt; 70%):</strong> Targeted one-on-one drills and reinforcement are recommended.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Report formatted for tutor recordkeeping and parent sharing.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
