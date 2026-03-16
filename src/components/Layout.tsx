import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOffice } from '../context/OfficeContext';
import { logout } from '../firebase';
import { Building2, Users, CheckSquare, Settings, LogOut, Mic, LayoutDashboard, Globe } from 'lucide-react';

export const Layout: React.FC = () => {
  const { userProfile } = useAuth();
  const { currentOffice, offices, setCurrentOffice } = useOffice();
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Office Simulation', href: '/miniverse', icon: Globe },
    { name: 'Offices', href: '/offices', icon: Building2 },
    { name: 'Workers', href: '/workers', icon: Users },
    { name: 'Tasks', href: '/tasks', icon: CheckSquare },
    { name: 'Audio Analyzer', href: '/audio', icon: Mic },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 text-slate-300 flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-indigo-400" />
            Virtual Office
          </h1>
        </div>

        {/* Office Selector */}
        <div className="px-4 mb-6">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
            Current Office
          </label>
          <select
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={currentOffice?.id || ''}
            onChange={(e) => {
              const office = offices.find(o => o.id === e.target.value);
              if (office) setCurrentOffice(office);
            }}
          >
            <option value="" disabled>Select an office...</option>
            {offices.map(office => (
              <option key={office.id} value={office.id}>{office.name}</option>
            ))}
          </select>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-indigo-600 text-white' 
                    : 'hover:bg-slate-800 hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            {userProfile?.photoURL ? (
              <img src={userProfile.photoURL} alt="Profile" className="w-10 h-10 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            )}
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{userProfile?.displayName || 'User'}</p>
              <p className="text-xs text-slate-500 truncate">{userProfile?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors w-full px-2 py-1"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto pt-4 px-8 pb-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
