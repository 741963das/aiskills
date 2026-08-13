"""v4.0 教学经验自动沉淀 - 从教师对话中提取教学经验。

教师与助手对话后，后台分析对话内容，自动提取：
- L2 学生诊断：学生常见问题、误解模式
- L3 教学策略：有效的教学方法和解释思路
- L4 课堂交互：好的引导提问和互动方式
- L5 效果反馈：教学策略的效果验证

提取结果增量合并到 Agent.config.fiveLayerKnowledge。
"""
import json
import logging
import re
from typing import Any

from sqlalchemy.orm import Session

from ..models.agent import Agent
from ..models.message import Message
from ..models.conversation import Conversation

logger = logging.getLogger(__name__)


async def extract_experience_from_conversation(
    db: Session,
    agent: Agent,
    conversation_id: int,
    user_message: str,
    assistant_answer: str,
) -> dict | None:
    """分析单轮教师对话，提取教学经验（L2-L5）。

    返回提取结果 dict 或 None（无有价值经验时）。
    """
    from ..config import settings

    if not settings.SILICONFLOW_API_KEY or settings.SILICONFLOW_API_KEY.startswith("sk-your"):
        return None

    config = agent.config
    if isinstance(config, str):
        try:
            config = json.loads(config) if config else {}
        except (ValueError, TypeError):
            config = {}
    if not isinstance(config, dict):
        config = {}

    subject = ""
    course_info = config.get("course_info", {}) if isinstance(config.get("course_info"), dict) else {}
    subject = course_info.get("subject") or config.get("subject") or agent.course_name or ""

    # 获取近期对话历史（最多 6 条），提供上下文
    recent_msgs = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.id.desc())
        .limit(6)
        .all()
    )
    recent_msgs.reverse()
    history_lines = []
    for m in recent_msgs:
        role_label = "教师" if m.role == "user" else "助手"
        history_lines.append(f"{role_label}：{m.content[:300]}")
    history_text = "\n".join(history_lines) if history_lines else f"教师：{user_message[:500]}\n助手：{assistant_answer[:500]}"

    prompt = f"""你是一位教学经验分析专家。请分析以下教师与 AI 教学助手的对话，提取其中蕴含的教学经验。

## 课程信息
- 课程：{agent.course_name}
- 学科：{subject}

## 对话内容
{history_text}

## 提取要求
分析对话中教师展现的教学经验，提取到以下四个层面。仅提取对话中明确体现的经验，不要编造。

输出 JSON 对象，格式如下：
{{
  "diagnosis": {{
    "pain_points": [
      {{
        "surface_error": "学生表现出的错误或困惑",
        "teacher_diagnosis": "教师对问题的判断",
        "root_cause": "问题的根本原因",
        "solution": "教师的解决对策"
      }}
    ]
  }},
  "strategy": {{
    "strategies": [
      {{
        "method": "教学方法的名称或描述",
        "reasoning": "为什么这个方法有效",
        "steps": ["步骤1", "步骤2"],
        "applicable_scenario": "适用场景"
      }}
    ]
  }},
  "interaction": {{
    "question_templates": [
      {{
        "scenario": "使用场景",
        "prompt": "引导提问的话术",
        "goal": "提问目标",
        "steps": ["引导步骤1", "引导步骤2"]
      }}
    ]
  }},
  "feedback": {{
    "feedback_records": [
      {{
        "applied_in": "应用场景",
        "strategy_ref": "关联的策略",
        "student_response": "学生反应",
        "effectiveness": "效果评估",
        "optimization": "优化建议"
      }}
    ]
  }}
}}

## 判断标准
1. 仅当对话中明确体现了教学经验时才提取，避免过度解读
2. 每个层面最多提取 2 条最有价值的经验
3. 如果某层面没有有价值的经验，返回空数组
4. 教师提问、追问、纠正、补充解释等行为都蕴含经验
5. 助手回答中体现的教学思路也可作为策略提取

直接输出 JSON，不要添加任何解释。"""

    result = await _call_llm_json(prompt, max_tokens=2500)
    if not result or not isinstance(result, dict):
        return None

    # 检查是否有实际提取到内容
    has_content = False
    for layer in ("diagnosis", "strategy", "interaction", "feedback"):
        layer_data = result.get(layer, {})
        if isinstance(layer_data, dict):
            for key in ("pain_points", "strategies", "question_templates", "feedback_records"):
                items = layer_data.get(key, [])
                if isinstance(items, list) and len(items) > 0:
                    has_content = True
                    break
    if not has_content:
        return None

    return result


async def extract_experience_from_qa(
    db: Session,
    agent: Agent,
    student_question: str,
    teacher_reply: str,
) -> dict | None:
    """从「学生问题 + 教师解答」问答对中提取教学经验（L2-L5）。

    这是师生问答沉淀的核心入口：学生真实提问暴露痛点 → 教师给出针对性解答 →
    从问答对中提炼诊断（L2）、策略（L3）、交互话术（L4）、效果反馈（L5）。
    """
    from ..config import settings

    if not settings.SILICONFLOW_API_KEY or settings.SILICONFLOW_API_KEY.startswith("sk-your"):
        return None

    config = agent.config
    if isinstance(config, str):
        try:
            config = json.loads(config) if config else {}
        except (ValueError, TypeError):
            config = {}
    if not isinstance(config, dict):
        config = {}

    subject = ""
    course_info = config.get("course_info", {}) if isinstance(config.get("course_info"), dict) else {}
    subject = course_info.get("subject") or config.get("subject") or agent.course_name or ""

    prompt = f"""你是一位教学经验分析专家。以下是真实发生的"学生疑问 + 教师解答"，请从中提炼出可复用的教师教学经验。

## 课程信息
- 课程：{agent.course_name}
- 学科：{subject}

## 学生疑问（真实暴露的痛点）
{student_question[:800]}

## 教师解答（针对性解决方案）
{teacher_reply[:1500]}

## 提取要求
从这段问答中提炼教师的教学经验，输出到四个层面。仅提取问答中明确体现的经验，不要编造。

输出 JSON 对象，格式如下：
{{
  "diagnosis": {{
    "pain_points": [
      {{
        "surface_error": "学生表现出的错误或困惑（来自学生疑问）",
        "teacher_diagnosis": "教师对学生问题的判断",
        "root_cause": "问题的根本原因",
        "solution": "教师的解决对策"
      }}
    ]
  }},
  "strategy": {{
    "strategies": [
      {{
        "method": "教师采用的教学方法（如隔离体法）",
        "reasoning": "为什么这个方法有效",
        "steps": ["第一步", "第二步", "第三步"],
        "applicable_scenario": "适用场景"
      }}
    ]
  }},
  "interaction": {{
    "question_templates": [
      {{
        "scenario": "使用场景",
        "prompt": "教师引导/提醒学生的话术",
        "goal": "提问目标",
        "steps": ["引导步骤1", "引导步骤2"]
      }}
    ]
  }},
  "feedback": {{
    "feedback_records": [
      {{
        "applied_in": "应用场景",
        "strategy_ref": "关联的策略",
        "student_response": "学生反应",
        "effectiveness": "预期效果",
        "optimization": "优化建议"
      }}
    ]
  }}
}}

## 判断标准
1. 仅当问答中明确体现了教学经验时才提取，避免过度解读
2. 每个层面最多提取 2 条最有价值的经验
3. 如果某层面没有有价值的内容，返回空数组
4. 教师的解决方案步骤（steps）是核心资产，务必完整保留
5. 学生疑问中的具体错误/困惑表述应作为 diagnosis.pain_points.surface_error

直接输出 JSON，不要添加任何解释。"""

    result = await _call_llm_json(prompt, max_tokens=2500)
    if not result or not isinstance(result, dict):
        return None

    # 检查是否有实际提取到内容
    has_content = False
    for layer in ("diagnosis", "strategy", "interaction", "feedback"):
        layer_data = result.get(layer, {})
        if isinstance(layer_data, dict):
            for key in ("pain_points", "strategies", "question_templates", "feedback_records"):
                items = layer_data.get(key, [])
                if isinstance(items, list) and len(items) > 0:
                    has_content = True
                    break
    if not has_content:
        return None

    return result


def merge_experience_into_five_layer(
    five_layer: dict,
    experience: dict,
    source: str = "conversation",
) -> dict:
    """将提取的经验增量合并到五层知识结构中。

    - diagnosis → diagnosis_layer.pain_points
    - strategy → strategy_layer.strategies
    - interaction → interaction_layer.question_templates
    - feedback → feedback_layer.feedback_records
    """
    for key in ("knowledge_layer", "diagnosis_layer", "strategy_layer",
                "interaction_layer", "feedback_layer"):
        if key not in five_layer:
            five_layer[key] = {}

    # L2 学生诊断
    diag = experience.get("diagnosis", {})
    if isinstance(diag, dict):
        pain_points = diag.get("pain_points", [])
        if isinstance(pain_points, list):
            dl = five_layer.get("diagnosis_layer", {})
            if not isinstance(dl, dict):
                dl = {}
            existing = dl.get("pain_points", [])
            if not isinstance(existing, list):
                existing = []
            for pp in pain_points:
                if isinstance(pp, dict) and pp.get("surface_error"):
                    pp["_source"] = source
                    existing.append(pp)
            dl["pain_points"] = existing
            five_layer["diagnosis_layer"] = dl

    # L3 教学策略
    strat = experience.get("strategy", {})
    if isinstance(strat, dict):
        strategies = strat.get("strategies", [])
        if isinstance(strategies, list):
            sl = five_layer.get("strategy_layer", {})
            if not isinstance(sl, dict):
                sl = {}
            existing = sl.get("strategies", [])
            if not isinstance(existing, list):
                existing = []
            for s in strategies:
                if isinstance(s, dict) and (s.get("method") or s.get("reasoning")):
                    s["_source"] = source
                    existing.append(s)
            sl["strategies"] = existing
            five_layer["strategy_layer"] = sl

    # L4 课堂交互
    inter = experience.get("interaction", {})
    if isinstance(inter, dict):
        templates = inter.get("question_templates", [])
        if isinstance(templates, list):
            il = five_layer.get("interaction_layer", {})
            if not isinstance(il, dict):
                il = {}
            existing = il.get("question_templates", [])
            if not isinstance(existing, list):
                existing = []
            for t in templates:
                if isinstance(t, dict) and (t.get("prompt") or t.get("scenario")):
                    t["_source"] = source
                    existing.append(t)
            il["question_templates"] = existing
            five_layer["interaction_layer"] = il

    # L5 效果反馈
    fb = experience.get("feedback", {})
    if isinstance(fb, dict):
        records = fb.get("feedback_records", [])
        if isinstance(records, list):
            fl = five_layer.get("feedback_layer", {})
            if not isinstance(fl, dict):
                fl = {}
            existing = fl.get("feedback_records", [])
            if not isinstance(existing, list):
                existing = []
            for r in records:
                if isinstance(r, dict) and (r.get("effectiveness") or r.get("applied_in")):
                    r["_source"] = source
                    existing.append(r)
            fl["feedback_records"] = existing
            five_layer["feedback_layer"] = fl

    return five_layer


def build_five_layer_prompt_section(five_layer: dict, max_items_per_layer: int = 5) -> str:
    """将五层经验知识构建为系统提示词片段，注入到对话中。

    只取每层最新的 max_items_per_layer 条，避免 prompt 过长。
    """
    sections = []

    # L1 知识体系
    kl = five_layer.get("knowledge_layer", {})
    if isinstance(kl, dict):
        topics = kl.get("topics", [])
        if isinstance(topics, list) and len(topics) > 0:
            lines = ["### L1 知识体系（已沉淀）"]
            for t in topics[:max_items_per_layer]:
                if not isinstance(t, dict):
                    continue
                name = t.get("name", "未命名")
                chapter = t.get("chapter", "")
                key_points = t.get("key_points", [])
                difficulties = t.get("difficulties", [])
                line = f"- {name}"
                if chapter:
                    line += f"（{chapter}）"
                if isinstance(key_points, list) and key_points:
                    line += f"：重点 {', '.join(str(k) for k in key_points[:3])}"
                lines.append(line)
                if isinstance(difficulties, list) and difficulties:
                    for d in difficulties[:2]:
                        if isinstance(d, dict):
                            lines.append(f"  难点：{d.get('point', '')} — {d.get('reason', '')}")
            sections.append("\n".join(lines))

    # L2 学生诊断
    dl = five_layer.get("diagnosis_layer", {})
    if isinstance(dl, dict):
        pps = dl.get("pain_points", [])
        if isinstance(pps, list) and len(pps) > 0:
            lines = ["### L2 学生诊断（已沉淀）"]
            for pp in pps[-max_items_per_layer:]:
                if not isinstance(pp, dict):
                    continue
                lines.append(f"- 问题表现：{pp.get('surface_error', '')}")
                if pp.get("teacher_diagnosis"):
                    lines.append(f"  诊断：{pp.get('teacher_diagnosis', '')}")
                if pp.get("solution"):
                    lines.append(f"  对策：{pp.get('solution', '')}")
            sections.append("\n".join(lines))

    # L3 教学策略
    sl = five_layer.get("strategy_layer", {})
    if isinstance(sl, dict):
        strategies = sl.get("strategies", [])
        if isinstance(strategies, list) and len(strategies) > 0:
            lines = ["### L3 教学策略（已沉淀）"]
            for s in strategies[-max_items_per_layer:]:
                if not isinstance(s, dict):
                    continue
                lines.append(f"- 方法：{s.get('method', '')}")
                if s.get("reasoning"):
                    lines.append(f"  理由：{s.get('reasoning', '')}")
                steps = s.get("steps", [])
                if isinstance(steps, list) and steps:
                    lines.append(f"  步骤：{' → '.join(str(st) for st in steps[:4])}")
            sections.append("\n".join(lines))

    # L4 课堂交互
    il = five_layer.get("interaction_layer", {})
    if isinstance(il, dict):
        templates = il.get("question_templates", [])
        if isinstance(templates, list) and len(templates) > 0:
            lines = ["### L4 课堂交互（已沉淀）"]
            for t in templates[-max_items_per_layer:]:
                if not isinstance(t, dict):
                    continue
                lines.append(f"- 场景：{t.get('scenario', '')}")
                if t.get("prompt"):
                    lines.append(f"  话术：{t.get('prompt', '')}")
                if t.get("goal"):
                    lines.append(f"  目标：{t.get('goal', '')}")
            sections.append("\n".join(lines))

    # L5 效果反馈
    fl = five_layer.get("feedback_layer", {})
    if isinstance(fl, dict):
        records = fl.get("feedback_records", [])
        if isinstance(records, list) and len(records) > 0:
            lines = ["### L5 效果反馈（已沉淀）"]
            for r in records[-max_items_per_layer:]:
                if not isinstance(r, dict):
                    continue
                lines.append(f"- 场景：{r.get('applied_in', '')}")
                if r.get("effectiveness"):
                    lines.append(f"  效果：{r.get('effectiveness', '')}")
                if r.get("optimization"):
                    lines.append(f"  优化：{r.get('optimization', '')}")
            sections.append("\n".join(lines))

    if not sections:
        return ""

    return (
        "\n\n## 教师沉淀的教学经验\n"
        "以下是教师在长期教学实践中积累的经验，请在回答时参考运用：\n\n"
        + "\n\n".join(sections)
    )


async def _call_llm_json(prompt: str, max_tokens: int = 2500) -> dict | None:
    """调用 LLM 并解析 JSON 响应。使用 settings 保证 pydantic-settings 加载的 .env 生效。"""
    from openai import AsyncOpenAI
    from ..config import settings

    api_key = settings.SILICONFLOW_API_KEY
    base_url = settings.SILICONFLOW_BASE_URL
    model = settings.CHAT_MODEL

    if not api_key:
        logger.warning("_call_llm_json: SILICONFLOW_API_KEY 未配置")
        return None

    client = AsyncOpenAI(api_key=api_key, base_url=base_url)

    # 第一级：JSON Mode
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
        )
        content = (response.choices[0].message.content or "").strip()
        return json.loads(content)
    except Exception as e:
        logger.warning(f"_call_llm_json JSON Mode 失败: {e}")

    # 第二级：正则提取
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=max_tokens,
        )
        content = (response.choices[0].message.content or "").strip()
        match = re.search(r'\{[\s\S]*\}', content)
        if match:
            return json.loads(match.group())
    except Exception as e:
        logger.warning(f"_call_llm_json 正则降级失败: {e}")

    logger.warning("_call_llm_json 两级解析均失败，返回 None")
    return None
