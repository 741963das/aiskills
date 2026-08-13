const API_BASE = '/api';

function authH(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export interface AgentStat {
  agent_id: number;
  name: string;
  course_name: string;
  status: string;
  student_count: number;
  conversation_count: number;
  mistake_count: number;
}

export interface AnalyticsOverview {
  total_students: number;
  total_conversations: number;
  total_mistakes: number;
  unmastered_mistakes: number;
  agents: AgentStat[];
}

export interface WeakPoint { knowledge_point: string; count: number }
export interface ErrorTypeDist { error_type: string; count: number }

export interface ClassAnalytics {
  agent_id: number;
  agent_name: string;
  course_name: string;
  student_count: number;
  conversation_count: number;
  mistake_summary: { total: number; mastered: number; unmastered: number; mastery_rate: number };
  top_weak_points: WeakPoint[];
  error_type_distribution: ErrorTypeDist[];
  subject_distribution: { subject: string; count: number }[];
}

export interface KnowledgeNode {
  knowledge_point: string;
  total_mistakes: number;
  unmastered: number;
  mastery_rate: number;
  subjects: string[];
  severity: 'high' | 'medium' | 'low';
}

export const analyticsApi = {
  getOverview: async (token: string): Promise<AnalyticsOverview> => {
    const res = await fetch(`${API_BASE}/analytics/overview`, { headers: authH(token) });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getClass: async (token: string, agentId: number): Promise<ClassAnalytics> => {
    const res = await fetch(`${API_BASE}/analytics/class/${agentId}`, { headers: authH(token) });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getKnowledgeMap: async (token: string, agentId?: number): Promise<{ nodes: KnowledgeNode[] }> => {
    const url = agentId
      ? `${API_BASE}/analytics/knowledge-map?agent_id=${agentId}`
      : `${API_BASE}/analytics/knowledge-map`;
    const res = await fetch(url, { headers: authH(token) });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};
