import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { StudentLayout } from '../../components/StudentLayout';
import { studentApi } from '../../services/studentApi';
import type { MistakeRecord, MistakeStats } from '../../types/auth';
import { CheckCircle2, Loader2, Filter } from 'lucide-react';

export function MistakeBook() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [stats, setStats] = useState<MistakeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterSubject, setFilterSubject] = useState('');
  const [filterMastered, setFilterMastered] = useState<'all' | 'unmastered' | 'mastered'>('unmastered');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [markingId, setMarkingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 10;

  const loadMistakes = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params: { subject?: string; is_mastered?: boolean; page?: number; page_size?: number } = {
        page,
        page_size: pageSize,
      };
      if (filterSubject) params.subject = filterSubject;
      if (filterMastered === 'unmastered') params.is_mastered = false;
      if (filterMastered === 'mastered') params.is_mastered = true;

      const [data, s] = await Promise.all([
        studentApi.getMistakes(token, params),
        studentApi.getMistakeStats(token),
      ]);
      setMistakes(data.items);
      setTotal(data.total);
      setStats(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : '数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [token, page, filterSubject, filterMastered]);

  useEffect(() => {
    loadMistakes();
  }, [loadMistakes]);

  const handleMarkMastered = async (id: number) => {
    if (!token) return;
    setMarkingId(id);
    try {
      await studentApi.markMastered(token, id);
      await loadMistakes();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试');
      setTimeout(() => setError(null), 3000);
    } finally {
      setMarkingId(null);
    }
  };

  const subjects = stats ? Object.keys(stats.by_subject) : [];
  const totalPages = Math.ceil(total / pageSize);

  return (
    <StudentLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">错题本</h1>
          <p className="text-gray-500 text-sm mt-1">复习错题，巩固薄弱知识点</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm border border-red-100">
            {error}
          </div>
        )}

        {/* 统计概览 */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-sm text-gray-500">错题总数</p>
              <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{stats.total}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-sm text-gray-500">未掌握</p>
              <p className="text-2xl font-bold text-red-500 mt-1 tabular-nums">{stats.unmastered}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-sm text-gray-500">已掌握</p>
              <p className="text-2xl font-bold text-green-500 mt-1 tabular-nums">{stats.mastered}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="text-sm text-gray-500">掌握率</p>
              <p className="text-2xl font-bold text-cyan-600 mt-1 tabular-nums">
                {stats.total > 0 ? Math.round((stats.mastered / stats.total) * 100) : 0}%
              </p>
            </div>
          </div>
        )}

        {/* 筛选 */}
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterSubject}
            onChange={(e) => { setFilterSubject(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-cyan-600 cursor-pointer"
          >
            <option value="">全部学科</option>
            {subjects.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <div className="flex gap-2">
            {(['unmastered', 'mastered', 'all'] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setFilterMastered(f); setPage(1); }}
                className={'px-3 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ' + (
                  filterMastered === f
                    ? 'bg-cyan-600 text-white'
                    : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
                )}
              >
                {f === 'unmastered' ? '未掌握' : f === 'mastered' ? '已掌握' : '全部'}
              </button>
            ))}
          </div>
        </div>

        {/* 错题列表 */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-cyan-600 animate-spin" />
          </div>
        ) : mistakes.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-300 mx-auto mb-3" />
            <p className="text-gray-400">暂无错题记录</p>
            <p className="text-sm text-gray-400 mt-1">在与 AI 辅导对话中，系统会自动收集错题</p>
            <button
              onClick={() => navigate('/student/courses')}
              className="mt-4 px-4 py-2 text-sm font-semibold text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors cursor-pointer"
            >
              去学习
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {mistakes.map((m) => (
              <div
                key={m.id}
                className={'bg-white rounded-xl border p-5 transition-shadow hover:shadow-md ' + (
                  m.is_mastered ? 'border-green-100' : 'border-gray-100'
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {m.subject && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-cyan-50 text-cyan-600 rounded">
                          {m.subject}
                        </span>
                      )}
                      {m.error_type && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-red-50 text-red-600 rounded">
                          {m.error_type}
                        </span>
                      )}
                      {m.is_mastered && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-50 text-green-600 rounded flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          已掌握
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-900 mt-2 line-clamp-2">{m.question}</p>
                    {m.knowledge_point && (
                      <p className="text-xs text-gray-500 mt-1">知识点：{m.knowledge_point}</p>
                    )}
                    {m.explanation && (
                      <p className="text-xs text-gray-600 mt-2 line-clamp-3 bg-gray-50 p-3 rounded-lg">
                        {m.explanation}
                      </p>
                    )}
                  </div>
                  {!m.is_mastered && (
                    <button
                      onClick={() => handleMarkMastered(m.id)}
                      disabled={markingId === m.id}
                      className="flex-shrink-0 px-4 py-2 text-sm font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {markingId === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : '标记掌握'}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  上一页
                </button>
                <span className="text-sm text-gray-500 px-2">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  下一页
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
