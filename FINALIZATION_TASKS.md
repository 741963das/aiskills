# 项目收尾任务清单 — 交付给 Claude Code

> 项目：AI Skills 教育创新创作平台
> 位置：`e:\aiskills`（后端 `backend/app/`，前端 `frontend/src/`）
> 技术栈：FastAPI + SQLAlchemy + SQLite + ChromaDB / React 18 + TypeScript + Tailwind CSS + Vite
> 前置说明：以下 3 份历史方案均已执行完毕，本清单仅包含**尚未完成**的收尾工作。
> - `REFACTOR_PROMPT.md`（Skill→Agent 重构）— 已完成
> - `P0_SECURITY_CLEANUP_PROMPT.md`（安全加固+死代码清理）— 已完成
> - `CONVERSATION_HISTORY_NAV_FIX_PROMPT.md`（对话历史+导航修复）— 已完成

---

## 任务总览

| 优先级 | 任务编号 | 任务名称 | 影响范围 |
|--------|----------|----------|----------|
| P0 | 任务 1 | 消除硬编码 LLM 模型名 | 后端 2 文件 8 处 |
| P0 | 任务 2 | 实现"教师纠正分析"前端入口 | 前端 1 文件 |
| P1 | 任务 3 | 清理 4 个死代码文件 | 前端 4 文件 |
| P1 | 任务 4 | print() 替换为 logging 模块 | 后端 5 文件 24 处 |
| P1 | 任务 5 | 前端空 catch 块补全错误反馈 | 前端 5 文件 7 处 |
| P1 | 任务 6 | 后端 except: pass 补充日志 | 后端 3 文件 7 处 |
| P2 | 任务 7 | 创建项目 README.md | 根目录 1 文件 |
| P2 | 任务 8 | 清理 StudentDashboard 不可达代码 | 前端 1 文件 |
| P2 | 任务 9 | 前端主题色提取为 CSS 变量 | 前端 6+ 文件 |

**执行约束：**
- 不引入新的 Python 或 npm 依赖
- 不改变任何业务逻辑
- 不修改后端 API 接口签名
- 每个任务独立可执行，可按任意顺序进行（但建议按编号顺序）
- 每个任务完成后运行验证命令确认无破坏

---

## 任务 1：消除硬编码 LLM 模型名（P0）

### 问题

`backend/app/config.py:20` 已定义 `CHAT_MODEL: str = "deepseek-ai/DeepSeek-V3.2"`，`correction_analyzer.py`、`courseware_generator.py`、`experience_extractor.py`、`knowledge_extractor.py` 均正确使用 `os.getenv("CHAT_MODEL", ...)`。但以下文件直接硬编码字符串 `"deepseek-ai/DeepSeek-V3.2"`，切换模型时需逐处修改，极易遗漏。

### 涉及文件与位置

**文件 1：`backend/app/routers/agent.py`**

| 行号 | 当前代码 | 修改为 |
|------|----------|--------|
| 241 | `"model": "deepseek-ai/DeepSeek-V3.2"` | `"model": settings.CHAT_MODEL` |
| 287 | `"model": "deepseek-ai/DeepSeek-V3.2"` | `"model": settings.CHAT_MODEL` |
| 618 | `"model": "deepseek-ai/DeepSeek-V3.2"` | `"model": settings.CHAT_MODEL` |
| 639 | `"model": "deepseek-ai/DeepSeek-V3.2"` | `"model": settings.CHAT_MODEL` |
| 662 | `"model": "deepseek-ai/DeepSeek-V3.2"` | `"model": settings.CHAT_MODEL` |
| 767 | `"model": "deepseek-ai/DeepSeek-V3.2"` | `"model": settings.CHAT_MODEL` |
| 791 | `"model": "deepseek-ai/DeepSeek-V3.2"` | `"model": settings.CHAT_MODEL` |

**文件 2：`backend/app/routers/chat.py`**

| 行号 | 当前代码 | 修改为 |
|------|----------|--------|
| 230 | `"model": "deepseek-ai/DeepSeek-V3.2"` | `"model": settings.CHAT_MODEL` |

### 修改方法

1. 在 `backend/app/routers/agent.py` 和 `backend/app/routers/chat.py` 顶部确认已导入 `from ..config import settings`（如未导入则添加）
2. 全局搜索 `"deepseek-ai/DeepSeek-V3.2"`，将所有匹配替换为 `settings.CHAT_MODEL`
3. 确认 `settings` 对象在模块级可用

### 验证方法

```powershell
cd backend
python -c "from app.routers.agent import router; print('agent.py OK')"
python -c "from app.routers.chat import router; print('chat.py OK')"
python -m uvicorn app.main:app --reload --port 8000
```
- 启动无报错
- 在前端创建助手并生成 Prompt，确认 LLM 调用正常
- 全局搜索 `deepseek-ai/DeepSeek-V3.2` 应仅在 `config.py` 中出现一次（作为默认值）

---

## 任务 2：实现"教师纠正分析"前端入口（P0）

### 问题

后端 `POST /api/agents/{agent_id}/analyze-correction` 端点已就绪（`agent.py:1438-1472`），前端 `agentApi.ts:323-348` 已封装 `analyzeCorrection` 方法，但**没有任何 UI 组件调用它**。这意味着"教师纠正 AI 回答并分析经验"这一功能后端完整但用户无法触达。

### 需求

在 `AgentChat.tsx` 的 AI 回复消息气泡上新增"纠正"操作，点击后弹出纠正输入框，教师输入正确回答后提交分析。

### 修改文件

`frontend/src/components/AgentChat.tsx`

### 实现方案

#### 2.1 新增状态

在现有 state 之后添加：

```typescript
// 纠正分析
const [correctingMessageId, setCorrectingMessageId] = useState<number | null>(null);
const [correctionText, setCorrectionText] = useState('');
const [isAnalyzing, setIsAnalyzing] = useState(false);
```

#### 2.2 新增 import

在 `agentApi` 的 import 中确认 `analyzeCorrection` 方法可用（如未导入则添加）：

```typescript
import { agentApi } from '../services/agentApi';
```

在 lucide-react 的 import 中添加图标：

```typescript
import { Edit3, X, Loader2 } from 'lucide-react';
// Edit3、X、Loader2 如已存在则不重复导入
```

#### 2.3 新增处理函数

```typescript
const handleCorrection = async () => {
  if (!token || !agentId || !correctingMessageId || !correctionText.trim()) return;

  // 找到被纠正的 AI 回复消息
  const targetMsg = messages.find((m) => m.id === correctingMessageId);
  if (!targetMsg) return;

  setIsAnalyzing(true);
  try {
    await agentApi.analyzeCorrection(token, agentId, {
      original_question: messages
        .filter((m, i) => i < messages.findIndex((m2) => m2.id === correctingMessageId) && m.role === 'user')
        .pop()?.content || '',
      original_answer: targetMsg.content,
      corrected_answer: correctionText.trim(),
    });
    // 纠正成功后关闭输入框
    setCorrectingMessageId(null);
    setCorrectionText('');
    // 可选：在消息下方显示"已纠正"标记
  } catch {
    // 静默失败或显示 toast
  } finally {
    setIsAnalyzing(false);
  }
};
```

#### 2.4 新增 UI

在 AI 回复消息气泡的操作区（与现有 feedback 按钮同级）添加"纠正"按钮：

```tsx
{/* 仅 assistant 消息且非流式时显示 */}
{msg.role === 'assistant' && !msg.streaming && (
  <button
    onClick={() => { setCorrectingMessageId(msg.id); setCorrectionText(''); }}
    className="text-xs text-gray-400 hover:text-cyan-600 flex items-center gap-1 cursor-pointer transition-colors"
  >
    <Edit3 className="w-3 h-3" />
    纠正
  </button>
)}

{/* 纠正输入弹窗 */}
{correctingMessageId === msg.id && (
  <div className="mt-2 p-3 bg-cyan-50 border border-cyan-200 rounded-lg">
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-semibold text-cyan-700">请输入正确的回答</span>
      <button onClick={() => { setCorrectingMessageId(null); setCorrectionText(''); }}>
        <X className="w-3.5 h-3.5 text-gray-400" />
      </button>
    </div>
    <textarea
      value={correctionText}
      onChange={(e) => setCorrectionText(e.target.value)}
      placeholder="输入你认为正确的回答，系统将分析并提取教学经验..."
      className="w-full text-sm p-2 border border-cyan-200 rounded-md bg-white resize-none focus:outline-none focus:ring-2 focus:ring-cyan-100"
      rows={4}
    />
    <button
      onClick={handleCorrection}
      disabled={!correctionText.trim() || isAnalyzing}
      className="mt-2 px-4 py-1.5 text-sm font-semibold text-white bg-cyan-600 rounded-md hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center gap-2"
    >
      {isAnalyzing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {isAnalyzing ? '分析中...' : '提交纠正'}
    </button>
  </div>
)}
```

#### 2.5 确认 analyzeCorrection 的参数结构

读取 `frontend/src/services/agentApi.ts` 第 323-348 行，确认方法签名的参数名与上述调用一致。如参数结构不同，以实际代码为准调整 `handleCorrection` 中的传参。

### 验证方法

1. 启动前端，登录教师账号，进入助手预览页
2. 发送一条消息，收到 AI 回复
3. 点击 AI 回复上的"纠正"按钮，出现输入框
4. 输入纠正内容，点击"提交纠正"
5. 确认后端 `POST /api/agents/{agent_id}/analyze-correction` 被调用（查看后端日志或 Network 面板）
6. 确认纠正后输入框关闭

---

## 任务 3：清理 4 个死代码文件（P1）

### 问题

以下 4 个文件在全局搜索中无任何 `import` 引用，是项目初始化或重构遗留的死代码。

### 待删除文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `frontend/src/components/ItemForm.tsx` | 组件 | 脚手架遗留，无引用 |
| `frontend/src/components/ItemList.tsx` | 组件 | 脚手架遗留，无引用 |
| `frontend/src/components/structured-form/RadioCardGroup.tsx` | 组件 | 从未被使用 |
| `frontend/src/services/completionApi.ts` | 服务 | 从未被调用，关联的 `CompletionResult` 类型也仅在此文件中使用 |

### 前置验证

执行全局搜索确认无引用：

```powershell
# 在 frontend/src/ 目录中搜索以下关键词
# ItemForm — 应无 import 匹配
# ItemList — 应无 import 匹配（注意不要匹配 ItemListForm 等无关词）
# RadioCardGroup — 应无 import 匹配
# completionApi — 应无 import 匹配
```

### 注意事项

- `frontend/src/types/agent.ts` 中的 `CompletionResult` 接口仅被 `completionApi.ts` 使用，删除 `completionApi.ts` 后也应删除该接口定义
- 不要删除 `structured-form/` 目录下的其他文件（`KnowledgeLayerPanel.tsx`、`MultiTagSelect.tsx`、`TagSelect.tsx`、`TextInputWithHint.tsx` 均在使用中）

### 执行操作

1. 删除上述 4 个文件
2. 在 `frontend/src/types/agent.ts` 中删除 `CompletionResult` 接口定义（搜索 `CompletionResult` 定位）
3. 全局搜索确认无残留引用

### 验证方法

```powershell
cd frontend
npx tsc --noEmit
```
TypeScript 编译零错误。

---

## 任务 4：print() 替换为 logging 模块（P1）

### 问题

后端 5 个文件共 24 处 `print()` 语句用于调试日志，生产环境无法控制日志级别、无法过滤、无法结构化输出。

### 涉及文件与位置

| 文件 | 行号 | 内容摘要 | 建议日志级别 |
|------|------|----------|-------------|
| `backend/app/main.py` | 63, 66, 75, 106, 148, 188, 210, 225, 280, 288, 320 | 迁移日志 `[migrate] ...` | `logging.info` 或 `logging.debug` |
| `backend/app/routers/chat.py` | 111, 128, 238, 250, 273, 308, 379, 382 | 聊天调试日志 `[chat] ...` | `logging.debug` 或 `logging.info` |
| `backend/app/services/agent.py` | 259 | `[download_agent] 警告: 复制向量数据失败` | `logging.warning` |
| `backend/app/services/rag.py` | 71, 449 | Embedding 失败 / Chroma 复制失败 | `logging.warning` 或 `logging.error` |
| `backend/app/routers/knowledge.py` | 126 | `文件处理失败` | `logging.error` |

### 修改方法

#### 4.1 在 `backend/app/main.py` 顶部配置 logging

在 `main.py` 的 import 区域（`from fastapi import FastAPI` 之后）添加：

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
```

#### 4.2 在每个文件顶部获取 logger

在每个涉及文件中添加（如有 `__name__` 则用模块名）：

```python
import logging
logger = logging.getLogger(__name__)
```

#### 4.3 替换 print() 语句

| 原始模式 | 替换为 |
|----------|--------|
| `print("[migrate] xxx")` | `logger.info("xxx")` |
| `print("[chat] xxx")` | `logger.info("xxx")` |
| `print("[download_agent] 警告: xxx")` | `logger.warning("xxx")` |
| `print(f"xxx")` | `logger.info(f"xxx")` 或对应级别 |

保留原有消息内容，仅替换调用方式。

### 验证方法

```powershell
cd backend
python -m uvicorn app.main:app --reload --port 8000
```
- 启动时看到 `INFO` 级别迁移日志
- 发送一条聊天消息，确认日志正常输出
- 全局搜索 `print(` 应无匹配（除 `__pycache__` 外）

---

## 任务 5：前端空 catch 块补全错误反馈（P1）

### 问题

前端 5 个文件共 7 处空 catch 块，API 请求失败时用户无任何反馈，页面静默空白。

### 涉及文件与位置

| 文件 | 行号 | 当前代码 | 上下文 |
|------|------|----------|--------|
| `frontend/src/pages/student/LearningReport.tsx` | 17 | `.catch(() => {})` | 加载学习报告失败 |
| `frontend/src/pages/student/StudentSettings.tsx` | 38 | `.catch(() => {})` | 加载设置数据失败 |
| `frontend/src/pages/student/StudentSettings.tsx` | 61 | `catch { // 忽略错误 }` | 保存设置失败 |
| `frontend/src/pages/student/MistakeBook.tsx` | 41 | `catch { // 忽略错误 }` | 加载错题列表失败 |
| `frontend/src/pages/student/MistakeBook.tsx` | 58 | `catch { // 忽略错误 }` | 标记掌握失败 |
| `frontend/src/pages/student/StudentCourses.tsx` | 142-144 | `catch { // 忽略错误 }` | 加入课程失败 |
| `frontend/src/pages/student/StudentChat.tsx` | 27-29, 36-38 | `catch { return '' }` | 加载草稿失败 |

### 修改方法

#### 5.1 数据加载类（5 处）

对于页面初始数据加载失败的 catch 块，设置 error 状态：

```typescript
// 模式：加载失败时设置 error 状态
catch (err) {
  setError(err instanceof Error ? err.message : '数据加载失败');
} finally {
  setIsLoading(false);
}
```

如果页面没有 `error` 状态变量，需新增：
```typescript
const [error, setError] = useState<string | null>(null);
```
并在 JSX 中添加错误提示（参考其他页面的 error 展示模式）：
```tsx
{error && (
  <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm mb-4 border border-red-100">
    {error}
  </div>
)}
```

#### 5.2 操作类（2 处）

对于用户主动操作（保存设置、标记掌握、加入课程）失败的 catch 块，显示临时提示：

```typescript
catch (err) {
  // 方案 A：设置 error 状态，自动消失
  setError(err instanceof Error ? err.message : '操作失败，请重试');
  setTimeout(() => setError(null), 3000);
}
```

#### 5.3 草稿加载类（StudentChat.tsx，2 处）

这两处 `catch { return '' }` 是草稿加载的降级逻辑，返回空字符串是合理的。建议至少添加 console.error 便于开发排查：

```typescript
catch (err) {
  console.error('Failed to load draft:', err);
  return '';
}
```

### 验证方法

```powershell
cd frontend
npx tsc --noEmit
```
- 编译零错误
- 手动停止后端，在学生端页面操作，确认看到错误提示而非空白

---

## 任务 6：后端 except: pass 补充日志（P1）

### 问题

后端 3 个文件共 7 处 `except Exception: pass` 静默吞掉异常，LLM 多级降级时完全丢失错误信息，不利于排查。

### 涉及文件与位置

| 文件 | 行号 | 上下文 | 建议日志级别 |
|------|------|--------|-------------|
| `backend/app/routers/agent.py` | 633-634 | LLM JSON Mode 失败，降级到正则 | `logger.warning` |
| `backend/app/routers/agent.py` | 655-656 | LLM 正则提取失败，降级到第三级 | `logger.warning` |
| `backend/app/routers/agent.py` | 784-785 | 模块重生成 JSON Mode 失败 | `logger.warning` |
| `backend/app/routers/agent.py` | 808-809 | 模块重生成正则提取失败 | `logger.warning` |
| `backend/app/services/correction_analyzer.py` | 154-155 | LLM JSON Mode 失败降级 | `logger.warning` |
| `backend/app/services/correction_analyzer.py` | 169-170 | LLM 正则提取失败 | `logger.warning` |
| `backend/app/services/agent.py` | 24-25 | config 解析失败返回 `{}` | `logger.warning` |

### 修改方法

将 `pass` 替换为 `logger.warning`，保留降级逻辑不变：

```python
# 原始
except Exception:
    pass

# 替换为
except Exception as e:
    logger.warning(f"LLM JSON Mode 解析失败，降级到正则提取: {e}")
```

每个 catch 块根据上下文写不同的日志消息，描述降级行为。

### 前置依赖

本任务依赖任务 4 中已添加的 `import logging` 和 `logger = logging.getLogger(__name__)`。如先执行本任务，需先在对应文件添加 logger 定义。

### 验证方法

```powershell
cd backend
python -m uvicorn app.main:app --reload --port 8000
```
- 全局搜索 `except.*:\s*pass` 应无匹配（在 `backend/app/` 目录中）
- 功能正常，LLM 调用降级时日志中出现 warning 级别消息

---

## 任务 7：创建项目 README.md（P2）

### 问题

项目根目录无 `README.md`，新开发者无法快速了解项目架构、安装步骤和功能概览。

### 创建文件

`e:\aiskills\README.md`

### 文件内容

```markdown
# AI Skills 教育创新创作平台

面向高等教育的 AI 教学助手创作与部署平台。教师通过引导式表单创建教学智能体（Agent），上传知识库构建 RAG 引擎，学生使用智能体进行个性化学习。

## 技术栈

| 层 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Tailwind CSS + Vite |
| 后端 | Python FastAPI + SQLAlchemy 2.0 |
| 数据库 | SQLite（业务数据）+ ChromaDB（向量数据）|
| AI 服务 | SiliconFlow API（DeepSeek-V3.2 + BAAI/bge-m3）|
| 认证 | JWT（python-jose + bcrypt）|

## 快速开始

### 环境要求

- Python 3.10+
- Node.js 18+
- npm 或 pnpm

### 后端启动

```bash
cd backend
pip install -r requirements.txt

# 配置环境变量
cp .env.example .env
# 编辑 .env，至少设置 SECRET_KEY 和 SILICONFLOW_API_KEY

python -m uvicorn app.main:app --reload --port 8000
```

### 前端启动

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:5173

## 项目结构

```
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI 入口 + 迁移
│   │   ├── config.py         # 配置管理
│   │   ├── models/           # SQLAlchemy 模型
│   │   ├── schemas/          # Pydantic Schema
│   │   ├── routers/          # API 路由
│   │   ├── services/         # 业务逻辑（RAG、经验提取等）
│   │   └── utils/            # 工具函数
│   ├── .env.example          # 环境变量模板
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/            # 页面组件
│   │   │   ├── student/      # 学生端页面
│   │   │   └── *.tsx         # 教师端页面
│   │   ├── components/       # 通用组件
│   │   ├── services/         # API 调用
│   │   ├── types/            # TypeScript 类型
│   │   └── App.tsx           # 路由配置
│   └── package.json
└── README.md
```

## 核心功能

### 教师端
- 创建教学智能体（六步向导）
- 知识库管理（文件上传 + RAG 检索）
- 教学经验沉淀（对话自动提取 + 教师纠正分析）
- 课件/PPT 生成
- 教学反思分析
- 学习情况分析
- 技能文件管理（可挂载到智能体的能力指令）

### 学生端
- 课程发现与加入
- AI 对话学习
- 学习报告
- 错题本
- 个性化设置

## API 文档

启动后端后访问 http://localhost:8000/docs 查看 Swagger 文档。
```

### 验证方法

- 确认 `e:\aiskills\README.md` 文件存在
- 内容可正常渲染为 Markdown

---

## 任务 8：清理 StudentDashboard 不可达代码（P2）

### 问题

`frontend/src/pages/student/StudentDashboard.tsx` 中 `error` 状态变量被声明但从未被赋值（第 15 行），对应的错误展示 UI（第 44-50 行）永远不会渲染。

### 修改文件

`frontend/src/pages/student/StudentDashboard.tsx`

### 修改内容

#### 方案 A（推荐）：修复为可用错误状态

找到数据加载的 catch 块（约第 20-21 行），将 `.catch(() => null)` 改为：

```typescript
.catch((err) => {
  setError(err instanceof Error ? err.message : '数据加载失败');
})
```

确保 `error` 状态被正确设置，UI 分支变为可达。

#### 方案 B：删除不可达代码

如果确认不需要错误状态，则删除：
1. 第 15 行：`const [error, setError] = useState<string | null>(null);`
2. 第 44-50 行：整个 `{error && (...)}` JSX 块

### 验证方法

```powershell
cd frontend
npx tsc --noEmit
```
编译零错误。

---

## 任务 9：前端主题色提取为 CSS 变量（P2）

### 问题

学生端页面中 `#0891B2`（cyan-600 色值）在 6+ 文件中重复硬编码 50+ 次，修改主题色需逐处替换。

### 涉及文件

| 文件 | 出现次数（约） |
|------|--------------|
| `frontend/src/pages/student/StudentDashboard.tsx` | 8 处 |
| `frontend/src/pages/student/StudentCourses.tsx` | 10 处 |
| `frontend/src/pages/student/StudentChat.tsx` | 6 处 |
| `frontend/src/pages/student/MistakeBook.tsx` | 8 处 |
| `frontend/src/pages/student/LearningReport.tsx` | 12 处 |
| `frontend/src/pages/student/StudentSettings.tsx` | 8 处 |

### 修改方法

#### 9.1 在 `frontend/src/index.css` 中定义 CSS 变量

在 `:root` 或 `@layer base` 中添加：

```css
:root {
  --student-primary: #0891B2;
  --student-primary-light: #06B6D4;
  --student-primary-dark: #0E7490;
  --student-bg: #F0FDFF;
  --student-bg-card: #ECFEFF;
}
```

#### 9.2 全局替换硬编码色值

在上述 6 个文件中，将 `#0891B2` 替换为 Tailwind 的 `text-[var(--student-primary)]` 或 `bg-[var(--student-primary)]`。

> 注意：Tailwind 的任意值语法 `text-[var(--student-primary)]` 在 Vite + Tailwind CSS 中可用，无需额外配置。
>
> 如果项目使用了 `tailwind.config.ts` 的 `theme.extend.colors`，也可以在配置中添加：
> ```typescript
> colors: {
>   student: {
>     primary: '#0891B2',
>     light: '#06B6D4',
>     dark: '#0E7490',
>   }
> }
> ```
> 然后在组件中使用 `text-student-primary`、`bg-student-primary` 等。

#### 9.3 选择方案

根据项目现有 Tailwind 配置选择：
- 如果 `tailwind.config.ts` 中已有 `theme.extend.colors`，推荐使用方案 B（配置自定义颜色）
- 如果没有，推荐使用方案 A（CSS 变量 + 任意值语法）

### 验证方法

```powershell
cd frontend
npx tsc --noEmit
npm run build
```
- 编译零错误，Build 成功
- 启动前端，学生端页面样式无变化（颜色一致）
- 全局搜索 `#0891B2` 应仅在 `index.css` 或 `tailwind.config.ts` 中出现

---

## 最终验证清单

完成所有任务后，执行以下完整验证：

### 后端验证

```powershell
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

- [ ] 应用启动无报错
- [ ] SECRET_KEY 校验通过
- [ ] 访问 `http://localhost:8000/docs` 确认所有路由正常
- [ ] 全局搜索 `print(` 无匹配（`backend/app/` 目录）
- [ ] 全局搜索 `deepseek-ai/DeepSeek-V3.2` 仅在 `config.py` 中出现
- [ ] 全局搜索 `except.*:\s*pass` 无匹配（`backend/app/` 目录）

### 前端验证

```powershell
cd frontend
npx tsc --noEmit
npm run build
```

- [ ] TypeScript 编译零错误
- [ ] Build 成功
- [ ] 全局搜索 `ItemForm`、`ItemList`、`RadioCardGroup`、`completionApi` 无 import 匹配
- [ ] 全局搜索 `#0891B2` 仅在配置文件中出现
- [ ] 死代码文件已删除

### 功能验证

1. 登录教师账号，进入助手预览页
2. 发送消息，点击 AI 回复的"纠正"按钮，输入纠正内容提交
3. 确认后端日志输出 warning 级别降级信息（如触发降级）
4. 登录学生账号，确认所有学生端页面正常加载
5. 停止后端，刷新学生端页面，确认看到错误提示而非空白

---

## 禁止事项

- 不要修改后端 API 接口签名或路由路径
- 不要引入新的 Python 或 npm 依赖
- 不要改变任何业务逻辑（LLM 降级策略、RAG 检索流程、经验提取算法等）
- 不要删除 `backend/app/main.py` 中的 `_lightweight_migrate()` 迁移函数
- 不要修改 `backend/.env` 中的真实密钥值
- 不要修改带 `_file` 后缀的文件（`skill_file.py`、`agent_skill.py` 等）
