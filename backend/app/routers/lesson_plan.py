"""AI备课助手路由 — 生成、存储、管理备课计划。"""
import json
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
from ..models.lesson_plan import LessonPlan
from ..utils.auth import get_current_user

router = APIRouter(prefix="/lesson-plans", tags=["lesson-plans"])


class GenerateLessonPlanRequest(BaseModel):
    topic: str
    subject: str
    grade: Optional[str] = None
    duration: Optional[str] = "45分钟"
    student_count: Optional[int] = None
    agent_id: Optional[int] = None
    extra_requirements: Optional[str] = None


class LessonPlanItem(BaseModel):
    id: int
    title: str
    subject: str
    grade: Optional[str]
    topic: str
    duration: Optional[str]
    student_count: Optional[int]
    content: dict
    created_at: datetime
    agent_id: Optional[int]

    class Config:
        from_attributes = True


def _build_lesson_plan_prompt(req: GenerateLessonPlanRequest, experience_context: str) -> str:
    grade_info = f"年级/层次：{req.grade}" if req.grade else ""
    student_info = f"班级人数：{req.student_count}人" if req.student_count else ""
    extra = f"\n额外要求：{req.extra_requirements}" if req.extra_requirements else ""

    return f"""你是一位专业教学设计师。请根据以下信息生成一份完整的教学设计方案（备课计划），并以JSON格式输出。

## 课程信息
- 教学主题：{req.topic}
- 学科：{req.subject}
- 课时：{req.duration or '45分钟'}
{grade_info}
{student_info}{extra}

{experience_context}

## 输出要求
请严格按以下JSON结构输出，不要添加任何多余内容：

{{
  "title": "教学设计方案标题",
  "teaching_objectives": {{
    "knowledge": ["知识目标1", "知识目标2"],
    "ability": ["能力目标1", "能力目标2"],
    "emotion": ["情感目标1"]
  }},
  "key_points": ["重点1", "重点2"],
  "difficult_points": ["难点1", "难点2"],
  "teaching_methods": ["教学方法1", "教学方法2"],
  "teaching_flow": [
    {{
      "stage": "导入",
      "duration": "5分钟",
      "teacher_activity": "教师活动描述",
      "student_activity": "学生活动描述",
      "design_intent": "设计意图"
    }},
    {{
      "stage": "新课讲授",
      "duration": "20分钟",
      "teacher_activity": "教师活动描述",
      "student_activity": "学生活动描述",
      "design_intent": "设计意图"
    }},
    {{
      "stage": "练习巩固",
      "duration": "15分钟",
      "teacher_activity": "教师活动描述",
      "student_activity": "学生活动描述",
      "design_intent": "设计意图"
    }},
    {{
      "stage": "总结提升",
      "duration": "5分钟",
      "teacher_activity": "教师活动描述",
      "student_activity": "学生活动描述",
      "design_intent": "设计意图"
    }}
  ],
  "assignments": ["作业1", "作业2"],
  "teaching_tips": ["基于教师经验的教学建议1", "教学建议2"],
  "resources": ["教学资源1", "教学资源2"]
}}"""


@router.post("/generate")
async def generate_lesson_plan(
    req: GenerateLessonPlanRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    experience_context = ""
    if req.agent_id:
        agent = db.query(Agent).filter(
            Agent.id == req.agent_id,
            Agent.user_id == current_user.id,
        ).first()
        if agent and agent.config:
            five_layer = agent.config.get("fiveLayerKnowledge", {})
            knowledge_layer = five_layer.get("knowledge_layer", [])
            strategy_layer = five_layer.get("strategy_layer", [])
            diagnosis_layer = five_layer.get("diagnosis_layer", [])

            parts = []
            if knowledge_layer:
                parts.append("## 教师教学经验（知识层）\n" + "\n".join(
                    f"- {item.get('content', item) if isinstance(item, dict) else item}"
                    for item in knowledge_layer[:5]
                ))
            if strategy_layer:
                parts.append("## 教师教学策略\n" + "\n".join(
                    f"- {item.get('content', item) if isinstance(item, dict) else item}"
                    for item in strategy_layer[:5]
                ))
            if diagnosis_layer:
                parts.append("## 学生常见问题诊断\n" + "\n".join(
                    f"- {item.get('content', item) if isinstance(item, dict) else item}"
                    for item in diagnosis_layer[:5]
                ))
            if parts:
                experience_context = "## 参考该教师积累的教学经验\n" + "\n\n".join(parts)

    prompt = _build_lesson_plan_prompt(req, experience_context)

    client = AsyncOpenAI(
        api_key=settings.SILICONFLOW_API_KEY,
        base_url=settings.SILICONFLOW_BASE_URL,
        timeout=httpx.Timeout(180.0, connect=10.0),
    )

    try:
        response = await client.chat.completions.create(
            model=settings.CHAT_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=4096,
            response_format={"type": "json_object"},
        )
        content = (response.choices[0].message.content or "").strip()
        plan_data = json.loads(content)
    except Exception:
        try:
            response = await client.chat.completions.create(
                model=settings.CHAT_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=4096,
            )
            content = (response.choices[0].message.content or "").strip()
            import re
            match = re.search(r'\{[\s\S]*\}', content)
            if not match:
                raise HTTPException(status_code=502, detail="LLM 未返回有效 JSON")
            plan_data = json.loads(match.group())
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"LLM 调用失败: {str(e)[:200]}")

    title = plan_data.get("title") or f"{req.subject}—{req.topic} 教学设计"
    plan = LessonPlan(
        user_id=current_user.id,
        agent_id=req.agent_id,
        title=title,
        subject=req.subject,
        grade=req.grade,
        topic=req.topic,
        duration=req.duration,
        student_count=req.student_count,
        content=plan_data,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@router.get("/")
def list_lesson_plans(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plans = db.query(LessonPlan).filter(
        LessonPlan.user_id == current_user.id
    ).order_by(LessonPlan.created_at.desc()).all()
    return plans


@router.get("/{plan_id}")
def get_lesson_plan(
    plan_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.query(LessonPlan).filter(
        LessonPlan.id == plan_id,
        LessonPlan.user_id == current_user.id,
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="备课计划不存在")
    return plan


@router.delete("/{plan_id}")
def delete_lesson_plan(
    plan_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.query(LessonPlan).filter(
        LessonPlan.id == plan_id,
        LessonPlan.user_id == current_user.id,
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="备课计划不存在")
    db.delete(plan)
    db.commit()
    return {"message": "已删除"}
