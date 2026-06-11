import { useState, useEffect, useRef } from 'react';
import { useTutees } from '../hooks/useTutees';
import { useSubjects } from '../hooks/useSubjects';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency } from '../utils/formatCurrency';
import { Search, Plus, Pencil, Trash2, Eye, Users, UserPlus, Copy, CheckCircle, X, Printer, ShieldCheck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { Tutee, TuteeFormData, ScheduleItem, GRADE_LEVELS } from '../types/tutee';
import { toast } from 'sonner';
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db, firebaseConfig } from '../firebase/config';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';

const generateTempPassword = () => {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `JT${year}-${randomNum}`;
};

interface CreatedParentCredentials {
  name: string;
  contactNumber: string;
  tempPassword: string;
  studentName: string;
}

export const Tutees = () => {
  const { tutees, addTutee, updateTutee, deleteTutee, isLoading } = useTutees();
  const { subjects } = useSubjects();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'subject' | 'balance' | 'grade'>('name');
  const [showForm, setShowForm] = useState(false);
  const [editingTutee, setEditingTutee] = useState<Tutee | null>(null);
  const [createdParentCredentials, setCreatedParentCredentials] = useState<CreatedParentCredentials | null>(null);

  // Helper to format schedule (handles both old string and new array format)
  const formatSchedule = (schedule: string | ScheduleItem[]) => {
    if (Array.isArray(schedule)) {
      if (schedule.length === 0) return 'No schedule';

      // Get abbreviated day names
      const days = schedule.map(s => s.day.slice(0, 3)).join(', ');

      // Check if all days have the same time
      const firstItem = schedule[0];
      const hasSameTime = schedule.every(s =>
        'startTime' in s && 'endTime' in s &&
        s.startTime === firstItem.startTime &&
        s.endTime === firstItem.endTime
      );

      if (hasSameTime && 'startTime' in firstItem && 'endTime' in firstItem) {
        return `${days} • ${firstItem.startTime}-${firstItem.endTime}`;
      }

      // If times differ, show first day's time as example
      if ('startTime' in firstItem && 'endTime' in firstItem) {
        return `${days} • ${firstItem.startTime}-${firstItem.endTime}`;
      } else if ('time' in firstItem) {
        return `${days} • ${(firstItem as any).time}`;
      }

      return days;
    }
    return schedule; // Old string format
  };

  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setShowForm(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const tuteeSubjectNames = Array.from(new Set(tutees.flatMap(t => t.subjects?.length ? t.subjects : [t.subject])));
  const gradeLevels = GRADE_LEVELS.filter(g => tutees.some(t => t.gradeLevel === g));

  const filteredAndSortedTutees = tutees
    .filter(tutee => {
      const fullName = `${tutee.firstName} ${tutee.surname}`.toLowerCase();
      const allSubjects = tutee.subjects?.length ? tutee.subjects : [tutee.subject];
      const matchesSearch = fullName.includes(searchQuery.toLowerCase()) ||
        allSubjects.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesSubject = !selectedSubject || allSubjects.includes(selectedSubject);
      const matchesGrade = !selectedGrade || tutee.gradeLevel === selectedGrade;
      return matchesSearch && matchesSubject && matchesGrade;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return `${a.firstName} ${a.surname}`.localeCompare(`${b.firstName} ${b.surname}`);
        case 'subject':
          return a.subject.localeCompare(b.subject);
        case 'balance':
          return b.balance - a.balance;
        case 'grade':
          return (a.gradeLevel || '').localeCompare(b.gradeLevel || '');
        default:
          return 0;
      }
    });

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this tutee?')) {
      try {
        await deleteTutee(id);
        toast.success('Tutee deleted successfully');
      } catch (error) {
        toast.error('Failed to delete tutee');
      }
    }
  };

  const handleEdit = (tutee: Tutee) => {
    setEditingTutee(tutee);
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      {createdParentCredentials && (
        <ParentCredentialsModal
          credentials={createdParentCredentials}
          onClose={() => setCreatedParentCredentials(null)}
        />
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tutee Management</h1>
          <p className="text-gray-600 mt-1">Manage your students and their information</p>
        </div>
        <button
          onClick={() => {
            setEditingTutee(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800"
        >
          <Plus size={20} />
          Add Tutee
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg border">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name or subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="">All Subjects</option>
            {tuteeSubjectNames.map(subject => (
              <option key={subject} value={subject}>{subject}</option>
            ))}
          </select>
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="">All Grades</option>
            {gradeLevels.map(grade => (
              <option key={grade} value={grade}>{grade}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'subject' | 'balance' | 'grade')}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="name">Sort by Name</option>
            <option value="subject">Sort by Subject</option>
            <option value="balance">Sort by Balance</option>
            <option value="grade">Sort by Grade</option>
          </select>
        </div>
      </div>

      {showForm && (
        <TuteeForm
          tutee={editingTutee}
          subjects={subjects}
          onSubmit={async (data, parentData) => {
            try {
              if (!user) {
                toast.error('You must be logged in');
                return;
              }

              // Check for duplicate parent account if a new parent is being created
              if (parentData && !editingTutee) {
                try {
                  const phoneQuery = query(
                    collection(db, 'users'),
                    where('contactNumber', '==', parentData.contactNumber),
                    where('role', '==', 'parent')
                  );
                  const phoneSnap = await getDocs(phoneQuery);
                  if (!phoneSnap.empty) {
                    toast.error('A parent account with this contact number already exists');
                    return; // Stop student and parent creation
                  }
                } catch (err) {
                  console.error('Error checking for duplicate parent:', err);
                  toast.error('Failed to verify parent contact number');
                  return;
                }
              }

              // Create student first
              let studentId: string;
              if (editingTutee) {
                await updateTutee(editingTutee.id, data);
                studentId = editingTutee.id;
                toast.success('Tutee updated successfully');
              } else {
                const newTutee = await addTutee({
                  ...data,
                  totalSessions: 0,
                  totalPaid: 0,
                  balance: 0,
                });
                studentId = newTutee.id;
                toast.success('Tutee added successfully');
              }

              // Create parent account if requested (New Parent)
              if (parentData && !editingTutee && user) {
                const tempPassword = generateTempPassword();
                const secondaryAppName = `secondary-${Date.now()}`;
                const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
                const secondaryAuth = getAuth(secondaryApp);

                try {
                  // Create auth user with contact number as email (sanitize it first)
                  const sanitizedContact = parentData.contactNumber.replace(/\D/g, '');
                  const parentEmail = `${sanitizedContact}@tuteepay.local`;
                  const credential = await createUserWithEmailAndPassword(secondaryAuth, parentEmail, tempPassword);
                  await updateProfile(credential.user, { displayName: parentData.name });

                  // Save parent to Firestore
                  await setDoc(doc(db, 'users', credential.user.uid), {
                    name: parentData.name,
                    email: parentEmail,
                    contactNumber: parentData.contactNumber,
                    role: 'parent',
                    mustChangePassword: true,
                    linkedStudentIds: [studentId],
                    createdAt: new Date().toISOString(),
                    createdByTutorId: user.id,
                  });

                  // Link student to parent
                  await updateDoc(doc(db, 'users', user.id, 'tutees', studentId), {
                    parentId: credential.user.uid,
                  });

                  // Show credentials popup
                  setCreatedParentCredentials({
                    name: parentData.name,
                    contactNumber: parentData.contactNumber,
                    tempPassword,
                    studentName: `${data.firstName} ${data.surname}`,
                  });
                } catch (error: any) {
                  if (error.code === 'auth/email-already-in-use') {
                    toast.error('A parent account with this contact number already exists');
                  } else {
                    toast.error(error.message || 'Failed to create parent account');
                    console.error('Parent account error:', error);
                  }
                } finally {
                  await deleteApp(secondaryApp).catch(() => {});
                }
              }

              // Automatically link student to existing parent doc (for "existing parent" selection).
              // New parent accounts already have linkedStudentIds set in setDoc above.
              const targetParentId = editingTutee ? data.parentId : data.parentId;
              
              if (targetParentId && !parentData) {
                // Only do this for existing parent linking (parentData means we just created a new one already)
                try {
                  const parentRef = doc(db, 'users', targetParentId);
                  const parentDoc = await getDoc(parentRef);
                  if (parentDoc.exists()) {
                    const currentLinked = parentDoc.data().linkedStudentIds || [];
                    const updatePayload: Record<string, any> = {};
                    if (!currentLinked.includes(studentId)) {
                      updatePayload.linkedStudentIds = [...currentLinked, studentId];
                    }
                    // Ensure createdByTutorId is set so the parent's useTutees hook knows which tutor collection to fetch
                    if (!parentDoc.data().createdByTutorId) {
                      updatePayload.createdByTutorId = user.id;
                    }
                    if (Object.keys(updatePayload).length > 0) {
                      await updateDoc(parentRef, updatePayload);
                    }
                  }
                } catch (err) {
                  console.error('Failed to link student in parent doc:', err);
                }
              }

              setShowForm(false);
              setEditingTutee(null);
            } catch (error) {
              console.error('Error saving tutee:', error);
              toast.error('Failed to save tutee');
            }
          }}
          onCancel={() => {
            setShowForm(false);
            setEditingTutee(null);
          }}
        />
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-gray-500">Loading tutees...</div>
        </div>
      ) : filteredAndSortedTutees.length === 0 ? (
        <div className="bg-white rounded-lg border p-12 text-center">
          <p className="text-gray-500">No tutees found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedTutees.map((tutee) => (
            <div key={tutee.id} className="bg-white rounded-lg border p-6 hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{tutee.firstName} {tutee.surname}</h3>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(tutee.subjects?.length ? tutee.subjects : [tutee.subject]).map(s => (
                      <span key={s} className="px-2 py-0.5 bg-green-50 text-green-700 text-xs font-semibold rounded-full border border-green-200">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link to={`/tutees/${tutee.id}`} className="text-green-700 hover:text-green-800 p-1">
                    <Eye size={18} />
                  </Link>
                  <button onClick={() => handleEdit(tutee)} className="text-gray-600 hover:text-gray-700 p-1">
                    <Pencil size={18} />
                  </button>
                  <button onClick={() => handleDelete(tutee.id)} className="text-red-600 hover:text-red-700 p-1">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Rate:</span>
                  <span className="font-medium">{formatCurrency(tutee.ratePerSession)}/month</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Schedule:</span>
                  <span className="text-right">{formatSchedule(tutee.schedule)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Sessions:</span>
                  <span>{tutee.totalSessions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Paid:</span>
                  <span className="font-medium">{formatCurrency(tutee.totalPaid)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-gray-600">Balance:</span>
                  <span className={`font-semibold ${tutee.balance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                    {formatCurrency(tutee.balance)}
                  </span>
                </div>
              </div>

              <Link
                to={`/tutees/${tutee.id}`}
                className="mt-4 block text-center bg-green-50 text-green-700 py-2 rounded-lg hover:bg-blue-100"
              >
                View Details
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

interface TuteeFormProps {
  tutee: Tutee | null;
  subjects: { id: string; name: string }[];
  onSubmit: (data: TuteeFormData, parentData?: { name: string; contactNumber: string }) => Promise<void> | void;
  onCancel: () => void;
}

const TuteeForm = ({ tutee, subjects, onSubmit, onCancel }: TuteeFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parentEmail, setParentEmail] = useState('');
  const [parentName, setParentName] = useState('');
  const [linkedParentId, setLinkedParentId] = useState<string | null>(tutee?.parentId || null);
  const [parentSearching, setParentSearching] = useState(false);

  // Parent account status toggles
  const [linkOrCreateParent, setLinkOrCreateParent] = useState(false);
  const [parentStatus, setParentStatus] = useState<'existing' | 'new'>('existing');
  const [parentSearchQuery, setParentSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchingParents, setSearchingParents] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

  // New parent account creation fields
  const [newParentName, setNewParentName] = useState('');
  const [newParentContactNumber, setNewParentContactNumber] = useState('');

  const handleSearchParents = async () => {
    if (!parentSearchQuery.trim()) return;
    setSearchingParents(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('role', '==', 'parent')
      );
      const snap = await getDocs(q);
      const queryLower = parentSearchQuery.toLowerCase().trim();
      const results = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(p => 
          p.name?.toLowerCase().includes(queryLower) ||
          p.contactNumber?.replace(/\D/g, '').includes(queryLower.replace(/\D/g, '')) ||
          p.email?.toLowerCase().includes(queryLower)
        );
      setSearchResults(results);
      if (results.length === 0) {
        toast.error('No parent account found matching the search.');
      }
    } catch (error) {
      console.error('Error searching parents:', error);
      toast.error('Failed to search parent accounts');
    } finally {
      setSearchingParents(false);
    }
  };

  // Convert old string schedule to array format
  const getInitialSchedule = () => {
    if (!tutee?.schedule) return [];
    if (Array.isArray(tutee.schedule)) {
      // Ensure all items have startTime and endTime
      return tutee.schedule.map(item => {
        if (typeof item === 'object' && item !== null && 'startTime' in item && 'endTime' in item) {
          return item;
        }
        // Convert old format with just 'time' or just string to new format
        const time = typeof item === 'object' && item !== null ? (item as any).time || '09:00' : '09:00';
        return {
          day: typeof item === 'object' && item !== null ? (item as any).day : item,
          startTime: time,
          endTime: time
        };
      });
    }
    // Old string format - start with empty array, user can add new schedule
    return [];
  };

  // Get initial time from existing schedule or default
  const getInitialTime = () => {
    const schedule = getInitialSchedule();
    if (schedule.length > 0 && 'startTime' in schedule[0]) {
      return {
        startTime: schedule[0].startTime,
        endTime: schedule[0].endTime
      };
    }
    return { startTime: '09:00', endTime: '10:00' };
  };

  const [formData, setFormData] = useState<TuteeFormData>({
    firstName: tutee?.firstName || '',
    surname: tutee?.surname || '',
    subject: tutee?.subject || '',
    subjects: tutee?.subjects?.length ? tutee.subjects : (tutee?.subject ? [tutee.subject] : []),
    gradeLevel: tutee?.gradeLevel || '',
    ratePerSession: tutee?.ratePerSession || 0,
    schedule: getInitialSchedule(),
    email: tutee?.email || '',
    guardianNumber: tutee?.guardianNumber || '',
    guardianEmail: tutee?.guardianEmail || '',
    address: tutee?.address || '',
    parentId: tutee?.parentId || undefined,
  });

  const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const [scheduleTime, setScheduleTime] = useState(getInitialTime());

  const toggleDay = (day: string) => {
    const existingIndex = formData.schedule.findIndex(s => s.day === day);

    if (existingIndex >= 0) {
      // Remove the day
      setFormData({
        ...formData,
        schedule: formData.schedule.filter((_, i) => i !== existingIndex)
      });
    } else {
      // Add the day with current time settings
      setFormData({
        ...formData,
        schedule: [...formData.schedule, {
          day,
          startTime: scheduleTime.startTime,
          endTime: scheduleTime.endTime
        }]
      });
    }
  };

  const isDaySelected = (day: string) => {
    return formData.schedule.some(s => s.day === day);
  };

  const updateAllScheduleTimes = (startTime: string, endTime: string) => {
    setScheduleTime({ startTime, endTime });
    // Update all existing schedule items with new times
    setFormData({
      ...formData,
      schedule: formData.schedule.map(s => ({
        ...s,
        startTime,
        endTime
      }))
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.subjects.length === 0) {
      toast.error('Please select at least one subject');
      return;
    }
    if (formData.schedule.length === 0) {
      toast.error('Please add at least one schedule slot');
      return;
    }

    // Validate parent account status if checked
    if (linkOrCreateParent && !tutee) {
      if (parentStatus === 'existing') {
        if (!selectedParentId) {
          toast.error('Please select an existing parent account from search results');
          return;
        }
      } else if (parentStatus === 'new') {
        if (!newParentName.trim()) {
          toast.error('Please enter parent name');
          return;
        }
        if (!newParentContactNumber.trim()) {
          toast.error('Please enter parent contact number');
          return;
        }
        // Basic phone validation
        const phoneRegex = /^[0-9]{10,11}$/;
        if (!phoneRegex.test(newParentContactNumber.replace(/\D/g, ''))) {
          toast.error('Please enter a valid contact number (10-11 digits)');
          return;
        }
      }
    }

    const submitData = {
      ...formData,
      subject: formData.subjects[0], // primary subject
      parentId: (linkOrCreateParent && parentStatus === 'existing') ? (selectedParentId || undefined) : (linkedParentId || undefined),
    };

    const parentData = (linkOrCreateParent && parentStatus === 'new' && !tutee) ? {
      name: newParentName.trim(),
      contactNumber: newParentContactNumber.trim(),
    } : undefined;

    setIsSubmitting(true);
    try {
      await onSubmit(submitData, parentData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border p-6">
      <h2 className="text-xl font-semibold mb-4">
        {tutee ? 'Edit Tutee' : 'Add New Tutee'}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-2">First Name *</label>
            <input
              type="text"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className="w-full p-2 border rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-2">Surname *</label>
            <input
              type="text"
              value={formData.surname}
              onChange={(e) => setFormData({ ...formData, surname: e.target.value })}
              className="w-full p-2 border rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-2">Grade Level</label>
            <select
              value={formData.gradeLevel || ''}
              onChange={(e) => setFormData({ ...formData, gradeLevel: e.target.value })}
              className="w-full p-2 border rounded-lg"
            >
              <option value="">Select grade level</option>
              {GRADE_LEVELS.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm mb-2">Subjects * <span className="text-gray-500 font-normal">(select all that apply)</span></label>
            {subjects.length === 0 ? (
              <div className="border rounded-lg p-6 bg-yellow-50 border-yellow-200 text-center">
                <p className="text-sm text-yellow-800 mb-2">No subjects available yet!</p>
                <p className="text-xs text-yellow-700">
                  Please go to <Link to="/settings" className="underline font-medium">Settings</Link> to add custom subjects first.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 border rounded-lg p-3 bg-gray-50">
                {subjects.map(subject => {
                  const isSelected = formData.subjects.includes(subject.name);
                  return (
                    <label
                      key={subject.id}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors text-sm ${
                        isSelected ? 'bg-green-50 border border-green-400 text-green-900' : 'bg-white border border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          const subjectNames = isSelected
                            ? formData.subjects.filter(s => s !== subject.name)
                            : [...formData.subjects, subject.name];
                          // Keep primary subject in sync with first selected
                          setFormData({ ...formData, subjects: subjectNames, subject: subjectNames[0] || subject.name });
                        }}
                        className="w-4 h-4 text-green-700 rounded"
                      />
                      <span>{subject.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
            {formData.subjects.length === 0 && subjects.length > 0 && (
              <p className="text-xs text-red-500 mt-1">Please select at least one subject</p>
            )}
          </div>

          <div>
            <label className="block text-sm mb-2">Rate per Month *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.ratePerSession || ''}
              onChange={(e) => setFormData({ ...formData, ratePerSession: parseFloat(e.target.value) || 0 })}
              className="w-full p-2 border rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full p-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm mb-2">Guardian/Parents Number</label>
            <input
              type="tel"
              value={formData.guardianNumber}
              onChange={(e) => setFormData({ ...formData, guardianNumber: e.target.value })}
              className="w-full p-2 border rounded-lg"
              placeholder="+63 XXX XXX XXXX"
            />
          </div>

          <div>
            <label className="block text-sm mb-2">Guardian/Parents Email</label>
            <input
              type="email"
              value={formData.guardianEmail}
              onChange={(e) => setFormData({ ...formData, guardianEmail: e.target.value })}
              className="w-full p-2 border rounded-lg"
              placeholder="parent@example.com"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm mb-2">Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full p-2 border rounded-lg"
              placeholder="Full address"
            />
          </div>
        </div>

        {!tutee && (
          <div className="border rounded-lg p-4 bg-green-50 border-green-200">
            <label className="block text-sm font-medium mb-3 flex items-center gap-2">
              <UserPlus size={18} className="text-green-700" />
              Parent Information
            </label>

            <div className="space-y-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={linkOrCreateParent}
                  onChange={(e) => {
                    setLinkOrCreateParent(e.target.checked);
                    if (!e.target.checked) {
                      setParentStatus('existing');
                      setNewParentName('');
                      setNewParentContactNumber('');
                      setSelectedParentId(null);
                      setParentSearchQuery('');
                      setSearchResults([]);
                    }
                  }}
                  className="w-4 h-4 text-green-700 rounded"
                />
                <span className="text-sm font-medium text-gray-900">
                  Link or Create Parent Account
                </span>
              </label>

              {linkOrCreateParent && (
                <div className="space-y-4 pl-6 border-l-2 border-green-300">
                  <div>
                    <label className="block text-sm font-medium text-gray-750 text-gray-700 mb-2">Parent Account Status</label>
                    <div className="flex gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="parentStatus"
                          value="existing"
                          checked={parentStatus === 'existing'}
                          onChange={() => {
                            setParentStatus('existing');
                            setNewParentName('');
                            setNewParentContactNumber('');
                          }}
                          className="w-4 h-4 text-green-700 focus:ring-green-700"
                        />
                        <span className="text-sm text-gray-900">Existing Parent</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="parentStatus"
                          value="new"
                          checked={parentStatus === 'new'}
                          onChange={() => {
                            setParentStatus('new');
                            setSelectedParentId(null);
                            setParentSearchQuery('');
                            setSearchResults([]);
                          }}
                          className="w-4 h-4 text-green-700 focus:ring-green-700"
                        />
                        <span className="text-sm text-gray-900">New Parent</span>
                      </label>
                    </div>
                  </div>

                  {parentStatus === 'existing' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm text-gray-750 text-gray-700 mb-1">Search Parent</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={parentSearchQuery}
                            onChange={(e) => setParentSearchQuery(e.target.value)}
                            className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700 text-sm bg-white"
                            placeholder="Search by parent name or contact number..."
                          />
                          <button
                            type="button"
                            onClick={handleSearchParents}
                            disabled={searchingParents || !parentSearchQuery.trim()}
                            className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium transition-colors"
                          >
                            {searchingParents ? 'Searching...' : 'Search'}
                          </button>
                        </div>
                      </div>

                      {/* Search Results */}
                      {searchResults.length > 0 && (
                        <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto divide-y bg-white shadow-sm">
                          {searchResults.map((p) => {
                            const isSelected = selectedParentId === p.id;
                            return (
                              <div
                                key={p.id}
                                className={`flex justify-between items-center p-3 text-sm transition-colors ${
                                  isSelected ? 'bg-green-50' : 'hover:bg-gray-50'
                                }`}
                              >
                                <div>
                                  <p className="font-semibold text-gray-900">{p.name}</p>
                                  <p className="text-gray-500 text-xs">{p.email} • {p.contactNumber || 'No phone'}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedParentId(isSelected ? null : p.id)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                    isSelected
                                      ? 'bg-green-700 border-green-800 text-white hover:bg-green-800'
                                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                  }`}
                                >
                                  {isSelected ? 'Selected' : 'Select'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {parentStatus === 'new' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm text-gray-750 text-gray-700 mb-1">Parent Name *</label>
                        <input
                          type="text"
                          value={newParentName}
                          onChange={(e) => setNewParentName(e.target.value)}
                          className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700 bg-white"
                          placeholder="e.g., Maria Santos"
                          required={linkOrCreateParent && parentStatus === 'new'}
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-gray-750 text-gray-700 mb-1">
                          Contact Number * <span className="text-gray-500 font-normal">(will be used as username)</span>
                        </label>
                        <input
                          type="tel"
                          value={newParentContactNumber}
                          onChange={(e) => setNewParentContactNumber(e.target.value)}
                          className="w-full p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700 bg-white"
                          placeholder="09171234567"
                          required={linkOrCreateParent && parentStatus === 'new'}
                        />
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                        <strong>Note:</strong> A temporary password will be auto-generated. The parent will be required to change it on first login.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {tutee && (
          <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
            <label className="block text-sm font-medium mb-3 flex items-center gap-2">
              <Users size={18} className="text-blue-700" />
              Link Parent Account (Optional)
            </label>

            {linkedParentId ? (
              <div className="bg-white rounded-lg p-4 border border-blue-300">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-600">Linked Parent:</p>
                    <p className="font-semibold text-gray-900">{parentName || 'Parent Account'}</p>
                    <p className="text-sm text-gray-500">{parentEmail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLinkedParentId(null);
                      setParentEmail('');
                      setParentName('');
                    }}
                    className="text-red-600 hover:text-red-700 text-sm font-medium"
                  >
                    Unlink
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Search for a parent account by email to link this student
                </p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={parentEmail}
                    onChange={(e) => setParentEmail(e.target.value)}
                    className="flex-1 p-2 border rounded-lg"
                    placeholder="parent@example.com"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!parentEmail) return;
                      setParentSearching(true);
                      try {
                        const usersQuery = query(
                          collection(db, 'users'),
                          where('email', '==', parentEmail),
                          where('role', '==', 'parent')
                        );
                        const snapshot = await getDocs(usersQuery);

                        if (snapshot.empty) {
                          toast.error('No parent account found with this email');
                        } else {
                          const parentData = snapshot.docs[0].data();
                          setLinkedParentId(snapshot.docs[0].id);
                          setParentName(parentData.name);
                          toast.success('Parent account linked successfully!');
                        }
                      } catch (error) {
                        toast.error('Failed to search for parent account');
                      } finally {
                        setParentSearching(false);
                      }
                    }}
                    disabled={parentSearching || !parentEmail}
                    className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {parentSearching ? 'Searching...' : 'Link'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="border rounded-lg p-4">
          <label className="block text-sm font-medium mb-3">Schedule *</label>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-600 mb-2">Time Range</label>
              <div className="flex gap-3 items-center">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={scheduleTime.startTime}
                    onChange={(e) => updateAllScheduleTimes(e.target.value, scheduleTime.endTime)}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
                <span className="text-gray-500 mt-5">to</span>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">End Time</label>
                  <input
                    type="time"
                    value={scheduleTime.endTime}
                    onChange={(e) => updateAllScheduleTimes(scheduleTime.startTime, e.target.value)}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-2">Select Days</label>
              <div className="grid grid-cols-2 gap-2">
                {DAYS.map(day => (
                  <label
                    key={day}
                    className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                      isDaySelected(day)
                        ? 'bg-green-50 border-green-700 text-green-900'
                        : 'bg-white border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isDaySelected(day)}
                      onChange={() => toggleDay(day)}
                      className="w-4 h-4 text-green-700 rounded focus:ring-green-700"
                    />
                    <span className="text-sm font-medium">{day}</span>
                  </label>
                ))}
              </div>
            </div>

            {formData.schedule.length > 0 && (
              <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                <strong>Selected Schedule:</strong> {formData.schedule.map(s => s.day).join(', ')} at {scheduleTime.startTime} - {scheduleTime.endTime}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-green-700 text-white py-2 px-4 rounded-lg hover:bg-green-800 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {tutee ? 'Saving...' : 'Adding...'}
              </>
            ) : (
              tutee ? 'Update Tutee' : 'Add Tutee'
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

interface ParentCredentialsModalProps {
  credentials: CreatedParentCredentials;
  onClose: () => void;
}

const ParentCredentialsModal = ({ credentials, onClose }: ParentCredentialsModalProps) => {
  const printRef = useRef<HTMLDivElement>(null);

  const copyAllCredentials = () => {
    const text = [
      `Parent Account Credentials`,
      `──────────────────────────`,
      `Parent Name:       ${credentials.name}`,
      `Student:           ${credentials.studentName}`,
      `Username:          ${credentials.contactNumber}`,
      `Temporary Password: ${credentials.tempPassword}`,
      ``,
      `Note: Please change your password upon first login.`,
    ].join('\n');
    navigator.clipboard.writeText(text).then(() =>
      toast.success('All credentials copied to clipboard!')
    );
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Parent Login Credentials</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #111; }
          h1 { font-size: 20px; color: #166534; margin-bottom: 4px; }
          .subtitle { color: #6b7280; font-size: 13px; margin-bottom: 24px; }
          .row { margin-bottom: 16px; }
          .label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
          .value { font-size: 16px; font-weight: 600; }
          .value.mono { font-family: monospace; font-size: 18px; background: #f3f4f6; padding: 6px 10px; border-radius: 6px; display: inline-block; }
          .notice { margin-top: 28px; padding: 12px 16px; background: #fefce8; border: 1px solid #fde68a; border-radius: 8px; font-size: 12px; color: #92400e; }
          hr { border: none; border-top: 1px solid #e5e7eb; margin: 20px 0; }
        </style>
      </head>
      <body>
        <h1>✓ Parent Account Credentials</h1>
        <p class="subtitle">Tutorial Service Management System — Confidential</p>
        <hr/>
        <div class="row"><div class="label">Student</div><div class="value">${credentials.studentName}</div></div>
        <div class="row"><div class="label">Parent Name</div><div class="value">${credentials.name}</div></div>
        <div class="row"><div class="label">Username (Contact Number)</div><div class="value mono">${credentials.contactNumber}</div></div>
        <div class="row"><div class="label">Temporary Password</div><div class="value mono">${credentials.tempPassword}</div></div>
        <div class="notice"><strong>Security Notice:</strong> This is a one-time credential sheet. The parent must change their password upon first login. Destroy this document after sharing.</div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden" ref={printRef}>
        {/* Header */}
        <div className="bg-gradient-to-br from-green-600 to-green-800 p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <CheckCircle size={26} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg leading-tight">Parent Account Created!</h3>
                <p className="text-green-100 text-sm">Share these credentials with the parent</p>
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

        {/* Credential fields */}
        <div className="p-6 space-y-3">
          {/* Student */}
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-widest text-blue-500 font-medium mb-0.5">Student</p>
              <p className="font-semibold text-gray-900 text-sm">{credentials.studentName}</p>
            </div>
          </div>

          {/* Parent Name */}
          <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-medium mb-0.5">Parent Name</p>
              <p className="font-semibold text-gray-900">{credentials.name}</p>
            </div>
          </div>

          {/* Username */}
          <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-medium mb-0.5">Username (Contact Number)</p>
              <p className="font-mono font-bold text-gray-900 text-base tracking-wide">{credentials.contactNumber}</p>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(credentials.contactNumber); toast.success('Username copied!'); }}
              className="text-gray-400 hover:text-green-700 p-1.5 rounded-lg hover:bg-green-50 transition-colors"
              title="Copy username"
            >
              <Copy size={16} />
            </button>
          </div>

          {/* Temporary Password */}
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <div className="flex-1">
              <p className="text-[10px] uppercase tracking-widest text-amber-600 font-medium mb-0.5">Temporary Password</p>
              <p className="font-mono font-bold text-gray-900 text-xl tracking-widest">{credentials.tempPassword}</p>
            </div>
            <button
              onClick={() => { navigator.clipboard.writeText(credentials.tempPassword); toast.success('Password copied!'); }}
              className="text-gray-400 hover:text-green-700 p-1.5 rounded-lg hover:bg-green-50 transition-colors"
              title="Copy password"
            >
              <Copy size={16} />
            </button>
          </div>

          {/* Security notice */}
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <ShieldCheck size={16} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-red-700 leading-relaxed">
              <strong>One-time display.</strong> The temporary password is shown <strong>only once</strong> and will not be accessible after closing this modal. Provide these credentials to the parent immediately.
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={copyAllCredentials}
            className="flex-1 flex items-center justify-center gap-2 bg-green-700 text-white py-2.5 rounded-xl hover:bg-green-800 font-medium text-sm transition-colors"
          >
            <Copy size={16} />
            Copy Credentials
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl hover:bg-gray-200 font-medium text-sm transition-colors"
          >
            <Printer size={16} />
            Print
          </button>
          <button
            onClick={onClose}
            className="flex items-center justify-center gap-2 border border-gray-300 text-gray-600 px-4 py-2.5 rounded-xl hover:bg-gray-50 font-medium text-sm transition-colors"
          >
            <X size={16} />
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
