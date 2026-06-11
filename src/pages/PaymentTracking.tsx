import { useState, useEffect } from 'react';
import { useTutees } from '../hooks/useTutees';
import { DayPaymentTracker } from '../components/payment/DayPaymentTracker';
import { Users, Calendar, DollarSign, BookOpen } from 'lucide-react';
import { useSearchParams } from 'react-router';

export const PaymentTracking = () => {
  const { tutees, isLoading } = useTutees();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTutee, setSelectedTutee] = useState<{ id: string; name: string } | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  // Collect all subjects from the selected student, or all subjects across all tutees
  const studentSubjects = selectedStudentId
    ? (() => {
        const t = tutees.find(t => t.id === selectedStudentId);
        return t?.subjects?.length ? t.subjects : (t?.subject ? [t.subject] : []);
      })()
    : Array.from(new Set(tutees.flatMap(t => t.subjects?.length ? t.subjects : [t.subject])));

  const filteredTutees = tutees.filter(t => {
    if (selectedStudentId && t.id !== selectedStudentId) return false;
    if (subjectFilter) {
      const tuteeSubjects = t.subjects?.length ? t.subjects : [t.subject];
      return tuteeSubjects.includes(subjectFilter);
    }
    return true;
  });

  useEffect(() => {
    const tuteeId = searchParams.get('tuteeId');
    if (tuteeId && tutees.length > 0) {
      const tutee = tutees.find(t => t.id === tuteeId);
      if (tutee) {
        setSelectedTutee({ id: tutee.id, name: `${tutee.firstName} ${tutee.surname}` });
      }
    }
  }, [searchParams, tutees]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-green-700 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600 font-medium">Loading tutees...</p>
        </div>
      </div>
    );
  }

  if (selectedTutee) {
    return (
      <div className="max-w-4xl mx-auto">
        <DayPaymentTracker
          tuteeId={selectedTutee.id}
          tuteeName={selectedTutee.name}
          onClose={() => setSelectedTutee(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight">Payment Tracking</h1>
        <p className="text-gray-500 mt-2">Track monthly payments for each student</p>
      </div>

      {/* Filters */}
      {tutees.length > 0 && (
        <div className="bg-white rounded-xl border p-4 flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Filter by Student</label>
            <select
              value={selectedStudentId}
              onChange={(e) => { setSelectedStudentId(e.target.value); setSubjectFilter(''); }}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
            >
              <option value="">All Students</option>
              {tutees.map(t => (
                <option key={t.id} value={t.id}>{t.firstName} {t.surname}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
              <BookOpen size={12} />
              Filter by Subject
            </label>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
            >
              <option value="">All Subjects</option>
              {studentSubjects.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {tutees.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl border-2 border-dashed border-gray-300 p-16 text-center">
          <Users className="mx-auto text-gray-300 mb-4" size={64} />
          <p className="text-gray-500 text-lg font-medium">No tutees found</p>
          <p className="text-gray-400 text-sm mt-2">Add tutees first to start tracking payments</p>
        </div>
      ) : filteredTutees.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl border-2 border-dashed border-gray-300 p-16 text-center">
          <BookOpen className="mx-auto text-gray-300 mb-4" size={48} />
          <p className="text-gray-500 text-lg font-medium">No results match your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTutees.map(tutee => (
            <button
              key={tutee.id}
              onClick={() => setSelectedTutee({ id: tutee.id, name: `${tutee.firstName} ${tutee.surname}` })}
              className="bg-white rounded-2xl border-2 border-gray-200 p-6 hover:border-green-500 hover:shadow-xl transition-all text-left group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-600 to-green-700 flex items-center justify-center shadow-lg shadow-green-700/20">
                  <Calendar className="text-white" size={24} />
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 font-medium">Balance</p>
                  <p className={`text-lg font-bold ${tutee.balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    {tutee.balance > 0 ? `₱${tutee.balance.toFixed(2)}` : 'Paid'}
                  </p>
                </div>
              </div>

              <h3 className="font-bold text-lg text-gray-900 group-hover:text-green-700 transition-colors mb-1">
                {tutee.firstName} {tutee.surname}
              </h3>
              <div className="flex flex-wrap gap-1 mb-3">
                {(tutee.subjects?.length ? tutee.subjects : [tutee.subject]).map(s => (
                  <span key={s} className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">{s}</span>
                ))}
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500">
                <DollarSign size={16} />
                <span>₱{tutee.ratePerSession} per month</span>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">Months: {tutee.totalSessions}</span>
                  <span className="text-gray-500">Paid: ₱{tutee.totalPaid.toFixed(2)}</span>
                </div>
              </div>

              <div className="mt-4">
                <span className="inline-flex items-center gap-2 text-green-700 font-medium text-sm group-hover:gap-3 transition-all">
                  Track Payments
                  <span>→</span>
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
