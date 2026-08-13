import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { StudentLayout } from '../../components/StudentLayout';
import { studentApi } from '../../services/studentApi';
import type { StudentProfile } from '../../types/auth';
import { Loader2, Check } from 'lucide-react';

const GRADE_OPTIONS = ['大一', '大二', '大三', '大四', '研一', '研二', '研三', '其他'];
const SUBJECT_OPTIONS = ['高等数学', '线性代数', '概率论', '大学物理', '程序设计', '数据结构', '英语', '专业课程'];
const GOAL_OPTIONS = ['考试备考', '日常学习', '考研准备', '技能提升', '期末复习'];
const TIME_OPTIONS = ['上午', '下午', '晚上', '全天'];

export function StudentSettings() {
  const { token } = useAuth();
  const [, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 表单字段
  const [grade, setGrade] = useState('');
  const [major, setMajor] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [goal, setGoal] = useState('');
  const [preferredTime, setPreferredTime] = useState('');

  useEffect(() => {
    if (!token) return;
    studentApi.getProfile(token)
      .then((p) => {
        setProfile(p);
        setGrade(p.grade || '');
        setMajor(p.major || '');
        setSubjects(p.subjects_of_interest ? JSON.parse(p.subjects_of_interest) : []);
        setGoal(p.learning_goal || '');
        setPreferredTime(p.preferred_time || '');
      })
      .catch((err) => setError(err instanceof Error ? err.message : '数据加载失败'))
      .finally(() => setLoading(false));
  }, [token]);

  const toggleSubject = (s: string) => {
    setSubjects((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    setSaved(false);
    try {
      const updated = await studentApi.updateProfile(token, {
        grade: grade || null,
        major: major || null,
        subjects_of_interest: JSON.stringify(subjects),
        learning_goal: goal || null,
        preferred_time: preferredTime || null,
      });
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请重试');
      setTimeout(() => setError(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <StudentLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">个人设置</h1>
          <p className="text-gray-500 text-sm mt-1">完善学习档案，获取个性化推荐</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-cyan-600 animate-spin" />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 p-6 space-y-6">
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm border border-red-100">
                {error}
              </div>
            )}
            {/* 年级 */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">年级</label>
              <div className="flex flex-wrap gap-2">
                {GRADE_OPTIONS.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGrade(g)}
                    className={'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ' + (
                      grade === g
                        ? 'bg-cyan-600 text-white'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* 专业 */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">专业方向</label>
              <input
                type="text"
                value={major}
                onChange={(e) => setMajor(e.target.value)}
                placeholder="如：计算机科学、机械工程..."
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-cyan-600 focus:border-cyan-600 transition-all"
              />
            </div>

            {/* 感兴趣学科 */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">感兴趣学科（可多选）</label>
              <div className="flex flex-wrap gap-2">
                {SUBJECT_OPTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleSubject(s)}
                    className={'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ' + (
                      subjects.includes(s)
                        ? 'bg-cyan-600 text-white'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* 学习目标 */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">学习目标</label>
              <div className="flex flex-wrap gap-2">
                {GOAL_OPTIONS.map((g) => (
                  <button
                    key={g}
                    onClick={() => setGoal(g)}
                    className={'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ' + (
                      goal === g
                        ? 'bg-cyan-600 text-white'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {/* 偏好时间 */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">偏好学习时间</label>
              <div className="flex flex-wrap gap-2">
                {TIME_OPTIONS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setPreferredTime(t)}
                    className={'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ' + (
                      preferredTime === t
                        ? 'bg-cyan-600 text-white'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* 保存按钮 */}
            <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saved ? (
                  <>
                    <Check className="w-4 h-4" />
                    已保存
                  </>
                ) : (
                  '保存档案'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
