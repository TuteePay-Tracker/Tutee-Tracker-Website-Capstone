import { RouterProvider } from 'react-router';
import { AuthProvider } from '../context/AuthContext';
import { router } from '../routes/AppRoutes';
import { Toaster } from 'sonner';
// Import migration utility to make it available in browser console
import '../utils/migrateTutees';

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}