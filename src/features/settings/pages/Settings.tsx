import { useState, useEffect } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSubjects } from '@/features/tutees/hooks/useSubjects';
import {
  User, Bell, Database, Info, BookOpen, Plus, Trash2, Camera, CreditCard,
  Smartphone, ShieldAlert, Search, SlidersHorizontal, ArrowUpDown, X,
  Download, Eye, Calendar, Clock, Activity, FileText, CheckCircle2, ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { collection, getDocs, deleteDoc, query, where, orderBy, onSnapshot, doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase/config';
import { ImageUpload } from '@/shared/components/ui/ImageUpload';
import { logActivity } from '@/shared/utils/auditLogger';
import gcashLogo from '@/assets/gcash-com-logo.png';
import mayaLogo from '@/assets/id5dWPPLkV_logos.jpeg';

const MODULE_ACTIONS: Record<string, string[]> = {
  all: [],
  'Authentication': ['Login', 'Logout', 'Password Change'],
  'Students': ['Student Added', 'Student Updated', 'Student Archived'],
  'Scheduling': ['Schedule Created', 'Schedule Updated', 'Schedule Deleted'],
  'Parent Portal': ['Parent Account Created', 'Parent Account Updated', 'Parent Account Deleted'],
  'Attendance': ['Attendance Recorded', 'Attendance Updated'],
  'Tutee Progress': ['Assessment Created', 'Assessment Updated', 'Assessment Deleted', 'Scores Recorded', 'Progress Updated'],
  'Billing': ['Payment Recorded', 'Payment Updated', 'Receipt Generated'],
  'Announcements': ['Announcement Posted', 'Announcement Edited', 'Announcement Deleted'],
  'Messaging': ['Message Sent']
};

export const Settings = () => {
  const { user, updateProfilePhoto, updatePaymentMethods } = useAuth();
  const { subjects, addSubject, deleteSubject, isLoading: subjectsLoading } = useSubjects();
  const [activeTab, setActiveTab] = useState<'account' | 'notifications' | 'payments' | 'subjects' | 'logs' | 'backup'>(() => {
    return (sessionStorage.getItem('settingsActiveTab') as any) || 'account';
  });

  // Notification states
  const [notifications, setNotifications] = useState(true);
  const [emailReminders, setEmailReminders] = useState(true);

  // Clearing/adding states
  const [isClearing, setIsClearing] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Backup Recovery states
  const [isImporting, setIsImporting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedBackupData, setParsedBackupData] = useState<any | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Audit Logs states
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(() => {
    const tab = sessionStorage.getItem('settingsActiveTab');
    return tab === 'logs';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterModule, setFilterModule] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  // Payment methods local states
  const [isSavingPayments, setIsSavingPayments] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState({
    gcash: { enabled: false, accountName: '', accountNumber: '', qrUrl: '' },
    maya: { enabled: false, accountName: '', accountNumber: '', qrUrl: '' },
    bank: { enabled: false, accountName: '', accountNumber: '', bankName: '', qrUrl: '' },
    other: { enabled: false, accountName: '', accountNumber: '', bankName: '', instructions: '', qrUrl: '' },
  });

  // Sync state with user data
  useEffect(() => {
    if (user?.paymentMethods) {
      setPaymentMethods({
        gcash: {
          enabled: user.paymentMethods.gcash?.enabled ?? false,
          accountName: user.paymentMethods.gcash?.accountName ?? '',
          accountNumber: user.paymentMethods.gcash?.accountNumber ?? '',
          qrUrl: user.paymentMethods.gcash?.qrUrl ?? '',
        },
        maya: {
          enabled: user.paymentMethods.maya?.enabled ?? false,
          accountName: user.paymentMethods.maya?.accountName ?? '',
          accountNumber: user.paymentMethods.maya?.accountNumber ?? '',
          qrUrl: user.paymentMethods.maya?.qrUrl ?? '',
        },
        bank: {
          enabled: user.paymentMethods.bank?.enabled ?? false,
          accountName: user.paymentMethods.bank?.accountName ?? '',
          accountNumber: user.paymentMethods.bank?.accountNumber ?? '',
          bankName: user.paymentMethods.bank?.bankName ?? '',
          qrUrl: user.paymentMethods.bank?.qrUrl ?? '',
        },
        other: {
          enabled: user.paymentMethods.other?.enabled ?? false,
          accountName: user.paymentMethods.other?.accountName ?? '',
          accountNumber: user.paymentMethods.other?.accountNumber ?? '',
          bankName: user.paymentMethods.other?.bankName ?? '',
          instructions: user.paymentMethods.other?.instructions ?? '',
          qrUrl: user.paymentMethods.other?.qrUrl ?? '',
        },
      });
    }
  }, [user]);

  // Enforce role guard and persist active tab
  useEffect(() => {
    if (user) {
      if (user.role !== 'tutor') {
        if (activeTab !== 'account' && activeTab !== 'notifications') {
          setActiveTab('account');
          sessionStorage.setItem('settingsActiveTab', 'account');
          return;
        }
      }
      sessionStorage.setItem('settingsActiveTab', activeTab);
    }
  }, [user, activeTab]);

  // Subscribe to Audit Logs when logs tab is active
  useEffect(() => {
    if (activeTab === 'logs') {
      if (user?.id && user?.role === 'tutor') {
        setLoadingLogs(true);
        const q = query(
          collection(db, 'audit_logs'),
          where('tutorId', '==', user.id),
          orderBy('timestamp', 'desc')
        );
        const unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const fetchedLogs = snapshot.docs.map((docSnap) => {
              const data = docSnap.data();
              return {
                id: docSnap.id,
                ...data,
                timestamp: data.timestamp ? data.timestamp.toDate() : new Date(),
              };
            });
            setLogs(fetchedLogs);
            setLoadingLogs(false);
          },
          (error) => {
            console.error('Error fetching audit logs:', error);
            setLoadingLogs(false);
          }
        );
        return () => unsubscribe();
      } else if (user === null) {
        setLoadingLogs(false);
      }
    }
  }, [activeTab, user]);

  // Reset action filter if module changes
  useEffect(() => {
    setFilterAction('all');
  }, [filterModule]);

  // Retention Policy: Auto-archive/delete logs older than 2 years
  useEffect(() => {
    if (activeTab === 'logs' && user?.id && user?.role === 'tutor') {
      const cleanupOldLogs = async () => {
        try {
          const twoYearsAgo = new Date();
          twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

          const q = query(
            collection(db, 'audit_logs'),
            where('tutorId', '==', user.id),
            where('timestamp', '<', twoYearsAgo)
          );

          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const deletePromises = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
            await Promise.all(deletePromises);
            console.log(`Auto-deleted ${snapshot.docs.length} audit logs older than 2 years.`);
          }
        } catch (error) {
          console.error('Error cleaning up old audit logs:', error);
        }
      };

      cleanupOldLogs();
    }
  }, [activeTab, user?.id, user?.role]);

  const handleSavePaymentSettings = async () => {
    setIsSavingPayments(true);
    try {
      const updatedMethods = {
        ...paymentMethods,
        bank: { ...paymentMethods.bank, enabled: false },
        other: { ...paymentMethods.other, enabled: false }
      };
      await updatePaymentMethods(updatedMethods);
      toast.success('Payment settings saved successfully');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save payment settings');
    } finally {
      setIsSavingPayments(false);
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) {
      toast.error('Please enter a subject name');
      return;
    }

    if (subjects.some(s => s.name.toLowerCase() === newSubjectName.trim().toLowerCase())) {
      toast.error('This subject already exists');
      return;
    }

    setIsAddingSubject(true);
    try {
      await addSubject(newSubjectName.trim());
      setNewSubjectName('');
      toast.success('Subject added successfully');
    } catch (error) {
      toast.error('Failed to add subject');
    } finally {
      setIsAddingSubject(false);
    }
  };

  const handleDeleteSubject = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}"? This will not affect existing students.`)) {
      try {
        await deleteSubject(id);
        toast.success('Subject deleted successfully');
      } catch (error) {
        toast.error('Failed to delete subject');
      }
    }
  };

  const handleExportData = async () => {
    if (!user) return;
    setIsExporting(true);
    try {
      toast.info('Preparing your data backup...');
      const collectionsToExport = ['tutees', 'payments', 'sessions', 'paymentRecords', 'paymentTransactions', 'subjects', 'assessments', 'progressReports', 'announcements'];
      const backupData: Record<string, any[]> = {};

      for (const col of collectionsToExport) {
        const colRef = collection(db, 'users', user.id, col);
        const snap = await getDocs(colRef);
        backupData[col] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      // Export parent accounts
      const parentsQuery = query(
        collection(db, 'users'),
        where('createdByTutorId', '==', user.id),
        where('role', '==', 'parent')
      );
      const parentsSnap = await getDocs(parentsQuery);
      backupData['parentAccounts'] = parentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      backupData['profile'] = [{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        paymentMethods: user.paymentMethods || {},
        exportedAt: new Date().toISOString()
      }];

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `tutor_track_backups_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      // Log audit activity
      await logActivity(
        user.id,
        user.name,
        user.role,
        'Database Exported',
        'Backup & Recovery',
        'Exported database records backup JSON containing parent accounts'
      );

      toast.success('Backup exported successfully!');
    } catch (error) {
      console.error('Export backup error:', error);
      toast.error('Failed to export data backup');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setImportError(null);
    setParsedBackupData(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);

        // Simple schema validation
        const hasTutees = 'tutees' in json;
        const hasProfile = 'profile' in json;

        if (!hasTutees && !hasProfile) {
          setImportError('Invalid backup file format. Missing core data keys.');
          return;
        }

        setParsedBackupData(json);
      } catch (err) {
        setImportError('Failed to parse JSON file. Ensure it is a valid backup JSON.');
      }
    };
    reader.readAsText(file);
  };

  const convertTimestamps = (data: any, collectionName?: string) => {
    const result = { ...data };
    const timestampFields = ['createdAt', 'updatedAt', 'lastUpdated', 'lastPaymentDate'];
    
    for (const field of timestampFields) {
      if (collectionName === 'subjects' && field === 'createdAt') {
        continue;
      }
      if (result[field] && typeof result[field] === 'string') {
        try {
          result[field] = Timestamp.fromDate(new Date(result[field]));
        } catch (e) {
          console.warn(`Failed to convert field ${field} to Timestamp:`, e);
        }
      }
    }
    return result;
  };

  const handleRestoreBackup = async () => {
    if (!user || !parsedBackupData) return;

    if (!window.confirm('Are you sure you want to restore data from this backup? Existing records with the same IDs will be overwritten.')) {
      return;
    }

    setIsImporting(true);
    try {
      toast.info('Restoring records to cloud...');

      const collectionsToRestore = ['tutees', 'payments', 'sessions', 'paymentRecords', 'paymentTransactions', 'subjects', 'assessments', 'progressReports', 'announcements'];

      // 1. Restore subcollections
      for (const col of collectionsToRestore) {
        const items = parsedBackupData[col];
        if (Array.isArray(items)) {
          for (const item of items) {
            const { id, ...data } = item;
            if (id) {
              const docRef = doc(db, 'users', user.id, col, id);
              try {
                await setDoc(docRef, convertTimestamps(data, col));
              } catch (e: any) {
                console.error(`Error restoring to ${col}/${id}:`, e);
                throw new Error(`Failed to restore ${col} (${id}): ${e.message}`);
              }
            }
          }
        }
      }

      // 2. Restore parent accounts
      const parentAccounts = parsedBackupData['parentAccounts'];
      if (Array.isArray(parentAccounts)) {
        for (const parent of parentAccounts) {
          const { id, ...data } = parent;
          if (id) {
            const docRef = doc(db, 'users', id);
            try {
              await setDoc(docRef, data);
            } catch (e: any) {
              console.error(`Error restoring parent account ${id}:`, e);
              throw new Error(`Failed to restore parent account (${id}): ${e.message}`);
            }
          }
        }
      }

      // Log activity
      await logActivity(
        user.id,
        user.name,
        user.role,
        'Database Restored',
        'Backup & Recovery',
        'Restored database records from backup JSON'
      );

      toast.success('Backup data restored successfully! Please refresh the page to view updates.');
      setParsedBackupData(null);
      setSelectedFile(null);
    } catch (error: any) {
      console.error('Restore error:', error);
      toast.error(error.message || 'Failed to restore backup data.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClearData = async () => {
    if (!user) {
      toast.error('You must be logged in to clear data');
      return;
    }

    if (window.confirm('Are you sure you want to delete all your data? This action cannot be undone.')) {
      setIsClearing(true);
      try {
        const tuteesRef = collection(db, 'users', user.id, 'tutees');
        const tuteesSnapshot = await getDocs(tuteesRef);
        await Promise.all(tuteesSnapshot.docs.map(doc => deleteDoc(doc.ref)));

        const paymentsRef = collection(db, 'users', user.id, 'payments');
        const paymentsSnapshot = await getDocs(paymentsRef);
        await Promise.all(paymentsSnapshot.docs.map(doc => deleteDoc(doc.ref)));

        const sessionsRef = collection(db, 'users', user.id, 'sessions');
        const sessionsSnapshot = await getDocs(sessionsRef);
        await Promise.all(sessionsSnapshot.docs.map(doc => deleteDoc(doc.ref)));

        const recordsRef = collection(db, 'users', user.id, 'paymentRecords');
        const recordsSnapshot = await getDocs(recordsRef);
        await Promise.all(recordsSnapshot.docs.map(doc => deleteDoc(doc.ref)));

        const transactionsRef = collection(db, 'users', user.id, 'paymentTransactions');
        const transactionsSnapshot = await getDocs(transactionsRef);
        await Promise.all(transactionsSnapshot.docs.map(doc => deleteDoc(doc.ref)));

        const subjectsRef = collection(db, 'users', user.id, 'subjects');
        const subjectsSnapshot = await getDocs(subjectsRef);
        await Promise.all(subjectsSnapshot.docs.map(doc => deleteDoc(doc.ref)));

        const assessmentsRef = collection(db, 'users', user.id, 'assessments');
        const assessmentsSnapshot = await getDocs(assessmentsRef);
        await Promise.all(assessmentsSnapshot.docs.map(doc => deleteDoc(doc.ref)));

        const progressRef = collection(db, 'users', user.id, 'progressReports');
        const progressSnapshot = await getDocs(progressRef);
        await Promise.all(progressSnapshot.docs.map(doc => deleteDoc(doc.ref)));

        const announcementsRef = collection(db, 'users', user.id, 'announcements');
        const announcementsSnapshot = await getDocs(announcementsRef);
        await Promise.all(announcementsSnapshot.docs.map(doc => deleteDoc(doc.ref)));

        // Parent accounts created by this tutor
        const parentsQuery = query(
          collection(db, 'users'),
          where('createdByTutorId', '==', user.id),
          where('role', '==', 'parent')
        );
        const parentsSnapshot = await getDocs(parentsQuery);
        await Promise.all(parentsSnapshot.docs.map(doc => deleteDoc(doc.ref)));

        toast.success('All data cleared successfully. Please refresh the page.');
      } catch (error) {
        console.error('Error clearing data:', error);
        toast.error('Failed to clear data. Please try again.');
      } finally {
        setIsClearing(false);
      }
    }
  };

  // Calculations for Audit Log statistics
  const getStats = () => {
    const todayStr = new Date().toDateString();
    let todayCount = 0;
    let attendanceCount = 0;
    let billingCount = 0;

    logs.forEach(log => {
      const logDate = new Date(log.timestamp).toDateString();
      if (logDate === todayStr) {
        todayCount++;
      }
      if (log.module === 'Attendance') {
        attendanceCount++;
      }
      if (log.module === 'Billing') {
        billingCount++;
      }
    });

    return {
      total: logs.length,
      today: todayCount,
      attendance: attendanceCount,
      billing: billingCount,
    };
  };

  const stats = getStats();

  // Audit Logs Filtering logic
  const getFilteredLogs = () => {
    let filtered = [...logs];

    if (searchQuery.trim()) {
      const queryLower = searchQuery.toLowerCase();
      filtered = filtered.filter(log =>
        (log.userName || '').toLowerCase().includes(queryLower) ||
        (log.actionType || '').toLowerCase().includes(queryLower) ||
        (log.module || '').toLowerCase().includes(queryLower) ||
        (log.description || '').toLowerCase().includes(queryLower)
      );
    }

    if (filterModule !== 'all') {
      filtered = filtered.filter(log => log.module === filterModule);
    }

    if (filterRole !== 'all') {
      filtered = filtered.filter(log => (log.userRole || '').toLowerCase() === filterRole.toLowerCase());
    }

    if (filterAction !== 'all') {
      filtered = filtered.filter(log => log.actionType === filterAction);
    }

    let start: Date | null = null;
    let end: Date | null = null;
    const now = new Date();

    if (dateFilter === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(start);
      end.setHours(23, 59, 59, 999);
    } else if (dateFilter === 'this_week') {
      const day = now.getDay() || 7;
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(now.getDate() - day + 1);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (dateFilter === 'this_month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (dateFilter === 'last_3_months') {
      start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (dateFilter === 'this_year') {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    } else if (dateFilter === 'custom') {
      if (startDate) {
        start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
      }
      if (endDate) {
        end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
      }
    }

    if (start) {
      filtered = filtered.filter(log => new Date(log.timestamp) >= start!);
    }
    if (end) {
      filtered = filtered.filter(log => new Date(log.timestamp) <= end!);
    }

    filtered.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });

    return filtered;
  };

  const filteredLogs = getFilteredLogs();

  const tabList = [
    { id: 'account', label: 'Account Information', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    ...(user?.role === 'tutor' ? [
      { id: 'payments', label: 'Payment Settings', icon: CreditCard },
      { id: 'subjects', label: 'Subject Management', icon: BookOpen },
      { id: 'logs', label: 'Audit Logs', icon: ShieldAlert },
      { id: 'backup', label: 'Backup & Recovery', icon: Database },
    ] : [])
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your account preferences, system activities, and configurations</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Sidebar Vertical Tabs */}
        <div className="w-full lg:w-64 bg-white rounded-2xl border border-gray-200 p-3 shadow-sm shrink-0 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible no-scrollbar">
          {tabList.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  if (tab.id === 'logs') {
                    setLoadingLogs(true);
                  }
                }}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all whitespace-nowrap lg:whitespace-normal w-fit lg:w-full border ${isActive
                    ? 'bg-green-50 text-green-700 shadow-sm border-green-150/70'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-transparent'
                  }`}
              >
                <Icon size={18} className={isActive ? 'text-green-700' : 'text-gray-400'} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Pane */}
        <div className="flex-1 w-full space-y-6">

          {/* 1. Account Information Tab */}
          {activeTab === 'account' && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm animate-in fade-in-50 duration-200">
              <div className="flex items-center gap-3 mb-6">
                <User size={24} className="text-gray-600" />
                <h2 className="text-xl font-bold text-gray-900">Account Information</h2>
              </div>

              {/* Profile Photo Upload */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-6 pb-6 border-b border-gray-100">
                <ImageUpload
                  currentUrl={user?.photoUrl}
                  onUpload={async (url) => {
                    try {
                      await updateProfilePhoto(url);
                    } catch {
                      toast.error('Failed to save profile photo');
                    }
                  }}
                  folder="tuteepay/profiles"
                  shape="circle"
                  size="lg"
                  label="Change Photo"
                />
                <div className="flex-1 text-center sm:text-left">
                  <p className="font-bold text-gray-900 text-lg">{user?.name}</p>
                  <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1 justify-center sm:justify-start">
                    <Camera size={13} className="text-gray-400" />
                    Click the photo to upload a new profile picture
                  </p>
                  <p className="text-xs text-gray-400 mt-1">Accepted: JPG, PNG, WEBP — max 5 MB</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase font-extrabold text-gray-400 tracking-wider mb-1">Name</label>
                  <input
                    type="text"
                    value={user?.name || ''}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-gray-50 font-semibold text-gray-800"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase font-extrabold text-gray-400 tracking-wider mb-1">
                    {user?.role === 'parent' ? 'Phone Number' : 'Email'}
                  </label>
                  <input
                    type="text"
                    value={
                      user?.role === 'parent'
                        ? (user?.contactNumber || (user?.email?.endsWith('@tuteepay.local') ? user.email.split('@')[0] : user?.email) || '')
                        : (user?.email || '')
                    }
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl bg-gray-50 font-semibold text-gray-800"
                    readOnly
                  />
                </div>
                <p className="text-xs text-gray-500 italic mt-2">
                  Your account is managed through secure Firebase Authentication.
                </p>
              </div>
            </div>
          )}

          {/* 2. Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm animate-in fade-in-50 duration-200">
              <div className="flex items-center gap-3 mb-6">
                <Bell size={24} className="text-gray-600" />
                <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
              </div>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">Push Notifications</p>
                    <p className="text-sm text-gray-500">Receive notifications about payments and sessions</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifications}
                      onChange={(e) => {
                        setNotifications(e.target.checked);
                        toast.success(`Notifications ${e.target.checked ? 'enabled' : 'disabled'}`);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-700"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">Email Reminders</p>
                    <p className="text-sm text-gray-500">Get email reminders for unpaid balances</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailReminders}
                      onChange={(e) => {
                        setEmailReminders(e.target.checked);
                        toast.success(`Email reminders ${e.target.checked ? 'enabled' : 'disabled'}`);
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-700"></div>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* 3. Payment Settings Tab */}
          {activeTab === 'payments' && user?.role === 'tutor' && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm animate-in fade-in-50 duration-200">
              <div className="flex items-center gap-3 mb-6">
                <CreditCard size={24} className="text-gray-600" />
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Payment Settings</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Configure GCash or Maya payment details for parents</p>
                </div>
              </div>

              <div className="space-y-6">
                {(['gcash', 'maya'] as Array<'gcash' | 'maya' | 'bank' | 'other'>).map((method) => {
                  const config = paymentMethods[method];
                  const label = method === 'gcash' ? 'GCash' : 'Maya';

                  return (
                    <div key={method} className="p-5 border rounded-2xl bg-gray-50/50 space-y-4 shadow-inner">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {method === 'gcash' ? (
                            <img src={gcashLogo} alt="GCash Logo" className="w-8 h-8 rounded-xl object-cover shadow-sm shrink-0" />
                          ) : (
                            <img src={mayaLogo} alt="Maya Logo" className="w-8 h-8 rounded-xl object-cover shadow-sm shrink-0" />
                          )}
                          <span className="font-bold text-gray-900">{label}</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={config.enabled}
                            onChange={(e) => setPaymentMethods(prev => ({
                              ...prev,
                              [method]: { ...prev[method], enabled: e.target.checked }
                            }))}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-700"></div>
                        </label>
                      </div>

                      {config.enabled && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                          <div className="md:col-span-2 space-y-3">
                            {(method === 'bank' || method === 'other') && (
                              <div>
                                <label className="block text-xs uppercase font-extrabold text-gray-400 tracking-wider mb-1">
                                  Bank / Provider Name *
                                </label>
                                <input
                                  type="text"
                                  value={(config as any).bankName || ''}
                                  onChange={(e) => setPaymentMethods(prev => ({
                                    ...prev,
                                    [method]: { ...prev[method], bankName: e.target.value }
                                  }))}
                                  placeholder={method === 'bank' ? "e.g., BDO, BPI, Metrobank" : "e.g., PayPal, GrabPay"}
                                  className="w-full px-4 py-2 border border-gray-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-semibold"
                                />
                              </div>
                            )}
                            <div>
                              <label className="block text-xs uppercase font-extrabold text-gray-400 tracking-wider mb-1">
                                Account Name *
                              </label>
                              <input
                                type="text"
                                value={config.accountName}
                                onChange={(e) => setPaymentMethods(prev => ({
                                  ...prev,
                                  [method]: { ...prev[method], accountName: e.target.value }
                                }))}
                                placeholder="e.g., Juan Dela Cruz"
                                className="w-full px-4 py-2 border border-gray-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-semibold"
                              />
                            </div>
                            <div>
                              <label className="block text-xs uppercase font-extrabold text-gray-400 tracking-wider mb-1">
                                Account Number *
                              </label>
                              <input
                                type="text"
                                value={config.accountNumber}
                                onChange={(e) => setPaymentMethods(prev => ({
                                  ...prev,
                                  [method]: { ...prev[method], accountNumber: e.target.value }
                                }))}
                                placeholder={method === 'bank' ? "e.g., 1234-5678-9012" : "e.g., 0917-123-4567"}
                                className="w-full px-4 py-2 border border-gray-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-semibold"
                              />
                            </div>
                            {method === 'other' && (
                              <div>
                                <label className="block text-xs uppercase font-extrabold text-gray-400 tracking-wider mb-1">
                                  Custom Instructions / Notes (Optional)
                                </label>
                                <textarea
                                  value={(config as any).instructions || ''}
                                  onChange={(e) => setPaymentMethods(prev => ({
                                    ...prev,
                                    [method]: { ...prev[method], instructions: e.target.value }
                                  }))}
                                  placeholder="Add any extra details or steps for this payment method..."
                                  rows={2}
                                  className="w-full px-4 py-2 border border-gray-200 bg-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm font-semibold resize-none"
                                />
                              </div>
                            )}
                          </div>
                          <div className="md:col-span-1 flex flex-col items-center">
                            <label className="block text-xs uppercase font-extrabold text-gray-400 tracking-wider mb-2 text-center w-full">
                              QR Code Image
                            </label>
                            <ImageUpload
                              currentUrl={config.qrUrl}
                              onUpload={(url) => setPaymentMethods(prev => ({
                                ...prev,
                                [method]: { ...prev[method], qrUrl: url }
                              }))}
                              folder={`tuteepay/qrs/${user?.id}`}
                              shape="square"
                              size="md"
                              label="Upload QR Code"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="flex justify-end pt-4 border-t border-gray-100">
                  <button
                    onClick={handleSavePaymentSettings}
                    disabled={isSavingPayments}
                    className="bg-green-700 text-white px-6 py-2.5 rounded-xl hover:bg-green-800 disabled:bg-gray-400 font-bold transition-all text-sm shadow-sm"
                  >
                    {isSavingPayments ? 'Saving...' : 'Save Payment Settings'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 4. Subject Management Tab */}
          {activeTab === 'subjects' && user?.role === 'tutor' && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm animate-in fade-in-50 duration-200">
              <div className="flex items-center gap-3 mb-6">
                <BookOpen size={24} className="text-gray-600" />
                <h2 className="text-xl font-bold text-gray-900">Subject Management</h2>
              </div>
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Manage custom subjects for your tutoring sessions. Only your custom subjects will appear when creating or editing students.
                </p>

                <form onSubmit={handleAddSubject} className="flex gap-2">
                  <input
                    type="text"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    placeholder="Enter subject name (e.g., Mathematics)"
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-700 text-sm font-semibold"
                  />
                  <button
                    type="submit"
                    disabled={isAddingSubject || !newSubjectName.trim()}
                    className="flex items-center gap-2 bg-green-700 text-white px-4 py-2 rounded-xl hover:bg-green-800 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold text-sm transition-colors"
                  >
                    <Plus size={18} />
                    Add Subject
                  </button>
                </form>

                {subjectsLoading ? (
                  <div className="text-center py-4 text-gray-500 font-medium">Loading subjects...</div>
                ) : subjects.length === 0 ? (
                  <div className="bg-gray-50 rounded-xl p-8 text-center border-2 border-dashed">
                    <BookOpen size={36} className="mx-auto mb-2 text-gray-300" />
                    <p className="text-gray-500 text-sm font-semibold">No custom subjects yet</p>
                    <p className="text-gray-400 text-xs mt-1">Add your first subject using the field above!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    {subjects.map((subject) => (
                      <div
                        key={subject.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200 hover:shadow-md transition-all group"
                      >
                        <span className="font-semibold text-gray-800 text-sm">{subject.name}</span>
                        <button
                          onClick={() => handleDeleteSubject(subject.id, subject.name)}
                          className="text-gray-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete subject"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. Audit Logs Tab */}
          {activeTab === 'logs' && user?.role === 'tutor' && (
            <div className="space-y-6 animate-in fade-in-50 duration-200">

              {/* Stat Cards Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total activities card */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300" />
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center relative shrink-0">
                    <Activity size={22} />
                  </div>
                  <div className="relative">
                    <p className="text-2xl font-black text-gray-900">{stats.total}</p>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Total Logs</p>
                  </div>
                </div>

                {/* Today's activities card */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300" />
                  <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center relative shrink-0">
                    <Clock size={22} />
                  </div>
                  <div className="relative">
                    <p className="text-2xl font-black text-gray-900">{stats.today}</p>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Today's Logs</p>
                  </div>
                </div>

                {/* Attendance activities card */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300" />
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center relative shrink-0">
                    <Calendar size={22} />
                  </div>
                  <div className="relative">
                    <p className="text-2xl font-black text-gray-900">{stats.attendance}</p>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Attendance Logs</p>
                  </div>
                </div>

                {/* Billing activities card */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4 hover:shadow-md transition-all relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full translate-x-8 -translate-y-8 group-hover:scale-110 transition-transform duration-300" />
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center relative shrink-0">
                    <CreditCard size={22} />
                  </div>
                  <div className="relative">
                    <p className="text-2xl font-black text-gray-900">{stats.billing}</p>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-0.5">Billing Logs</p>
                  </div>
                </div>
              </div>

              {/* Filtering Panel */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-gray-900 font-bold text-base mb-1">
                  <SlidersHorizontal size={18} className="text-green-700" />
                  <span>Search & Filter Logs</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Search query input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search logs (e.g. name, action)..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-gray-200 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white text-sm font-semibold"
                    />
                  </div>

                  {/* Module dropdown filter */}
                  <div>
                    <select
                      value={filterModule}
                      onChange={e => setFilterModule(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 font-semibold text-sm text-gray-700"
                    >
                      <option value="all">All Modules</option>
                      {Object.keys(MODULE_ACTIONS).filter(k => k !== 'all').map(mod => (
                        <option key={mod} value={mod}>{mod}</option>
                      ))}
                    </select>
                  </div>

                  {/* Action Type filter */}
                  <div>
                    <select
                      value={filterAction}
                      onChange={e => setFilterAction(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 font-semibold text-sm text-gray-700"
                    >
                      <option value="all">All Action Types</option>
                      {filterModule !== 'all' && MODULE_ACTIONS[filterModule]?.map(act => (
                        <option key={act} value={act}>{act}</option>
                      ))}
                      {filterModule === 'all' && Object.values(MODULE_ACTIONS).flat().map(act => (
                        <option key={act} value={act}>{act}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                  {/* Date preset filter */}
                  <div>
                    <select
                      value={dateFilter}
                      onChange={e => setDateFilter(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 font-semibold text-sm text-gray-700"
                    >
                      <option value="all">All Dates</option>
                      <option value="today">Today</option>
                      <option value="this_week">This Week</option>
                      <option value="this_month">This Month</option>
                      <option value="last_3_months">Last 3 Months</option>
                      <option value="this_year">This Year</option>
                      <option value="custom">Custom Date Range</option>
                    </select>
                  </div>

                  {/* Custom Date range start */}
                  {dateFilter === 'custom' && (
                    <div className="flex items-center gap-2 border border-gray-200 bg-gray-50 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-green-500">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider shrink-0">Start</span>
                      <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="bg-transparent focus:outline-none w-full text-sm font-semibold text-gray-700"
                      />
                    </div>
                  )}

                  {/* Custom Date range end */}
                  {dateFilter === 'custom' && (
                    <div className="flex items-center gap-2 border border-gray-200 bg-gray-50 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-green-500">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider shrink-0">End</span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        className="bg-transparent focus:outline-none w-full text-sm font-semibold text-gray-700"
                      />
                    </div>
                  )}

                  {/* Role filter */}
                  <div>
                    <select
                      value={filterRole}
                      onChange={e => setFilterRole(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 font-semibold text-sm text-gray-700"
                    >
                      <option value="all">All Roles</option>
                      <option value="tutor">Tutor</option>
                      <option value="parent">Parent</option>
                    </select>
                  </div>

                  {/* Sort Order & Reset */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                      className="flex-1 flex items-center justify-center gap-2 border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-xl text-sm font-semibold text-gray-750 transition-colors"
                      title={sortOrder === 'newest' ? 'Sort oldest first' : 'Sort newest first'}
                    >
                      <ArrowUpDown size={15} className="text-gray-400" />
                      <span>{sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}</span>
                    </button>
                    {(searchQuery || filterModule !== 'all' || filterRole !== 'all' || filterAction !== 'all' || dateFilter !== 'all') && (
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setFilterModule('all');
                          setFilterRole('all');
                          setFilterAction('all');
                          setDateFilter('all');
                          setStartDate('');
                          setEndDate('');
                        }}
                        className="bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 p-2.5 rounded-xl text-sm font-semibold transition-colors"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Logs Table Area */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                {loadingLogs ? (
                  <div className="p-16 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700 mx-auto" />
                    <p className="text-gray-500 text-sm mt-3 font-semibold">Loading system audit activities...</p>
                  </div>
                ) : filteredLogs.length === 0 ? (
                  <div className="p-16 text-center border-2 border-dashed">
                    <ShieldAlert size={40} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-500 font-semibold">No audit logs found</p>
                    <p className="text-gray-400 text-xs mt-1">Try updating your filters or search query.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="p-4 text-xs font-extrabold uppercase text-gray-400 tracking-wider">Date & Time</th>
                          <th className="p-4 text-xs font-extrabold uppercase text-gray-400 tracking-wider">User</th>
                          <th className="p-4 text-xs font-extrabold uppercase text-gray-400 tracking-wider">Role</th>
                          <th className="p-4 text-xs font-extrabold uppercase text-gray-400 tracking-wider">Module</th>
                          <th className="p-4 text-xs font-extrabold uppercase text-gray-400 tracking-wider">Action</th>
                          <th className="p-4 text-xs font-extrabold uppercase text-gray-400 tracking-wider max-w-xs">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredLogs.map((log) => {
                          const isTutor = log.userRole === 'tutor';
                          const moduleClasses: Record<string, string> = {
                            'Authentication': 'bg-gray-100 text-gray-800 border-gray-200',
                            'Students': 'bg-teal-50 text-teal-800 border-teal-200',
                            'Scheduling': 'bg-sky-50 text-sky-800 border-sky-200',
                            'Attendance': 'bg-green-50 text-green-800 border-green-200',
                            'Tutee Progress': 'bg-purple-50 text-purple-800 border-purple-200',
                            'Billing': 'bg-emerald-50 text-emerald-800 border-emerald-200',
                            'Announcements': 'bg-amber-50 text-amber-800 border-amber-200',
                            'Messaging': 'bg-pink-50 text-pink-800 border-pink-200',
                            'Parent Portal': 'bg-indigo-50 text-indigo-800 border-indigo-200'
                          };
                          const badgeClass = moduleClasses[log.module] || 'bg-gray-50 text-gray-700 border-gray-200';

                          return (
                            <tr
                              key={log.id}
                              onClick={() => setSelectedLog(log)}
                              className="hover:bg-green-50/20 cursor-pointer transition-colors group"
                            >
                              <td className="p-4 text-xs text-gray-500 font-semibold whitespace-nowrap">
                                {new Date(log.timestamp).toLocaleString()}
                              </td>
                              <td className="p-4 text-sm font-bold text-gray-900 group-hover:text-green-700 transition-colors">
                                {log.userName || 'System User'}
                              </td>
                              <td className="p-4">
                                <span className={`text-[10px] px-2 py-0.5 font-bold uppercase rounded-full border tracking-wide ${isTutor ? 'bg-emerald-50 border-emerald-250 text-emerald-700' : 'bg-blue-50 border-blue-200 text-blue-755'
                                  }`}>
                                  {log.userRole || 'User'}
                                </span>
                              </td>
                              <td className="p-4">
                                <span className={`text-[10px] px-2 py-0.5 font-bold uppercase rounded-full border tracking-wide ${badgeClass}`}>
                                  {log.module}
                                </span>
                              </td>
                              <td className="p-4 text-sm font-semibold text-gray-800">
                                {log.actionType}
                              </td>
                              <td className="p-4 text-xs text-gray-600 max-w-xs truncate font-medium">
                                {log.description}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Log Detail Dialog Overlay Modal */}
              {selectedLog && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                  <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
                    <div className="bg-gradient-to-br from-green-700 to-green-950 p-5 text-white flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <ShieldAlert size={20} className="text-green-200" />
                        <h3 className="font-bold text-lg">Activity Log Details</h3>
                      </div>
                      <button
                        onClick={() => setSelectedLog(null)}
                        className="text-white/70 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className="p-6 space-y-4">
                      {/* Log ID */}
                      <div className="pb-3 border-b border-gray-100 flex justify-between items-center">
                        <span className="text-xs uppercase font-extrabold text-gray-400 tracking-wider">Log UID</span>
                        <span className="text-xs font-mono font-bold text-gray-500 bg-gray-50 px-2.5 py-1 rounded-lg border">{selectedLog.id}</span>
                      </div>

                      {/* Date & Time */}
                      <div className="pb-3 border-b border-gray-100 flex justify-between items-center">
                        <span className="text-xs uppercase font-extrabold text-gray-400 tracking-wider">Date & Time</span>
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                          <Clock size={14} className="text-gray-400" />
                          <span>{new Date(selectedLog.timestamp).toLocaleString()}</span>
                        </div>
                      </div>

                      {/* User Info */}
                      <div className="pb-3 border-b border-gray-100 flex justify-between items-center">
                        <span className="text-xs uppercase font-extrabold text-gray-400 tracking-wider">Triggered By</span>
                        <div className="text-right">
                          <p className="text-sm font-bold text-gray-900">{selectedLog.userName}</p>
                          <p className="text-xs font-medium text-gray-400 mt-0.5">UID: {selectedLog.userId}</p>
                        </div>
                      </div>

                      {/* User Role */}
                      <div className="pb-3 border-b border-gray-100 flex justify-between items-center">
                        <span className="text-xs uppercase font-extrabold text-gray-400 tracking-wider">User Role</span>
                        <span className={`text-[10px] px-2.5 py-0.5 font-bold uppercase rounded-full border tracking-wide ${selectedLog.userRole === 'tutor' ? 'bg-emerald-50 border-emerald-250 text-emerald-700' : 'bg-blue-50 border-blue-200 text-blue-755'
                          }`}>{selectedLog.userRole}</span>
                      </div>

                      {/* System Module */}
                      <div className="pb-3 border-b border-gray-100 flex justify-between items-center">
                        <span className="text-xs uppercase font-extrabold text-gray-400 tracking-wider">System Module</span>
                        <span className="text-sm font-bold text-gray-800">{selectedLog.module}</span>
                      </div>

                      {/* Action Type */}
                      <div className="pb-3 border-b border-gray-100 flex justify-between items-center">
                        <span className="text-xs uppercase font-extrabold text-gray-400 tracking-wider">Action Type</span>
                        <span className="text-sm font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-lg border border-green-200">{selectedLog.actionType}</span>
                      </div>

                      {/* Description Block */}
                      <div className="space-y-1.5">
                        <span className="block text-xs uppercase font-extrabold text-gray-400 tracking-wider">Action Description</span>
                        <p className="text-sm text-gray-800 bg-gray-50 p-4 rounded-xl border leading-relaxed font-semibold">
                          {selectedLog.description}
                        </p>
                      </div>
                    </div>

                    <div className="bg-gray-50 px-6 py-4 flex justify-end border-t">
                      <button
                        onClick={() => setSelectedLog(null)}
                        className="bg-white border hover:bg-gray-100 text-gray-700 px-5 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors"
                      >
                        Close Details
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 6. Backup & Recovery Tab (Data Management) */}
          {activeTab === 'backup' && user?.role === 'tutor' && (
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm animate-in fade-in-50 duration-200 space-y-6">
              <div className="flex items-center gap-3">
                <Database size={24} className="text-gray-600" />
                <h2 className="text-xl font-bold text-gray-900">Backup & Recovery</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Side: Backup & Wipe */}
                <div className="space-y-6">
                  {/* Export Data Box */}
                  <div className="border border-gray-200 p-5 rounded-2xl bg-gray-50/50 space-y-3 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                        <Download size={18} className="text-green-700" />
                        <span>Export Data Backup</span>
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Download a complete, offline snapshot of your entire classroom, including tutee lists, logs, subjects, progress reports, payment histories, parent accounts, and billing settings.
                      </p>
                    </div>
                    <button
                      onClick={handleExportData}
                      disabled={isExporting}
                      className="w-full flex items-center justify-center gap-2 bg-green-755 hover:bg-green-800 text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-md shadow-green-700/10 disabled:bg-gray-400 cursor-pointer"
                    >
                      <Download size={16} />
                      {isExporting ? 'Exporting Backup...' : 'Generate JSON Backup'}
                    </button>
                  </div>

                  {/* Wipe Data Box */}
                  <div className="border border-red-200 p-5 rounded-2xl bg-red-50/10 space-y-3 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-red-700 text-base flex items-center gap-2">
                        <Trash2 size={18} className="text-red-600" />
                        <span>Clear Cloud Data</span>
                      </h3>
                      <p className="text-sm text-red-900/60 mt-1">
                        Wipe all cloud data records associated with your account from Firebase. This will permanently delete your students, schedules, billing transactions, and messages.
                      </p>
                    </div>
                    <button
                      onClick={handleClearData}
                      disabled={isClearing}
                      className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-md shadow-red-700/10 disabled:bg-gray-400 cursor-pointer"
                    >
                      <Trash2 size={16} />
                      {isClearing ? 'Clearing Data...' : 'Wipe Account Data'}
                    </button>
                  </div>
                </div>

                {/* Right Side: Restore / Recovery */}
                <div className="border border-gray-200 p-5 rounded-2xl bg-gray-50/50 space-y-4 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                      <SlidersHorizontal size={18} className="text-green-700" />
                      <span>Restore Data Backup</span>
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Upload a previously exported JSON backup file to restore your database records in Firebase. Overwrites existing documents matching backup IDs.
                    </p>

                    <div className="mt-4">
                      {!parsedBackupData ? (
                        <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-6 bg-white hover:bg-gray-50 transition-colors cursor-pointer text-center">
                          <Download size={28} className="text-gray-400 mb-2" />
                          <span className="text-sm font-semibold text-gray-700">Select Backup file (.json)</span>
                          <span className="text-xs text-gray-400 mt-1">Click to browse or drop file here</span>
                          <input
                            type="file"
                            accept=".json"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </label>
                      ) : (
                        <div className="bg-white border rounded-xl p-4 space-y-3 shadow-inner">
                          <div className="flex justify-between items-center pb-2 border-b">
                            <span className="text-xs font-bold text-green-755 truncate max-w-[200px]">{selectedFile?.name}</span>
                            <button
                              onClick={() => {
                                setParsedBackupData(null);
                                setSelectedFile(null);
                              }}
                              className="text-xs text-red-500 hover:text-red-700 font-bold"
                            >
                              Clear
                            </button>
                          </div>
                          <div className="space-y-1.5 text-xs text-gray-600 font-semibold">
                            <p className="font-bold text-gray-900 mb-1">Backup Contents Preview:</p>
                            <div className="grid grid-cols-2 gap-2">
                              <div>• Tutees: {parsedBackupData.tutees?.length || 0}</div>
                              <div>• Parent Accounts: {parsedBackupData.parentAccounts?.length || 0}</div>
                              <div>• Schedules: {parsedBackupData.sessions?.length || 0}</div>
                              <div>• Payments: {parsedBackupData.payments?.length || 0}</div>
                              <div>• Attendance Records: {parsedBackupData.paymentRecords?.length || 0}</div>
                              <div>• Tutee Assessments: {parsedBackupData.assessments?.length || 0}</div>
                              <div>• Progress Reports: {parsedBackupData.progressReports?.length || 0}</div>
                              <div>• Announcements: {parsedBackupData.announcements?.length || 0}</div>
                              <div>• Custom Subjects: {parsedBackupData.subjects?.length || 0}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {importError && (
                        <p className="text-xs font-semibold text-red-600 mt-2">{importError}</p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={handleRestoreBackup}
                    disabled={isImporting || !parsedBackupData}
                    className="w-full flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800 disabled:bg-gray-300 text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-md shadow-green-700/10 cursor-pointer"
                  >
                    <Activity size={16} className={isImporting ? 'animate-spin' : ''} />
                    {isImporting ? 'Restoring Backup...' : 'Restore Database Records'}
                  </button>
                </div>
              </div>

              {/* How it works documentation */}
              <div className="border border-green-200 bg-green-50/30 rounded-2xl p-6 space-y-4">
                <h3 className="font-bold text-green-950 text-base flex items-center gap-2">
                  <Info size={20} className="text-green-700" />
                  <span>How Backup & Recovery Works</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-green-900 font-semibold leading-relaxed">
                  <div className="space-y-2">
                    <p className="font-bold text-green-950">Real-time Cloud Storage</p>
                    <p className="font-normal text-xs text-green-800">
                      All operational data (students, attendance, schedules, payments) is stored in Google Firebase Firestore.
                      Since records are kept in the cloud, your data is inherently protected against local device hardware damage or file corruption.
                    </p>
                    <p className="font-bold text-green-950">Periodic Database Exports</p>
                    <p className="font-normal text-xs text-green-800">
                      We recommend exporting database records weekly or monthly. Click "Generate JSON Backup" above to download
                      an offline backup file containing all structured records of your classroom.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-bold text-green-950">Dedicated Google Drive Archive</p>
                    <p className="font-normal text-xs text-green-800">
                      For secondary storage:
                      <br />
                      1. Create a dedicated folder in your Google Drive named <code className="bg-green-100 px-1 py-0.5 rounded font-mono font-bold text-green-950">Tutor Track Backups</code>.
                      <br />
                      2. Drag and upload your exported JSON backup file into this Google Drive folder after every weekly or monthly export.
                    </p>
                    <p className="font-bold text-green-950">Restoration Flow</p>
                    <p className="font-normal text-xs text-green-800">
                      If records are accidentally modified or deleted, locate your secondary backup folder in Google Drive.
                      Download the latest backup file, upload it in the "Restore Data Backup" card above, and click restore to synchronize the records back into Firebase.
                    </p>
                  </div>
                </div>
              </div>

              {/* Status info box */}
              <div className="bg-green-50 rounded-2xl border border-green-200 p-5">
                <div className="flex items-start gap-3">
                  <Info size={24} className="text-green-700 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-bold text-green-900 mb-1">Firebase Sync Connected</h3>
                    <p className="text-sm text-green-800 leading-relaxed font-semibold">
                      Your TuteePay Tracker is synchronized in real-time with your Google Firebase Cloud.
                      All security updates, automated hourly backups, and database transaction tracking are active.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};