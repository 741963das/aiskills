export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
  display_name: string | null;
  department: string | null;
  is_active: boolean;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  role?: string;
  display_name?: string;
  department?: string;
}

export interface LoginData {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: string;
}

export interface UpdateProfileData {
  role?: string;
  display_name?: string;
  department?: string;
}

export interface StudentProfile {
  id: number;
  student_id: number;
  grade: string | null;
  major: string | null;
  subjects_of_interest: string | null;
  learning_goal: string | null;
  preferred_time: string | null;
}

export interface MistakeRecord {
  id: number;
  student_id: number;
  agent_id: number;
  conversation_id: number | null;
  subject: string | null;
  knowledge_point: string | null;
  question: string;
  student_answer: string | null;
  correct_answer: string | null;
  explanation: string | null;
  error_type: string | null;
  difficulty: string;
  is_mastered: boolean;
  review_count: number;
  last_reviewed_at: string | null;
  created_at: string;
}

export interface StudentDashboardData {
  learning_days: number;
  chat_count: number;
  course_count: number;
  mistake_count: number;
  unmastered_mistakes: number;
}

export interface StudentCourse {
  agent_id: number;
  name: string;
  course_name: string;
  subject: string;
  template: string;
  status: string;
  description?: string | null;
  joined_at: string;
  saved_at?: string;
  last_accessed_at: string | null;
}

export interface MistakeStats {
  by_subject: Record<string, number>;
  by_error_type: Record<string, number>;
  by_knowledge_point: Record<string, number>;
  total: number;
  mastered: number;
  unmastered: number;
}

export interface LearningReportData {
  duration_trend: Array<{ date: string; seconds: number }>;
  mastery_by_subject: Array<{ subject: string; mastery_rate: number }>;
  weak_points: Array<{ knowledge_point: string; error_count: number; subject: string }>;
  total_learning_seconds: number;
  total_mistakes: number;
  mastered_mistakes: number;
}