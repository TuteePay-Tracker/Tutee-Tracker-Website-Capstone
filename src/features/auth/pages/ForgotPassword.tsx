import { useState } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { Link } from 'react-router';
import logoUrl from '@/assets/logo.jpg';
import { GraduationCap, ArrowLeft, Mail, Send, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await resetPassword(email);
      setEmailSent(true);
      toast.success('Password reset email sent!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden p-4">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-green-100 to-green-200">
        <div className="absolute inset-0 opacity-25">
          <div className="absolute top-0 -left-4 w-96 h-96 bg-green-600 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
          <div className="absolute top-0 -right-4 w-96 h-96 bg-emerald-700 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-96 h-96 bg-green-700 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white backdrop-blur-xl rounded-3xl shadow-2xl p-8 lg:p-10 border border-green-200">
          <div className="text-center mb-8">
            {emailSent ? (
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-700 rounded-2xl mb-4 shadow-lg mx-auto">
                <CheckCircle size={32} className="text-white" />
              </div>
            ) : (
              <img src={logoUrl} alt="TuteePay Logo" className="w-16 h-16 object-contain rounded-2xl mb-4 shadow-lg bg-white p-1 mx-auto" />
            )}
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {emailSent ? 'Check Your Email' : 'Reset Password'}
            </h2>
            <p className="text-gray-600">
              {emailSent
                ? 'We\'ve sent you reset instructions'
                : 'Enter your email to receive reset instructions'}
            </p>
          </div>

          {!emailSent ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail size={20} className="text-green-700" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent transition-all bg-white"
                    placeholder="john@example.com"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-green-700 text-white py-3.5 rounded-xl hover:bg-green-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2 group"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send size={20} />
                    <span>Send Reset Link</span>
                  </>
                )}
              </button>
            </form>
          ) : (
            <div className="text-center py-6 space-y-6">
              <div className="bg-green-50 border border-green-300 rounded-xl p-4">
                <p className="text-gray-700">
                  We've sent a password reset link to
                </p>
                <p className="font-semibold text-green-800 mt-1">{email}</p>
              </div>

              <div className="space-y-3 text-sm text-gray-600">
                <p>Check your inbox and click the link to reset your password.</p>
                <p>Didn't receive the email? Check your spam folder.</p>
              </div>

              <button
                onClick={() => setEmailSent(false)}
                className="text-green-700 hover:text-green-800 font-medium transition-colors"
              >
                Try another email
              </button>
            </div>
          )}

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
          </div>

          <Link
            to="/login"
            className="flex items-center justify-center gap-2 text-gray-600 hover:text-gray-800 font-medium transition-colors group"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            <span>Back to login</span>
          </Link>
        </div>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-700">
            Need help? Contact support at{' '}
            <a href="mailto:support@tuteepay.com" className="font-semibold underline text-green-700">
              support@tuteepay.com
            </a>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
};