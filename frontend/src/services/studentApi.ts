import type {
  StudentDashboardData,
  StudentCourse,
  StudentProfile,
  MistakeRecord,
  MistakeStats,
  LearningReportData,
} from '../types/auth';

const API_BASE = '/api/student';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export const studentApi = {
  getDashboard: async (token: string): Promise<StudentDashboardData> => {
    const res = await fetch(`${API_BASE}/dashboard`, { headers: authHeaders(token) });
    if (!res.ok) throw new Error('加载学习数据失败');
    return res.json();
  },

  getCourses: async (token: string): Promise<StudentCourse[]> => {
    const res = await fetch(`${API_BASE}/courses`, { headers: authHeaders(token) });
    if (!res.ok) throw new Error('加载课程列表失败');
    const data = await res.json();
    // 后端返回 { items, total }，前端期望 StudentCourse[]
    return data.items || data;
  },

  joinCourse: async (token: string, agentId: number): Promise<{ message: string }> => {
    const res = await fetch(`${API_BASE}/courses/${agentId}/join`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || '加入课程失败');
    }
    return res.json();
  },

  leaveCourse: async (token: string, agentId: number): Promise<{ message: string }> => {
    const res = await fetch(`${API_BASE}/courses/${agentId}/leave`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    if (!res.ok) throw new Error('退出课程失败');
    return res.json();
  },

  // ------- 草稿 -------

  getDrafts: async (token: string): Promise<StudentCourse[]> => {
    const res = await fetch(`${API_BASE}/drafts`, { headers: authHeaders(token) });
    if (!res.ok) throw new Error('加载草稿失败');
    const data = await res.json();
    return data.items || data;
  },

  saveDraft: async (token: string, agentId: number): Promise<{ message: string }> => {
    const res = await fetch(`${API_BASE}/courses/${agentId}/draft`, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || '保存草稿失败');
    }
    return res.json();
  },

  activateDraft: async (token: string, agentId: number): Promise<{ message: string }> => {
    const res = await fetch(`${API_BASE}/courses/${agentId}/activate`, {
      method: 'PUT',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || '激活失败');
    }
    return res.json();
  },

  removeDraft: async (token: string, agentId: number): Promise<{ message: string }> => {
    const res = await fetch(`${API_BASE}/drafts/${agentId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    if (!res.ok) throw new Error('删除草稿失败');
    return res.json();
  },

  getMistakes: async (
    token: string,
    params?: { subject?: string; is_mastered?: boolean; page?: number; page_size?: number },
  ): Promise<{ items: MistakeRecord[]; total: number; page: number; page_size: number }> => {
    const query = new URLSearchParams();
    if (params?.subject) query.set('subject', params.subject);
    if (params?.is_mastered !== undefined) query.set('is_mastered', String(params.is_mastered));
    if (params?.page) query.set('page', String(params.page));
    if (params?.page_size) query.set('page_size', String(params.page_size));
    const res = await fetch(`${API_BASE}/mistakes?${query}`, { headers: authHeaders(token) });
    if (!res.ok) throw new Error('加载错题列表失败');
    return res.json();
  },

  getMistakeStats: async (token: string): Promise<MistakeStats> => {
    const res = await fetch(`${API_BASE}/mistakes/stats`, { headers: authHeaders(token) });
    if (!res.ok) throw new Error('加载错题统计失败');
    return res.json();
  },

  markMastered: async (token: string, id: number): Promise<{ message: string }> => {
    const res = await fetch(`${API_BASE}/mistakes/${id}/mastered`, {
      method: 'PUT',
      headers: authHeaders(token),
    });
    if (!res.ok) throw new Error('标记失败');
    return res.json();
  },

  getReport: async (token: string): Promise<LearningReportData> => {
    const res = await fetch(`${API_BASE}/report`, { headers: authHeaders(token) });
    if (!res.ok) throw new Error('加载学习报告失败');
    return res.json();
  },

  getProfile: async (token: string): Promise<StudentProfile> => {
    const res = await fetch(`${API_BASE}/profile`, { headers: authHeaders(token) });
    if (!res.ok) throw new Error('加载档案失败');
    return res.json();
  },

  updateProfile: async (token: string, data: Partial<StudentProfile>): Promise<StudentProfile> => {
    const res = await fetch(`${API_BASE}/profile`, {
      method: 'PUT',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('更新档案失败');
    return res.json();
  },

  getRecommendations: async (token: string): Promise<StudentCourse[]> => {
    const res = await fetch(`${API_BASE}/recommendations`, { headers: authHeaders(token) });
    if (!res.ok) throw new Error('加载推荐失败');
    return res.json();
  },
};
