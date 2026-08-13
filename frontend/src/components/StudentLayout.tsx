import { Sparkles, LayoutDashboard, BookOpen, AlertCircle, TrendingUp, LogOut, Bell, Settings, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { id: 'dashboard', label: '学习工作台', icon: LayoutDashboard, path: '/student/dashboard' },
  { id: 'courses', label: '我的课程', icon: BookOpen, path: '/student/courses' },
  { id: 'mistakes', label: '错题本', icon: AlertCircle, path: '/student/mistakes' },
  { id: 'reports', label: '学习报告', icon: TrendingUp, path: '/student/reports' },
  { id: 'settings', label: '个人设置', icon: Settings, path: '/student/settings' },
];

export function StudentLayout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/student/dashboard') {
      return location.pathname === '/student/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-cyan-50/30">
      <aside className="w-60 bg-[#0C4A6E] text-white flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-cyan-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0891B2] rounded-lg flex items-center justify-center shadow-lg shadow-cyan-900/50">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">AI Skills</h1>
              <p className="text-xs text-cyan-300">学生工作台</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          <div className="px-3 mb-4">
            <p className="text-xs text-cyan-700 font-medium px-2 mb-2 uppercase tracking-wider">主导航</p>
            <ul className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => navigate(item.path)}
                      className={'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ' + (
                        active
                          ? 'bg-[#0891B2] text-white shadow-lg shadow-cyan-900/30'
                          : 'text-cyan-300 hover:bg-cyan-900 hover:text-white'
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        <div className="p-4 border-t border-cyan-900">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-cyan-800 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-cyan-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.display_name || user?.username || '学生'}</p>
              <p className="text-xs text-cyan-400 truncate">{user?.email || ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-cyan-900">
            <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-cyan-400 hover:text-white hover:bg-cyan-900 rounded-lg transition-colors duration-200 cursor-pointer">
              <Bell className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/student/settings')}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-cyan-400 hover:text-white hover:bg-cyan-900 rounded-lg transition-colors duration-200 cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-cyan-400 hover:text-red-400 hover:bg-cyan-900 rounded-lg transition-colors duration-200 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
