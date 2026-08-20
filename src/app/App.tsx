import { RouterProvider } from 'react-router';
import { AuthProvider } from '@/features/auth/context/AuthContext';
import { SchoolYearProvider } from '@/shared/contexts/SchoolYearContext';
import { router } from '@/app/routes/AppRoutes';
import { Toaster } from 'sonner';
// Import migration utility to make it available in browser console
import '@/shared/utils/migrateTutees';

export default function App() {
  return (
    <AuthProvider>
      <SchoolYearProvider>
        <RouterProvider router={router} />
        <Toaster position="top-right" richColors />
      </SchoolYearProvider>
    </AuthProvider>
  );
}