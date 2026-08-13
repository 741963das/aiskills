import { Sparkles, LayoutDashboard, BookOpen, Database, BarChart3, PlusCircle, Upload, LogOut, Bell, Settings, User, Store, Files, Lightbulb, ClipboardList } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { id: 'dashboard', label: '工作台', icon: LayoutDashboard, path: '/teacher/dashboard' },
  { id: 'my-agents', label: '我的助手', icon: BookOpen, path: '/teacher/my-agents' },
  { id: 'lesson-planner', label: 'AI 备课助手', icon: ClipboardList, path: '/teacher/lesson-planner' },
  { id: 'reflection', label: '教学反思', icon: Lightbulb, path: '/teacher/reflection' },
  { id: 'analytics', label: '学情分析', icon: BarChart3, path: '/teacher/analytics' },
  { id: 'skill-files', label: '技能管理', icon: Files, path: '/teacher/skill-files' },
  { id: 'marketplace', label: '助手市场', icon: Store, path: '/teacher/marketplace' },
  { id: 'knowledge', label: '知识库', icon: Database, path: '/teacher/knowledge' },
];

const quickActions = [
  { id: 'create-skill', label: '创建新助手', icon: PlusCircle, path: '/teacher/agents/create' },
  { id: 'upload-knowledge', label: '上传知识库', icon: Upload, path: '/teacher/knowledge' },
];

export function TeacherLayout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/teacher/dashboard') {
      return location.pathname === '/teacher/dashboard';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-indigo-50/30">
      <aside className="w-60 bg-indigo-950 text-white flex flex-col flex-shrink-0">
        <div className="p-5 border-b border-indigo-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-700 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-900/50">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold">AI Skills</h1>
              <p className="text-xs text-indigo-300">教师工作台</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-4 overflow-y-auto">
          <div className="px-3 mb-4">
            <p className="text-xs text-indigo-600 font-medium px-2 mb-2 uppercase tracking-wider">主导航</p>
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
                          ? 'bg-indigo-700 text-white shadow-lg shadow-indigo-900/30'
                          : 'text-indigo-300 hover:bg-indigo-900 hover:text-white'
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

          <div className="px-3 mb-4">
            <p className="text-xs text-indigo-600 font-medium px-2 mb-2 uppercase tracking-wider">快捷入口</p>
            <ul className="space-y-1">
              {quickActions.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => navigate(item.path)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-indigo-300 hover:bg-indigo-900 hover:text-white transition-colors duration-200 cursor-pointer"
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

        <div className="p-4 border-t border-indigo-900">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-800 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-indigo-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.display_name || user?.username || '教师'}</p>
              <p className="text-xs text-indigo-400 truncate">{user?.email || ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-indigo-900">
            <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-indigo-400 hover:text-white hover:bg-indigo-900 rounded-lg transition-colors duration-200 cursor-pointer">
              <Bell className="w-4 h-4" />
            </button>
            <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-indigo-400 hover:text-white hover:bg-indigo-900 rounded-lg transition-colors duration-200 cursor-pointer">
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-indigo-400 hover:text-red-400 hover:bg-indigo-900 rounded-lg transition-colors duration-200 cursor-pointer"
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
