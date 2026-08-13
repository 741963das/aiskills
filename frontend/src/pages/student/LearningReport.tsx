import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { StudentLayout } from '../../components/StudentLayout';
import { studentApi } from '../../services/studentApi';
import type { LearningReportData } from '../../types/auth';
import { TrendingUp, Clock, Target, AlertTriangle, Loader2 } from 'lucide-react';

export function LearningReport() {
  const { token } = useAuth();
  const [report, setReport] = useState<LearningReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    studentApi.getReport(token)
      .then(setReport)
      .catch((err) => setError(err instanceof Error ? err.message : '数据加载失败'))
      .finally(() => setLoading(false));
  }, [token]);

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}分钟`;
    return `${(seconds / 3600).toFixed(1)}小时`;
  };

  const maxDuration = report
    ? Math.max(...report.duration_trend.map((d) => d.seconds), 1)
    : 1;

  return (
    <StudentLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">学习报告</h1>
          <p className="text-gray-500 text-sm mt-1">了解你的学习进度和薄弱点</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-cyan-600 animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm border border-red-100">
            {error}
          </div>
        ) : !report ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center text-gray-400">
            暂无学习数据
          </div>
        ) : (
          <>
            {/* 概览卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">累计学习时长</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{formatDuration(report.total_learning_seconds)}</p>
                  </div>
                  <Clock className="w-8 h-8 text-cyan-600" />
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">错题总数</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1 tabular-nums">{report.total_mistakes}</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-orange-500" />
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">已掌握错题</p>
                    <p className="text-2xl font-bold text-green-500 mt-1 tabular-nums">{report.mastered_mistakes}</p>
                  </div>
                  <Target className="w-8 h-8 text-green-500" />
                </div>
              </div>
            </div>

            {/* 学习时长趋势 */}
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-cyan-600" />
                近 7 天学习时长
              </h2>
              {report.duration_trend.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">暂无学习记录</p>
              ) : (
                <div className="flex items-end justify-between gap-2 h-40">
                  {report.duration_trend.map((d) => (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full flex items-end justify-center flex-1">
                        <div
                          className="w-8 bg-gradient-to-t from-cyan-600 to-cyan-500 rounded-t-lg transition-all hover:opacity-80 cursor-pointer"
                          style={{ height: `${(d.seconds / maxDuration) * 100}%`, minHeight: d.seconds > 0 ? '4px' : '0' }}
                          title={formatDuration(d.seconds)}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{d.date.slice(5)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 知识掌握度 */}
            {report.mastery_by_subject.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">各学科知识掌握度</h2>
                <div className="space-y-3">
                  {report.mastery_by_subject.map((s) => (
                    <div key={s.subject}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{s.subject}</span>
                        <span className="text-sm font-semibold text-cyan-600 tabular-nums">{Math.round(s.mastery_rate * 100)}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-600 to-cyan-500 rounded-full transition-all"
                          style={{ width: `${s.mastery_rate * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 薄弱点诊断 */}
            {report.weak_points.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 p-6">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  薄弱知识点
                </h2>
                <div className="space-y-2">
                  {report.weak_points.map((w, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-orange-50/50 rounded-lg">
                      <div>
                        <span className="text-sm font-medium text-gray-900">{w.knowledge_point}</span>
                        {w.subject && (
                          <span className="text-xs text-gray-500 ml-2">({w.subject})</span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-orange-600 tabular-nums">{w.error_count}次错误</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </StudentLayout>
  );
}
