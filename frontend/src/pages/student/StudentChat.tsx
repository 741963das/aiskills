import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { StudentLayout } from '../../components/StudentLayout';
import { AgentChat } from '../../components/AgentChat';
import { agentApi } from '../../services/agentApi';
import type { Agent } from '../../types/agent';
import type { AgentQuestion } from '../../services/agentApi';
import { ArrowLeft, Loader2, MessageCircleQuestion, CheckCircle2 } from 'lucide-react';

const DRAFT_KEY_PREFIX = 'student_chat_draft_';

export function StudentChat() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<AgentQuestion[]>([]);

  const agentId = id ? parseInt(id, 10) : 0;
  const draftKey = `${DRAFT_KEY_PREFIX}${agentId}`;

  // 恢复草稿消息
  const getDraft = (): string => {
    try {
      return localStorage.getItem(draftKey) || '';
    } catch (err) {
      console.error('Failed to load draft:', err);
      return '';
    }
  };

  // 清除草稿消息
  const clearDraft = () => {
    try {
      localStorage.removeItem(draftKey);
    } catch (err) {
      console.error('Failed to clear draft:', err);
    }
  };

  useEffect(() => {
    if (!token || !agentId) return;
    setLoading(true);
    agentApi.getById(token, agentId)
      .then((data) => setAgent(data))
      .catch(() => setError('无法加载该课程'))
      .finally(() => setLoading(false));
  }, [token, agentId]);

  // 查询该学生在当前助手下的疑问记录
  const refreshQuestions = useCallback(() => {
    if (!token || !agentId) return;
    agentApi.getMyQuestions(token, agentId)
      .then((data) => setQuestions(data.items || []))
      .catch(() => setQuestions([]));
  }, [token, agentId]);

  // 组件挂载时查询一次
  useEffect(() => {
    refreshQuestions();
  }, [refreshQuestions]);

  const hasOpen = questions.some((q) => q.status === 'open');
  const hasAnswered = questions.some((q) => q.status === 'answered');

  return (
    <StudentLayout>
      <div className="space-y-4">
        {/* 返回按钮 */}
        <button
          onClick={() => navigate('/student/courses')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回课程列表
        </button>

        {/* 待答疑提示条（页面顶部） */}
        {hasOpen && (
          <div className="flex items-center gap-2 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-xl px-4 py-3 text-sm">
            <MessageCircleQuestion className="w-4 h-4 shrink-0" />
            <span>你的问题已提交至待答疑池，等待教师解答</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-cyan-600 animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl">{error}</div>
        ) : agent ? (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h1 className="text-lg font-bold text-gray-900">{agent.name}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{agent.course_name || agent.template}</p>
            </div>
            <AgentChat
              token={token!}
              agentId={agentId}
              agentName={agent.name}
              publishScope="students"
              onDraftSave={clearDraft}
              draftKey={draftKey}
              initialDraft={getDraft()}
              onMessageComplete={refreshQuestions}
            />
          </div>
        ) : null}

        {/* 教师已解答提示条（页面底部） */}
        {hasAnswered && (
          <div className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 rounded-xl px-4 py-3 text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>教师已解答你的问题，点击查看详情</span>
          </div>
        )}
      </div>
    </StudentLayout>
  );
}