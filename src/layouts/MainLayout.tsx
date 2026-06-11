import { Outlet, Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard,
  Users,
  DollarSign,
  BarChart3,
  Settings,
  LogOut,
  GraduationCap,
  Menu,
  X,
  Calendar,
  ChevronDown,
  ChevronRight,
  CheckSquare
} from 'lucide-react';
import { useState, useEffect } from 'react';

export const MainLayout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Collapsible state for Tutee Management
  const isTuteePath = 
    location.pathname.startsWith('/tutees') || 
    location.pathname.startsWith('/schedule') || 
    location.pathname.startsWith('/attendance') || 
    location.pathname.startsWith('/payments');

  const [tuteeMenuOpen, setTuteeMenuOpen] = useState(() => {
    const saved = localStorage.getItem('tuteeMenuOpen');
    if (saved !== null) {
      return saved === 'true';
    }
    return isTuteePath; // Default open if currently on a child path
  });

  // Keep menu open if user navigates to a nested path
  useEffect(() => {
    if (isTuteePath) {
      setTuteeMenuOpen(true);
      localStorage.setItem('tuteeMenuOpen', 'true');
    }
  }, [location.pathname, isTuteePath]);

  const toggleTuteeMenu = () => {
    setTuteeMenuOpen(prev => {
      const next = !prev;
      localStorage.setItem('tuteeMenuOpen', String(next));
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  // Nesting support for tutor navigation
  const isParent = user?.role === 'parent';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 fixed top-0 bottom-0 left-0 z-45 shadow-sm">
        {/* Branding header */}
        <div className="h-20 border-b border-gray-100 flex items-center px-6 gap-3">
          <div className="bg-green-700 p-2.5 rounded-xl shadow-md shadow-green-700/20">
            <GraduationCap size={24} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-gray-900 tracking-tight leading-none">TuteePay</h1>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mt-1 block">Tracker</span>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 px-4 py-6 overflow-y-auto space-y-1">
          {isParent ? (
            /* Parent flat navigation */
            <>
              <Link
                to="/"
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
                  isActive('/')
                    ? 'bg-green-55 text-green-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Users size={20} />
                <span>My Children</span>
              </Link>
              <Link
                to="/settings"
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
                  isActive('/settings')
                    ? 'bg-green-55 text-green-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Settings size={20} />
                <span>Settings</span>
              </Link>
            </>
          ) : (
            /* Tutor collapsible navigation */
            <>
              {/* Dashboard */}
              <Link
                to="/"
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
                  isActive('/') && location.pathname === '/'
                    ? 'bg-green-50 text-green-700 font-bold border-l-4 border-green-700 pl-3'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <LayoutDashboard size={20} />
                <span>Dashboard</span>
              </Link>

              {/* Tutee Management collapsible accordion */}
              <div className="space-y-1">
                <button
                  onClick={toggleTuteeMenu}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-medium text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 ${
                    isTuteePath ? 'text-gray-900 font-semibold' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Users size={20} className={isTuteePath ? 'text-green-700 animate-pulse' : ''} />
                    <span>Tutee Management</span>
                  </div>
                  {tuteeMenuOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {tuteeMenuOpen && (
                  <div className="pl-6 space-y-1 transition-all duration-300">
                    <Link
                      to="/tutees"
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all font-medium text-xs ${
                        isActive('/tutees')
                          ? 'bg-green-50 text-green-700 font-bold'
                          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      <span>Tutees</span>
                    </Link>
                    <Link
                      to="/schedule"
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all font-medium text-xs ${
                        isActive('/schedule')
                          ? 'bg-green-50 text-green-700 font-bold'
                          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      <span>Schedule</span>
                    </Link>
                    <Link
                      to="/attendance"
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all font-medium text-xs ${
                        isActive('/attendance')
                          ? 'bg-green-50 text-green-700 font-bold'
                          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      <span>Attendance</span>
                    </Link>
                    <Link
                      to="/payments"
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all font-medium text-xs ${
                        isActive('/payments')
                          ? 'bg-green-50 text-green-700 font-bold'
                          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      <span>Payments</span>
                    </Link>
                  </div>
                )}
              </div>

              {/* Reports */}
              <Link
                to="/reports"
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
                  isActive('/reports')
                    ? 'bg-green-50 text-green-700 font-bold border-l-4 border-green-700 pl-3'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <BarChart3 size={20} />
                <span>Reports</span>
              </Link>

              {/* Settings */}
              <Link
                to="/settings"
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
                  isActive('/settings')
                    ? 'bg-green-50 text-green-700 font-bold border-l-4 border-green-700 pl-3'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Settings size={20} />
                <span>Settings</span>
              </Link>
            </>
          )}
        </div>

        {/* User Card & Logout at bottom */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm shadow-inner uppercase">
              {user?.name?.slice(0, 2)}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-semibold text-gray-900 truncate">{user?.name}</p>
              <p className="text-[10px] text-gray-500 truncate">
                {user?.email?.endsWith('@tuteepay.local')
                  ? user.email.split('@')[0]
                  : user?.email}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-dashed border-red-200 hover:border-red-300"
          >
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Sticky Navbar */}
      <header className="md:hidden flex justify-between items-center h-16 bg-white border-b border-gray-200 px-4 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-green-700 p-2 rounded-lg">
            <GraduationCap size={20} className="text-white" />
          </div>
          <span className="font-bold text-base text-gray-900">TuteePay Tracker</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40 transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Drawer */}
      <div
        className={`md:hidden fixed top-16 bottom-0 left-0 w-64 bg-white border-r border-gray-200 z-45 transition-transform duration-300 transform flex flex-col justify-between ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-4 py-6 overflow-y-auto space-y-1 flex-1">
          {isParent ? (
            <>
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
                  isActive('/')
                    ? 'bg-green-50 text-green-700 font-bold'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Users size={20} />
                <span>My Children</span>
              </Link>
              <Link
                to="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
                  isActive('/settings')
                    ? 'bg-green-50 text-green-700 font-bold'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Settings size={20} />
                <span>Settings</span>
              </Link>
            </>
          ) : (
            <>
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
                  isActive('/') && location.pathname === '/'
                    ? 'bg-green-50 text-green-700 font-bold'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <LayoutDashboard size={20} />
                <span>Dashboard</span>
              </Link>

              {/* Mobile Accordion */}
              <div className="space-y-1">
                <button
                  onClick={toggleTuteeMenu}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-medium text-sm text-gray-600 hover:bg-gray-50 ${
                    isTuteePath ? 'text-gray-900 font-semibold' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Users size={20} className={isTuteePath ? 'text-green-700' : ''} />
                    <span>Tutee Management</span>
                  </div>
                  {tuteeMenuOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>

                {tuteeMenuOpen && (
                  <div className="pl-6 space-y-1">
                    <Link
                      to="/tutees"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all font-medium text-xs ${
                        isActive('/tutees')
                          ? 'bg-green-50 text-green-700 font-bold'
                          : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      <span>Tutees</span>
                    </Link>
                    <Link
                      to="/schedule"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all font-medium text-xs ${
                        isActive('/schedule')
                          ? 'bg-green-50 text-green-700 font-bold'
                          : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      <span>Schedule</span>
                    </Link>
                    <Link
                      to="/attendance"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all font-medium text-xs ${
                        isActive('/attendance')
                          ? 'bg-green-50 text-green-700 font-bold'
                          : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      <span>Attendance</span>
                    </Link>
                    <Link
                      to="/payments"
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all font-medium text-xs ${
                        isActive('/payments')
                          ? 'bg-green-50 text-green-700 font-bold'
                          : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                      <span>Payments</span>
                    </Link>
                  </div>
                )}
              </div>

              <Link
                to="/reports"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
                  isActive('/reports')
                    ? 'bg-green-50 text-green-700 font-bold'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <BarChart3 size={20} />
                <span>Reports</span>
              </Link>

              <Link
                to="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${
                  isActive('/settings')
                    ? 'bg-green-50 text-green-700 font-bold'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Settings size={20} />
                <span>Settings</span>
              </Link>
            </>
          )}
        </div>

        {/* Mobile footer area */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-xs shadow-inner">
              {user?.name?.slice(0, 2).toUpperCase()}
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-xs font-semibold text-gray-900 truncate">{user?.name}</p>
            </div>
          </div>
          <button
            onClick={() => {
              handleLogout();
              setMobileMenuOpen(false);
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-dashed border-red-200"
          >
            <LogOut size={14} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:pl-64 min-h-screen overflow-hidden">
        <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-8">
          <Outlet />
        </main>

        <footer className="bg-white border-t py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-gray-400 font-medium">
            <p>© 2026 TuteePay Tracker. Built for tutors, by tutors.</p>
          </div>
        </footer>
      </div>
    </div>
  );
};;
