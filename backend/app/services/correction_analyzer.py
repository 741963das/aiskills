"""v3.0 被动积累 - 机制二：AI 回答纠正 → L2 诊断 + L3 策略双提取。

教师修改或纠正 AI 的回答时，对比原始回答与修改后回答，
分别提取学生诊断（L2）和教学策略（L3），追加到对应层次。
"""
import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


async def analyze_correction(
    original_answer: str,
    corrected_answer: str,
    student_question: str = "",
    subject_label: str = "",
) -> dict:
    """分析纠正记录，返回 L2 诊断 + L3 策略结构。

    返回结构：
    {
      "diagnosis": {"pain_points": [...]},
      "strategy": {"strategies": [...]}
    }
    """
    if not original_answer or not corrected_answer:
        return {"diagnosis": {"pain_points": []}, "strategy": {"strategies": []}}

    meta_prompt = f"""你是一位教学经验分析专家。请分析教师对 AI 回答的纠正记录，提取教学诊断和策略。

## 上下文
- 学科：{subject_label or '通用'}
- 学生问题：{student_question or '（未提供）'}

## AI 原始回答
{original_answer[:1500]}

## 教师纠正后的回答
{corrected_answer[:1500]}

## 输出要求
输出一个 JSON 对象，包含 "diagnosis" 和 "strategy" 两个字段：

{{
  "diagnosis": {{
    "pain_points": [
      {{
        "topic": "相关知识点",
        "surface_error": "AI 原始回答中的表面问题",
        "teacher_diagnosis": "教师判断出的深层问题",
        "root_cause": "根本原因",
        "solution": "教师纠正中采用的解决方法",
        "source": "chat_correction"
      }}
    ]
  }},
  "strategy": {{
    "strategies": [
      {{
        "goal": "教学目标",
        "method": "教师采用的方法",
        "reasoning": "为什么这样纠正（选择理由）",
        "steps": ["步骤1", "步骤2"],
        "suitable_for": ["适用对象"],
        "not_suitable_for": [],
        "source": "chat_correction",
        "usage_count": 1
      }}
    ]
  }}
}}

## 重要说明
1. 基于原始回答与纠正回答的差异分析，不要编造
2. pain_points 1-2 个，strategies 1-2 个
3. source 字段固定为 "chat_correction"
4. 直接输出 JSON，不要添加任何解释性前言或后记"""

    result = await _call_llm_json(meta_prompt, max_tokens=2500)
    if not result or not isinstance(result, dict):
        return {"diagnosis": {"pain_points": []}, "strategy": {"strategies": []}}

    diagnosis = result.get("diagnosis", {})
    strategy = result.get("strategy", {})
    if not isinstance(diagnosis, dict):
        diagnosis = {"pain_points": []}
    if not isinstance(strategy, dict):
        strategy = {"strategies": []}
    diagnosis.setdefault("pain_points", [])
    strategy.setdefault("strategies", [])

    return {"diagnosis": diagnosis, "strategy": strategy}


def merge_correction_results(
    five_layer: dict | None,
    analysis: dict,
) -> dict:
    """将分析结果合并到 five_layer 的 L2 和 L3。"""
    if not five_layer or not isinstance(five_layer, dict):
        five_layer = {}

    # L2 学生诊断层
    diagnosis_layer = five_layer.get("diagnosis_layer") or {}
    if not isinstance(diagnosis_layer, dict):
        diagnosis_layer = {}
    diagnosis_layer.setdefault("pain_points", [])
    diagnosis_layer.setdefault("error_patterns", [])
    for pp in analysis.get("diagnosis", {}).get("pain_points", []):
        if isinstance(pp, dict):
            pp.setdefault("source", "chat_correction")
            diagnosis_layer["pain_points"].append(pp)
    five_layer["diagnosis_layer"] = diagnosis_layer

    # L3 教学策略层
    strategy_layer = five_layer.get("strategy_layer") or {}
    if not isinstance(strategy_layer, dict):
        strategy_layer = {}
    strategy_layer.setdefault("strategies", [])
    for s in analysis.get("strategy", {}).get("strategies", []):
        if isinstance(s, dict):
            s.setdefault("source", "chat_correction")
            s.setdefault("usage_count", 1)
            strategy_layer["strategies"].append(s)
    five_layer["strategy_layer"] = strategy_layer

    return five_layer


async def _call_llm_json(prompt: str, max_tokens: int = 2500) -> dict | None:
    """调用 LLM 并解析 JSON 响应（支持 JSON Mode + 正则降级）。"""
    from openai import AsyncOpenAI
    from ..config import settings

    api_key = settings.SILICONFLOW_API_KEY
    base_url = settings.SILICONFLOW_BASE_URL
    model = settings.CHAT_MODEL

    if not api_key:
        logger.warning("_call_llm_json(correction_analyzer): SILICONFLOW_API_KEY 未配置")
        return None

    client = AsyncOpenAI(api_key=api_key, base_url=base_url)

    # 第一级：JSON Mode
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
            max_tokens=max_tokens,
            response_format={"type": "json_object"},
        )
        content = (response.choices[0].message.content or "").strip()
        return json.loads(content)
    except Exception as e:
        logger.warning(f"LLM JSON Mode 解析失败，降级到正则提取: {e}")
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.5,
            max_tokens=max_tokens,
        )
        content = (response.choices[0].message.content or "").strip()
        match = re.search(r'\{[\s\S]*\}', content)
        if match:
            return json.loads(match.group())
    except Exception as e:
        logger.warning(f"LLM 正则提取失败: {e}")

    return None
