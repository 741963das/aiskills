# ============================================================
# AI Skills Platform - Dockerfile (多阶段构建)
# 用于 Render 免费部署：单容器同时运行后端 API + 前端静态资源
# ============================================================

# ========== 阶段1：构建前端 ==========
FROM node:20-slim AS frontend-build

WORKDIR /app/frontend

# 先复制依赖文件，利用 Docker 缓存
COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps

# 复制源代码
COPY frontend/ ./

# 直接用 vite build（跳过 tsc 类型检查，Docker 中只需产物）
RUN npx vite build

# ========== 阶段2：运行后端 ==========
FROM python:3.10-slim

WORKDIR /app

# 安装系统依赖（chromadb 需要 C++ 运行时库）
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    -i https://mirrors.aliyun.com/pypi/simple/ \
    --trusted-host mirrors.aliyun.com

# 复制后端代码
COPY backend/ .

# 复制前端构建产物（后端将托管这些静态文件）
COPY --from=frontend-build /app/frontend/dist ./static

# 创建数据目录
RUN mkdir -p uploads outputs chroma_data

# 暴露端口
EXPOSE 8008

# 启动命令
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8008"]