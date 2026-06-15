import { useState } from 'react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useNavigate } from 'react-router';
import { Link } from 'react-router';
import { GraduationCap, User, Mail, Lock, ArrowRight, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

export const Signup = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'tutor' | 'parent'>('tutor');
  const [isLoading, setIsLoading] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      await signup(email, password, name, role);
      setAccountCreated(true);
      toast.success('Account created successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Signup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToSignIn = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden p-4">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-white via-green-100 to-green-200">
        <div className="absolute inset-0 opacity-25">
          <div className="absolute top-0 -left-4 w-96 h-96 bg-emerald-700 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
          <div className="absolute top-0 -right-4 w-96 h-96 bg-green-700 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-20 w-96 h-96 bg-green-600 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000"></div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-6xl flex flex-col lg:flex-row-reverse items-center gap-12">
        {/* Right Side - Benefits */}
        <div className="flex-1 text-gray-800 space-y-6 text-center lg:text-left">
          <h1 className="text-5xl lg:text-6xl font-bold leading-tight text-gray-900">
            Start Your Journey
            <span className="block text-green-700">
              Today
            </span>
          </h1>

          <p className="text-xl text-gray-700 max-w-md">
            Join thousands of tutors who are already managing their business efficiently with TuteePay.
          </p>

          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-green-700 backdrop-blur-sm rounded-full flex items-center justify-center border border-green-800">
                <CheckCircle2 size={24} className="text-white" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-lg text-gray-900">Easy Setup</p>
                <p className="text-gray-600">Get started in less than 2 minutes</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-green-700 backdrop-blur-sm rounded-full flex items-center justify-center border border-green-800">
                <CheckCircle2 size={24} className="text-white" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-lg text-gray-900">Automated Tracking</p>
                <p className="text-gray-600">Smart calculations and reminders</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-green-700 backdrop-blur-sm rounded-full flex items-center justify-center border border-green-800">
                <CheckCircle2 size={24} className="text-white" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-lg text-gray-900">Detailed Reports</p>
                <p className="text-gray-600">Comprehensive analytics at your fingertips</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-green-700 backdrop-blur-sm rounded-full flex items-center justify-center border border-green-800">
                <CheckCircle2 size={24} className="text-white" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-lg text-gray-900">100% Free</p>
                <p className="text-gray-600">No hidden fees or charges</p>
              </div>
            </div>
          </div>
        </div>

        {/* Left Side - Signup Form */}
        <div className="w-full lg:w-auto lg:min-w-[480px]">
          <div className="bg-white backdrop-blur-xl rounded-3xl shadow-2xl p-8 lg:p-10 border border-green-200">
            {!accountCreated ? (
              <>
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-green-700 rounded-2xl mb-4 shadow-lg">
                    <GraduationCap size={32} className="text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h2>
                  <p className="text-gray-600">Start managing your tutoring business</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">I am a...</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setRole('tutor')}
                        className={`py-3 px-4 rounded-xl border-2 transition-all ${
                          role === 'tutor'
                            ? 'border-green-700 bg-green-50 text-green-700 font-semibold'
                            : 'border-gray-200 hover:border-green-200 text-gray-500'
                        }`}
                      >
                        Tutor
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('parent')}
                        className={`py-3 px-4 rounded-xl border-2 transition-all ${
                          role === 'parent'
                            ? 'border-green-700 bg-green-50 text-green-700 font-semibold'
                            : 'border-gray-200 hover:border-green-200 text-gray-500'
                        }`}
                      >
                        Parent
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Full Name</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <User size={20} className="text-green-700" />
                      </div>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-700 focus:border-transparent transition-all bg-white"
                        placeholder="John Doe"
                        required
                      />
                    </div>
                  </div>

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
                    <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters</p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">Confirm Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock size={20} className="text-green-700" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
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
                        <span>Creating account...</span>
                      </>
                    ) : (
                      <>
                        <span>Create Account</span>
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
                    <span className="px-4 bg-white text-gray-500">Already have an account?</span>
                  </div>
                </div>

                <div className="text-center">
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 text-green-700 hover:text-green-800 font-medium transition-colors group"
                  >
                    <span>Sign in instead</span>
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </>
            ) : (
              <>
                {/* Success Message */}
                <div className="text-center space-y-6">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
                    <CheckCircle2 size={48} className="text-green-700" />
                  </div>
                  
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-3">
                      Account Created!
                    </h2>
                    <p className="text-lg text-gray-600">
                      Your account has been successfully created.
                    </p>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-xl p-6">
                    <p className="text-gray-700 mb-1">Welcome to TuteePay,</p>
                    <p className="font-semibold text-green-800 text-lg">{name}!</p>
                  </div>

                  <button
                    onClick={handleGoToSignIn}
                    className="w-full bg-green-700 text-white py-3.5 rounded-xl hover:bg-green-800 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2 group"
                  >
                    <span>Complete and go to Sign In</span>
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </>
            )}
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
      `}</style>
    </div>
  );
};