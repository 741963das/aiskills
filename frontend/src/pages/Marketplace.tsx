import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search, Store, Users, BookOpen, GraduationCap, ArrowLeft,
  MessageSquare, Tag, Sparkles, Loader2, ChevronLeft, ChevronRight,
  Layers, Wrench, Calendar, FileText, Presentation, X, Download, AlertCircle, FileCode2,
} from 'lucide-react';
import { TeacherLayout } from '../components/TeacherLayout';
import { AgentChat } from '../components/AgentChat';
import { useAuth } from '../contexts/AuthContext';
import { agentApi } from '../services/agentApi';
import { skillFileApi } from '../services/skillFileApi';
import type { AgentMarketplaceItem } from '../types/agent';
import type { SkillFileMarketplaceItem } from '../types/skillFile';

const TEMPLATE_LABELS: Record<string, string> = {
  higher_edu: '高等教育',
  vocational: '职业教育',
};

const TEMPLATE_COLORS: Record<string, string> = {
  higher_edu: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  vocational: 'bg-amber-50 text-amber-700 border-amber-200',
};

const PAGE_SIZE = 9;

export function Marketplace() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeAgentId = searchParams.get('agent');

  const [tab, setTab] = useState<'agents' | 'skill-files'>('agents');

  // 助手市场
  const [items, setItems] = useState<AgentMarketplaceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [subjects, setSubjects] = useState<string[]>([]);

  const [keyword, setKeyword] = useState('');
  const [appliedKeyword, setAppliedKeyword] = useState('');
  const [template, setTemplate] = useState('');
  const [subject, setSubject] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeAgent, setActiveAgent] = useState<AgentMarketplaceItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // 技能文件市场
  const [skillFileItems, setSkillFileItems] = useState<SkillFileMarketplaceItem[]>([]);
  const [skillFileTotal, setSkillFileTotal] = useState(0);
  const [skillFileLoading, setSkillFileLoading] = useState(false);
  const [skillFileError, setSkillFileError] = useState<string | null>(null);

  // AI 课件生成弹窗
  const [showCoursewareModal, setShowCoursewareModal] = useState(false);
  const [coursewareTopic, setCoursewareTopic] = useState('');
  const [coursewareAudience, setCoursewareAudience] = useState('');
  const [coursewareRequirements, setCoursewareRequirements] = useState('');
  const [coursewareFormat, setCoursewareFormat] = useState<'word' | 'ppt'>('word');
  const [isGeneratingCourseware, setIsGeneratingCourseware] = useState(false);
  const [coursewareError, setCoursewareError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const fetchList = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await agentApi.getMarketplace(token, {
        keyword: appliedKeyword || undefined,
        template: template || undefined,
        subject: subject || undefined,
        scope: 'teachers',
        page,
        page_size: PAGE_SIZE,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取市场列表失败');
    } finally {
      setIsLoading(false);
    }
  }, [token, appliedKeyword, template, subject, page]);

  const fetchSkillFiles = useCallback(async () => {
    if (!token) return;
    setSkillFileLoading(true);
    setSkillFileError(null);
    try {
      const data = await skillFileApi.getMarketplace(token, {
        keyword: appliedKeyword || undefined,
        page,
        page_size: PAGE_SIZE,
      });
      setSkillFileItems(data.items);
      setSkillFileTotal(data.total);
    } catch (err) {
      setSkillFileError(err instanceof Error ? err.message : '获取技能市场失败');
    } finally {
      setSkillFileLoading(false);
    }
  }, [token, appliedKeyword, page]);

  useEffect(() => {
    if (token && !activeAgentId && tab === 'agents') {
      fetchList();
    }
  }, [token, activeAgentId, fetchList, tab]);

  useEffect(() => {
    if (token && tab === 'skill-files') {
      fetchSkillFiles();
    }
  }, [token, tab, fetchSkillFiles]);

  useEffect(() => {
    if (token) {
      agentApi.getMarketplaceSubjects(token, 'teachers').then(setSubjects).catch(() => {});
    }
  }, [token]);

  // 详情视图：加载单个 Agent
  useEffect(() => {
    if (!token || !activeAgentId) {
      setActiveAgent(null);
      return;
    }
    const id = Number(activeAgentId);
    if (Number.isNaN(id)) return;
    setLoadingDetail(true);
    agentApi
      .getMarketplaceAgent(token, id)
      .then((item) => setActiveAgent(item))
      .catch((err) => setError(err instanceof Error ? err.message : '获取详情失败'))
      .finally(() => setLoadingDetail(false));
  }, [token, activeAgentId]);

  const handleSearch = () => {
    setAppliedKeyword(keyword.trim());
    setPage(1);
    if (tab === 'skill-files') {
      fetchSkillFiles();
    }
  };

  const handleResetFilters = () => {
    setKeyword('');
    setAppliedKeyword('');
    setTemplate('');
    setSubject('');
    setPage(1);
  };

  const openAgent = (id: number) => {
    setSearchParams({ agent: String(id) });
  };

  const backToList = () => {
    setSearchParams({});
    setActiveAgent(null);
    setError(null);
  };

  const handleDownloadAgent = async (agentId: number) => {
    if (!token) return;
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const newAgent = await agentApi.downloadAgent(token, agentId);
      navigate(`/teacher/agents/${newAgent.id}/preview`);
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : '下载失败');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleGenerateCourseware = async (agentId: number, agentName: string) => {
    if (!token) return;
    setIsGeneratingCourseware(true);
    setCoursewareError(null);
    try {
      const blob = await agentApi.generateCourseware(token, agentId, {
        topic: coursewareTopic,
        format: coursewareFormat,
        audience: coursewareAudience,
        requirements: coursewareRequirements,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = coursewareFormat === 'word' ? 'docx' : 'pptx';
      a.download = `${agentName}_${coursewareTopic.slice(0, 20)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowCoursewareModal(false);
      setCoursewareTopic('');
      setCoursewareAudience('');
      setCoursewareRequirements('');
    } catch (err) {
      setCoursewareError(err instanceof Error ? err.message : '生成课件失败');
    } finally {
      setIsGeneratingCourseware(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('zh-CN');
  };

  return (
    <TeacherLayout>
      {/* ---------- 助手详情对话视图 ---------- */}
      {activeAgentId ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={backToList}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              返回市场
            </button>
            <div className="flex items-center gap-2">
              <span className={'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ' + (TEMPLATE_COLORS[activeAgent?.template || 'higher_edu'] || TEMPLATE_COLORS.higher_edu)}>
                {TEMPLATE_LABELS[activeAgent?.template || 'higher_edu'] || activeAgent?.template}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                已发布
              </span>
              <button
                onClick={() => setShowCoursewareModal(true)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs btn-cta"
              >
                <Sparkles className="w-3 h-3" />
                AI 生成课件
              </button>
              <button
                onClick={() => handleDownloadAgent(activeAgent!.id)}
                disabled={isDownloading}
                className="flex items-center gap-1 px-3 py-1.5 text-xs btn-primary disabled:opacity-50"
              >
                {isDownloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                {isDownloading ? '下载中...' : '下载到我的助手'}
              </button>
              {downloadError && (
                <span className="text-xs text-red-500">{downloadError}</span>
              )}
            </div>
          </div>

          {loadingDetail ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              加载中...
            </div>
          ) : activeAgent ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: 'calc(100vh - 140px)' }}>
              {/* 左侧：助手信息 */}
              <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4 overflow-y-auto">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{activeAgent.name}</h1>
                  <p className="text-sm text-gray-500 mt-1">{activeAgent.course_name}</p>
                </div>

                {activeAgent.description && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">简介</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{activeAgent.description}</p>
                  </div>
                )}

                <div className="space-y-2 text-sm">
                  {activeAgent.subject && (
                    <InfoRow icon={BookOpen} label="学科" value={activeAgent.subject} />
                  )}
                  {activeAgent.department && (
                    <InfoRow icon={GraduationCap} label="院系" value={activeAgent.department} />
                  )}
                  {activeAgent.grade_level && (
                    <InfoRow icon={Users} label="适用年级" value={activeAgent.grade_level} />
                  )}
                  <InfoRow
                    icon={Users}
                    label="作者"
                    value={activeAgent.author_name || '匿名教师'}
                  />
                  <InfoRow
                    icon={MessageSquare}
                    label="使用量"
                    value={`${activeAgent.usage_count} 次对话`}
                  />
                  <InfoRow
                    icon={Calendar}
                    label="发布时间"
                    value={formatDate(activeAgent.updated_at || activeAgent.created_at)}
                  />
                </div>

                {activeAgent.core_chapters.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                      <Layers className="w-3 h-3" /> 核心章节
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {activeAgent.core_chapters.slice(0, 8).map((c, i) => (
                        <span key={i} className="text-xs bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {activeAgent.teaching_tools.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                      <Wrench className="w-3 h-3" /> 教学工具
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {activeAgent.teaching_tools.map((t, i) => (
                        <span key={i} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {activeAgent.llm_model && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> 模型
                    </p>
                    <p className="text-xs text-gray-700 font-mono bg-gray-50 px-2 py-1 rounded">
                      {activeAgent.llm_model}
                    </p>
                  </div>
                )}
              </div>

              {/* 右侧：对话体验区 */}
              <div className="lg:col-span-2">
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-2 mb-2 text-xs text-indigo-800">
                  这是该助手的对话体验区，你可以模拟学生视角与 AI 教学助手对话
                </div>
                <div className="bg-white rounded-xl border border-gray-100 h-[calc(100vh-200px)]">
                  {token && (
                    <AgentChat
                      token={token}
                      agentId={activeAgent.id}
                      agentName={activeAgent.name}
                      agentStatus="published"
                      publishScope={(activeAgent.config?.publishScope as 'students' | 'teachers') || 'students'}
                    />
                  )}
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="px-6 py-12 text-center text-red-500">{error}</div>
          ) : null}
        </div>
      ) : (
        /* ---------- 列表视图 ---------- */
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-indigo-950 flex items-center gap-2">
                <Store className="w-6 h-6 text-indigo-700" />
                助手市场
              </h1>
              <p className="text-indigo-800/70 mt-1 text-sm">浏览所有教师发布的 AI 教学助手，体验对话效果</p>
            </div>
            <div className="text-sm text-gray-500">
              共 <span className="font-semibold text-indigo-950 tabular-nums">{tab === 'agents' ? total : skillFileTotal}</span> 个已发布{tab === 'agents' ? '助手' : '技能文件'}
            </div>
          </div>

          {/* 顶部 Tab 切换 */}
          <div className="flex items-center gap-2 mb-4 border-b border-gray-200">
            <button
              onClick={() => { setTab('agents'); setPage(1); }}
              className={'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ' + (
                tab === 'agents'
                  ? 'border-indigo-700 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                教学助手
              </span>
            </button>
            <button
              onClick={() => { setTab('skill-files'); setPage(1); }}
              className={'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ' + (
                tab === 'skill-files'
                  ? 'border-indigo-700 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                <FileCode2 className="w-4 h-4" />
                技能文件
              </span>
            </button>
          </div>

          {/* 搜索筛选栏 */}
          <div className="card p-4 mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[240px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder={tab === 'agents' ? '搜索助手名称或课程名' : '搜索技能文件名称'}
                  className="input-field pl-9"
                />
              </div>

              {tab === 'agents' && (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">模板：</span>
                    <button
                      onClick={() => { setTemplate(''); setPage(1); }}
                      className={'chip ' + (!template ? 'chip-active' : 'chip-inactive')}
                    >全部</button>
                    <button
                      onClick={() => { setTemplate('higher_edu'); setPage(1); }}
                      className={'chip ' + (template === 'higher_edu' ? 'chip-active' : 'chip-inactive')}
                    >高等教育</button>
                    <button
                      onClick={() => { setTemplate('vocational'); setPage(1); }}
                      className={'chip ' + (template === 'vocational' ? 'chip-active' : 'chip-inactive')}
                    >职业教育</button>
                  </div>

                  {subjects.length > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">学科：</span>
                      <button
                        onClick={() => { setSubject(''); setPage(1); }}
                        className={'chip ' + (!subject ? 'chip-active' : 'chip-inactive')}
                      >全部</button>
                      {subjects.slice(0, 5).map((s) => (
                        <button
                          key={s}
                          onClick={() => { setSubject(s); setPage(1); }}
                          className={'chip ' + (subject === s ? 'chip-active' : 'chip-inactive')}
                        >{s}</button>
                      ))}
                    </div>
                  )}
                </>
              )}

              <button
                onClick={handleSearch}
                className="btn-primary"
              >
                搜索
              </button>
              {(appliedKeyword || template || subject) && (
                <button
                  onClick={handleResetFilters}
                  className="btn-ghost"
                >
                  重置
                </button>
              )}
            </div>
          </div>

          {/* 卡片列表 */}
          {tab === 'agents' ? (
            isLoading ? (
              <div className="flex items-center justify-center py-20 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                加载中...
              </div>
            ) : error ? (
              <div className="px-6 py-12 text-center text-red-500">{error}</div>
            ) : items.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 px-6 py-16 text-center">
                <Store className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-1">市场中暂无已发布的助手</p>
                <p className="text-xs text-gray-400">教师发布助手后，将在此展示供大家体验</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => openAgent(item.id)}
                      className="card p-5 cursor-pointer flex flex-col group hover:-translate-y-1 transition-all duration-200"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition-colors duration-200">
                          <Sparkles className="w-5 h-5 text-indigo-700" />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ' + (TEMPLATE_COLORS[item.template] || TEMPLATE_COLORS.higher_edu)}>
                            {TEMPLATE_LABELS[item.template] || item.template}
                          </span>
                          {item.config?.publishScope === 'teachers' && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-amber-50 text-amber-700 border-amber-200">
                            面向教师
                          </span>
                        )}
                        </div>
                      </div>

                      <h3 className="text-base font-semibold text-gray-900 line-clamp-1">{item.name}</h3>
                      <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{item.course_name}</p>

                      {item.description && (
                        <p className="text-xs text-gray-500 mt-2 line-clamp-2">{item.description}</p>
                      )}

                      <div className="mt-3 flex flex-wrap gap-1">
                        {item.subject && (
                          <span className="text-xs bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded inline-flex items-center gap-1">
                            <BookOpen className="w-3 h-3" />{item.subject}
                          </span>
                        )}
                        {item.grade_level && (
                          <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded inline-flex items-center gap-1">
                            <Users className="w-3 h-3" />{item.grade_level}
                          </span>
                        )}
                        {item.core_chapters[0] && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded inline-flex items-center gap-1">
                            <Tag className="w-3 h-3" />{item.core_chapters[0]}
                            {item.core_chapters.length > 1 && ` +${item.core_chapters.length - 1}`}
                          </span>
                        )}
                      </div>

                      <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between text-xs text-gray-500">
                        <span className="truncate">{item.author_name || '匿名教师'}</span>
                        <span className="inline-flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {item.usage_count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 分页 */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-6">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-sm text-gray-600">
                      {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="p-2 rounded-lg border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </>
            )
          ) : skillFileLoading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              加载中...
            </div>
          ) : skillFileError ? (
            <div className="px-6 py-12 text-center text-red-500">{skillFileError}</div>
          ) : skillFileItems.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 px-6 py-16 text-center">
              <FileCode2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 mb-1">市场中暂无已发布的技能文件</p>
              <p className="text-xs text-gray-400">教师发布技能文件后，将在此展示</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {skillFileItems.map((sf) => (
                <div
                  key={sf.id}
                  className="card p-5 flex flex-col group hover:-translate-y-1 transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-100 transition-colors duration-200">
                      <FileCode2 className="w-5 h-5 text-indigo-700" />
                    </div>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{sf.source}</span>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 line-clamp-1">{sf.name}</h3>
                  {sf.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{sf.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-2 line-clamp-3 font-mono bg-gray-50 p-2 rounded">
                    {sf.content}
                  </p>
                  <div className="mt-auto pt-4 border-t border-gray-50 flex items-center justify-between text-xs text-gray-500">
                    <span className="truncate">{sf.author_name || '匿名教师'}</span>
                    <span className="inline-flex items-center gap-1">
                      <Download className="w-3 h-3" />
                      {sf.usage_count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI 生成课件弹窗 */}
      {showCoursewareModal && activeAgent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-800 to-indigo-700 text-white">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                <h2 className="text-lg font-semibold">AI 生成课件</h2>
              </div>
              <button
                onClick={() => setShowCoursewareModal(false)}
                className="p-1 hover:bg-white/20 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-500">
                输入你要生成课件的主题，AI 将基于此助手的角色设定和知识库内容，为你生成专业的教学材料。
              </p>

              <div>
                <label className="input-label">
                  课件主题 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={coursewareTopic}
                  onChange={(e) => setCoursewareTopic(e.target.value)}
                  placeholder="例如：第三章 函数的极限与连续性"
                  className="input-field"
                  disabled={isGeneratingCourseware}
                />
              </div>

              <div>
                <label className="input-label">
                  目标受众（可选）
                </label>
                <input
                  type="text"
                  value={coursewareAudience}
                  onChange={(e) => setCoursewareAudience(e.target.value)}
                  placeholder="例如：理工科大一学生"
                  className="input-field"
                  disabled={isGeneratingCourseware}
                />
              </div>

              <div>
                <label className="input-label">
                  额外要求（可选）
                </label>
                <textarea
                  value={coursewareRequirements}
                  onChange={(e) => setCoursewareRequirements(e.target.value)}
                  placeholder="例如：需要包含3个课堂互动活动，难度中等"
                  rows={3}
                  className="input-field resize-none"
                  disabled={isGeneratingCourseware}
                />
              </div>

              <div>
                <label className="input-label mb-2">
                  输出格式
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setCoursewareFormat('word')}
                    disabled={isGeneratingCourseware}
                    className={'flex items-center justify-center gap-2 p-3 border-2 rounded-lg transition-all ' + (
                      coursewareFormat === 'word'
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-800'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    )}
                  >
                    <FileText className="w-5 h-5" />
                    <div className="text-left">
                      <div className="text-sm font-medium">Word 教案</div>
                      <div className="text-xs text-gray-400">完整教案</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setCoursewareFormat('ppt')}
                    disabled={isGeneratingCourseware}
                    className={'flex items-center justify-center gap-2 p-3 border-2 rounded-lg transition-all ' + (
                      coursewareFormat === 'ppt'
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-600'
                    )}
                  >
                    <Presentation className="w-5 h-5" />
                    <div className="text-left">
                      <div className="text-sm font-medium">PPT 课件</div>
                      <div className="text-xs text-gray-400">幻灯片演示</div>
                    </div>
                  </button>
                </div>
              </div>

              {coursewareError && (
                <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {coursewareError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 bg-gray-50">
                <button
                  onClick={() => setShowCoursewareModal(false)}
                  disabled={isGeneratingCourseware}
                  className="btn-ghost disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  onClick={() => handleGenerateCourseware(activeAgent!.id, activeAgent!.name)}
                  disabled={isGeneratingCourseware || !coursewareTopic.trim()}
                  className="btn-cta disabled:opacity-50"
                >
                  {isGeneratingCourseware ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      生成中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      生成 {coursewareFormat === 'word' ? 'Word' : 'PPT'}
                    </>
                  )}
                </button>
              </div>
          </div>
        </div>
      )}
    </TeacherLayout>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <span className="text-gray-500 w-20 flex-shrink-0">{label}</span>
      <span className="text-gray-900 font-medium truncate">{value}</span>
    </div>
  );
}
