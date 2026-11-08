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
    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
    isActive
      ? 'bg-blue-600 text-white shadow-sm'
      : 'text-gray-600 hover:bg-blue-50 hover:text-blue-700',
  ].join(' ');

export const SuperAdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-5">
        <img
          src={logoUrl}
          alt="TutorTrack"
          className="h-11 w-11 rounded-xl bg-white object-contain p-1 shadow-sm"
        />
        <div>
          <p className="text-sm font-bold text-gray-900">TutorTrack</p>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
            Super Admin
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setMobileOpen(false)}
            className={navClassName}
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-gray-100 p-4">
        <div className="mb-3 rounded-xl bg-gray-50 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
            <ShieldCheck size={14} className="text-blue-600" /> Super Admin
          </div>
          <p className="mt-1 truncate text-sm font-semibold text-gray-900">
            {user?.name}
          </p>
          <p className="truncate text-xs text-gray-500">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
        >
          <LogOut size={16} /> Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-gray-200 bg-white lg:block">
        {sidebar}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">
            <div className="flex justify-end p-3">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 lg:hidden"
            >
              <Menu size={20} />
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Super Admin Portal
              </p>
              <h1 className="text-lg font-bold text-gray-900">
                Platform Monitoring
              </h1>
            </div>
          </div>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
        </header>

        <main className="px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
