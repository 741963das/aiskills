# AI Skills · 智能教学助手平台

> 面向高等教育的 AI 教学助手创作与师生问答经验沉淀平台。教师用引导式表单创建教学智能体、上传知识库构建 RAG 引擎，学生与智能体学习对话；**学生提问 + 教师解答**自动沉淀为五层教学经验，随使用次数越多、助手越懂教学。

---

## ✨ 核心亮点

| 能力 | 说明 |
|------|------|
| 🛠️ **助手创建** | 六步引导式表单 + 多学科模板，快速搭建个性化教学智能体 |
| 📚 **RAG 知识库** | Markdown/PDF/Word 文档解析 → 语义分块 → BAAI/bge-m3 向量嵌入 → ChromaDB 相似度检索 |
| 🧠 **五层经验沉淀** | L1 知识体系、L2 学生诊断、L3 教学策略、L4 课堂交互、L5 效果反馈，**师生问答自动提取**，无需教师复盘 |
| 💬 **师生问答闭环** | 学生对话中自动检测痛点 → 生成待答疑记录 → 教师解答 → 后台异步沉淀经验 |
| 🏪 **助手市场** | 一键发布与下载已打磨好的助手，快照知识库保证下载即用 |
| 🎓 **双端工作台** | 教师端：工作台/助手市场/学生疑问/备课/反思/学情；学生端：课程/对话/学习报告/错题本 |
| ⚙️ **生产就绪** | Docker 镜像、Nginx 反代配置、systemd 服务单元、数据备份方案、Render 一键部署 |

---

## 🏗️ 架构一览

```
                    ┌────────────────────────────────────────────┐
                    │               浏览器 / 手机 App             │
                    │        Teacher Workbench / Student App     │
                    └───────────────────────┬────────────────────┘
                                            │ HTTPS
                    ┌───────────────────────▼────────────────────┐
                    │              Nginx 反向代理               │
                    │  静态资源托管 frontend/dist + /api 反代   │
                    │  SSE 流式不缓冲 + 50MB 上传 + HTTPS      │
                    └───────────────────────┬────────────────────┘
                                            │
                    ┌───────────────────────▼────────────────────┐
                    │     FastAPI + Uvicorn (Python 3.10)      │
                    │  Routers / Models / Services / Utils     │
                    │  • Auth(JWT)  • Agent  • Chat  • RAG    │
                    │  • 五层经验沉淀   • 教师待答疑池          │
                    └───────────┬───────────────────┬────────────┘
                                │                   │
                    ┌───────────▼────┐    ┌────────▼──────────┐
                    │   SQLite        │    │   ChromaDB        │
                    │  (app.db)       │    │  向量数据          │
                    │ 用户/助手/对话/  │    │ 知识库分块向量    │
                    │ 疑问/经验记录   │    └───────────────────┘
                    └────────────────┘
                                     │
                    ┌────────────────▼─────────────────────┐
                    │        SiliconFlow LLM API            │
                    │  DeepSeek-V3.2 (对话)                  │
                    │  BAAI/bge-m3   (Embedding)             │
                    └───────────────────────────────────────┘
```

---

## 🧱 技术栈

| 层 | 技术 |
|------|------|
| **前端** | React 19 + TypeScript + Vite + Tailwind CSS |
| **后端** | Python 3.10 · FastAPI · SQLAlchemy 2.0 |
| **数据库** | SQLite（业务数据）+ ChromaDB Persistent（向量） |
| **AI 服务** | SiliconFlow：DeepSeek-V3.2 对话 / BAAI/bge-m3 嵌入 |
| **认证** | JWT（python-jose + bcrypt） |
| **部署** | Docker / docker-compose / Nginx / systemd / Render 一键 |

---

## 🚀 快速开始（本地开发）

### 1. 环境要求
- **Python** `3.10.x`（**不兼容 3.14**，见 [DEPLOYMENT.md](./DEPLOYMENT.md)）
- **Node.js** `18+`、**npm** `9+`

### 2. 后端
```bash
cd backend
pip install -r requirements.txt --trusted-host mirrors.aliyun.com -i https://mirrors.aliyun.com/pypi/simple/
cp .env.example .env
# 编辑 .env，至少填写：
#   SECRET_KEY=随机字符串
#   SILICONFLOW_API_KEY=sk-...      https://cloud.siliconflow.cn/account/ak

python -m uvicorn app.main:app --reload --port 8008
```
启动后访问 Swagger：http://127.0.0.1:8008/docs

### 3. 前端
```bash
cd frontend
npm install
npm run dev
```
访问 http://127.0.0.1:5173

> 提示：Vite 代理已在 [vite.config.ts](./frontend/vite.config.ts) 中指向 `http://127.0.0.1:8008`，如需改后端端口请同步修改。

### 4. 填充内置助手知识库
```bash
cd backend
python upload_all.py
```

---

## 🧑‍🏫 演示账号（本地通过 `_deploy_setup` 创建）

| 角色 | 账号 | 密码 | 说明 |
|------|------|------|------|
| 教师 | `demo_teacher` | `Demo1234` | 已自建「高等数学助教」，含知识库，可发布、答疑、沉淀经验 |
| 学生 | 自行注册或创建 | 如 `qa_student_final / test123456` | 加入教师发布的课程后即可提问 |

### 演示「五层经验沉淀」闭环
1. **教师端**：用 demo_teacher 登录 → 「我的助手」→ 打开「高等数学助教」→ **发布** → 分享邀请码给学生
2. **学生端**：学生登录 → 「我的课程」→ 输入邀请码加入 → 「开始学习」，提出一个暴露学习痛点的问题（如"受力分析时总是漏掉摩擦力"）
3. **教师端**：导航栏「学生疑问」→ 切换「待答疑」→ 找到该问题 → 填写解答并点击 **「提交解答并沉淀」**
4. 等待 30-90 秒（后台 LLM 分析中）→ 回到「我的助手」→ 查看「五层知识经验」面板，L2-L5 条目即已新增

---

## 📁 目录结构

```
aiskills/
├── backend/
│   ├── app/
│   │   ├── main.py             FastAPI 入口 + 启动迁移/播种
│   │   ├── config.py           Settings（环境变量）
│   │   ├── database.py         SQLAlchemy Session
│   │   ├── models/             数据模型（User/Agent/Conversation/QuestionRecord 等）
│   │   ├── schemas/            Pydantic 请求/响应
│   │   ├── routers/            12 个 API 路由模块（Auth/Agent/Chat/Knowledge/Student/…）
│   │   ├── services/           业务核心：builtins、rag、experience_extractor、knowledge…
│   │   └── utils/              auth/security
│   ├── knowledge_materials/    16 份内置知识库源文档
│   ├── upload_all.py           批量填充内置助手知识库
│   ├── .env.example
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── pages/              教师端 + 学生端（student/子目录）
│   │   ├── components/         AgentChat / MarkdownRenderer / structured-form …
│   │   ├── services/           按业务域拆分的 API 封装
│   │   ├── contexts/           AuthContext（JWT 登录态）
│   │   ├── types/              TS 类型
│   │   └── App.tsx             路由
│   ├── vite.config.ts
│   └── package.json
│
├── deploy/
│   ├── nginx.conf              生产 Nginx 反代配置（含 SSE/history/上传大小）
│   ├── backend.service         systemd 服务单元
│   ├── .env.production         生产环境变量模板
│   └── create_release.py       一键创建 GitHub Release 脚本
│
├── render.yaml                 Render 一键部署（Docker 服务）
├── Dockerfile                  生产镜像（静态资源 + Uvicorn 同容器）
├── docker-compose.yml
├── DEPLOYMENT.md               生产部署完整说明（强烈推荐阅读）
├── CODE_WIKI.md                代码 Wiki：架构 / API / 数据模型
└── README.md                   你现在在读的文档
```

---

## 🖥️ 生产部署

详见 [DEPLOYMENT.md](./DEPLOYMENT.md)，涵盖：
- 架构图与硬件建议
- 后端 systemd + 前端静态部署
- Nginx 反代与 HTTPS（certbot）
- 数据定时备份与恢复
- 上线验收 9 项自检
- 常见问题排错表

**一键云部署（Render 免费层）**：Fork 本仓库后打开 [render.yaml](./render.yaml)，在 Render Dashboard 中导入即可，SILICONFLOW_API_KEY 需在 Render 环境变量处补上。

---

## 📘 其他文档

- [DEPLOYMENT.md](./DEPLOYMENT.md) — 生产部署完整手册
- [CODE_WIKI.md](./CODE_WIKI.md) — 代码级 Wiki（模块/模型/API/核心逻辑）

---

## 🔐 安全提示

1. 切勿将 `backend/.env` 提交到版本库（已加入 `.gitignore`）。
2. 生产环境务必更换默认 `SECRET_KEY`，并使用 HTTPS。
3. GitHub PAT / SiliconFlow API Key 一旦在日志或分享链接中暴露，请立即在对应控制台 revoke 并重新生成。

---

## 📄 License

MIT © AI Skills Project