import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { registerUser, loginUser, logoutUser, resetPassword as resetUserPassword } from '../firebase/auth';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'tutor' | 'parent';
  mustChangePassword?: boolean;
  linkedStudentIds?: string[];
  createdByTutorId?: string;
  contactNumber?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string, role?: 'tutor' | 'parent') => Promise<void>;
  logout: () => void;
  resetPassword: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
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
      // User state will be updated by onAuthStateChanged listener
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
      });
    }
  };

  const logout = async () => {
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};