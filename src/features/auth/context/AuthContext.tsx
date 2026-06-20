import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/shared/lib/firebase/config';
import { registerUser, loginUser, logoutUser, resetPassword as resetUserPassword } from '@/shared/lib/firebase/auth';
import { logActivity } from '@/shared/utils/auditLogger';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'tutor' | 'parent';
  mustChangePassword?: boolean;
  linkedStudentIds?: string[];
  createdByTutorId?: string;
  contactNumber?: string;
  photoUrl?: string;
  paymentMethods?: {
    gcash?: { qrUrl?: string; accountName?: string; accountNumber?: string; enabled: boolean };
    maya?: { qrUrl?: string; accountName?: string; accountNumber?: string; enabled: boolean };
    bank?: { qrUrl?: string; accountName?: string; accountNumber?: string; bankName?: string; enabled: boolean };
    other?: { qrUrl?: string; accountName?: string; accountNumber?: string; bankName?: string; instructions?: string; enabled: boolean };
  };
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, role?: 'tutor' | 'parent') => Promise<void>;
  logout: () => void;
  resetPassword: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfilePhoto: (photoUrl: string) => Promise<void>;
  updatePaymentMethods: (paymentMethods: User['paymentMethods']) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Listen to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUser({
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: userData.name || firebaseUser.displayName || '',
            role: userData.role || 'tutor',
            mustChangePassword: userData.mustChangePassword || false,
            linkedStudentIds: userData.linkedStudentIds || [],
            createdByTutorId: userData.createdByTutorId,
            contactNumber: userData.contactNumber,
            photoUrl: userData.photoUrl || null,
            paymentMethods: userData.paymentMethods || {},
          });
        } else {
          const userData: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || '',
            role: 'tutor',
            mustChangePassword: false,
            linkedStudentIds: [],
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), {
            name: firebaseUser.displayName || '',
            email: firebaseUser.email,
            role: 'tutor',
            mustChangePassword: false,
            linkedStudentIds: [],
            createdAt: new Date().toISOString(),
          });
          setUser(userData);
        }
      } else {
        // User is signed out
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const firebaseUser = await loginUser(email, password);
      const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        await logActivity(
          firebaseUser.uid,
          userData.name || 'User',
          userData.role || 'tutor',
          'Login',
          'Authentication',
          `User ${userData.name || firebaseUser.email} logged in`
        );
      }
    } catch (error: any) {
      setIsLoading(false);
      // Re-throw error with user-friendly message
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        throw new Error('Invalid email or password');
      } else if (error.code === 'auth/user-not-found') {
        throw new Error('No account found with this email');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Invalid email address');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many failed attempts. Please try again later');
      } else {
        throw new Error('Login failed. Please try again');
      }
    }
  };

  const signup = async (email: string, password: string, name: string, role: 'tutor' | 'parent' = 'tutor') => {
    setIsLoading(true);
    try {
      // Create user in Firebase Auth
      const firebaseUser = await registerUser(email, password, name);
      
      // Create user document in Firestore
      await setDoc(doc(db, 'users', firebaseUser.uid), {
        name: name,
        email: email,
        role: role,
        createdAt: new Date().toISOString(),
      });

      // User state will be updated by onAuthStateChanged listener
    } catch (error: any) {
      setIsLoading(false);
      // Re-throw error with user-friendly message
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('An account with this email already exists');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Invalid email address');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('Password is too weak. Please use a stronger password');
      } else {
        throw new Error('Signup failed. Please try again');
      }
    }
  };

  const refreshUser = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      setUser({
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        name: userData.name || '',
        role: userData.role || 'tutor',
        mustChangePassword: userData.mustChangePassword || false,
        linkedStudentIds: userData.linkedStudentIds || [],
        createdByTutorId: userData.createdByTutorId,
        contactNumber: userData.contactNumber,
        photoUrl: userData.photoUrl || null,
        paymentMethods: userData.paymentMethods || {},
      });
    }
  };

  const updateProfilePhoto = async (photoUrl: string) => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    const { updateDoc, doc: fsDoc } = await import('firebase/firestore');
    await updateDoc(fsDoc(db, 'users', firebaseUser.uid), { photoUrl });
    setUser(prev => prev ? { ...prev, photoUrl } : prev);
  };

  const updatePaymentMethods = async (paymentMethods: User['paymentMethods']) => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    const { updateDoc, doc: fsDoc } = await import('firebase/firestore');
    
    // Safely remove any undefined properties recursively before sending to Firestore
    const sanitizedMethods = JSON.parse(JSON.stringify(paymentMethods || {}));
    
    await updateDoc(fsDoc(db, 'users', firebaseUser.uid), { paymentMethods: sanitizedMethods });
    setUser(prev => prev ? { ...prev, paymentMethods: sanitizedMethods } : prev);
  };

  const logout = async () => {
    if (user) {
      await logActivity(
        user.id,
        user.name,
        user.role,
        'Logout',
        'Authentication',
        `User ${user.name} logged out`
      );
    }
    await logoutUser();
    setUser(null);
  };

  const resetPassword = async (email: string) => {
    try {
      await resetUserPassword(email);
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        throw new Error('No account found with this email');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Invalid email address');
      } else {
        throw new Error('Failed to send reset email. Please try again');
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        signup,
        logout,
        resetPassword,
        refreshUser,
        updateProfilePhoto,
        updatePaymentMethods,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};