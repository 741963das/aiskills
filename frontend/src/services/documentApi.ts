const API_BASE = '/api/documents';

export interface DocumentHistoryItem {
  id: number;
  doc_type: string;
  topic: string;
  subject: string;
  grade: string;
  file_name: string;
  download_url: string;
  created_at: string | null;
}

export interface GenerateDocumentParams {
  doc_type: 'ppt' | 'word';
  topic: string;
  subject?: string;
  grade?: string;
  slide_count?: number;
  style?: string;
  duration?: string;
  agent_id?: number;
}

export interface GenerateDocumentResponse {
  id: number;
  filename: string;
  download_url: string;
}

export const documentApi = {
  generate: async (token: string, data: GenerateDocumentParams): Promise<GenerateDocumentResponse> => {
    const response = await fetch(`${API_BASE}/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: '生成失败' }));
      throw new Error(err.detail || '生成失败');
    }
    return response.json();
  },

  download: (token: string, docId: number): string => {
    return `${API_BASE}/${docId}/download?token=${encodeURIComponent(token)}`;
  },

  downloadFile: async (token: string, docId: number): Promise<Blob> => {
    const response = await fetch(`${API_BASE}/${docId}/download`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('下载失败');
    return response.blob();
  },

  getHistory: async (token: string, docType?: string): Promise<DocumentHistoryItem[]> => {
    const url = docType ? `${API_BASE}/history?doc_type=${docType}` : `${API_BASE}/history`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('获取历史失败');
    return response.json();
  },
};
