"""学生端 API 路由。

所有端点均通过 require_role("student") 做权限控制，
仅允许 role == "student" 的用户访问。
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from ..database import get_db
from ..utils.auth import require_role
from ..models.user import User
from ..models.agent import Agent
from ..models.conversation import Conversation
from ..models.student import (
    StudentAgent,
    LearningRecord,
    MistakeRecord,
    StudentProfile,
    QuestionRecord,
)

router = APIRouter(prefix="/student", tags=["student"])


# ---------------------------------------------------------------------------
# 内联 Pydantic 请求 / 响应模型
# ---------------------------------------------------------------------------

class CourseItem(BaseModel):
    agent_id: int
    name: str
    course_name: str
    template: str
    subject: Optional[str] = None
    description: Optional[str] = None
    status: str = "active"
    joined_at: Optional[datetime] = None
    last_accessed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CourseListResponse(BaseModel):
    items: list[CourseItem]
    total: int


class JoinCourseResponse(BaseModel):
    message: str
    agent_id: int


class MistakeItem(BaseModel):
    id: int
    agent_id: int
    conversation_id: Optional[int] = None
    subject: Optional[str] = None
    knowledge_point: Optional[str] = None
    question: Optional[str] = None
    student_answer: Optional[str] = None
    correct_answer: Optional[str] = None
    explanation: Optional[str] = None
    error_type: Optional[str] = None
    difficulty: Optional[str] = None
    is_mastered: bool
    review_count: int
    last_reviewed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MistakeListResponse(BaseModel):
    items: list[MistakeItem]
    total: int
    page: int
    page_size: int


class MistakeStatsResponse(BaseModel):
    total: int
    mastered: int
    unmastered: int
    by_subject: list[dict]
    by_error_type: list[dict]
    by_knowledge_point: list[dict]


class DashboardResponse(BaseModel):
    learning_days: int
    conversation_count: int
    course_count: int
    mistake_count: int


class ProfileUpdate(BaseModel):
    grade: Optional[str] = None
    major: Optional[str] = None
    subjects_of_interest: Optional[str] = None
    learning_goal: Optional[str] = None
    preferred_time: Optional[str] = None


class ProfileResponse(BaseModel):
    student_id: int
    grade: Optional[str] = None
    major: Optional[str] = None
    subjects_of_interest: Optional[str] = None
    learning_goal: Optional[str] = None
    preferred_time: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class RecommendationItem(BaseModel):
    agent_id: int
    name: str
    course_name: str
    template: str
    subject: Optional[str] = None
    description: Optional[str] = None
    author_name: Optional[str] = None

    class Config:
        from_attributes = True


class ReportResponse(BaseModel):
    total_learning_seconds: int
    duration_trend: list[dict]
    mastery_rate: float
    weak_points: list[dict]
    mistake_total: int
    mistake_mastered: int


# ---------------------------------------------------------------------------
# 工具函数
# ---------------------------------------------------------------------------

def _agent_subject(agent: Agent) -> Optional[str]:
    """从 agent.config 提取学科信息。"""
    config = agent.config
    if isinstance(config, str):
        try:
            import json
            config = json.loads(config) if config else {}
        except (ValueError, TypeError):
            config = {}
    if not isinstance(config, dict):
        return None
    course_info = config.get("course_info", {}) if isinstance(config.get("course_info"), dict) else {}
    return course_info.get("subject") or config.get("subject")


def _agent_description(agent: Agent) -> Optional[str]:
    """从 agent.config 提取描述信息。"""
    config = agent.config
    if isinstance(config, str):
        try:
            import json
            config = json.loads(config) if config else {}
        except (ValueError, TypeError):
            config = {}
    if not isinstance(config, dict):
        return None
    return config.get("description")


def _calc_continuous_days(dates: list[datetime]) -> int:
    """根据学习日期列表计算连续学习天数（从最近一天向前回溯）。"""
    if not dates:
        return 0
    # 提取日期部分并去重排序
    date_set = {d.date() for d in dates if d is not None}
    if not date_set:
        return 0
    today = datetime.now(timezone.utc).date()
    # 如果今天没有学习记录，则从昨天开始回溯（允许当天尚未学习）
    if today not in date_set:
        today = today - timedelta(days=1)
    streak = 0
    cursor = today
    while cursor in date_set:
        streak += 1
        cursor = cursor - timedelta(days=1)
    return streak


# ---------------------------------------------------------------------------
# 1. 学习工作台统计
# ---------------------------------------------------------------------------

@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    """学习工作台统计：学习天数、对话次数、课程数、错题数。"""
    student_id = current_user.id

    # 课程数：已加入的 StudentAgent 记录数（仅 active）
    course_count = (
        db.query(func.count(StudentAgent.id))
        .filter(
            StudentAgent.student_id == student_id,
            StudentAgent.status == "active",
        )
        .scalar() or 0
    )

    # 对话次数：学生发起的对话数（关联到已加入的 agent）
    joined_agent_ids = (
        db.query(StudentAgent.agent_id)
        .filter(
            StudentAgent.student_id == student_id,
            StudentAgent.status == "active",
        )
        .all()
    )
    joined_agent_id_list = [row[0] for row in joined_agent_ids]
    if joined_agent_id_list:
        conversation_count = (
            db.query(func.count(Conversation.id))
            .filter(
                Conversation.user_id == student_id,
                Conversation.agent_id.in_(joined_agent_id_list),
            )
            .scalar() or 0
        )
    else:
        conversation_count = 0

    # 错题数
    mistake_count = (
        db.query(func.count(MistakeRecord.id))
        .filter(MistakeRecord.student_id == student_id)
        .scalar() or 0
    )

    # 连续学习天数：基于 learning_records.created_at
    learning_dates = (
        db.query(LearningRecord.created_at)
        .filter(LearningRecord.student_id == student_id)
        .all()
    )
    # 如果没有学习记录，则用对话时间作为补充
    if not learning_dates:
        conv_dates = (
            db.query(Conversation.created_at)
            .filter(Conversation.user_id == student_id)
            .all()
        )
        learning_dates = conv_dates
    learning_days = _calc_continuous_days([row[0] for row in learning_dates if row[0]])

    return DashboardResponse(
        learning_days=learning_days,
        conversation_count=conversation_count,
        course_count=course_count,
        mistake_count=mistake_count,
    )


# ---------------------------------------------------------------------------
# 2. 已加入课程列表
# ---------------------------------------------------------------------------

@router.get("/courses", response_model=CourseListResponse)
def list_courses(
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    """已加入课程列表（仅 active 状态，含 agent 信息 + 最近学习时间）。"""
    student_id = current_user.id

    rows = (
        db.query(StudentAgent, Agent)
        .join(Agent, Agent.id == StudentAgent.agent_id)
        .filter(
            StudentAgent.student_id == student_id,
            StudentAgent.status == "active",
        )
        .order_by(StudentAgent.last_accessed_at.desc().nullslast())
        .all()
    )

    items: list[CourseItem] = []
    for sa, agent in rows:
        items.append(
            CourseItem(
                agent_id=agent.id,
                name=agent.name,
                course_name=agent.course_name,
                template=agent.template,
                subject=_agent_subject(agent),
                description=_agent_description(agent),
                status=sa.status or "active",
                joined_at=sa.joined_at,
                last_accessed_at=sa.last_accessed_at,
            )
        )
    return CourseListResponse(items=items, total=len(items))


# ---------------------------------------------------------------------------
# 3. 加入课程
# ---------------------------------------------------------------------------

@router.post("/courses/{agent_id}/join", response_model=JoinCourseResponse)
def join_course(
    agent_id: int,
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    """加入课程：如果已有草稿则激活，否则新建 active 记录（防止重复）。"""
    # 校验 agent 存在且已发布
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="课程不存在")
    if agent.status != "published":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该课程未发布，无法加入")

    # 查找已有记录（可能是 draft 或 active）
    existing = (
        db.query(StudentAgent)
        .filter(
            StudentAgent.student_id == current_user.id,
            StudentAgent.agent_id == agent_id,
        )
        .first()
    )
    if existing:
        if existing.status == "active":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="已加入该课程")
        # 从草稿激活
        existing.status = "active"
        existing.last_accessed_at = datetime.now(timezone.utc)
        db.commit()
        return JoinCourseResponse(message="已从草稿加入课程", agent_id=agent_id)

    sa = StudentAgent(
        student_id=current_user.id,
        agent_id=agent_id,
        status="active",
        last_accessed_at=datetime.now(timezone.utc),
    )
    db.add(sa)
    db.commit()
    return JoinCourseResponse(message="加入成功", agent_id=agent_id)


# ---------------------------------------------------------------------------
# 4. 退出课程
# ---------------------------------------------------------------------------

@router.delete("/courses/{agent_id}/leave")
def leave_course(
    agent_id: int,
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    """退出课程。"""
    sa = (
        db.query(StudentAgent)
        .filter(
            StudentAgent.student_id == current_user.id,
            StudentAgent.agent_id == agent_id,
        )
        .first()
    )
    if sa is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="未加入该课程")
    db.delete(sa)
    db.commit()
    return {"message": "已退出课程", "agent_id": agent_id}


# ---------------------------------------------------------------------------
# 5. 草稿管理
# ---------------------------------------------------------------------------

class DraftItem(BaseModel):
    agent_id: int
    name: str
    course_name: str
    template: str
    subject: Optional[str] = None
    description: Optional[str] = None
    saved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DraftListResponse(BaseModel):
    items: list[DraftItem]
    total: int


@router.get("/drafts", response_model=DraftListResponse)
def list_drafts(
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    """草稿列表：status=draft 的课程。"""
    student_id = current_user.id

    rows = (
        db.query(StudentAgent, Agent)
        .join(Agent, Agent.id == StudentAgent.agent_id)
        .filter(
            StudentAgent.student_id == student_id,
            StudentAgent.status == "draft",
        )
        .order_by(StudentAgent.joined_at.desc())
        .all()
    )

    items: list[DraftItem] = []
    for sa, agent in rows:
        items.append(
            DraftItem(
                agent_id=agent.id,
                name=agent.name,
                course_name=agent.course_name,
                template=agent.template,
                subject=_agent_subject(agent),
                description=_agent_description(agent),
                saved_at=sa.joined_at,
            )
        )
    return DraftListResponse(items=items, total=len(items))


@router.post("/courses/{agent_id}/draft", response_model=JoinCourseResponse)
def save_draft(
    agent_id: int,
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    """保存课程为草稿（不校验 agent 是否发布）。"""
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="课程不存在")

    existing = (
        db.query(StudentAgent)
        .filter(
            StudentAgent.student_id == current_user.id,
            StudentAgent.agent_id == agent_id,
        )
        .first()
    )
    if existing:
        if existing.status == "active":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="已加入该课程，无需保存草稿")
        # 已经是草稿，返回成功
        return JoinCourseResponse(message="已保存为草稿", agent_id=agent_id)

    sa = StudentAgent(
        student_id=current_user.id,
        agent_id=agent_id,
        status="draft",
    )
    db.add(sa)
    db.commit()
    return JoinCourseResponse(message="已保存为草稿", agent_id=agent_id)


@router.put("/courses/{agent_id}/activate", response_model=JoinCourseResponse)
def activate_draft(
    agent_id: int,
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    """将草稿激活为正式课程。"""
    existing = (
        db.query(StudentAgent)
        .filter(
            StudentAgent.student_id == current_user.id,
            StudentAgent.agent_id == agent_id,
        )
        .first()
    )
    if existing is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="未找到该草稿")
    if existing.status == "active":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="该课程已加入")

    existing.status = "active"
    existing.last_accessed_at = datetime.now(timezone.utc)
    db.commit()
    return JoinCourseResponse(message="已加入课程", agent_id=agent_id)


@router.delete("/drafts/{agent_id}")
def remove_draft(
    agent_id: int,
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    """删除草稿。"""
    sa = (
        db.query(StudentAgent)
        .filter(
            StudentAgent.student_id == current_user.id,
            StudentAgent.agent_id == agent_id,
            StudentAgent.status == "draft",
        )
        .first()
    )
    if sa is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="未找到该草稿")
    db.delete(sa)
    db.commit()
    return {"message": "草稿已删除", "agent_id": agent_id}


# ---------------------------------------------------------------------------
# 6. 错题列表（支持筛选 + 分页）
# ---------------------------------------------------------------------------

@router.get("/mistakes", response_model=MistakeListResponse)
def list_mistakes(
    subject: Optional[str] = Query(None, description="按学科筛选"),
    is_mastered: Optional[bool] = Query(None, description="按是否已掌握筛选"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    """错题列表，支持 subject / is_mastered / page / page_size 筛选。"""
    query = db.query(MistakeRecord).filter(MistakeRecord.student_id == current_user.id)
    if subject:
        query = query.filter(MistakeRecord.subject == subject)
    if is_mastered is not None:
        query = query.filter(MistakeRecord.is_mastered == is_mastered)

    total = query.count()
    rows = (
        query.order_by(MistakeRecord.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    items = [MistakeItem.model_validate(r) for r in rows]
    return MistakeListResponse(items=items, total=total, page=page, page_size=page_size)


# ---------------------------------------------------------------------------
# 7. 错题统计
# 注意：/mistakes/stats 必须在 /mistakes/{id}/mastered 之前注册，
# 避免被路径参数捕获。
# ---------------------------------------------------------------------------

@router.get("/mistakes/stats", response_model=MistakeStatsResponse)
def mistake_stats(
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    """错题统计：按学科、知识点、错误类型分组。"""
    base_query = db.query(MistakeRecord).filter(MistakeRecord.student_id == current_user.id)

    total = base_query.count() or 0
    mastered = base_query.filter(MistakeRecord.is_mastered.is_(True)).count() or 0
    unmastered = total - mastered

    # 按学科分组
    subject_rows = (
        db.query(MistakeRecord.subject, func.count(MistakeRecord.id))
        .filter(MistakeRecord.student_id == current_user.id)
        .group_by(MistakeRecord.subject)
        .all()
    )
    by_subject = [
        {"subject": s or "未分类", "count": cnt}
        for s, cnt in subject_rows
    ]

    # 按错误类型分组
    error_type_rows = (
        db.query(MistakeRecord.error_type, func.count(MistakeRecord.id))
        .filter(MistakeRecord.student_id == current_user.id)
        .group_by(MistakeRecord.error_type)
        .all()
    )
    by_error_type = [
        {"error_type": et or "未分类", "count": cnt}
        for et, cnt in error_type_rows
    ]

    # 按知识点分组
    kp_rows = (
        db.query(MistakeRecord.knowledge_point, func.count(MistakeRecord.id))
        .filter(MistakeRecord.student_id == current_user.id)
        .group_by(MistakeRecord.knowledge_point)
        .all()
    )
    by_knowledge_point = [
        {"knowledge_point": kp or "未分类", "count": cnt}
        for kp, cnt in kp_rows
    ]

    return MistakeStatsResponse(
        total=total,
        mastered=mastered,
        unmastered=unmastered,
        by_subject=by_subject,
        by_error_type=by_error_type,
        by_knowledge_point=by_knowledge_point,
    )


# ---------------------------------------------------------------------------
# 8. 标记错题已掌握
# ---------------------------------------------------------------------------

@router.put("/mistakes/{mistake_id}/mastered", response_model=MistakeItem)
def mark_mistake_mastered(
    mistake_id: int,
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    """标记错题已掌握：is_mastered=True, review_count+1, last_reviewed_at=now。"""
    mistake = (
        db.query(MistakeRecord)
        .filter(
            MistakeRecord.id == mistake_id,
            MistakeRecord.student_id == current_user.id,
        )
        .first()
    )
    if mistake is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="错题不存在")

    mistake.is_mastered = True
    mistake.review_count = (mistake.review_count or 0) + 1
    mistake.last_reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(mistake)
    return MistakeItem.model_validate(mistake)


# ---------------------------------------------------------------------------
# 9. 学习报告
# ---------------------------------------------------------------------------

@router.get("/report", response_model=ReportResponse)
def get_report(
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    """学习报告：时长趋势、知识掌握度、薄弱点。"""
    student_id = current_user.id

    # 总学习时长
    total_seconds = (
        db.query(func.coalesce(func.sum(LearningRecord.duration_seconds), 0))
        .filter(LearningRecord.student_id == student_id)
        .scalar() or 0
    )

    # 近 7 天学习时长趋势
    today = datetime.now(timezone.utc).date()
    duration_trend: list[dict] = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_start = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)
        seconds = (
            db.query(func.coalesce(func.sum(LearningRecord.duration_seconds), 0))
            .filter(
                LearningRecord.student_id == student_id,
                LearningRecord.created_at >= day_start,
                LearningRecord.created_at < day_end,
            )
            .scalar() or 0
        )
        duration_trend.append({"date": day.isoformat(), "duration_seconds": int(seconds)})

    # 错题掌握度
    mistake_total = (
        db.query(func.count(MistakeRecord.id))
        .filter(MistakeRecord.student_id == student_id)
        .scalar() or 0
    )
    mistake_mastered = (
        db.query(func.count(MistakeRecord.id))
        .filter(
            MistakeRecord.student_id == student_id,
            MistakeRecord.is_mastered.is_(True),
        )
        .scalar() or 0
    )
    mastery_rate = round(mistake_mastered / mistake_total, 4) if mistake_total > 0 else 0.0

    # 薄弱点：未掌握错题按知识点/学科分组，取前 5
    weak_rows = (
        db.query(
            MistakeRecord.subject,
            MistakeRecord.knowledge_point,
            func.count(MistakeRecord.id).label("cnt"),
        )
        .filter(
            MistakeRecord.student_id == student_id,
            MistakeRecord.is_mastered.is_(False),
        )
        .group_by(MistakeRecord.subject, MistakeRecord.knowledge_point)
        .order_by(func.count(MistakeRecord.id).desc())
        .limit(5)
        .all()
    )
    weak_points = [
        {
            "subject": s or "未分类",
            "knowledge_point": kp or "未分类",
            "count": cnt,
        }
        for s, kp, cnt in weak_rows
    ]

    return ReportResponse(
        total_learning_seconds=int(total_seconds),
        duration_trend=duration_trend,
        mastery_rate=mastery_rate,
        weak_points=weak_points,
        mistake_total=mistake_total,
        mistake_mastered=mistake_mastered,
    )


# ---------------------------------------------------------------------------
# 10. 学生档案 - 查询
# ---------------------------------------------------------------------------

@router.get("/profile", response_model=ProfileResponse)
def get_profile(
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    """学生档案：不存在则返回默认空值结构。"""
    profile = (
        db.query(StudentProfile)
        .filter(StudentProfile.student_id == current_user.id)
        .first()
    )
    if profile is None:
        return ProfileResponse(student_id=current_user.id)
    return ProfileResponse(
        student_id=profile.student_id,
        grade=profile.grade,
        major=profile.major,
        subjects_of_interest=profile.subjects_of_interest,
        learning_goal=profile.learning_goal,
        preferred_time=profile.preferred_time,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


# ---------------------------------------------------------------------------
# 11. 学生档案 - 更新
# ---------------------------------------------------------------------------

@router.put("/profile", response_model=ProfileResponse)
def update_profile(
    updates: ProfileUpdate,
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    """更新学生档案（不存在则创建）。"""
    profile = (
        db.query(StudentProfile)
        .filter(StudentProfile.student_id == current_user.id)
        .first()
    )
    if profile is None:
        profile = StudentProfile(student_id=current_user.id)
        db.add(profile)

    # 仅更新非 None 字段
    if updates.grade is not None:
        profile.grade = updates.grade
    if updates.major is not None:
        profile.major = updates.major
    if updates.subjects_of_interest is not None:
        profile.subjects_of_interest = updates.subjects_of_interest
    if updates.learning_goal is not None:
        profile.learning_goal = updates.learning_goal
    if updates.preferred_time is not None:
        profile.preferred_time = updates.preferred_time

    db.commit()
    db.refresh(profile)
    return ProfileResponse(
        student_id=profile.student_id,
        grade=profile.grade,
        major=profile.major,
        subjects_of_interest=profile.subjects_of_interest,
        learning_goal=profile.learning_goal,
        preferred_time=profile.preferred_time,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


# ---------------------------------------------------------------------------
# 12. 推荐课程
# ---------------------------------------------------------------------------

@router.get("/recommendations", response_model=list[RecommendationItem])
def get_recommendations(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    """推荐课程：查询已发布的 Agent，排除已加入（含草稿）的。"""
    # 已加入的 agent_id 列表（包括 active 和 draft）
    joined_rows = (
        db.query(StudentAgent.agent_id)
        .filter(StudentAgent.student_id == current_user.id)
        .all()
    )
    joined_ids = [row[0] for row in joined_rows]

    query = (
        db.query(Agent, User)
        .join(User, User.id == Agent.user_id)
        .filter(Agent.status == "published")
    )
    if joined_ids:
        query = query.filter(~Agent.id.in_(joined_ids))

    rows = query.order_by(Agent.created_at.desc()).limit(limit).all()

    items: list[RecommendationItem] = []
    for agent, author in rows:
        items.append(
            RecommendationItem(
                agent_id=agent.id,
                name=agent.name,
                course_name=agent.course_name,
                template=agent.template,
                subject=_agent_subject(agent),
                description=_agent_description(agent),
                author_name=author.display_name or author.username,
            )
        )
    return items


# ---------------------------------------------------------------------------
# 13. 学生疑问记录（待答疑池状态）
# ---------------------------------------------------------------------------

@router.get("/questions")
def list_my_questions(
    agent_id: int = Query(..., description="助手ID"),
    status: Optional[str] = Query(None, description="open / answered"),
    current_user: User = Depends(require_role("student")),
    db: Session = Depends(get_db),
):
    """学生端：查看自己在某个助手下的疑问记录及状态。"""
    query = db.query(QuestionRecord).filter(
        QuestionRecord.student_id == current_user.id,
        QuestionRecord.agent_id == agent_id,
    )
    if status:
        query = query.filter(QuestionRecord.status == status)
    records = query.order_by(QuestionRecord.created_at.desc()).all()
    items = []
    for r in records:
        items.append({
            "id": r.id,
            "question": r.question,
            "pain_point": r.pain_point,
            "status": r.status,
            "teacher_reply": r.teacher_reply,
            "answered_at": r.answered_at.isoformat() if r.answered_at else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    return {"items": items, "total": len(items)}
