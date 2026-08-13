import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Loader2, AlertCircle, FileText, Presentation, Sparkles, X, Plus, Search, FileCode2, Check, ChevronDown, ChevronUp, Paperclip, Brain } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { agentApi } from '../services/agentApi';
import { skillFileApi } from '../services/skillFileApi';
import { AgentChat } from '../components/AgentChat';
import { TeacherLayout } from '../components/TeacherLayout';
import { KnowledgeLayerPanel } from '../components/structured-form/KnowledgeLayerPanel';
import type { Agent } from '../types/agent';
import type { SkillFile } from '../types/skillFile';

const SOURCE_BADGE: Record<string, string> = {
  manual: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  github: 'bg-gray-100 text-gray-600 border-gray-200',
  marketplace: 'bg-cyan-50 text-cyan-700 border-cyan-200',
};
const SOURCE_LABEL: Record<string, string> = {
  manual: '手动创建',
  github: 'GitHub',
  marketplace: '来自市场',
};

export function AgentPreview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [mountedSkills, setMountedSkills] = useState<SkillFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  // 技能挂载弹窗
  const [showMountModal, setShowMountModal] = useState(false);
  const [allSkillFiles, setAllSkillFiles] = useState<SkillFile[]>([]);
  const [skillSearch, setSkillSearch] = useState('');
  const [mountLoadingId, setMountLoadingId] = useState<number | null>(null);
  const [skillSectionExpanded, setSkillSectionExpanded] = useState(true);

  // AI 课件生成弹窗
  const [showCoursewareModal, setShowCoursewareModal] = useState(false);
  const [coursewareTopic, setCoursewareTopic] = useState('');
  const [coursewareAudience, setCoursewareAudience] = useState('');
  const [coursewareRequirements, setCoursewareRequirements] = useState('');
  const [coursewareFormat, setCoursewareFormat] = useState<'word' | 'ppt'>('word');
  const [isGeneratingCourseware, setIsGeneratingCourseware] = useState(false);
  const [coursewareError, setCoursewareError] = useState<string | null>(null);

  // 经验沉淀面板
  const [experienceExpanded, setExperienceExpanded] = useState(false);
  const [experienceStats, setExperienceStats] = useState<Record<string, number>>({});
  const [, setExperienceLoading] = useState(false);

  const loadAgent = async () => {
    if (!token || !id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await agentApi.getById(token, Number(id));
      setAgent(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMountedSkills = async (agentId: number) => {
    if (!token) return;
    try {
      const list = await skillFileApi.getAgentSkills(token, agentId);
      setMountedSkills(list);
    } catch {
      setMountedSkills([]);
    }
  };

  const loadAllSkillFiles = useCallback(async () => {
    if (!token) return;
    try {
      const list = await skillFileApi.getAll(token);
      setAllSkillFiles(list);
    } catch {
      setAllSkillFiles([]);
    }
  }, [token]);

  const loadExperienceStats = useCallback(async (agentId: number) => {
    if (!token) return;
    setExperienceLoading(true);
    try {
      const result = await agentApi.getFiveLayerKnowledge(token, agentId);
      setExperienceStats(result.stats || {});
    } catch {
      setExperienceStats({});
    } finally {
      setExperienceLoading(false);
    }
  }, [token]);

  const handleMountSkill = async (skillFileId: number) => {
    if (!token || !agent) return;
    setMountLoadingId(skillFileId);
    try {
      await skillFileApi.mountToAgent(token, agent.id, skillFileId);
      await loadMountedSkills(agent.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '挂载失败');
    } finally {
      setMountLoadingId(null);
    }
  };

  const handleUnmountSkill = async (skillFileId: number) => {
    if (!token || !agent) return;
    setMountLoadingId(skillFileId);
    try {
      await skillFileApi.unmountFromAgent(token, agent.id, skillFileId);
      await loadMountedSkills(agent.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : '卸载失败');
    } finally {
      setMountLoadingId(null);
    }
  };

  const openMountModal = async () => {
    await loadAllSkillFiles();
    setSkillSearch('');
    setShowMountModal(true);
  };

  useEffect(() => {
    loadAgent();
  }, [token, id]);

  useEffect(() => {
    if (token && agent) {
      loadMountedSkills(agent.id);
      loadExperienceStats(agent.id);
    }
  }, [token, agent]);

  const handlePublish = async () => {
    if (!token || !agent) return;
    setIsPublishing(true);
    try {
      const updated = await agentApi.publish(token, agent.id);
      setAgent(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : '发布失败');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!token || !agent) return;
    setIsPublishing(true);
    try {
      const updated = await agentApi.update(token, agent.id, { status: 'draft' });
      setAgent(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : '取消发布失败');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleGenerateCourseware = async () => {
    if (!token || !agent || !coursewareTopic.trim()) return;
    setIsGeneratingCourseware(true);
    setCoursewareError(null);
    try {
      const blob = await agentApi.generateCourseware(token, agent.id, {
        topic: coursewareTopic,
        format: coursewareFormat,
        audience: coursewareAudience,
        requirements: coursewareRequirements,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = coursewareFormat === 'word' ? 'docx' : 'pptx';
      a.download = `${agent.name}_${coursewareTopic.slice(0, 20)}.${ext}`;
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

  if (isLoading) {
    return (
      <TeacherLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-indigo-700 animate-spin" />
          <span className="ml-3 text-gray-500">加载中...</span>
        </div>
      </TeacherLayout>
    );
  }

  if (error || !agent) {
    return (
      <TeacherLayout>
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error || '助手不存在'}
        </div>
        <button
          onClick={() => navigate('/teacher/dashboard')}
          className="mt-4 px-4 py-2 btn-primary"
        >
          返回工作台
        </button>
      </TeacherLayout>
    );
  }

  const config = agent.config || {};
  const scope = config.publishScope || 'students';
  const isDownloaded = !!config.downloaded_from;
  const templateLabel = agent.template === 'vocational' ? '职业教育' : '高等教育';
  const scopeLabel = scope === 'teachers' ? '面向教师' : '面向学生';

  return (
    <TeacherLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/teacher/dashboard')}
              className="flex items-center gap-1 text-gray-600 hover:text-gray-900 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{agent.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className={'text-xs px-2 py-0.5 rounded-full ' + (
                  isDownloaded ? 'bg-cyan-50 text-cyan-700 border border-cyan-200'
                  : agent.status === 'published' ? 'bg-green-50 text-green-600'
                  : agent.status === 'testing' ? 'bg-amber-50 text-amber-600'
                  : 'bg-gray-100 text-gray-500'
                )}>
                  {isDownloaded ? '已下载·来自市场' : agent.status === 'published' ? '已发布' : agent.status === 'testing' ? '测试中' : '草稿'}
                </span>
                <span className="text-xs bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded-full">{templateLabel}</span>
                <span className={'text-xs px-2 py-0.5 rounded-full ' + (scope === 'teachers' ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-800')}>
                  {scopeLabel}
                </span>
                <span className="text-xs text-gray-400">{agent.course_name}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/teacher/agents/create?edit=' + agent.id)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <Edit className="w-4 h-4" />
              编辑
            </button>
            <button
              onClick={() => setShowCoursewareModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm btn-cta shadow-sm"
            >
              <Sparkles className="w-4 h-4" />
              AI 生成课件
            </button>
            {isDownloaded ? (
              <span
                className="px-3 py-1.5 text-sm text-gray-400 bg-gray-50 border border-gray-100 rounded-lg"
                title="从市场下载的助手副本不可重新发布"
              >
                来自市场的助手
              </span>
            ) : agent.status === 'published' ? (
              <button
                onClick={handleUnpublish}
                disabled={isPublishing}
                className="px-3 py-1.5 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {isPublishing ? '处理中...' : '取消发布'}
              </button>
            ) : (
              <button
                onClick={handlePublish}
                disabled={isPublishing}
                className="px-3 py-1.5 text-sm btn-primary disabled:opacity-50 flex items-center gap-1"
              >
                {isPublishing && <Loader2 className="w-3 h-3 animate-spin" />}
                发布到市场
              </button>
            )}
          </div>
        </div>

        {/* 技能挂载卡片 */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <button
            onClick={() => setSkillSectionExpanded(!skillSectionExpanded)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-indigo-700" />
              <span className="text-sm font-semibold text-indigo-950">技能挂载</span>
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-semibold tabular-nums">
                {mountedSkills.length}
              </span>
              {mountedSkills.length > 0 && (
                <span className="text-xs text-gray-400">挂载的技能文件将注入对话 System Prompt</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span
                onClick={(e) => { e.stopPropagation(); openMountModal(); }}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-indigo-700 rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                添加技能
              </span>
              {skillSectionExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </button>

          {skillSectionExpanded && (
            <div className="px-5 pb-4">
              {mountedSkills.length === 0 ? (
                <div className="py-6 text-center">
                  <FileCode2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400 mb-3">暂未挂载任何技能文件</p>
                  <button
                    onClick={openMountModal}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-700 rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    添加技能
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {mountedSkills.map((sf) => (
                    <div
                      key={sf.id}
                      className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg hover:border-indigo-200 transition-colors"
                    >
                      <div className="flex-shrink-0 w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                        <FileCode2 className="w-4 h-4 text-indigo-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 truncate">{sf.name}</span>
                          <span className={'text-xs px-1.5 py-0.5 rounded-full border whitespace-nowrap ' + (SOURCE_BADGE[sf.source] || SOURCE_BADGE.manual)}>
                            {SOURCE_LABEL[sf.source] || sf.source}
                          </span>
                        </div>
                        {sf.description && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{sf.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleUnmountSkill(sf.id)}
                        disabled={mountLoadingId === sf.id}
                        className="flex-shrink-0 px-2.5 py-1 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:border-red-300 hover:text-red-600 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {mountLoadingId === sf.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : '卸载'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 教学经验沉淀面板 */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <button
            onClick={() => setExperienceExpanded(!experienceExpanded)}
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-[#4338CA]" />
              <span className="text-sm font-semibold text-indigo-950">教学经验沉淀</span>
              {(() => {
                const total = Object.values(experienceStats).reduce((a, b) => a + (b || 0), 0);
                return (
                  <span className={'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold tabular-nums ' + (
                    total > 0 ? 'bg-indigo-100 text-[#4338CA]' : 'bg-gray-100 text-gray-400'
                  )}>
                    {total}
                  </span>
                );
              })()}
              <span className="text-xs text-gray-400">
                {Object.values(experienceStats).reduce((a, b) => a + (b || 0), 0) > 0
                  ? '对话中自动积累的经验已注入助手'
                  : '与助手对话时自动提取教学经验'}
              </span>
            </div>
            {experienceExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          {experienceExpanded && (
            <div className="px-5 pb-4">
              {/* 经验概览统计 */}
              <div className="grid grid-cols-5 gap-2 mb-4">
                {[
                  { key: 'knowledge_layer', label: 'L1 知识体系', color: 'text-indigo-700 bg-indigo-50' },
                  { key: 'diagnosis_layer', label: 'L2 学生诊断', color: 'text-cyan-700 bg-cyan-50' },
                  { key: 'strategy_layer', label: 'L3 教学策略', color: 'text-indigo-700 bg-indigo-50' },
                  { key: 'interaction_layer', label: 'L4 课堂交互', color: 'text-cyan-700 bg-cyan-50' },
                  { key: 'feedback_layer', label: 'L5 效果反馈', color: 'text-indigo-700 bg-indigo-50' },
                ].map((layer) => (
                  <div key={layer.key} className={'rounded-lg p-2.5 text-center ' + layer.color}>
                    <div className="text-lg font-bold tabular-nums">{experienceStats[layer.key] || 0}</div>
                    <div className="text-xs mt-0.5">{layer.label}</div>
                  </div>
                ))}
              </div>

              {/* 经验详情面板 */}
              {token && agent && (
                <div className="min-h-[300px]">
                  <KnowledgeLayerPanel
                    token={token}
                    agentId={agent.id}
                    agentName={agent.name}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="h-[calc(100vh-280px)] min-h-[400px]">
          {token && (
            <AgentChat
              token={token}
              agentId={agent.id}
              agentName={agent.name}
              agentStatus={agent.status}
              publishScope={scope}
            />
          )}
        </div>

        {/* AI 生成课件弹窗 */}
        {showCoursewareModal && (
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
                  输入你要生成课件的主题，AI 将基于当前助手的角色设定和知识库内容，为你生成专业的教学材料。
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  onClick={handleGenerateCourseware}
                  disabled={isGeneratingCourseware || !coursewareTopic.trim()}
                  className="px-4 py-2 text-sm btn-cta rounded-lg hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
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

        {/* 技能挂载弹窗 */}
        {showMountModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
              <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-800 to-indigo-700 text-white flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-5 h-5" />
                  <h2 className="text-lg font-semibold">选择技能文件挂载</h2>
                </div>
                <button
                  onClick={() => setShowMountModal(false)}
                  className="p-1 hover:bg-white/20 rounded cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 py-3 border-b border-gray-100 flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={skillSearch}
                    onChange={(e) => setSkillSearch(e.target.value)}
                    placeholder="搜索技能文件名称..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-3 space-y-2">
                {allSkillFiles.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-400">
                    <FileCode2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    暂无可用技能文件
                    <p className="text-xs mt-1">请先在「技能管理」页面创建或导入技能文件</p>
                  </div>
                ) : (
                  allSkillFiles
                    .filter((sf) => !skillSearch || sf.name.toLowerCase().includes(skillSearch.toLowerCase()))
                    .map((sf) => {
                      const isMounted = mountedSkills.some((ms) => ms.id === sf.id);
                      return (
                        <div
                          key={sf.id}
                          className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg hover:border-indigo-200 transition-colors"
                        >
                          <div className="flex-shrink-0 w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                            <FileCode2 className="w-4 h-4 text-indigo-700" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900 truncate">{sf.name}</span>
                              <span className={'text-xs px-1.5 py-0.5 rounded-full border whitespace-nowrap ' + (SOURCE_BADGE[sf.source] || SOURCE_BADGE.manual)}>
                                {SOURCE_LABEL[sf.source] || sf.source}
                              </span>
                            </div>
                            {sf.description && (
                              <p className="text-xs text-gray-500 mt-0.5 truncate">{sf.description}</p>
                            )}
                          </div>
                          {isMounted ? (
                            <button
                              onClick={() => handleUnmountSkill(sf.id)}
                              disabled={mountLoadingId === sf.id}
                              className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:border-red-300 hover:text-red-600 transition-colors disabled:opacity-50 cursor-pointer"
                            >
                              {mountLoadingId === sf.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <>
                                  <Check className="w-3 h-3 text-green-500" />
                                  已挂载
                                </>
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleMountSkill(sf.id)}
                              disabled={mountLoadingId === sf.id}
                              className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-indigo-700 border border-indigo-700 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                            >
                              {mountLoadingId === sf.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : '挂载'}
                            </button>
                          )}
                        </div>
                      );
                    })
                )}
                {allSkillFiles.length > 0 &&
                  allSkillFiles.filter((sf) => !skillSearch || sf.name.toLowerCase().includes(skillSearch.toLowerCase())).length === 0 && (
                    <div className="py-8 text-center text-sm text-gray-400">没有匹配的技能文件</div>
                  )
                }
              </div>
            </div>
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}
