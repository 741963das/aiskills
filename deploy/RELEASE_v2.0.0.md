## 📦 v2.0.0 — 师生问答经验沉淀 + 生产部署

> **版本定位**：在 v1.0 五层经验沉淀体系基础上，将经验触发源从「教师复盘」重构为「学生提问 + 教师解答」，显著降低教师负担，并补齐生产部署能力。

### ✨ 新特性

- **师生问答沉淀新模式**
  - 经验触发源重构：教师复盘 → 学生提问 + 教师解答
  - 新增 `QuestionRecord` 数据模型，存储学生疑问、AI 初步回答、教师解答
  - 学生对话中自动检测困惑（痛点/学科标签）并生成待答疑记录
  - 教师解答后后台自动提取 L2-L5 教学经验并注入五层知识体系

- **教师端「学生疑问」待答疑池**
  - 新增 `TeacherQuestions` 页面，集中管理待答疑/已解答记录
  - 支持疑问列表、痛点标签展示、解答提交与一键沉淀

### 🐛 Bug 修复

- **Chroma 向量库并发初始化竞争**：多文件并发上传时触发 `tenant default_tenant` 连接失败，新增线程锁解决
- **下载助手 file_id 映射错误**：市场下载助手后知识库无法检索，修复向量 metadata 中 file_id 的正确映射

### 🚀 生产部署

- 新增 `deploy/` 目录：
  - `nginx.conf` — 静态托管 + `/api` 反代（含 SSE 流式、history 路由）
  - `backend.service` — systemd 后端服务单元
  - `.env.production` — 生产环境变量模板
- 新增 `DEPLOYMENT.md` 正式部署说明（架构、前后端部署、HTTPS、数据备份、验收清单、排错）

### ⚙️ 技术栈

FastAPI · SQLAlchemy · ChromaDB · Uvicorn · React 19 · Vite · Tailwind CSS · SiliconFlow（DeepSeek-V3.2 / BAAI-bge-m3）