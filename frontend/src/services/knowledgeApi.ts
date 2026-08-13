const API_BASE = '/api/knowledge';

export interface KnowledgeFile {
  id: number;
  agent_id: number | null;
  filename: string;
  status: string;
  progress: number;
  progress_stage: string;
  progress_stage_label: string;
  file_type: string;
  file_size: number;
  chunk_count: number;
  error_message: string | null;
  created_at: string;
}

export interface KnowledgeInfo {
  embedding_model: string;
  collection_name: string;
  total_documents: number;
  done_documents: number;
  processing_documents: number;
  total_chunks: number;
}

export interface SearchResult {
  chunk_index: number;
  content: string;
  similarity: number;
  filename: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total_chunks: number;
}

export const knowledgeApi = {
  upload: async (token: string, file: File, agentId: number): Promise<KnowledgeFile> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/upload?agent_id=${agentId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || '上传失败');
    }
    return response.json();
  },

  list: async (token: string, agentId: number): Promise<KnowledgeFile[]> => {
    const response = await fetch(`${API_BASE}/files?agent_id=${agentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('获取文件列表失败');
    return response.json();
  },

  getStatus: async (token: string, fileId: number): Promise<KnowledgeFile> => {
    const response = await fetch(`${API_BASE}/files/${fileId}/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('获取状态失败');
    return response.json();
  },

  info: async (token: string, agentId: number): Promise<KnowledgeInfo> => {
    const response = await fetch(`${API_BASE}/info?agent_id=${agentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('获取知识库信息失败');
    return response.json();
  },

  delete: async (token: string, fileId: number, agentId: number): Promise<void> => {
    const response = await fetch(`${API_BASE}/files/${fileId}?agent_id=${agentId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('删除失败');
  },

  testSearch: async (token: string, agentId: number, query: string, topK: number = 5): Promise<SearchResponse> => {
    const response = await fetch(`${API_BASE}/test-search?agent_id=${agentId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, top_k: topK }),
    });
    if (!response.ok) throw new Error('检索失败');
    return response.json();
  },
};
