import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, PlusCircle, Download, Store, Edit,
  ArrowRight, Search,
} from 'lucide-react';
import { TeacherLayout } from '../components/TeacherLayout';
import { useAuth } from '../contexts/AuthContext';
import { agentApi } from '../services/agentApi';
import type { Agent } from '../types/agent';

const TEMPLATE_LABELS: Record<string, string> = {
  higher_edu: '高等教育',
  vocational: '职业教育',
};

const SCOPE_LABELS: Record<string, string> = {
  students: '面向学生',
  teachers: '面向教师',
};

type FilterTab = 'all' | 'created' | 'downloaded';

export function MyAgents() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    const fetchAgents = async () => {
      if (!token) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await agentApi.getAll(token);
        setAgents(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取助手列表失败');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAgents();
  }, [token]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'published': return { label: '已发布', class: 'bg-emerald-50 text-emerald-700 border border-emerald-200' };
      case 'testing': return { label: '测试中', class: 'bg-amber-50 text-amber-700 border border-amber-200' };
      default: return { label: '草稿', class: 'bg-gray-50 text-gray-700 border border-gray-200' };
    }
  };

  const downloadedCount = useMemo(
    () => agents.filter((a) => a.config?.downloaded_from).length,
    [agents],
  );
  const createdCount = agents.length - downloadedCount;

  const filteredAgents = useMemo(() => {
    let result = agents;
    if (filterTab === 'created') result = result.filter((a) => !a.config?.downloaded_from);
    if (filterTab === 'downloaded') result = result.filter((a) => a.config?.downloaded_from);
    if (keyword.trim()) {
      const kw = keyword.toLowerCase();
      result = result.filter((a) =>
        a.name.toLowerCase().includes(kw) ||
        (a.course_name || '').toLowerCase().includes(kw)
      );
    }
    return result;
  }, [agents, filterTab, keyword]);

  const filterTabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: '全部', count: agents.length },
    { key: 'created', label: '我创建的', count: createdCount },
    { key: 'downloaded', label: '来自市场', count: downloadedCount },
  ];

  return (
    <TeacherLayout>
      <div>
        {/* 标题区 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-indigo-950">我的助手</h1>
            <p className="text-indigo-800/70 mt-1 text-sm">管理你的 AI 教学助手，查看对话历史</p>
          </div>
          <button
            onClick={() => navigate('/teacher/agents/create')}
            className="btn-primary flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            创建新助手
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-6 border border-red-100">{error}</div>
        )}

        {/* 筛选 + 搜索 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilterTab(tab.key)}
                className={'px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 cursor-pointer ' + (
                  filterTab === tab.key
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {tab.label}
                <span className={'ml-1.5 tabular-nums ' + (filterTab === tab.key ? 'text-indigo-400' : 'text-gray-400')}>{tab.count}</span>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索助手名称或课程..."
              className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all w-64"
            />
          </div>
        </div>

        {/* 助手卡片网格 */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
                <div className="w-10 h-10 bg-gray-200 rounded-lg mb-3" />
                <div className="h-5 bg-gray-200 rounded w-32 mb-2" />
                <div className="h-4 bg-gray-100 rounded w-20 mb-4" />
                <div className="h-8 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 text-indigo-200 mx-auto mb-3" />
            {filterTab === 'downloaded' ? (
              <>
                <p className="text-gray-500 mb-4">还没有从市场下载任何助手</p>
                <button onClick={() => navigate('/teacher/marketplace')} className="btn-primary">
                  <Store className="w-4 h-4" />
                  去市场看看
                </button>
              </>
            ) : keyword.trim() ? (
              <p className="text-gray-500">没有匹配的助手</p>
            ) : (
              <>
                <p className="text-gray-500 mb-4">还没有任何助手，开始创建你的第一个 AI 教学助手</p>
                <button onClick={() => navigate('/teacher/agents/create')} className="btn-primary">
                  <PlusCircle className="w-4 h-4" />
                  创建助手
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgents.map((agent) => {
              const statusInfo = getStatusLabel(agent.status);
              const config = agent.config || {};
              const scope = config.publishScope || 'students';
              const downloadedFrom = config.downloaded_from;
              return (
                <div
                  key={agent.id}
                  className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md hover:border-indigo-200 transition-all duration-200 cursor-pointer group"
                  onClick={() => navigate('/teacher/agents/' + agent.id + '/preview')}
                >
                  {/* 头部：图标 + 名称 + 来源 */}
                  <div className="flex items-start justify-between mb-3">
                    <div className={'w-10 h-10 rounded-lg flex items-center justify-center ' + (downloadedFrom ? 'bg-cyan-50' : 'bg-indigo-50')}>
                      {downloadedFrom ? (
                        <Download className="w-5 h-5 text-cyan-600" />
                      ) : (
                        <BookOpen className="w-5 h-5 text-indigo-700" />
                      )}
                    </div>
                    {downloadedFrom && (
                      <span className="text-xs bg-cyan-50 text-cyan-600 px-2 py-0.5 rounded-full border border-cyan-100">来自市场</span>
                    )}
                  </div>

                  {/* 名称 + 课程 */}
                  <h3 className="text-base font-semibold text-indigo-950 mb-1">{agent.name}</h3>
                  <p className="text-sm text-gray-500 mb-3">{agent.course_name || '未设置课程'}</p>

                  {/* 标签行 */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {TEMPLATE_LABELS[agent.template] || agent.template}
                    </span>
                    <span className={'text-xs px-2 py-0.5 rounded ' + (scope === 'teachers' ? 'bg-violet-50 text-violet-700 border border-violet-100' : 'bg-indigo-50 text-indigo-800 border border-indigo-100')}>
                      {SCOPE_LABELS[scope] || scope}
                    </span>
                    <span className={'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ' + statusInfo.class}>
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* 底部：时间 + 操作 */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                    <span className="text-xs text-gray-400 tabular-nums">
                      {agent.updated_at ? new Date(agent.updated_at).toLocaleDateString('zh-CN') : '-'}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate('/teacher/agents/create?edit=' + agent.id); }}
                        className="p-1.5 text-gray-400 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <div className="flex items-center gap-1 text-xs font-semibold text-indigo-700 group-hover:gap-2 transition-all">
                        进入对话
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}
