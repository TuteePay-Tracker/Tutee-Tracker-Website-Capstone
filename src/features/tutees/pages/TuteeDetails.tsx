import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router';
import { useTutees } from '@/features/tutees/hooks/useTutees';
import { usePayments } from '@/features/payments/hooks/usePayments';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { formatCurrency } from '@/shared/utils/formatCurrency';
import { formatDate, formatTime12h } from '@/shared/utils/formatDate';
import {
  ArrowLeft, Mail, Phone, Calendar, CalendarX, DollarSign, BookOpen, Users,
  X, Copy, CheckCircle2, FileText, AlertCircle, XCircle, Clock,
  Download, Upload, Smartphone, TrendingUp, TrendingDown, Minus, Star, Hash,
  Pencil, GraduationCap, ChevronUp, ChevronDown
} from 'lucide-react';
import { ImageUpload } from '@/shared/components/ui/ImageUpload';
import { PaymentHistory } from '@/features/payments/components/PaymentHistory';
import { useAssessments } from '@/features/tutee-progress/hooks/useAssessments';
import { ScheduleItem, GRADE_LEVELS } from '@/features/tutees/types/tutee';
import { useSubjects } from '@/features/tutees/hooks/useSubjects';
import { PaymentRecord } from '@/features/attendance/types/dayPayment';
import { PaymentMethod } from '@/features/payments/types/payment';
import { dayPaymentService } from '@/features/attendance/services/dayPaymentService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase/config';
import gcashLogo from '@/assets/gcash-com-logo.png';
import mayaLogo from '@/assets/id5dWPPLkV_logos.jpeg';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { logActivity } from '@/shared/utils/auditLogger';

export const TuteeDetails = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { getTuteeById, tutees, updateTutee, isLoading: loadingTutees } = useTutees();
  const { getPaymentsByTuteeId, deletePayment, loadPaymentsForTutee, addPayment, isLoading: loadingPayments } = usePayments();
  const { subjects } = useSubjects();

  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: '',
    surname: '',
    email: '',
    guardianNumber: '',
    guardianEmail: '',
    address: '',
    gradeLevel: '',
    ratePerSession: 0,
    subjects: [] as string[],
  });

  const tutee = id ? getTuteeById(id) : undefined;
  const payments = id ? getPaymentsByTuteeId(id) : [];

  const handleStartEdit = () => {
    if (!tutee) return;
    setEditForm({
      firstName: tutee.firstName || '',
      surname: tutee.surname || '',
      email: tutee.email || '',
      guardianNumber: tutee.guardianNumber || '',
      guardianEmail: tutee.guardianEmail || '',
      address: tutee.address || '',
      gradeLevel: tutee.gradeLevel || '',
      ratePerSession: tutee.ratePerSession || 0,
      subjects: tutee.subjects?.length ? tutee.subjects : (tutee.subject ? [tutee.subject] : []),
    });
    setIsEditingInfo(true);
  };

  const handleSaveInfo = async () => {
    if (!tutee || !updateTutee) return;
    try {
      if (!editForm.firstName.trim() || !editForm.surname.trim()) {
        toast.error('First name and surname are required');
        return;
      }
      if (editForm.subjects.length === 0) {
        toast.error('Please select at least one subject');
        return;
      }
      const updates = {
        firstName: editForm.firstName.trim(),
        surname: editForm.surname.trim(),
        email: editForm.email.trim(),
        guardianNumber: editForm.guardianNumber.trim(),
        guardianEmail: editForm.guardianEmail.trim(),
        address: editForm.address.trim(),
        gradeLevel: editForm.gradeLevel,
        ratePerSession: Number(editForm.ratePerSession),
        subjects: editForm.subjects,
        subject: editForm.subjects[0] || '', // primary subject
      };
      await updateTutee(tutee.id, updates);
      setIsEditingInfo(false);
      toast.success('Personal information updated successfully');

      if (user) {
        await logActivity(
          user.id,
          user.name,
          user.role,
          'Student Updated',
          'Students',
          `Updated personal information for student ${updates.firstName} ${updates.surname}`
        );
      }
    } catch (error) {
      console.error('Failed to update tutee details:', error);
      toast.error('Failed to update personal information');
    }
  };

  const [activeTab, setActiveTab] = useState<'overview' | 'attendance' | 'payments' | 'reports'>('overview');
  const [expandedAssessmentId, setExpandedAssessmentId] = useState<string | null>(null);
  const [showParentModal, setShowParentModal] = useState(false);
  const [parentData, setParentData] = useState<any>(null);
  const [loadingParent, setLoadingParent] = useState(false);

  // Parent payment states
  const [tutorPaymentMethods, setTutorPaymentMethods] = useState<any>(null);
  const [loadingTutorPayment, setLoadingTutorPayment] = useState(false);
  const [payingRecord, setPayingRecord] = useState<PaymentRecord | null>(null);

  // Load tutor payment settings if parent role
  useEffect(() => {
    const loadTutorDetails = async () => {
      if (user?.role === 'parent' && user.createdByTutorId) {
        setLoadingTutorPayment(true);
        try {
          const tutorDoc = await getDoc(doc(db, 'users', user.createdByTutorId));
          if (tutorDoc.exists()) {
            setTutorPaymentMethods(tutorDoc.data().paymentMethods || {});
          }
        } catch (error) {
          console.error('Error fetching tutor payment details:', error);
        } finally {
          setLoadingTutorPayment(false);
        }
      }
    };

    loadTutorDetails();
  }, [user]);

  // Attendance states
  const [attendanceRecords, setAttendanceRecords] = useState<PaymentRecord[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);

  // Load payments and attendance when tutee changes
  useEffect(() => {
    let unsubscribeAttendance: (() => void) | undefined;
    let unsubscribePayments: (() => void) | undefined;

    if (tutee) {
      // Always subscribe to attendance and payments to ensure accurate financial summary
      unsubscribeAttendance = loadAttendance();

      if (user?.role === 'parent') {
        if (user.createdByTutorId) {
          unsubscribePayments = loadPaymentsForTutee(tutee.id, user.createdByTutorId);
        }
      }
    }

    return () => {
      unsubscribeAttendance?.();
      unsubscribePayments?.();
    };
  }, [tutee, user]);

  const loadAttendance = () => {
    if (!tutee) return;
    setLoadingAttendance(true);
    const tutorId = user?.role === 'parent' ? user.createdByTutorId : undefined;

    return dayPaymentService.subscribeToRecordsByTutee(
      tutee.id,
      (data) => {
        setAttendanceRecords(data);
        setLoadingAttendance(false);
      },
      tutorId
    );
  };

  const { assessments } = useAssessments();

  const studentAssessments = useMemo(() => {
    if (!tutee || !assessments.length) return [];
    return assessments.filter(a => a.tuteeId === tutee.id).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [tutee, assessments]);

  const assessmentSummary = useMemo(() => {
    if (!studentAssessments.length) return null;
    const scores = studentAssessments.map(a => a.score);
    const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
    const improvement = scores.length >= 2 ? Math.max(...scores) - Math.min(...scores) : 0;
    const latestScore = scores[scores.length - 1];
    
    // Calculate slope (trend)
    const n = scores.length;
    let trend = 0;
    if (n >= 2) {
      const xMean = (n - 1) / 2;
      const yMean = avg;
      let num = 0, den = 0;
      scores.forEach((y, x) => {
        num += (x - xMean) * (y - yMean);
        den += (x - xMean) ** 2;
      });
      trend = den === 0 ? 0 : Math.round((num / den) * 10) / 10;
    }

    return { avg, trend, improvement, latestScore, totalAssessments: scores.length };
  }, [studentAssessments]);

  const subjectSummaries = useMemo(() => {
    if (!studentAssessments.length) return [];
    
    const bySubject: Record<string, typeof studentAssessments> = {};
    studentAssessments.forEach(a => {
      if (!bySubject[a.subject]) bySubject[a.subject] = [];
      bySubject[a.subject].push(a);
    });

    return Object.entries(bySubject).map(([subject, assessments]) => {
      const scores = assessments.map(a => a.score);
      const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
      return {
        subject,
        avg,
        count: assessments.length
      };
    });
  }, [studentAssessments]);

  const handleViewParent = async () => {
    if (!tutee?.parentId) return;
    setShowParentModal(true);
    if (parentData) return; // already loaded

    setLoadingParent(true);
    try {
      const parentDoc = await getDoc(doc(db, 'users', tutee.parentId));
      if (parentDoc.exists()) {
        setParentData(parentDoc.data());
      } else {
        toast.error('Parent account not found');
      }
    } catch (error) {
      console.error('Error fetching parent:', error);
      toast.error('Failed to load parent account');
    } finally {
      setLoadingParent(false);
    }
  };

  const getStudentName = (studentId: string) => {
    const s = tutees.find(t => t.id === studentId);
    return s ? `${s.firstName} ${s.surname}` : studentId;
  };

  // Helper to render schedule (handles both old string and new array format)
  const renderSchedule = (schedule: string | ScheduleItem[]) => {
    if (Array.isArray(schedule)) {
      return schedule.map((slot, index) => {
        // Handle new format with startTime/endTime
        if (typeof slot === 'object' && slot !== null && 'startTime' in slot && 'endTime' in slot) {
          return (
            <div key={index}>{slot.day}: {formatTime12h(slot.startTime)} - {formatTime12h(slot.endTime)}</div>
          );
        }
        // Handle old format with just time
        else if (typeof slot === 'object' && slot !== null && 'time' in slot) {
          return (
            <div key={index}>{(slot as any).day} - {formatTime12h((slot as any).time)}</div>
          );
        }
        return <div key={index}>{typeof slot === 'string' ? slot : (slot as any).day}</div>;
      });
    }
    return <div>{schedule}</div>; // Old string format
  };

  if (loadingTutees || loadingPayments) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div>
        <span className="ml-3 text-gray-500 font-medium">Loading details...</span>
      </div>
    );
  }

  if (!tutee) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Student not found</p>
        <Link to={user?.role === 'parent' ? '/' : '/tutees'} className="text-green-700 hover:underline mt-4 inline-block">
          Back to list
        </Link>
      </div>
    );
  }

  // Calculate accurate totals from source records instead of relying on aggregate counters
  // Total Paid: Sum only verified payments.
  const totalPaid = payments
    .filter(p => p.status === 'verified' || !p.status)
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  // Remaining Balance: Sum of all monthly balances from attendance records.
  // If attendance hasn't loaded yet, fall back to the document calculation.
  const remainingBalance = attendanceRecords.length > 0
    ? attendanceRecords.reduce((sum, r) => sum + Math.max(r.totalBalance || 0, 0), 0)
    : Math.max(0, ((tutee.totalSessions || 0) * (tutee.ratePerSession || 0)) - (tutee.totalPaid || 0));
  const remainingBalanceCents = Math.round(remainingBalance * 100);
  const hasOutstandingBalance = remainingBalanceCents > 0;
  const totalDue = Math.round((totalPaid + remainingBalance) * 100) / 100;
  const isFull = (tutee.totalSessions || 0) > 0 && !hasOutstandingBalance;
  const isPartial = hasOutstandingBalance && totalPaid > 0;
  const backLink = user?.role === 'parent' ? '/' : '/tutees';

  const currentMonthStr = format(new Date(), 'yyyy-MM');
  const currentMonthRecord = attendanceRecords.find(r => r.month === currentMonthStr);
  const isCurrentMonthFullyPaid = currentMonthRecord 
    ? currentMonthRecord.totalBalance <= 0 
    : false;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to={backLink} className="text-gray-600 hover:text-gray-800 p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{tutee.firstName} {tutee.surname}</h1>
          <p className="text-gray-600 mt-1">{tutee.subject}</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6" aria-label="Tabs">
          {[
            { id: 'overview', name: 'Overview' },
            ...(user?.role === 'parent' ? [{ id: 'attendance', name: 'Attendance' }] : []),
            { id: 'payments', name: 'Payments' },
            { id: 'reports', name: 'Progress Reports' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                  ? 'border-green-700 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl border p-6 shadow-sm font-sans">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-gray-950">Personal Information</h2>
                {user?.role === 'tutor' && !isEditingInfo && (
                  <button
                    onClick={handleStartEdit}
                    className="p-1.5 text-gray-400 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors border border-transparent hover:border-gray-250"
                    title="Edit Personal Information"
                  >
                    <Pencil size={16} />
                  </button>
                )}
              </div>

              {isEditingInfo ? (
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">First Name *</label>
                    <input
                      type="text"
                      value={editForm.firstName}
                      onChange={e => setEditForm({ ...editForm, firstName: e.target.value })}
                      className="w-full p-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-700 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Surname *</label>
                    <input
                      type="text"
                      value={editForm.surname}
                      onChange={e => setEditForm({ ...editForm, surname: e.target.value })}
                      className="w-full p-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-700 outline-none"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Email</label>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                      className="w-full p-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-700 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Guardian Number</label>
                    <input
                      type="text"
                      value={editForm.guardianNumber}
                      onChange={e => setEditForm({ ...editForm, guardianNumber: e.target.value })}
                      className="w-full p-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-700 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Guardian Email</label>
                    <input
                      type="email"
                      value={editForm.guardianEmail}
                      onChange={e => setEditForm({ ...editForm, guardianEmail: e.target.value })}
                      className="w-full p-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-700 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Address</label>
                    <input
                      type="text"
                      value={editForm.address}
                      onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                      className="w-full p-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-700 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Grade Level</label>
                    <select
                      value={editForm.gradeLevel}
                      onChange={e => setEditForm({ ...editForm, gradeLevel: e.target.value })}
                      className="w-full p-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-700 outline-none bg-white"
                    >
                      <option value="">Select grade level</option>
                      {GRADE_LEVELS.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Rate per Month (₱)</label>
                    <input
                      type="number"
                      value={editForm.ratePerSession}
                      onChange={e => setEditForm({ ...editForm, ratePerSession: Number(e.target.value) })}
                      className="w-full p-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-green-700 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Subjects</label>
                    <div className="flex flex-wrap gap-1.5 p-2 border border-gray-200 rounded-xl min-h-[42px] bg-white">
                      {subjects.map(s => {
                        const isSelected = editForm.subjects.includes(s.name);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setEditForm({
                                  ...editForm,
                                  subjects: editForm.subjects.filter(name => name !== s.name)
                                });
                              } else {
                                setEditForm({
                                  ...editForm,
                                  subjects: [...editForm.subjects, s.name]
                                });
                              }
                            }}
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all ${
                              isSelected
                                ? 'bg-green-700 border-green-700 text-white shadow-sm'
                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            {s.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2.5 pt-3">
                    <button
                      onClick={handleSaveInfo}
                      className="flex-1 bg-green-700 hover:bg-green-800 text-white font-bold text-sm py-2.5 rounded-xl transition-colors shadow-sm"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setIsEditingInfo(false)}
                      className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm py-2.5 rounded-xl transition-colors border border-gray-250"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {tutee.email && (
                    <div className="flex items-center gap-3 text-sm text-gray-700">
                      <Mail size={18} className="text-gray-400 shrink-0" />
                      <span>{tutee.email}</span>
                    </div>
                  )}
                  {tutee.guardianNumber && (
                    <div className="flex items-center gap-3 text-sm text-gray-700">
                      <Phone size={18} className="text-gray-400 shrink-0" />
                      <div>
                        <div className="text-xs text-gray-400 font-medium">Guardian/Parent Phone</div>
                        <div className="font-semibold mt-0.5">{tutee.guardianNumber}</div>
                      </div>
                    </div>
                  )}
                  {tutee.guardianEmail && (
                    <div className="flex items-center gap-3 text-sm text-gray-700">
                      <Mail size={18} className="text-gray-400 shrink-0" />
                      <div>
                        <div className="text-xs text-gray-400 font-medium">Guardian/Parent Email</div>
                        <div className="font-semibold mt-0.5">{tutee.guardianEmail}</div>
                      </div>
                    </div>
                  )}
                  {tutee.address && (
                    <div className="flex items-start gap-3 text-sm text-gray-700">
                      <Smartphone size={18} className="text-gray-400 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs text-gray-400 font-medium">Address</div>
                        <div className="font-semibold mt-0.5 leading-relaxed">{tutee.address}</div>
                      </div>
                    </div>
                  )}
                  {tutee.gradeLevel && (
                    <div className="flex items-center gap-3 text-sm text-gray-700">
                      <GraduationCap size={18} className="text-gray-400 shrink-0" />
                      <div>
                        <div className="text-xs text-gray-400 font-medium">Grade Level</div>
                        <div className="font-semibold mt-0.5">{tutee.gradeLevel}</div>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-3 text-sm text-gray-700">
                    <BookOpen size={18} className="text-gray-400 mt-1 shrink-0" />
                    <div>
                      <div className="text-xs text-gray-400 font-medium mb-1">Subjects</div>
                      <div className="flex flex-wrap gap-1">
                        {(tutee.subjects?.length ? tutee.subjects : [tutee.subject]).map(s => (
                          <span key={s} className="px-2.5 py-0.5 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-200">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 text-sm text-gray-700">
                    <Calendar size={18} className="text-gray-400 mt-1 shrink-0" />
                    <div>
                      <div className="text-xs text-gray-400 font-medium mb-1">Schedule</div>
                      <div className="space-y-1 font-medium">{renderSchedule(tutee.schedule)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-700">
                    <DollarSign size={18} className="text-gray-400 shrink-0" />
                    <div>
                      <div className="text-xs text-gray-400 font-medium">Rate / Month</div>
                      <div className="font-semibold mt-0.5">₱{tutee.ratePerSession.toLocaleString()}</div>
                    </div>
                  </div>

                  {user?.role !== 'parent' && (
                    <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col gap-2">
                      {tutee.parentId ? (
                        <>
                          <div className="flex items-center gap-2 text-xs text-green-700 font-semibold bg-green-50 px-2.5 py-1.5 rounded-lg border border-green-200 w-fit">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                            Parent Portal Linked
                          </div>
                          <button
                            onClick={handleViewParent}
                            className="w-full flex items-center justify-center gap-2 border border-green-700 text-green-700 px-3 py-2 rounded-xl hover:bg-green-50 text-sm font-medium transition-colors mt-1"
                          >
                            <Users size={16} />
                            Show Parent Account
                          </button>
                        </>
                      ) : (
                        <div className="mt-2 text-xs text-gray-500 flex items-center gap-1.5">
                          <Users size={14} className="text-gray-400" />
                          No parent portal account linked
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl border p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-950 mb-4">Financial Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex justify-between pb-3 border-b border-gray-100 text-sm text-gray-600">
                    <span>Months Completed</span>
                    <span className="font-semibold text-gray-900">{tutee.totalSessions}</span>
                  </div>
                  <div className="flex justify-between pb-3 border-b border-gray-100 text-sm text-gray-600">
                    <span>Rate per Month</span>
                    <span className="font-semibold text-gray-900">₱{tutee.ratePerSession.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pb-3 border-b border-gray-100 text-sm text-gray-600">
                    <span>Total Due</span>
                    <span className="font-semibold text-gray-900">₱{totalDue.toLocaleString()}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between pb-3 border-b border-gray-100 text-sm text-gray-600">
                    <span>Total Paid</span>
                    <span className="font-semibold text-green-700">₱{totalPaid.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-1 text-sm">
                    <span className="font-medium text-gray-600">Remaining Balance</span>
                    <span className={`font-bold text-lg ${isFull
                        ? 'text-green-600'
                        : isPartial
                          ? 'text-orange-600'
                          : 'text-gray-500'
                      }`}>
                      ₱{remainingBalance.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-end mt-2">
                    {isFull ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-green-700 bg-green-100 border border-green-200 px-3 py-1 rounded-full">
                        <CheckCircle2 size={12} /> Full Payment
                      </span>
                    ) : isPartial ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 bg-orange-100 border border-orange-200 px-3 py-1 rounded-full">
                        <AlertCircle size={12} /> Partial Payment
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 bg-gray-100 border border-gray-200 px-3 py-1 rounded-full">
                        <AlertCircle size={12} /> Unpaid
                      </span>
                    )}
                  </div>
                  {tutee.lastPaymentDate && (
                    <div className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3 border border-gray-100 mt-2">
                      Last payment recorded on: <strong>{formatDate(tutee.lastPaymentDate)}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-700 to-green-900 rounded-2xl p-6 text-white shadow-lg shadow-green-700/10">
              <div className="flex items-center gap-3 mb-2">
                <BookOpen size={24} className="text-green-200" />
                <h3 className="font-bold text-lg">Session Progress</h3>
              </div>
              <p className="text-4xl font-extrabold">{tutee.totalSessions}</p>
              <p className="text-green-100 text-sm mt-1">Total months completed & invoiced</p>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Tab */}
      {activeTab === 'attendance' && user?.role === 'parent' && (
        <div className="bg-white rounded-2xl border p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-lg font-bold text-gray-955">Attendance History</h2>
              <p className="text-gray-500 text-sm mt-0.5">
                Tutor-marked attendance records by month
              </p>
            </div>
            {loadingAttendance && (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-700"></div>
            )}
          </div>

          {attendanceRecords.length === 0 ? (
            <div className="text-center py-16">
              <Calendar className="mx-auto text-gray-300 mb-4" size={48} />
              <p className="text-gray-500 text-lg">No attendance history available</p>
              <p className="text-gray-400 text-sm mt-1">Attendance logs will appear here once session dates are generated.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {attendanceRecords.map((record) => {
                const presentCount = record.dayPayments.filter(d => d.status === 'paid').length;
                const absentCount = record.dayPayments.filter(d => d.status === 'partial').length;
                const totalSessions = record.dayPayments.filter(d => d.status !== 'no-class').length;
                return (
                  <div key={record.id} className="border border-gray-100 rounded-2xl p-6 bg-gray-50/50 space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-gray-200 pb-3">
                      <div>
                        <h3 className="font-bold text-gray-900 text-lg capitalize">
                          {format(parseISO(record.month + '-01'), 'MMMM yyyy')}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Total Sessions: <strong>{totalSessions} scheduled</strong> ({presentCount} present, {absentCount} absent)
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="bg-green-50 text-green-800 text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-green-200 shrink-0">
                          {presentCount} Present
                        </div>
                        <div className="bg-red-50 text-red-800 text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-red-200 shrink-0">
                          {absentCount} Absent
                        </div>
                      </div>
                    </div>

                    {record.dayPayments.length === 0 ? (
                      <p className="text-gray-500 text-sm italic">No scheduled days for this month.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {record.dayPayments.map((day) => {
                          let cardClass = 'bg-white border-gray-200 text-gray-500';
                          let statusLabel = 'Scheduled';
                          let statusIcon = <Clock size={14} className="text-gray-400" />;
                          let labelColorClass = 'text-gray-400';

                          if (day.status === 'paid') {
                            cardClass = 'bg-green-50 border-green-200 text-green-800';
                            statusLabel = 'Present';
                            statusIcon = <CheckCircle2 size={14} className="text-green-600" />;
                            labelColorClass = 'text-green-600';
                          } else if (day.status === 'partial') {
                            cardClass = 'bg-red-50 border-red-200 text-red-800';
                            statusLabel = 'Absent';
                            statusIcon = <XCircle size={14} className="text-red-505" />;
                            labelColorClass = 'text-red-600';
                          } else if (day.status === 'no-class') {
                            cardClass = 'bg-purple-50 border-purple-200 text-purple-800';
                            statusLabel = 'No Class';
                            statusIcon = <CalendarX size={14} className="text-purple-600" />;
                            labelColorClass = 'text-purple-650';
                          }

                          return (
                            <div
                              key={day.date}
                              className={`p-3 rounded-xl border flex flex-col gap-1 items-center justify-center text-center w-full ${cardClass}`}
                            >
                              {statusIcon}
                              <span className="text-xs font-bold mt-1">{format(parseISO(day.date), 'EEE, MMM dd')}</span>
                              <span className={`text-[9px] uppercase font-extrabold tracking-wider ${labelColorClass}`}>
                                {statusLabel}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          {user?.role === 'parent' && (
            <div className="bg-white rounded-2xl border p-6 shadow-sm">
              <h2 className="text-lg font-bold text-gray-955 mb-4">Unpaid Balances</h2>
              {isCurrentMonthFullyPaid && (
                <div className="flex items-center gap-3 bg-green-50 border-2 border-green-200 rounded-xl p-4 mb-6 shadow-sm">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={18} className="text-green-700 animate-none" />
                  </div>
                  <p className="text-green-800 font-bold text-sm">
                    You’re fully paid this month. You can proceed to the next payment.
                  </p>
                </div>
              )}
              {attendanceRecords.filter(r => r.totalBalance > 0).length === 0 ? (
                <div className="bg-green-50/50 border border-green-100 rounded-xl p-4 text-center">
                  <p className="text-green-800 font-semibold text-sm">All invoices are settled! No unpaid balances.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {attendanceRecords.filter(r => r.totalBalance > 0).map(record => {
                    const pendingPayment = payments.find(p => p.month === record.month && p.status === 'pending');
                    const rejectedPayment = payments.find(p => p.month === record.month && p.status === 'rejected');

                    return (
                      <div key={record.id} className="border border-gray-200 rounded-2xl p-4 flex flex-col justify-between gap-4 bg-gray-50/50 shadow-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-gray-900 text-base capitalize">
                              {format(parseISO(record.month + '-01'), 'MMMM yyyy')}
                            </h3>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {pendingPayment ? (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                  Verification Pending
                                </span>
                              ) : rejectedPayment ? (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                                  Rejected
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                                  Unpaid Balance
                                </span>
                              )}
                            </div>
                            {rejectedPayment && (
                              <p className="text-xs text-red-600 mt-2 italic font-semibold">
                                Reason: {rejectedPayment.notes?.split(' | Rejected: ')[1] || rejectedPayment.notes || 'Incorrect payment details'}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-400 font-medium">Balance Due</p>
                            <p className="font-extrabold text-gray-900 text-lg">{formatCurrency(record.totalBalance)}</p>
                          </div>
                        </div>

                        {!pendingPayment && (
                          <button
                            onClick={() => setPayingRecord(record)}
                            className="w-full bg-green-700 hover:bg-green-800 text-white font-bold py-2 rounded-xl text-sm transition-colors shadow-sm"
                          >
                            Pay Now
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="bg-white rounded-2xl border p-6 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-bold text-gray-955">Payment History</h2>
                <p className="text-gray-500 text-sm mt-0.5">Summary of tuition payments received</p>
              </div>
              {user?.role !== 'parent' && (
                <div className="flex gap-2">
                  <Link
                    to={`/payments?tuteeId=${tutee.id}`}
                    className="bg-green-700 text-white px-4 py-2 rounded-xl hover:bg-green-800 text-sm font-semibold transition-colors"
                  >
                    Monthly Payment Tracker
                  </Link>
                </div>
              )}
            </div>
            <PaymentHistory
              payments={payments}
              onDelete={user?.role !== 'parent' ? deletePayment : undefined}
              showTuteeName={false}
              tuteeRate={tutee.ratePerSession}
            />
          </div>
        </div>
      )}

      {/* Progress Reports Tab */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-white border rounded-2xl p-6 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-gray-955">Progress Reports</h2>
              <p className="text-gray-500 text-sm mt-0.5">Academic updates and performance evaluations</p>
            </div>
          </div>

          {assessmentSummary && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <Star size={16} className="text-gray-400" />
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Academic Performance Overview</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Average Score */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300" />
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center relative shrink-0">
                    <Star size={22} />
                  </div>
                  <div className="relative">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Average Score</p>
                    <p className="text-2xl font-bold text-gray-900 mt-0.5">{assessmentSummary.avg}%</p>
                  </div>
                </div>

                {/* Latest Score */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300" />
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center relative shrink-0">
                    <CheckCircle2 size={22} />
                  </div>
                  <div className="relative">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Latest Score</p>
                    <p className="text-2xl font-bold text-gray-900 mt-0.5">{assessmentSummary.latestScore}%</p>
                  </div>
                </div>

                {/* Max Improvement */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-teal-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300" />
                  <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center relative shrink-0">
                    <TrendingUp size={22} />
                  </div>
                  <div className="relative">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Max Improvement</p>
                    <p className="text-2xl font-bold text-emerald-600 mt-0.5">+{assessmentSummary.improvement}%</p>
                  </div>
                </div>

                {/* Score Trend */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all relative overflow-hidden group">
                  <div className={`absolute top-0 right-0 w-24 h-24 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300 ${
                    assessmentSummary.trend > 1 ? 'bg-emerald-50' : assessmentSummary.trend < -1 ? 'bg-red-50' : 'bg-gray-50'
                  }`} />
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center relative shrink-0 ${
                    assessmentSummary.trend > 1 ? 'bg-emerald-50 text-emerald-700' : assessmentSummary.trend < -1 ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-500'
                  }`}>
                    {assessmentSummary.trend > 1 ? <TrendingUp size={22} /> : assessmentSummary.trend < -1 ? <TrendingDown size={22} /> : <Minus size={22} />}
                  </div>
                  <div className="relative">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Score Trend</p>
                    <p className={`text-2xl font-bold mt-0.5 ${
                      assessmentSummary.trend > 1 ? 'text-emerald-600' : assessmentSummary.trend < -1 ? 'text-red-600' : 'text-gray-500'
                    }`}>{Math.abs(assessmentSummary.trend)}</p>
                  </div>
                </div>
              </div>
              <p className="text-gray-400 text-xs px-1 font-medium">Based on {assessmentSummary.totalAssessments} recorded assessments from the Tutee Progress tracker.</p>
            </div>
          )}

          {subjectSummaries.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <BookOpen size={16} className="text-gray-400" />
                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Subject Breakdown</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {subjectSummaries.map((subject, idx) => {
                  const isExcellent = subject.avg >= 90;
                  const isGood = subject.avg >= 75;
                  const bgCircle = isExcellent ? 'bg-emerald-50' : isGood ? 'bg-blue-50' : 'bg-red-50';
                  const iconBg = isExcellent ? 'bg-emerald-50 text-emerald-700' : isGood ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700';
                  const scoreColor = isExcellent ? 'text-emerald-600' : isGood ? 'text-blue-600' : 'text-red-600';
                  return (
                    <div key={idx} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all relative overflow-hidden group">
                      <div className={`absolute top-0 right-0 w-24 h-24 ${bgCircle} rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300`} />
                      <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center relative shrink-0`}>
                        <BookOpen size={22} />
                      </div>
                      <div className="relative flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider truncate">{subject.subject}</p>
                        <p className={`text-2xl font-bold mt-0.5 ${scoreColor}`}>{subject.avg}%</p>
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5 flex items-center gap-1">
                          <Hash size={9} /> {subject.count} {subject.count === 1 ? 'assessment' : 'assessments'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {studentAssessments.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border shadow-sm">
              <FileText className="mx-auto text-gray-300 mb-4" size={48} />
              <p className="text-gray-500 text-lg">No assessments recorded yet</p>
              <p className="text-gray-400 text-sm mt-1">Assessments will appear here once recorded by the tutor in Tutee Progress.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {[...studentAssessments].reverse().map((a) => (
                <div key={a.id} className="border border-gray-150 rounded-2xl bg-white overflow-hidden shadow-sm">
                  <button
                    type="button"
                    onClick={() => setExpandedAssessmentId(expandedAssessmentId === a.id ? null : a.id)}
                    className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50/55 transition-colors text-left"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-bold text-gray-500 text-sm">
                        {new Date(a.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      {a.topic && (
                        <span className="font-bold text-gray-700 bg-gray-100 px-3 py-1 rounded-full text-xs">
                          {a.topic}
                        </span>
                      )}
                      <span className="text-xs px-2.5 py-1 bg-green-50 text-green-700 font-bold border border-green-200 rounded-full">
                        {a.subject}
                      </span>
                      <span className={`text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border ${
                        a.remarks === 'Excellent' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        a.remarks === 'Good' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {a.remarks}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-black text-blue-600 bg-blue-50/50 px-3 py-1 rounded-xl">
                        {a.score}%
                      </span>
                      <span className="text-gray-400">
                        {expandedAssessmentId === a.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </span>
                    </div>
                  </button>

                  {expandedAssessmentId === a.id && (
                    <div className="px-6 pb-6 pt-4 border-t border-gray-100 bg-gray-50/20 space-y-4 text-sm text-gray-700">
                      {a.assessmentScores && a.assessmentScores.length > 0 && (
                        <div className="space-y-2">
                          <span className="font-bold text-gray-400 uppercase text-[10px] tracking-wider block text-gray-500">
                            Scores Breakdown:
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {a.assessmentScores.map((s, idx) => {
                              const rowPct = s.totalScore > 0 
                                ? Math.round((s.score / s.totalScore) * 100) 
                                : 0;
                              return (
                                <div key={idx} className="bg-white border border-gray-150 rounded-xl px-4 py-3 flex justify-between items-center shadow-sm">
                                  <span className="font-bold text-gray-800 truncate">{s.name || `Score ${idx+1}`}</span>
                                  <span className="font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg text-xs shrink-0">
                                    {s.score} / {s.totalScore} pts ({rowPct}%)
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                        {a.notes && (
                          <div>
                            <span className="font-bold text-gray-400 uppercase text-[10px] tracking-wider block text-gray-500">Tutor Notes & Observations:</span>
                            <p className="mt-1 font-medium whitespace-pre-line bg-white p-3 rounded-xl border border-gray-200/80 shadow-sm leading-relaxed text-sm text-gray-850">{a.notes}</p>
                          </div>
                        )}
                        {a.recommendations && (
                          <div>
                            <span className="font-bold text-gray-400 uppercase text-[10px] tracking-wider block text-gray-500">Recommendations:</span>
                            <p className="mt-1 font-medium whitespace-pre-line bg-blue-50/40 text-blue-900 p-3 rounded-xl border border-blue-100 shadow-sm leading-relaxed text-sm">{a.recommendations}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Parent account details modal */}
      {showParentModal && parentData && (
        <ParentAccountModal
          parent={parentData}
          linkedStudentNames={parentData.linkedStudentIds?.map(getStudentName) || []}
          onClose={() => setShowParentModal(false)}
        />
      )}

      {payingRecord && (
        <ParentPaymentModal
          record={payingRecord}
          tutorPaymentMethods={tutorPaymentMethods}
          tutee={tutee}
          user={user}
          onClose={() => setPayingRecord(null)}
          onSubmit={async (payAmount, selectedMethodLabel, refNotes, proofUrl) => {
            try {
              await addPayment({
                tuteeId: tutee.id,
                tuteeName: `${tutee.firstName} ${tutee.surname}`,
                amount: payAmount,
                sessionsCovered: tutee.ratePerSession > 0 ? parseFloat((payAmount / tutee.ratePerSession).toFixed(2)) : 1,
                paymentMethod: selectedMethodLabel,
                paymentDate: new Date().toISOString().split('T')[0],
                notes: refNotes,
                month: payingRecord.month,
                status: 'pending',
                proofUrl: proofUrl
              }, user?.createdByTutorId);

              toast.success('Payment proof submitted successfully! The tutor will verify it.');
              setPayingRecord(null);
            } catch (err: any) {
              console.error(err);
              toast.error(err.message || 'Failed to submit payment proof');
            }
          }}
        />
      )}

      {showParentModal && loadingParent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700 mx-auto mb-4"></div>
            <p className="text-gray-600 text-sm font-medium">Loading parent account...</p>
          </div>
        </div>
      )}


    </div>
  );
};

/* ─── Parent account details modal ─────────────────────────────────────── */
interface ParentModalProps {
  parent: {
    name: string;
    email: string;
    contactNumber?: string;
    role: string;
    mustChangePassword?: boolean;
    linkedStudentIds?: string[];
    createdAt?: string;
  };
  linkedStudentNames: string[];
  onClose: () => void;
}

const ParentAccountModal = ({ parent, linkedStudentNames, onClose }: ParentModalProps) => {
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copied!`));
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-gray-100">
        <div className="bg-gradient-to-br from-green-700 to-green-950 bg-green-800 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                <Users size={24} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg leading-tight">Parent Portal Account</h3>
                <p className="text-green-100 text-sm mt-0.5">Linked Parent Account Details</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">Parent Name</p>
            <p className="font-semibold text-gray-900">{parent.name}</p>
          </div>

          {(() => {
            const isPhoneUsername = parent.email.endsWith('@tuteepay.local');
            const displayUsername = isPhoneUsername
              ? parent.email.split('@')[0]
              : parent.email;

            return (
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                <div className="flex-1">
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">
                    {isPhoneUsername ? 'Username (Contact Number)' : 'Username (Email)'}
                  </p>
                  <p className="font-mono font-semibold text-gray-900 text-sm">{displayUsername}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(displayUsername, 'Username')}
                  className="text-gray-400 hover:text-green-700 p-1.5 rounded-lg hover:bg-green-50 transition-colors"
                  title="Copy username"
                >
                  <Copy size={16} />
                </button>
              </div>
            );
          })()}

          {parent.contactNumber && (
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              <div className="flex-1">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">Contact Number</p>
                <p className="font-mono font-semibold text-gray-900 text-sm">{parent.contactNumber}</p>
              </div>
              <button
                onClick={() => copyToClipboard(parent.contactNumber!, 'Contact number')}
                className="text-gray-400 hover:text-green-700 p-1.5 rounded-lg hover:bg-green-50 transition-colors"
                title="Copy contact number"
              >
                <Copy size={16} />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-0.5">Account Status</p>
              {parent.mustChangePassword ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-50 text-amber-800 text-xs font-semibold rounded-full border border-amber-200">
                  <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                  Pending Password Change
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-green-50 text-green-800 text-xs font-semibold rounded-full border border-green-200">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                  Active
                </span>
              )}
            </div>
          </div>

          {linkedStudentNames.length > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-blue-500 font-semibold mb-1.5">Linked Student(s)</p>
              <div className="flex flex-wrap gap-1.5">
                {linkedStudentNames.map((name, i) => (
                  <span key={i} className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full font-semibold border border-blue-200">{name}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-2">
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

interface ParentPaymentModalProps {
  record: PaymentRecord;
  tutorPaymentMethods: any;
  tutee: any;
  user: any;
  onClose: () => void;
  onSubmit: (payAmount: number, methodLabel: PaymentMethod, notes: string, proofUrl: string) => Promise<void>;
}

const ParentPaymentModal = ({ record, tutorPaymentMethods, tutee, user, onClose, onSubmit }: ParentPaymentModalProps) => {
  const [selectedMethod, setSelectedMethod] = useState<'gcash' | 'maya' | 'bank' | 'other' | ''>('');
  const [payAmount, setPayAmount] = useState(record.totalBalance.toString());
  const [refNotes, setRefNotes] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Find enabled methods
  const enabledMethods = tutorPaymentMethods
    ? (['gcash', 'maya', 'bank', 'other'] as const).filter(m => tutorPaymentMethods[m]?.enabled)
    : [];

  // Automatically select first enabled method
  useEffect(() => {
    if (enabledMethods.length > 0 && !selectedMethod) {
      setSelectedMethod(enabledMethods[0]);
    }
  }, [enabledMethods, selectedMethod]);

  const methodLabelMap: Record<string, string> = {
    gcash: 'GCash',
    maya: 'PayMaya',
    bank: 'Bank Transfer',
    other: 'Other',
  };

  const handleDownloadQR = async (qrUrl: string, methodLabel: string) => {
    try {
      const response = await fetch(qrUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${tutee.firstName}_${methodLabel}_QR.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      toast.success('QR code download started');
    } catch (err) {
      console.error(err);
      // Fallback: open in new window
      window.open(qrUrl, '_blank');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountVal = parseFloat(payAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }
    if (!selectedMethod) {
      toast.error('Please select a payment method');
      return;
    }
    if (!proofUrl) {
      toast.error('Please upload proof of payment');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(amountVal, methodLabelMap[selectedMethod] as PaymentMethod, refNotes, proofUrl);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeMethodConfig = selectedMethod ? tutorPaymentMethods?.[selectedMethod] : null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 flex flex-col my-8">
        {/* Header */}
        <div className="bg-gradient-to-br from-green-700 to-green-950 p-6 flex justify-between items-start text-white">
          <div>
            <h3 className="font-bold text-lg">Submit Payment</h3>
            <p className="text-green-100 text-xs mt-0.5">
              Billing Month: <span className="capitalize">{format(parseISO(record.month + '-01'), 'MMMM yyyy')}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
          >
            <X size={20} />
          </button>
        </div>

        {enabledMethods.length === 0 ? (
          <div className="p-6 text-center space-y-4">
            <AlertCircle size={48} className="text-amber-500 mx-auto" />
            <p className="text-gray-600 font-medium text-sm">
              The tutor has not configured online payment methods.
            </p>
            <p className="text-gray-400 text-xs">
              Please contact your tutor directly to arrange Cash payment or get details.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-xl text-sm font-semibold transition-colors w-full"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5 flex-1 overflow-y-auto max-h-[75vh]">
            {/* Amount Due Info */}
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex justify-between items-center">
              <span className="text-sm text-green-800 font-bold">Remaining Balance:</span>
              <span className="text-xl font-extrabold text-green-900">{formatCurrency(record.totalBalance)}</span>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block text-xs uppercase font-extrabold text-gray-400 tracking-wider mb-2">
                Choose Payment Method
              </label>
              <div className="grid grid-cols-2 gap-2">
                {enabledMethods.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSelectedMethod(m)}
                    className={`px-4 py-3 rounded-xl border-2 text-sm font-bold flex items-center justify-center gap-2 transition-all ${selectedMethod === m
                        ? 'border-green-600 bg-green-50/50 text-green-800'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                  >
                    {m === 'gcash' ? (
                      <img src={gcashLogo} alt="GCash" className="w-5 h-5 rounded object-cover shrink-0" />
                    ) : m === 'maya' ? (
                      <img src={mayaLogo} alt="Maya" className="w-5 h-5 rounded object-cover shrink-0" />
                    ) : null}
                    {methodLabelMap[m]}
                  </button>
                ))}
              </div>
            </div>

            {/* Tutor Details & QR */}
            {activeMethodConfig && (
              <div className="border border-gray-150 rounded-xl p-4 bg-gray-50/50 space-y-4">
                <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                  {selectedMethod === 'gcash' ? (
                    <img src={gcashLogo} alt="GCash" className="w-5 h-5 rounded object-cover shrink-0" />
                  ) : selectedMethod === 'maya' ? (
                    <img src={mayaLogo} alt="Maya" className="w-5 h-5 rounded object-cover shrink-0" />
                  ) : (
                    <Smartphone size={16} className="text-green-700" />
                  )}
                  {methodLabelMap[selectedMethod!]} Payment Instructions
                </h4>

                <div className="p-3 bg-white border border-gray-100 rounded-lg text-sm text-gray-700 font-medium leading-relaxed shadow-sm space-y-2">
                  {activeMethodConfig.bankName && (
                    <div className="flex justify-between py-1 border-b border-gray-50 text-xs">
                      <span className="text-gray-400 font-bold uppercase">Bank / Provider</span>
                      <span className="font-extrabold text-gray-800">{activeMethodConfig.bankName}</span>
                    </div>
                  )}
                  {activeMethodConfig.accountName && (
                    <div className="flex justify-between py-1 border-b border-gray-50 text-xs">
                      <span className="text-gray-400 font-bold uppercase">Account Name</span>
                      <span className="font-bold text-gray-800">{activeMethodConfig.accountName}</span>
                    </div>
                  )}
                  {activeMethodConfig.accountNumber && (
                    <div className="flex justify-between py-1 border-b border-gray-50 text-xs">
                      <span className="text-gray-400 font-bold uppercase">Account Number</span>
                      <span className="font-bold text-gray-900 font-mono tracking-wider">{activeMethodConfig.accountNumber}</span>
                    </div>
                  )}
                  {activeMethodConfig.instructions && (
                    <div className="pt-2 text-xs text-gray-500 italic">
                      <span className="font-bold block not-italic text-gray-400 uppercase tracking-widest text-[9px] mb-0.5">Instructions</span>
                      {activeMethodConfig.instructions}
                    </div>
                  )}
                </div>

                {activeMethodConfig.qrUrl && (
                  <div className="flex flex-col items-center gap-3 pt-2">
                    <div className="w-48 h-48 bg-white border border-gray-200 rounded-xl p-2 shadow-sm flex items-center justify-center overflow-hidden">
                      <img
                        src={activeMethodConfig.qrUrl}
                        alt={`${methodLabelMap[selectedMethod!]} QR Code`}
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDownloadQR(activeMethodConfig.qrUrl, methodLabelMap[selectedMethod!])}
                      className="inline-flex items-center gap-2 text-xs font-bold text-green-700 hover:underline"
                    >
                      <Download size={14} /> Download QR Code Image
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Payment Details Input */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase font-extrabold text-gray-400 tracking-wider mb-1">
                  Amount Sent (₱) *
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 font-semibold"
                  placeholder="Enter sent amount"
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-extrabold text-gray-400 tracking-wider mb-2">
                  Upload Receipt / Proof of Payment (Image) *
                </label>
                <ImageUpload
                  currentUrl={proofUrl}
                  onUpload={(url) => setProofUrl(url)}
                  folder={`tuteepay/proofs/${user?.id}`}
                  shape="square"
                  size="md"
                  label="Select Image Screenshot"
                />
              </div>

              <div>
                <label className="block text-xs uppercase font-extrabold text-gray-400 tracking-wider mb-1">
                  Reference Code / Notes (Optional)
                </label>
                <input
                  type="text"
                  value={refNotes}
                  onChange={(e) => setRefNotes(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 font-medium text-sm"
                  placeholder="e.g. Reference No. 123456"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-bold text-sm transition-colors text-center"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !proofUrl}
                className="flex-1 bg-green-700 hover:bg-green-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold text-sm transition-colors text-center shadow-lg shadow-green-700/10"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Payment Proof'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
