# 对话历史持久化 + 导航职责分离 - AI 执行方案

> 本文档是可直接转发给 AI 的执行指令。AI 应按顺序执行以下任务，每个任务包含具体文件路径、修改内容和验证方法。
> 执行前必须先读取目标文件，修改后运行验证命令。
> 约束：不引入新依赖，不修改后端代码，不改变业务逻辑，仅改前端 UI 和状态管理。

---

## 背景

### 当前问题
1. **对话历史丢失**：AgentChat 组件每次 mount 时 `messages` 初始化为空数组，从不加载历史对话。用户离开 AgentPreview 页面再返回，之前的对话全部消失。
2. **导航混乱**：侧边栏"工作台"和"我的助手"都指向 `/teacher/dashboard`，Dashboard 页面同时承载统计卡片、快捷入口、助手列表三种职责。
3. **后端 API 已就绪但前端未调用**：`chatApi.listConversations`、`chatApi.getMessages`、`chatApi.deleteConversation` 三个方法已存在于 `frontend/src/services/chatApi.ts`，后端路由也完整可用，但前端组件从未调用。

### 用户期望的流程
1. 从助手市场下载助手 → 助手出现在"我的助手"页面
2. 在"我的助手"点击助手 → 进入对话页面，能看到历史对话列表
3. 点击历史对话 → 加载该对话的消息记录，可继续对话
4. 点击"新对话" → 开始全新对话
5. 从技能市场下载技能 → 在助手对话页面挂载技能（此功能已实现）

---

## 任务 1：AgentChat 组件增加对话历史功能

### 修改文件
`frontend/src/components/AgentChat.tsx`

### 当前状态
- 第 69 行：`const [messages, setMessages] = useState<Message[]>([]);` — 每次都从空开始
- 第 72 行：`const [conversationId, setConversationId] = useState<number | null>(initialConversationId);` — 有 conversationId 但 AgentPreview 从不传入
- 已有 import：`chatApi` 从 `../services/chatApi`

### 需要新增的状态
在现有状态之后添加：
```typescript
// 对话历史
const [conversations, setConversations] = useState<ConversationInfo[]>([]);
const [isLoadingConversations, setIsLoadingConversations] = useState(false);
const [isLoadingMessages, setIsLoadingMessages] = useState(false);
const [showConversationSidebar, setShowConversationSidebar] = useState(true);
```

### 需要新增的 import
在现有 import 中添加 `ConversationInfo` 类型：
```typescript
import { chatApi, type ChatSource, type FileReadyData, type ConversationInfo } from '../services/chatApi';
```
同时从 lucide-react 添加新图标：`MessageSquare, Trash2, Plus, Clock, ChevronLeft`

### 需要新增的函数

#### 1.1 加载对话列表
```typescript
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
```

#### 1.2 加载某个对话的消息
```typescript
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
```

#### 1.3 开始新对话
```typescript
const startNewConversation = () => {
  setConversationId(null);
  setMessages([]);
};
```

#### 1.4 删除对话
```typescript
const handleDeleteConversation = async (convId: number) => {
  if (!token) return;
  try {
    await chatApi.deleteConversation(token, convId);
    // 如果删除的是当前对话，清空消息
    if (convId === conversationId) {
      setConversationId(null);
      setMessages([]);
    }
    // 刷新对话列表
    await loadConversations();
  } catch {
    // 静默失败
  }
};
```

### 需要新增的 useEffect
在现有 useEffect 之后添加：
```typescript
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
```

### 需要修改的现有函数

#### 1.5 修改 handleSend
在 `handleSend` 函数中，当对话成功创建后（`onDone` 回调中），需要刷新对话列表：
```typescript
// 在 onDone 回调中，现有代码之后添加：
loadConversations();
```

### 需要新增的 UI：对话历史侧边栏

在 `return` 的 JSX 中，在现有布局 `{showConfigPanel && (...)}` 之前插入对话侧边栏。

当前布局结构：
```
<div className="flex gap-6 h-full">
  {showConfigPanel && <div className="w-[320px]">{configPanel}</div>}
  <div className="flex-1">聊天区域</div>
</div>
```

修改为：
```
<div className="flex gap-4 h-full">
  {/* 对话历史侧边栏 */}
  <div className="w-[200px] shrink-0 flex flex-col bg-white rounded-xl border border-gray-100 overflow-hidden">
    {/* 新对话按钮 */}
    <div className="p-3 border-b border-gray-100">
      <button
        onClick={startNewConversation}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-indigo-700 rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        新对话
      </button>
    </div>
    {/* 对话列表 */}
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

  {/* 原有配置面板 */}
  {showConfigPanel && (
    <div className="w-[280px] shrink-0"> {/* 从 320px 缩小到 280px 给侧栏腾空间 */}
      {configCollapsible && (...)}
      {configPanel}
    </div>
  )}

  {/* 聊天区域 */}
  <div className="flex-1 min-w-0 ...">
    {/* 在消息加载时显示 loading */}
    {isLoadingMessages && (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        加载对话记录...
      </div>
    )}
    {/* 原有消息列表 */}
  </div>
</div>
```

### 注意事项
- 配置面板宽度从 `w-[320px]` 改为 `w-[280px]`，对话侧栏 `w-[200px]`，保证聊天区域有足够空间
- 对话列表按 `created_at desc` 排序（后端已按此排序）
- 删除按钮使用 `opacity-0 group-hover:opacity-100` 仅在 hover 时显示
- 当前选中的对话用 `bg-indigo-50` 高亮
- 加载消息时显示 loading 状态，避免闪屏

### 验证方法
1. 启动前端，登录后进入某个助手的预览页
2. 发送几条消息，确认对话正常
3. 离开页面（返回 Dashboard），再回来
4. 确认左侧侧边栏显示之前的对话
5. 点击历史对话，确认消息加载出来
6. 点击"新对话"，确认开始全新对话
7. hover 对话项，确认出现删除按钮，点击删除后对话消失

---

## 任务 2：创建"我的助手"独立页面

### 新建文件
`frontend/src/pages/MyAgents.tsx`

### 设计意图
从 Dashboard 中分离出助手管理功能，作为独立页面。Dashboard 保留统计和快捷入口。MyAgents 专注于助手的查看、管理和启动。

### 页面结构
```
TeacherLayout
├── 页面标题 "我的助手" + 副标题
├── 筛选标签栏（全部 / 我创建的 / 来自市场）+ 搜索框
├── 助手卡片网格（grid-cols-1 md:grid-cols-2 lg:grid-cols-3）
│   └── 每张卡片：
│       ├── 图标 + 名称 + 来源标签（来自市场/我创建的）
│       ├── 课程名 + 模板标签 + 用途标签
│       ├── 状态标签（已发布/草稿）
│       ├── 最后编辑时间
│       └── "进入对话" 按钮 + "编辑" 按钮
└── 空状态引导
```

### 完整代码

```typescript
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, PlusCircle, Download, Loader2, Store, Edit,
  ArrowRight, Search, Sparkles,
} from 'lucide-react';
import { TeacherLayout } from '../components/TeacherLayout';
import { useAuth } from '../contexts/AuthContext';
import { agentApi } from '../services/agentApi';
import type { Agent } from '../types/agent';

const TEMPLATE_LABELS: Record<string, string> = {
  higher_edu: '高等教育',
  vocational: '职业教育',
};

const SCOPE_LABELS: Record<string, string> = {
  students: '面向学生',
  teachers: '面向教师',
};

type FilterTab = 'all' | 'created' | 'downloaded';

export function MyAgents() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    const fetchAgents = async () => {
      if (!token) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await agentApi.getAll(token);
        setAgents(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '获取助手列表失败');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAgents();
  }, [token]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'published': return { label: '已发布', class: 'bg-emerald-50 text-emerald-700 border border-emerald-200' };
      case 'testing': return { label: '测试中', class: 'bg-amber-50 text-amber-700 border border-amber-200' };
      default: return { label: '草稿', class: 'bg-gray-50 text-gray-700 border border-gray-200' };
    }
  };

  const downloadedCount = useMemo(
    () => agents.filter((a) => a.config?.downloaded_from).length,
    [agents],
  );
  const createdCount = agents.length - downloadedCount;

  const filteredAgents = useMemo(() => {
    let result = agents;
    if (filterTab === 'created') result = result.filter((a) => !a.config?.downloaded_from);
    if (filterTab === 'downloaded') result = result.filter((a) => a.config?.downloaded_from);
    if (keyword.trim()) {
      const kw = keyword.toLowerCase();
      result = result.filter((a) =>
        a.name.toLowerCase().includes(kw) ||
        (a.course_name || '').toLowerCase().includes(kw)
      );
    }
    return result;
  }, [agents, filterTab, keyword]);

  const filterTabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: '全部', count: agents.length },
    { key: 'created', label: '我创建的', count: createdCount },
    { key: 'downloaded', label: '来自市场', count: downloadedCount },
  ];

  return (
    <TeacherLayout>
      <div>
        {/* 标题区 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-indigo-950">我的助手</h1>
            <p className="text-indigo-800/70 mt-1 text-sm">管理你的 AI 教学助手，查看对话历史</p>
          </div>
          <button
            onClick={() => navigate('/teacher/agents/create')}
            className="btn-primary flex items-center gap-2"
          >
            <PlusCircle className="w-4 h-4" />
            创建新助手
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-6 border border-red-100">{error}</div>
        )}

        {/* 筛选 + 搜索 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilterTab(tab.key)}
                className={'px-3 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 cursor-pointer ' + (
                  filterTab === tab.key
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {tab.label}
                <span className={'ml-1.5 tabular-nums ' + (filterTab === tab.key ? 'text-indigo-400' : 'text-gray-400')}>{tab.count}</span>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索助手名称或课程..."
              className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all w-64"
            />
          </div>
        </div>

        {/* 助手卡片网格 */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 animate-pulse">
                <div className="w-10 h-10 bg-gray-200 rounded-lg mb-3" />
                <div className="h-5 bg-gray-200 rounded w-32 mb-2" />
                <div className="h-4 bg-gray-100 rounded w-20 mb-4" />
                <div className="h-8 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-12 h-12 text-indigo-200 mx-auto mb-3" />
            {filterTab === 'downloaded' ? (
              <>
                <p className="text-gray-500 mb-4">还没有从市场下载任何助手</p>
                <button onClick={() => navigate('/teacher/marketplace')} className="btn-primary">
                  <Store className="w-4 h-4" />
                  去市场看看
                </button>
              </>
            ) : keyword.trim() ? (
              <p className="text-gray-500">没有匹配的助手</p>
            ) : (
              <>
                <p className="text-gray-500 mb-4">还没有任何助手，开始创建你的第一个 AI 教学助手</p>
                <button onClick={() => navigate('/teacher/agents/create')} className="btn-primary">
                  <PlusCircle className="w-4 h-4" />
                  创建助手
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgents.map((agent) => {
              const statusInfo = getStatusLabel(agent.status);
              const config = agent.config || {};
              const scope = config.publishScope || 'students';
              const downloadedFrom = config.downloaded_from;
              return (
                <div
                  key={agent.id}
                  className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md hover:border-indigo-200 transition-all duration-200 cursor-pointer group"
                  onClick={() => navigate('/teacher/agents/' + agent.id + '/preview')}
                >
                  {/* 头部：图标 + 名称 + 来源 */}
                  <div className="flex items-start justify-between mb-3">
                    <div className={'w-10 h-10 rounded-lg flex items-center justify-center ' + (downloadedFrom ? 'bg-cyan-50' : 'bg-indigo-50')}>
                      {downloadedFrom ? (
                        <Download className="w-5 h-5 text-cyan-600" />
                      ) : (
                        <BookOpen className="w-5 h-5 text-indigo-700" />
                      )}
                    </div>
                    {downloadedFrom && (
                      <span className="text-xs bg-cyan-50 text-cyan-600 px-2 py-0.5 rounded-full border border-cyan-100">来自市场</span>
                    )}
                  </div>

                  {/* 名称 + 课程 */}
                  <h3 className="text-base font-semibold text-indigo-950 mb-1">{agent.name}</h3>
                  <p className="text-sm text-gray-500 mb-3">{agent.course_name || '未设置课程'}</p>

                  {/* 标签行 */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                      {TEMPLATE_LABELS[agent.template] || agent.template}
                    </span>
                    <span className={'text-xs px-2 py-0.5 rounded ' + (scope === 'teachers' ? 'bg-violet-50 text-violet-700 border border-violet-100' : 'bg-indigo-50 text-indigo-800 border border-indigo-100')}>
                      {SCOPE_LABELS[scope] || scope}
                    </span>
                    <span className={'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ' + statusInfo.class}>
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* 底部：时间 + 操作 */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                    <span className="text-xs text-gray-400 tabular-nums">
                      {agent.updated_at ? new Date(agent.updated_at).toLocaleDateString('zh-CN') : '-'}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate('/teacher/agents/create?edit=' + agent.id); }}
                        className="p-1.5 text-gray-400 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <div className="flex items-center gap-1 text-xs font-semibold text-indigo-700 group-hover:gap-2 transition-all">
                        进入对话
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}
```

### 验证方法
- 页面正常加载，显示助手卡片网格
- 筛选标签切换正常（全部/我创建的/来自市场）
- 搜索框过滤正常
- 点击卡片跳转到 AgentPreview 页面
- 空状态显示正确

---

## 任务 3：精简 Dashboard 页面

### 修改文件
`frontend/src/pages/Dashboard.tsx`

### 修改意图
移除 Dashboard 中的助手列表表格部分，因为该功能已移至 MyAgents 页面。Dashboard 保留：统计卡片 + 快捷入口。

### 具体修改

#### 3.1 移除助手列表相关代码
删除以下内容：
- `filterTab` 状态和 `FilterTab` 类型（第 19、33 行）
- `downloadedCount`、`createdCount`、`filteredAgents` 的 useMemo（第 64-74 行）
- `filterTabs` 数组定义（第 92-96 行）
- 整个助手表格区块（从 `{/* Agents table */}` 到其对应的 `</div>` 结束，约第 162-286 行）

#### 3.2 调整快捷入口
在 `quickActions` 数组中，将"创建新助手"的路径保持不变，新增一个"我的助手"快捷入口：
```typescript
const quickActions = [
  { icon: BookOpen, title: '我的助手', desc: '管理和使用你的 AI 教学助手', path: '/teacher/my-agents' },
  { icon: PlusCircle, title: '创建新助手', desc: '通过六步向导创建 AI 教学助手', path: '/teacher/agents/create' },
  { icon: Store, title: '助手市场', desc: '浏览所有已发布的 AI 教学助手', path: '/teacher/marketplace' },
];
```
（移除了原来的"管理知识库"快捷入口，替换为"我的助手"）

#### 3.3 清理未使用的 import
删除不再使用的 import：`Download`（如果只在移除的表格中使用）、`useMemo`（如果不再需要）

### 验证方法
- Dashboard 页面只显示统计卡片和快捷入口
- 点击"我的助手"快捷入口跳转到 `/teacher/my-agents`
- 统计数据正常显示

---

## 任务 4：修正侧边栏导航

### 修改文件
`frontend/src/components/TeacherLayout.tsx`

### 当前问题
第 10-11 行：
```typescript
{ id: 'dashboard', label: '工作台', icon: LayoutDashboard, path: '/teacher/dashboard' },
{ id: 'skills', label: '我的助手', icon: BookOpen, path: '/teacher/dashboard' }, // ← 同一路径！
```

### 修改内容
将"我的助手"的 path 改为新路由，并调整图标：
```typescript
const navItems = [
  { id: 'dashboard', label: '工作台', icon: LayoutDashboard, path: '/teacher/dashboard' },
  { id: 'my-agents', label: '我的助手', icon: BookOpen, path: '/teacher/my-agents' },
  { id: 'skill-files', label: '技能管理', icon: Files, path: '/teacher/skill-files' },
  { id: 'marketplace', label: '助手市场', icon: Store, path: '/teacher/marketplace' },
  { id: 'knowledge', label: '知识库', icon: Database, path: '/teacher/knowledge' },
  { id: 'analytics', label: '数据分析', icon: BarChart3, path: '/teacher/analytics' },
];
```

同时修正 `isActive` 函数，确保"我的助手"和"工作台"不会同时高亮：
```typescript
const isActive = (path: string) => {
  if (path === '/teacher/dashboard') {
    return location.pathname === '/teacher/dashboard';
  }
  return location.pathname.startsWith(path);
};
```

### 验证方法
- 侧边栏"工作台"和"我的助手"分别指向不同页面
- 在 Dashboard 时只有"工作台"高亮
- 在 MyAgents 时只有"我的助手"高亮

---

## 任务 5：注册新路由

### 修改文件
`frontend/src/App.tsx`

### 修改内容
在 import 部分添加：
```typescript
import { MyAgents } from './pages/MyAgents';
```

在 Routes 中，在 Dashboard 路由之后添加：
```tsx
<Route
  path="/teacher/my-agents"
  element={
    <ProtectedRoute>
      <MyAgents />
    </ProtectedRoute>
  }
/>
```

### 验证方法
- 访问 `http://localhost:5173/teacher/my-agents` 正常加载 MyAgents 页面
- 访问 `http://localhost:5173/teacher/dashboard` 正常加载精简后的 Dashboard

---

## 执行顺序

1. 任务 2（创建 MyAgents.tsx 新页面）
2. 任务 5（注册路由）
3. 任务 4（修正侧边栏导航）
4. 任务 3（精简 Dashboard）
5. 任务 1（AgentChat 对话历史 — 最复杂放最后）

## 最终验证清单

### 编译验证
```powershell
cd frontend
npx tsc --noEmit
npm run build
```
TypeScript 编译零错误，Build 成功。

### 功能验证
1. 登录后进入 Dashboard，确认只有统计卡片和快捷入口，无助手表格
2. 点击侧边栏"我的助手"，进入 MyAgents 页面，看到助手卡片网格
3. 点击某个助手卡片，进入 AgentPreview 页面
4. 发送几条消息，确认对话正常
5. 返回 MyAgents，再次点击同一助手
6. 确认左侧对话历史侧栏显示之前的对话
7. 点击历史对话，确认消息加载出来
8. 点击"新对话"，确认开始全新对话
9. 从市场下载一个助手，确认它出现在 MyAgents 的"来自市场"筛选中
10. 在助手预览页挂载一个技能文件，确认对话正常

### 禁止事项
- 不修改后端任何代码
- 不引入新的 npm 依赖
- 不改变 AgentChat 的流式对话逻辑
- 不改变 AgentPreview 的技能挂载逻辑
- 不改变 AgentPreview 的课件生成逻辑
- 不改变现有的 indigo+cyan 配色方案
