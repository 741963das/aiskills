# AI 教学助手 v3.0 迭代指南

> 基于两次需求讨论的决策汇总，用于指导 AI 进行版本迭代开发。
> 完整 PRD 见 [skill-creation-prd.html](skill-creation-prd.html)。

---

## 1. 核心设计决策

### 1.1 从"填表沉淀"到"使用中生长"

v2.1 的核心问题是：让教师填更多表单来采集教学经验，但填表越多教师越不想用。v3.0 改弦更张：

- 创建时 **仅新增 1 个开放问题**（学生常见错误），零额外负担
- 教学经验 **不靠表单采集**，而是从教师使用助手的过程中自动提取
- 五层知识库随使用 **渐进式生长**，初始为空

### 1.2 从"记录行为标签"到"沉淀决策经验"

旧方案按"教学方法/互动方式/评估策略/工具使用"分类，只能记录教师做了什么。v3.0 记录的是 **教师为什么这样做**——判断逻辑、策略选择理由、纠错思路。

---

## 2. 五层经验沉淀模型

### 2.1 模型总览

| 层次 | 沉淀目标 | 核心问题 | 数据来源 | 积累方式 |
|------|----------|----------|----------|----------|
| L1 知识体系层 | 学科知识结构 | "老师教什么？" | 教案/PPT/讲义/试卷 | 文件上传自动提取 |
| L2 学生诊断层 | 判断学生问题的能力 | "学生卡在哪？为什么？" | 创建时1个问题 + 对话纠正 | 主动输入 + 被动积累 |
| L3 教学策略层 | 教学决策逻辑 | "为什么这样讲？" | AI回答被纠正时 | 完全被动积累 |
| L4 课堂交互层 | 沟通引导方法 | "怎么引导学生？" | 对话中的追问/引导话术 | 模式识别自动提取 |
| L5 效果反馈层 | 方法效果验证 | "这个方法好用吗？" | 使用频率/学生反馈/策略迭代 | 信号检测自动形成闭环 |

### 2.2 L1 知识体系层 数据结构

```json
{
  "knowledge_layer": {
    "topics": [
      {
        "name": "二次函数",
        "chapter": "第三章 函数",
        "core_concepts": [
          { "term": "顶点", "definition": "二次函数图像的最高点或最低点" }
        ],
        "key_points": ["顶点坐标公式", "对称轴方程"],
        "difficulties": [
          {
            "point": "参数对函数图像的影响",
            "reason": "学生无法建立参数变化与图像变化的直观联系"
          }
        ],
        "typical_examples": [
          { "question": "已知 f(x)=x²-4x+3，求顶点坐标", "solution": "配方法..." }
        ],
        "question_types": ["求顶点/对称轴", "图像变换", "综合应用题"]
      }
    ],
    "chapter_structure": [
      { "chapter": "第三章 函数", "order": 3, "prerequisites": ["第二章 方程与不等式"] }
    ],
    "source_files": ["高等数学教案.pdf", "期中试题.docx"]
  }
}
```

### 2.3 L2 学生诊断层 数据结构

沉淀结构：**学生表现 → 原因判断 → 解决方案**

```json
{
  "diagnosis_layer": {
    "pain_points": [
      {
        "topic": "二次函数综合题",
        "surface_error": "学生说不会套公式",
        "teacher_diagnosis": "无法建立题目条件与数学模型之间的联系",
        "root_cause": "缺乏从文字描述提取数学条件的能力",
        "solution": "训练条件提取和模型转换：先读题画图，再列已知条件，最后选择公式",
        "source": "creation_form"
      }
    ],
    "error_patterns": [
      {
        "pattern": "混淆顶点坐标和对称轴公式",
        "frequency": "高",
        "affected_topics": ["二次函数", "函数图像"],
        "correction_strategy": "先画图再写公式，建立图像与公式的对应关系"
      }
    ]
  }
}
```

### 2.4 L3 教学策略层 数据结构

沉淀结构：**目标 → 策略 → 步骤 → 适用条件**

```json
{
  "strategy_layer": {
    "strategies": [
      {
        "goal": "帮助学生理解函数变化规律",
        "method": "生活场景类比 → 数学模型抽象",
        "reasoning": "大一新生对抽象数学符号缺乏直觉，需要先建立感性认识",
        "steps": [
          "案例引入：用投篮轨迹引出抛物线概念",
          "图像观察：展示不同参数的函数图像变化",
          "规律总结：引导学生归纳参数与图像的关系",
          "公式推导：在理解图像的基础上推导顶点公式"
        ],
        "suitable_for": ["基础阶段学生", "概念初学阶段"],
        "not_suitable_for": ["高阶竞赛学生", "已掌握基础概念的学生"],
        "source": "chat_correction",
        "usage_count": 12
      }
    ]
  }
}
```

### 2.5 L4 课堂交互层 数据结构

```json
{
  "interaction_layer": {
    "question_templates": [
      {
        "scenario": "学生回答错误时",
        "prompt": "如果你的答案正确，图像应该是什么样？",
        "purpose": "引导学生自主发现逻辑矛盾",
        "usage_count": 8
      }
    ],
    "guidance_flows": [
      {
        "trigger": "学生直接说不会做",
        "steps": [
          "先确认学生已知条件",
          "引导回忆相关知识点",
          "分步推理",
          "放手让学生自主完成后续步骤"
        ]
      }
    ],
    "feedback_strategies": [
      {
        "error_type": "概念混淆",
        "strategy": "不直接纠正，用反例让学生自己发现矛盾",
        "example": "学生混淆速度和加速度 → 问：匀速圆周运动速度不变，加速度为零吗？"
      }
    ]
  }
}
```

### 2.6 L5 效果反馈层 数据结构

闭环结构：**方法 → 反馈 → 效果 → 优化**

```json
{
  "feedback_layer": {
    "feedback_records": [
      {
        "strategy_ref": "生活场景类比 → 数学模型抽象",
        "applied_in": "二次函数概念讲解",
        "student_response": "学生理解了顶点概念，但迁移到综合题仍有困难",
        "effectiveness": "partial",
        "optimization": "在类比之后增加一道简单的综合题，训练从具体到抽象的过渡",
        "timestamp": "2026-08-07T15:30:00Z"
      }
    ],
    "strategy_evolution": [
      {
        "strategy_ref": "生活场景类比 → 数学模型抽象",
        "version": 2,
        "change": "在步骤2和步骤3之间插入简单综合题训练环节",
        "reason": "学生反馈：理解概念但无法应用到综合题"
      }
    ]
  }
}
```

---

## 3. 表单改造方案

### 3.1 Step 3 表单结构

**单页表单，无 Tab**。所有字段使用结构化控件，仅 1 个开放问题。

高等教育模板字段：

| 字段名 | 控件类型 | 选项/示例 | 必填 |
|--------|----------|-----------|------|
| `role` | 文本输入 + datalist | 如：高中物理教师 | 是 |
| `subject` | 单选标签组 | 理学/工学/文学/管理学/医学/经济学/法学/教育学/其他 | 是 |
| `courseName` | 文本输入 | 如：高等数学A | 是 |
| `audienceLevel` | 单选标签组 | 大一新生/大二/大三/大四/研究生 | 是 |
| `coreTasks` | 多选标签组 | 概念讲解/习题辅导/实验指导/论文写作/考研辅导/课程答疑/知识点梳理/案例讨论 | 是 |
| `style` | 单选标签组 | 专业严谨/生动有趣/循序渐进/启发引导/案例驱动 | 默认值 |
| `studentPainPoints` | 文本输入（开放问题） | "学生在哪些知识点上最容易出错？典型表现是什么？" | 推荐填写 |

职业教育模板字段类似，将 `subject` 替换为 `major`，增加 `targetJob`、`coreSkills` 等。

### 3.2 关键设计点

- `studentPainPoints` 是五层模型中 **L2 学生诊断层** 的唯一主动输入
- 每个字段附带灰色小字示例说明填写规范
- 所有标签控件使用 `cursor-pointer` + 200ms hover 过渡
- 输入框使用 `focus:ring-2 focus:ring-[#0D9488]` + 关联 label

---

## 4. AI 结构化端点

### 4.1 端点一：生成结构化配置

```
POST /api/agents/generate-structured-config
```

**请求体**（简化后，移除 teaching_strategy）：

```json
{
  "template": "higher_edu",
  "publish_scope": "students",
  "role": "高中物理教师",
  "subject": "理学",
  "course_name": "大学物理（力学）",
  "audience_level": "大一新生",
  "audience_detail": ["零基础入门", "需要考研"],
  "core_tasks": ["概念讲解", "习题辅导", "实验指导"],
  "style": "专业严谨",
  "student_pain_points": "学生最容易在二次函数参数变化上出错..."
}
```

**响应体**（6 模块，teaching_strategy 替换为 student_diagnosis）：

```json
{
  "fallback": false,
  "modules": {
    "identity": { "title": "身份声明", "content": "...", "editable": true },
    "capabilities": { "title": "核心能力", "content": "...", "items": [...], "editable": true },
    "answer_rules": { "title": "回答规范", "content": "...", "rules": [...], "editable": true },
    "student_diagnosis": { "title": "学生诊断", "content": "...", "diagnosis": {...}, "editable": true },
    "knowledge_strategy": { "title": "知识库使用指南", "content": "...", "editable": true },
    "boundaries": { "title": "边界约束", "content": "...", "editable": true }
  },
  "system_prompt": "（由6模块自动拼接）"
}
```

### 4.2 端点二：局部重新生成

```
POST /api/agents/regenerate-module
```

支持模块名：`identity | capabilities | answer_rules | student_diagnosis | knowledge_strategy | boundaries`

### 4.3 端点三：课件生成（扩展输入）

```
POST /api/agents/{agent_id}/generate-courseware
```

新增 `teaching_config` 参数，从 `Agent.config.five_layer_knowledge` 读取 L1-L4 数据，注入 LLM 提示词。

### 4.4 端点四：导出五层经验为技能包

```
POST /api/agents/{agent_id}/export-teaching-strategy
```

请求体支持指定导出层次：

```json
{
  "layers": ["knowledge", "diagnosis", "strategy", "interaction", "feedback"]
}
```

### 4.5 后端实现要点

- Meta-Prompt 构建：新建 `_build_structured_meta_prompt()`，将表单数据（含 `studentPainPoints`）组织为 LLM user message
- LLM 使用 `response_format={"type": "json_object"}`（DeepSeek-V3.2），temperature 0.7
- 三级降级策略：(1) JSON Mode + Schema 校验 → (2) 正则提取 JSON 片段 → (3) 降级纯文本 Prompt
- PPT 生成指令在 `answer_rules` 中由后端自动注入，不依赖 LLM 生成

---

## 5. 被动积累机制

### 5.1 机制一：文件上传 → L1 知识体系提取

- 触发：教师上传教案/PPT/讲义/试卷到知识库
- 流程：文件解析 → 分块 → **LLM 知识点提取**（新增）→ 增量更新 L1
- 提取内容：知识点名称、章节归属、核心概念定义、重点难点、典型例题
- 增量策略：按知识点名称合并，追加不覆盖
- 教师可查看/修正提取结果

### 5.2 机制二：AI 回答纠正 → L2 诊断 + L3 策略双提取

- 触发：教师修改或纠正 AI 的回答
- 流程：对比原始回答与修改后回答 → 识别差异段落 → 发送给分析 LLM → 分别追加到 L2 和 L3
- 分析 LLM 需提取：
  - 诊断维度：学生表面错误 → 教师判断 → 深层原因 → 解决方法
  - 策略维度：教学目标 → 采用方法 → 选择理由 → 教学步骤
- **性能优化**：批量 + 异步，每积累 5 条或每 30 分钟处理一次

### 5.3 机制三：对话交互模式识别 → L4 交互层积累

- 触发模式：
  - 追问模式：连续 2 条以上消息且含问句 → 引导流程
  - 反例模式：含"如果...会怎样"等句式 → 反馈策略
  - 纠错模式：含"不对""再想想"等否定词 + 引导语 → 提问模板
  - 鼓励模式：含"很好""对了"等肯定词 → 话术库
- 策略：规则匹配（正则）做初筛 + LLM 做语义确认
- 频率：每 10 次对话批量处理

### 5.4 机制四：效果反馈闭环 → L5 反馈层

- 信号一：同一知识点 3 次以上重复讲解 → 判定策略效果不佳
- 信号二：学生在 AI 回答后继续追问同一知识点 → 未完全解决疑问
- 信号三：教师在类似场景使用不同策略 → 记录策略演化（version +1）
- 教师主动标记"这个回答很好" → 最精准的反馈信号

---

## 6. 数据模型变更

### 6.1 Agent.config 升级

```json
{
  "structuredModules": {
    "identity": { "title": "身份声明", "content": "..." },
    "capabilities": { "title": "核心能力", "content": "...", "items": [...] },
    "answer_rules": { "title": "回答规范", "content": "...", "rules": [...] },
    "student_diagnosis": { "title": "学生诊断", "content": "...", "diagnosis": {...} },
    "knowledge_strategy": { "title": "知识库使用指南", "content": "..." },
    "boundaries": { "title": "边界约束", "content": "..." }
  },
  "systemPrompt": "（由6模块拼接，保持向后兼容）",
  "formData": { "template": "...", "role": "...", "subject": "...", ... },
  "fiveLayerKnowledge": {
    "knowledge_layer": { "topics": [...], "chapter_structure": [...], "source_files": [...] },
    "diagnosis_layer": { "pain_points": [...], "error_patterns": [...] },
    "strategy_layer": { "strategies": [...] },
    "interaction_layer": { "question_templates": [...], "guidance_flows": [...], "feedback_strategies": [...] },
    "feedback_layer": { "feedback_records": [...], "strategy_evolution": [...] }
  },
  "llmModel": "deepseek-ai/DeepSeek-V3.2",
  "similarityThreshold": 0.3,
  "topK": 5,
  "chunkSize": 512,
  "chunkOverlap": 50,
  "knowledgeFileIds": [1, 2, 3]
}
```

### 6.2 向后兼容

- `systemPrompt` 字段保留不变，旧版 Agent 对话行为不受影响
- 旧版 Agent 没有 `structuredModules` 和 `fiveLayerKnowledge`，`_build_system_prompt()` 直接读取 `systemPrompt`
- `fiveLayerKnowledge` 初始为空对象 `{}`，随使用渐进式积累

---

## 7. 前端交互设计

### 7.1 Step 3：单页结构化表单

- 无 Tab，单页完成
- 基础信息使用结构化控件（单选/多选标签 + 文本输入）
- 最后一个字段 `studentPainPoints` 为开放文本输入，附带灰色提示文字
- 必填项全部完成后"下一步"按钮可点击

### 7.2 Step 4：结构化 AI 输出展示

- 6 个模块以卡片网格排列，2 列布局
- 每个卡片可独立编辑（textarea 模式）和重新生成（调用 `/regenerate-module`）
- 降级模式（`fallback: true`）回退到单一 textarea
- 生成中显示骨架屏 + 进度提示

### 7.3 Step 5：预览与保存

- 结构化模块只读展示 + "查看完整 Prompt"折叠区域
- 保存时存入 `structuredModules` + `formData`，`fiveLayerKnowledge` 初始为空

### 7.4 新增：知识库管理 - 经验沉淀 Tab

- 左侧：五层垂直导航，每层显示条目数
- 右侧：当前层次的条目列表，可展开/编辑/删除
- 顶部：统计概览 + "待分析纠正记录（N条）" 提示
- 底部：导出按钮 + 手动触发积累分析按钮

### 7.5 结构化输入组件

需新建组件，放在 `frontend/src/components/structured-form/`：

| 组件 | 功能 |
|------|------|
| `TagSelect` | 单选标签组 |
| `MultiTagSelect` | 多选标签组（支持限选数量） |
| `TextInputWithHint` | 文本输入 + datalist 建议 + 灰色提示 |
| `RadioCardGroup` | 单选卡片组 |
| `KnowledgeLayerPanel` | 五层经验知识库管理面板 |

---

## 8. 实施路径

### 阶段划分

| 阶段 | 内容 | 涉及文件 | 验证标准 |
|------|------|----------|----------|
| P1 后端结构化端点 | `generate-structured-config`、`regenerate-module`；结构化 Meta-Prompt；JSON 解析与降级 | `routers/agent.py`（新增 2 路由 + 2 Model） | Postman 返回合法 JSON；降级路径可用 |
| P2 前端结构化表单 | 4 个结构化输入组件；重构 Step 3 为单页表单 | `components/structured-form/*`（新建）；`AgentCreate.tsx`（重构 Step 3） | 表单数据正确组装；`npx tsc --noEmit` 零错误 |
| P3 前端结构化展示 | 重构 Step 4 为模块卡片网格（6 模块含 student_diagnosis）；编辑/重新生成/降级 | `AgentCreate.tsx`（重构 Step 4-5）；`agentApi.ts`（新增 2 方法） | 6 模块正确渲染；降级模式可用 |
| P4 五层经验导出 + 课件扩展 | `export-teaching-strategy` 支持五层选择性导出；`generate-courseware` 接收五层配置 | `routers/agent.py`；`services/courseware_generator.py` | 课件质量提升；经验可导出为 SkillFile |
| P5 被动积累机制 | 文件上传知识点提取；纠正记录双维度分析；交互模式识别；效果反馈信号检测；知识库管理"经验沉淀"页面 | `services/knowledge_extractor.py`（新建）；`services/correction_analyzer.py`（新建）；`routers/agent.py`（新增积累路由）；`pages/KnowledgeBase.tsx`（新建） | 上传后知识点自动提取；纠正后诊断和策略自动生成；`npx tsc --noEmit` 零错误 |

### 风险应对

1. **LLM JSON 输出不稳定**：三级降级（JSON Mode → 正则提取 → 纯文本）
2. **被动积累 LLM 调用成本**：批量 + 异步队列；规则匹配做初筛
3. **五层数据冷启动**：接受初始为空，随使用自然增长；上传文件触发 L1，主动标记触发 L3/L4
4. **LLM 提取质量不稳定**：所有结果标记"待确认"，教师可审核修改；连续 3 次被删除的模式降低提取权重

---

## 9. 关键约束

- 所有 AI 调用使用国内大模型（DeepSeek-V3.2 / Qwen2.5-72B-Instruct），通过硅基流动 API
- JWT 认证：所有接口从 token 解析 user_id
- 颜色方案：indigo + cyan（primary #4338CA，accent #0891B2）
- 字体：Plus Jakarta Sans
- 所有修改后运行 `npx tsc --noEmit` 确保零错误
- 不引入新依赖
- 仅修改视觉/交互，不改变功能逻辑
- 使用方括号语法写颜色（如 `bg-[#0D9488]`）

---

## 10. 验收标准

- 新建 Agent 时 Step 3 全部使用结构化控件，仅 1 个开放问题
- AI 生成返回结构化 JSON，6 个模块（含 `student_diagnosis`）可独立编辑和重新生成
- 降级模式在 LLM 返回非法 JSON 时自动启用，不阻断创建流程
- 已发布 v2.1 Agent 对话行为不受影响
- 文件上传后知识点自动提取到 `knowledge_layer`
- 教师纠正 AI 回答后，诊断和策略自动提取到对应层次
- 五层经验可选择性导出为 SkillFile 并挂载到其他 Agent
- 课件生成包含教学环节编排（导入→讲解→互动→总结），非纯要点平铺
- `npx tsc --noEmit` 零错误；后端无新增依赖