"""教学反思智能生成路由。"""
import json
import re
from typing import Optional
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException
from openai import AsyncOpenAI
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models.agent import Agent
from ..models.reflection import TeachingReflection
from ..utils.auth import get_current_user

router = APIRouter(prefix="/reflections", tags=["reflections"])


class GenerateReflectionRequest(BaseModel):
    input_text: str
    agent_id: Optional[int] = None
    lesson_topic: Optional[str] = None


def _build_reflection_prompt(input_text: str, lesson_topic: str, experience_context: str) -> str:
    topic_info = f"本节课主题：{lesson_topic}" if lesson_topic else ""
    return f"""你是一位教学督导专家，帮助教师进行深度教学反思。请根据教师的课后感受，结合其历史教学经验，生成一份结构化的教学反思报告，以JSON格式输出。

## 教师课后感受
{input_text}

{topic_info}

{experience_context}

## 输出JSON结构（严格按此输出）
{{
  "overall_assessment": "本节课整体评价（2-3句话）",
  "strengths": [
    {{"point": "优点1", "detail": "具体说明"}}
  ],
  "problems": [
    {{"point": "问题1", "detail": "具体表现", "root_cause": "根本原因"}}
  ],
  "improvement_suggestions": [
    {{"action": "改进建议1", "expected_outcome": "预期效果"}}
  ],
  "student_insights": "对学生学情的判断（基于本节课表现）",
  "next_lesson_focus": ["下节课重点关注事项1", "事项2"],
  "growth_summary": "教师专业成长小结（鼓励性语言）"
}}"""


@router.post("/generate")
async def generate_reflection(
    req: GenerateReflectionRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not req.input_text.strip():
        raise HTTPException(status_code=400, detail="请输入课后感受")

    experience_context = ""
    if req.agent_id:
        agent = db.query(Agent).filter(
            Agent.id == req.agent_id,
            Agent.user_id == current_user.id,
        ).first()
        if agent and agent.config:
            five_layer = agent.config.get("fiveLayerKnowledge", {})
            feedback_layer = five_layer.get("feedback_layer", [])
            strategy_layer = five_layer.get("strategy_layer", [])
            parts = []
            if strategy_layer:
                parts.append("## 教师常用教学策略\n" + "\n".join(
                    f"- {item.get('content', item) if isinstance(item, dict) else item}"
                    for item in strategy_layer[:4]
                ))
            if feedback_layer:
                parts.append("## 历史教学反馈\n" + "\n".join(
                    f"- {item.get('content', item) if isinstance(item, dict) else item}"
                    for item in feedback_layer[:4]
                ))
            if parts:
                experience_context = "## 教师历史教学经验参考\n" + "\n\n".join(parts)

    prompt = _build_reflection_prompt(
        req.input_text,
        req.lesson_topic or "",
        experience_context,
    )

    client = AsyncOpenAI(
        api_key=settings.SILICONFLOW_API_KEY,
        base_url=settings.SILICONFLOW_BASE_URL,
        timeout=httpx.Timeout(120.0, connect=10.0),
    )

    report_data = {}
    try:
        response = await client.chat.completions.create(
            model=settings.CHAT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.6,
            max_tokens=2048,
            response_format={"type": "json_object"},
        )
        report_data = json.loads(response.choices[0].message.content or "{}")
    except Exception:
        try:
            response = await client.chat.completions.create(
                model=settings.CHAT_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.6,
                max_tokens=2048,
            )
            content = (response.choices[0].message.content or "").strip()
            match = re.search(r'\{[\s\S]*\}', content)
            if match:
                report_data = json.loads(match.group())
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"LLM 调用失败: {str(e)[:200]}")

    record = TeachingReflection(
        user_id=current_user.id,
        agent_id=req.agent_id,
        input_text=req.input_text,
        report=report_data,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/")
def list_reflections(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    records = db.query(TeachingReflection).filter(
        TeachingReflection.user_id == current_user.id
    ).order_by(TeachingReflection.created_at.desc()).all()
    return records


@router.get("/{record_id}")
def get_reflection(
    record_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.query(TeachingReflection).filter(
        TeachingReflection.id == record_id,
        TeachingReflection.user_id == current_user.id,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="反思记录不存在")
    return record


@router.delete("/{record_id}")
def delete_reflection(
    record_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.query(TeachingReflection).filter(
        TeachingReflection.id == record_id,
        TeachingReflection.user_id == current_user.id,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="反思记录不存在")
    db.delete(record)
    db.commit()
    return {"message": "已删除"}
