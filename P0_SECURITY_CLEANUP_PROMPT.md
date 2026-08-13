# P0 安全与清理 - AI 执行方案

> 本文档是可直接转发给 AI 的执行指令。AI 应按顺序执行以下 6 个任务，每个任务包含具体文件路径、修改内容和验证方法。
> 执行前必须先读取目标文件，修改后运行验证命令。

---

## 任务 1：修复 SECRET_KEY 安全配置

### 问题
`backend/app/config.py:6` 中 SECRET_KEY 有硬编码默认值 `"your-secret-key-change-in-production"`，如果 `.env` 文件缺失或未设置，应用会使用这个不安全的默认值启动，JWT 可被伪造。

### 修改文件
`backend/app/config.py`

### 修改内容
1. 将 SECRET_KEY 默认值改为空字符串 `""`（不提供任何不安全的默认值）
2. 在 `settings = Settings()` 之后，添加启动时校验逻辑：如果 SECRET_KEY 为空或等于已知的不安全值，直接抛出 `RuntimeError` 阻止启动

### 目标代码结构
```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./app.db"
    SECRET_KEY: str = ""  # 必须通过 .env 注入，不提供默认值
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    UPLOAD_DIR: str = "./uploads"
    OUTPUT_DIR: str = "./outputs"
    CHROMA_PERSIST_DIR: str = "./chroma_data"

    # SiliconFlow API (OpenAI 兼容)
    SILICONFLOW_API_KEY: str = ""
    SILICONFLOW_BASE_URL: str = "https://api.siliconflow.cn/v1"
    EMBEDDING_MODEL: str = "BAAI/bge-m3"
    CHAT_MODEL: str = "deepseek-ai/DeepSeek-V3.2"

    class Config:
        env_file = ".env"


settings = Settings()

# 启动时安全校验
_INSECURE_KEYS = {"", "your-secret-key-change-in-production", "changeme", "secret"}
if settings.SECRET_KEY in _INSECURE_KEYS:
    raise RuntimeError(
        "SECRET_KEY 未配置或使用了不安全的默认值。\n"
        "请在 backend/.env 文件中设置一个随机且足够长的 SECRET_KEY，例如：\n"
        'SECRET_KEY=<运行 python -c "import secrets; print(secrets.token_urlsafe(32))" 生成>'
    )
```

### 验证方法
- 确认 `.env` 文件中已有 `SECRET_KEY=kw1gV83Py5s-cn7HU4dZQVWmcV23KBWHL6CPkJv845A`（已存在），应用可正常启动
- 临时将 `.env` 中 SECRET_KEY 改为空，重启后端，应报 RuntimeError 拒绝启动
- 恢复 `.env` 后确认正常启动

---

## 任务 2：收紧 CORS 配置

### 问题
`backend/app/main.py:228-234` 中 `allow_origins=["*"]` 允许任意域名调用 API，存在 CSRF 和数据泄露风险。

### 修改文件
`backend/app/main.py`

### 修改内容
将 CORS 配置从全开改为白名单模式。允许的来源包括：
- 本地开发：`http://localhost:5173`（Vite 默认端口）
- 本地开发备选：`http://127.0.0.1:5173`
- 生产环境占位：通过环境变量 `CORS_ORIGINS` 配置（逗号分隔）

### 目标代码
在 `backend/app/config.py` 的 `Settings` 类中新增：
```python
    # CORS 允许的前端来源（逗号分隔）
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
```

在 `backend/app/main.py` 中替换 CORS 中间件配置：
```python
# 将 allow_origins=["*"] 替换为：
allowed_origins = [
    origin.strip()
    for origin in settings.CORS_ORIGINS.split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

注意：`main.py` 顶部需要确保已导入 `from .config import settings`（迁移函数中已有此导入，但需确认在模块顶层可用）。

### 验证方法
- 启动后端，从 `http://localhost:5173` 发起请求，应正常工作
- 用 `curl -H "Origin: http://evil.com" http://localhost:8000/api/health` 测试，响应头不应包含 `Access-Control-Allow-Origin: http://evil.com`

---

## 任务 3：删除后端遗留脚手架文件

### 问题
`backend/` 根目录下存在项目初始化时的脚手架文件，与 `backend/app/` 包结构完全重复且不再使用，会误导开发。

### 待删除文件（共 5 个）
1. `backend/main.py` - 旧入口（Item CRUD demo），与 `backend/app/main.py` 重复
2. `backend/crud.py` - 旧 CRUD 逻辑
3. `backend/models.py` - 旧模型定义
4. `backend/schemas.py` - 旧 schema 定义
5. `backend/database.py` - 旧数据库连接

### 前置验证
确认这些文件未被 `backend/app/` 中的任何代码 import。执行搜索：
```
搜索 backend/app/ 目录下是否存在任何 import 语句引用了 `backend/main.py`、`backend/crud.py`、`backend/models.py`、`backend/schemas.py`、`backend/database.py`
```
预期结果：无匹配（已确认 `backend/app/` 使用自己的 `from .database import ...` 相对导入）。

### 执行操作
直接删除上述 5 个文件。

### 验证方法
```powershell
cd backend; python -m uvicorn app.main:app --reload --port 8000
```
应用应正常启动，访问 `http://localhost:8000/docs` 确认所有路由正常加载。

---

## 任务 4：删除后端死代码（旧 Skill 路由/服务/模型）

### 问题
架构重构（Skill → Agent）后，旧的 Skill 相关路由、服务和模型文件仍在项目中，但 `main.py` 已不再注册旧 skill 路由，`models/__init__.py` 也不再导入旧 skill 模型。

### 待删除文件（共 3 个）
1. `backend/app/routers/skill.py` - 旧 Skill 路由，`main.py` 未注册（只注册了 `skill_file_router`）
2. `backend/app/services/skill.py` - 旧 Skill 服务，无任何文件 import（`chat.py` 和 `agent.py` import 的是 `services/skill_file.py`）
3. `backend/app/models/skill.py` - 旧 Skill 模型，`models/__init__.py` 未导入（只导入了 `skill_file.py`）

### 前置验证
- 搜索 `backend/app/` 全目录，确认无 `from ..routers.skill import`、`from ..services.skill import`（注意不是 `skill_file`）、`from ..models.skill import`（注意不是 `skill_file`）
- 预期：无匹配（已确认）

### 注意事项
- 不要删除 `backend/app/routers/skill_file.py`（这是新的 SkillFile 系统，正在使用）
- 不要删除 `backend/app/services/skill_file.py`（同上）
- 不要删除 `backend/app/models/skill_file.py`（同上）
- `main.py` 中的迁移函数 `_lightweight_migrate()` 引用的是数据库中的 `skills` 表名（通过 SQL），不是 Python 模型文件，因此删除 `models/skill.py` 不影响迁移逻辑

### 执行操作
直接删除上述 3 个文件。

### 验证方法
```powershell
cd backend; python -m uvicorn app.main:app --reload --port 8000
```
启动无 ImportError，所有 52 条路由正常注册。

---

## 任务 5：删除前端死代码（旧 Skill 组件/页面/服务/类型）

### 问题
架构重构后，旧的 Skill 相关前端文件仍存在，但 `App.tsx` 和所有页面均不再引用它们。

### 待删除文件（共 5 个）
1. `frontend/src/components/SkillChat.tsx` - 已被 `AgentChat.tsx` 完全替代
2. `frontend/src/pages/SkillCreate.tsx` - 已被 `AgentCreate.tsx` 完全替代
3. `frontend/src/pages/SkillPreview.tsx` - 已被 `AgentPreview.tsx` 完全替代
4. `frontend/src/services/skillApi.ts` - 已被 `agentApi.ts` 完全替代
5. `frontend/src/types/skill.ts` - 已被 `types/agent.ts` 完全替代

### 前置验证
- 搜索 `frontend/src/` 全目录，确认无 `import` 引用上述 5 个文件
- 预期：无匹配（已确认 `App.tsx` 只 import 了 `AgentCreate`、`AgentPreview`、`SkillFiles` 等新组件）

### 注意事项
- 不要删除 `frontend/src/pages/SkillFiles.tsx`（这是新的技能文件管理页面，`App.tsx` 第 8 行有 import）
- 不要删除 `frontend/src/services/skillFileApi.ts`（新的 SkillFile API 服务）
- 不要删除 `frontend/src/types/skillFile.ts`（新的 SkillFile 类型定义）

### 执行操作
直接删除上述 5 个文件。

### 验证方法
```powershell
cd frontend; npx tsc --noEmit
```
TypeScript 编译零错误。

---

## 任务 6：创建 .env.example 环境变量示例文件

### 问题
项目没有 `.env.example` 文件，新开发者不知道需要配置哪些环境变量。

### 创建文件
`backend/.env.example`

### 文件内容
```env
# ============================================
# AI Skills Platform - 环境变量配置示例
# ============================================
# 复制此文件为 .env 并填写真实值：
#   cp .env.example .env

# ---------- 数据库 ----------
DATABASE_URL=sqlite:///./app.db

# ---------- 认证安全 ----------
# 必须设置！生成方式：python -c "import secrets; print(secrets.token_urlsafe(32))"
SECRET_KEY=
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# ---------- CORS 允许的前端来源 ----------
# 逗号分隔的域名列表
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# ---------- 文件存储 ----------
UPLOAD_DIR=./uploads
OUTPUT_DIR=./outputs

# ---------- Chroma 向量数据库 ----------
CHROMA_PERSIST_DIR=./chroma_data

# ---------- SiliconFlow API (国内大模型) ----------
# 获取地址：https://cloud.siliconflow.cn/account/ak
SILICONFLOW_API_KEY=
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1

# ---------- Embedding 模型 ----------
EMBEDDING_MODEL=BAAI/bge-m3

# ---------- 对话模型 ----------
CHAT_MODEL=deepseek-ai/DeepSeek-V3.2
```

### 注意事项
- 不要在此文件中填写任何真实的 API Key
- 确认 `.gitignore` 已包含 `backend/.env`（已确认在第 3 行）
- `.env.example` 应该被 git 跟踪（不在 .gitignore 中）

### 验证方法
- 确认文件存在于 `backend/.env.example`
- 确认 `backend/.env` 不会被 git 跟踪（已在 .gitignore 中）

---

## 执行顺序与最终验证

### 执行顺序
1. 任务 1（修改 config.py）
2. 任务 2（修改 main.py + config.py）
3. 任务 3（删除后端脚手架）
4. 任务 4（删除后端死代码）
5. 任务 5（删除前端死代码）
6. 任务 6（创建 .env.example）

### 最终验证清单

**后端验证：**
```powershell
cd backend
python -m uvicorn app.main:app --reload --port 8000
```
- 应用启动无报错
- SECRET_KEY 校验通过
- 访问 `http://localhost:8000/docs` 确认所有路由正常
- 访问 `http://localhost:8000/api/health` 返回 `{"status": "ok"}`

**前端验证：**
```powershell
cd frontend
npx tsc --noEmit
npm run build
```
- TypeScript 编译零错误
- Build 成功

**功能验证：**
- 启动前端 `npm run dev`，访问 `http://localhost:5173/login`
- 使用测试账号登录（testuser1/test123）
- 确认 Dashboard、Marketplace、AgentCreate、AgentPreview、SkillFiles 等页面正常加载
- 确认对话功能正常（与 Agent 对话能收到流式回复）

### 禁止事项
- 不要修改任何业务逻辑代码
- 不要删除 `backend/app/main.py` 中的 `_lightweight_migrate()` 迁移函数
- 不要删除任何带 `_file` 后缀的文件（skill_file、agent_skill 等）
- 不要删除 `frontend/src/pages/SkillFiles.tsx`
- 不要引入新的 Python 或 npm 依赖
