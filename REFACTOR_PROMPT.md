# 方案 B 重构 Prompt（直接复制以下全部内容转发给 AI）

---

你是一名全栈工程师，需要对「AI Skills 教育创新创作平台」进行架构重构。项目位于 d:\AI skills_jy_app，后端在 backend/ 目录（Python FastAPI + SQLAlchemy + SQLite + ChromaDB），前端在 frontend/src/ 目录（React 18 + TypeScript + Tailwind CSS + Vite）。

## 一、重构目标

当前项目的"Skill"实体实质是"配置型 RAG 对话智能体"（包含角色定义 systemPrompt + 知识库 + 检索参数 + 对话历史），而非"可挂载的技能文件"。本次重构将：

1. 将现有 Skill 实体重命名为 Agent（教学助手），保持其智能体语义不变
2. 新建 SkillFile 实体作为真正的"技能文件"（一段可挂载到 Agent 上的能力指令文本）
3. 新建 AgentSkill 关联表实现多对多挂载关系（一个 Agent 可挂载多个 SkillFile，一个 SkillFile 可被多个 Agent 挂载）
4. 对话时将 Agent 的 systemPrompt + 所有已挂载 SkillFile 的 content 拼接为最终 system message
5. 现有市场改为"教学助手市场"，新增"技能市场"入口

## 二、当前代码结构（必读，不要猜测）

### 后端模型层（backend/app/models/）
- skill.py: class Skill, __tablename__="skills"，字段: id, user_id(FK users.id), name, course_name, template, status, config(JSON), version, created_at, updated_at
- conversation.py: class Conversation, __tablename__="conversations"，字段含 skill_id(FK skills.id)
- knowledge.py: class KnowledgeFile, __tablename__="knowledge_files"，字段含 skill_id(FK skills.id, nullable=True)
- document.py: class GeneratedDocument，含 skill_id 引用
- __init__.py: 导出 User, Skill, KnowledgeFile, KnowledgeChunk, Conversation, Message, GeneratedDocument

### 后端 Schema 层（backend/app/schemas/skill.py）
- SkillBase, SkillCreate, SkillUpdate, SkillResponse, SkillMarketplaceItem, SkillMarketplacePage

### 后端 Service 层
- services/skill.py: create_skill, update_skill, get_skill, get_marketplace_skills, get_marketplace_skill, publish_skill, download_skill, get_skill_stats（约 8 个函数）
- services/rag.py: retrieve_for_rag(db, user_id, skill_id, ...), store_chunks_to_chroma(skill_id, ...), copy_chroma_collection(src_id, new_id), Chroma collection 名为 f"skill_{skill_id}"
- services/courseware_generator.py: 引用 skill_id
- services/document_generator.py: 引用 skill_id

### 后端 Router 层
- routers/skill.py: 路由前缀 /api/skills/，含 create, update, get, list, publish, download, marketplace, generate-prompt, optimize-prompt, generate-courseware, stats
- routers/chat.py: POST /api/skills/{skill_id}/chat，引用 skill_id
- routers/knowledge.py: POST /api/knowledge/upload?skill_id=，引用 skill_id
- routers/documents.py: 引用 skill_id
- main.py: 注册路由 app.include_router(skill_router, prefix="/api")，含 _lightweight_migrate() 为 knowledge_files 补 skill_id 列

### 前端结构
- types/skill.ts: Skill, SkillConfig, SkillCreateData, SkillUpdateData, SkillMarketplaceItem, SkillMarketplacePage 等接口
- services/skillApi.ts: getAll, getById, create, update, publish, downloadSkill, getMarketplace, getMarketplaceSubjects, getMarketplaceSkill, generatePrompt, optimizePrompt, getStats, generateCourseware
- services/chatApi.ts: sendMessage(token, skillId, ...)
- services/knowledgeApi.ts: 引用 skill_id
- pages/SkillCreate.tsx: 六步向导创建流程
- pages/SkillPreview.tsx: 预览对话页
- pages/Marketplace.tsx: 市场页
- pages/Dashboard.tsx: 工作台
- pages/Knowledge.tsx: 知识库管理
- pages/Documents.tsx: 文档管理
- components/SkillChat.tsx: 对话组件
- components/TeacherLayout.tsx: 侧边栏导航
- components/KnowledgeUpload.tsx: 知识库上传组件
- App.tsx: 路由表

### 统计数据
- 后端 139 处 skill_id 引用，分布在 11 个文件
- 前端 124 处 skill 相关引用，分布在 14 个文件

## 三、分阶段执行路线（严格按顺序执行，每阶段完成后验证编译）

### 阶段 1: 后端数据模型层（backend/app/models/）

1.1 将 models/skill.py 重命名为 models/agent.py，类名 Skill→Agent，__tablename__="agents"，所有字段不变，relationship("Skill")→relationship("Agent")

1.2 新建 models/skill_file.py:
```python
class SkillFile(Base):
    __tablename__ = "skill_files"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    content = Column(Text, nullable=False)  # 技能指令文本（prompt 片段）
    source = Column(String, nullable=True)  # 来源: "manual" | "github" | "marketplace"
    github_source = Column(JSON, nullable=True)  # {repo, path, branch, commit_sha, raw_url}
    status = Column(String, nullable=False, default="draft")  # draft | published
    version = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    user = relationship("User")
```

1.3 新建 models/agent_skill.py（多对多关联表）:
```python
class AgentSkill(Base):
    __tablename__ = "agent_skills"
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False, index=True)
    skill_file_id = Column(Integer, ForeignKey("skill_files.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
```

1.4 更新 models/conversation.py: skill_id→agent_id, ForeignKey("skills.id")→ForeignKey("agents.id"), relationship("Skill")→relationship("Agent")

1.5 更新 models/knowledge.py: skill_id→agent_id, ForeignKey("skills.id")→ForeignKey("agents.id")

1.6 更新 models/document.py: skill_id→agent_id, ForeignKey("skills.id")→ForeignKey("agents.id")

1.7 更新 models/__init__.py: 导出 Agent（替代 Skill）, SkillFile, AgentSkill

### 阶段 2: 数据库迁移（backend/app/main.py）

SQLite 不支持 RENAME TABLE with FK 约束变更，迁移策略：
2.1 修改 _lightweight_migrate() 函数，在启动时执行以下 SQL 迁移（用 try-except 包裹，已存在则跳过）：
- CREATE TABLE agents AS SELECT * FROM skills（复制数据和结构）
- DROP TABLE skills
- 重命名 conversations.skill_id 列为 agent_id（SQLite 需要：建新表→导数据→删旧表→重命名）
- 重命名 knowledge_files.skill_id 列为 agent_id（同上方式）
- 重命名 generated_documents 中的 skill_id 为 agent_id（同上方式）
- CREATE TABLE skill_files（新表）
- CREATE TABLE agent_skills（新表）

2.2 迁移脚本必须幂等（重复执行不报错），用 PRAGMA table_info 检查列是否存在再决定是否执行

### 阶段 3: 后端 Schema 层（backend/app/schemas/）

3.1 将 schemas/skill.py 重命名为 schemas/agent.py，所有类名 Skill*→Agent*（SkillBase→AgentBase, SkillCreate→AgentCreate, SkillUpdate→AgentUpdate, SkillResponse→AgentResponse, SkillMarketplaceItem→AgentMarketplaceItem, SkillMarketplacePage→AgentMarketplacePage）

3.2 新建 schemas/skill_file.py:
```python
class SkillFileBase(BaseModel):
    name: str
    description: str | None = None
    content: str

class SkillFileCreate(SkillFileBase):
    source: str = "manual"
    github_source: dict | None = None

class SkillFileUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    content: str | None = None
    status: str | None = None

class SkillFileResponse(SkillFileBase):
    id: int
    user_id: int
    source: str
    github_source: dict | None
    status: str
    version: int
    created_at: datetime
    updated_at: datetime | None
    class Config:
        from_attributes = True

class MountSkillRequest(BaseModel):
    skill_file_id: int
```

### 阶段 4: 后端 Service 层

4.1 将 services/skill.py 重命名为 services/agent.py，所有函数名 create_skill→create_agent, update_skill→update_agent, get_skill→get_agent, get_marketplace_skills→get_marketplace_agents, get_marketplace_skill→get_marketplace_agent, publish_skill→publish_agent, download_skill→download_agent, get_skill_stats→get_agent_stats。函数内部所有 skill_id→agent_id, Skill→Agent, "skills"→"agents"。

4.2 新建 services/skill_file.py: create_skill_file, update_skill_file, get_skill_file, get_user_skill_files, delete_skill_file, mount_skill_to_agent(agent_id, skill_file_id), unmount_skill_from_agent(agent_id, skill_file_id), get_agent_skills(agent_id), get_marketplace_skill_files, download_skill_file。download_skill_file 创建独立副本（复制 content，标记 source="marketplace"，记录 downloaded_from）。

4.3 更新 services/rag.py: 所有 skill_id 参数名→agent_id, f"skill_{skill_id}"→f"agent_{agent_id}", retrieve_for_rag(db, user_id, agent_id, ...), store_chunks_to_chroma(agent_id, ...), copy_chroma_collection(src_id, new_id) 内部 collection 名改为 f"agent_{id}"。

4.4 更新 services/courseware_generator.py: skill_id→agent_id

4.5 更新 services/document_generator.py: skill_id→agent_id

### 阶段 5: 后端 Router 层

5.1 将 routers/skill.py 重命名为 routers/agent.py:
- 路由前缀改为 /api/agents/
- 所有路径参数 skill_id→agent_id
- 所有 from ..schemas.skill import → from ..schemas.agent import
- 所有 from ..services.skill import → from ..services.agent import
- generate-prompt 元提示模板中"Skill"文案改为"教学助手"
- 新增端点:
  - POST /api/agents/{agent_id}/skills/mount（挂载技能文件）
  - POST /api/agents/{agent_id}/skills/unmount（卸载技能文件）
  - GET /api/agents/{agent_id}/skills（获取已挂载技能列表）

5.2 新建 routers/skill_file.py:
- 路由前缀 /api/skill-files/
- POST /（创建技能文件）
- GET /（获取用户技能文件列表）
- GET /{id}（获取单个）
- PUT /{id}（更新）
- DELETE /{id}（删除）
- POST /{id}/publish（发布到技能市场）
- POST /{id}/download（下载市场技能文件副本）
- GET /marketplace（技能市场列表）
- GET /marketplace/{id}（技能市场详情）
- POST /import-github（从 GitHub raw URL 导入技能文件，用 httpx 拉取内容，解析 frontmatter 提取 name/description，正文作为 content）

5.3 更新 routers/chat.py:
- 路径 /api/skills/{skill_id}/chat → /api/agents/{agent_id}/chat
- skill_id→agent_id
- 关键改动：在构建 system_prompt 时，查询该 Agent 已挂载的所有 SkillFile，将 content 拼接到 systemPrompt 之后：
```python
# 查询已挂载的技能文件
agent_skills = db.query(AgentSkill).filter(AgentSkill.agent_id == agent.id).all()
skill_contents = []
for as_rel in agent_skills:
    sf = db.query(SkillFile).filter(SkillFile.id == as_rel.skill_file_id).first()
    if sf:
        skill_contents.append(f"\n\n## 已挂载技能：{sf.name}\n{sf.content}")
full_system_prompt = system_prompt + "".join(skill_contents)
```
- 用 full_system_prompt 替代原来的 system_prompt 传给 stream_llm_answer

5.4 更新 routers/knowledge.py: skill_id→agent_id, 所有 _assert_skill_owned_by_user→_assert_agent_owned_by_user, 查询 Skill→查询 Agent

5.5 更新 routers/documents.py: skill_id→agent_id

5.6 更新 main.py:
- from .models import User, Agent, SkillFile, AgentSkill, KnowledgeFile, Conversation, Message, GeneratedDocument
- from .routers.agent import router as agent_router
- from .routers.skill_file import router as skill_file_router
- app.include_router(agent_router, prefix="/api")
- app.include_router(skill_file_router, prefix="/api")
- 删除旧 skill_router 引用

### 阶段 6: 前端类型层

6.1 将 types/skill.ts 重命名为 types/agent.ts，所有接口 Skill→Agent（SkillConfig→AgentConfig, SkillCreateData→AgentCreateData, SkillUpdateData→AgentUpdateData, SkillMarketplaceItem→AgentMarketplaceItem, SkillMarketplacePage→AgentMarketplacePage）

6.2 新建 types/skillFile.ts:
```typescript
export interface SkillFile {
  id: number;
  user_id: number;
  name: string;
  description?: string | null;
  content: string;
  source: 'manual' | 'github' | 'marketplace';
  github_source?: { repo: string; path: string; branch: string; commit_sha?: string; raw_url: string } | null;
  status: 'draft' | 'published';
  version: number;
  created_at: string;
  updated_at: string | null;
}
export interface SkillFileCreateData { name: string; description?: string; content: string; source?: string; github_source?: any; }
export interface SkillFileUpdateData { name?: string; description?: string; content?: string; status?: string; }
export interface SkillFileMarketplaceItem { id: number; name: string; description?: string | null; content: string; source: string; author_id: number; author_name?: string; usage_count: number; created_at: string; }
```

### 阶段 7: 前端 API 层

7.1 将 services/skillApi.ts 重命名为 services/agentApi.ts，导出对象名 skillApi→agentApi，所有方法中 skillId→agentId，路径 /api/skills/→/api/agents/

7.2 新建 services/skillFileApi.ts:
- getAll(token), getById(token, id), create(token, data), update(token, id, data), delete(token, id), publish(token, id), download(token, id), getMarketplace(token, query), getMarketplaceById(token, id), importFromGithub(token, rawUrl), mountToAgent(token, agentId, skillFileId), unmountFromAgent(token, agentId, skillFileId), getAgentSkills(token, agentId)

7.3 更新 services/chatApi.ts: skillId→agentId, 路径 /api/skills/→/api/agents/

7.4 更新 services/knowledgeApi.ts: skill_id→agent_id, 路径不变但参数名改

7.5 更新 services/documentApi.ts: skillId→agentId

### 阶段 8: 前端组件层

8.1 将 components/SkillChat.tsx 重命名为 components/AgentChat.tsx，组件名 SkillChat→AgentChat，props 中 skillId→agentId，内部引用 skillApi→agentApi，文案中"AI 教学助手"保持不变

8.2 更新 components/TeacherLayout.tsx: 导航项"我的 Skills"→"我的助手"，新增"技能管理"导航项 path="/teacher/skill-files"

8.3 更新 components/KnowledgeUpload.tsx: skillId→agentId, skillApi→agentApi

### 阶段 9: 前端页面层（重命名+文案更新+新页面）

9.1 将 pages/SkillCreate.tsx 重命名为 pages/AgentCreate.tsx，组件名 SkillCreate→AgentCreate，内部 skillApi→agentApi, Skill→Agent 类型引用，文案"创建 Skill"→"创建教学助手"。在 Step 5（知识库上传）和 Step 6（预览保存）之间不需要新增步骤，但在 Step 6 预览页中新增"技能增强"折叠面板，显示已挂载的技能文件列表和挂载/卸载操作。

9.2 将 pages/SkillPreview.tsx 重命名为 pages/AgentPreview.tsx，组件名 SkillPreview→AgentPreview，引用全部更新。新增"已挂载技能"展示区（在配置摘要面板中），显示技能名称列表和卸载按钮，以及"挂载技能"下拉选择器。

9.3 更新 pages/Dashboard.tsx: skillApi→agentApi, Skill→Agent, 文案"我的 Skills"→"我的助手"

9.4 更新 pages/Marketplace.tsx: skillApi→agentApi, 文案"Skills 市场"→"助手市场"，顶部新增 Tab 切换"教学助手"/"技能文件"两个视图。技能文件视图复用卡片布局但展示 SkillFile 数据。

9.5 更新 pages/Knowledge.tsx: skill_id→agent_id, skillApi→agentApi

9.6 更新 pages/Documents.tsx: skillId→agentId, skillApi→agentApi

9.7 新建 pages/SkillFiles.tsx（技能文件管理页）:
- 顶部：技能文件列表（卡片网格，每张卡片显示名称、描述、来源标签、状态标签、操作按钮）
- 创建按钮：打开弹窗（名称+描述+内容文本框），或粘贴 GitHub raw URL 导入
- 编辑弹窗：可修改名称、描述、内容
- 发布按钮：发布到技能市场
- 布局复用 Knowledge.tsx 的结构风格

### 阶段 10: 前端路由层

10.1 更新 App.tsx:
- import 路径全部更新（AgentCreate 替代 SkillCreate 等）
- 路由 /teacher/skills/create → /teacher/agents/create
- 路由 /teacher/skills/:id/preview → /teacher/agents/:id/preview
- 新增路由 /teacher/skill-files → SkillFiles 组件

10.2 全局搜索替换：确保所有 navigate() 调用中的路径已更新（如 Dashboard 中的 navigate('/teacher/skills/create') → navigate('/teacher/agents/create')）

### 阶段 11: 验证

11.1 后端验证: cd backend && python -m py_compile app/main.py（检查语法），然后启动 uvicorn 确认无导入错误

11.2 前端验证: cd frontend && npx tsc --noEmit（检查 TypeScript 编译），然后 npm run dev 确认无运行时错误

11.3 功能验证清单:
- 登录后进入工作台，导航显示"我的助手"和"技能管理"
- 创建教学助手流程正常（六步向导）
- 预览页对话功能正常
- 技能管理页可创建技能文件
- 预览页可挂载/卸载技能文件
- 挂载技能后对话时 AI 行为受技能内容增强
- 助手市场正常浏览和下载
- 知识库上传正常

## 四、执行注意事项

1. 先完成后端全部改动（阶段 1-5），验证后端能启动，再做前端（阶段 6-10）
2. 数据库迁移脚本必须幂等，用 PRAGMA table_info 检查列/表是否存在
3. ChromaDB 的 collection 名从 skill_{id} 改为 agent_{id}，已存在的旧 collection 需要在迁移时重命名（或保留旧名兼容，查询时先试 agent_ 再试 skill_）
4. 前端文件重命名时用 git mv 保留历史，再做内容修改
5. 全局搜索 skill_id 确保没有遗漏（后端 139 处，前端 124 处）
6. 不要改变任何业务逻辑，只做重命名+新增技能文件机制
7. 文案替换范围：UI 中的"Skill"/"Skills"→"教学助手"/"助手"，但代码中的变量名用 agent/Agent
8. generate-prompt 元提示模板中的"Skill"改为"教学助手"，但生成的 prompt 内容结构不变
9. 前端 ChatDB 引用的 conversation 表中 skill_id 改为 agent_id，确保对话历史查询正常
10. 市场页的 Tab 切换是纯前端交互，两个 Tab 共用同一个页面组件但调用不同 API

## 五、开始执行

请从阶段 1 开始，逐阶段执行。每完成一个阶段，简述改动内容。全部完成后运行验证。
