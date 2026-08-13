import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Lock, Eye, EyeOff, Sparkles, GraduationCap, BookOpen, Presentation } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

type Mode = 'login' | 'register';

export function Login() {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [role, setRole] = useState<'teacher' | 'student'>('teacher');

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const validateForm = (): string | null => {
    if (!username) return '请输入账号';
    if (mode === 'register') {
      if (!email) return '请输入邮箱';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '邮箱格式不正确';
    }
    if (!password) return '请输入密码';
    if (password.length < 6) return '密码至少 6 位';
    if (mode === 'register' && password !== confirmPassword) {
      return '两次输入的密码不一致';
    }
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      let loggedInUser;
      if (mode === 'login') {
        loggedInUser = await login(username, password, rememberMe);
      } else {
        loggedInUser = await register(username, email, password, role);
      }
      // 根据角色跳转
      if (loggedInUser.role === 'student') {
        navigate('/student/dashboard');
      } else {
        navigate('/teacher/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError(null);
    setConfirmPassword('');
  };

  const features = [
    { icon: GraduationCap, label: '双模板支持' },
    { icon: BookOpen, label: 'RAG 知识库' },
    { icon: Presentation, label: 'PPT 生成' },
  ];

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-[#EEF2FF] via-[#F8FAFC] to-[#ECFEFF]">
      {/* 左侧品牌区 — 深色靛蓝渐变 + 模糊光斑 */}
      <div className="hidden lg:flex lg:w-[52%] bg-gradient-to-br from-[#1E1B4B] via-[#312E81] to-[#4338CA] p-12 flex-col justify-between relative overflow-hidden">
        {/* 模糊光斑装饰 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-white/15 blur-[120px]" />
          <div className="absolute top-1/3 -right-20 w-80 h-80 rounded-full bg-cyan-400/20 blur-[100px]" />
          <div className="absolute -bottom-32 left-1/4 w-72 h-72 rounded-full bg-indigo-400/20 blur-[110px]" />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 rounded-full bg-blue-300/15 blur-[90px]" />
        </div>

        {/* 网格纹理叠加 */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />

        {/* Logo 区 */}
        <div className="relative z-10">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/15 backdrop-blur-md rounded-2xl border border-white/20 shadow-lg">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white leading-tight mt-6 tracking-tight">
            AI Skills
          </h1>
          <p className="text-indigo-200/90 mt-2 text-lg font-medium">教育创新创作平台</p>
        </div>

        {/* 中部标语 */}
        <div className="relative z-10 max-w-md">
          <h2 className="text-2xl font-bold text-white leading-snug mb-4">
            为高校教师打造的<br />AI 教学助手创建平台
          </h2>
          <p className="text-indigo-200/60 text-sm leading-relaxed">
            从模板选择到知识库上传，六步完成你的专属 AI Skill。
            支持 RAG 检索增强、PPT 课件生成、学生学习助手等多种场景。
          </p>
        </div>

        {/* 底部特性标签 */}
        <div className="relative z-10 flex items-center gap-3">
          {features.map((f) => (
            <div
              key={f.label}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/15"
            >
              <f.icon className="w-4 h-4 text-cyan-300" />
              <span className="text-xs font-medium text-indigo-50">{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 右侧表单区 */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 relative">
        {/* 右侧装饰光斑 */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-200/30 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-100/30 blur-[60px] rounded-full pointer-events-none" />

        <div className="w-full max-w-md relative z-10">
          {/* 移动端 Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-[#4338CA] to-[#312E81] rounded-2xl mb-4 shadow-lg shadow-indigo-600/30">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[#1E1B4B]">AI Skills</h1>
            <p className="text-[#4338CA] mt-1 text-sm font-medium">教育创新创作平台</p>
          </div>

          {/* 玻璃拟态表单卡片 */}
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-indigo-900/10 p-8 border border-white/60">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-[#1E1B4B] tracking-tight">
                {mode === 'login' ? '欢迎回来' : '创建账户'}
              </h2>
              <p className="text-gray-500 mt-1 text-sm">
                {mode === 'login' ? '登录你的账户继续创作之旅' : '注册并开始你的 AI 教学助手之旅'}
              </p>
            </div>

            {/* 角色选择 */}
            <div className="flex gap-2 mb-6">
              <button
                type="button"
                onClick={() => setRole('teacher')}
                className={'flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer ' + (
                  role === 'teacher'
                    ? 'bg-[#4338CA] text-white shadow-lg shadow-indigo-600/20'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                )}
              >
                我是教师
              </button>
              <button
                type="button"
                onClick={() => setRole('student')}
                className={'flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer ' + (
                  role === 'student'
                    ? 'bg-[#0891B2] text-white shadow-lg shadow-cyan-600/20'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                )}
              >
                我是学生
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 账号 */}
              <div>
                <label htmlFor="username" className="block text-xs font-semibold text-[#1E1B4B] mb-1.5">
                  账号
                </label>
                <div
                  className={'relative transition-all duration-300 ' + (
                    focusedField === 'username' ? 'scale-[1.02]' : ''
                  )}
                >
                  <User
                    className={'absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-200 ' + (
                      focusedField === 'username' ? 'text-[#4338CA]' : 'text-gray-400'
                    )}
                  />
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onFocus={() => setFocusedField('username')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="请输入账号"
                    disabled={isLoading}
                    className={'w-full pl-10 pr-4 py-3 bg-white/70 border rounded-xl text-sm outline-none transition-all duration-300 ' + (
                      focusedField === 'username'
                        ? 'border-[#4338CA] ring-4 ring-[#4338CA]/15 shadow-lg shadow-indigo-600/10'
                        : 'border-gray-200 hover:border-gray-300'
                    ) + ' disabled:opacity-50'}
                  />
                </div>
              </div>

              {/* 邮箱（仅注册） */}
              {mode === 'register' && (
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-[#1E1B4B] mb-1.5">
                    邮箱
                  </label>
                  <div
                    className={'relative transition-all duration-300 ' + (
                      focusedField === 'email' ? 'scale-[1.02]' : ''
                    )}
                  >
                    <Mail
                      className={'absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-200 ' + (
                        focusedField === 'email' ? 'text-[#4338CA]' : 'text-gray-400'
                      )}
                    />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="your@email.com"
                      disabled={isLoading}
                      className={'w-full pl-10 pr-4 py-3 bg-white/70 border rounded-xl text-sm outline-none transition-all duration-300 ' + (
                        focusedField === 'email'
                          ? 'border-[#4338CA] ring-4 ring-[#4338CA]/15 shadow-lg shadow-indigo-600/10'
                          : 'border-gray-200 hover:border-gray-300'
                      ) + ' disabled:opacity-50'}
                    />
                  </div>
                </div>
              )}

              {/* 密码 */}
              <div>
                <label htmlFor="password" className="block text-xs font-semibold text-[#1E1B4B] mb-1.5">
                  密码
                </label>
                <div
                  className={'relative transition-all duration-300 ' + (
                    focusedField === 'password' ? 'scale-[1.02]' : ''
                  )}
                >
                  <Lock
                    className={'absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-200 ' + (
                      focusedField === 'password' ? 'text-[#4338CA]' : 'text-gray-400'
                    )}
                  />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="请输入密码"
                    disabled={isLoading}
                    className={'w-full pl-10 pr-12 py-3 bg-white/70 border rounded-xl text-sm outline-none transition-all duration-300 ' + (
                      focusedField === 'password'
                        ? 'border-[#4338CA] ring-4 ring-[#4338CA]/15 shadow-lg shadow-indigo-600/10'
                        : 'border-gray-200 hover:border-gray-300'
                    ) + ' disabled:opacity-50'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#4338CA] transition-colors duration-200 cursor-pointer p-1"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* 确认密码（仅注册） */}
              {mode === 'register' && (
                <div>
                  <label htmlFor="confirmPassword" className="block text-xs font-semibold text-[#1E1B4B] mb-1.5">
                    确认密码
                  </label>
                  <div
                    className={'relative transition-all duration-300 ' + (
                      focusedField === 'confirmPassword' ? 'scale-[1.02]' : ''
                    )}
                  >
                    <Lock
                      className={'absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-200 ' + (
                        focusedField === 'confirmPassword' ? 'text-[#4338CA]' : 'text-gray-400'
                      )}
                    />
                    <input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onFocus={() => setFocusedField('confirmPassword')}
                      onBlur={() => setFocusedField(null)}
                      placeholder="请再次输入密码"
                      disabled={isLoading}
                      className={'w-full pl-10 pr-4 py-3 bg-white/70 border rounded-xl text-sm outline-none transition-all duration-300 ' + (
                        focusedField === 'confirmPassword'
                          ? 'border-[#4338CA] ring-4 ring-[#4338CA]/15 shadow-lg shadow-indigo-600/10'
                          : 'border-gray-200 hover:border-gray-300'
                      ) + ' disabled:opacity-50'}
                    />
                  </div>
                </div>
              )}

              {/* 记住登录 + 忘记密码 */}
              {mode === 'login' && (
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 accent-[#4338CA] rounded border-gray-300 cursor-pointer"
                      disabled={isLoading}
                    />
                    <span className="text-sm text-gray-600">记住登录状态</span>
                  </label>
                  <button
                    type="button"
                    className="text-sm text-[#4338CA] hover:text-[#3730A3] font-medium cursor-pointer transition-colors duration-200"
                  >
                    忘记密码？
                  </button>
                </div>
              )}

              {/* 错误提示 */}
              {error && (
                <div className="bg-red-50/80 backdrop-blur-sm text-red-600 px-4 py-3 rounded-xl text-sm border border-red-200/50 flex items-center gap-2 animate-[fadeIn_0.2s_ease-out]">
                  <div className="w-1 h-4 bg-red-500 rounded-full" />
                  {error}
                </div>
              )}

              {/* 登录/注册按钮 — 靛蓝渐变 + hover 上浮 */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-[#4338CA] to-[#312E81] text-white font-semibold py-3 rounded-xl text-sm transition-all duration-300 cursor-pointer shadow-lg shadow-indigo-600/25 hover:shadow-xl hover:shadow-indigo-600/30 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  mode === 'login' ? '登录' : '注册'
                )}
              </button>
            </form>

            {/* 切换模式 */}
            <div className="mt-6 text-center pt-5 border-t border-gray-100">
              <span className="text-gray-500 text-sm">
                {mode === 'login' ? '还没有账号？' : '已有账号？'}
              </span>
              <button
                onClick={toggleMode}
                className="text-[#4338CA] hover:text-[#3730A3] font-semibold text-sm ml-1 cursor-pointer transition-colors duration-200"
              >
                {mode === 'login' ? '立即注册' : '立即登录'}
              </button>
            </div>
          </div>

          <p className="text-center text-gray-400 text-xs mt-6">
            © 2026 AI Skills Platform · 教育创新创作平台
          </p>
        </div>
      </div>
    </div>
  );
}
