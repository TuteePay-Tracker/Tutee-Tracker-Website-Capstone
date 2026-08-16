import { useState, useEffect } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useNavigate } from 'react-router';
import { Link } from 'react-router';
import logoUrl from '@/assets/logo.jpg';
import { Mail, Lock, ArrowRight, Sparkles, Eye, EyeOff, Download, X, UserCheck, Smartphone, CheckCircle2, Calendar, CreditCard, Users } from 'lucide-react';
import { toast } from 'sonner';

export const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false);
      }
    };
    if (isModalOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    let loginIdentifier = identifier.trim();
    // If it's a contact number (pure digits, 10 or 11 digits)
    const sanitizedPhone = loginIdentifier.replace(/\D/g, '');
    if (sanitizedPhone.length >= 10 && sanitizedPhone.length <= 11 && /^\d+$/.test(sanitizedPhone)) {
      loginIdentifier = `${sanitizedPhone}@tuteepay.local`;
    }

    try {
      await login(loginIdentifier, password);
      toast.success('Welcome back!');
      setIsModalOpen(false);
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadApk = () => {
    toast.info('Starting Tutor Track APK download...');
    const link = document.createElement('a');
    link.href = 'https://github.com/TuteePay-Tracker/TutorTrack-Mobile/releases/latest/download/TutorTrack-Parent.apk';
    link.download = 'TutorTrack.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden p-4 md:p-8">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-blue-100 to-blue-200">
        <div className="absolute inset-0 opacity-25">
          <div className="absolute top-0 -left-4 w-96 h-96 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
          <div className="absolute top-0 -right-4 w-96 h-96 bg-emerald-700 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-96 h-96 bg-blue-700 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-blue-600/40 rounded-full animate-pulse"></div>
        <div className="absolute top-3/4 right-1/4 w-3 h-3 bg-emerald-600/50 rounded-full animate-pulse animation-delay-1000"></div>
        <div className="absolute top-1/2 right-1/3 w-2 h-2 bg-blue-600/40 rounded-full animate-pulse animation-delay-2000"></div>
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 w-full max-w-6xl flex flex-col lg:flex-row items-stretch gap-8 lg:gap-12 my-auto">

        {/* LEFT SIDE - Welcome Title & Action Buttons */}
        <div className="flex-1 flex flex-col justify-between space-y-8 bg-white/60 backdrop-blur-md rounded-3xl p-8 lg:p-10 border border-blue-200 shadow-xl">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 bg-blue-600 backdrop-blur-lg rounded-full px-4 py-1.5 border border-blue-700 shadow-sm">
              <Sparkles size={18} className="text-blue-200" />
              <span className="text-xs font-semibold uppercase tracking-wider text-white">Tutor Track Portal</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight text-gray-900 tracking-tight">
              WELCOME TO{' '}
              <span className="block text-blue-600">
                TUTOR TRACK
              </span>
            </h1>
          </div>

          {/* Action Sections */}
          <div className="space-y-6 pt-2">
            {/* Tutor Login Section */}
            <div className="space-y-2 text-left">
              <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                For the tutor pls login
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 px-6 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <UserCheck size={24} className="text-blue-100" />
                  <span>Tutor Login</span>
                </div>
                <ArrowRight size={22} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Parent Download APK Section */}
            <div className="space-y-2 text-left pt-2">
              <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                For the parent Download APK
              </p>
              <button
                onClick={handleDownloadApk}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 px-6 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200 flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <Smartphone size={24} className="text-emerald-100" />
                  <span>Download APK</span>
                </div>
                <Download size={22} className="group-hover:translate-y-0.5 transition-transform" />
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-blue-200/60 text-xs text-gray-500">
            Smart Tutee & Session Management Platform • Need help? <a href="mailto:support@tuteepay.com" className="text-blue-600 hover:underline font-semibold">Contact Support</a>
          </div>
        </div>

        {/* RIGHT SIDE - Descriptions & Features */}
        <div className="flex-1 flex flex-col justify-center bg-white backdrop-blur-xl rounded-3xl p-8 lg:p-10 border border-blue-200 shadow-2xl space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <img src={logoUrl} alt="Tutor Track Logo" className="w-14 h-14 object-contain rounded-2xl shadow-md bg-white p-1" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Platform Overview</h2>
                <p className="text-sm text-gray-600">All-in-one tutoring management solution</p>
              </div>
            </div>

            <p className="text-gray-700 text-base leading-relaxed pt-2">
              Your comprehensive platform for managing tutees, scheduling sessions, tracking payments, and keeping <span className="font-bold text-blue-600">parents informed</span> — so you can focus on what matters most: <span className="font-bold text-blue-600">teaching</span>.
            </p>
          </div>

          {/* Feature Grid / Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 flex items-start gap-3 transition-all hover:bg-blue-50">
              <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-sm shrink-0">
                <CreditCard size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Track Payments</h3>
                <p className="text-xs text-gray-600 mt-0.5">Stay on top of every tutee's balance & receipt logs</p>
              </div>
            </div>

            <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 flex items-start gap-3 transition-all hover:bg-blue-50">
              <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-sm shrink-0">
                <Users size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Manage Tutees</h3>
                <p className="text-xs text-gray-600 mt-0.5">Organize student rosters, progress, and profiles</p>
              </div>
            </div>

            <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 flex items-start gap-3 transition-all hover:bg-blue-50">
              <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-sm shrink-0">
                <Calendar size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Sessions & Attendance</h3>
                <p className="text-xs text-gray-600 mt-0.5">Schedule classes and mark attendance effortlessly</p>
              </div>
            </div>

            <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 flex items-start gap-3 transition-all hover:bg-blue-50">
              <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-sm shrink-0">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Parent Access</h3>
                <p className="text-xs text-gray-600 mt-0.5">Keep parents updated on child progress & reports</p>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* TUTOR LOGIN MODAL */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="relative w-full max-w-md bg-white backdrop-blur-xl rounded-3xl shadow-2xl p-8 lg:p-10 border border-blue-200 transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close X Button */}
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-full transition-colors"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>

            {/* Modal Header */}
            <div className="text-center mb-8">
              <img src={logoUrl} alt="TuteePay Logo" className="w-16 h-16 object-contain rounded-2xl mb-4 shadow-lg bg-white p-1 mx-auto" />
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Sign In</h2>
              <p className="text-gray-600">Enter your credentials to continue</p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2 text-left">
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail size={20} className="text-blue-600" />
                  </div>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all bg-white text-gray-900"
                    placeholder="Email"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2 text-left">
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock size={20} className="text-blue-600" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all bg-white text-gray-900"
                    placeholder="••••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-blue-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-600 cursor-pointer"
                  />
                  <span className="ml-2 text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
                    Remember me
                  </span>
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 text-white py-3.5 rounded-xl hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2 group"
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
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors group"
              >
                <span>Create an account</span>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      )}

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
