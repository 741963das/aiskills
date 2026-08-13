# PRD 01：为 8 个平台内置助手填充真实知识库文件

> 项目：AI Skills 教育创新创作平台
> 位置：`e:\aiskills`
> 当前状态：8 个内置助手（SYSTEM 用户）已创建并发布，但全部没有挂载知识库文件，对话完全依赖 LLM 通用知识，无法引用教材内容、标注来源。
> 目标：为每个内置助手至少上传 1-2 份真实知识库文件，触发 RAG 索引，并验证对话中能检索到知识库内容。

---

## 一、前置确认

### 1.1 确认 8 个内置助手状态

```
后端启动后，访问 http://localhost:8000/docs，调用 GET /api/admin/status
返回的 builtin_agents_published 应为 8。

或者直接查 SQLite：
SELECT a.id, a.name, a.course_name, a.status, u.username
FROM agents a JOIN users u ON a.user_id = u.id
WHERE u.username = 'SYSTEM' AND a.status = 'published';
```

确认 8 个助手名称：
1. 高等数学助教
2. Python 编程导师
3. 大学英语读写助手
4. 大学物理（力学）助教
5. 教案设计专家
6. 试卷与题目生成器
7. 机电一体化实训导师
8. 思政课学习助手

### 1.2 确认知识库文件表当前为空

```sql
SELECT COUNT(*) FROM knowledge_files;
SELECT COUNT(*) FROM knowledge_chunks;
```
预期结果均为 0。

---

## 二、为每个助手准备知识库文件

### 2.1 知识库文件要求

- 每个助手至少 1 份文件，建议 2 份
- 格式：PDF / DOCX / TXT / MD
- 文件内容：真实教材章节、教学大纲、习题集、课程讲义等
- 文件大小：每份 50KB-2MB
- 文件来源：
  - 公开可获取的教材 PDF（如高等教育出版社公开章节）
  - 自编的教学资料（Markdown 格式）
  - 网上公开的课程讲义（CC 协议或教学用途可用的）

### 2.2 各助手推荐知识库内容

| 助手 | 建议文件 1 | 建议文件 2 |
|------|-----------|-----------|
| 高等数学助教 | 高数第一章函数与极限讲义（自编 MD） | 高数常见习题集（自编 MD） |
| Python 编程导师 | Python 基础语法速查表（自编 MD） | Python 常见错误清单（自编 MD） |
| 大学英语读写助手 | 四级写作模板与范文（自编 MD） | 常见语法错误指南（自编 MD） |
| 大学物理（力学）助教 | 力学第一章质点运动学讲义（自编 MD） | 力学典型例题集（自编 MD） |
| 教案设计专家 | 布卢姆教学目标分类法（自编 MD） | 各学科教案示例（自编 MD） |
| 试卷与题目生成器 | 命题规范与双向细目表（自编 MD） | 各题型设计指南（自编 MD） |
| 机电一体化实训导师 | 机电一体化概述（自编 MD） | 常见故障排查手册（自编 MD） |
| 思政课学习助手 | 思修第一章要点梳理（自编 MD） | 思政课常见论述题（自编 MD） |

### 2.3 知识库文件创建方式

**方式 A：网上搜索公开教材 PDF**
- 使用 WebSearch 搜索"高等数学 同济 第一章 极限 连续 PDF"
- 注意：仅下载明确标注为教学用途可用的公开资源
- 下载后保存到本地临时目录

**方式 B：自编 Markdown 教学资料（推荐）**
- 直接创建 Markdown 文件，内容为真实课程知识点
- 每个文件 2000-5000 字，包含章节标题、知识点、例题、常见错误
- 保存到 `e:\aiskills\backend\knowledge_materials\` 目录

**方式 C：同时使用 A+B 组合**

---

## 三、上传知识库文件到对应助手

### 3.1 上传流程

知识库文件通过 `POST /api/knowledge/upload` 上传，需要指定 `agent_id`。

对于 SYSTEM 用户的内置助手，需要先获取每个助手的 agent_id：

```python
# 后端 Python 伪代码
from app.database import SessionLocal
from app.models.agent import Agent
from app.models.user import User

db = SessionLocal()
system_user = db.query(User).filter(User.username == "SYSTEM").first()
agents = db.query(Agent).filter(
    Agent.user_id == system_user.id,
    Agent.status == "published"
).all()
for a in agents:
    print(f"{a.id}: {a.name}")
```

### 3.2 上传后自动触发 RAG 处理

上传接口返回后，后端会自动：
1. 文件保存到 `uploads/knowledge/` 目录
2. 文本提取（PDF/DOCX → 纯文本）
3. 文本切片（chunk_size=512, chunk_overlap=50）
4. Embedding 生成（BAAI/bge-m3）
5. 存入 Chroma 向量库（collection: `agent_{agent_id}`）
6. 写入 SQLite `knowledge_files` 和 `knowledge_chunks` 表

### 3.3 上传后验证

```sql
-- 验证知识库文件已关联到助手
SELECT a.name, kf.filename, kf.status, kf.chunk_count
FROM knowledge_files kf
JOIN agents a ON kf.agent_id = a.id
WHERE kf.status = 'done';
```

每个助手应有至少 1 条记录，status 为 `done`，chunk_count > 0。

---

## 四、验证对话中的知识库检索

### 4.1 测试方法

在助手市场页面点击任一内置助手，进入对话体验区，发送一条明显需要知识库支持的提问：

- 高等数学助教："请解释极限的 ε-N 定义" → 应出现【参考：xxx.md】标注
- Python 编程导师："Python 中列表和字典的区别" → 应引用知识库内容
- 大学英语读写助手："如何写一篇四级议论文" → 应引用写作模板

### 4.2 验证要点

- [ ] 对话回答中出现了【参考：文件名】标注
- [ ] 回答内容与知识库文件内容相关（不是纯 LLM 编造）
- [ ] 后端日志中能看到 RAG 检索日志

---

## 五、注意事项

1. **不要用随机生成的内容**：知识库文件必须是真实的教学内容，不是 "Lorem ipsum" 或 AI 随机生成的
2. **文件命名规范**：使用中文文件名，如 `高等数学第一章函数与极限讲义.md`
3. **不要修改 `builtins.py`**：知识库文件是上传到数据库的，不是写在代码里的
4. **如果知识库文件目录不存在**，先创建 `e:\aiskills\backend\knowledge_materials\`
5. **不要上传受版权保护的整本教材**：只上传公开章节、自编内容或教学用途明确允许的片段
6. **上传后等待处理完成**：大文件可能需要几秒到几十秒，确认 status 变为 `done` 后再验证

---

## 六、验收标准

- [ ] 8 个内置助手每个至少有 1 个知识库文件（status=done）
- [ ] `knowledge_files` 表至少有 8 条记录
- [ ] `knowledge_chunks` 表有对应的切片记录
- [ ] Chroma 向量库中有对应的 collection 和向量数据
- [ ] 与任意 3 个内置助手对话，都能看到知识库检索结果被引用
- [ ] 对话回答中出现了【参考：文件名】标注
- [ ] `knowledge_materials/` 目录下有所有自编的知识库文件