# PRD 03：架构重构——教学经验从 Agent 中抽离为 User 级别独立实体

> 项目：AI Skills 教育创新创作平台
> 位置：`e:\aiskills`
> 当前状态：五层教学经验（fiveLayerKnowledge）存储在 `Agent.config` JSON 字段中，导致经验与助手强绑定，删助手即丢经验，经验无法跨助手共享。
> 目标：将教学经验提升为 User 级别的独立实体，通过技能文件（SkillFile）作为经验→助手的桥梁，实现"经验归教师，助手纯对话"的架构。

---

## 一、当前架构问题

### 1.1 数据流（现状）

```
Agent.config JSON
├── systemPrompt          ← 对话用 ✓
├── modules               ← 对话用 ✓
├── knowledgeFileIds      ← RAG 检索用 ✓
├── fiveLayerKnowledge    ← 教学经验 ✗ 不该在这里
│   ├── knowledge_layer
│   ├── diagnosis_layer
│   ├── strategy_layer
│   ├── interaction_layer
│   └── feedback_layer
└── teachingExperiences   ← 教学经验 ✗ 不该在这里
```

### 1.2 具体问题

1. **教案生成**（`lesson_plan.py`）需要传 `agent_id`，从 `Agent.config.fiveLayerKnowledge` 读取经验作为上下文
2. **教学反思**（`reflection.py`）需要传 `agent_id`，从 `Agent.config` 读取经验
3. **纠正分析**（`agent.py:analyze-correction`）把分析结果写回 `Agent.config.fiveLayerKnowledge`
4. **知识点提取**（`agent.py:extract-knowledge`）把提取结果写回 `Agent.config.fiveLayerKnowledge`
5. **导出教学经验**（`agent.py:export-teaching-strategy`）从 `Agent.config.fiveLayerKnowledge` 导出技能文件

所有教学经验操作都绑定在 Agent 上，而不是绑定在教师上。

---

## 二、目标架构

### 2.1 数据流（目标）

```
User（教师）───1:1──→ TeacherExperience
                          ├── knowledge_layer
                          ├── diagnosis_layer
                          ├── strategy_layer
                          ├── interaction_layer
                          └── feedback_layer

Agent（助手）── 纯对话
    ├── systemPrompt
    ├── knowledgeFileIds (RAG)
    └── mountSkillFiles (挂载技能)

SkillFile（技能文件）── 经验→助手的桥梁
    ├── 从 TeacherExperience 导出
    └── 挂载到任意 Agent

LessonPlan（教案）── 独立工具
    ├── user_id（必填）
    ├── agent_id（可选，仅用于关联上下文）
    └── 产出 insights → 写入 TeacherExperience

TeachingReflection（反思）── 独立工具
    ├── user_id（必填）
    └── 产出 insights → 写入 TeacherExperience

CorrectionAnalysis（纠正）── 独立工具
    └── 产出 → 写入 TeacherExperience
```

### 2.2 关键原则

- **助手不再承载体经验**：Agent.config 移除 `fiveLayerKnowledge` 和 `teachingExperiences` 字段
- **经验归教师所有**：一个教师只有一份 TeacherExperience
- **技能文件是桥梁**：经验导出为 SkillFile，再挂载到任意助手
- **教案和反思独立于助手**：可以关联助手但不依赖助手

---

## 三、需要改的文件清单

### 3.1 后端新建文件

| 文件 | 作用 |
|------|------|
| `backend/app/models/teacher_experience.py` | TeacherExperience 数据库模型 |
| `backend/app/services/teacher_experience.py` | 经验读写、合并、导出服务 |

### 3.2 后端修改文件

| 文件 | 修改内容 |
|------|----------|
| `backend/app/models/__init__.py` | 导入 TeacherExperience |
| `backend/app/main.py` | 在 `_lightweight_migrate` 中建表 |
| `backend/app/routers/agent.py` | 重写 analyze-correction、extract-knowledge、export-teaching-strategy、five-layer-knowledge 相关端点 |
| `backend/app/routers/lesson_plan.py` | 从 TeacherExperience 读经验，不再从 Agent.config 读 |
| `backend/app/routers/reflection.py` | 从 TeacherExperience 读经验，不再从 Agent.config 读 |
| `backend/app/services/builtins.py` | Agent 配置不再包含 fiveLayerKnowledge |
| `backend/app/services/agent.py` | 移除 _BUILTIN_CATEGORY_MAP 等与经验相关的逻辑 |
| `backend/app/schemas/agent.py` | AgentMarketplaceItem 可能不需要调整 |

### 3.3 前端修改文件

| 文件 | 修改内容 |
|------|----------|
| `frontend/src/pages/AgentPreview.tsx` | 移除五层经验相关 UI，改为显示挂载的技能文件 |
| `frontend/src/pages/LessonPlanner.tsx` | agent_id 改为可选，不再必选 |
| `frontend/src/pages/TeachingReflection.tsx` | agent_id 改为可选 |
| `frontend/src/services/agentApi.ts` | 更新经验相关 API 调用 |
| `frontend/src/components/TeacherLayout.tsx` | 新增"教学经验"导航入口 |
| `frontend/src/App.tsx` | 新增教学经验页面路由 |
| `frontend/src/pages/TeachingExperience.tsx` | **新建**：教师经验库页面 |

---

## 四、详细实现方案

### 4.1 新建 TeacherExperience 模型

文件：`backend/app/models/teacher_experience.py`

```python
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON
from sqlalchemy.sql import func
from ..database import Base


class TeacherExperience(Base):
    """教师教学经验库：User 级别，一个教师只有一份。"""
    __tablename__ = "teacher_experiences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    # 五层经验结构（与旧的 fiveLayerKnowledge 结构相同）
    knowledge_layer = Column(JSON, nullable=False, default=dict)
    diagnosis_layer = Column(JSON, nullable=False, default=dict)
    strategy_layer = Column(JSON, nullable=False, default=dict)
    interaction_layer = Column(JSON, nullable=False, default=dict)
    feedback_layer = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
```

为什么用 5 个独立列而不是 1 个 JSON？
- 每个层独立更新，不需要读→改→写整个大 JSON
- 查询时只需要某个层，不需要加载全部
- 数据库层面更清晰

**初始结构**（每个层）：

```python
DEFAULT_LAYER = {
    "knowledge_layer": {"topics": []},
    "diagnosis_layer": {"pain_points": [], "error_patterns": []},
    "strategy_layer": {"strategies": []},
    "interaction_layer": {"question_templates": [], "guidance_flows": []},
    "feedback_layer": {"feedback_records": []},
}
```

### 4.2 新建 TeacherExperience 服务

文件：`backend/app/services/teacher_experience.py`

```python
"""教师经验库服务：获取、更新、合并、导出。"""
import logging
from sqlalchemy.orm import Session
from ..models.teacher_experience import TeacherExperience

logger = logging.getLogger(__name__)

DEFAULT_LAYERS = {
    "knowledge_layer": {"topics": []},
    "diagnosis_layer": {"pain_points": [], "error_patterns": []},
    "strategy_layer": {"strategies": []},
    "interaction_layer": {"question_templates": [], "guidance_flows": []},
    "feedback_layer": {"feedback_records": []},
}


def get_or_create_experience(db: Session, user_id: int) -> TeacherExperience:
    """获取教师经验库，不存在则创建。"""
    exp = db.query(TeacherExperience).filter(
        TeacherExperience.user_id == user_id
    ).first()
    if not exp:
        exp = TeacherExperience(
            user_id=user_id,
            **DEFAULT_LAYERS,
        )
        db.add(exp)
        db.commit()
        db.refresh(exp)
    return exp


def get_experience_context(db: Session, user_id: int) -> str:
    """将教师经验库格式化为 LLM 上下文文本（供教案/反思生成使用）。"""
    exp = db.query(TeacherExperience).filter(
        TeacherExperience.user_id == user_id
    ).first()
    if not exp:
        return ""

    parts = []
    # L1 知识层
    topics = exp.knowledge_layer.get("topics", []) if isinstance(exp.knowledge_layer, dict) else []
    if topics:
        parts.append("## 教师知识体系\n" + "\n".join(
            f"- {t.get('name', t) if isinstance(t, dict) else t}"
            for t in topics[:5]
        ))
    # L2 诊断层
    pain_points = exp.diagnosis_layer.get("pain_points", []) if isinstance(exp.diagnosis_layer, dict) else []
    if pain_points:
        parts.append("## 学生常见问题诊断\n" + "\n".join(
            f"- {p.get('topic', '')}: {p.get('teacher_diagnosis', '')}"
            for p in pain_points[:5] if isinstance(p, dict)
        ))
    # L3 策略层
    strategies = exp.strategy_layer.get("strategies", []) if isinstance(exp.strategy_layer, dict) else []
    if strategies:
        parts.append("## 教师常用教学策略\n" + "\n".join(
            f"- {s.get('method', s) if isinstance(s, dict) else s}"
            for s in strategies[:5]
        ))
    # L5 反馈层
    records = exp.feedback_layer.get("feedback_records", []) if isinstance(exp.feedback_layer, dict) else []
    if records:
        parts.append("## 历史教学反馈\n" + "\n".join(
            f"- {r.get('applied_in', '')}: {r.get('optimization', '')}"
            for r in records[:3] if isinstance(r, dict)
        ))
    return "\n\n".join(parts) if parts else ""


def merge_to_experience(db: Session, user_id: int, layer_name: str, items: list[dict]):
    """合并新条目到指定层（追加，不覆盖）。"""
    exp = get_or_create_experience(db, user_id)
    current = getattr(exp, layer_name, None)
    if not isinstance(current, dict):
        current = {}
    # 确定列表字段名
    list_field_map = {
        "knowledge_layer": "topics",
        "diagnosis_layer": "pain_points",
        "strategy_layer": "strategies",
        "interaction_layer": "question_templates",
        "feedback_layer": "feedback_records",
    }
    list_field = list_field_map.get(layer_name, "items")
    existing = current.get(list_field, [])
    if not isinstance(existing, list):
        existing = []
    existing.extend(items)
    current[list_field] = existing
    setattr(exp, layer_name, current)
    db.commit()
    return exp


def export_experience_to_skill(db: Session, user_id: int, layers: list[str]) -> str:
    """将指定层导出为 Markdown 格式的技能文件内容。"""
    exp = get_or_create_experience(db, user_id)
    content_parts = ["# 教学经验技能包\n"]
    layer_titles = {
        "knowledge_layer": "L1 知识体系",
        "diagnosis_layer": "L2 学生诊断",
        "strategy_layer": "L3 教学策略",
        "interaction_layer": "L4 课堂交互",
        "feedback_layer": "L5 效果反馈",
    }
    for layer_name in layers:
        title = layer_titles.get(layer_name, layer_name)
        data = getattr(exp, layer_name, {})
        content_parts.append(f"## {title}\n")
        if isinstance(data, dict):
            for key, items in data.items():
                if isinstance(items, list) and items:
                    content_parts.append(f"### {key}\n")
                    for item in items[:10]:
                        if isinstance(item, dict):
                            content_parts.append(f"- **{item.get('topic', item.get('goal', ''))}**: {item.get('content', item.get('method', ''))}")
                        elif isinstance(item, str):
                            content_parts.append(f"- {item}")
        content_parts.append("")
    return "\n".join(content_parts)
```

### 4.3 修改 `backend/app/routers/agent.py`

#### 4.3.1 修改 `analyze-correction` 端点

```python
@router.post("/{agent_id}/analyze-correction")
async def analyze_correction(
    agent_id: int,
    request: AnalyzeCorrectionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """v3.0 机制二：分析教师纠正，写入教师经验库（非 Agent.config）。"""
    from ..services.correction_analyzer import analyze_correction as do_analyze
    from ..services.teacher_experience import merge_to_experience

    # 取 agent 仅用于获取学科上下文
    agent = get_agent_by_id(db, agent_id=agent_id, user_id=current_user.id)
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    analysis = await do_analyze(
        original_answer=request.original_answer,
        corrected_answer=request.corrected_answer,
        student_question=request.student_question,
        subject_label=request.subject_label,
    )

    # 写入教师经验库（而非 Agent.config）
    diagnosis_items = analysis.get("diagnosis", {}).get("pain_points", [])
    strategy_items = analysis.get("strategy", {}).get("strategies", [])
    if diagnosis_items:
        merge_to_experience(db, current_user.id, "diagnosis_layer", diagnosis_items)
    if strategy_items:
        merge_to_experience(db, current_user.id, "strategy_layer", strategy_items)

    return {
        "message": f"已提取 {len(diagnosis_items)} 条诊断 + {len(strategy_items)} 条策略到教师经验库",
        "diagnosis_count": len(diagnosis_items),
        "strategy_count": len(strategy_items),
        "analysis": analysis,
    }
```

#### 4.3.2 修改 `extract-knowledge` 端点

```python
@router.post("/{agent_id}/extract-knowledge")
async def extract_knowledge(
    agent_id: int,
    request: ExtractKnowledgeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """v3.0 机制一：从知识库文件提取知识点到教师经验库。"""
    from ..services.knowledge_extractor import extract_knowledge_from_text
    from ..services.teacher_experience import merge_to_experience, get_or_create_experience

    # 验证 agent 存在
    agent = get_agent_by_id(db, agent_id=agent_id, user_id=current_user.id)
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    # ... 文件处理逻辑不变 ...
    # 但写入目标改为教师经验库
    merge_to_experience(db, current_user.id, "knowledge_layer", new_topics)
    # ...
```

#### 4.3.3 修改 `get_five_layer_knowledge` → 改为从 TeacherExperience 读取

```python
@router.get("/{agent_id}/five-layer-knowledge")
def get_five_layer_knowledge(
    agent_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """v3.0：查看教师经验库（替代旧版 Agent 级别的五层经验）。"""
    from ..services.teacher_experience import get_or_create_experience

    exp = get_or_create_experience(db, current_user.id)
    stats = {
        "knowledge_layer": len(exp.knowledge_layer.get("topics", []) if isinstance(exp.knowledge_layer, dict) else []),
        "diagnosis_layer": len(exp.diagnosis_layer.get("pain_points", []) if isinstance(exp.diagnosis_layer, dict) else []),
        "strategy_layer": len(exp.strategy_layer.get("strategies", []) if isinstance(exp.strategy_layer, dict) else []),
        "interaction_layer": len(exp.interaction_layer.get("question_templates", []) if isinstance(exp.interaction_layer, dict) else []),
        "feedback_layer": len(exp.feedback_layer.get("feedback_records", []) if isinstance(exp.feedback_layer, dict) else []),
    }
    return {
        "five_layer": {
            "knowledge_layer": exp.knowledge_layer,
            "diagnosis_layer": exp.diagnosis_layer,
            "strategy_layer": exp.strategy_layer,
            "interaction_layer": exp.interaction_layer,
            "feedback_layer": exp.feedback_layer,
        },
        "stats": stats,
    }
```

#### 4.3.4 修改 `export-teaching-strategy` → 从 TeacherExperience 导出

```python
@router.post("/{agent_id}/export-teaching-strategy")
def export_teaching_strategy(
    agent_id: int,
    request: ExportTeachingStrategyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """v3.0：从教师经验库导出为技能文件。"""
    from ..services.teacher_experience import export_experience_to_skill

    # agent_id 仅用于命名
    agent = get_agent_by_id(db, agent_id=agent_id, user_id=current_user.id)
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    # 从教师经验库导出
    content = export_experience_to_skill(db, current_user.id, layers=[
        f"{layer}_layer" for layer in request.layers
    ])

    skill_data = SkillFileCreate(
        name=f"{agent.name} - 教学经验",
        description=f"从教师经验库导出的教学经验",
        content=content,
        source="teaching_strategy_export",
    )
    skill_file = create_skill_file(db, user_id=current_user.id, data=skill_data)
    return skill_file
```

#### 4.3.5 删除 `delete_five_layer_entry` 端点

这个端点需要改为操作 TeacherExperience，或保留但改为操作 TeacherExperience。

### 4.4 修改 `backend/app/routers/lesson_plan.py`

```python
# 原来：从 Agent.config 读取经验
experience_context = ""
if req.agent_id:
    agent = db.query(Agent).filter(...)
    five_layer = agent.config.get("fiveLayerKnowledge", {})
    # ...

# 改为：从 TeacherExperience 读取经验
from ..services.teacher_experience import get_experience_context
experience_context = get_experience_context(db, current_user.id)
```

同时 `agent_id` 改为可选参数，不再影响经验上下文。

### 4.5 修改 `backend/app/routers/reflection.py`

同样改为从 `TeacherExperience` 读取经验上下文。

### 4.6 修改 `backend/app/services/builtins.py`

从 `_agent_config_from_definition` 中删除 `fiveLayerKnowledge` 和 `teachingExperiences` 的初始化：

```python
# 删除这两行：
"fiveLayerKnowledge": { ... },
"teachingExperiences": [],
```

### 4.7 数据库迁移

在 `backend/app/main.py` 的 `_lightweight_migrate` 函数中添加：

```python
# 10. teacher_experiences 表
c.execute("""CREATE TABLE IF NOT EXISTS teacher_experiences (
    id INTEGER PRIMARY KEY,
    user_id INTEGER UNIQUE,
    knowledge_layer JSON,
    diagnosis_layer JSON,
    strategy_layer JSON,
    interaction_layer JSON,
    feedback_layer JSON,
    created_at DATETIME,
    updated_at DATETIME
)""")
conn.commit()
logger.info("teacher_experiences table ensured")
```

### 4.8 前端：新建教师经验页面

文件：`frontend/src/pages/TeachingExperience.tsx`

功能：
- 展示五层经验库，每层一个卡片
- 每层显示条目数统计
- 支持查看每层的详细条目
- 支持删除某条经验
- "导出为技能"按钮：选择层 → 导出为 SkillFile
- "挂载到助手"按钮：选择助手 → 挂载技能文件

### 4.9 前端：修改教案页面

`frontend/src/pages/LessonPlanner.tsx`：
- `agent_id` 下拉框改为可选（不选也能生成教案）
- 经验上下文自动从 API 获取（后端已改为从 TeacherExperience 读取）

### 4.10 前端：修改导航

`frontend/src/components/TeacherLayout.tsx` 添加导航项：

```tsx
{ id: 'experience', label: '教学经验', icon: Brain, path: '/teacher/experience' },
```

`frontend/src/App.tsx` 添加路由：

```tsx
<Route
  path="/teacher/experience"
  element={
    <ProtectedRoute role="teacher">
      <TeachingExperience />
    </ProtectedRoute>
  }
/>
```

---

## 五、API 变更汇总

| 旧 API | 变更 | 新行为 |
|--------|------|--------|
| `GET /api/agents/{id}/five-layer-knowledge` | 保留路径，改为从 TeacherExperience 读取 | 返回教师经验库 |
| `POST /api/agents/{id}/extract-knowledge` | 保留路径，写入目标改为 TeacherExperience | 提取到教师经验库 |
| `POST /api/agents/{id}/analyze-correction` | 保留路径，写入目标改为 TeacherExperience | 分析到教师经验库 |
| `POST /api/agents/{id}/export-teaching-strategy` | 保留路径，从 TeacherExperience 导出 | 导出技能文件 |
| `DELETE /api/agents/{id}/five-layer-knowledge/{layer}/{index}` | 改为操作 TeacherExperience | 删除经验条目 |
| `POST /api/lesson-plans/generate` | agent_id 改为可选 | 不依赖助手 |
| `POST /api/reflections/generate` | agent_id 改为可选 | 不依赖助手 |
| 新增 `GET /api/teacher-experience` | 新增 | 获取教师经验库 |
| 新增 `POST /api/teacher-experience/export-skill` | 新增 | 导出经验为技能文件 |

---

## 六、执行顺序

1. **创建 TeacherExperience 模型**（`models/teacher_experience.py`）
2. **数据库迁移**（`main.py` 新建表）
3. **创建服务层**（`services/teacher_experience.py`）
4. **修改 agent.py 路由**（analyze-correction 等端点）
5. **修改 lesson_plan.py**（从 TeacherExperience 读取）
6. **修改 reflection.py**（从 TeacherExperience 读取）
7. **修改 builtins.py**（移除 fiveLayerKnowledge 初始化）
8. **修改 cleanup_data.py**（清理时也删除 TeacherExperience 记录）
9. **前端修改**（新建经验页面 + 修改教案/反思页面 + 导航）
10. **测试验证**

---

## 七、验收标准

### 后端

- [ ] `teacher_experiences` 表创建成功
- [ ] `GET /api/agents/{id}/five-layer-knowledge` 返回教师经验库数据
- [ ] `POST /api/agents/{id}/analyze-correction` 写入教师经验库
- [ ] `POST /api/agents/{id}/extract-knowledge` 写入教师经验库
- [ ] `POST /api/agents/{id}/export-teaching-strategy` 从教师经验库导出
- [ ] `POST /api/lesson-plans/generate` 不传 agent_id 也能生成教案
- [ ] `POST /api/reflections/generate` 不传 agent_id 也能生成反思
- [ ] 内置助手的 Agent.config 不再包含 fiveLayerKnowledge
- [ ] 删除助手后，教师经验库数据不受影响

### 前端

- [ ] 导航栏出现"教学经验"入口
- [ ] 教学经验页面展示五层经验和统计数据
- [ ] 教案页面 agent_id 不再是必选项
- [ ] 反思页面 agent_id 不再是必选项
- [ ] 导出经验为技能文件的功能可用
- [ ] 助手预览页不再显示五层经验 UI

### 数据一致性

- [ ] 删助手后 TeacherExperience 数据完整
- [ ] 一个教师只有一份 TeacherExperience
- [ ] 多助手共享同一份经验库
- [ ] 技能文件可挂载到任意助手

---

## 八、注意事项

1. **不要删除旧数据中的五层经验**：如果运行迁移前数据库中有经验数据，应迁移到新表
2. **API 路径尽量不变**：避免前端大量改动，旧路径保留但行为改为从 TeacherExperience 读写
3. **向后兼容**：`agent_id` 参数在教案/反思中改为可选，不传也能工作
4. **不要引入新的 Python 依赖**
5. **不要修改 SECRET_KEY 或任何认证逻辑**
6. **不要修改 `backend/app/main.py` 中现有的迁移逻辑结构**，只新增 teacher_experiences 表