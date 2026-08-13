const API_BASE = '/api';

function authHeaders(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export interface ReflectionReport {
  overall_assessment?: string;
  strengths?: { point: string; detail: string }[];
  problems?: { point: string; detail: string; root_cause: string }[];
  improvement_suggestions?: { action: string; expected_outcome: string }[];
  student_insights?: string;
  next_lesson_focus?: string[];
  growth_summary?: string;
}

export interface TeachingReflection {
  id: number;
  input_text: string;
  report: ReflectionReport;
  created_at: string;
  agent_id: number | null;
}

export const reflectionApi = {
  generate: async (token: string, data: {
    input_text: string;
    agent_id?: number;
    lesson_topic?: string;
  }): Promise<TeachingReflection> => {
    const res = await fetch(`${API_BASE}/reflections/generate`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  getAll: async (token: string): Promise<TeachingReflection[]> => {
    const res = await fetch(`${API_BASE}/reflections/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  delete: async (token: string, id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/reflections/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(await res.text());
  },
};
