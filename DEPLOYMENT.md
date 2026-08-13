# AI Skills Platform · 正式部署说明

本指南面向生产环境，覆盖 **后端（FastAPI + Uvicorn）** 与 **前端（React + Vite）** 的构建、部署、反向代理、HTTPS、数据备份与运维。适用于 Linux 服务器（Ubuntu/Debian/CentOS）。Windows 本地部署见文末「附录A」。

---

## 1. 架构总览

```
                        ┌──────────────────────────────────────────┐
 浏览器/客户端 ────────▶ │  Nginx (80/443)                          │
                        │  │ 静态资源: frontend/dist（前端 SPA）      │
                        │  │ /api/*  ──▶  反向代理                  │
                        └──────────────┬───────────────────────────┘
                                       │ http://127.0.0.1:8008
                                       ▼
                        ┌──────────────────────────────────────────┐
                        │  Uvicorn (FastAPI)  backend/app           │
                        │  ├── SQLite/PostgreSQL  （业务数据）        │
                        │  ├── ChromaDB          （向量库，RAG）      │
                        │  ├── uploads/ outputs/ （文件存储）         │
                        │  └── SiliconFlow API  （LLM + Embedding）  │
                        └──────────────────────────────────────────┘
```

- **Nginx**：托管前端构建产物 + 将 `/api/*` 反代到后端。SSE 流式对话必须关闭 `proxy_buffering`（配置文件已处理）。
- **Uvicorn**：后端服务，监听 `127.0.0.1:8008`，仅服务于 Nginx。
- **数据持久化目录**：`app.db`（SQLite）、`chroma_data/`（向量）、`uploads/`、`outputs/`。

---

## 2. 前置准备

| 组件 | 版本建议 | 说明 |
|------|----------|------|
| Python | 3.10 / 3.11 / 3.12 | **勿用 3.14**，chromadb/pydantic_core 无预编译 wheel |
| Node.js | ≥ 18 | 前端构建 |
| Nginx | ≥ 1.18 | 反向代理 + 静态托管 |
| SiliconFlow API Key | - | 需购买额度，见 `https://cloud.siliconflow.cn` |

> 注意：本项目使用 SQLite 默认配置，单机部署无需数据库服务。

---

## 3. 后端部署

### 3.1 准备代码与依赖

```bash
# 1. 上传代码到服务器
scp -r backend/ user@server:/var/www/aiskills/

# 2. 创建并激活虚拟环境
cd /var/www/aiskills/backend
python3 -m venv venv
source venv/bin/activate

# 3. 安装依赖（国内建议用阿里云镜像）
pip install --upgrade pip
pip install -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/ --trusted-host mirrors.aliyun.com
```

### 3.2 配置环境变量

```bash
cp deploy/.env.production .env
# 编辑 .env，务必修改：
#   - SECRET_KEY（随机长字符串）
#   - CORS_ORIGINS（正式域名）
#   - SILICONFLOW_API_KEY（真实 Key）
```

> 后端启动时会自动执行**幂等建表 + 轻量级迁移 + 播种 8 个内置助手与技能**，无需手动初始化数据库。

### 3.3 启动后端（systemd，推荐）

参考 `deploy/backend.service`：

```bash
# 按实际路径修改 User/WorkingDirectory/ExecStart 后
sudo cp deploy/backend.service /etc/systemd/system/aiskills-backend.service
sudo systemctl daemon-reload
sudo systemctl enable --now aiskills-backend
sudo systemctl status aiskills-backend    # 检查状态
journalctl -u aiskills-backend -f         # 查看实时日志
```

**手动启动（临时调试用，勿用于生产）**：
```bash
cd /var/www/aiskills/backend
source venv/bin/activate
python -m uvicorn app.main:app --host 127.0.0.1 --port 8008 --workers 1
```

> 生产模式**不要**加 `--reload`；对话依赖 SSE 流式响应，`--workers 1` 可避免内存态冲突。

### 3.4 健康检查

```bash
curl http://127.0.0.1:8008/api/health
# 期望输出：{"status":"ok","service":"AI Skills Platform"}
```

---

## 4. 前端部署

### 4.1 构建生产产物

```bash
cd /var/www/aiskills/frontend
npm ci
npm run build          # 产出到 frontend/dist/（tsc 类型检查 + vite 打包）
```

### 4.2 部署静态资源

```bash
mkdir -p /var/www/aiskills/dist
cp -r frontend/dist/* /var/www/aiskills/dist/
```

> 前端通过**同源相对路径** `/api/*` 访问后端（由 Nginx 反代），因此构建产物不写死后端地址，部署更简单。

---

## 5. Nginx 反向代理

参考 `deploy/nginx.conf`：

```bash
sudo cp deploy/nginx.conf /etc/nginx/conf.d/aiskills.conf
sudo nginx -t          # 语法检查
sudo systemctl reload nginx
```

关键点：
- **history 路由回退**：`try_files $uri $uri/ /index.html;`
- **SSE 流式**：`proxy_buffering off;` + `Connection "";`
- **上传大小**：`client_max_body_size 50m;`

---

## 6. HTTPS（生产强烈建议）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
# 自动申请证书并改写 Nginx 配置，自动续期
```

---

## 7. 环境变量清单

| 变量 | 必填 | 说明 |
|------|------|------|
| `SECRET_KEY` | ✅ | JWT 签名密钥，`secrets.token_urlsafe(32)` 生成 |
| `CORS_ORIGINS` | ✅ | 正式域名，逗号分隔 |
| `SILICONFLOW_API_KEY` | ✅ | 大模型调用凭证 |
| `DATABASE_URL` | 可选 | 默认 SQLite，可切换 PostgreSQL |
| `EMBEDDING_MODEL` | 可选 | 默认 `BAAI/bge-m3` |
| `CHAT_MODEL` | 可选 | 默认 `deepseek-ai/DeepSeek-V3.2` |
| `CLEANUP_TEST_DATA_ON_START` | 可选 | 生产保持 `false` |

---

## 8. 数据备份与恢复

### 8.1 需备份的目录
- `backend/app.db` — 业务数据（用户、助手、对话、知识库元数据）
- `backend/chroma_data/` — 向量库（RAG 检索）
- `backend/uploads/` — 上传的原始文档
- `backend/outputs/` — 生成的课件/文档

### 8.2 定时备份（cron 参考）
```bash
# 每天 02:00 打包备份
0 2 * * * tar -czf /backup/aiskills-$(date +\%Y\%m\%d).tar.gz \
    -C /var/www/aiskills/backend app.db chroma_data uploads outputs
# 保留最近 7 天
0 2 * * * find /backup -name 'aiskills-*.tar.gz' -mtime +7 -delete
```

### 8.3 恢复
```bash
tar -xzf /backup/aiskills-YYYYMMDD.tar.gz -C /var/www/aiskills/backend
sudo systemctl restart aiskills-backend
```

> 建议备份时先 `sudo systemctl stop aiskills-backend` 或使用 SQLite 在线备份，避免文件锁导致备份不完整。

---

## 9. 部署后验收清单

1. `curl http://127.0.0.1:8008/api/health` → `{"status":"ok"}`
2. 浏览器访问 `https://your-domain.com` → 登录页正常
3. 用演示账号登录（教师 `demo_teacher` / `Demo1234`）→ 工作台正常
4. 上传知识库文档 → 状态变为 `done`（RAG 分块入库）
5. 学生端提问 → 教师端「学生疑问」出现待答疑 → 解答后经验自动沉淀
6. 助手市场 → 内置 8 个助手可浏览/下载

---

## 10. 常见问题排查

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| 前端页面刷新 404 | Nginx 未配 history 回退 | 检查 `try_files ... /index.html` |
| 对话无流式输出 | 代理缓冲了 SSE | 检查 `proxy_buffering off;` |
| 上传文件 `status=failed` + `tenant default_tenant` | chroma 并发初始化竞争 | 重启后端使锁修复生效；避免并发批量上传 |
| 依赖安装失败 | Python 3.14 无 wheel | 换用 Python 3.10/3.11/3.12 |
| 端口被 phantom PID 占用 | 进程残留 | `netstat -ano \| findstr :8008` 后 `taskkill /F /T /PID` |
| 启动报 SECRET_KEY 错误 | 未配置或值不安全 | 按 `.env.production` 生成随机密钥 |

---

## 附录A：Windows 本地部署（开发/演示）

```bash
# 后端（cwd: backend）
pip install -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/ --trusted-host mirrors.aliyun.com
python -m uvicorn app.main:app --reload --port 8008

# 前端（cwd: frontend，另开终端）
npm install
npm run dev
# 访问 http://localhost:5173
```

演示账号：
- 教师：`demo_teacher` / `Demo1234`
- 学生：`qa_student_final` / `test123456`

---

## 附录B：`deploy/` 目录文件说明

| 文件 | 用途 |
|------|------|
| `deploy/nginx.conf` | Nginx 站点配置（静态托管 + API 反代 + SSE） |
| `deploy/backend.service` | systemd 后端服务单元 |
| `deploy/.env.production` | 生产环境变量模板 |

> 部署完成后，请将后端 `--port` 与 `deploy/nginx.conf` 的 `proxy_pass` 端口保持一致。