import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { TeacherLayout } from '../components/TeacherLayout';
import { KnowledgeUpload } from '../components/KnowledgeUpload';
import { KnowledgeLayerPanel } from '../components/structured-form/KnowledgeLayerPanel';
import { knowledgeApi, type KnowledgeFile, type KnowledgeInfo, type SearchResult } from '../services/knowledgeApi';
import { agentApi } from '../services/agentApi';
import type { Agent } from '../types/agent';
import { Database, Search, Loader2, BookOpen, Layers, FileText, CheckCircle2, ChevronDown, Sparkles } from 'lucide-react';

type KnowledgeTab = 'rag' | 'experience';

export function Knowledge() {
  const { token } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null);
  const [agentsLoading, setAgentsLoading] = useState(true);
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [info, setInfo] = useState<KnowledgeInfo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<KnowledgeTab>('rag');

  // 加载用户的助手列表
  useEffect(() => {
    if (!token) return;
    setAgentsLoading(true);
    agentApi.getAll(token)
      .then((list) => {
        setAgents(list);
        if (list.length > 0 && !selectedAgentId) {
          setSelectedAgentId(list[0].id);
        }
      })
      .catch(() => setError('加载助手列表失败'))
      .finally(() => setAgentsLoading(false));
  }, [token]);

  // 加载选中助手的知识库数据
  const loadData = async () => {
    if (!token || !selectedAgentId) return;
    try {
      const [fileList, infoData] = await Promise.all([
        knowledgeApi.list(token, selectedAgentId),
        knowledgeApi.info(token, selectedAgentId),
      ]);
      setFiles(fileList);
      setInfo(infoData);
    } catch {
      setError('加载知识库数据失败');
    }
  };

  useEffect(() => {
    if (selectedAgentId) {
      setFiles([]);
      setInfo(null);
      setSearchResults([]);
      setError(null);
      loadData();
    }
  }, [selectedAgentId]);

  const handleSearch = async () => {
    if (!token || !selectedAgentId || !searchQuery.trim()) return;
    setIsSearching(true);
    setError(null);
    try {
      const response = await knowledgeApi.testSearch(token, selectedAgentId, searchQuery.trim(), 5);
      setSearchResults(response.results);
    } catch {
      setError('检索失败，请重试');
    } finally {
      setIsSearching(false);
    }
  };

  const handleFilesChange = (newFiles: KnowledgeFile[]) => {
    setFiles(newFiles);
    loadData();
  };

  const stats = {
    total: info?.total_documents || 0,
    done: info?.done_documents || 0,
    processing: info?.processing_documents || 0,
    chunks: info?.total_chunks || 0,
  };

  const selectedAgent = agents.find((s) => s.id === selectedAgentId);

  return (
    <TeacherLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">知识库管理</h1>
          <p className="text-gray-500 text-sm mt-1">选择助手后上传、管理教学资料，构建该助手的 RAG 知识库</p>
        </div>

        {/* 助手选择器 */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 shrink-0">选择助手：</label>
          {agentsLoading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              加载中...
            </div>
          ) : agents.length === 0 ? (
            <p className="text-sm text-gray-400">暂无助手，请先创建一个助手</p>
          ) : (
            <div className="relative flex-1 max-w-md">
              <select
                value={selectedAgentId ?? ''}
                onChange={(e) => setSelectedAgentId(Number(e.target.value))}
                className="w-full appearance-none px-4 py-2.5 pr-10 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none text-sm bg-white"
              >
                {agents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.template === 'vocational' ? '(职教)' : '(高校)'}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
          {selectedAgent && (
            <span className="text-xs text-gray-400">
              Collection: <code className="text-indigo-700">agent_{selectedAgent.id}</code>
            </span>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
        )}

        {/* Tab 切换：RAG 知识库 / 经验沉淀 */}
        {selectedAgentId && (
          <div className="sticky top-0 z-10 bg-[#F8FAFC] py-2 -mx-1 px-1 flex gap-2 border-b border-gray-100">
            <button
              onClick={() => setActiveTab('rag')}
              className={'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer ' + (
                activeTab === 'rag'
                  ? 'bg-[#4338CA] text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-100 hover:border-indigo-200'
              )}
            >
              <Database className="w-4 h-4" />
              RAG 知识库
            </button>
            <button
              onClick={() => setActiveTab('experience')}
              className={'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg transition-colors cursor-pointer ' + (
                activeTab === 'experience'
                  ? 'bg-[#4338CA] text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-100 hover:border-indigo-200'
              )}
            >
              <Sparkles className="w-4 h-4" />
              经验沉淀
            </button>
          </div>
        )}

        {selectedAgentId ? (
          activeTab === 'experience' ? (
            <div className="bg-white rounded-xl border border-gray-100 p-6 min-h-[600px]">
              <KnowledgeLayerPanel
                token={token!}
                agentId={selectedAgentId}
                agentName={selectedAgent?.name || ''}
              />
            </div>
          ) :
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">文件上传</h2>
              <KnowledgeUpload
                token={token!}
                agentId={selectedAgentId}
                files={files}
                onFilesChange={handleFilesChange}
                showChunkParams={false}
              />
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">测试检索</h2>
                <span className="text-xs text-gray-400">验证知识库能否正确检索相关内容</span>
              </div>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="输入查询内容，如：牛顿第二定律"
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none"
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {isSearching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  检索
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">找到 {searchResults.length} 个相关片段</p>
                  {searchResults.map((result, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-gray-50 rounded-lg border border-gray-100"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="text-xs text-gray-500">来源: <span className="font-medium text-gray-700">{result.filename}</span></span>
                        </div>
                        <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                          相似度 {(result.similarity * 100).toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{result.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {searchResults.length === 0 && !isSearching && searchQuery.trim() && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  未找到相关内容，请尝试其他关键词
                </div>
              )}

              {searchResults.length === 0 && !isSearching && !searchQuery.trim() && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  输入关键词开始检索测试
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
                  <Database className="w-5 h-5 text-indigo-700" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">向量库信息</h3>
                  <p className="text-xs text-gray-400">当前知识库配置</p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Embedding 模型</span>
                  <span className="font-medium text-gray-900">{info?.embedding_model || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Collection</span>
                  <span className="font-mono text-xs text-gray-900">{info?.collection_name || '—'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                  <p className="text-xs text-gray-500 mt-1">总文档</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-green-600">{stats.done}</p>
                  <p className="text-xs text-gray-500 mt-1">已处理</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-amber-600">{stats.processing}</p>
                  <p className="text-xs text-gray-500 mt-1">处理中</p>
                </div>
                <div className="bg-indigo-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-indigo-700">{stats.chunks}</p>
                  <p className="text-xs text-gray-500 mt-1">总分块</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                  <Layers className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">分块参数</h3>
                  <p className="text-xs text-gray-400">文本切分配置</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">512</p>
                  <p className="text-xs text-gray-500 mt-1">Chunk Size</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-900">50</p>
                  <p className="text-xs text-gray-500 mt-1">Overlap</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-50 to-cyan-50 rounded-xl border border-indigo-100 p-6">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-5 h-5 text-indigo-700" />
                <h3 className="font-bold text-gray-900">使用提示</h3>
              </div>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  上传 PDF、TXT、MD、DOCX 格式文件
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  系统自动解析、清洗、分块建立索引
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  使用检索功能验证知识库质量
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  知识库按助手隔离，向量存入 agent_{selectedAgentId} collection
                </li>
              </ul>
            </div>
          </div>
        </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
            <Database className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>请先选择一个助手来管理其知识库</p>
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}
