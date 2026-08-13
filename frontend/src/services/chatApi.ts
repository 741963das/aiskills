const API_BASE = '/api';

export interface ChatSource {
  file: string;
  chunk: number;
  similarity: number;
}

export interface FileReadyData {
  filename: string;
  download_url: string;
}

export interface ChatResponse {
  answer: string;
  sources: ChatSource[];
  message_id: string;
  conversation_id: number;
}

export interface ConversationInfo {
  id: number;
  title: string;
  created_at: string;
}

export interface MessageInfo {
  id: number;
  role: string;
  content: string;
  sources: ChatSource[];
  feedback: { type: string; comment?: string } | null;
  created_at: string;
}

export const chatApi = {
  sendMessage: async (
    token: string,
    agentId: number,
    message: string,
    onToken: (token: string) => void,
    onSources: (sources: ChatSource[]) => void,
    onDone: (data: { message_id: string; conversation_id: number }) => void,
    onError?: (error: Error) => void,
    onFileReady?: (data: FileReadyData) => void,
    conversationId?: number | null,
  ): Promise<void> => {
    try {
      const body: Record<string, unknown> = { message };
      if (conversationId) {
        body.conversation_id = conversationId;
      }

      const response = await fetch(`${API_BASE}/agents/${agentId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok || !response.body) {
        throw new Error(`请求失败: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';
      let currentData = '';

      const processEvent = () => {
        if (!currentEvent && !currentData) return;
        const dataStr = currentData.trim();
        if (!dataStr) {
          currentEvent = '';
          currentData = '';
          return;
        }
        try {
          if (currentEvent === 'token') {
            const parsed = JSON.parse(dataStr);
            onToken(parsed);
          } else if (currentEvent === 'sources') {
            const parsed = JSON.parse(dataStr);
            onSources(parsed);
          } else if (currentEvent === 'done') {
            const parsed = JSON.parse(dataStr);
            onDone(parsed);
          } else if (currentEvent === 'file_ready') {
            const parsed = JSON.parse(dataStr);
            onFileReady?.(parsed);
          } else if (currentEvent === 'error') {
            const parsed = JSON.parse(dataStr);
            onError?.(new Error(parsed.error || '未知错误'));
          }
        } catch (e) {
          console.warn('SSE parse error:', e, 'raw:', dataStr);
        }
        currentEvent = '';
        currentData = '';
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const eventBlock = buffer.substring(0, idx);
          buffer = buffer.substring(idx + 2);

          const lines = eventBlock.split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            if (trimmed.startsWith('event:')) {
              currentEvent = trimmed.substring(6).trim();
            } else if (trimmed.startsWith('data:')) {
              currentData += trimmed.substring(5).trim();
            }
          }
          processEvent();
        }
      }

      if (currentEvent || currentData) {
        processEvent();
      }
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error('请求失败'));
    }
  },

  listConversations: async (token: string, agentId: number): Promise<ConversationInfo[]> => {
    const response = await fetch(`${API_BASE}/agents/${agentId}/conversations`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('获取对话列表失败');
    return response.json();
  },

  getMessages: async (token: string, conversationId: number): Promise<MessageInfo[]> => {
    const response = await fetch(`${API_BASE}/agents/conversations/${conversationId}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('获取消息失败');
    return response.json();
  },

  deleteConversation: async (token: string, conversationId: number): Promise<void> => {
    const response = await fetch(`${API_BASE}/agents/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('删除对话失败');
  },

  submitFeedback: async (
    token: string,
    messageId: number,
    feedbackType: string,
    comment?: string,
  ): Promise<void> => {
    const response = await fetch(`${API_BASE}/messages/${messageId}/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ feedback_type: feedbackType, comment }),
    });
    if (!response.ok) throw new Error('提交反馈失败');
  },
};