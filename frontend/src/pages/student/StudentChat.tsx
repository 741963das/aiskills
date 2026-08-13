import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { StudentLayout } from '../../components/StudentLayout';
import { AgentChat } from '../../components/AgentChat';
import { agentApi } from '../../services/agentApi';
import type { Agent } from '../../types/agent';
import { ArrowLeft, Loader2 } from 'lucide-react';

const DRAFT_KEY_PREFIX = 'student_chat_draft_';

export function StudentChat() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            />
          </div>
        ) : null}
      </div>
    </StudentLayout>
  );
}