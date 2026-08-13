# AI Skills 教育创新创作平台 — Code Wiki

> 本文档面向开发者，系统化说明项目仓库的整体架构、模块职责、关键类与函数、数据模型、API 接口、核心业务逻辑、依赖关系以及项目运行方式。帮助你快速理解代码库并上手开发。

---

## 目录

1. [项目概述](#1-项目概述)
2. [整体架构](#2-整体架构)
3. [技术栈](#3-技术栈)
4. [目录结构](#4-目录结构)
5. [后端模块详解](#5-后端模块详解)
6. [数据模型与关系](#6-数据模型与关系)
7. [API 端点汇总](#7-api-端点汇总)
8. [前端模块详解](#8-前端模块详解)
9. [核心业务逻辑](#9-核心业务逻辑)
10. [模块依赖关系](#10-模块依赖关系)
11. [项目运行方式](#11-项目运行方式)
12. [环境配置与安全](#12-环境配置与安全)

---

## 1. 项目概述

**AI Skills 教育创新创作平台** 是一个面向高等教育的 AI 教学助手创作与部署平台。教师通过引导式表单创建教学智能体（Agent），上传知识库构建 RAG（检索增强生成）引擎，学生则使用智能体进行个性化学习。

平台核心能力：

- **教师端**：创建教学智能体（六步向导）、知识库管理（文件上传 + RAG 检索）、教学经验沉淀（五层经验机制）、课件/PPT 生成、教学反思分析、学情分析、技能文件管理（可挂载到智能体的能力指令）。
- **学生端**：课程发现与加入、AI 对话学习、学习报告、错题本、个性化设置、草稿课程管理。

---

## 2. 整体架构

系统采用 **前后端分离** 的经典分层架构：

```
┌─────────────────────────── 前端 ───────────────────────────┐
│  React 19 + TypeScript + Vite + Tailwind CSS 4              │
│  ├── 教师端页面 (pages/*.tsx)                               │
│  ├── 学生端页面 (pages/student/*.tsx)                       │
│  └── services/ 封装所有后端 API 调用                        │
└──────────────┬──────────────────────────────────────────────┘
               │  HTTP /api（Vite 代理转发，SSE 流式对话）
               ▼
┌─────────────────────────── 后端 ───────────────────────────┐
│  FastAPI (Uvicorn) 端口 8002                                │
│  ├── routers/   API 路由层（12 个模块）                     │
│  ├── services/  业务逻辑层（RAG、经验提取、文档生成等）      │
│  ├── models/    SQLAlchemy ORM 模型                         │
│  ├── schemas/   Pydantic 请求/响应模型                      │
│  └── utils/     工具函数（JWT 鉴权、密码加密）              │
└──────────────┬──────────────────────────────────────────────┘
               │
        ┌──────┴───────────┬──────────────────────┐
        ▼                  ▼                      ▼
   SQLite (业务数据)    ChromaDB (向量数据)     SiliconFlow API
   app.db / ai_skills.db chroma_data/           (DeepSeek-V3.2
                                                 + BAAI/bge-m3)
```

**数据流概览**：

- **知识库上传**：文件 → 解析 → 语义分块 → 过滤 → 生成向量（bge-m3）→ 存入 Chroma 集合 `agent_{agent_id}`。
- **对话问答**：用户提问 → RAG 向量检索 → 组装上下文 → 调用 LLM（DeepSeek-V3.2）→ SSE 流式返回 → 记录消息。
- **五层经验沉淀**：教师对话/纠正/上传文档 → 分析提取 → 增量写入 `agent.config.fiveLayerKnowledge` → 反哺后续对话与备课。

---

## 3. 技术栈

| 层 | 技术 | 版本/说明 |
|------|------|------|
| 前端框架 | React + TypeScript | React ^19.1.0 |
| 构建工具 | Vite | ^6.3.5 |
| 样式 | Tailwind CSS | ^4.3.3（`@tailwindcss/vite` 插件） |
| 路由 | React Router | ^7.18.1 |
| Markdown 渲染 | react-markdown | ^10.1.0 |
| 图标 | lucide-react | ^1.26.0 |
| 后端框架 | FastAPI | 0.115.0 |
| ASGI 服务器 | Uvicorn | 0.30.6 |
| ORM | SQLAlchemy | 2.0.35 |
| 数据校验 | Pydantic / pydantic-settings | 2.9.2 / 2.6.0 |
| 认证 | python-jose + passlib(bcrypt) | JWT + bcrypt |
| 文档解析 | PyPDF2 / python-docx / python-pptx | PDF / Word / PPT |
| 向量数据库 | ChromaDB | >= 0.5.0 |
| LLM 客户端 | openai | >= 1.40.0（SiliconFlow 兼容） |
| 业务数据库 | SQLite | 通过 SQLAlchemy |

---

## 4. 目录结构

```
e:\aiskills\
├── backend/                          # 后端服务
│   ├── app/
│   │   ├── main.py                   # FastAPI 入口 + 轻量迁移 + 启动播种
│   │   ├── config.py                 # 配置管理（Pydantic Settings）
│   │   ├── database.py               # SQLAlchemy 引擎/session/Base
│   │   ├── models/                   # ORM 模型（12 个）
│   │   ├── schemas/                  # Pydantic 模型（agent/auth/skill_file）
│   │   ├── routers/                  # API 路由（12 个模块）
│   │   ├── services/                 # 业务逻辑（RAG、经验提取、文档生成等）
│   │   └── utils/                    # 工具（auth 鉴权、security 加密）
│   ├── chroma_data/                  # ChromaDB 向量持久化目录
│   ├── knowledge_materials/          # 内置知识库素材（16 个 md 文件）
│   ├── uploads/knowledge/            # 上传的知识库文件
│   ├── outputs/                      # 生成的 PPT/Word 输出
│   ├── .env / .env.example           # 环境变量
│   ├── requirements.txt              # Python 依赖
│   ├── upload_all.py                 # 内置知识库批量上传脚本
│   └── app.db                        # SQLite 业务数据库
├── frontend/                         # 前端服务
│   ├── src/
│   │   ├── pages/                    # 页面组件（教师端 + student/ 学生端）
│   │   ├── components/               # 通用组件
│   │   ├── services/                 # API 调用封装
│   │   ├── contexts/                 # React Context
│   │   ├── types/                    # TypeScript 类型
│   │   ├── App.tsx                   # 路由配置
│   │   └── main.tsx                  # 入口
│   ├── vite.config.ts                # Vite 配置（/api 代理到 8002）
│   └── package.json
├── ai-skills-prototypes/             # HTML 原型设计稿
├── student-workbench-prd/            # 学生端 PRD 文档
├── skill-creation-prd/               # 技能创建 PRD 文档
├── README.md                         # 项目说明
└── *.md                              # 各类 PRD/清理/重构说明文档
```

---

## 5. 后端模块详解

### 5.1 入口与应用装配 — [main.py](file:///e:/aiskills/backend/app/main.py)

应用启动的核心装配点，职责包括：

- **创建 FastAPI 应用**：`app = FastAPI(title="AI Skills Platform", version="1.0.0")`。
- **CORS 配置**：从 `settings.CORS_ORIGINS` 读取逗号分隔的前端来源。
- **全局建表**：`Base.metadata.create_all(bind=engine)` 创建所有 ORM 表。
- **挂载路由**：12 个 router 全部以 `/api` 前缀挂载。
- **`_lightweight_migrate()`**：启动时执行的幂等 SQLite 迁移，将旧的 `skills` 表迁移重命名为 `agents`，并把 `skill_id` 相关列改为 `agent_id`，同时幂等创建 `skill_files`、`agent_skills`、学生端表、`lesson_plans`、`teaching_reflections` 等表。
- **启动生命周期钩子**：
  - `_maybe_run_onetime_cleanup()`：当环境变量 `CLEANUP_TEST_DATA_ON_START=true` 且无标记文件时，执行一次保留内建的测试数据清理。
  - `on_startup_seed_and_cleanup()`：每次启动调用 `seed_builtins()` 幂等播种平台内置助手与技能。
- **基础端点**：`GET /`（欢迎信息）、`GET /api/health`（健康检查）。

### 5.2 配置管理 — [config.py](file:///e:/aiskills/backend/app/config.py)

`Settings(BaseSettings)` 类，从 `.env` 读取全部配置：

| 配置项 | 默认值 | 说明 |
|------|------|------|
| `DATABASE_URL` | `sqlite:///../app.db` | 业务数据库连接串 |
| `SECRET_KEY` | 空（强制注入） | JWT 密钥，启动时校验，弱值直接抛异常 |
| `ALGORITHM` | `HS256` | JWT 加密算法 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Token 有效期（分钟） |
| `UPLOAD_DIR` / `OUTPUT_DIR` | `./uploads` / `./outputs` | 文件存储目录 |
| `CHROMA_PERSIST_DIR` | `./chroma_data` | Chroma 向量持久化目录 |
| `CORS_ORIGINS` | 两个 localhost | 允许的前端来源（逗号分隔） |
| `SILICONFLOW_API_KEY` | 空 | SiliconFlow API 密钥 |
| `SILICONFLOW_BASE_URL` | `https://api.siliconflow.cn/v1` | LLM/Embedding 服务地址 |
| `EMBEDDING_MODEL` | `BAAI/bge-m3` | 向量化模型 |
| `CHAT_MODEL` | `deepseek-ai/DeepSeek-V3.2` | 对话模型 |
| `CLEANUP_TEST_DATA_ON_START` | `False` | 启动时是否执行一次性清理 |

### 5.3 数据库连接 — [database.py](file:///e:/aiskills/backend/app/database.py)

- `engine`：SQLAlchemy 引擎，SQLite 使用 `check_same_thread=False`。
- `SessionLocal`：session 工厂（`autocommit=False, autoflush=False`）。
- `Base`：declarative 基类。
- `get_db()`：FastAPI 依赖，提供请求级 session，请求结束自动关闭。

### 5.4 工具层 — utils/

**[security.py](file:///e:/aiskills/backend/app/utils/security.py)：**

- `verify_password(plain, hashed)`：bcrypt 校验密码。
- `get_password_hash(password)`：bcrypt 生成密码哈希（截断到 72 字节）。
- `create_access_token(data, expires_delta)`：生成 JWT（含 `exp`）。
- `decode_access_token(token)`：解码并校验 JWT，失败返回 `None`。

**[auth.py](file:///e:/aiskills/backend/app/utils/auth.py)：**

- `oauth2_scheme`：OAuth2PasswordBearer 认证方案（tokenUrl=`api/auth/login`）。
- `get_current_user(token, db)`：FastAPI 依赖，解码 token 并加载用户，失败抛 401。
- `require_role(role)`：依赖工厂，返回一个检查当前用户角色的依赖（用于 `student` 等角色权限控制）。

### 5.5 模型层 — models/

各模型类详见 [第 6 节 数据模型与关系](#6-数据模型与关系)。`models/__init__.py` 统一导出全部模型。

### 5.6 Schema 层 — schemas/

**[auth.py](file:///e:/aiskills/backend/app/schemas/auth.py)：** `UserCreate`、`LoginRequest`、`UserUpdate`、`Token`、`UserResponse`。

**[agent.py](file:///e:/aiskills/backend/app/schemas/agent.py)：**

- `AgentCreate` / `AgentUpdate` / `AgentResponse`：Agent 创建、更新、响应模型。
- `AgentMarketplaceItem`：市场卡片数据（含作者信息、使用量、内建标记、分类）。
- `AgentMarketplacePage`：市场分页响应。

**[skill_file.py](file:///e:/aiskills/backend/app/schemas/skill_file.py)：** `SkillFileBase/Create/Update/Response`、`MountSkillRequest`。

### 5.7 服务层 — services/（核心业务逻辑）

**auth.py — 认证服务：**
- `get_user_by_email` / `get_user_by_username`：按邮箱/用户名查用户。
- `create_user`：创建用户（密码哈希后入库）。
- `authenticate_user`：校验用户名密码。
- `generate_token`：为用户生成 JWT。
- `update_user_profile`：更新用户资料。

**agent.py — Agent 业务：**
- `_parse_agent_config(raw)`：安全解析 `agent.config`（兼容双重 JSON 编码脏数据）。
- `get_agents_by_user` / `get_agent_by_id`：查询用户 Agent。
- `get_marketplace_agents(...)`：市场列表查询，支持关键词/模板/学科/排序/发布范围/分页，内建助手永远排前。
- `create_agent` / `update_agent`：创建/更新 Agent，并同步 `knowledgeFileIds` 与 `KnowledgeFile.agent_id` 的关联。
- `publish_agent`：发布到市场（`status=published`，version+1），已下载副本不可发布。
- `download_agent`：下载市场 Agent 副本，深拷贝 config、复制知识库文件记录并复制 Chroma 向量（`copy_chroma_collection`）。

**rag.py — RAG 核心（最重要）：**
- `_get_client()`：构建 SiliconFlow 的 OpenAI 兼容客户端。
- `_get_collection(agent_id)`：获取/创建 Chroma 集合 `agent_{agent_id}`（余弦距离）。
- `generate_embedding` / `generate_embeddings_batch`：调用 bge-m3 生成向量。
- `store_chunks_to_chroma`：把分块 + 向量写入 Chroma。
- `delete_file_from_chroma`：从 Chroma 删除某文件的所有块。
- `retrieve_for_rag(db, user_id, agent_id, query, top_k, threshold)`：向量检索，按 `agent_id` 关联已处理文件，相似度过滤后返回召回结果。
- `build_context(retrieved_chunks)`：组装带来源标注的上下文文本。
- `generate_answer(...)`：非流式 LLM 生成，返回回答 + 来源。
- `stream_llm_answer(...)`：流式 LLM 生成（逐 token yield）。
- `chunk_text_semantic(text, chunk_size, overlap)`：语义分块（按句拆分 + 重叠）。
- `filter_chunks` / `_is_low_quality`：过滤过短、低质量、重复块。
- `copy_chroma_collection(src_id, dst_id)`：复制向量集合（用于 Agent 下载）。

**knowledge.py — 文档解析服务：**
- `parse_document(file_path, file_type)`：解析 PDF/Word/文本，返回清理后的文本与统计。
- `clean_text` / `_remove_headers_footers` / `_merge_broken_line` / `_is_noise_line`：文本清洗（去页眉页脚、噪声行、断行合并）。

**document_generator.py — 对话内 PPT 生成：**
- `extract_and_generate_ppt(llm_response)`：从 LLM 回复中提取 ```` ```doc_gen ```` JSON 块，用 python-pptx 生成真实 `.pptx` 文件，返回文件名与下载 URL。

**document_service.py — 文档生成服务：**
- `_get_llm_client()` / `_call_llm(prompt)` / `_extract_json(text)`：LLM 调用与 JSON 提取（兼容 markdown 代码块）。
- `generate_ppt(...)` / `generate_word(...)`：调用 LLM 生成大纲 → python-pptx/python-docx 生成真实文件，含 `_ppt_fallback` / `_word_fallback` 降级内容。

**courseware_generator.py — 课件生成（含 RAG + 五层注入）：**
- `generate_courseware_file(...)`：课件生成主流程入口（RAG 检索 → LLM 生成 → 写 Word/PPT）。
- `_build_teaching_config(five_layer)`：从五层经验构建教学策略上下文。
- `_build_word_courseware` / `_build_ppt_courseware`：写入 Word 教案 / PPT 课件。

**skill_file.py — 技能文件业务：**
- `create_skill_file` / `update_skill_file` / `get_skill_file` / `get_user_skill_files` / `delete_skill_file`：技能文件 CRUD。
- `mount_skill_to_agent` / `unmount_skill_from_agent` / `get_agent_skills`：Agent 与技能文件的多对多挂载。
- `get_marketplace_skill_files` / `download_skill_file`：技能市场与下载。

**experience_extractor.py — 教学经验自动沉淀（v4.0）：**
- `extract_experience_from_conversation(...)`：从教师对话中提取 L2-L5 经验。
- `merge_experience_into_five_layer(...)`：增量合并经验到五层结构。
- `build_five_layer_prompt_section(...)`：将五层经验构建为对话 system prompt 片段。

**knowledge_extractor.py — 知识提取（v3.0 机制一）：**
- `extract_knowledge_from_text(...)`：从文档文本提取知识点（L1）。
- `merge_knowledge_layer(...)`：按知识点名称增量合并。

**correction_analyzer.py — 纠正分析（v3.0 机制二）：**
- `analyze_correction(...)`：对比纠正前后回答，提取 L2 诊断 + L3 策略。
- `merge_correction_results(...)`：合并到五层 L2/L3。

**builtins.py — 内置内容播种（91KB，最重要数据源）：**
- `SYSTEM_USERNAME` / `BUILTIN_MARKER_KEY`：内置用户与标记常量。
- `seed_builtins()`：幂等播种 9 个内置教学助手（高等数学、Python、英语、物理、教案、试卷、机电、思政等）及其技能，版本落后时自动升级。

### 5.8 路由层 — routers/（12 个模块）

| 模块 | 前缀 | 职责 |
|------|------|------|
| [auth.py](file:///e:/aiskills/backend/app/routers/auth.py) | `/auth` | 注册、登录、获取/更新当前用户 |
| [agent.py](file:///e:/aiskills/backend/app/routers/agent.py) | `/agents` | Agent CRUD、市场、Prompt 生成、课件、五层经验 |
| [chat.py](file:///e:/aiskills/backend/app/routers/chat.py) | `/agents` | SSE 流式对话、会话管理 |
| [knowledge.py](file:///e:/aiskills/backend/app/routers/knowledge.py) | `/knowledge` | 知识库上传、处理管线、检索测试 |
| [documents.py](file:///e:/aiskills/backend/app/routers/documents.py) | `/documents` | 文档生成与下载 |
| [skill_file.py](file:///e:/aiskills/backend/app/routers/skill_file.py) | `/skill-files` | 技能文件 CRUD、市场、GitHub 导入 |
| [messages.py](file:///e:/aiskills/backend/app/routers/messages.py) | `/messages` | 消息反馈、单条消息查询 |
| [student.py](file:///e:/aiskills/backend/app/routers/student.py) | `/student` | 学生工作台（课程/错题/报告/档案） |
| [lesson_plan.py](file:///e:/aiskills/backend/app/routers/lesson_plan.py) | `/lesson-plans` | AI 备课计划生成与管理 |
| [reflection.py](file:///e:/aiskills/backend/app/routers/reflection.py) | `/reflections` | 教学反思生成与管理 |
| [analytics.py](file:///e:/aiskills/backend/app/routers/analytics.py) | `/analytics` | 学情分析/班级视图/知识地图 |
| [admin.py](file:///e:/aiskills/backend/app/routers/admin.py) | `/admin` | 数据清理、播种、状态查看 |

---

## 6. 数据模型与关系

### 6.1 用户与认证

**[User](file:///e:/aiskills/backend/app/models/user.py)**（`users` 表）：`id, username(唯一), email(唯一), password_hash, role, display_name, department, avatar_url, is_active, created_at, updated_at`。角色 `role` 取值：`teacher` / `student` / `admin` / `super_admin`。

### 6.2 Agent 与知识库

**[Agent](file:///e:/aiskills/backend/app/models/agent.py)**（`agents` 表）：`id, user_id(FK users), name, course_name, template, status, config(JSON), version, created_at, updated_at`。`config` 是核心配置载体，包含 `systemPrompt`、`course_info`、`knowledgeFileIds`、`fiveLayerKnowledge`、`publishScope`、`llmModel`、`topK`、`fingerprint` 等。

**[KnowledgeFile](file:///e:/aiskills/backend/app/models/knowledge.py)**（`knowledge_files` 表）：`id, user_id, agent_id(FK), filename, file_path, file_type, file_size, status, progress, progress_stage, error_message, chunk_count, created_at`。与 `KnowledgeChunk` 一对多级联。

**[KnowledgeChunk](file:///e:/aiskills/backend/app/models/knowledge.py)**（`knowledge_chunks` 表）：`id, file_id(FK), chunk_index, content, chunk_size`，用于元数据/预览。

### 6.3 对话与消息

**[Conversation](file:///e:/aiskills/backend/app/models/conversation.py)**（`conversations` 表）：`id, agent_id(FK), user_id(FK), title, created_at`。

**[Message](file:///e:/aiskills/backend/app/models/message.py)**（`messages` 表）：`id, conversation_id(FK), role, content, sources(JSON), feedback(JSON), created_at`。

### 6.4 技能文件

**[SkillFile](file:///e:/aiskills/backend/app/models/skill_file.py)**（`skill_files` 表）：`id, user_id, name, description, content(Text), source, github_source(JSON), status, version, created_at, updated_at`。

**[AgentSkill](file:///e:/aiskills/backend/app/models/agent_skill.py)**（`agent_skills` 表）：`id, agent_id(FK), skill_file_id(FK), created_at`。维护 Agent 与 SkillFile 的多对多挂载关系。

### 6.5 学生端

**[StudentAgent](file:///e:/aiskills/backend/app/models/student.py)**（`student_agents`）：`id, student_id(FK), agent_id(FK), status(active/draft), joined_at, last_accessed_at`。

**[LearningRecord](file:///e:/aiskills/backend/app/models/student.py)**（`learning_records`）：`id, student_id, agent_id, conversation_id, activity_type, duration_seconds, metadata_json, created_at`。

**[MistakeRecord](file:///e:/aiskills/backend/app/models/student.py)**（`mistake_records`）：`id, student_id, agent_id, conversation_id, subject, knowledge_point, question, student_answer, correct_answer, explanation, error_type, difficulty, is_mastered, review_count, last_reviewed_at, created_at`。

**[StudentProfile](file:///e:/aiskills/backend/app/models/student.py)**（`student_profiles`）：`id, student_id(唯一), grade, major, subjects_of_interest, learning_goal, preferred_time, created_at, updated_at`。

### 6.6 生成文档 / 备课 / 反思

- **[GeneratedDocument](file:///e:/aiskills/backend/app/models/document.py)**（`generated_documents`）：`id, user_id, agent_id, doc_type(ppt/word), topic, subject, grade, file_path, file_name, config, created_at`。
- **[LessonPlan](file:///e:/aiskills/backend/app/models/lesson_plan.py)**（`lesson_plans`）：`id, user_id, agent_id, title, subject, grade, topic, duration, student_count, content(JSON), created_at, updated_at`。
- **[TeachingReflection](file:///e:/aiskills/backend/app/models/reflection.py)**（`teaching_reflections`）：`id, user_id, agent_id, input_text, report(JSON), created_at`。提供别名 `Reflection = TeachingReflection`。

### 6.7 实体关系图

```
User 1 ─── * Agent                                Agent 1 ─── * KnowledgeFile 1 ─── * KnowledgeChunk
User 1 ─── * Conversation 1 ─── * Message
Agent 1 ─── * Conversation
Agent * ──── * SkillFile (via AgentSkill)
User 1 ─── * SkillFile
User 1 ─── * StudentAgent ─── * Agent
User 1 ─── * LearningRecord / MistakeRecord / StudentProfile
User 1 ─── * GeneratedDocument / LessonPlan / TeachingReflection
```

---

## 7. API 端点汇总

### 认证 `/api/auth`
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/register` | 注册用户 |
| POST | `/login` | 登录，返回 JWT |
| GET | `/me` | 获取当前用户 |
| PUT | `/me` | 更新当前用户资料 |

### Agent `/api/agents`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 当前用户 Agent 列表 |
| GET | `/stats` | 教师工作台统计 |
| POST | `/` | 创建 Agent |
| GET | `/marketplace` | 市场列表（搜索/筛选/排序/分页） |
| GET | `/marketplace/subjects` | 市场学科列表 |
| GET | `/marketplace/{id}` | 市场详情 |
| GET | `/{id}` | Agent 详情（作者任意状态，非作者仅已发布） |
| PUT | `/{id}` | 更新 Agent |
| PUT | `/{id}/publish` | 发布到市场 |
| POST | `/{id}/download` | 下载市场 Agent 副本 |
| POST | `/generate-prompt` | 生成 System Prompt（v2.1 双模板） |
| POST | `/optimize-prompt` | 优化 System Prompt |
| POST | `/generate-structured-config` | 生成 6 模块结构化配置（三级降级） |
| POST | `/regenerate-module` | 局部重新生成模块 |
| POST | `/{id}/skills/mount` | 挂载技能文件 |
| POST | `/{id}/skills/unmount` | 卸载技能文件 |
| GET | `/{id}/skills` | Agent 已挂载技能列表 |
| POST | `/{id}/generate-courseware` | 生成 Word/PPT 课件 |
| POST | `/{id}/export-teaching-strategy` | 导出五层经验为技能包 |
| GET | `/{id}/five-layer-knowledge` | 查看五层经验 + 统计 |
| POST | `/{id}/extract-knowledge` | 提取 L1 知识点 |
| POST | `/{id}/analyze-correction` | 纠正分析（L2+L3） |
| DELETE | `/{id}/five-layer-knowledge/{layer}/{index}` | 删除五层某条目 |

### 对话 `/api/agents`
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/{id}/chat` | SSE 流式对话（含来源、token、文件生成、done 事件） |
| GET | `/{id}/conversations` | 会话列表 |
| GET | `/conversations/{cid}/messages` | 会话消息 |
| DELETE | `/conversations/{cid}` | 删除会话 |

### 知识库 `/api/knowledge`
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/upload` | 上传知识库文件（后台管线处理） |
| GET | `/files` | Agent 文件列表 |
| GET | `/files/{id}/status` | 文件处理状态 |
| GET | `/info` | 知识库统计 |
| DELETE | `/files/{id}` | 删除文件（清理 SQLite + Chroma + 磁盘） |
| POST | `/test-search` | 测试向量检索 |

### 学生 `/api/student`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/dashboard` | 学习工作台统计 |
| GET | `/courses` | 已加入课程 |
| POST | `/courses/{id}/join` / `DELETE /courses/{id}/leave` | 加入/退出课程 |
| GET | `/drafts` | 草稿列表 |
| POST | `/courses/{id}/draft` | 保存草稿 |
| PUT | `/courses/{id}/activate` | 激活草稿 |
| DELETE | `/drafts/{id}` | 删除草稿 |
| GET | `/mistakes` | 错题列表（筛选+分页） |
| GET | `/mistakes/stats` | 错题统计 |
| PUT | `/mistakes/{id}/mastered` | 标记错题已掌握 |
| GET | `/report` | 学习报告 |
| GET | `/profile` / `PUT /profile` | 学生档案 |
| GET | `/recommendations` | 推荐课程 |

### 其他路由
| 模块 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 文档 | POST | `/api/documents/generate` | 生成 PPT/Word |
| 文档 | GET | `/api/documents/download/{filename}` | 按文件名下载 |
| 文档 | GET | `/api/documents/{id}/download` | 按记录下载 |
| 文档 | GET | `/api/documents/history` | 生成历史 |
| 技能 | GET | `/api/skill-files/marketplace` | 技能市场 |
| 技能 | POST | `/api/skill-files/import-github` | GitHub 导入 |
| 技能 | * | `/api/skill-files/...` | 技能文件 CRUD/发布/下载 |
| 消息 | POST | `/api/messages/{id}/feedback` | 消息反馈 |
| 消息 | GET | `/api/messages/{id}` | 消息详情 |
| 备课 | POST | `/api/lesson-plans/generate` | 生成备课计划 |
| 备课 | * | `/api/lesson-plans/...` | 备课 CRUD |
| 反思 | POST | `/api/reflections/generate` | 生成反思报告 |
| 反思 | * | `/api/reflections/...` | 反思 CRUD |
| 学情 | GET | `/api/analytics/overview` | 学情汇总 |
| 学情 | GET | `/api/analytics/class/{id}` | 班级详情 |
| 学情 | GET | `/api/analytics/knowledge-map` | 知识薄弱地图 |
| 管理 | POST | `/api/admin/cleanup` | 清理测试数据 |
| 管理 | POST | `/api/admin/seed-builtins` | 播种内置内容 |
| 管理 | GET | `/api/admin/status` | 系统状态 |

---

## 8. 前端模块详解

### 8.1 技术要点

- **路由**：见 [App.tsx](file:///e:/aiskills/frontend/src/App.tsx)，`/teacher/*` 教师端路由、`/student/*` 学生端路由，均受 `ProtectedRoute` 保护（支持 `role` 校验）。
- **状态管理**：[AuthContext.tsx](file:///e:/aiskills/frontend/src/contexts/AuthContext.tsx) 用 React Context 管理登录态（token 存 localStorage，key=`auth_token`）。
- **API 代理**：[vite.config.ts](file:///e:/aiskills/frontend/vite.config.ts) 将 `/api` 代理到 `http://localhost:8002`，并针对 SSE 响应关闭缓冲。

### 8.2 services/（API 调用封装）

| 文件 | 职责 |
|------|------|
| `api.ts` | 基础 fetch 封装（items/health 示例） |
| `authApi.ts` | 注册/登录/当前用户 |
| `agentApi.ts` | Agent 创建、市场、Prompt 生成、五层经验 |
| `chatApi.ts` | 会话与 SSE 流式对话 |
| `knowledgeApi.ts` | 知识库上传/列表/检索 |
| `skillFileApi.ts` | 技能文件 CRUD/市场/GitHub 导入 |
| `documentApi.ts` | 文档生成与下载 |
| `lessonPlanApi.ts` | 备课计划 |
| `reflectionApi.ts` | 教学反思 |
| `analyticsApi.ts` | 学情分析 |
| `studentApi.ts` | 学生端全部接口 |

### 8.3 pages/（页面组件）

**教师端**：`Login`、`Dashboard`（工作台）、`AgentCreate`（六步向导）、`AgentPreview`、`MyAgents`、`Marketplace`、`SkillFiles`、`Knowledge`、`Documents`、`LessonPlanner`、`TeachingReflection`、`ClassAnalytics`、`Onboarding`。

**学生端**（`pages/student/`）：`StudentDashboard`、`StudentCourses`、`StudentChat`、`MistakeBook`、`LearningReport`、`StudentSettings`。

### 8.4 components/（通用组件）

`AgentChat`、`StudentLayout`、`TeacherLayout`、`ProtectedRoute`、`KnowledgeUpload`、`MarkdownRenderer`，以及 `components/structured-form/` 下的表单组件（`TagSelect`、`MultiTagSelect`、`TextInputWithHint`、`KnowledgeLayerPanel`）。

---

## 9. 核心业务逻辑

### 9.1 RAG（知识库检索增强）流程

1. **上传管线**（`knowledge.py` 路由 `_process_file_pipeline`，后台任务）：上传 → `parse_document` 解析 → `chunk_text_semantic` 语义分块 → `filter_chunks` 过滤 → 存 `KnowledgeChunk` → `store_chunks_to_chroma` 向量化入库。状态机：`uploading → parsing → chunking → embedding → done/failed`。
2. **检索**（`retrieve_for_rag`）：按 `agent_id` 关联已处理文件 → 生成 query 向量 → 在集合 `agent_{agent_id}` 检索 → 相似度过滤（阈值默认 0.45）→ 返回 top_k 块。
3. **回答**（`stream_llm_answer` / `generate_answer`）：检索结果组装上下文 → 调用 DeepSeek-V3.2 → 流式/非流式返回，回答带来源标注。

### 9.2 对话流（教师 + 学生）

[chat.py](file:///e:/aiskills/backend/app/routers/chat.py) 的 `POST /agents/{id}/chat` 返回 SSE 流：

```
event: sources   → 推送检索来源
event: token     → 逐 token 推送 LLM 输出
event: file_ready → 若检测到 ```doc_gen``` 块，生成 PPT 并推送下载链接
event: done      → 保存消息，返回 message_id / conversation_id
```

- **system prompt 组装**：`_build_system_prompt` = Agent 的 `systemPrompt` + 五层经验片段 + 已挂载的 SkillFile 内容。
- **学生端后台任务**：`_student_post_chat_tasks` 记录学习行为 + LLM 错题检测（写入 `MistakeRecord`）。
- **教师端后台任务**：`_teacher_post_chat_tasks` 自动从对话中提取教学经验，增量合并到五层知识。
- 使用独立 DB session（`SessionLocal`）与后台线程，避免阻塞响应或 session 关闭问题。

### 9.3 五层教学经验机制（fiveLayerKnowledge）

这是平台的核心创新点，存储在 `agent.config.fiveLayerKnowledge`：

| 层 | 键 | 内容 | 来源机制 |
|----|----|------|---------|
| L1 知识体系 | `knowledge_layer` | 知识点拓扑 | `knowledge_extractor`（上传文档提取） |
| L2 学生诊断 | `diagnosis_layer` | 学生痛点/错误模式 | `correction_analyzer` + `experience_extractor` |
| L3 教学策略 | `strategy_layer` | 教学策略 | `correction_analyzer` + `experience_extractor` |
| L4 课堂交互 | `interaction_layer` | 提问模板/引导流程 | `experience_extractor` |
| L5 效果反馈 | `feedback_layer` | 反馈记录 | `experience_extractor` |

经验被反哺用于：对话 system prompt（`build_five_layer_prompt_section`）、课件生成（`_build_teaching_config`）、备课计划与教学反思（`lesson_plan.py` / `reflection.py` 读取经验上下文）。

### 9.4 智能体 Prompt 生成（v2.1 / v3.0）

- **v2.1**：`generate-prompt`（双模板 higher_edu / vocational）与 `optimize-prompt`。
- **v3.0**：`generate-structured-config` 生成 6 模块结构化 JSON（identity/capabilities/answer_rules/student_diagnosis/knowledge_strategy/boundaries），采用 **三级降级**：JSON Mode → 正则提取 → 纯文本 fallback。`regenerate-module` 支持局部重生成单个模块。

---

## 10. 模块依赖关系

### 10.1 后端依赖

```
routers ──► services ──► models ──► database
              │
              ├── rag.py ──► (openai, chromadb, config)
              ├── knowledge.py ──► (PyPDF2, python-docx)
              ├── document_* / courseware_generator ──► (python-pptx, python-docx)
              ├── *_extractor / correction_analyzer ──► (openai AsyncOpenAI)
              └── builtins.py（种子数据源）
routers ──► utils/auth.py（get_current_user / require_role）
models  ──► database.py（Base）
config.py 被所有模块引用
```

**关键依赖点**：
- **五层经验（fiveLayerKnowledge）是核心枢纽**：多个 service 向其写入，多个模块读取它。
- **共用 LLM 调用模式**：多个 service 各自实现 `_call_llm_json`，均走 `config.settings` 的 `SILICONFLOW_API_KEY`，采用「JSON Mode + 正则降级」两级策略。
- **鉴权**：所有 router 依赖 `utils.auth.get_current_user`；`student.py` 用 `require_role("student")`；`admin.py` 用 `_require_admin_or_internal` 做角色/内置/SECRET 三重校验。

### 10.2 前端依赖

```
App.tsx ──► pages/* ──► services/* ──► fetch → /api（Vite 代理 → :8002）
AuthContext ──► authApi
ProtectedRoute ──► AuthContext
pages 复用 components/（AgentChat、structured-form 等）
```

### 10.3 前后端端口约定

- 后端：`http://localhost:8002`（内存中记录曾用 8000/8001，因端口冲突改到 8002）。
- 前端：`http://localhost:5173`（Vite 默认），`.env` 的 `CORS_ORIGINS` 与 `vite.config.ts` 代理目标必须一致指向后端端口。

---

## 11. 项目运行方式

### 11.1 环境要求

- **Python 3.12**（重要：Python 3.14 与 chromadb、pydantic_core 等依赖不兼容）。
- Node.js 18+，npm/pnpm。

### 11.2 后端启动

```bash
cd backend
# 安装依赖（官方源慢时可用阿里云镜像）
pip install -r requirements.txt \
    --trusted-host mirrors.aliyun.com -i https://mirrors.aliyun.com/pypi/simple/

# 配置环境变量
cp .env.example .env
# 编辑 .env，至少设置 SECRET_KEY 和 SILICONFLOW_API_KEY
#   SECRET_KEY 生成：python -c "import secrets; print(secrets.token_urlsafe(32))"

# 启动服务（端口 8002）
python -m uvicorn app.main:app --reload --port 8002
```

- 健康检查：`http://localhost:8002/api/health`
- Swagger 文档：`http://localhost:8002/docs`

### 11.3 知识库初始化（重要）

后端启动后，需执行知识库上传脚本，将内置素材填充到各个内置助手：

```bash
cd backend
python upload_all.py
```

> 注意：脚本硬编码了 `BASE = "http://localhost:8000"`，若后端跑在 8002，需先将脚本中的 BASE 改为 8002。上传后 RAG 处理约需 30-60 秒。

### 11.4 前端启动

```bash
cd frontend
npm install
npm run dev
```

访问 `http://localhost:5173`。测试账号：教师 `demo_teacher / Demo1234`。

### 11.5 常用命令

| 操作 | 命令 |
|------|------|
| 后端开发 | `python -m uvicorn app.main:app --reload --port 8002` |
| 前端开发 | `npm run dev` |
| 前端构建 | `npm run build`（`tsc -b && vite build`） |
| 前端预览 | `npm run preview` |
| 知识库上传 | `python upload_all.py` |

---

## 12. 环境配置与安全

### 12.1 关键环境变量（`.env`）

| 变量 | 必填 | 说明 |
|------|------|------|
| `SECRET_KEY` | ✅ | JWT 密钥，启动时强制校验，弱值直接拒绝启动。 |
| `SILICONFLOW_API_KEY` | ✅ | 调用 DeepSeek-V3.2 与 bge-m3 的密钥，未配置时 RAG/对话相关功能不可用。 |
| `DATABASE_URL` | 可选 | SQLite 连接串，默认 `sqlite:///./app.db`。 |
| `CORS_ORIGINS` | 可选 | 允许的前端来源，须与前端实际地址一致。 |
| `CHROMA_PERSIST_DIR` | 可选 | 向量数据持久化目录。 |

### 12.2 安全要点

- **密钥强制校验**：`config.py` 启动时检查 SECRET_KEY，若为弱值（空、`changeme` 等）直接 `RuntimeError` 拒绝启动。
- **JWT 鉴权**：所有受保护接口通过 Bearer Token 校验，`require_role` 实现角色级权限隔离（学生端仅 `student` 可访问）。
- **密码加密**：bcrypt 哈希存储，`get_password_hash` 截断到 72 字节。
- **文件类型/大小限制**：知识库上传仅允许 `pdf/txt/md/docx`，最大 50MB。
- **内置助手上传放行**：SYSTEM 用户创建的内置助手允许教师/管理员补充知识库。

---

## 附：开发扩展建议

- **新增业务模块**：按 `models → schemas → services → routers → main.py 挂载` 的顺序扩展，并在 `main.py` 的 `_lightweight_migrate` 中补充建表（如需要）。
- **新增 LLM 能力**：复用 `services/rag.py` 的 `_get_client()` 与「JSON Mode + 正则降级」调用模式。
- **前后端联调**：保持 `vite.config.ts` 代理目标与后端端口一致，SSE 需关闭缓冲（已配置）。