import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, ThumbsUp, Wrench, FileText, Bot, User, Download, Presentation, MessageSquare, Trash2, Plus, Edit3, X } from 'lucide-react';
import { chatApi, type ChatSource, type FileReadyData, type ConversationInfo } from '../services/chatApi';
import { agentApi } from '../services/agentApi';
import { MarkdownRenderer } from './MarkdownRenderer';

interface Message {
  id?: number | string;
  role: 'user' | 'assistant';
  content: string;
  sources?: ChatSource[];
  feedback?: { type: string; comment?: string } | null;
  streaming?: boolean;
  file?: FileReadyData;
}

interface Props {
  token: string;
  agentId: number;
  agentName: string;
  initialConversationId?: number | null;
  onConversationCreated?: (conversationId: number) => void;
  onMessageFeedback?: (messageId: number, feedbackType: string) => void;
  agentStatus?: string;
  publishScope?: 'students' | 'teachers';
  draftKey?: string;
  initialDraft?: string;
  onDraftSave?: () => void;
}

export function AgentChat({
  token,
  agentId,
  agentName,
  initialConversationId = null,
  onConversationCreated,
  onMessageFeedback,
  agentStatus = 'draft',
  publishScope = 'students',
  draftKey,
  initialDraft,
  onDraftSave,
}: Props) {
  const isTeacherScope = publishScope === 'teachers';
  const headerLabel = isTeacherScope ? '教师助手对话界面' : '模拟学生对话界面';
  const emptyHintTitle = isTeacherScope ? '这是教师将使用的对话界面' : '这是学生将看到的对话界面';
  const emptyHintDesc = isTeacherScope ? '输入问题开始与 AI 教学助手对话' : '输入问题测试助手效果';

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialDraft || '');
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(initialConversationId);
  const [feedbackMsgId, setFeedbackMsgId] = useState<number | null>(null);
  void feedbackMsgId;
  // 纠正分析
  const [correctingMessageId, setCorrectingMessageId] = useState<number | null>(null);
  const [correctionText, setCorrectionText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 草稿自动保存（输入变化时延迟保存到 localStorage）
  const handleInputChange = (value: string) => {
    setInput(value);
    if (!draftKey) return;
    // 清除之前的定时器
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current);
    }
    // 延迟 500ms 保存
    draftTimerRef.current = setTimeout(() => {
      try {
        if (value.trim()) {
          localStorage.setItem(draftKey, value);
        } else {
          localStorage.removeItem(draftKey);
        }
      } catch {
        // 忽略
      }
    }, 500);
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (draftTimerRef.current) {
        clearTimeout(draftTimerRef.current);
      }
    };
  }, []);

  // 对话历史
  const [conversations, setConversations] = useState<ConversationInfo[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 加载对话列表
  const loadConversations = useCallback(async () => {
    if (!token || !agentId) return;
    setIsLoadingConversations(true);
    try {
      const list = await chatApi.listConversations(token, agentId);
      setConversations(list);
    } catch {
      setConversations([]);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [token, agentId]);

  // 加载某个对话的消息
  const loadConversationMessages = useCallback(async (convId: number) => {
    if (!token) return;
    setIsLoadingMessages(true);
    setConversationId(convId);
    try {
      const msgs = await chatApi.getMessages(token, convId);
      setMessages(
        msgs.map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          sources: m.sources || [],
          feedback: m.feedback,
          streaming: false,
          file: undefined,
        }))
      );
    } catch {
      setMessages([]);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [token]);

  // 开始新对话
  const startNewConversation = () => {
    setConversationId(null);
    setMessages([]);
  };

  // 删除对话
  const handleDeleteConversation = async (convId: number) => {
    if (!token) return;
    try {
      await chatApi.deleteConversation(token, convId);
      if (convId === conversationId) {
        setConversationId(null);
        setMessages([]);
      }
      await loadConversations();
    } catch {
      // 静默失败
    }
  };

  // 组件 mount 时加载对话列表
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // 如果有历史对话但没有选中对话，自动加载最近一条
  useEffect(() => {
    if (conversations.length > 0 && !conversationId && messages.length === 0) {
      loadConversationMessages(conversations[0].id);
    }
  }, [conversations, conversationId, messages.length, loadConversationMessages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    setIsSending(true);
    const userMsg: Message = { role: 'user', content: text };
    const aiMsg: Message = { role: 'assistant', content: '', streaming: true };

    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setInput('');
    // 清除草稿
    if (draftKey) {
      try { localStorage.removeItem(draftKey); } catch { /* 忽略 */ }
    }
    onDraftSave?.();

    let currentSources: ChatSource[] = [];

    await chatApi.sendMessage(
      token,
      agentId,
      text,
      (tokenChunk) => {
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1 && m.streaming
              ? { ...m, content: m.content + tokenChunk }
              : m
          )
        );
      },
      (sources) => {
        currentSources = sources;
      },
      (done) => {
        setConversationId(done.conversation_id);
        onConversationCreated?.(done.conversation_id);
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1
              ? { ...m, streaming: false, sources: currentSources, id: done.message_id }
              : m
          )
        );
        loadConversations();
      },
      (err) => {
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1
              ? { ...m, streaming: false, content: `错误: ${err.message}` }
              : m
          )
        );
      },
      (fileData) => {
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1
              ? { ...m, file: fileData }
              : m
          )
        );
      },
      conversationId
    );

    setIsSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCorrection = async () => {
    if (!token || !agentId || !correctingMessageId || !correctionText.trim()) return;

    const targetMsg = messages.find((m) => m.id === correctingMessageId);
    if (!targetMsg) return;

    const targetIndex = messages.findIndex((m) => m.id === correctingMessageId);
    const studentQuestion = messages
      .slice(0, targetIndex)
      .filter((m) => m.role === 'user')
      .pop()?.content || '';

    setIsAnalyzing(true);
    try {
      await agentApi.analyzeCorrection(token, agentId, {
        original_answer: targetMsg.content,
        corrected_answer: correctionText.trim(),
        student_question: studentQuestion,
      });
      setCorrectingMessageId(null);
      setCorrectionText('');
    } catch {
      // 静默失败
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFeedback = async (messageId: number, feedbackType: string) => {
    setFeedbackMsgId(messageId);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, feedback: { type: feedbackType } } : m
      )
    );
    onMessageFeedback?.(messageId, feedbackType);
    try {
      await chatApi.submitFeedback(token, messageId, feedbackType);
    } catch {}
  };

  return (
    <div className="flex gap-4 h-full">
      {/* 对话历史侧边栏 */}
      <div className="w-[200px] shrink-0 flex flex-col bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="p-3 border-b border-gray-100">
          <button
            onClick={startNewConversation}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-indigo-700 rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            新对话
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isLoadingConversations ? (
            <div className="text-center py-4 text-xs text-gray-400">加载中...</div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-4 text-xs text-gray-400">
              <MessageSquare className="w-6 h-6 mx-auto mb-2 text-gray-300" />
              暂无历史对话
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => loadConversationMessages(conv.id)}
                className={'group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ' + (
                  conv.id === conversationId
                    ? 'bg-indigo-50 text-indigo-900'
                    : 'hover:bg-gray-50 text-gray-700'
                )}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                <span className="text-xs truncate flex-1">{conv.title || '新对话'}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv.id); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-100 flex flex-col">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-indigo-700" />
            <span className="font-medium text-gray-900 text-sm">{agentName}</span>
            {agentStatus === 'published' && (
              <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">已发布</span>
            )}
            {agentStatus === 'draft' && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">草稿</span>
            )}
          </div>
          <span className="text-xs text-gray-400">{headerLabel}</span>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-[400px]">
          {isLoadingMessages && (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              加载对话记录...
            </div>
          )}
          {messages.length === 0 && !isLoadingMessages && (
            <div className="text-center py-16 text-gray-400">
              <Bot className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">{emptyHintTitle}</p>
              <p className="text-xs mt-1">{emptyHintDesc}</p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={'flex gap-3 ' + (msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4 text-indigo-700" />
                </div>
              )}
              <div className={'max-w-[75%] ' + (msg.role === 'user' ? 'order-last' : '')}>
                <div
                  className={'px-4 py-2.5 rounded-2xl text-sm leading-relaxed ' + (
                    msg.role === 'user'
                      ? 'bg-indigo-700 text-white rounded-tr-sm'
                      : 'bg-gray-50 text-gray-900 rounded-tl-sm'
                  )}
                >
                  {msg.role === 'assistant' && msg.content ? (
                    <MarkdownRenderer content={msg.content} />
                  ) : (
                    msg.content || (msg.streaming ? '思考中...' : '')
                  )}
                  {msg.streaming && (
                    <span className="inline-block w-1.5 h-4 bg-gray-400 ml-0.5 animate-pulse" />
                  )}
                </div>

                {msg.role === 'assistant' && msg.file && !msg.streaming && (
                  <div className="mt-2 bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 rounded-lg p-3 flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-700 rounded-lg flex items-center justify-center shrink-0">
                      <Presentation className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">PPT 课件已生成</p>
                      <p className="text-xs text-gray-500 truncate">{msg.file.filename}</p>
                    </div>
                    <a
                      href={msg.file.download_url}
                      download={msg.file.filename}
                      className="btn-primary shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      下载
                    </a>
                  </div>
                )}

                {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && !msg.streaming && (
                  <div className="mt-2 bg-gray-50 border border-gray-100 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      参考来源
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.sources.map((src, i) => (
                        <span
                          key={i}
                          className="text-xs bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded flex items-center gap-1"
                        >
                          {src.file}
                          <span className="text-gray-400">({(src.similarity * 100).toFixed(0)}%)</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {msg.role === 'assistant' && !msg.streaming && (
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => msg.id && handleFeedback(Number(msg.id), 'helpful')}
                      className={'flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ' + (
                        msg.feedback?.type === 'helpful'
                          ? 'bg-green-50 text-green-600'
                          : 'text-gray-400 hover:bg-gray-100'
                      )}
                    >
                      <ThumbsUp className="w-3 h-3" />
                      有帮助
                    </button>
                    <button
                      onClick={() => msg.id && handleFeedback(Number(msg.id), 'needs_improvement')}
                      className={'flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors ' + (
                        msg.feedback?.type === 'needs_improvement'
                          ? 'bg-amber-50 text-amber-600'
                          : 'text-gray-400 hover:bg-gray-100'
                      )}
                    >
                      <Wrench className="w-3 h-3" />
                      需改进
                    </button>
                    <button
                      onClick={() => { setCorrectingMessageId(Number(msg.id)); setCorrectionText(''); }}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded text-gray-400 hover:text-cyan-600 hover:bg-gray-100 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      纠正
                    </button>
                  </div>
                )}
                {correctingMessageId === Number(msg.id) && (
                  <div className="mt-2 p-3 bg-cyan-50 border border-cyan-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-cyan-700">请输入正确的回答</span>
                      <button
                        onClick={() => { setCorrectingMessageId(null); setCorrectionText(''); }}
                        className="cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5 text-gray-400" />
                      </button>
                    </div>
                    <textarea
                      value={correctionText}
                      onChange={(e) => setCorrectionText(e.target.value)}
                      placeholder="输入你认为正确的回答，系统将分析并提取教学经验..."
                      className="w-full text-sm p-2 border border-cyan-200 rounded-md bg-white resize-none focus:outline-none focus:ring-2 focus:ring-cyan-100"
                      rows={4}
                    />
                    <button
                      onClick={handleCorrection}
                      disabled={!correctionText.trim() || isAnalyzing}
                      className="mt-2 px-4 py-1.5 text-sm font-semibold text-white bg-cyan-600 rounded-md hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-2"
                    >
                      {isAnalyzing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {isAnalyzing ? '分析中...' : '提交纠正'}
                    </button>
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center shrink-0 order-first">
                  <User className="w-4 h-4 text-indigo-700" />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-gray-100 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的问题..."
              disabled={isSending}
              className="flex-1 input-field"
            />
            <button
              onClick={handleSend}
              disabled={isSending || !input.trim()}
              className="btn-primary disabled:opacity-50"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span className="text-sm">发送</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
