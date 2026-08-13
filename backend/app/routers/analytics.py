"""学情分析路由 — 为教师提供班级学习数据聚合视图。"""
from typing import Optional
from collections import Counter

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.agent import Agent
from ..models.student import MistakeRecord, LearningRecord, StudentAgent
from ..models.conversation import Conversation
from ..utils.auth import get_current_user

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
def get_analytics_overview(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """教师所有助手的汇总学情数据。"""
    agents = db.query(Agent).filter(Agent.user_id == current_user.id).all()
    agent_ids = [a.id for a in agents]

    if not agent_ids:
        return {
            "total_students": 0,
            "total_conversations": 0,
            "total_mistakes": 0,
            "unmastered_mistakes": 0,
            "agents": [],
        }

    total_students = db.query(func.count(StudentAgent.student_id.distinct())).filter(
        StudentAgent.agent_id.in_(agent_ids),
        StudentAgent.status == "active",
    ).scalar() or 0

    total_conversations = db.query(func.count(Conversation.id)).filter(
        Conversation.agent_id.in_(agent_ids)
    ).scalar() or 0

    total_mistakes = db.query(func.count(MistakeRecord.id)).filter(
        MistakeRecord.agent_id.in_(agent_ids)
    ).scalar() or 0

    unmastered = db.query(func.count(MistakeRecord.id)).filter(
        MistakeRecord.agent_id.in_(agent_ids),
        MistakeRecord.is_mastered == False,
    ).scalar() or 0

    agent_stats = []
    for agent in agents:
        student_count = db.query(func.count(StudentAgent.student_id)).filter(
            StudentAgent.agent_id == agent.id,
            StudentAgent.status == "active",
        ).scalar() or 0
        conv_count = db.query(func.count(Conversation.id)).filter(
            Conversation.agent_id == agent.id
        ).scalar() or 0
        mistake_count = db.query(func.count(MistakeRecord.id)).filter(
            MistakeRecord.agent_id == agent.id
        ).scalar() or 0
        agent_stats.append({
            "agent_id": agent.id,
            "name": agent.name,
            "course_name": agent.course_name,
            "status": agent.status,
            "student_count": student_count,
            "conversation_count": conv_count,
            "mistake_count": mistake_count,
        })

    return {
        "total_students": total_students,
        "total_conversations": total_conversations,
        "total_mistakes": total_mistakes,
        "unmastered_mistakes": unmastered,
        "agents": agent_stats,
    }


@router.get("/class/{agent_id}")
def get_class_analytics(
    agent_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """单个助手的班级详细学情。"""
    agent = db.query(Agent).filter(
        Agent.id == agent_id,
        Agent.user_id == current_user.id,
    ).first()
    if not agent:
        raise HTTPException(status_code=404, detail="助手不存在")

    student_count = db.query(func.count(StudentAgent.student_id)).filter(
        StudentAgent.agent_id == agent_id,
        StudentAgent.status == "active",
    ).scalar() or 0

    conv_count = db.query(func.count(Conversation.id)).filter(
        Conversation.agent_id == agent_id
    ).scalar() or 0

    mistakes = db.query(MistakeRecord).filter(
        MistakeRecord.agent_id == agent_id
    ).all()

    knowledge_counter = Counter(
        m.knowledge_point for m in mistakes if m.knowledge_point
    )
    error_type_counter = Counter(
        m.error_type for m in mistakes if m.error_type
    )

    top_weak_points = [
        {"knowledge_point": kp, "count": cnt}
        for kp, cnt in knowledge_counter.most_common(10)
    ]
    error_type_dist = [
        {"error_type": et, "count": cnt}
        for et, cnt in error_type_counter.most_common()
    ]

    mastered = sum(1 for m in mistakes if m.is_mastered)
    unmastered = len(mistakes) - mastered
    mastery_rate = round(mastered / len(mistakes) * 100, 1) if mistakes else 0

    subject_counter = Counter(m.subject for m in mistakes if m.subject)
    subject_dist = [
        {"subject": s, "count": cnt}
        for s, cnt in subject_counter.most_common()
    ]

    return {
        "agent_id": agent_id,
        "agent_name": agent.name,
        "course_name": agent.course_name,
        "student_count": student_count,
        "conversation_count": conv_count,
        "mistake_summary": {
            "total": len(mistakes),
            "mastered": mastered,
            "unmastered": unmastered,
            "mastery_rate": mastery_rate,
        },
        "top_weak_points": top_weak_points,
        "error_type_distribution": error_type_dist,
        "subject_distribution": subject_dist,
    }


@router.get("/knowledge-map")
def get_knowledge_map(
    agent_id: Optional[int] = Query(None),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """知识点薄弱地图，可指定助手或汇总全部。"""
    agent_ids_filter = []
    if agent_id:
        agent = db.query(Agent).filter(
            Agent.id == agent_id,
            Agent.user_id == current_user.id,
        ).first()
        if not agent:
            raise HTTPException(status_code=404, detail="助手不存在")
        agent_ids_filter = [agent_id]
    else:
        agents = db.query(Agent).filter(Agent.user_id == current_user.id).all()
        agent_ids_filter = [a.id for a in agents]

    if not agent_ids_filter:
        return {"nodes": []}

    mistakes = db.query(MistakeRecord).filter(
        MistakeRecord.agent_id.in_(agent_ids_filter),
        MistakeRecord.knowledge_point.isnot(None),
    ).all()

    kp_data: dict[str, dict] = {}
    for m in mistakes:
        kp = m.knowledge_point
        if kp not in kp_data:
            kp_data[kp] = {"knowledge_point": kp, "total": 0, "unmastered": 0, "subjects": set()}
        kp_data[kp]["total"] += 1
        if not m.is_mastered:
            kp_data[kp]["unmastered"] += 1
        if m.subject:
            kp_data[kp]["subjects"].add(m.subject)

    nodes = []
    for kp, data in sorted(kp_data.items(), key=lambda x: -x[1]["unmastered"]):
        nodes.append({
            "knowledge_point": kp,
            "total_mistakes": data["total"],
            "unmastered": data["unmastered"],
            "mastery_rate": round((data["total"] - data["unmastered"]) / data["total"] * 100, 1),
            "subjects": list(data["subjects"]),
            "severity": "high" if data["unmastered"] >= 5 else "medium" if data["unmastered"] >= 2 else "low",
        })

    return {"nodes": nodes}
