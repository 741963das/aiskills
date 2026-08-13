export interface SubjectNode {
  name: string;
  source: 'user' | 'derived' | 'optional';
  children: string[];
  selected: boolean;
}

export interface CourseInfo {
  course_name: string;
  subject: string;
  department: string;
  grade_level: string;
}

export interface AgentConfig {
  description?: string;
  publishScope?: 'students' | 'teachers';
  major?: string;
  target_job?: string;
  core_skills?: string;
  certifications?: string;
  training_scenarios?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  systemPrompt?: string;
  llmModel?: string;
  topK?: number;
  similarityThreshold?: number;
  role?: string;
  subject?: string;
  audience?: string;
  core_need?: string;
  style?: string;
  coreSubjects?: string[];
  knowledgeFileIds?: number[];
  teaching_style?: string;
  core_chapters?: string[];
  student_difficulties?: string;
  classroom_flow?: string;
  teaching_methods?: string[];
  interactive_methods?: string[];
  common_questions?: string[];
  assessment_method?: string;
  usual_ratio?: number;
  homework_types?: string[];
  textbook?: string;
  reference_books?: string[];
  teaching_tools?: string[];
  course_info?: CourseInfo;
  downloaded_from?: {
    agent_id: number;
    agent_name: string;
    author_name?: string;
    downloaded_at: string;
  };
}

export interface Agent {
  id: number;
  user_id: number;
  name: string;
  course_name: string;
  template: string;
  status: 'draft' | 'testing' | 'published';
  config: AgentConfig;
  version: number;
  created_at: string;
  updated_at: string | null;
}

export interface AgentCreateData {
  name: string;
  course_name: string;
  template?: string;
  config?: AgentConfig;
}

export interface AgentUpdateData {
  name?: string;
  course_name?: string;
  template?: string;
  config?: AgentConfig;
  status?: 'draft' | 'testing' | 'published';
}

export interface AgentMarketplaceItem {
  id: number;
  name: string;
  course_name: string;
  template: string;
  description?: string | null;
  subject?: string | null;
  department?: string | null;
  grade_level?: string | null;
  core_chapters: string[];
  teaching_tools: string[];
  llm_model?: string | null;
  version: number;
  created_at: string;
  updated_at: string | null;
  author_id: number;
  author_name?: string | null;
  author_department?: string | null;
  author_avatar?: string | null;
  usage_count: number;
  rating?: number | null;
  rating_count: number;
  config?: Record<string, unknown>;
}

export interface AgentMarketplacePage {
  items: AgentMarketplaceItem[];
  total: number;
  page: number;
  page_size: number;
}
