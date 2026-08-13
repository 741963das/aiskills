"""v3.0 被动积累 - 机制一：文件上传 → L1 知识体系提取。

教师上传教案/PPT/讲义/试卷后，从文档文本中提取知识点结构，
增量合并到 Agent.config.fiveLayerKnowledge.knowledge_layer。
"""
import json
import re
from typing import Any

from sqlalchemy.orm import Session


async def extract_knowledge_from_text(
    db: Session,
    agent_id: int,
    filename: str,
    document_text: str,
) -> dict:
    """从文档文本提取知识点，返回 topics 列表（待合并到 L1）。

    使用 LLM（DeepSeek-V3.2）以 JSON Mode 提取：
    知识点名称、章节归属、核心概念、重点难点、典型例题。
    """
    # 截断过长文本，避免超出 token 限制
    text_sample = document_text[:4000] if len(document_text) > 4000 else document_text

    meta_prompt = f"""你是一位学科教学专家。请从以下教学文档内容中提取知识点结构。

## 文档信息
- 文件名：{filename}
- 内容片段：
{text_sample}

## 输出要求
输出一个 JSON 对象，包含 "topics" 数组，每个知识点结构如下：
{{
  "topics": [
    {{
      "name": "知识点名称",
      "chapter": "所属章节",
      "core_concepts": [
        {{"term": "概念术语", "definition": "概念定义"}}
      ],
      "key_points": ["重点1", "重点2"],
      "difficulties": [
        {{"point": "难点描述", "reason": "为什么是难点"}}
      ],
      "typical_examples": [
        {{"question": "例题", "solution": "解答思路"}}
      ],
      "question_types": ["题型1", "题型2"]
    }}
  ]
}}

## 重要说明
1. 仅提取文档中明确出现的知识点，不要编造
2. 每个字段基于文档实际内容填写，无内容则留空数组
3. topics 数组包含 2-8 个知识点
4. 直接输出 JSON，不要添加任何解释性前言或后记"""

    result = await _call_llm_json(meta_prompt, max_tokens=3000)
    if not result or not isinstance(result, dict):
        return {"topics": [], "source_files": [filename]}

    topics = result.get("topics", [])
    if not isinstance(topics, list):
        topics = []

    # 规范化每个知识点字段
    cleaned_topics = []
    for t in topics:
        if not isinstance(t, dict):
            continue
        t.setdefault("name", "未命名知识点")
        t.setdefault("chapter", "")
        t.setdefault("core_concepts", [])
        t.setdefault("key_points", [])
        t.setdefault("difficulties", [])
        t.setdefault("typical_examples", [])
        t.setdefault("question_types", [])
        cleaned_topics.append(t)

    return {"topics": cleaned_topics, "source_files": [filename]}


def merge_knowledge_layer(
    existing: dict | None,
    new_data: dict,
) -> dict:
    """增量合并 L1 知识体系层：按知识点名称合并，追加不覆盖。

    - 已存在的同名知识点：追加 core_concepts/key_points（去重）
    - 新知识点：直接追加
    - source_files：去重追加
    """
    if not existing or not isinstance(existing, dict):
        existing = {"topics": [], "chapter_structure": [], "source_files": []}
    existing.setdefault("topics", [])
    existing.setdefault("chapter_structure", [])
    existing.setdefault("source_files", [])

    existing_topics = {t.get("name", ""): t for t in existing["topics"] if isinstance(t, dict)}

    for new_topic in new_data.get("topics", []):
        name = new_topic.get("name", "")
        if name in existing_topics:
            # 合并：追加去重
            old = existing_topics[name]
            old_concepts = {(c.get("term", "") if isinstance(c, dict) else str(c)) for c in old.get("core_concepts", [])}
            for cc in new_topic.get("core_concepts", []):
                term = cc.get("term", "") if isinstance(cc, dict) else str(cc)
                if term and term not in old_concepts:
                    old.setdefault("core_concepts", []).append(cc)
                    old_concepts.add(term)
            for kp in new_topic.get("key_points", []):
                if kp and kp not in old.get("key_points", []):
                    old.setdefault("key_points", []).append(kp)
            for d in new_topic.get("difficulties", []):
                old.setdefault("difficulties", []).append(d)
            for te in new_topic.get("typical_examples", []):
                old.setdefault("typical_examples", []).append(te)
            for qt in new_topic.get("question_types", []):
                if qt and qt not in old.get("question_types", []):
                    old.setdefault("question_types", []).append(qt)
        else:
            existing["topics"].append(new_topic)
            existing_topics[name] = new_topic

    # source_files 去重追加
    for sf in new_data.get("source_files", []):
        if sf and sf not in existing["source_files"]:
            existing["source_files"].append(sf)

    return existing


async def _call_llm_json(prompt: str, max_tokens: int = 3000) -> dict | None:
    """调用 LLM 并解析 JSON 响应（支持 JSON Mode + 正则降级）。"""
    import logging
    from openai import AsyncOpenAI
    from ..config import settings

    logger = logging.getLogger(__name__)
    api_key = settings.SILICONFLOW_API_KEY
    base_url = settings.SILICONFLOW_BASE_URL
    model = settings.CHAT_MODEL

    if not api_key:
        logger.warning("_call_llm_json(knowledge_extractor): SILICONFLOW_API_KEY 未配置")
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
        logger.warning(f"knowledge_extractor JSON Mode 失败: {e}")

    # 第二级：正则提取
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
        logger.warning(f"knowledge_extractor 正则降级失败: {e}")

    return None
