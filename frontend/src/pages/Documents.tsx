import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Presentation,
  Loader2,
  Download,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileBox,
  History,
  Sparkles,
} from 'lucide-react';
import { TeacherLayout } from '../components/TeacherLayout';
import { useAuth } from '../contexts/AuthContext';
import { documentApi, type DocumentHistoryItem, type GenerateDocumentParams } from '../services/documentApi';
import { agentApi } from '../services/agentApi';
import type { Agent } from '../types/agent';

type DocType = 'ppt' | 'word';

type GenStatus = 'idle' | 'outlining' | 'building' | 'done' | 'error';

interface FormState {
  topic: string;
  subject: string;
  grade: string;
  slide_count: number;
  style: string;
  duration: string;
  agent_id: number | '';
}

const PPT_STYLES = ['专业严谨', '活泼生动', '简约清新', '学术规范'];
const GRADES = ['大一', '大二', '大三', '大四', '研一', '研二', '高职大一', '高职大二', '高职大三'];

export function Documents() {
  const { token } = useAuth();
  const [docType, setDocType] = useState<DocType>('ppt');
  const [form, setForm] = useState<FormState>({
    topic: '',
    subject: '',
    grade: '',
    slide_count: 8,
    style: '专业严谨',
    duration: '45',
    agent_id: '',
  });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [status, setStatus] = useState<GenStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [result, setResult] = useState<{ filename: string; download_url: string } | null>(null);
  const [history, setHistory] = useState<DocumentHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string>('');

  // 加载助手列表（用于关联）
  useEffect(() => {
    if (!token) return;
    agentApi
      .getAll(token)
      .then(setAgents)
      .catch(() => {});
  }, [token]);

  // 加载历史
  const loadHistory = useCallback(async () => {
    if (!token) return;
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const data = await documentApi.getHistory(token);
      setHistory(data);
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : '加载历史失败');
    } finally {
      setHistoryLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleFieldChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const validate = (): string | null => {
    if (!form.topic.trim()) return '请填写主题';
    if (docType === 'ppt') {
      if (!form.subject.trim()) return '请填写学科';
      if (form.slide_count < 3 || form.slide_count > 20) return '页数范围 3-20';
    } else {
      if (!form.subject.trim()) return '请填写学科';
      if (!form.duration.trim()) return '请填写课时';
    }
    return null;
  };

  const handleGenerate = async () => {
    if (!token) return;
    const err = validate();
    if (err) {
      setStatus('error');
      setErrorMsg(err);
      return;
    }

    setStatus('outlining');
    setErrorMsg('');
    setResult(null);

    try {
      // 分步进度：先显示"生成大纲"状态，等500ms后切到"创建文件"
      setTimeout(() => {
        if (status !== 'error') setStatus('building');
      }, 600);

      const params: GenerateDocumentParams = {
        doc_type: docType,
        topic: form.topic.trim(),
        subject: form.subject.trim(),
        grade: form.grade,
        style: form.style,
      };
      if (docType === 'ppt') {
        params.slide_count = form.slide_count;
      } else {
        params.duration = form.duration;
      }
      if (form.agent_id !== '') {
        params.agent_id = Number(form.agent_id);
      }

      const resp = await documentApi.generate(token, params);
      setResult({ filename: resp.filename, download_url: resp.download_url });
      setStatus('done');
      // 刷新历史
      loadHistory();
    } catch (e) {
      setStatus('error');
      setErrorMsg(e instanceof Error ? e.message : '生成失败');
    }
  };

  const handleDownload = async (docId: number) => {
    if (!token) return;
    try {
      const blob = await documentApi.downloadFile(token, docId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const item = history.find((h) => h.id === docId);
      a.download = item?.file_name || `document_${docId}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : '下载失败');
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setErrorMsg('');
    setResult(null);
  };

  const formatDate = (iso: string | null): string => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
    } catch {
      return '';
    }
  };

  const steps: { key: GenStatus; label: string }[] = [
    { key: 'outlining', label: '生成大纲' },
    { key: 'building', label: '创建文件' },
    { key: 'done', label: '完成' },
  ];

  const isGenerating = status === 'outlining' || status === 'building';

  return (
    <TeacherLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileBox className="w-7 h-7 text-indigo-700" />
          文档生成
        </h1>
        <p className="text-sm text-gray-500 mt-1">AI 帮你生成 PPT 课件和 Word 教案，真实文件可直接下载</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：类型选择 + 表单 */}
        <div className="lg:col-span-2 space-y-5">
          {/* 类型选择 */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">选择文档类型</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setDocType('ppt');
                  handleReset();
                }}
                className={'flex items-center gap-3 p-4 rounded-lg border-2 transition-all ' + (
                  docType === 'ppt'
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <div
                  className={'w-10 h-10 rounded-lg flex items-center justify-center ' + (
                    docType === 'ppt' ? 'bg-indigo-700 text-white' : 'bg-gray-100 text-gray-500'
                  )}
                >
                  <Presentation className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-900">PPT 课件</p>
                  <p className="text-xs text-gray-500">生成 .pptx 文件</p>
                </div>
              </button>
              <button
                onClick={() => {
                  setDocType('word');
                  handleReset();
                }}
                className={'flex items-center gap-3 p-4 rounded-lg border-2 transition-all ' + (
                  docType === 'word'
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <div
                  className={'w-10 h-10 rounded-lg flex items-center justify-center ' + (
                    docType === 'word' ? 'bg-indigo-700 text-white' : 'bg-gray-100 text-gray-500'
                  )}
                >
                  <FileText className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-900">Word 教案</p>
                  <p className="text-xs text-gray-500">生成 .docx 文件</p>
                </div>
              </button>
            </div>
          </div>

          {/* 表单 */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              填写信息
            </h3>

            <div className="space-y-4">
              {/* 主题 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  主题 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.topic}
                  onChange={(e) => handleFieldChange('topic', e.target.value)}
                  placeholder={docType === 'ppt' ? '例如：数据结构 - 二叉树遍历' : '例如：导数的应用'}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* 学科 */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    学科 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.subject}
                    onChange={(e) => handleFieldChange('subject', e.target.value)}
                    placeholder="例如：计算机科学"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none"
                  />
                </div>

                {/* 年级 */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">年级</label>
                  <select
                    value={form.grade}
                    onChange={(e) => handleFieldChange('grade', e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none bg-white"
                  >
                    <option value="">不限</option>
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* PPT 专用字段 */}
              {docType === 'ppt' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">页数</label>
                    <input
                      type="number"
                      min={3}
                      max={20}
                      value={form.slide_count}
                      onChange={(e) => handleFieldChange('slide_count', Number(e.target.value) || 8)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">风格</label>
                    <select
                      value={form.style}
                      onChange={(e) => handleFieldChange('style', e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none bg-white"
                    >
                      {PPT_STYLES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Word 专用字段 */}
              {docType === 'word' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">课时（分钟）</label>
                  <input
                    type="text"
                    value={form.duration}
                    onChange={(e) => handleFieldChange('duration', e.target.value)}
                    placeholder="例如：45"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none"
                  />
                </div>
              )}

              {/* 关联助手（可选） */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  关联助手 <span className="text-gray-400">(可选，注入 system_prompt)</span>
                </label>
                <select
                  value={form.agent_id}
                  onChange={(e) => handleFieldChange('agent_id', e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none bg-white"
                >
                  <option value="">不关联</option>
                  {agents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}（{s.course_name}）
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 分步进度 */}
            {(isGenerating || status === 'done' || status === 'error') && (
              <div className="mt-5 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">进度</span>
                  {status === 'error' && (
                    <button onClick={handleReset} className="text-xs text-indigo-700 hover:underline">
                      重置
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {steps.map((step, idx) => {
                    const order: GenStatus[] = ['outlining', 'building', 'done'];
                    const currentIdx = order.indexOf(status);
                    const stepIdx = order.indexOf(step.key);
                    const isDone = status === 'done' || (currentIdx > stepIdx && status !== 'error');
                    const isActive = status === step.key && status !== 'error';
                    const isError = status === 'error';

                    return (
                      <div key={step.key} className="flex items-center flex-1">
                        <div className="flex flex-col items-center flex-1">
                          <div
                            className={'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ' + (
                              isError
                                ? 'bg-red-100 text-red-600'
                                : isDone
                                ? 'bg-green-100 text-green-600'
                                : isActive
                                ? 'bg-indigo-700 text-white'
                                : 'bg-gray-100 text-gray-400'
                            )}
                          >
                            {isError ? <AlertCircle className="w-4 h-4" /> : isDone ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                          </div>
                          <span
                            className={'text-xs mt-1 ' + (
                              isError ? 'text-red-600' : isDone || isActive ? 'text-gray-900 font-medium' : 'text-gray-400'
                            )}
                          >
                            {step.label}
                          </span>
                        </div>
                        {idx < steps.length - 1 && <div className="flex-1 h-0.5 bg-gray-200 mx-1" />}
                      </div>
                    );
                  })}
                </div>

                {status === 'error' && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-red-700">{errorMsg}</p>
                  </div>
                )}

                {status === 'done' && result && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-green-700 font-medium">生成成功</p>
                        <p className="text-xs text-gray-600 truncate">{result.filename}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        // 重新触发下载
                        const url = result.download_url;
                        fetch(url, { headers: { Authorization: `Bearer ${token}` } })
                          .then((r) => r.blob())
                          .then((blob) => {
                            const a = document.createElement('a');
                            const u = URL.createObjectURL(blob);
                            a.href = u;
                            a.download = result.filename;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(u);
                          })
                          .catch(() => alert('下载失败'));
                      }}
                      className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 shrink-0"
                    >
                      <Download className="w-3 h-3" />
                      下载
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 生成按钮 */}
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !form.topic.trim() || !form.subject.trim()}
              className="mt-5 w-full bg-indigo-700 hover:bg-indigo-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {status === 'outlining' ? '正在生成大纲...' : '正在创建文件...'}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  生成{docType === 'ppt' ? 'PPT' : 'Word'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* 右侧：历史列表 */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <History className="w-4 h-4 text-gray-500" />
              生成历史
            </h3>
            <button onClick={loadHistory} className="text-xs text-indigo-700 hover:underline">
              刷新
            </button>
          </div>

          {historyLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
            </div>
          ) : historyError ? (
            <div className="text-center py-12">
              <AlertCircle className="w-8 h-8 text-red-300 mx-auto mb-2" />
              <p className="text-xs text-red-500">{historyError}</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <FileBox className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-xs text-gray-400">暂无生成记录</p>
              <p className="text-xs text-gray-400 mt-1">填写左侧表单生成你的第一份文档</p>
            </div>
          ) : (
            <ul className="space-y-2 max-h-[600px] overflow-y-auto">
              {history.map((item) => (
                <li
                  key={item.id}
                  className="p-3 border border-gray-100 rounded-lg hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={'w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ' + (
                        item.doc_type === 'ppt' ? 'bg-orange-50 text-orange-600' : 'bg-indigo-50 text-indigo-700'
                      )}
                    >
                      {item.doc_type === 'ppt' ? (
                        <Presentation className="w-4 h-4" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate" title={item.topic}>
                        {item.topic}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                        <span>{item.subject || '未指定学科'}</span>
                        {item.grade && (
                          <>
                            <span>·</span>
                            <span>{item.grade}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(item.created_at)}</span>
                      </div>
                      <button
                        onClick={() => handleDownload(item.id)}
                        className="mt-2 text-xs text-indigo-700 hover:text-indigo-800 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Download className="w-3 h-3" />
                        下载
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </TeacherLayout>
  );
}
