import { useState, useEffect } from 'react';
import { BarChart3, Users, MessageSquare, AlertTriangle, BookOpen, ChevronDown } from 'lucide-react';
import { TeacherLayout } from '../components/TeacherLayout';
import { useAuth } from '../contexts/AuthContext';
import { analyticsApi, type AnalyticsOverview, type ClassAnalytics, type KnowledgeNode } from '../services/analyticsApi';

export function ClassAnalyticsPage() {
  const { token } = useAuth();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [classData, setClassData] = useState<ClassAnalytics | null>(null);
  const [knowledgeMap, setKnowledgeMap] = useState<KnowledgeNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingClass, setIsLoadingClass] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setIsLoading(true);
    analyticsApi.getOverview(token)
      .then((data) => {
        setOverview(data);
        if (data.agents.length > 0) {
          setSelectedAgentId(data.agents[0].agent_id);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token || !selectedAgentId) return;
    setIsLoadingClass(true);
    Promise.all([
      analyticsApi.getClass(token, selectedAgentId),
      analyticsApi.getKnowledgeMap(token, selectedAgentId),
    ])
      .then(([cls, km]) => {
        setClassData(cls);
        setKnowledgeMap(km.nodes);
      })
      .catch(() => {})
      .finally(() => setIsLoadingClass(false));
  }, [token, selectedAgentId]);

  if (isLoading) {
    return (
      <TeacherLayout>
        <div className="flex items-center justify-center h-64 text-gray-400">加载中...</div>
      </TeacherLayout>
    );
  }

  return (
    <TeacherLayout>
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-indigo-950">学情分析</h1>
            <p className="text-sm text-gray-500 mt-0.5">实时掌握班级学习状况，发现知识薄弱点</p>
          </div>
        </div>

        {error && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}

        {/* 汇总指标 */}
        {overview && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard icon={Users} label="累计学生" value={overview.total_students} color="indigo" />
            <StatCard icon={MessageSquare} label="累计对话" value={overview.total_conversations} color="emerald" />
            <StatCard icon={AlertTriangle} label="错题总数" value={overview.total_mistakes} color="amber" />
            <StatCard icon={BookOpen} label="待掌握错题" value={overview.unmastered_mistakes} color="red" />
          </div>
        )}

        {/* 助手选择器 */}
        {overview && overview.agents.length > 0 && (
          <div className="flex items-center gap-3 mb-6">
            <label className="text-sm font-medium text-gray-700 flex-shrink-0">选择助手：</label>
            <div className="relative">
              <select
                className="appearance-none border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                value={selectedAgentId ?? ''}
                onChange={(e) => setSelectedAgentId(Number(e.target.value))}
              >
                {overview.agents.map((a) => (
                  <option key={a.agent_id} value={a.agent_id}>
                    {a.name}（{a.course_name}）— {a.student_count} 名学生
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        )}

        {isLoadingClass && (
          <div className="text-center py-10 text-gray-400 text-sm">加载班级数据...</div>
        )}

        {classData && !isLoadingClass && (
          <div className="space-y-5">
            {/* 班级概况 */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h2 className="font-semibold text-indigo-950 mb-4">班级概况</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MiniStat label="在读学生" value={classData.student_count} unit="人" />
                <MiniStat label="总对话次数" value={classData.conversation_count} unit="次" />
                <MiniStat label="错题掌握率" value={classData.mistake_summary.mastery_rate} unit="%" />
                <MiniStat label="待掌握错题" value={classData.mistake_summary.unmastered} unit="条" highlight />
              </div>
            </div>

            {/* 薄弱知识点 + 错误类型 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {classData.top_weak_points.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <h2 className="font-semibold text-indigo-950 mb-3">高频薄弱知识点</h2>
                  <p className="text-xs text-gray-400 mb-3">基于错题记录统计，帮助针对性强化教学</p>
                  <div className="space-y-2">
                    {classData.top_weak_points.map((wp) => (
                      <div key={wp.knowledge_point} className="flex items-center gap-3">
                        <span className="text-sm text-gray-700 flex-1 truncate">{wp.knowledge_point}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-100 rounded-full h-1.5">
                            <div
                              className="bg-amber-400 h-1.5 rounded-full"
                              style={{ width: `${Math.min(100, (wp.count / (classData.top_weak_points[0]?.count || 1)) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right">{wp.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {classData.error_type_distribution.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 p-5">
                  <h2 className="font-semibold text-indigo-950 mb-3">错误类型分布</h2>
                  <p className="text-xs text-gray-400 mb-3">了解学生的典型错误模式</p>
                  <div className="space-y-2">
                    {classData.error_type_distribution.map((et) => (
                      <div key={et.error_type} className="flex items-center gap-3">
                        <span className="text-sm text-gray-700 flex-1 truncate">{et.error_type || '未分类'}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-100 rounded-full h-1.5">
                            <div
                              className="bg-red-400 h-1.5 rounded-full"
                              style={{ width: `${Math.min(100, (et.count / (classData.error_type_distribution[0]?.count || 1)) * 100)}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right">{et.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 知识点薄弱地图 */}
            {knowledgeMap.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <h2 className="font-semibold text-indigo-950 mb-1">知识薄弱地图</h2>
                <p className="text-xs text-gray-400 mb-4">颜色深浅反映未掌握程度，红色需重点关注</p>
                <div className="flex flex-wrap gap-2">
                  {knowledgeMap.map((node) => (
                    <KnowledgeTag key={node.knowledge_point} node={node} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!isLoadingClass && overview?.agents.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">暂无数据，发布助手并让学生加入后即可查看学情</p>
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className={`w-9 h-9 rounded-lg ${colorMap[color]} flex items-center justify-center mb-3`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-bold text-indigo-950 tabular-nums">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function MiniStat({ label, value, unit, highlight }: { label: string; value: number; unit: string; highlight?: boolean }) {
  return (
    <div className="text-center p-3 bg-gray-50 rounded-lg">
      <p className={`text-xl font-bold tabular-nums ${highlight ? 'text-red-600' : 'text-indigo-950'}`}>
        {value}<span className="text-sm font-normal text-gray-500 ml-0.5">{unit}</span>
      </p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

function KnowledgeTag({ node }: { node: KnowledgeNode }) {
  const bg = node.severity === 'high' ? 'bg-red-100 text-red-700 border-red-200'
    : node.severity === 'medium' ? 'bg-amber-100 text-amber-700 border-amber-200'
    : 'bg-gray-100 text-gray-600 border-gray-200';
  return (
    <div className={`text-xs px-3 py-1.5 rounded-full border font-medium ${bg}`} title={`未掌握：${node.unmastered}，掌握率：${node.mastery_rate}%`}>
      {node.knowledge_point}
      <span className="ml-1 opacity-70">×{node.total_mistakes}</span>
    </div>
  );
}
