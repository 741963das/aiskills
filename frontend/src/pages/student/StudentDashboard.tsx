import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { StudentLayout } from '../../components/StudentLayout';
import { studentApi } from '../../services/studentApi';
import type { StudentDashboardData, StudentCourse } from '../../types/auth';
import { BookOpen, MessageSquare, AlertCircle, Flame, TrendingUp, ArrowRight } from 'lucide-react';

export function StudentDashboard() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<StudentDashboardData | null>(null);
  const [recommendations, setRecommendations] = useState<StudentCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      studentApi.getDashboard(token),
      studentApi.getRecommendations(token).catch(() => []),
    ]).then(([s, recs]) => {
      setStats(s);
      setRecommendations(recs || []);
      setLoading(false);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : '数据加载失败');
      setLoading(false);
    });
  }, [token]);

  if (loading) {
    return (
      <StudentLayout>
        <div className="space-y-6">
          <div className="h-8 w-48 bg-gray-100 rounded-lg animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-28 bg-white rounded-xl border border-gray-100 animate-pulse" />
            ))}
          </div>
        </div>
      </StudentLayout>
    );
  }

  if (error) {
    return (
      <StudentLayout>
        <div className="bg-red-50 text-red-600 p-4 rounded-xl">{error}</div>
      </StudentLayout>
    );
  }

  const cards = [
    { label: '连续学习天数', value: stats?.learning_days ?? 0, icon: Flame, color: 'text-orange-500' },
    { label: '对话次数', value: stats?.chat_count ?? 0, icon: MessageSquare, color: 'text-cyan-600' },
    { label: '已加入课程', value: stats?.course_count ?? 0, icon: BookOpen, color: 'text-indigo-500' },
    { label: '错题总数', value: stats?.mistake_count ?? 0, icon: AlertCircle, color: 'text-red-500' },
  ];

  return (
    <StudentLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">学习工作台</h1>
          <p className="text-gray-500 text-sm mt-1">继续你的学习之旅</p>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{card.label}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2 tabular-nums">{card.value}</p>
                  </div>
                  <div className={'w-12 h-12 rounded-lg bg-gray-50 flex items-center justify-center ' + card.color}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 未掌握错题提醒 */}
        {(stats?.unmastered_mistakes ?? 0) > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">
                你还有 {stats?.unmastered_mistakes} 道错题未掌握
              </p>
              <p className="text-xs text-amber-700 mt-0.5">及时复习错题有助于巩固知识</p>
            </div>
            <button
              onClick={() => navigate('/student/mistakes')}
              className="px-4 py-2 text-sm font-semibold text-amber-700 bg-white border border-amber-300 rounded-lg hover:bg-amber-100 transition-colors cursor-pointer"
            >
              去复习
            </button>
          </div>
        )}

        {/* 推荐课程 */}
        {recommendations.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-cyan-600" />
                推荐课程
              </h2>
              <button
                onClick={() => navigate('/student/courses')}
                className="text-sm text-cyan-600 hover:text-cyan-700 font-medium cursor-pointer flex items-center gap-1"
              >
                查看全部 <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recommendations.slice(0, 3).map((course) => (
                <div
                  key={course.agent_id}
                  className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/student/agents/${course.agent_id}/chat`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 bg-cyan-50 rounded-lg flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-cyan-600" />
                    </div>
                  </div>
                  <h3 className="font-semibold text-gray-900 mt-3 truncate">{course.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{course.subject || course.course_name}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
