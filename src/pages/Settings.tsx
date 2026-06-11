import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSubjects } from '../hooks/useSubjects';
import { User, Bell, Database, Info, BookOpen, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export const Settings = () => {
  const { user } = useAuth();
  const { subjects, addSubject, deleteSubject, isLoading: subjectsLoading } = useSubjects();
  const [notifications, setNotifications] = useState(true);
  const [emailReminders, setEmailReminders] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [isAddingSubject, setIsAddingSubject] = useState(false);

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubjectName.trim()) {
      toast.error('Please enter a subject name');
      return;
    }

    // Check for duplicates
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

  const handleClearData = async () => {
    if (!user) {
      toast.error('You must be logged in to clear data');
      return;
    }

    if (window.confirm('Are you sure you want to delete all your data? This action cannot be undone.')) {
      setIsClearing(true);
      try {
        // Delete all tutees
        const tuteesRef = collection(db, 'users', user.id, 'tutees');
        const tuteesSnapshot = await getDocs(tuteesRef);
        await Promise.all(tuteesSnapshot.docs.map(doc => deleteDoc(doc.ref)));

        // Delete all payments
        const paymentsRef = collection(db, 'users', user.id, 'payments');
        const paymentsSnapshot = await getDocs(paymentsRef);
        await Promise.all(paymentsSnapshot.docs.map(doc => deleteDoc(doc.ref)));

        // Delete all sessions
        const sessionsRef = collection(db, 'users', user.id, 'sessions');
        const sessionsSnapshot = await getDocs(sessionsRef);
        await Promise.all(sessionsSnapshot.docs.map(doc => deleteDoc(doc.ref)));

        // Delete all payment records
        const recordsRef = collection(db, 'users', user.id, 'paymentRecords');
        const recordsSnapshot = await getDocs(recordsRef);
        await Promise.all(recordsSnapshot.docs.map(doc => deleteDoc(doc.ref)));

        // Delete all payment transactions
        const transactionsRef = collection(db, 'users', user.id, 'paymentTransactions');
        const transactionsSnapshot = await getDocs(transactionsRef);
        await Promise.all(transactionsSnapshot.docs.map(doc => deleteDoc(doc.ref)));

        toast.success('All data cleared successfully. Please refresh the page.');
      } catch (error) {
        console.error('Error clearing data:', error);
        toast.error('Failed to clear data. Please try again.');
      } finally {
        setIsClearing(false);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your account and preferences</p>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center gap-3 mb-6">
          <User size={24} className="text-gray-600" />
          <h2 className="text-xl font-semibold">Account Information</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Name</label>
            <input
              type="text"
              value={user?.name || ''}
              className="w-full p-2 border rounded-lg bg-gray-50"
              readOnly
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              {user?.role === 'parent' ? 'Phone Number' : 'Email'}
            </label>
            <input
              type="text"
              value={
                user?.role === 'parent'
                  ? (user?.contactNumber || (user?.email?.endsWith('@tuteepay.local') ? user.email.split('@')[0] : user?.email) || '')
                  : (user?.email || '')
              }
              className="w-full p-2 border rounded-lg bg-gray-50"
              readOnly
            />
          </div>
          <p className="text-sm text-gray-500">
            Your account is managed through Firebase Authentication.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center gap-3 mb-6">
          <Bell size={24} className="text-gray-600" />
          <h2 className="text-xl font-semibold">Notifications</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Push Notifications</p>
              <p className="text-sm text-gray-600">Receive notifications about payments and sessions</p>
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
              <p className="font-medium">Email Reminders</p>
              <p className="text-sm text-gray-600">Get email reminders for unpaid balances</p>
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

      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center gap-3 mb-6">
          <BookOpen size={24} className="text-gray-600" />
          <h2 className="text-xl font-semibold">Subject Management</h2>
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
              className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700"
            />
            <button
              type="submit"
              disabled={isAddingSubject || !newSubjectName.trim()}
              className="flex items-center gap-2 bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <Plus size={18} />
              Add Subject
            </button>
          </form>

          {subjectsLoading ? (
            <div className="text-center py-4 text-gray-500">Loading subjects...</div>
          ) : subjects.length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <BookOpen size={32} className="mx-auto mb-2 text-gray-400" />
              <p className="text-gray-500 text-sm">No custom subjects yet. Add your first subject above!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {subjects.map((subject) => (
                <div
                  key={subject.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border hover:shadow-sm transition-shadow"
                >
                  <span className="font-medium text-gray-900">{subject.name}</span>
                  <button
                    onClick={() => handleDeleteSubject(subject.id, subject.name)}
                    className="text-red-600 hover:text-red-700 p-1"
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

      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center gap-3 mb-6">
          <Database size={24} className="text-gray-600" />
          <h2 className="text-xl font-semibold">Data Management</h2>
        </div>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Your data is stored securely in Firebase Firestore. Clear all data to start fresh.
          </p>
          <button
            onClick={handleClearData}
            disabled={isClearing}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isClearing ? 'Clearing...' : 'Clear All Data'}
          </button>
        </div>
      </div>

      <div className="bg-green-50 rounded-lg border border-green-200 p-6">
        <div className="flex items-start gap-3">
          <Info size={24} className="text-green-700 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-semibold text-green-900 mb-2">Firebase Connected</h3>
            <p className="text-sm text-green-800">
              Your TuteePay Tracker is connected to Firebase. All your data is securely stored 
              in the cloud with real-time synchronization, user authentication, and automatic backups.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};