import { useState, useEffect } from 'react';
import { Lightbulb, Sparkles, Trash2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { TeacherLayout } from '../components/TeacherLayout';
import { useAuth } from '../contexts/AuthContext';
import { reflectionApi, type TeachingReflection } from '../services/reflectionApi';
import { agentApi } from '../services/agentApi';
import type { Agent } from '../types/agent';

export function TeachingReflectionPage() {
  const { token } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [records, setRecords] = useState<TeachingReflection[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ input_text: '', agent_id: '', lesson_topic: '' });

  useEffect(() => {
    if (!token) return;
    agentApi.getAll(token).then(setAgents).catch(() => {});
    reflectionApi.getAll(token).then(setRecords).catch(() => {});
  }, [token]);

  const handleGenerate = async () => {
    if (!form.input_text.trim()) {
      setError('请输入课后感受');
      return;
    }
    setIsGenerating(true);
    setError(null);
    try {
      const record = await reflectionApi.generate(token!, {
        input_text: form.input_text,
        agent_id: form.agent_id ? Number(form.agent_id) : undefined,
        lesson_topic: form.lesson_topic || undefined,
      });
      setRecords((prev) => [record, ...prev]);
      setExpanded(record.id);
      setForm({ input_text: '', agent_id: '', lesson_topic: '' });
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    await reflectionApi.delete(token, id).catch(() => {});
    setRecords((prev) => prev.filter((r) => r.id !== id));
    if (expanded === id) setExpanded(null);
  };

  return (
    <TeacherLayout>
      <div className="max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
            <Lightbulb className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-indigo-950">教学反思助手</h1>
            <p className="text-sm text-gray-500 mt-0.5">课后随手记录感受，AI 自动生成深度教学反思报告</p>
          </div>
        </div>

        {/* 输入区 */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
          <h2 className="font-semibold text-indigo-950 mb-4">记录课后感受</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">课程主题（选填）</label>
              <input
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="例如：函数概念第一课时"
                value={form.lesson_topic}
                onChange={(e) => setForm({ ...form, lesson_topic: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">关联助手（选填）</label>
              <select
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.agent_id}
                onChange={(e) => setForm({ ...form, agent_id: e.target.value })}
              >
                <option value="">不关联</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">课后感受 *</label>
            <textarea
              rows={5}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              placeholder="用自然语言记录即可，例如：今天这节课讲函数概念，感觉学生对定义域的理解还是比较模糊，课堂互动还行但节奏有点快，课后有几个同学来问问题..."
              value={form.input_text}
              onChange={(e) => setForm({ ...form, input_text: e.target.value })}
            />
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="mt-4 flex items-center gap-2 bg-amber-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-60 cursor-pointer"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isGenerating ? 'AI 正在生成反思报告...' : '生成教学反思报告'}
          </button>
        </div>

        {/* 历史记录 */}
        {records.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-indigo-950">反思记录</h2>
            {records.map((rec) => (
              <ReflectionCard
                key={rec.id}
                record={rec}
                expanded={expanded === rec.id}
                onToggle={() => setExpanded(expanded === rec.id ? null : rec.id)}
                onDelete={() => handleDelete(rec.id)}
              />
            ))}
          </div>
        )}

        {records.length === 0 && !isGenerating && (
          <div className="text-center py-16 text-gray-400">
            <Lightbulb className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">还没有反思记录，在上方写下今日感受吧</p>
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}

function ReflectionCard({ record, expanded, onToggle, onDelete }: {
  record: TeachingReflection;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const r = record.report;
  const preview = record.input_text.slice(0, 80) + (record.input_text.length > 80 ? '...' : '');

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div
        className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
            <Lightbulb className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <p className="text-sm text-gray-700 leading-snug">{preview}</p>
            <p className="text-xs text-gray-400 mt-1">{new Date(record.created_at).toLocaleString('zh-CN')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-3">
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
        <div className="px-5 pb-5 border-t border-gray-50 space-y-4 pt-4">
          {r.overall_assessment && (
            <div className="bg-indigo-50 rounded-lg px-4 py-3 text-sm text-indigo-800">
              {r.overall_assessment}
            </div>
          )}

          {r.strengths?.length ? (
            <ReportSection title="本节课优点" color="emerald">
              {r.strengths.map((s, i) => (
                <div key={i} className="mb-2">
                  <p className="text-sm font-medium text-emerald-700">{s.point}</p>
                  <p className="text-xs text-gray-600">{s.detail}</p>
                </div>
              ))}
            </ReportSection>
          ) : null}

          {r.problems?.length ? (
            <ReportSection title="存在的问题" color="red">
              {r.problems.map((p, i) => (
                <div key={i} className="mb-2">
                  <p className="text-sm font-medium text-red-700">{p.point}</p>
                  <p className="text-xs text-gray-600">{p.detail}</p>
                  {p.root_cause && <p className="text-xs text-red-500 mt-0.5">根因：{p.root_cause}</p>}
                </div>
              ))}
            </ReportSection>
          ) : null}

          {r.improvement_suggestions?.length ? (
            <ReportSection title="改进建议" color="amber">
              {r.improvement_suggestions.map((s, i) => (
                <div key={i} className="mb-2">
                  <p className="text-sm font-medium text-amber-700">{s.action}</p>
                  <p className="text-xs text-gray-600">{s.expected_outcome}</p>
                </div>
              ))}
            </ReportSection>
          ) : null}

          {r.student_insights && (
            <ReportSection title="学情判断" color="blue">
              <p className="text-sm text-gray-700">{r.student_insights}</p>
            </ReportSection>
          )}

          {r.next_lesson_focus?.length ? (
            <ReportSection title="下节课重点关注" color="purple">
              <ul className="space-y-1">
                {r.next_lesson_focus.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="text-purple-500 font-bold mt-0.5">›</span>{f}
                  </li>
                ))}
              </ul>
            </ReportSection>
          ) : null}

          {r.growth_summary && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg px-4 py-3 text-sm text-indigo-700 italic">
              {r.growth_summary}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const colorMap: Record<string, string> = {
  emerald: 'text-emerald-700 border-emerald-200',
  red: 'text-red-700 border-red-200',
  amber: 'text-amber-700 border-amber-200',
  blue: 'text-blue-700 border-blue-200',
  purple: 'text-purple-700 border-purple-200',
};

function ReportSection({ title, color = 'gray', children }: { title: string; color?: string; children: React.ReactNode }) {
  const cls = colorMap[color] || 'text-gray-700 border-gray-200';
  return (
    <div className={`border-l-2 pl-4 ${cls}`}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-2">{title}</p>
      {children}
    </div>
  );
}
