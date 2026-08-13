import type { Agent, AgentCreateData, AgentUpdateData, AgentMarketplacePage, AgentMarketplaceItem } from '../types/agent';

const API_BASE = '/api/agents';

function getAuthHeaders(token: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export interface MarketplaceQuery {
  keyword?: string;
  template?: string;
  subject?: string;
  sort?: 'newest' | 'popular' | 'name';
  scope?: 'students' | 'teachers';
  page?: number;
  page_size?: number;
}

export interface AgentQuestion {
  id: number;
  agent_id: number;
  student_id: number;
  student_name?: string | null;
  conversation_id?: number | null;
  question: string;
  ai_answer?: string | null;
  teacher_reply?: string | null;
  pain_point?: string | null;
  subject?: string | null;
  status: string;
  created_at?: string | null;
  answered_at?: string | null;
}

export const agentApi = {
  getAll: async (token: string, status?: string): Promise<Agent[]> => {
    const url = status ? `${API_BASE}/?status=${status}` : `${API_BASE}/`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to fetch agents');
    return response.json();
  },

  getById: async (token: string, id: number): Promise<Agent> => {
    const response = await fetch(`${API_BASE}/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Agent not found');
    return response.json();
  },

  create: async (token: string, data: AgentCreateData): Promise<Agent> => {
    const response = await fetch(`${API_BASE}/`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create agent');
    return response.json();
  },

  update: async (token: string, id: number, data: AgentUpdateData): Promise<Agent> => {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(token),
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update agent');
    return response.json();
  },

  publish: async (token: string, id: number): Promise<Agent> => {
    const response = await fetch(`${API_BASE}/${id}/publish`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Failed to publish agent');
    return response.json();
  },

  downloadAgent: async (token: string, agentId: number): Promise<Agent> => {
    const response = await fetch(`${API_BASE}/${agentId}/download`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: '下载失败' }));
      throw new Error(err.detail || '下载失败');
    }
    return response.json();
  },

  // ------- 市场 -------

  getMarketplace: async (token: string, query: MarketplaceQuery = {}): Promise<AgentMarketplacePage> => {
    const params = new URLSearchParams();
    if (query.keyword) params.set('keyword', query.keyword);
    if (query.template) params.set('template', query.template);
    if (query.subject) params.set('subject', query.subject);
    if (query.sort) params.set('sort', query.sort);
    if (query.scope) params.set('scope', query.scope);
    if (query.page) params.set('page', String(query.page));
    if (query.page_size) params.set('page_size', String(query.page_size));
    const qs = params.toString();
    const url = qs ? `${API_BASE}/marketplace?${qs}` : `${API_BASE}/marketplace`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('获取市场列表失败');
    return response.json();
  },

  getMarketplaceSubjects: async (token: string, scope?: 'students' | 'teachers'): Promise<string[]> => {
    const url = scope ? `${API_BASE}/marketplace/subjects?scope=${scope}` : `${API_BASE}/marketplace/subjects`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('获取学科列表失败');
    return response.json();
  },

  getMarketplaceAgent: async (token: string, id: number): Promise<AgentMarketplaceItem> => {
    const response = await fetch(`${API_BASE}/marketplace/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('获取市场详情失败');
    return response.json();
  },

  generatePrompt: async (
    token: string,
    data: {
      template: 'higher_edu' | 'vocational';
      role: string;
      subject?: string;
      audience?: string;
      major?: string;
      target_job?: string;
      core_skills?: string;
      certifications?: string;
      training_scenarios?: string;
      core_need: string;
      style?: string;
      publish_scope?: 'students' | 'teachers';
    },
  ): Promise<{ prompt: string }> => {
    const response = await fetch(`${API_BASE}/generate-prompt`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: '生成 Prompt 失败' }));
      throw new Error(err.detail || '生成 Prompt 失败');
    }
    return response.json();
  },

  optimizePrompt: async (
    token: string,
    data: { current_prompt: string; feedback: string },
  ): Promise<{ optimized_prompt: string }> => {
    const response = await fetch(`${API_BASE}/optimize-prompt`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: '优化 Prompt 失败' }));
      throw new Error(err.detail || '优化 Prompt 失败');
    }
    return response.json();
  },

  getStats: async (token: string): Promise<{
    total_skills: number;
    published_count: number;
    draft_count: number;
    total_conversations: number;
  }> => {
    const response = await fetch(`${API_BASE}/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('获取统计失败');
    return response.json();
  },

  generateCourseware: async (
    token: string,
    agentId: number,
    data: { topic: string; format: 'word' | 'ppt'; audience?: string; requirements?: string },
  ): Promise<Blob> => {
    const response = await fetch(`${API_BASE}/${agentId}/generate-courseware`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: '生成课件失败' }));
      throw new Error(err.detail || '生成课件失败');
    }
    return response.blob();
  },

  // ------- v3.0 结构化配置 -------

  generateStructuredConfig: async (
    token: string,
    data: {
      template: 'higher_edu' | 'vocational';
      publish_scope: 'students' | 'teachers';
      role: string;
      subject?: string;
      course_name?: string;
      audience_level?: string;
      audience_detail?: string[];
      core_tasks: string[];
      style: string;
      student_pain_points?: string;
      major?: string;
      target_job?: string;
      core_skills?: string;
    },
  ): Promise<{
    fallback: boolean;
    modules: Record<string, { title: string; content: string; items?: string[]; rules?: string[]; diagnosis?: { pain_points: unknown[] } }>;
    system_prompt: string;
  }> => {
    const response = await fetch(`${API_BASE}/generate-structured-config`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: '生成结构化配置失败' }));
      throw new Error(err.detail || '生成结构化配置失败');
    }
    return response.json();
  },

  regenerateModule: async (
    token: string,
    data: {
      module_name: string;
      template: 'higher_edu' | 'vocational';
      publish_scope: 'students' | 'teachers';
      role: string;
      subject?: string;
      course_name?: string;
      audience_level?: string;
      core_tasks: string[];
      style: string;
      student_pain_points?: string;
      major?: string;
      target_job?: string;
      core_skills?: string;
      current_modules: Record<string, unknown>;
    },
  ): Promise<{
    module: { title: string; content: string; items?: string[]; rules?: string[]; diagnosis?: { pain_points: unknown[] } };
    system_prompt: string;
  }> => {
    const response = await fetch(`${API_BASE}/regenerate-module`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: '模块重新生成失败' }));
      throw new Error(err.detail || '模块重新生成失败');
    }
    return response.json();
  },

  // ------- v3.0 五层经验导出 -------

  exportTeachingStrategy: async (
    token: string,
    agentId: number,
    layers: string[] = ['knowledge', 'diagnosis', 'strategy', 'interaction', 'feedback'],
  ): Promise<{ id: number; name: string; content: string }> => {
    const response = await fetch(`${API_BASE}/${agentId}/export-teaching-strategy`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ layers }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: '导出教学经验失败' }));
      throw new Error(err.detail || '导出教学经验失败');
    }
    return response.json();
  },

  // ------- v3.0 五层经验被动积累 -------

  getFiveLayerKnowledge: async (
    token: string,
    agentId: number,
  ): Promise<{
    five_layer: Record<string, unknown>;
    stats: Record<string, number>;
  }> => {
    const response = await fetch(`${API_BASE}/${agentId}/five-layer-knowledge`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('获取五层经验失败');
    return response.json();
  },

  extractKnowledge: async (
    token: string,
    agentId: number,
    fileIds: number[] = [],
  ): Promise<{
    message: string;
    extracted_count: number;
    file_count: number;
    knowledge_layer: Record<string, unknown>;
  }> => {
    const response = await fetch(`${API_BASE}/${agentId}/extract-knowledge`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ file_ids: fileIds }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: '知识点提取失败' }));
      throw new Error(err.detail || '知识点提取失败');
    }
    return response.json();
  },

  analyzeCorrection: async (
    token: string,
    agentId: number,
    data: {
      original_answer: string;
      corrected_answer: string;
      student_question?: string;
      subject_label?: string;
    },
  ): Promise<{
    message: string;
    diagnosis_count: number;
    strategy_count: number;
    analysis: Record<string, unknown>;
  }> => {
    const response = await fetch(`${API_BASE}/${agentId}/analyze-correction`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: '纠正分析失败' }));
      throw new Error(err.detail || '纠正分析失败');
    }
    return response.json();
  },

  deleteFiveLayerEntry: async (
    token: string,
    agentId: number,
    layer: string,
    index: number,
  ): Promise<{ message: string; remaining_count: number }> => {
    const response = await fetch(`${API_BASE}/${agentId}/five-layer-knowledge/${layer}/${index}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: '删除条目失败' }));
      throw new Error(err.detail || '删除条目失败');
    }
    return response.json();
  },

  // ------- v4.1 师生问答沉淀：教师待答疑池 -------

  getAgentQuestions: async (
    token: string,
    agentId: number,
    status?: string,
  ): Promise<{ items: AgentQuestion[]; total: number }> => {
    const url = status
      ? `${API_BASE}/${agentId}/questions?status=${status}`
      : `${API_BASE}/${agentId}/questions`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: '获取学生疑问失败' }));
      throw new Error(err.detail || '获取学生疑问失败');
    }
    return response.json();
  },

  answerAgentQuestion: async (
    token: string,
    agentId: number,
    questionId: number,
    reply: string,
  ): Promise<{ message: string; question_id: number; status: string }> => {
    const response = await fetch(`${API_BASE}/${agentId}/questions/${questionId}/answer`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ reply }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: '提交解答失败' }));
      throw new Error(err.detail || '提交解答失败');
    }
    return response.json();
  },

  // ------- 学生端：我的疑问记录状态 -------

  getMyQuestions: async (
    token: string,
    agentId: number,
  ): Promise<{ items: AgentQuestion[]; total: number }> => {
    const response = await fetch(`/api/student/questions?agent_id=${agentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: '获取疑问记录失败' }));
      throw new Error(err.detail || '获取疑问记录失败');
    }
    return response.json();
  },
};
