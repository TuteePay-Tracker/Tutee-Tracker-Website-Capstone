import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/shared/lib/firebase/config';
import { registerUser, loginUser, logoutUser, resetPassword as resetUserPassword } from '@/shared/lib/firebase/auth';
import { logActivity } from '@/shared/utils/auditLogger';
import { setLoggingOut } from '@/shared/utils/firestoreErrors';
import { useInactivityTimeout } from '@/shared/hooks/useInactivityTimeout';
import { InactivityWarning } from '@/shared/components/InactivityWarning';
import { toast } from 'sonner';

export type UserRole = 'tutor' | 'parent' | 'super_admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status?: string;
  mustChangePassword?: boolean;
  linkedStudentIds?: string[];
  createdByTutorId?: string;
  contactNumber?: string;
  photoUrl?: string;
  paymentMethods?: {
    dueDay?: number;
    gcash?: { qrUrl?: string; accountName?: string; accountNumber?: string; enabled: boolean };
    maya?: { qrUrl?: string; accountName?: string; accountNumber?: string; enabled: boolean };
    bank?: { qrUrl?: string; accountName?: string; accountNumber?: string; bankName?: string; enabled: boolean };
    other?: { qrUrl?: string; accountName?: string; accountNumber?: string; bankName?: string; instructions?: string; enabled: boolean };
  };
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<UserRole>;
  signup: (email: string, password: string, name: string, role?: 'tutor' | 'parent') => Promise<void>;
  logout: () => void;
  resetPassword: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfilePhoto: (photoUrl: string) => Promise<void>;
  updatePaymentMethods: (paymentMethods: User['paymentMethods']) => Promise<void>;
}

const resolveRole = (role: unknown): UserRole =>
  role === 'parent' || role === 'super_admin' ? role : 'tutor';

// Missing status is treated as active for legacy tutor/parent accounts.
// Super Admin must be explicitly provisioned as active.
const isAccountActive = (role: UserRole, status?: string): boolean =>
  role === 'super_admin' ? status === 'active' : !status || status === 'active';

const buildUser = (firebaseUser: FirebaseUser, data: Record<string, any>): User => {
  const role = resolveRole(data.role);
  return {
    id: firebaseUser.uid,
    email: firebaseUser.email || '',
    name: data.name || firebaseUser.displayName || '',
    role,
    status: typeof data.status === 'string' ? data.status : undefined,
    mustChangePassword: data.mustChangePassword || false,
    linkedStudentIds: data.linkedStudentIds || [],
    createdByTutorId: data.createdByTutorId,
    contactNumber: data.contactNumber,
    photoUrl: data.photoUrl || null,
    paymentMethods: data.paymentMethods || {},
  };
};

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
  const [user, setUserState] = useState<User | null>(() => {
    try {
      const cached = localStorage.getItem('tutortrack_auth_user');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const isSigningUp = useRef<boolean>(false);

  const setUser = (newUser: User | null | ((prev: User | null) => User | null)) => {
    setUserState((prev) => {
      const next = typeof newUser === 'function' ? newUser(prev) : newUser;
      try {
        if (next) {
          localStorage.setItem('tutortrack_auth_user', JSON.stringify(next));
        } else {
          localStorage.removeItem('tutortrack_auth_user');
        }
      } catch (err) {
        // ignore storage errors
      }
      return next;
    });
  };

  useEffect(() => {
    // Listen to Firebase auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // If signup is in progress, signup() handles creating the user document and setting user state
      if (isSigningUp.current) {
        return;
      }

      try {
        if (firebaseUser) {
          let userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

          // If doc is not yet visible, retry briefly before rejecting the session
          if (!userDoc.exists()) {
            for (let i = 0; i < 3 && !userDoc.exists(); i++) {
              await new Promise((res) => setTimeout(res, 200));
              userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            }
          }

          if (!userDoc.exists()) {
            toast.error('Account not provisioned. Please contact your administrator.');
            await logoutUser().catch(() => undefined);
            setUser(null);
          } else {
            const userData = userDoc.data();
            const role = resolveRole(userData.role);
            const status = typeof userData.status === 'string' ? userData.status : undefined;

            if (!isAccountActive(role, status)) {
              toast.error('Your account is inactive. Please contact your administrator.');
              await logoutUser().catch(() => undefined);
              setUser(null);
            } else {
              setUser(buildUser(firebaseUser, userData));
            }
          }
        } else {
          // User is signed out
          setUser(null);
        }
      } catch (error) {
        console.error('Error in onAuthStateChanged:', error);
      } finally {
        if (!isSigningUp.current) {
          setIsLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Watch the signed-in tutor's profile so deactivation takes effect immediately
  // without waiting for a token refresh or a manual page reload.
  useEffect(() => {
    if (!user || user.role !== 'tutor') return;

    let cancelled = false;
    const unsubscribe = onSnapshot(
      doc(db, 'users', user.id),
      (snapshot) => {
        if (cancelled) return;

        if (!snapshot.exists()) {
          toast.error('Account not provisioned. Please contact your administrator.');
          void logoutUser().catch(() => undefined);
          setUser(null);
          return;
        }

        const status = snapshot.data().status;
        if (typeof status === 'string' && status !== 'active') {
          toast.error('Your account is inactive. Please contact your administrator.');
          void logoutUser().catch(() => undefined);
          setUser(null);
        }
      },
      (error) => {
        console.warn('Tutor status watcher error:', error);
      }
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user?.id, user?.role]);

  const login = async (email: string, password: string): Promise<UserRole> => {
    setIsLoading(true);
    try {
      const firebaseUser = await loginUser(email, password);

      let userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      if (!userDoc.exists()) {
        for (let i = 0; i < 3 && !userDoc.exists(); i++) {
          await new Promise((res) => setTimeout(res, 200));
          userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        }
      }

      if (!userDoc.exists()) {
        await logoutUser().catch(() => undefined);
        throw new Error('Account not provisioned. Please contact your administrator.');
      }

      const userData = userDoc.data();
      const role = resolveRole(userData.role);
      const status = typeof userData.status === 'string' ? userData.status : undefined;

      if (!isAccountActive(role, status)) {
        await logoutUser().catch(() => undefined);
        throw new Error('Your account is inactive. Please contact your administrator.');
      }

      setUser(buildUser(firebaseUser, userData));

      logActivity(
        firebaseUser.uid,
        userData.name || 'User',
        role,
        'Login',
        'Authentication',
        `User ${userData.name || firebaseUser.email} logged in`
      ).catch((err) => console.warn('Activity logging non-blocking error:', err));

      return role;
    } catch (error: any) {
      // Preserve our own validation errors (they have no Firebase error code).
      if (error?.message && !error?.code) {
        throw error;
      }
      if (error.code === 'auth/user-disabled') {
        throw new Error('Your account has been deactivated. Please contact your administrator.');
      } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
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
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (_email: string, _password: string, _name: string, _role: 'tutor' | 'parent' = 'tutor') => {
    throw new Error('Public tutor self-registration is disabled. Please contact the Super Admin to provision your account.');
  };

  const refreshUser = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
    if (!userDoc.exists()) {
      await logoutUser().catch(() => undefined);
      setUser(null);
      return;
    }

    const userData = userDoc.data();
    const role = resolveRole(userData.role);
    const status = typeof userData.status === 'string' ? userData.status : undefined;

    if (!isAccountActive(role, status)) {
      toast.error('Your account is inactive. Please contact your administrator.');
      await logoutUser().catch(() => undefined);
      setUser(null);
      return;
    }

    setUser(buildUser(firebaseUser, userData));
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
    setIsLoading(true);
    setLoggingOut(true);
    try {
      if (user) {
        try {
          await logActivity(
            user.id,
            user.name,
            user.role,
            'Logout',
            'Authentication',
            `User ${user.name} logged out`
          );
        } catch (error) {
          console.error('Failed to log activity during logout:', error);
        }
      }
      await logoutUser();
      // setUser(null) will be handled by onAuthStateChanged after sign-out
    } catch (error) {
      console.error('Logout failed:', error);
      setIsLoading(false);
    } finally {
      setLoggingOut(false);
    }
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

  const isTutor = user?.role === 'tutor';
  const { showWarning, remainingSeconds, resetTimer } = useInactivityTimeout(
    !!user && isTutor,
    logout
  );

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
      {showWarning && (
        <InactivityWarning
          remainingSeconds={remainingSeconds}
          onStayLoggedIn={resetTimer}
        />
      )}
    </AuthContext.Provider>
  );
};