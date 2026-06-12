import { useAuthContext } from '@/features/auth/context/AuthContext';

export const useAuth = () => {
  return useAuthContext();
};
