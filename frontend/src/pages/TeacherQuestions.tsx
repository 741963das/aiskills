import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TeacherLayout } from '../components/TeacherLayout';
import { agentApi, type AgentQuestion } from '../services/agentApi';
import type { Agent } from '../types/agent';
import { MessageSquare, Send, Loader2, CheckCircle2, Clock, Users, BookOpen } from 'lucide-react';

type Tab = 'open' | 'answered';

export function TeacherQuestions() {
  const { token } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('open');
  const [questions, setQuestions] = useState<AgentQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyMap, setReplyMap] = useState<Record<number, string>>({});
  const [answeringId, setAnsweringId] = useState<number | null>(null);

  useEffect(() => {
    if (!token) return;
    setAgentsLoading(true);
    agentApi.getAll(token)
      .then((list) => {
        setAgents(list);
        if (list.length > 0) setSelectedAgentId(list[0].id);
      })
      .catch(() => setError('加载助手列表失败'))
      .finally(() => setAgentsLoading(false));
  }, [token]);

  const loadQuestions = async (agentId: number, status: string) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await agentApi.getAgentQuestions(token, agentId, status);
      setQuestions(data.items || []);
    } catch (e) {
      setError((e as Error).message || '加载学生疑问失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAgentId) {
      loadQuestions(selectedAgentId, tab);
    }
  }, [selectedAgentId, tab]);

  const handleAnswer = async (q: AgentQuestion) => {
    if (!token || !selectedAgentId) return;
    const reply = (replyMap[q.id] || '').trim();
    if (!reply) {
      setError('请填写解答内容');
      return;
    }
    setAnsweringId(q.id);
    setError(null);
    try {
      await agentApi.answerAgentQuestion(token, selectedAgentId, q.id, reply);
      setReplyMap((m) => ({ ...m, [q.id]: '' }));
      await loadQuestions(selectedAgentId, tab);
    } catch (e) {
      setError((e as Error).message || '提交解答失败');
    } finally {
      setAnsweringId(null);
    }
  };

  const formatTime = (t?: string | null) => {
    if (!t) return '';
    try {
      return new Date(t).toLocaleString('zh-CN', { hour12: false });
    } catch {
      return t;
    }
  };

  return (
    <TeacherLayout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-indigo-600" />
              学生疑问 · 待答疑池
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              学生真实提问进入这里，教师解答后自动沉淀为教学经验
            </p>
          </div>
        </div>

        {/* 助手选择 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <label className="block text-sm font-medium text-gray-600 mb-2">选择助手</label>
          {agentsLoading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> 加载中...
            </div>
          ) : agents.length === 0 ? (
            <p className="text-sm text-gray-400">暂无助手</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {agents.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedAgentId(a.id)}
                  className={
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ' +
                    (selectedAgentId === a.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200')
                  }
                >
                  {a.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 标签切换 */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setTab('open')}
            className={
              'px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer ' +
              (tab === 'open' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50')
            }
          >
            <Clock className="w-4 h-4" /> 待答疑
          </button>
          <button
            onClick={() => setTab('answered')}
            className={
              'px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer ' +
              (tab === 'answered' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50')
            }
          >
            <CheckCircle2 className="w-4 h-4" /> 已解答
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
        )}

        {/* 疑问列表 */}
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> 加载中...
          </div>
        ) : questions.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
            <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              {tab === 'open' ? '暂无待解答的学生疑问' : '暂无已解答的疑问'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              学生端在学习过程中暴露困惑时，会自动进入这里
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((q) => (
              <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span className={'px-2 py-0.5 rounded-full text-xs font-medium ' + (q.status === 'open' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700')}>
                      {q.status === 'open' ? '待答疑' : '已解答'}
                    </span>
                    <span className="text-gray-500 flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> {q.student_name || ('学生#' + q.student_id)}
                    </span>
                    {q.subject && (
                      <span className="text-gray-400 flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5" /> {q.subject}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{formatTime(q.created_at)}</span>
                </div>

                {q.pain_point && (
                  <div className="mb-3 px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 text-sm">
                    <span className="font-medium">痛点：</span>{q.pain_point}
                  </div>
                )}

                <div className="mb-3">
                  <p className="text-xs font-medium text-gray-400 mb-1">学生疑问</p>
                  <p className="text-gray-800 bg-gray-50 rounded-lg p-3 text-sm whitespace-pre-wrap">{q.question}</p>
                </div>

                {q.ai_answer && tab === 'open' && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-gray-400 mb-1">AI 初步回答</p>
                    <p className="text-gray-500 bg-gray-50 rounded-lg p-3 text-sm whitespace-pre-wrap line-clamp-4">{q.ai_answer}</p>
                  </div>
                )}

                {q.status === 'answered' ? (
                  <div>
                    <p className="text-xs font-medium text-gray-400 mb-1">教师解答</p>
                    <p className="text-gray-800 bg-green-50 rounded-lg p-3 text-sm whitespace-pre-wrap">{q.teacher_reply}</p>
                    {q.answered_at && (
                      <p className="text-xs text-gray-400 mt-2">解答时间：{formatTime(q.answered_at)}</p>
                    )}
                  </div>
                ) : (
                  <div>
                    <textarea
                      value={replyMap[q.id] || ''}
                      onChange={(e) => setReplyMap((m) => ({ ...m, [q.id]: e.target.value }))}
                      placeholder="请给出你的解决方案，提交后将自动沉淀为教学经验..."
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={() => handleAnswer(q)}
                        disabled={answeringId === q.id}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                      >
                        {answeringId === q.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        提交解答并沉淀
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}