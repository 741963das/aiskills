import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { StudentLayout } from '../../components/StudentLayout';
import { studentApi } from '../../services/studentApi';
import { agentApi } from '../../services/agentApi';
import type { AgentMarketplaceItem } from '../../types/agent';
import type { StudentCourse } from '../../types/auth';
import {
  BookOpen,
  Search,
  Plus,
  MessageSquare,
  Loader2,
  Clock,
  User,
  GraduationCap,
  Bookmark,
  BookmarkPlus,
  Trash2,
  SlidersHorizontal,
  X,
  ArrowUpDown,
  Flame,
  Calendar,
} from 'lucide-react';

type TabKey = 'mine' | 'draft' | 'market';

const TEMPLATE_LABELS: Record<string, string> = {
  higher_edu: '高等教育',
  vocational: '职业教育',
};

const SORT_OPTIONS = [
  { value: 'newest', label: '最新发布', icon: Calendar },
  { value: 'popular', label: '最受欢迎', icon: Flame },
  { value: 'name', label: '名称排序', icon: ArrowUpDown },
];

export function StudentCourses() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [myCourses, setMyCourses] = useState<StudentCourse[]>([]);
  const [drafts, setDrafts] = useState<StudentCourse[]>([]);
  const [marketplace, setMarketplace] = useState<AgentMarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<number | null>(null);
  const [draftingId, setDraftingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabKey>('mine');
  const [detailAgent, setDetailAgent] = useState<AgentMarketplaceItem | null>(null);

  // 市场筛选
  const [filterTemplate, setFilterTemplate] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterSort, setFilterSort] = useState('newest');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [courses, draftsData, agents, subjectsData] = await Promise.all([
        studentApi.getCourses(token),
        studentApi.getDrafts(token).catch(() => [] as StudentCourse[]),
        agentApi.getMarketplace(token, {
          page: 1,
          page_size: 30,
          sort: filterSort as 'newest' | 'popular' | 'name',
          template: filterTemplate || undefined,
          subject: filterSubject || undefined,
          scope: 'students',
        }),
        agentApi.getMarketplaceSubjects(token, 'students').catch(() => [] as string[]),
      ]);
      setMyCourses(courses);
      setDrafts(draftsData);
      setMarketplace(agents.items || []);
      setSubjects(subjectsData);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  }, [token, filterSort, filterTemplate, filterSubject]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleJoin = async (agentId: number) => {
    if (!token) return;
    setJoiningId(agentId);
    setActionError(null);
    try {
      await studentApi.joinCourse(token, agentId);
      await loadData();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '加入课程失败');
    } finally {
      setJoiningId(null);
    }
  };

  const handleSaveDraft = async (agentId: number) => {
    if (!token) return;
    setDraftingId(agentId);
    setActionError(null);
    try {
      await studentApi.saveDraft(token, agentId);
      await loadData();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '保存草稿失败');
    } finally {
      setDraftingId(null);
    }
  };

  const handleActivateDraft = async (agentId: number) => {
    if (!token) return;
    setJoiningId(agentId);
    setActionError(null);
    try {
      await studentApi.activateDraft(token, agentId);
      await loadData();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '激活课程失败');
    } finally {
      setJoiningId(null);
    }
  };

  const handleRemoveDraft = async (agentId: number) => {
    if (!token) return;
    try {
      await studentApi.removeDraft(token, agentId);
      await loadData();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '移除草稿失败');
    }
  };

  const filteredMarketplace = marketplace.filter((a) => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) && !(a.course_name || '').toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  const joinedIds = new Set(myCourses.map((c) => c.agent_id));
  const draftIds = new Set(drafts.map((d) => d.agent_id));

  const openDetail = (agent: AgentMarketplaceItem) => setDetailAgent(agent);
  const closeDetail = () => setDetailAgent(null);

  return (
    <StudentLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">我的课程</h1>
          <p className="text-gray-500 text-sm mt-1">管理和加入你的学习课程</p>
        </div>

        {/* Tab 切换 */}
        <div className="flex gap-2 border-b border-gray-100">
          <button
            onClick={() => setTab('mine')}
            className={'px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors cursor-pointer ' + (
              tab === 'mine'
                ? 'text-cyan-600 border-b-2 border-cyan-600'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            已加入 ({myCourses.length})
          </button>
          <button
            onClick={() => setTab('draft')}
            className={'px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors cursor-pointer ' + (
              tab === 'draft'
                ? 'text-cyan-600 border-b-2 border-cyan-600'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            草稿 ({drafts.length})
          </button>
          <button
            onClick={() => setTab('market')}
            className={'px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors cursor-pointer ' + (
              tab === 'market'
                ? 'text-cyan-600 border-b-2 border-cyan-600'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            发现课程
          </button>
        </div>

        {actionError && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
            <span>{actionError}</span>
            <button
              onClick={() => setActionError(null)}
              className="text-red-400 hover:text-red-600 cursor-pointer ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 bg-white rounded-xl border border-gray-100 animate-pulse" />
            ))}
          </div>
        ) : tab === 'mine' ? (
          /* ========== 已加入 Tab ========== */
          myCourses.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
              <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400">还没有加入任何课程</p>
              <button
                onClick={() => setTab('market')}
                className="mt-4 px-4 py-2 text-sm font-semibold text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors cursor-pointer"
              >
                去发现课程
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myCourses.map((course) => (
                <div
                  key={course.agent_id}
                  className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 bg-cyan-50 rounded-lg flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-cyan-600" />
                    </div>
                    {course.template && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-cyan-50 text-cyan-600">
                        {TEMPLATE_LABELS[course.template] || course.template}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-900 mt-3 truncate">{course.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{course.subject || course.course_name}</p>
                  {course.last_accessed_at && (
                    <p className="flex items-center gap-1 text-xs text-gray-400 mt-2">
                      <Clock className="w-3 h-3" />
                      最近学习：{new Date(course.last_accessed_at).toLocaleDateString('zh-CN')}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-4">
                    <button
                      onClick={() => navigate(`/student/agents/${course.agent_id}/chat`)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4" />
                      开始学习
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : tab === 'draft' ? (
          /* ========== 草稿 Tab ========== */
          drafts.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
              <Bookmark className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400">还没有保存草稿</p>
              <p className="text-gray-400 text-sm mt-1">在发现课程中可以将感兴趣的课程"稍后学习"保存为草稿</p>
              <button
                onClick={() => setTab('market')}
                className="mt-4 px-4 py-2 text-sm font-semibold text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors cursor-pointer"
              >
                去发现课程
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {drafts.map((draft) => (
                <div
                  key={draft.agent_id}
                  className="bg-white rounded-xl border border-dashed border-amber-200 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                      <Bookmark className="w-5 h-5 text-amber-500" />
                    </div>
                    {draft.template && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-50 text-amber-600">
                        {TEMPLATE_LABELS[draft.template] || draft.template}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-900 mt-3 truncate">{draft.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{draft.subject || draft.course_name}</p>
                  <p className="flex items-center gap-1 text-xs text-amber-500 mt-2">
                    <Clock className="w-3 h-3" />
                    保存于 {new Date(draft.saved_at!).toLocaleDateString('zh-CN')}
                  </p>
                  <div className="flex items-center gap-2 mt-4">
                    <button
                      onClick={() => handleActivateDraft(draft.agent_id)}
                      disabled={joiningId === draft.agent_id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {joiningId === draft.agent_id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          正式加入
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleRemoveDraft(draft.agent_id)}
                      className="p-2 text-sm text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="删除草稿"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* ========== 发现课程 Tab ========== */
          <div className="space-y-4">
            {/* 搜索栏 + 筛选 */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索课程名称..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-cyan-600 focus:border-cyan-600 transition-all"
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg border transition-colors cursor-pointer ' + (
                  showFilters || filterTemplate || filterSubject || filterSort !== 'newest'
                    ? 'border-cyan-600 text-cyan-600 bg-cyan-50'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                )}
              >
                <SlidersHorizontal className="w-4 h-4" />
                筛选
                {(filterTemplate || filterSubject || filterSort !== 'newest') && (
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-600" />
                )}
              </button>
            </div>

            {/* 筛选面板 */}
            {showFilters && (
              <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">筛选条件</span>
                  <button
                    onClick={() => {
                      setFilterTemplate('');
                      setFilterSubject('');
                      setFilterSort('newest');
                    }}
                    className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
                  >
                    重置
                  </button>
                </div>
                <div className="flex flex-wrap gap-3">
                  {/* 模板筛选 */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 whitespace-nowrap">模板：</label>
                    <select
                      value={filterTemplate}
                      onChange={(e) => setFilterTemplate(e.target.value)}
                      className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-cyan-600 cursor-pointer"
                    >
                      <option value="">全部</option>
                      <option value="higher_edu">高等教育</option>
                      <option value="vocational">职业教育</option>
                    </select>
                  </div>
                  {/* 学科筛选 */}
                  {subjects.length > 0 && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500 whitespace-nowrap">学科：</label>
                      <select
                        value={filterSubject}
                        onChange={(e) => setFilterSubject(e.target.value)}
                        className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-cyan-600 cursor-pointer max-w-[180px]"
                      >
                        <option value="">全部</option>
                        {subjects.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {/* 排序 */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 whitespace-nowrap">排序：</label>
                    <div className="flex gap-1">
                      {SORT_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setFilterSort(opt.value)}
                          className={'flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ' + (
                            filterSort === opt.value
                              ? 'border-cyan-600 text-cyan-600 bg-cyan-50'
                              : 'border-gray-200 text-gray-500 hover:border-gray-300'
                          )}
                        >
                          <opt.icon className="w-3.5 h-3.5" />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 课程卡片列表 */}
            {filteredMarketplace.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
                {search || filterTemplate || filterSubject ? '没有找到匹配的课程' : '暂无可发现的课程'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMarketplace.map((agent) => {
                  const joined = joinedIds.has(agent.id);
                  const isDraft = draftIds.has(agent.id);
                  return (
                    <div
                      key={agent.id}
                      className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                      onClick={() => openDetail(agent)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="w-10 h-10 bg-cyan-50 rounded-lg flex items-center justify-center">
                          <BookOpen className="w-5 h-5 text-cyan-600" />
                        </div>
                        <div className="flex items-center gap-1.5">
                          {agent.template && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-cyan-50 text-cyan-600">
                              {TEMPLATE_LABELS[agent.template] || agent.template}
                            </span>
                          )}
                          {isDraft && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-50 text-amber-600">
                              草稿
                            </span>
                          )}
                        </div>
                      </div>
                      <h3 className="font-semibold text-gray-900 mt-3 truncate">{agent.name}</h3>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{agent.description || agent.course_name}</p>
                      {/* 元信息 */}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        {agent.subject && (
                          <span className="flex items-center gap-1">
                            <GraduationCap className="w-3.5 h-3.5" />
                            {agent.subject}
                          </span>
                        )}
                        {agent.author_name && (
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {agent.author_name}
                          </span>
                        )}
                        {agent.usage_count !== undefined && agent.usage_count > 0 && (
                          <span className="flex items-center gap-1">
                            <MessageSquare className="w-3.5 h-3.5" />
                            {agent.usage_count}
                          </span>
                        )}
                      </div>
                      {/* 操作按钮 */}
                      <div className="flex items-center gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
                        {joined ? (
                          <button
                            onClick={() => navigate(`/student/agents/${agent.id}/chat`)}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors cursor-pointer"
                          >
                            <MessageSquare className="w-4 h-4" />
                            开始学习
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleJoin(agent.id)}
                              disabled={joiningId === agent.id}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors cursor-pointer disabled:opacity-50"
                            >
                              {joiningId === agent.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Plus className="w-4 h-4" />
                                  加入学习
                                </>
                              )}
                            </button>
                            {!isDraft && (
                              <button
                                onClick={() => handleSaveDraft(agent.id)}
                                disabled={draftingId === agent.id}
                                className="p-2 text-sm text-gray-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                title="稍后学习"
                              >
                                {draftingId === agent.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <BookmarkPlus className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 课程详情弹窗 */}
        {detailAgent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={closeDetail}>
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 弹窗头部 */}
              <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-cyan-50 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-cyan-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{detailAgent.name}</h2>
                    <p className="text-sm text-gray-500">{detailAgent.course_name}</p>
                  </div>
                </div>
                <button
                  onClick={closeDetail}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 弹窗内容 */}
              <div className="px-6 py-5 space-y-5">
                {/* 简介 */}
                {detailAgent.description && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">课程简介</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{detailAgent.description}</p>
                  </div>
                )}

                {/* 元信息网格 */}
                <div className="grid grid-cols-2 gap-3">
                  {detailAgent.subject && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-400">学科</p>
                      <p className="text-sm font-medium text-gray-800 mt-0.5">{detailAgent.subject}</p>
                    </div>
                  )}
                  {detailAgent.template && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-400">模板</p>
                      <p className="text-sm font-medium text-gray-800 mt-0.5">
                        {TEMPLATE_LABELS[detailAgent.template] || detailAgent.template}
                      </p>
                    </div>
                  )}
                  {detailAgent.grade_level && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-400">适用年级</p>
                      <p className="text-sm font-medium text-gray-800 mt-0.5">{detailAgent.grade_level}</p>
                    </div>
                  )}
                  {detailAgent.department && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-400">院系</p>
                      <p className="text-sm font-medium text-gray-800 mt-0.5">{detailAgent.department}</p>
                    </div>
                  )}
                  {detailAgent.author_name && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-400">作者</p>
                      <p className="text-sm font-medium text-gray-800 mt-0.5">{detailAgent.author_name}</p>
                    </div>
                  )}
                  {detailAgent.usage_count !== undefined && (
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-400">使用量</p>
                      <p className="text-sm font-medium text-gray-800 mt-0.5">{detailAgent.usage_count} 次对话</p>
                    </div>
                  )}
                </div>

                {/* 核心章节 */}
                {detailAgent.core_chapters && detailAgent.core_chapters.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">核心章节</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {detailAgent.core_chapters.map((ch, i) => (
                        <span key={i} className="px-2.5 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                          {ch}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 教学工具 */}
                {detailAgent.teaching_tools && detailAgent.teaching_tools.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">教学工具</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {detailAgent.teaching_tools.map((tool, i) => (
                        <span key={i} className="px-2.5 py-1 text-xs bg-cyan-50 text-cyan-600 rounded-full">
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 弹窗底部操作 */}
              <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 rounded-b-2xl">
                {joinedIds.has(detailAgent.id) ? (
                  <button
                    onClick={() => {
                      closeDetail();
                      navigate(`/student/agents/${detailAgent.id}/chat`);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-4 h-4" />
                    开始学习
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        handleJoin(detailAgent.id);
                        closeDetail();
                      }}
                      disabled={joiningId === detailAgent.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {joiningId === detailAgent.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          加入学习
                        </>
                      )}
                    </button>
                    {!draftIds.has(detailAgent.id) && (
                      <button
                        onClick={() => {
                          handleSaveDraft(detailAgent.id);
                          closeDetail();
                        }}
                        disabled={draftingId === detailAgent.id}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {draftingId === detailAgent.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <BookmarkPlus className="w-4 h-4" />
                            稍后学习
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </StudentLayout>
  );
}