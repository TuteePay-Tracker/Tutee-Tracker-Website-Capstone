import { useState, useEffect } from 'react';
import { useTutees } from '@/features/tutees/hooks/useTutees';
import { usePayments } from '@/features/payments/hooks/usePayments';
import { DayPaymentTracker } from '@/features/attendance/components/DayPaymentTracker';
import { Users, Calendar, DollarSign, BookOpen, X, Eye, CheckCircle2, XCircle, AlertCircle, ExternalLink, User } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { dayPaymentService } from '@/features/attendance/services/dayPaymentService';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

export const PaymentTracking = () => {
  const { tutees, isLoading: loadingTutees } = useTutees();
  const { payments, refreshPayments, isLoading: loadingPayments } = usePayments();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTutee, setSelectedTutee] = useState<{ id: string; name: string } | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  const [reviewingPayment, setReviewingPayment] = useState<any>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [coverageType, setCoverageType] = useState<'full' | 'partial'>('full');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (reviewingPayment) {
      const tutee = tutees.find(t => t.id === reviewingPayment.tuteeId);
      const expectedRate = tutee ? tutee.ratePerSession : 0;
      if (reviewingPayment.amount >= expectedRate) {
        setCoverageType('full');
      } else {
        setCoverageType('partial');
      }
    }
  }, [reviewingPayment, tutees]);

  const pendingPayments = payments.filter(p => p.status === 'pending');
  const isLoading = loadingTutees || loadingPayments;

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

  const handleApprove = async (payment: any) => {
    setIsProcessing(true);
    try {
      await dayPaymentService.verifyPendingPayment(payment, coverageType);
      toast.success('Payment approved and recorded successfully!');
      setReviewingPayment(null);
      refreshPayments();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to approve payment');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (paymentId: string) => {
    setIsProcessing(true);
    try {
      await dayPaymentService.rejectPendingPayment(paymentId, rejectionReason);
      toast.success('Payment rejected successfully');
      setReviewingPayment(null);
      setRejectionReason('');
      refreshPayments();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to reject payment');
    } finally {
      setIsProcessing(false);
    }
  };

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

      {/* Pending Verifications */}
      {pendingPayments.length > 0 && (
        <div className="bg-white rounded-2xl border-2 border-amber-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-amber-800">
            <AlertCircle size={22} className="text-amber-600 animate-pulse" />
            <h2 className="text-lg font-bold">Pending Payment Verifications ({pendingPayments.length})</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingPayments.map((payment) => {
              const matchedTutee = tutees.find(t => t.id === payment.tuteeId);
              return (
                <div key={payment.id} className="border border-amber-100 rounded-xl p-4 bg-amber-50/30 flex flex-col justify-between gap-3 shadow-sm">
                  <div>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        {matchedTutee?.photoUrl ? (
                          <img
                            src={matchedTutee.photoUrl}
                            alt={payment.tuteeName}
                            className="w-8 h-8 rounded-full object-cover border border-amber-200 shadow-sm"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-100 to-emerald-200 flex items-center justify-center border border-amber-200 shadow-sm">
                            <User size={14} className="text-green-700" />
                          </div>
                        )}
                        <h3 className="font-bold text-gray-900 text-sm">{payment.tuteeName}</h3>
                      </div>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                      {payment.paymentMethod}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 capitalize">
                    Month: {payment.month ? format(parseISO(payment.month + '-01'), 'MMMM yyyy') : 'N/A'}
                  </p>
                  <p className="text-base font-extrabold text-green-700 mt-2">
                    {formatCurrency(payment.amount)}
                  </p>
                  {payment.notes && (
                    <p className="text-xs text-gray-600 mt-2 line-clamp-1 italic">
                      Notes: {payment.notes}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setReviewingPayment(payment)}
                  className="w-full flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 rounded-xl text-xs transition-colors shadow-sm"
                >
                  <Eye size={14} /> Review Proof
                </button>
              </div>
            );
          })}
          </div>
        </div>
      )}

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
            <label className="flex text-xs font-medium text-gray-500 mb-1 items-center gap-1">
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
                {tutee.photoUrl ? (
                  <img
                    src={tutee.photoUrl}
                    alt={`${tutee.firstName} ${tutee.surname}`}
                    className="w-12 h-12 rounded-xl object-cover border border-gray-200 shadow-md shadow-green-700/10"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-600 to-green-700 flex items-center justify-center shadow-lg shadow-green-700/20">
                    <Calendar className="text-white" size={24} />
                  </div>
                )}
                <div className="text-right">
                  <p className="text-xs text-gray-500 font-medium">Status</p>
                  {tutee.totalPaid > 0 && tutee.balance <= 0 ? (
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                      ✓ Paid
                    </span>
                  ) : tutee.totalPaid > 0 && tutee.balance > 0 ? (
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                      ₱{tutee.balance.toFixed(2)} due
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      Unpaid
                    </span>
                  )}
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

      {/* Review Payment Modal */}
      {reviewingPayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 my-8">
            {/* Header */}
            <div className="bg-gradient-to-br from-amber-600 to-amber-950 p-6 flex justify-between items-start text-white">
              <div className="flex items-center gap-3">
                {(() => {
                  const t = tutees.find(tuteeItem => tuteeItem.id === reviewingPayment.tuteeId);
                  return t?.photoUrl ? (
                    <img
                      src={t.photoUrl}
                      alt={reviewingPayment.tuteeName}
                      className="w-12 h-12 rounded-full object-cover border-2 border-white/50 shadow-sm"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center border-2 border-white/20 shadow-sm">
                      <User size={22} className="text-white" />
                    </div>
                  );
                })()}
                <div>
                  <h3 className="font-bold text-lg">Verify Parent Payment</h3>
                  <p className="text-amber-100 text-xs mt-0.5">Submitted by parent for {reviewingPayment.tuteeName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setReviewingPayment(null); setRejectionReason(''); }}
                className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Details grid */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl text-sm border border-gray-100">
                <div>
                  <span className="text-xs text-gray-400 font-bold uppercase block">Billing Month</span>
                  <span className="font-bold text-gray-800 capitalize">
                    {reviewingPayment.month ? format(parseISO(reviewingPayment.month + '-01'), 'MMMM yyyy') : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 font-bold uppercase block">Amount Paid</span>
                  <span className="font-extrabold text-green-700 text-base">
                    {formatCurrency(reviewingPayment.amount)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 font-bold uppercase block">Payment Method</span>
                  <span className="font-bold text-gray-800">{reviewingPayment.paymentMethod}</span>
                </div>
                <div>
                  <span className="text-xs text-gray-400 font-bold uppercase block">Submission Date</span>
                  <span className="font-semibold text-gray-600">{new Date(reviewingPayment.paymentDate).toLocaleDateString()}</span>
                </div>
                {reviewingPayment.notes && (
                  <div className="col-span-2 border-t border-gray-200 pt-2 mt-1">
                    <span className="text-xs text-gray-400 font-bold uppercase block">Parent Notes / Reference</span>
                    <span className="font-medium text-gray-700 text-xs italic">{reviewingPayment.notes}</span>
                  </div>
                )}
              </div>

              {/* Proof Image */}
              {reviewingPayment.proofUrl && (
                <div>
                  <label className="block text-xs uppercase font-extrabold text-gray-400 tracking-wider mb-2">
                    Proof of Payment screenshot
                  </label>
                  <div className="w-full h-64 bg-gray-100 border border-gray-200 rounded-xl overflow-hidden relative group shadow-inner flex items-center justify-center">
                    <img
                      src={reviewingPayment.proofUrl}
                      alt="Proof of Payment"
                      className="max-w-full max-h-full object-contain"
                    />
                    <a
                      href={reviewingPayment.proofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute bottom-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-lg p-2 flex items-center gap-1 text-xs font-bold transition-colors"
                    >
                      <ExternalLink size={12} /> Open Full Image
                    </a>
                  </div>
                </div>
              )}

              {/* Rejection input */}
              <div className="space-y-1.5">
                <label className="block text-xs uppercase font-extrabold text-gray-400 tracking-wider">
                  Rejection Reason (Optional, only used if rejecting)
                </label>
                <input
                  type="text"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Reference number not found, incorrect amount"
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Confirm Coverage Type input */}
              <div className="space-y-1.5">
                <label className="block text-xs uppercase font-extrabold text-gray-400 tracking-wider">
                  Confirm Payment Type
                </label>
                <div className="flex gap-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="coverageType"
                      value="full"
                      checked={coverageType === 'full'}
                      onChange={() => setCoverageType('full')}
                      className="text-green-700 focus:ring-green-500 w-4 h-4 cursor-pointer"
                    />
                    Full Payment
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="coverageType"
                      value="partial"
                      checked={coverageType === 'partial'}
                      onChange={() => setCoverageType('partial')}
                      className="text-green-700 focus:ring-green-500 w-4 h-4 cursor-pointer"
                    />
                    Partial Payment
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => handleReject(reviewingPayment.id)}
                  disabled={isProcessing}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold text-sm transition-colors text-center shadow-md"
                >
                  <XCircle size={16} /> Reject Payment
                </button>
                <button
                  type="button"
                  onClick={() => handleApprove(reviewingPayment)}
                  disabled={isProcessing}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800 disabled:bg-gray-300 text-white py-3 rounded-xl font-bold text-sm transition-colors text-center shadow-lg shadow-green-700/10"
                >
                  <CheckCircle2 size={16} /> Approve & Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
