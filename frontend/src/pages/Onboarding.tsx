import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, BookOpen, Check, ArrowRight } from 'lucide-react';

type Role = 'teacher' | 'student' | null;

export function Onboarding() {
  const [selectedRole, setSelectedRole] = useState<Role>(null);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const handleSelectRole = (role: Role) => {
    setSelectedRole(role);
    setError(null);
  };

  const handleConfirm = async () => {
    if (!selectedRole) {
      setError('请选择一个身份');
      return;
    }

    if (selectedRole === 'teacher') {
      navigate('/teacher/dashboard');
      return;
    }

    setError('学生端 Demo 暂未实现，请选择教师身份');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">选择你的身份</h1>
          <p className="text-gray-500 mt-2">选择身份后，我们将为你提供个性化的体验</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <button
            onClick={() => handleSelectRole('teacher')}
            className={'relative p-8 rounded-2xl border-2 bg-white text-left transition-all ' + (
              selectedRole === 'teacher'
                ? 'border-indigo-600 ring-4 ring-indigo-100 shadow-lg'
                : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
            )}
          >
            {selectedRole === 'teacher' && (
              <div className="absolute top-4 right-4 w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
            )}
            <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center mb-4">
              <GraduationCap className="w-7 h-7 text-indigo-700" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">教师</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              创建 AI 教学助手，管理知识库，查看教学数据
            </p>
          </button>

          <button
            onClick={() => handleSelectRole('student')}
            className={'relative p-8 rounded-2xl border-2 bg-white text-left transition-all ' + (
              selectedRole === 'student'
                ? 'border-orange-500 ring-4 ring-orange-100 shadow-lg'
                : 'border-gray-200 hover:border-orange-300 hover:shadow-md'
            )}
          >
            {selectedRole === 'student' && (
              <div className="absolute top-4 right-4 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-white" />
              </div>
            )}
            <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center mb-4">
              <BookOpen className="w-7 h-7 text-orange-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">学生</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              发现 AI 学习助手，随时随地获取个性化辅导
            </p>
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-6 text-center">
            {error}
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={!selectedRole}
          className="w-full bg-indigo-700 hover:bg-indigo-800 text-white font-medium py-3 px-4 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          确认选择
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}