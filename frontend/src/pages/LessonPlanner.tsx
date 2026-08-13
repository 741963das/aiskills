import { useState, useEffect } from 'react';
import { BookOpen, Sparkles, Trash2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { TeacherLayout } from '../components/TeacherLayout';
import { useAuth } from '../contexts/AuthContext';
import { lessonPlanApi, type LessonPlan } from '../services/lessonPlanApi';
import { agentApi } from '../services/agentApi';
import type { Agent } from '../types/agent';

export function LessonPlanner() {
  const { token } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [plans, setPlans] = useState<LessonPlan[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    topic: '',
    subject: '',
    grade: '',
    duration: '45分钟',
    student_count: '',
    agent_id: '',
    extra_requirements: '',
  });

  useEffect(() => {
    if (!token) return;
    agentApi.getAll(token).then(setAgents).catch(() => {});
    lessonPlanApi.getAll(token).then(setPlans).catch(() => {});
  }, [token]);

  const handleGenerate = async () => {
    if (!form.topic.trim() || !form.subject.trim()) {
      setError('请填写教学主题和学科');
      return;
    }
    setIsGenerating(true);
    setError(null);
    try {
      const plan = await lessonPlanApi.generate(token!, {
        topic: form.topic,
        subject: form.subject,
        grade: form.grade || undefined,
        duration: form.duration || '45分钟',
        student_count: form.student_count ? Number(form.student_count) : undefined,
        agent_id: form.agent_id ? Number(form.agent_id) : undefined,
        extra_requirements: form.extra_requirements || undefined,
      });
      setPlans((prev) => [plan, ...prev]);
      setExpanded(plan.id);
      setForm({ topic: '', subject: '', grade: '', duration: '45分钟', student_count: '', agent_id: '', extra_requirements: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    await lessonPlanApi.delete(token, id).catch(() => {});
    setPlans((prev) => prev.filter((p) => p.id !== id));
    if (expanded === id) setExpanded(null);
  };

  return (
    <TeacherLayout>
      <div className="max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-indigo-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-indigo-950">AI 智能备课助手</h1>
            <p className="text-sm text-gray-500 mt-0.5">结合教师经验模型，一键生成个性化教学设计方案</p>
          </div>
        </div>

        {/* 生成表单 */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
          <h2 className="font-semibold text-indigo-950 mb-4">填写备课信息</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">教学主题 *</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="例如：函数概念与性质"
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">学科 *</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="例如：高中数学"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">年级/层次</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="例如：高一"
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">课时时长</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
              >
                {['40分钟', '45分钟', '50分钟', '90分钟'].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">班级人数</label>
              <input
                type="number"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="例如：40"
                value={form.student_count}
                onChange={(e) => setForm({ ...form, student_count: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">关联助手（融入经验）</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.agent_id}
                onChange={(e) => setForm({ ...form, agent_id: e.target.value })}
              >
                <option value="">不关联</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}（{a.course_name}）</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">额外要求（选填）</label>
            <textarea
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="例如：需要包含小组讨论环节，注重实际应用..."
              value={form.extra_requirements}
              onChange={(e) => setForm({ ...form, extra_requirements: e.target.value })}
            />
          </div>
          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="mt-4 flex items-center gap-2 bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-800 transition-colors disabled:opacity-60 cursor-pointer"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isGenerating ? 'AI 正在生成备课方案...' : '生成教学设计方案'}
          </button>
        </div>

        {/* 历史备课记录 */}
        {plans.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-indigo-950">备课记录</h2>
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                expanded={expanded === plan.id}
                onToggle={() => setExpanded(expanded === plan.id ? null : plan.id)}
                onDelete={() => handleDelete(plan.id)}
              />
            ))}
          </div>
        )}

        {plans.length === 0 && !isGenerating && (
          <div className="text-center py-16 text-gray-400">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">还没有备课记录，填写左侧表单开始生成</p>
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}

function PlanCard({ plan, expanded, onToggle, onDelete }: {
  plan: LessonPlan;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const c = plan.content;
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <BookOpen className="w-4 h-4 text-indigo-700" />
          </div>
          <div>
            <p className="font-medium text-indigo-950">{plan.title}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {plan.subject} · {plan.duration || '45分钟'} · {new Date(plan.created_at).toLocaleDateString('zh-CN')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-5 border-t border-gray-50 space-y-4">
          {c.teaching_objectives && (
            <Section title="教学目标">
              {c.teaching_objectives.knowledge?.map((t, i) => <Tag key={i} color="indigo">{t}</Tag>)}
              {c.teaching_objectives.ability?.map((t, i) => <Tag key={i} color="emerald">{t}</Tag>)}
              {c.teaching_objectives.emotion?.map((t, i) => <Tag key={i} color="amber">{t}</Tag>)}
            </Section>
          )}
          {(c.key_points?.length || c.difficult_points?.length) ? (
            <div className="grid grid-cols-2 gap-4">
              {c.key_points?.length ? (
                <Section title="教学重点">
                  {c.key_points.map((p, i) => <BulletItem key={i}>{p}</BulletItem>)}
                </Section>
              ) : null}
              {c.difficult_points?.length ? (
                <Section title="教学难点">
                  {c.difficult_points.map((p, i) => <BulletItem key={i} color="red">{p}</BulletItem>)}
                </Section>
              ) : null}
            </div>
          ) : null}
          {c.teaching_flow?.length ? (
            <Section title="教学流程">
              <div className="space-y-3">
                {c.teaching_flow.map((step, i) => (
                  <div key={i} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="bg-indigo-100 text-indigo-700 text-xs font-medium px-2 py-0.5 rounded-full">{step.stage}</span>
                      <span className="text-xs text-gray-400">{step.duration}</span>
                    </div>
                    <p className="text-sm text-gray-700"><span className="font-medium">教：</span>{step.teacher_activity}</p>
                    <p className="text-sm text-gray-700 mt-1"><span className="font-medium">学：</span>{step.student_activity}</p>
                    {step.design_intent && (
                      <p className="text-xs text-indigo-500 mt-1">意图：{step.design_intent}</p>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          ) : null}
          {c.teaching_tips?.length ? (
            <Section title="教师经验建议">
              {c.teaching_tips.map((tip, i) => <BulletItem key={i} color="amber">{tip}</BulletItem>)}
            </Section>
          ) : null}
          {c.assignments?.length ? (
            <Section title="课后作业">
              {c.assignments.map((a, i) => <BulletItem key={i}>{a}</BulletItem>)}
            </Section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pt-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Tag({ children, color = 'gray' }: { children: React.ReactNode; color?: string }) {
  const cls = color === 'indigo' ? 'bg-indigo-50 text-indigo-700'
    : color === 'emerald' ? 'bg-emerald-50 text-emerald-700'
    : color === 'amber' ? 'bg-amber-50 text-amber-700'
    : 'bg-gray-100 text-gray-600';
  return <span className={`text-xs px-2 py-1 rounded-full ${cls}`}>{children}</span>;
}

function BulletItem({ children, color }: { children: React.ReactNode; color?: string }) {
  const dot = color === 'red' ? 'bg-red-400' : color === 'amber' ? 'bg-amber-400' : 'bg-indigo-400';
  return (
    <div className="flex items-start gap-2 w-full">
      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${dot}`} />
      <p className="text-sm text-gray-700">{children}</p>
    </div>
  );
}
