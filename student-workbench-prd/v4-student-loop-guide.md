# AI Skills 学生端闭环升级迭代指南

> 基于项目现状检查报告和学生端 PRD 的决策汇总，用于指导 AI 进行 v4.0 学生端闭环开发。
> 完整 PRD 见 [student-workbench-prd.html](student-workbench-prd.html)。

---

## 1. 核心设计决策

### 1.1 从"单端工具"到"双端平台"

v3.0 及之前版本仅服务教师端——教师创建 AI 助手、管理知识库、测试对话。但平台的价值链是断裂的：教师花了精力创建的助手，学生无法使用。v4.0 的目标是**补全学生端，形成教学闭环**。

### 1.2 双端独立分布，共享核心服务

教师端和学生端各自拥有独立的路由前缀、布局组件、导航系统，但共享底层的 Agent 模型、对话引擎、知识库服务。这不是两套系统，而是**同一平台的两个入口**。

| 维度 | 教师端 | 学生端 |
|------|--------|--------|
| 路由前缀 | `/teacher/` | `/student/` |
| 布局组件 | `TeacherLayout` | `StudentLayout`（新建） |
| 侧边栏色调 | indigo-950 `#1E1B4B` | cyan-900 `#0C4A6E` |
| 核心任务 | 创建和管理 AI 助手 | 使用 AI 助手进行学习 |
| 登录跳转 | `/teacher/dashboard` | `/student/dashboard` |

### 1.3 角色驱动，而非两套认证

不创建独立的 Student 用户表。沿用现有 `User` 模型，通过 `role` 字段区分身份。好处是：一个用户可以是教师（创建助手）也可以是学生（学习他人助手），未来支持身份切换毫无障碍。

---

## 2. 当前项目基础检查结论

### 2.1 已具备（无需修改）

| 层级 | 文件 | 现状 |
|------|------|------|
| 数据库 | `models/user.py` | `role` 字段已存在，默认 `"teacher"` |
| JWT | `services/auth.py` | `generate_token()` 已将 `role` 嵌入 payload |
| 注册 Schema | `schemas/auth.py` | `UserCreate.role` 已存在 |
| 用户响应 | `schemas/auth.py` | `UserResponse` 包含 `role` |
| 前端类型 | `types/auth.ts` | `User.role` 和 `RegisterData.role` 均已定义 |
| 后端创建 | `services/auth.py` | `create_user()` 已接受并写入 `role` |

### 2.2 需要补充（6 项缺口）

| 编号 | 层级 | 文件 | 缺失内容 |
|------|------|------|----------|
| G1 | 后端 | `utils/auth.py` | 无 `require_role()` 依赖注入函数 |
| G2 | 后端 | `routers/auth.py` | 登录接口返回 `Token` 不含 `role`，前端需额外调 `/me` |
| G3 | 前端 | `contexts/AuthContext.tsx` | `login()` 不根据角色跳转，`register()` 不传 `role` |
| G4 | 前端 | `components/ProtectedRoute.tsx` | 无 `role` 参数做角色校验 |
| G5 | 前端 | `pages/Login.tsx` | 无角色选择 UI（教师/学生切换） |
| G6 | 前端 | `App.tsx` | 无 `/student/*` 路由 |

---

## 3. 后端改造方案

### 3.1 新增 `require_role` 依赖注入（G1）

**文件**: `backend/app/utils/auth.py`

在现有 `get_current_user` 函数之后追加：

```python
from fastapi import Depends, HTTPException, status
from ..models.user import User

def require_role(role: str):
    """
    角色权限依赖注入工厂函数。
    用法: current_user: User = Depends(require_role("student"))
    """
    async def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role != role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"此操作需要 {role} 权限"
            )
        return current_user
    return role_checker
```

### 3.2 登录接口返回 role（G2）

**文件**: `backend/app/schemas/auth.py`

```python
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str  # 新增：前端据此决定跳转路由
```

**文件**: `backend/app/routers/auth.py`，修改 login 端点：

```python
@router.post("/login", response_model=Token)
def login(login: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, login)
    if not user:
        raise HTTPException(...)
    access_token = generate_token(user)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role  # 新增
    }
```

### 3.3 新增学生端路由模块

**文件**: `backend/app/routers/student.py`（新建）

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.user import User
from ..utils.auth import require_role

router = APIRouter(prefix="/student", tags=["student"])

# 所有端点使用 require_role("student") 做权限控制
```

端点清单：

| 方法 | 路径 | 说明 | 返回 |
|------|------|------|------|
| GET | `/student/dashboard` | 学习工作台统计 | 学习天数、对话次数、课程数、错题数 |
| GET | `/student/courses` | 已加入课程列表 | 课程列表 + 最近学习时间 |
| POST | `/student/courses/{agent_id}/join` | 加入课程 | 成功/失败 |
| DELETE | `/student/courses/{agent_id}/leave` | 退出课程 | 成功/失败 |
| GET | `/student/mistakes` | 错题列表 | 分页列表，支持 `?subject=&is_mastered=&knowledge_point=` |
| GET | `/student/mistakes/stats` | 错题统计 | 按学科、知识点、错误类型分组统计 |
| PUT | `/student/mistakes/{id}/mastered` | 标记已掌握 | 更新 `is_mastered=True` + `review_count++` |
| GET | `/student/report` | 学习报告 | 时长趋势、知识掌握度、薄弱点诊断 |
| GET | `/student/profile` | 学生档案 | `StudentProfile` 数据 |
| PUT | `/student/profile` | 更新档案 | 更新后的 `StudentProfile` |
| GET | `/student/recommendations` | 推荐课程 | 基于年级/学科/学习目标的推荐列表 |

**文件**: `backend/app/main.py`，注册路由：

```python
from .routers import student
app.include_router(student.router, prefix="/api")
```

### 3.4 新增数据模型

**文件**: `backend/app/models/student.py`（新建）

四个新模型，全部使用 `CREATE TABLE IF NOT EXISTS` 幂等创建：

```python
# 1. StudentAgent — 学生-助手关联
class StudentAgent(Base):
    __tablename__ = "student_agents"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    last_accessed_at = Column(DateTime(timezone=True))

# 2. LearningRecord — 学习行为记录
class LearningRecord(Base):
    __tablename__ = "learning_records"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=True)
    activity_type = Column(String, nullable=False)   # "chat" | "mistake_corrected" | "courseware_download"
    duration_seconds = Column(Integer, default=0)
    metadata_json = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# 3. MistakeRecord — 错题记录
class MistakeRecord(Base):
    __tablename__ = "mistake_records"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=True)
    subject = Column(String)
    knowledge_point = Column(String)
    question = Column(Text)
    student_answer = Column(Text)
    correct_answer = Column(Text)
    explanation = Column(Text)
    error_type = Column(String)       # "概念错误" | "计算错误" | "审题错误" | "思路错误"
    difficulty = Column(String, default="medium")
    is_mastered = Column(Boolean, default=False)
    review_count = Column(Integer, default=0)
    last_reviewed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# 4. StudentProfile — 学生扩展信息
class StudentProfile(Base):
    __tablename__ = "student_profiles"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    grade = Column(String)            # 年级
    major = Column(String)            # 专业
    subjects_of_interest = Column(Text)  # JSON: ["高等数学", "大学物理"]
    learning_goal = Column(Text)
    preferred_time = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```

**文件**: `backend/app/main.py`，在 `_lightweight_migrate()` 中追加新表创建：

```python
def _lightweight_migrate():
    # ... 现有迁移代码 ...
    # 新增：学生端表
    from .models.student import StudentAgent, LearningRecord, MistakeRecord, StudentProfile
    Base.metadata.create_all(bind=engine, tables=[
        StudentAgent.__table__,
        LearningRecord.__table__,
        MistakeRecord.__table__,
        StudentProfile.__table__
    ])
```

### 3.5 对话接口增强（学生端学习记录）

**文件**: `backend/app/routers/chat.py`，在现有 SSE 对话端点中增加学生端逻辑：

当 `current_user.role == "student"` 时，在 SSE 流结束后异步执行：

```python
import asyncio

# 在 SSE 流式响应结束后
if current_user.role == "student":
    # 1. 写入学习记录（异步，不阻塞响应）
    asyncio.create_task(_record_learning_activity(
        db=db,
        student_id=current_user.id,
        agent_id=agent_id,
        conversation_id=conversation.id,
        activity_type="chat",
        duration_seconds=duration
    ))

    # 2. 错题检测（异步，通过 AI 分析学生消息）
    asyncio.create_task(_detect_and_record_mistakes(
        db=db,
        student_id=current_user.id,
        agent_id=agent_id,
        conversation_id=conversation.id,
        messages=recent_messages
    ))
```

错题检测机制：将最近几轮对话发送给 AI 模型，判断学生回答是否包含错误，若包含则提取题目、学生答案、正确答案、解析、错误类型，写入 `MistakeRecord`。

---

## 4. 前端改造方案

### 4.1 改造顺序与依赖关系

```
G5 (Login 角色选择) → G3 (AuthContext 角色路由)
    ↓
G4 (ProtectedRoute 角色校验) + G6 (App.tsx 路由)
    ↓
StudentLayout 空壳 → 各页面组件依次开发
```

### 4.2 Login 页面增加角色选择（G5）

**文件**: `frontend/src/pages/Login.tsx`

改动要点：
1. 新增 `role` 状态，默认 `"teacher"`
2. 登录表单上方增加教师/学生标签切换
3. 注册时传递 `role` 参数
4. 左侧品牌区文案根据角色动态切换

```tsx
// 新增状态
const [role, setRole] = useState<'teacher' | 'student'>('teacher');

// 角色标签切换 UI（放在表单卡片 h2 下方）
<div className="flex gap-2 mb-6">
  <button
    onClick={() => setRole('teacher')}
    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
      role === 'teacher'
        ? 'bg-[#4338CA] text-white shadow-lg shadow-indigo-600/20'
        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
    }`}
  >
    我是教师
  </button>
  <button
    onClick={() => setRole('student')}
    className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
      role === 'student'
        ? 'bg-[#0891B2] text-white shadow-lg shadow-cyan-600/20'
        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
    }`}
  >
    我是学生
  </button>
</div>

// 注册时传递 role
await register(username, email, password, role);
```

### 4.3 AuthContext 增加角色路由跳转（G3）

**文件**: `frontend/src/contexts/AuthContext.tsx`

改动要点：
1. `login()` 签名增加 `role` 参数
2. `register()` 签名增加 `role` 参数
3. 登录/注册成功后根据角色跳转

```tsx
interface AuthContextType {
  // ...
  login: (username: string, password: string, role: string, remember: boolean) => Promise<void>;
  register: (username: string, email: string, password: string, role: string) => Promise<void>;
}

// login 实现中，获取 token 后：
const role = response.role || userData.role;  // 优先用 Token 返回的 role
if (role === 'student') {
  navigate('/student/dashboard');
} else {
  navigate('/teacher/dashboard');
}
```

### 4.4 ProtectedRoute 增加角色校验（G4）

**文件**: `frontend/src/components/ProtectedRoute.tsx`

```tsx
interface ProtectedRouteProps {
  children: ReactNode;
  role?: 'teacher' | 'student';  // 新增
}

export function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#4338CA] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 角色校验：如果指定了 role 但用户角色不匹配
  if (role && user.role !== role) {
    const redirectPath = user.role === 'student' ? '/student/dashboard' : '/teacher/dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}
```

### 4.5 App.tsx 增加学生端路由（G6）

**文件**: `frontend/src/App.tsx`

```tsx
<Routes>
  {/* 共享路由 */}
  <Route path="/login" element={<Login />} />
  <Route path="/onboarding" element={
    <ProtectedRoute><Onboarding /></ProtectedRoute>
  } />

  {/* 教师端 — 保持不变 */}
  <Route path="/teacher/*" element={
    <ProtectedRoute role="teacher"><TeacherLayout /></ProtectedRoute>
  }>
    <Route path="dashboard" element={<Dashboard />} />
    <Route path="my-agents" element={<MyAgents />} />
    <Route path="agents/create" element={<AgentCreate />} />
    <Route path="agents/:id/preview" element={<AgentPreview />} />
    <Route path="marketplace" element={<Marketplace />} />
    <Route path="skill-files" element={<SkillFiles />} />
    <Route path="knowledge" element={<Knowledge />} />
    <Route path="documents" element={<Documents />} />
  </Route>

  {/* 学生端 — 新增 */}
  <Route path="/student/*" element={
    <ProtectedRoute role="student"><StudentLayout /></ProtectedRoute>
  }>
    <Route path="dashboard" element={<StudentDashboard />} />
    <Route path="courses" element={<StudentCourses />} />
    <Route path="agents/:id/chat" element={<StudentChat />} />
    <Route path="mistakes" element={<MistakeBook />} />
    <Route path="reports" element={<LearningReport />} />
    <Route path="settings" element={<StudentSettings />} />
  </Route>

  <Route path="/" element={<Navigate to="/login" replace />} />
  <Route path="*" element={<Navigate to="/login" replace />} />
</Routes>
```

### 4.6 StudentLayout 组件

**文件**: `frontend/src/components/StudentLayout.tsx`（新建）

参照 `TeacherLayout` 结构，差异点：

| 元素 | TeacherLayout | StudentLayout |
|------|---------------|---------------|
| 侧边栏背景 | `bg-[#1E1B4B]` | `bg-[#0C4A6E]` |
| 导航项 | 工作台、我的助手、技能管理、市场、知识库、数据分析 | 学习工作台、AI辅导、我的课程、错题本、学习报告 |
| 导航图标 | `LayoutDashboard, BookOpen, Files, Store, Database, BarChart3` | `LayoutDashboard, MessageCircle, BookOpen, AlertCircle, TrendingUp` |
| 快捷入口 | 创建新助手、上传知识库 | 进入最近课程、查看错题 |
| 底部用户信息 | 保留 | 保留（通知、设置、退出） |

### 4.7 新增页面组件清单

| 组件 | 文件路径 | 说明 |
|------|----------|------|
| `StudentLayout` | `components/StudentLayout.tsx` | 学生端布局壳 |
| `StudentDashboard` | `pages/student/StudentDashboard.tsx` | 学习统计卡片 + 最近助手 + 推荐 |
| `StudentCourses` | `pages/student/StudentCourses.tsx` | 已加入课程列表 + 市场浏览 |
| `StudentChat` | `pages/student/StudentChat.tsx` | 学生端对话（复用 AgentChat 核心逻辑） |
| `MistakeBook` | `pages/student/MistakeBook.tsx` | 错题列表 + 筛选 + 标记已掌握 |
| `LearningReport` | `pages/student/LearningReport.tsx` | 学习报告 + 图表 |
| `StudentSettings` | `pages/student/StudentSettings.tsx` | 学生档案编辑 |

### 4.8 新增 API 服务层

**文件**: `frontend/src/services/studentApi.ts`（新建）

```typescript
import api from './api';

export const studentApi = {
  getDashboard: () => api.get('/student/dashboard'),
  getCourses: () => api.get('/student/courses'),
  joinCourse: (agentId: number) => api.post(`/student/courses/${agentId}/join`),
  leaveCourse: (agentId: number) => api.delete(`/student/courses/${agentId}/leave`),
  getMistakes: (params?: { subject?: string; is_mastered?: boolean; page?: number }) =>
    api.get('/student/mistakes', { params }),
  getMistakeStats: () => api.get('/student/mistakes/stats'),
  markMastered: (id: number) => api.put(`/student/mistakes/${id}/mastered`),
  getReport: () => api.get('/student/report'),
  getProfile: () => api.get('/student/profile'),
  updateProfile: (data: any) => api.put('/student/profile', data),
  getRecommendations: () => api.get('/student/recommendations'),
};
```

### 4.9 前端类型定义扩展

**文件**: `frontend/src/types/auth.ts`

```typescript
// 新增 StudentProfile 类型
export interface StudentProfile {
  id: number;
  student_id: number;
  grade: string | null;
  major: string | null;
  subjects_of_interest: string | null;
  learning_goal: string | null;
  preferred_time: string | null;
}

// 新增 MistakeRecord 类型
export interface MistakeRecord {
  id: number;
  student_id: number;
  agent_id: number;
  subject: string;
  knowledge_point: string;
  question: string;
  student_answer: string;
  correct_answer: string;
  explanation: string;
  error_type: string;
  difficulty: string;
  is_mastered: boolean;
  review_count: number;
  created_at: string;
}
```

---

## 5. 数据流与闭环

### 5.1 完整闭环链路

```
教师创建 Agent → 发布到市场
    ↓
学生浏览市场 → 加入课程 → 进入 AI 对话学习
    ↓
对话中 AI 检测错题 → 自动写入 MistakeRecord
    ↓
对话记录写入 LearningRecord → 学习报告生成
    ↓
（未来）教师查看学生聚合数据 → 优化教学策略
```

### 5.2 对话接口数据流（学生端）

```
学生发送消息
    ↓
SSE 流式对话（RAG检索 + LLM回答）
    ↓
流式响应结束
    ↓
异步任务1：写入 LearningRecord（activity_type="chat", duration_seconds）
异步任务2：错题检测 → 写入 MistakeRecord
    ↓
前端更新 StudentDashboard 统计数据
```

---

## 6. 实施路径

### 阶段划分

| 阶段 | 内容 | 涉及文件 | 预估工时 |
|------|------|----------|----------|
| P0 基础架构 | G1-G6 全部缺口修复；Login 角色选择；AuthContext 角色路由；ProtectedRoute 角色校验；App.tsx 学生路由；StudentLayout 空壳 | `utils/auth.py`、`schemas/auth.py`、`routers/auth.py`、`Login.tsx`、`AuthContext.tsx`、`ProtectedRoute.tsx`、`App.tsx`、`StudentLayout.tsx`（新建） | 2-3天 |
| P1 数据层 | 4 个新模型创建；`student.py` 路由模块（dashboard + courses + profile 端点）；`studentApi.ts` 服务层 | `models/student.py`（新建）、`routers/student.py`（新建）、`main.py`、`services/studentApi.ts`（新建） | 1-2天 |
| P2 核心页面 | StudentDashboard（统计卡片 + 推荐）；StudentCourses（课程列表 + 加入/退出）；StudentChat（复用 AgentChat + 适配） | `StudentDashboard.tsx`、`StudentCourses.tsx`、`StudentChat.tsx`（均为新建） | 2-3天 |
| P3 错题与报告 | 对话接口增强（学习记录 + 错题检测）；MistakeBook（列表 + 筛选 + 标记）；LearningReport（图表 + 诊断）；StudentSettings | `chat.py`（修改）、`MistakeBook.tsx`、`LearningReport.tsx`、`StudentSettings.tsx`（均为新建） | 2-3天 |
| P4 联调验收 | 全链路测试：教师创建助手 → 发布 → 学生注册 → 加入课程 → 对话 → 错题 → 报告；`npx tsc --noEmit` | 全量 | 1天 |

### 风险与应对

| 风险 | 影响 | 应对 |
|------|------|------|
| 错题检测准确率低 | 错题本质量差 | 初期用 Prompt 引导 AI 输出结构化错题标记；后续可引入独立分类模型 |
| 对话接口改造影响教师端 | 教师端对话异常 | 通过 `current_user.role` 条件判断，学生端逻辑仅在 `role=="student"` 时执行 |
| 异步任务数据库连接 | 连接池耗尽 | 异步任务中创建独立 db session，使用后立即关闭 |
| 学生端登录页面色系冲突 | 视觉不一致 | 学生端角色选择按钮使用 cyan-600（`#0891B2`），与教师端 indigo-700 区分 |

---

## 7. 关键约束

- **所有 AI 调用使用国内大模型**（DeepSeek-V3.2 / Qwen2.5-72B-Instruct），通过硅基流动 API
- **JWT 认证**：所有接口从 token 解析 `user_id` 和 `role`
- **颜色方案**：indigo + cyan（primary `#4338CA`，accent `#0891B2`），学生端侧边栏使用 `#0C4A6E`（cyan-900）
- **字体**：Plus Jakarta Sans（`@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,600;0,700;0,800;1,400&display=swap')`）
- **不引入新依赖**：所有开发基于现有 npm 和 pip 依赖
- **所有修改后运行 `npx tsc --noEmit`** 确保零错误
- **使用方括号语法写颜色**：如 `bg-[#0C4A6E]`、`text-[#0891B2]`
- **复用优先**：AgentChat、MarkdownRenderer 等核心组件直接复用，仅做适配
- **API 向后兼容**：现有教师端 API 不变，新增接口不影响现有功能
- **数据库幂等迁移**：新表使用 `CREATE TABLE IF NOT EXISTS`，不破坏现有数据

---

## 8. 验收标准

| 编号 | 验收项 | 标准 |
|------|--------|------|
| AC-1 | 角色注册 | 学生可选择"学生"角色注册，`User.role` 正确写入 `"student"` |
| AC-2 | 角色登录 | 学生登录后自动跳转 `/student/dashboard`，教师跳转 `/teacher/dashboard` |
| AC-3 | 角色隔离 | 学生无法访问 `/teacher/*` 路由，教师无法访问 `/student/*`（前端 + 后端双重校验） |
| AC-4 | 课程加入 | 学生可浏览市场助手列表，点击"加入学习"后出现在"我的课程" |
| AC-5 | AI 对话 | 学生可与已加入的助手进行多轮对话，历史持久化，不受教师端预览干扰 |
| AC-6 | 错题收集 | 对话中 AI 检测到学生错误时，自动创建 `MistakeRecord`，展示在错题本 |
| AC-7 | 错题复习 | 错题可按学科/知识点筛选，支持标记"已掌握"，`review_count` 递增 |
| AC-8 | 学习统计 | 工作台展示学习天数、对话次数、课程数、错题数，数据准确 |
| AC-9 | 学习报告 | 报告页展示学习时长趋势、知识掌握度、薄弱点诊断 |
| AC-10 | TypeScript | `npx tsc --noEmit` 零错误 |
| AC-11 | 教师端不受影响 | 现有教师端所有功能（创建助手、预览、对话、知识库、市场）正常工作 |
| AC-12 | 后端无报错 | 后端启动无异常，`/api/health` 正常响应 |

---

## 9. 文件变更总览

### 新建文件（10 个）

```
backend/app/models/student.py          # 4 个学生端数据模型
backend/app/routers/student.py         # 学生端 API 路由
frontend/src/components/StudentLayout.tsx
frontend/src/pages/student/StudentDashboard.tsx
frontend/src/pages/student/StudentCourses.tsx
frontend/src/pages/student/StudentChat.tsx
frontend/src/pages/student/MistakeBook.tsx
frontend/src/pages/student/LearningReport.tsx
frontend/src/pages/student/StudentSettings.tsx
frontend/src/services/studentApi.ts
```

### 修改文件（9 个）

```
backend/app/utils/auth.py              # 新增 require_role()
backend/app/schemas/auth.py            # Token 增加 role 字段
backend/app/routers/auth.py            # login 返回 role
backend/app/routers/chat.py            # 学生端对话增强（异步学习记录 + 错题检测）
backend/app/main.py                    # 注册 student 路由 + 新表迁移
frontend/src/pages/Login.tsx           # 角色选择 UI
frontend/src/contexts/AuthContext.tsx   # 角色路由跳转
frontend/src/components/ProtectedRoute.tsx  # 角色校验
frontend/src/App.tsx                   # 学生端路由
frontend/src/types/auth.ts            # 新增 StudentProfile、MistakeRecord 类型
```