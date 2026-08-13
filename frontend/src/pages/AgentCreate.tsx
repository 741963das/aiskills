import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, RefreshCw, Save, Rocket, Check, Loader2,
  ArrowRight, ArrowLeft, GraduationCap, Wrench, Users, Briefcase,
  BookOpen, MessageSquare, ChevronDown, ChevronUp, Edit3,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { agentApi } from '../services/agentApi';
import { KnowledgeUpload } from '../components/KnowledgeUpload';
import { AgentChat } from '../components/AgentChat';
import type { KnowledgeFile } from '../services/knowledgeApi';
import { TeacherLayout } from '../components/TeacherLayout';
import { TagSelect } from '../components/structured-form/TagSelect';
import { MultiTagSelect } from '../components/structured-form/MultiTagSelect';
import { TextInputWithHint } from '../components/structured-form/TextInputWithHint';

type TemplateKey = 'higher_edu' | 'vocational';
type PublishScope = 'students' | 'teachers';

const STEPS = ['选择模板', '选择用途', '填写信息', 'AI 生成', '知识库上传', '预览与保存'];

// v3.0 结构化表单选项
const SUBJECT_OPTIONS = ['理学', '工学', '文学', '管理学', '医学', '经济学', '法学', '教育学', '其他'];
const AUDIENCE_LEVEL_OPTIONS = ['大一新生', '大二', '大三', '大四', '研一', '研二', '研究生', '高中生', '中职学生', '高职学生', '成人教育', '留学生'];
const AUDIENCE_DETAIL_OPTIONS = ['零基础入门', '文科背景', '需要考研', '需要补先修课', '已有项目经验'];
const CORE_TASKS_HIGHER = ['概念讲解', '习题辅导', '实验指导', '论文写作', '考研辅导', '课程答疑', '知识点梳理', '案例讨论'];
const CORE_TASKS_VOCATIONAL = ['概念讲解', '项目实战', '岗位模拟', '技能训练', '案例讨论', '认证辅导', '代码评审', '面试准备'];
const STYLE_OPTIONS = ['专业严谨', '生动有趣', '循序渐进', '启发引导', '案例驱动', '实战导向'];
const ROLE_SUGGESTIONS_HIGHER = ['高中物理教师', '大学英语讲师', '高等数学教师', '计算机科学教师', '高中化学教师'];
const ROLE_SUGGESTIONS_VOCATIONAL = ['前端开发导师', 'UI 设计导师', '数据分析导师', '网络安全导师', '软件测试导师'];

const LLM_MODELS = [
  { value: 'deepseek-ai/DeepSeek-V3.2', label: 'DeepSeek-V3.2' },
  { value: 'Qwen/Qwen2.5-72B-Instruct', label: 'Qwen2.5-72B-Instruct' },
];

// v3.0 结构化模块定义（6 模块，含 student_diagnosis）
const MODULE_DEFS = [
  { key: 'identity', title: '身份声明' },
  { key: 'capabilities', title: '核心能力' },
  { key: 'answer_rules', title: '回答规范' },
  { key: 'student_diagnosis', title: '学生诊断' },
  { key: 'knowledge_strategy', title: '知识库使用指南' },
  { key: 'boundaries', title: '边界约束' },
] as const;

interface StructuredModule {
  title: string;
  content: string;
  items?: string[];
  rules?: string[];
  diagnosis?: { pain_points: Array<{ topic: string; surface_error: string; teacher_diagnosis: string; root_cause: string; solution: string }> };
}

// 高等教育必填校验
const validateHigherEdu = (s: FormState): string | null => {
  if (!s.role) return '请填写角色名称';
  if (!s.subject) return '请选择学科/领域';
  if (!s.courseName) return '请填写课程名称';
  if (!s.audienceLevel) return '请选择目标学生';
  if (s.coreTasks.length === 0) return '请选择核心任务';
  return null;
};

// 职业教育必填校验
const validateVocational = (s: FormState): string | null => {
  if (!s.role) return '请填写角色名称';
  if (!s.major) return '请填写专业方向';
  if (!s.targetJob) return '请填写目标岗位';
  if (!s.coreSkills) return '请填写核心技能';
  if (s.coreTasks.length === 0) return '请选择核心任务';
  return null;
};

interface FormState {
  role: string;
  style: string;
  coreTasks: string[];
  studentPainPoints: string;
  // higher_edu
  subject: string;
  courseName: string;
  audienceLevel: string;
  audienceDetail: string[];
  // vocational
  major: string;
  targetJob: string;
  coreSkills: string;
}

const INITIAL_FORM: FormState = {
  role: '',
  style: '专业严谨',
  coreTasks: [],
  studentPainPoints: '',
  subject: '',
  courseName: '',
  audienceLevel: '',
  audienceDetail: [],
  major: '',
  targetJob: '',
  coreSkills: '',
};

export function AgentCreate() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [currentStep, setCurrentStep] = useState(0);
  const [template, setTemplate] = useState<TemplateKey | null>(null);
  const templateValue = template ?? undefined;
  const [publishScope, setPublishScope] = useState<PublishScope>('students');
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [optimizeFeedback, setOptimizeFeedback] = useState('');
  const [showOptimize, setShowOptimize] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // v3.0 结构化模块状态
  const [structuredModules, setStructuredModules] = useState<Record<string, StructuredModule>>({});
  const [fallbackMode, setFallbackMode] = useState(false);
  const [regeneratingModule, setRegeneratingModule] = useState<string | null>(null);
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [moduleDraft, setModuleDraft] = useState('');

  const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeFile[]>([]);
  const [llmModel, setLlmModel] = useState('deepseek-ai/DeepSeek-V3.2');
  const [similarityThreshold, setSimilarityThreshold] = useState(0.3);
  const [topK, setTopK] = useState(5);
  const [chunkSize, setChunkSize] = useState(512);
  const [chunkOverlap, setChunkOverlap] = useState(50);
  const [agentId, setAgentId] = useState<number | null>(null);

  const [showChat, setShowChat] = useState(false);
  const [showFullPrompt, setShowFullPrompt] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);

  const generatedOnceRef = useRef(false);
  const [generatedPublishScope, setGeneratedPublishScope] = useState<PublishScope | null>(null);

  // 当用途变更时，标记旧 prompt 已过期
  const scopeChanged = generatedPublishScope !== null && generatedPublishScope !== publishScope;

  // 自动调整 style 默认值
  useEffect(() => {
    if (template === 'vocational' && form.style === '专业严谨') {
      setForm((f) => ({ ...f, style: '实战导向' }));
    } else if (template === 'higher_edu' && form.style === '实战导向' && !form.role) {
      setForm((f) => ({ ...f, style: '专业严谨' }));
    }
  }, [template]); // eslint-disable-line react-hooks/exhaustive-deps

  const agentName = template === 'vocational'
    ? `${form.role || '导师'} - ${form.targetJob || '岗位'}实训`
    : `${form.role || '教师'} - ${form.courseName || form.subject || '学科'}助手`;

  // v3.0 构建结构化配置请求体
  const buildStructuredPayload = () => {
    const base = {
      template: template as 'higher_edu' | 'vocational',
      publish_scope: publishScope,
      role: form.role,
      core_tasks: form.coreTasks,
      style: form.style,
      student_pain_points: form.studentPainPoints,
    } as Record<string, unknown>;
    if (template === 'higher_edu') {
      base.subject = form.subject;
      base.course_name = form.courseName;
      base.audience_level = form.audienceLevel;
      base.audience_detail = form.audienceDetail;
    } else {
      base.major = form.major;
      base.target_job = form.targetJob;
      base.core_skills = form.coreSkills;
    }
    return base;
  };

  const handleGenerateStructured = async (silent = false) => {
    if (!token || !template) return;
    const validate = template === 'higher_edu' ? validateHigherEdu : validateVocational;
    const err = validate(form);
    if (err) {
      if (!silent) setError(err);
      return;
    }
    setError(null);
    setIsGeneratingPrompt(true);
    try {
      const result = await agentApi.generateStructuredConfig(
        token,
        buildStructuredPayload() as Parameters<typeof agentApi.generateStructuredConfig>[1],
      );
      setStructuredModules(result.modules as Record<string, StructuredModule>);
      setFallbackMode(result.fallback);
      setSystemPrompt(result.system_prompt);
      setGeneratedPublishScope(publishScope);
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成结构化配置失败');
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  // 进入 Step 3（AI 生成步骤）后自动触发一次生成
  useEffect(() => {
    if (currentStep === 3 && !generatedOnceRef.current && !systemPrompt && !isGeneratingPrompt) {
      generatedOnceRef.current = true;
      handleGenerateStructured();
    }
  }, [currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // v3.0 局部重新生成某个模块
  const handleRegenerateModule = async (moduleKey: string) => {
    if (!token || !template) return;
    setError(null);
    setRegeneratingModule(moduleKey);
    try {
      const result = await agentApi.regenerateModule(token, {
        module_name: moduleKey,
        template: template as 'higher_edu' | 'vocational',
        publish_scope: publishScope,
        role: form.role,
        subject: form.subject,
        course_name: form.courseName,
        audience_level: form.audienceLevel,
        core_tasks: form.coreTasks,
        style: form.style,
        student_pain_points: form.studentPainPoints,
        major: form.major,
        target_job: form.targetJob,
        core_skills: form.coreSkills,
        current_modules: structuredModules,
      });
      setStructuredModules((prev) => ({ ...prev, [moduleKey]: result.module as StructuredModule }));
      setSystemPrompt(result.system_prompt);
    } catch (e) {
      setError(e instanceof Error ? e.message : '模块重新生成失败');
    } finally {
      setRegeneratingModule(null);
    }
  };

  // v3.0 进入模块编辑模式
  const startEditModule = (moduleKey: string) => {
    const mod = structuredModules[moduleKey];
    setEditingModule(moduleKey);
    setModuleDraft(mod?.content || '');
  };

  // v3.0 保存模块编辑（手动修改 content 后重建 system_prompt 需后端处理，这里仅本地保存）
  const saveEditModule = (moduleKey: string) => {
    setStructuredModules((prev) => ({
      ...prev,
      [moduleKey]: { ...prev[moduleKey], content: moduleDraft },
    }));
    setEditingModule(null);
    setModuleDraft('');
  };

  const handleOptimizePrompt = async () => {
    if (!token || !optimizeFeedback.trim()) return;
    setError(null);
    setIsOptimizing(true);
    try {
      const result = await agentApi.optimizePrompt(token, {
        current_prompt: systemPrompt,
        feedback: optimizeFeedback,
      });
      setSystemPrompt(result.optimized_prompt);
      setOptimizeFeedback('');
      setShowOptimize(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '优化 Prompt 失败');
    } finally {
      setIsOptimizing(false);
    }
  };

  const buildConfig = () => {
    const config: Record<string, unknown> = {
      systemPrompt,
      llmModel,
      similarityThreshold,
      topK,
      chunkSize,
      chunkOverlap,
      knowledgeFileIds: knowledgeFiles.map((f) => f.id),
      publishScope,
      role: form.role,
      style: form.style,
      core_need: form.coreTasks.join('、'),
      // v3.0 结构化数据
      structuredModules,
      formData: form,
      fiveLayerKnowledge: {},
    };
    if (template === 'higher_edu') {
      config.subject = form.subject;
      config.audience = form.audienceLevel + (form.audienceDetail.length ? '（' + form.audienceDetail.join('、') + '）' : '');
      config.course_name = form.courseName;
    } else {
      config.major = form.major;
      config.target_job = form.targetJob;
      config.core_skills = form.coreSkills;
    }
    return config;
  };

  const handleSaveDraft = async () => {
    if (!token || !template) return;
    setError(null);
    setIsSaving(true);
    try {
      const config = buildConfig();
      const courseName = template === 'higher_edu' ? (form.courseName || form.subject) : form.targetJob;
      if (agentId) {
        await agentApi.update(token, agentId, { name: agentName, course_name: courseName, template: templateValue, config });
      } else {
        const agent = await agentApi.create(token, { name: agentName, course_name: courseName, template: templateValue, config });
        setAgentId(agent.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!token || !agentId) return;
    setIsPublishing(true);
    setError(null);
    try {
      const config = buildConfig();
      const courseName = template === 'higher_edu' ? (form.courseName || form.subject) : form.targetJob;
      await agentApi.update(token, agentId, { name: agentName, course_name: courseName, template: templateValue, config });
      await agentApi.publish(token, agentId);
      setShowPublishConfirm(false);
      navigate('/teacher/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : '发布失败');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleNext = () => {
    setError(null);
    if (currentStep === 0 && !template) {
      setError('请选择一个模板');
      return;
    }
    if (currentStep === 2) {
      const validate = template === 'higher_edu' ? validateHigherEdu : validateVocational;
      const err = validate(form);
      if (err) {
        setError(err);
        return;
      }
    }
    if (currentStep === 3 && !systemPrompt) {
      // 离开生成步骤前必须有 prompt
      setError('请先生成 Prompt');
      return;
    }
    if (currentStep === 3 && scopeChanged) {
      setError('用途已变更，请先重新生成 Prompt 以匹配新用途');
      return;
    }
    // 进入 Step 4（知识库上传）前自动保存草稿
    if (currentStep === 3 && !agentId) {
      handleSaveDraft();
    }
    // 进入 Step 5（预览与保存）前确保 agentId 已创建
    if (currentStep === 4 && !agentId) {
      handleSaveDraft();
    }
    setCurrentStep(Math.min(currentStep + 1, STEPS.length - 1));
  };

  const handlePrev = () => {
    setError(null);
    setCurrentStep(Math.max(currentStep - 1, 0));
  };

  const canSave = !!template && !!form.role && form.coreTasks.length > 0 && !!systemPrompt;

  const updateForm = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const updateArrayForm = (key: 'coreTasks' | 'audienceDetail', value: string[]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  return (
    <TeacherLayout>
      <div className="flex flex-col min-h-[calc(100vh-48px)]">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">创建教学助手</h1>
          <p className="text-gray-500 mt-1">v3.0 双模板 · 双用途 · AI 结构化生成 6 模块配置</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((step, index) => (
            <div key={step} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={'w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm transition-all ' + (
                    index < currentStep
                      ? 'bg-indigo-700 text-white'
                      : index === currentStep
                        ? 'bg-indigo-700 text-white ring-4 ring-indigo-100'
                        : 'bg-gray-200 text-gray-400'
                  )}
                >
                  {index < currentStep ? <Check className="w-5 h-5" /> : index + 1}
                </div>
                <span className={'text-xs mt-2 ' + (index <= currentStep ? 'text-indigo-800 font-medium' : 'text-gray-400')}>
                  {step}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div className={'flex-1 h-0.5 mx-2 ' + (index < currentStep ? 'bg-indigo-700' : 'bg-gray-200')} />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-6">{error}</div>
        )}

        {/* Step 1: 模板选择 */}
        {currentStep === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 flex-1">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">选择模板</h2>
              <p className="text-gray-500 text-sm mt-1">为你的教学助手选择教育类型</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <button
                onClick={() => setTemplate('higher_edu')}
                className={'text-left p-6 rounded-xl border-2 transition-all ' + (
                  template === 'higher_edu'
                    ? 'border-indigo-700 bg-indigo-50'
                    : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                )}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={'w-12 h-12 rounded-xl flex items-center justify-center ' + (
                    template === 'higher_edu' ? 'bg-indigo-700 text-white' : 'bg-gray-100 text-gray-500'
                  )}>
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">高等教育</h3>
                    <p className="text-xs text-gray-500">高校教师 · 学科教学</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600">适用于高校教师、学科教学，5 个字段快速生成。</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {['角色', '学科', '学生', '核心需求', '风格'].map((t) => (
                    <span key={t} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{t}</span>
                  ))}
                </div>
              </button>

              <button
                onClick={() => setTemplate('vocational')}
                className={'text-left p-6 rounded-xl border-2 transition-all ' + (
                  template === 'vocational'
                    ? 'border-amber-600 bg-amber-50'
                    : 'border-gray-200 hover:border-amber-300 hover:bg-gray-50'
                )}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={'w-12 h-12 rounded-xl flex items-center justify-center ' + (
                    template === 'vocational' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-500'
                  )}>
                    <Wrench className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">职业教育</h3>
                    <p className="text-xs text-gray-500">技能导师 · 岗位培训</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600">适用于技能导师、岗位实训，8 个字段深度定制。</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {['角色', '专业', '岗位', '技能', '认证', '实训', '需求', '风格'].map((t) => (
                    <span key={t} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">{t}</span>
                  ))}
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: 用途选择 */}
        {currentStep === 1 && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 flex-1">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900">选择用途</h2>
              <p className="text-gray-500 text-sm mt-1">教学助手面向学生还是教师？这将决定 AI 是辅助学生学习还是辅助教师备课，直接影响 Prompt 的核心能力与回答规范。</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <button
                onClick={() => { setPublishScope('students'); setSystemPrompt(''); setStructuredModules({}); setFallbackMode(false); setGeneratedPublishScope(null); generatedOnceRef.current = false; }}
                className={'text-left p-6 rounded-xl border-2 transition-all ' + (
                  publishScope === 'students'
                    ? 'border-indigo-700 bg-indigo-50'
                    : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                )}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={'w-12 h-12 rounded-xl flex items-center justify-center ' + (
                    publishScope === 'students' ? 'bg-indigo-700 text-white' : 'bg-gray-100 text-gray-500'
                  )}>
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">面向学生</h3>
                    <p className="text-xs text-gray-500">答疑学习 · 技能学习</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600">告诉大模型以学生为中心，引导思考不直接给答案，聚焦概念讲解、习题辅导。</p>
              </button>

              <button
                onClick={() => { setPublishScope('teachers'); setSystemPrompt(''); setStructuredModules({}); setFallbackMode(false); setGeneratedPublishScope(null); generatedOnceRef.current = false; }}
                className={'text-left p-6 rounded-xl border-2 transition-all ' + (
                  publishScope === 'teachers'
                    ? 'border-amber-600 bg-amber-50'
                    : 'border-gray-200 hover:border-amber-300 hover:bg-gray-50'
                )}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={'w-12 h-12 rounded-xl flex items-center justify-center ' + (
                    publishScope === 'teachers' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-500'
                  )}>
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">面向教师</h3>
                    <p className="text-xs text-gray-500">备课辅助 · 教案生成</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600">告诉大模型直接输出可用教学材料、教案、考核标准，聚焦备课辅助。</p>
              </button>
            </div>
          </div>
        )}

        {/* Step 3: 填写信息（v3.0 单页结构化表单） */}
        {currentStep === 2 && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 flex-1 overflow-y-auto">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">填写信息</h2>
                <p className="text-gray-500 text-sm mt-1">
                  {template === 'higher_edu' ? '高等教育模板 · 结构化字段' : '职业教育模板 · 结构化字段'}
                  <span className="ml-2 text-indigo-800">· 面向{publishScope === 'students' ? '学生' : '教师'}</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* 共有：角色 */}
              <TextInputWithHint
                label="角色名称"
                value={form.role}
                onChange={(v) => updateForm('role', v)}
                placeholder={template === 'higher_edu' ? '如：高中物理教师、大学英语讲师' : '如：前端开发导师、UI 设计导师'}
                hint="AI 扮演的教师/导师角色"
                suggestions={template === 'higher_edu' ? ROLE_SUGGESTIONS_HIGHER : ROLE_SUGGESTIONS_VOCATIONAL}
                required
              />

              {/* 共有：教学风格 */}
              <TagSelect
                label="教学风格"
                value={form.style}
                options={STYLE_OPTIONS}
                onChange={(v) => updateForm('style', v)}
                hint={template === 'vocational' ? '默认"实战导向"' : '默认"专业严谨"'}
              />

              {template === 'higher_edu' && (
                <>
                  <TagSelect
                    label="学科/领域"
                    value={form.subject}
                    options={SUBJECT_OPTIONS}
                    onChange={(v) => updateForm('subject', v)}
                    hint="所属学科大类"
                    required
                  />

                  <TextInputWithHint
                    label="课程名称"
                    value={form.courseName}
                    onChange={(v) => updateForm('courseName', v)}
                    placeholder="如：高等数学A、大学物理（力学）"
                    hint="具体课程名称，将作为助手名称的一部分"
                    required
                  />

                  <TextInputWithHint
                    label="目标学生"
                    value={form.audienceLevel}
                    onChange={(v) => updateForm('audienceLevel', v)}
                    placeholder="如：大一新生、大二、大三、大四、研究生、高中生、职业院校学生等"
                    hint="教学对象的目标人群，可自由输入"
                    suggestions={AUDIENCE_LEVEL_OPTIONS}
                    required
                  />

                  <MultiTagSelect
                    label="学生特点（可多选）"
                    value={form.audienceDetail}
                    options={AUDIENCE_DETAIL_OPTIONS}
                    onChange={(v) => updateArrayForm('audienceDetail', v)}
                    maxSelect={3}
                    hint="补充学生的基础或需求特点"
                  />
                </>
              )}

              {template === 'vocational' && (
                <>
                  <TextInputWithHint
                    label="专业方向"
                    value={form.major}
                    onChange={(v) => updateForm('major', v)}
                    placeholder="如：软件工程、视觉传达设计"
                    hint="所属专业大类"
                    required
                  />

                  <TextInputWithHint
                    label="目标岗位"
                    value={form.targetJob}
                    onChange={(v) => updateForm('targetJob', v)}
                    placeholder="如：前端开发工程师、UI 设计师"
                    hint="学生未来要从事的具体岗位"
                    required
                  />

                  <div className="md:col-span-2">
                    <TextInputWithHint
                      label="核心技能"
                      value={form.coreSkills}
                      onChange={(v) => updateForm('coreSkills', v)}
                      placeholder="如：HTML/CSS/JavaScript、React 框架、组件设计、性能优化"
                      hint="岗位必备技能，多个用顿号或逗号分隔"
                      required
                    />
                  </div>
                </>
              )}

              {/* 共有：核心任务（多选标签） */}
              <div className="md:col-span-2">
                <MultiTagSelect
                  label="核心任务"
                  value={form.coreTasks}
                  options={template === 'higher_edu' ? CORE_TASKS_HIGHER : CORE_TASKS_VOCATIONAL}
                  onChange={(v) => updateArrayForm('coreTasks', v)}
                  maxSelect={5}
                  hint="这个 AI 教学助手主要需要完成哪些任务"
                  required
                />
              </div>

              {/* 共有：学生痛点（开放问题，L2 唯一主动输入） */}
              <div className="md:col-span-2">
                <TextInputWithHint
                  label="学生常见错误（开放问题）"
                  value={form.studentPainPoints}
                  onChange={(v) => updateForm('studentPainPoints', v)}
                  placeholder={
                    template === 'higher_edu'
                      ? '如：学生在力学受力分析时容易混淆作用力与反作用力，典型表现是画多余力...'
                      : '如：学生在 React 组件设计时容易把状态提升过度，导致组件耦合...'
                  }
                  hint="学生在哪些知识点上最容易出错？典型表现是什么？这将作为五层经验模型中学生诊断层的初始输入。"
                  multiline
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: AI 生成（v3.0 结构化 6 模块展示） */}
        {currentStep === 3 && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 flex-1 flex flex-col overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">AI 生成结构化配置</h2>
                <p className="text-gray-500 text-sm mt-1">
                  调用 DeepSeek-V3.2 生成 6 模块结构化配置（约 100-160 秒）· 面向{publishScope === 'students' ? '学生' : '教师'}
                </p>
              </div>
              {systemPrompt && !isGeneratingPrompt && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleGenerateStructured()}
                    disabled={isGeneratingPrompt}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm text-indigo-800 hover:text-indigo-900 border border-indigo-200 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className="w-4 h-4" />
                    {scopeChanged ? '按新用途重新生成' : '全部重新生成'}
                  </button>
                  {scopeChanged && (
                    <button
                      onClick={() => { setSystemPrompt(''); setStructuredModules({}); setGeneratedPublishScope(null); setFallbackMode(false); }}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-700 border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      清除旧配置
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 用途变更警告 */}
            {scopeChanged && systemPrompt && !isGeneratingPrompt && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-700">
                  用途已变更为「{publishScope === 'students' ? '面向学生' : '面向教师'}」，当前配置基于「{generatedPublishScope === 'students' ? '面向学生' : '面向教师'}」生成。请点击"按新用途重新生成"以适配新用途。
                </p>
              </div>
            )}

            {/* 降级模式提示 */}
            {fallbackMode && systemPrompt && !isGeneratingPrompt && (
              <div className="mb-4 p-3 bg-cyan-50 border border-cyan-200 rounded-lg">
                <p className="text-sm text-cyan-800">
                  当前为降级模式：LLM 未能返回结构化 JSON，已回退为纯文本 Prompt。你仍可编辑后继续。
                </p>
              </div>
            )}

            {/* 生成中：骨架屏 */}
            {isGeneratingPrompt && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MODULE_DEFS.map((m, idx) => (
                  <div key={m.key} className="border border-gray-100 rounded-xl p-4 animate-pulse" style={{ animationDelay: `${idx * 80}ms` }}>
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
                    <div className="h-3 bg-gray-100 rounded w-full mb-2"></div>
                    <div className="h-3 bg-gray-100 rounded w-4/5 mb-2"></div>
                    <div className="h-3 bg-gray-100 rounded w-2/3"></div>
                  </div>
                ))}
                <div className="md:col-span-2 text-center py-2">
                  <Sparkles className="w-5 h-5 text-indigo-700 animate-pulse inline-block mr-2" />
                  <span className="text-sm text-gray-500">AI 正在生成 6 个模块，请耐心等待...</span>
                </div>
              </div>
            )}

            {/* 生成完成：6 模块卡片网格 */}
            {!isGeneratingPrompt && systemPrompt && !fallbackMode && Object.keys(structuredModules).length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MODULE_DEFS.map((m) => {
                  const mod = structuredModules[m.key];
                  if (!mod) return null;
                  const isEditing = editingModule === m.key;
                  const isRegenerating = regeneratingModule === m.key;
                  return (
                    <div key={m.key} className="border border-gray-100 rounded-xl p-4 hover:shadow-md transition-shadow flex flex-col">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-sm font-semibold text-indigo-950">{mod.title || m.title}</h3>
                        <div className="flex gap-1">
                          <button
                            onClick={() => isEditing ? saveEditModule(m.key) : startEditModule(m.key)}
                            disabled={isRegenerating}
                            className="p-1.5 text-gray-400 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors disabled:opacity-40"
                            title={isEditing ? '保存' : '编辑'}
                          >
                            {isEditing ? <Check className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => handleRegenerateModule(m.key)}
                            disabled={isRegenerating}
                            className="p-1.5 text-gray-400 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors disabled:opacity-40"
                            title="重新生成此模块"
                          >
                            <RefreshCw className={'w-4 h-4 ' + (isRegenerating ? 'animate-spin' : '')} />
                          </button>
                        </div>
                      </div>

                      {isEditing ? (
                        <textarea
                          value={moduleDraft}
                          onChange={(e) => setModuleDraft(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-100 outline-none resize-none flex-1"
                          rows={5}
                        />
                      ) : (
                        <div className="text-sm text-gray-700 space-y-2">
                          <p className="leading-relaxed">{mod.content || '（无内容）'}</p>
                          {mod.items && mod.items.length > 0 && (
                            <ul className="space-y-1">
                              {mod.items.map((it, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-gray-600">
                                  <span className="text-indigo-400 mt-0.5">•</span>
                                  <span>{it}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          {mod.rules && mod.rules.length > 0 && (
                            <ul className="space-y-1">
                              {mod.rules.map((r, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-gray-600">
                                  <span className="text-cyan-500 mt-0.5">›</span>
                                  <span>{r}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          {mod.diagnosis?.pain_points && mod.diagnosis.pain_points.length > 0 && (
                            <div className="space-y-1.5">
                              {mod.diagnosis.pain_points.map((pp, i) => (
                                <div key={i} className="bg-gray-50 rounded-lg p-2 text-xs">
                                  <div className="font-medium text-gray-700">{pp.topic}</div>
                                  <div className="text-gray-500 mt-0.5">表现：{pp.surface_error}</div>
                                  <div className="text-gray-500">诊断：{pp.teacher_diagnosis}</div>
                                  <div className="text-gray-500">原因：{pp.root_cause}</div>
                                  <div className="text-indigo-700">对策：{pp.solution}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div className="md:col-span-2 text-center text-xs text-gray-400">
                  完整 Prompt 字数：{systemPrompt.length} · 各模块可独立编辑或重新生成
                </div>
              </div>
            )}

            {/* 降级模式：单一 textarea */}
            {!isGeneratingPrompt && systemPrompt && fallbackMode && (
              <div>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none font-mono text-sm resize-y"
                  style={{ minHeight: '360px' }}
                />
                <p className="text-xs text-gray-400 mt-1">字数：{systemPrompt.length}</p>
              </div>
            )}

            {/* 未生成：开始按钮 */}
            {!isGeneratingPrompt && !systemPrompt && (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-indigo-50 rounded-full mx-auto mb-3 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-indigo-700" />
                  </div>
                  <p className="text-gray-900 font-medium mb-1">准备生成结构化配置</p>
                  <p className="text-gray-400 text-sm mb-4">将生成 6 个模块，支持独立编辑和重新生成</p>
                  <button
                    onClick={() => handleGenerateStructured()}
                    disabled={isGeneratingPrompt}
                    className="inline-flex items-center gap-2 px-5 py-2.5 btn-cta rounded-lg transition-all disabled:opacity-50"
                  >
                    <Sparkles className="w-5 h-5" />
                    开始生成
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 5: 知识库上传 */}
        {currentStep === 4 && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">上传知识库</h2>
                <p className="text-gray-500 text-sm mt-1">为教学助手上传教学资料，构建 RAG 知识库（可选）</p>
              </div>
              {knowledgeFiles.length > 0 && (
                <span className="text-xs px-2 py-1 bg-indigo-50 text-indigo-800 rounded-full border border-indigo-100">
                  已上传 {knowledgeFiles.length} 个文件
                </span>
              )}
            </div>

            {agentId ? (
              <KnowledgeUpload
                token={token!}
                agentId={agentId}
                files={knowledgeFiles}
                onFilesChange={setKnowledgeFiles}
                showChunkParams={true}
                chunkSize={chunkSize}
                chunkOverlap={chunkOverlap}
                onChunkParamsChange={(cs, co) => { setChunkSize(cs); setChunkOverlap(co); }}
                showSkipLink={false}
              />
            ) : (
              <div className="text-center py-12 text-sm text-gray-500">
                <p>请先保存助手草稿后再上传知识库文件</p>
              </div>
            )}

            <div className="mt-4 p-4 bg-indigo-50 border border-indigo-100 rounded-lg">
              <p className="text-sm text-indigo-800">
                💡 知识库按助手隔离，文件向量将存入 <code className="font-mono">agent_{agentId}</code> collection。上传的文件会在对话时被 RAG 检索引用。
              </p>
            </div>
          </div>
        )}

        {/* Step 6: 预览与保存（v3.0 结构化展示 + 折叠完整 Prompt） */}
        {currentStep === 5 && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">预览与保存</h2>
                <p className="text-gray-500 text-sm mt-1">查看结构化配置、测试对话，然后保存或发布</p>
              </div>
              <button
                onClick={() => handleGenerateStructured()}
                disabled={isGeneratingPrompt}
                className="flex items-center gap-2 px-4 py-2 text-sm text-indigo-800 hover:text-indigo-900 border border-indigo-200 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={'w-4 h-4 ' + (isGeneratingPrompt ? 'animate-spin' : '')} />
                重新生成
              </button>
            </div>

            {/* 结构化模块只读展示 */}
            {!fallbackMode && Object.keys(structuredModules).length > 0 && (
              <div className="mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {MODULE_DEFS.map((m) => {
                    const mod = structuredModules[m.key];
                    if (!mod) return null;
                    return (
                      <div key={m.key} className="border border-gray-100 rounded-lg p-3.5 bg-gray-50/50">
                        <h3 className="text-sm font-semibold text-indigo-950 mb-1.5">{mod.title || m.title}</h3>
                        <p className="text-xs text-gray-600 leading-relaxed mb-2">{mod.content || '（无内容）'}</p>
                        {mod.items && mod.items.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {mod.items.map((it, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 bg-white border border-gray-200 rounded text-gray-600">{it}</span>
                            ))}
                          </div>
                        )}
                        {mod.rules && mod.rules.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {mod.rules.map((r, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 bg-white border border-gray-200 rounded text-gray-600">{r}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 完整 Prompt 折叠区域 */}
            <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowFullPrompt(!showFullPrompt)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">查看完整 Prompt（{systemPrompt.length} 字）</span>
                </div>
                {showFullPrompt ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {showFullPrompt && (
                <div className="p-4">
                  <textarea
                    value={systemPrompt}
                    onChange={(e) => setSystemPrompt(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none font-mono text-sm resize-y"
                    style={{ minHeight: '280px' }}
                  />
                  <p className="text-xs text-gray-400 mt-1">保存时使用编辑后的内容</p>
                </div>
              )}
            </div>

            {/* 优化 */}
            <div className="mb-4">
              {!showOptimize ? (
                <button
                  onClick={() => setShowOptimize(true)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-indigo-800 hover:text-indigo-900 border border-indigo-200 hover:bg-indigo-50 rounded-lg transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  优化 Prompt
                </button>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <label className="block text-sm font-medium text-gray-700">优化反馈</label>
                  <textarea
                    value={optimizeFeedback}
                    onChange={(e) => setOptimizeFeedback(e.target.value)}
                    placeholder="如：让 Prompt 更注重解题步骤、增加互动环节、突出企业案例..."
                    rows={2}
                    className="input-field text-sm resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleOptimizePrompt}
                      disabled={isOptimizing || !optimizeFeedback.trim()}
                      className="flex items-center gap-2 px-4 py-2 btn-primary rounded-lg transition-colors disabled:opacity-50 text-sm"
                    >
                      {isOptimizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {isOptimizing ? '优化中...' : '应用优化'}
                    </button>
                    <button
                      onClick={() => { setShowOptimize(false); setOptimizeFeedback(''); }}
                      className="px-4 py-2 text-gray-600 border border-gray-200 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 测试对话（折叠） */}
            <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowChat(!showChat)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">测试对话</span>
                </div>
                {showChat ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {showChat && (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-gray-500">使用当前 Prompt 与知识库进行测试对话</p>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-500">模型</label>
                      <select
                        value={llmModel}
                        onChange={(e) => setLlmModel(e.target.value)}
                        className="px-2 py-1 border border-gray-200 rounded text-xs focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none bg-white"
                      >
                        {LLM_MODELS.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="h-[480px]">
                    {token && agentId ? (
                      <AgentChat
                        token={token}
                        agentId={agentId}
                        agentName={agentName}
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                          <Loader2 className="w-6 h-6 text-indigo-700 animate-spin mx-auto mb-2" />
                          <p className="text-gray-500 text-sm">正在准备预览环境...</p>
                          <p className="text-gray-400 text-xs mt-1">首次测试将自动保存助手草稿</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 配置参数 */}
            <details className="border border-gray-200 rounded-lg">
              <summary className="px-4 py-3 bg-gray-50 cursor-pointer text-sm font-medium text-gray-700 flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                检索参数配置
              </summary>
              <div className="p-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="block text-gray-600 mb-1">Top K</label>
                  <input
                    type="number"
                    value={topK}
                    onChange={(e) => setTopK(Number(e.target.value))}
                    min={1}
                    max={20}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1">相似度阈值</label>
                  <input
                    type="number"
                    value={similarityThreshold}
                    onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
                    step={0.05}
                    min={0}
                    max={1}
                    className="w-full px-3 py-1.5 border border-gray-200 rounded text-sm"
                  />
                </div>
              </div>
            </details>
          </div>
        )}

        {/* Sticky bottom navigation */}
        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between z-30">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            上一步
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveDraft}
              disabled={isSaving || !canSave}
              className="flex items-center gap-2 px-4 py-2 text-indigo-800 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50 text-sm"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span className="font-medium">保存草稿</span>
            </button>

            {currentStep < STEPS.length - 1 ? (
              <button
                onClick={handleNext}
                disabled={
                  (currentStep === 0 && !template) ||
                  (currentStep === 3 && (!systemPrompt || isGeneratingPrompt))
                }
                className="flex items-center gap-2 px-5 py-2 btn-primary rounded-lg transition-colors disabled:opacity-50 text-sm"
              >
                下一步
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => {
                  if (!agentId) {
                    handleSaveDraft().then(() => setShowPublishConfirm(true));
                  } else {
                    setShowPublishConfirm(true);
                  }
                }}
                disabled={isPublishing || !canSave}
                className="flex items-center gap-2 px-5 py-2 btn-primary rounded-lg transition-colors disabled:opacity-50 text-sm"
              >
                {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                <span className="font-medium">发布</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {showPublishConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="w-12 h-12 bg-indigo-50 rounded-xl mx-auto mb-4 flex items-center justify-center">
              <Rocket className="w-6 h-6 text-indigo-700" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center mb-2">确认发布？</h3>
            <p className="text-gray-500 text-sm text-center mb-6">
              发布后该助手将变为「已发布」状态，{publishScope === 'students' ? '学生' : '教师'}可以使用。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPublishConfirm(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handlePublish}
                disabled={isPublishing}
                className="flex-1 btn-cta font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isPublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                确认发布
              </button>
            </div>
          </div>
        </div>
      )}
    </TeacherLayout>
  );
}
