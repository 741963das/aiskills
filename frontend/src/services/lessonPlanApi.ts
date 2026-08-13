const API_BASE = '/api';

function authHeaders(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export interface LessonPlanContent {
  title?: string;
  teaching_objectives?: { knowledge: string[]; ability: string[]; emotion: string[] };
  key_points?: string[];
  difficult_points?: string[];
  teaching_methods?: string[];
  teaching_flow?: { stage: string; duration: string; teacher_activity: string; student_activity: string; design_intent: string }[];
  assignments?: string[];
  teaching_tips?: string[];
  resources?: string[];
}

export interface LessonPlan {
  id: number;
  title: string;
  subject: string;
  grade: string | null;
  topic: string;
  duration: string | null;
  student_count: number | null;
  content: LessonPlanContent;
  created_at: string;
  agent_id: number | null;
}

export const lessonPlanApi = {
  generate: async (token: string, data: {
    topic: string;
    subject: string;
    grade?: string;
    duration?: string;
    student_count?: number;
    agent_id?: number;
    extra_requirements?: string;
  }): Promise<LessonPlan> => {
    const res = await fetch(`${API_BASE}/lesson-plans/generate`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getAll: async (token: string): Promise<LessonPlan[]> => {
    const res = await fetch(`${API_BASE}/lesson-plans/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getById: async (token: string, id: number): Promise<LessonPlan> => {
    const res = await fetch(`${API_BASE}/lesson-plans/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  delete: async (token: string, id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/lesson-plans/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await res.text());
  },
};
