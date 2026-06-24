import { useState } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useNavigate } from 'react-router';
import { Link } from 'react-router';
import logoUrl from '@/assets/logo.jpg';
import { GraduationCap, Mail, Lock, ArrowRight, Sparkles, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    let loginEmail = email.trim();
    // If it's a contact number (pure digits, 10 or 11 digits)
    const sanitizedPhone = loginEmail.replace(/\D/g, '');
    if (sanitizedPhone.length >= 10 && sanitizedPhone.length <= 11 && /^\d+$/.test(sanitizedPhone)) {
      loginEmail = `${sanitizedPhone}@tuteepay.local`;
    }

    try {
      await login(loginEmail, password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Login failed. Please check your credentials.');
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

      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-green-600/40 rounded-full animate-pulse"></div>
        <div className="absolute top-3/4 right-1/4 w-3 h-3 bg-emerald-600/50 rounded-full animate-pulse animation-delay-1000"></div>
        <div className="absolute top-1/2 right-1/3 w-2 h-2 bg-green-600/40 rounded-full animate-pulse animation-delay-2000"></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-6xl flex flex-col lg:flex-row items-center gap-12">
        {/* Left Side - Branding */}
        <div className="flex-1 text-gray-800 space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-3 bg-green-700 backdrop-blur-lg rounded-full px-4 py-2 border border-green-800">
            <Sparkles size={20} className="text-green-200" />
            <span className="text-sm font-medium text-white">Smart Tutee & Session Management</span>
          </div>

          <h1 className="text-5xl lg:text-6xl font-bold leading-tight text-gray-900">
            Welcome to
            <span className="block text-green-700">
              TUTOR {' '}
              <span className="text-green-700">
                TRACK
              </span>
            </span>
          </h1>

          <p className="text-xl text-gray-700 max-w-md">
            Your all-in-one platform for managing tutees, scheduling sessions, tracking payments, and keeping <span className="font-semibold text-green-700">parents informed</span> — so you can focus on what matters most: <span className="font-semibold text-green-700">teaching</span>.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pt-4 flex-wrap">
            <div className="flex items-center gap-3 bg-white backdrop-blur-sm rounded-lg px-4 py-3 border border-green-300 shadow-sm">
              <div className="w-10 h-10 bg-green-700 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Track Payments</p>
                <p className="text-sm text-gray-600">Stay on top of every tutee's balance</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white backdrop-blur-sm rounded-lg px-4 py-3 border border-green-300 shadow-sm">
              <div className="w-10 h-10 bg-green-700 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Manage Tutees</p>
                <p className="text-sm text-gray-600">Organize sessions & attendance</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white backdrop-blur-sm rounded-lg px-4 py-3 border border-green-300 shadow-sm">
              <div className="w-10 h-10 bg-green-700 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Parent Access</p>
                <p className="text-sm text-gray-600">Keep parents updated on progress</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full lg:w-auto lg:min-w-[480px]">
          <div className="bg-white backdrop-blur-xl rounded-3xl shadow-2xl p-8 lg:p-10 border border-green-200">
            <div className="text-center mb-8">
              <img src={logoUrl} alt="TuteePay Logo" className="w-16 h-16 object-contain rounded-2xl mb-4 shadow-lg bg-white p-1" />
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Sign In</h2>
              <p className="text-gray-600">Enter your credentials to continue</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Email Address / Contact Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail size={20} className="text-green-700" />
                  </div>
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent transition-all bg-white"
                    placeholder="Email or phone number"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock size={20} className="text-green-700" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent transition-all bg-white"
                    placeholder="••••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-green-700 transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-green-700 border-gray-300 rounded focus:ring-green-700 cursor-pointer"
                  />
                  <span className="ml-2 text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
                    Remember me
                  </span>
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-green-700 hover:text-green-800 transition-colors"
                >
                  Forgot password?
                </Link>
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
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">New to TuteePay?</span>
              </div>
            </div>

            <div className="text-center">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 text-green-700 hover:text-green-800 font-medium transition-colors group"
              >
                <span>Create an account</span>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
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
        .animation-delay-1000 {
          animation-delay: 1s;
        }
      `}</style>
    </div>
  );
};