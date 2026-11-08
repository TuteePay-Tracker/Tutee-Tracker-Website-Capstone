import { Navigate } from 'react-router';

/**
 * Public tutor self-registration is disabled.
 * Tutor accounts can only be provisioned by the Super Admin.
 */
export const Signup = () => {
  return <Navigate to="/login" replace />;
};
