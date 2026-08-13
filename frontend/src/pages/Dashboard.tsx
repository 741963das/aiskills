import { BookOpen, Users, FileText, PlusCircle, ArrowRight, Store, Download } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { TeacherLayout } from '../components/TeacherLayout';
import { useAuth } from '../contexts/AuthContext';
import { agentApi } from '../services/agentApi';
import type { Agent } from '../types/agent';

export function Dashboard() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<{
    total_skills: number;
    published_count: number;
    draft_count: number;
    total_conversations: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!token) return;
      setIsLoading(true);
      setError(null);
      try {
        const [agentsData, statsData] = await Promise.all([
          agentApi.getAll(token),
          agentApi.getStats(token),
        ]);
        setAgents(agentsData);
        setStats(statsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取数据失败');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const downloadedCount = useMemo(
    () => agents.filter((a) => a.config?.downloaded_from).length,
    [agents],
  );

  const today = new Date();
  const dateStr = `${today.getFullYear()} 年 ${today.getMonth() + 1} 月 ${today.getDate()} 日`;

  const statCards = stats ? [
    { icon: BookOpen, label: '我的助手', value: String(stats.total_skills), change: `${stats.published_count} 已发布`, colorClass: 'bg-indigo-50 text-indigo-700' },
    { icon: FileText, label: '草稿数量', value: String(stats.draft_count), change: '待完成', colorClass: 'bg-amber-50 text-amber-600' },
    { icon: Download, label: '来自市场', value: String(downloadedCount), change: '下载的助手', colorClass: 'bg-cyan-50 text-cyan-600' },
    { icon: Users, label: '学生使用量', value: String(stats.total_conversations), change: '累计对话', colorClass: 'bg-emerald-50 text-emerald-600' },
  ] : [];

  const quickActions = [
    { icon: BookOpen, title: '我的助手', desc: '管理和使用你的 AI 教学助手', path: '/teacher/my-agents' },
    { icon: PlusCircle, title: '创建新助手', desc: '通过六步向导创建 AI 教学助手', path: '/teacher/agents/create' },
    { icon: Store, title: '助手市场', desc: '浏览所有已发布的 AI 教学助手', path: '/teacher/marketplace' },
  ];

  return (
    <TeacherLayout>
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-indigo-950">教师工作台</h1>
            <p className="text-indigo-800/70 mt-1 text-sm">欢迎回来，今天是 {dateStr}</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-6 border border-red-100">{error}</div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {isLoading && !stats ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
                <div className="w-10 h-10 bg-gray-200 rounded-lg mb-3" />
                <div className="h-6 bg-gray-200 rounded w-16 mb-2" />
                <div className="h-4 bg-gray-100 rounded w-20" />
              </div>
            ))
          ) : statCards.length > 0 ? (
            statCards.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="card p-5 cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className={'w-10 h-10 rounded-lg ' + stat.colorClass + ' flex items-center justify-center'}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-indigo-950 mt-3 tabular-nums">{stat.value}</p>
                  <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
                  <p className="text-xs text-emerald-600 mt-1">{stat.change}</p>
                </div>
              );
            })
          ) : null}
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <div
                key={action.title}
                onClick={() => navigate(action.path)}
                className="card p-5 cursor-pointer group"
              >
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 group-hover:bg-indigo-700 group-hover:text-white transition-colors duration-200">
                  <Icon className="w-6 h-6 text-indigo-700 group-hover:text-white transition-colors duration-200" />
                </div>
                <h3 className="text-lg font-semibold text-indigo-950 mb-1">{action.title}</h3>
                <p className="text-sm text-gray-500">{action.desc}</p>
                <ArrowRight className="w-4 h-4 text-gray-400 mt-3 group-hover:text-indigo-700 group-hover:translate-x-1 transition-all duration-200" />
              </div>
            );
          })}
        </div>
      </div>
    </TeacherLayout>
  );
}
