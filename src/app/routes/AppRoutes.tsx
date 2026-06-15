import { createBrowserRouter, Navigate } from 'react-router';
import { MainLayout } from '@/shared/layouts/MainLayout';
import { AuthLayout } from '@/shared/layouts/AuthLayout';
import { Dashboard } from '@/features/dashboard/pages/Dashboard';
import { Tutees } from '@/features/tutees/pages/Tutees';
import { TuteeDetails } from '@/features/tutees/pages/TuteeDetails';
import { PaymentTracking } from '@/features/payments/pages/PaymentTracking';
import { Attendance } from '@/features/attendance/pages/Attendance';
import { QuickPayment } from '@/features/payments/pages/QuickPayment';
import { Reports } from '@/features/reports/pages/Reports';
import { Settings } from '@/features/settings/pages/Settings';
import { Schedule } from '@/features/schedule/pages/Schedule';
import { Chat } from '@/features/chat/pages/Chat';
import { Announcements } from '@/features/announcements/pages/Announcements';
import { Login } from '@/features/auth/pages/Login';
import { Signup } from '@/features/auth/pages/Signup';
import { ForgotPassword } from '@/features/auth/pages/ForgotPassword';
import { ChangePassword } from '@/features/auth/pages/ChangePassword';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { ReactNode } from 'react';

const ProtectedRoute = ({ children, tutorOnly = false }: { children: ReactNode; tutorOnly?: boolean }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Parent must change password before accessing the app
  if (user.mustChangePassword && user.role === 'parent') {
    return <Navigate to="/change-password" replace />;
  }

  // Tutor-only routes: redirect parents to home
  if (tutorOnly && user.role === 'parent') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

const PublicRoute = ({ children }: { children: ReactNode }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (user) {
    // Parent who must change password goes to change-password, not home
    if (user.mustChangePassword && user.role === 'parent') {
      return <Navigate to="/change-password" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// Special route: only accessible to parents who need to change password
const ChangePasswordRoute = ({ children }: { children: ReactNode }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // If password already changed, redirect to home
  if (!user.mustChangePassword) return <Navigate to="/" replace />;

  return <>{children}</>;
};

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'tutees',
        element: (
          <ProtectedRoute tutorOnly>
            <Tutees />
          </ProtectedRoute>
        ),
      },
      {
        path: 'tutees/:id',
        element: <TuteeDetails />,
      },
      {
        path: 'attendance',
        element: (
          <ProtectedRoute tutorOnly>
            <Attendance />
          </ProtectedRoute>
        ),
      },
      {
        path: 'payments',
        element: (
          <ProtectedRoute tutorOnly>
            <PaymentTracking />
          </ProtectedRoute>
        ),
      },
      {
        path: 'payments/quick',
        element: (
          <ProtectedRoute tutorOnly>
            <QuickPayment />
          </ProtectedRoute>
        ),
      },
      {
        path: 'schedule',
        element: (
          <ProtectedRoute tutorOnly>
            <Schedule />
          </ProtectedRoute>
        ),
      },
      {
        path: 'reports',
        element: (
          <ProtectedRoute tutorOnly>
            <Reports />
          </ProtectedRoute>
        ),
      },
      {
        path: 'settings',
        element: <Settings />,
      },
      {
        path: 'chat',
        element: <Chat />,
      },
      {
        path: 'announcements',
        element: <Announcements />,
      },
    ],
  },
  {
    path: '/change-password',
    element: (
      <ChangePasswordRoute>
        <ChangePassword />
      </ChangePasswordRoute>
    ),
  },
  {
    path: '/',
    element: <AuthLayout />,
    children: [
      {
        path: 'login',
        element: (
          <PublicRoute>
            <Login />
          </PublicRoute>
        ),
      },
      {
        path: 'signup',
        element: (
          <PublicRoute>
            <Signup />
          </PublicRoute>
        ),
      },
      {
        path: 'forgot-password',
        element: (
          <PublicRoute>
            <ForgotPassword />
          </PublicRoute>
        ),
      },
    ],
  },
  {
    path: '*',
    element: (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
          <p className="text-gray-600 mb-4">Page not found</p>
          <a href="/" className="text-blue-600 hover:underline">Go back home</a>
        </div>
      </div>
    ),
  },
]);
