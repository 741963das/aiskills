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
│   │   ├── config.py        # 配置管理
│   │   ├── models/          # SQLAlchemy 模型
│   │   ├── schemas/         # Pydantic Schema
│   │   ├── routers/         # API 路由
│   │   ├── services/        # 业务逻辑（RAG、经验提取等）
│   │   └── utils/           # 工具函数
│   ├── .env.example         # 环境变量模板
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/           # 页面组件
│   │   │   ├── student/     # 学生端页面
│   │   │   └── *.tsx        # 教师端页面
│   │   ├── components/      # 通用组件
│   │   ├── services/        # API 调用
│   │   ├── types/           # TypeScript 类型
│   │   └── App.tsx          # 路由配置
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
