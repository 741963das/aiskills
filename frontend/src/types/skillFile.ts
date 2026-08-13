export interface SkillFile {
  id: number;
  user_id: number;
  name: string;
  description?: string | null;
  content: string;
  source: 'manual' | 'github' | 'marketplace';
  github_source?: { repo: string; path: string; branch: string; commit_sha?: string; raw_url: string } | null;
  status: 'draft' | 'published';
  version: number;
  created_at: string;
  updated_at: string | null;
}

export interface SkillFileCreateData {
  name: string;
  description?: string;
  content: string;
  source?: string;
  github_source?: unknown;
}

export interface SkillFileUpdateData {
  name?: string;
  description?: string;
  content?: string;
  status?: string;
}

export interface SkillFileMarketplaceItem {
  id: number;
  name: string;
  description?: string | null;
  content: string;
  source: string;
  author_id: number;
  author_name?: string;
  usage_count: number;
  created_at: string;
}
