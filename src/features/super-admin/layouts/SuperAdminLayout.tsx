import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import {
  Activity,
  BarChart3,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/features/auth/hooks/useAuth';
import logoUrl from '@/assets/logo.png';
import { SystemDevelopers } from '@/shared/components/SystemDevelopers';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const navItems: NavItem[] = [
  { to: '/super-admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/super-admin/tutors', label: 'Tutor Monitoring', icon: Users },
  { to: '/super-admin/activities', label: 'Activity Logs', icon: Activity },
  { to: '/super-admin/reports', label: 'Reports', icon: BarChart3 },
];

const navClassName = ({ isActive }: { isActive: boolean }) =>
  [
    'flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm',
    isActive
      ? 'bg-blue-50 text-blue-700 font-bold border-l-4 border-blue-600 pl-3'
      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
  ].join(' ');

export const SuperAdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between">
      <div>
        {/* Branding header matching Tutor Track MainLayout */}
        <div className="h-20 border-b border-gray-100 flex items-center px-6 gap-3">
          <img
            src={logoUrl}
            alt="Tutor Track Logo"
            className="w-10 h-10 object-contain rounded-xl shadow-md"
          />
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-lg text-gray-900 tracking-tight leading-none">
              Tutor Track
            </h1>
            <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-widest mt-1 block">
              Super Admin
            </span>
          </div>
        </div>

        {/* Portal Role Indicator */}
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
            Portal Mode
          </p>
          <div className="w-full flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 font-bold text-xs px-3 py-2 rounded-lg">
            <ShieldCheck size={14} className="text-blue-600 shrink-0" />
            <span className="truncate">Platform Administration</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMobileOpen(false)}
              className={navClassName}
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* User Card & Logout at bottom matching MainLayout */}
      <div className="p-4 border-t border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-3 mb-3">
          {user?.photoUrl ? (
            <img
              src={user.photoUrl}
              alt={user.name}
              className="w-10 h-10 rounded-full object-cover shadow-inner border border-gray-200"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shadow-inner uppercase">
              {user?.name?.slice(0, 2) || 'SA'}
            </div>
          )}
          <div className="overflow-hidden flex-1">
            <p className="text-xs font-semibold text-gray-900 truncate">
              {user?.name || 'Super Admin'}
            </p>
            <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
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
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Desktop Sidebar matching MainLayout */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 fixed top-0 bottom-0 left-0 z-45 shadow-sm">
        {sidebarContent}
      </aside>

      {/* Mobile Sticky Navbar */}
      <header className="md:hidden flex justify-between items-center h-16 bg-white border-b border-gray-200 px-4 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <img
            src={logoUrl}
            alt="Tutor Track Logo"
            className="w-9 h-9 object-contain rounded-lg shadow-sm"
          />
          <div>
            <span className="font-bold text-base text-gray-900 block leading-tight">
              Tutor Track
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600">
              Super Admin
            </span>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40 transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={`md:hidden fixed top-16 bottom-0 left-0 w-64 bg-white border-r border-gray-200 z-45 transition-transform duration-300 transform flex flex-col justify-between ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:pl-64 overflow-hidden min-h-screen">
        <main className="flex-1 w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
          <Outlet />
        </main>

        <footer className="bg-white border-t py-6">
          <SystemDevelopers
            showTopBorder={false}
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
          />
        </footer>
      </div>
    </div>
  );
};
