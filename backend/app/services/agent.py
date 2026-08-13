import json
import logging
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from ..models.agent import Agent
from ..models.user import User
from ..models.conversation import Conversation
from ..models.knowledge import KnowledgeFile
from ..schemas.agent import AgentCreate, AgentUpdate, AgentMarketplaceItem
from .builtins import SYSTEM_USERNAME, BUILTIN_MARKER_KEY

logger = logging.getLogger(__name__)

# 指纹 → 平台助手分类标签
_BUILTIN_CATEGORY_MAP: dict[str, str] = {
    "builtin_generic_math_ta": "学科助教",
    "builtin_english_college": "学科助教",
    "builtin_physics_mechanics": "学科助教",
    "builtin_ideological_political": "学科助教",
    "builtin_python_programming": "职业技能",
    "builtin_voc_mechatronics": "职业技能",
    "builtin_teacher_lesson_planner": "教师备课",
    "builtin_teacher_exam_maker": "教师备课",
}


def _parse_agent_config(raw) -> dict:
    """安全解析 agent.config，兼容双重 JSON 编码的脏数据（str 内再嵌套 JSON 字符串）。

    返回 dict；无法解析时返回 {}。
    """
    config = raw
    for _ in range(3):
        if isinstance(config, dict):
            return config
        if isinstance(config, str):
            try:
                config = json.loads(config)
            except Exception as e:
                logger.warning(f"agent config 解析失败，返回空配置: {e}")
                return {}
        else:
            return {}
    return config if isinstance(config, dict) else {}


def get_agents_by_user(db: Session, user_id: int, status: str | None = None) -> list[Agent]:
    query = db.query(Agent).filter(Agent.user_id == user_id)
    if status:
        query = query.filter(Agent.status == status)
    return query.order_by(Agent.updated_at.desc()).all()


def get_agent_by_id(db: Session, agent_id: int, user_id: int) -> Agent | None:
    return db.query(Agent).filter(Agent.id == agent_id, Agent.user_id == user_id).first()


def get_marketplace_agents(
    db: Session,
    keyword: str | None = None,
    template: str | None = None,
    subject: str | None = None,
    sort: str = "newest",
    scope: str | None = None,
    page: int = 1,
    page_size: int = 12,
) -> tuple[list[AgentMarketplaceItem], int]:
    """获取市场已发布 Agents 列表（带作者信息和使用量）。"""
    from sqlalchemy import func

    query = (
        db.query(
            Agent,
            User,
            func.count(Conversation.id).label("usage_count"),
        )
        .join(User, User.id == Agent.user_id)
        .outerjoin(Conversation, and_(Conversation.agent_id == Agent.id, Conversation.user_id == Agent.user_id))
        .filter(Agent.status == "published")
        .group_by(Agent.id, User.id)
    )

    if keyword:
        like = f"%{keyword}%"
        query = query.filter(
            or_(
                Agent.name.ilike(like),
                Agent.course_name.ilike(like),
            )
        )

    if template:
        query = query.filter(Agent.template == template)

    # 排序：newest（默认）、popular（按使用量）、name（按名称）
    if sort == "popular":
        query = query.order_by(func.count(Conversation.id).desc(), Agent.updated_at.desc().nullslast())
    elif sort == "name":
        query = query.order_by(Agent.name.asc())
    else:
        query = query.order_by(Agent.updated_at.desc().nullslast(), Agent.created_at.desc())

    rows = query.all()

    # 先构造未排序的 items，应用学科/发布范围过滤
    raw_items: list[tuple[AgentMarketplaceItem, int, User]] = []
    for agent, user, usage_count in rows:
        config = _parse_agent_config(agent.config)
        course_info = config.get("course_info", {}) if isinstance(config, dict) else {}

        item_subject = course_info.get("subject") or config.get("subject")
        if subject and (item_subject or "") != subject:
            continue

        # 按发布范围过滤：学生端只看面向学生的助手，教师端只看面向教师的助手
        # 内置助手对所有人可见，不受 scope 过滤
        item_scope = config.get("publishScope") or "students"
        is_builtin = (
            user.username == SYSTEM_USERNAME
            or (isinstance(config, dict) and bool(config.get(BUILTIN_MARKER_KEY)))
        )
        if not is_builtin:
            if scope == "students" and item_scope == "teachers":
                continue
            if scope == "teachers" and item_scope != "teachers":
                continue
        fingerprint = config.get("fingerprint") if isinstance(config, dict) else None
        builtin_category = _BUILTIN_CATEGORY_MAP.get(fingerprint) if is_builtin else None

        item = AgentMarketplaceItem(
            id=agent.id,
            name=agent.name,
            course_name=agent.course_name,
            template=agent.template,
            description=config.get("description"),
            subject=item_subject,
            department=course_info.get("department") or user.department,
            grade_level=course_info.get("grade_level"),
            core_chapters=config.get("core_chapters", []) or [],
            teaching_tools=config.get("teaching_tools", []) or [],
            llm_model=config.get("llmModel"),
            version=agent.version,
            created_at=agent.created_at,
            updated_at=agent.updated_at,
            author_id=user.id,
            author_name=user.display_name or user.username,
            author_department=user.department,
            author_avatar=user.avatar_url,
            usage_count=int(usage_count or 0),
            rating=None,
            rating_count=0,
            config=config or {},
            is_builtin=is_builtin,
            builtin_category=builtin_category,
        )
        # 元组用于排序：(是否内建, 原始排序辅助 info)
        raw_items.append((item, int(usage_count or 0), user))

    # 排序策略：内建助手永远排在前面（形成"平台推荐"区），其余保持原 sort 参数的逻辑
    if sort == "popular":
        raw_items.sort(key=lambda t: (0 if t[0].is_builtin else 1, -t[1], -(t[0].updated_at.timestamp() if t[0].updated_at else 0)))
    elif sort == "name":
        raw_items.sort(key=lambda t: (0 if t[0].is_builtin else 1, t[0].name))
    else:  # newest (默认)
        raw_items.sort(key=lambda t: (0 if t[0].is_builtin else 1, -(t[0].updated_at.timestamp() if t[0].updated_at else 0), -(t[0].created_at.timestamp() if t[0].created_at else 0)))

    items = [t[0] for t in raw_items]
    total = len(items)
    start = (page - 1) * page_size
    paged = items[start : start + page_size]
    return paged, total


def create_agent(db: Session, user_id: int, agent: AgentCreate) -> Agent:
    db_agent = Agent(
        user_id=user_id,
        name=agent.name,
        course_name=agent.course_name,
        template=agent.template,
        status="draft",
        config=agent.config,
        version=1,
    )
    db.add(db_agent)
    db.commit()
    db.refresh(db_agent)

    config_data = agent.config
    if isinstance(config_data, str):
        config_data = json.loads(config_data) if config_data else {}
    if config_data and isinstance(config_data, dict) and "knowledgeFileIds" in config_data:
        for file_id in config_data["knowledgeFileIds"]:
            knowledge_file = db.query(KnowledgeFile).filter(KnowledgeFile.id == file_id, KnowledgeFile.user_id == user_id).first()
            if knowledge_file:
                knowledge_file.agent_id = db_agent.id

    db.commit()
    db.refresh(db_agent)
    return db_agent


def update_agent(db: Session, agent: Agent, updates: AgentUpdate) -> Agent:
    if updates.name is not None:
        agent.name = updates.name
    if updates.course_name is not None:
        agent.course_name = updates.course_name
    if updates.template is not None:
        agent.template = updates.template
    if updates.status is not None:
        agent.status = updates.status
    if updates.config is not None:
        agent.config = updates.config

        if "knowledgeFileIds" in updates.config:
            db.query(KnowledgeFile).filter(KnowledgeFile.agent_id == agent.id).update({"agent_id": None})
            for file_id in updates.config["knowledgeFileIds"]:
                knowledge_file = db.query(KnowledgeFile).filter(KnowledgeFile.id == file_id, KnowledgeFile.user_id == agent.user_id).first()
                if knowledge_file:
                    knowledge_file.agent_id = agent.id

    db.commit()
    db.refresh(agent)
    return agent


def publish_agent(db: Session, agent: Agent) -> Agent:
    config = _parse_agent_config(agent.config)
    if config.get("downloaded_from"):
        raise ValueError("从市场下载的助手副本不可发布到市场")
    agent.status = "published"
    agent.version += 1
    db.commit()
    db.refresh(agent)
    return agent


def download_agent(db: Session, src_agent_id: int, current_user_id: int) -> Agent:
    """下载市场 Agent 副本：创建新 Agent + 复制知识库文件 + 复制 Chroma 向量。"""
    import copy as _copy

    src_agent = db.query(Agent).filter(
        Agent.id == src_agent_id, Agent.status == "published"
    ).first()
    if not src_agent:
        raise ValueError("Agent 不存在或未发布")

    # 检查是否已下载过
    existing = db.query(Agent).filter(Agent.user_id == current_user_id).all()
    for s in existing:
        s_config = _parse_agent_config(s.config)
        dl = s_config.get("downloaded_from")
        if dl and dl.get("agent_id") == src_agent_id:
            raise ValueError("已下载过该 Agent")

    # 深拷贝 config（兼容双重 JSON 编码的脏数据）
    config = _copy.deepcopy(_parse_agent_config(src_agent.config))
    config["downloaded_from"] = {"agent_id": src_agent.id, "author_id": src_agent.user_id}

    # 创建新 Agent
    new_agent = Agent(
        user_id=current_user_id,
        name=src_agent.name,
        course_name=src_agent.course_name,
        template=src_agent.template,
        status="draft",
        config=config,
        version=1,
    )
    db.add(new_agent)
    db.commit()
    db.refresh(new_agent)

    # 复制知识库文件记录
    src_files = db.query(KnowledgeFile).filter(KnowledgeFile.agent_id == src_agent_id).all()
    for f in src_files:
        new_file = KnowledgeFile(
            user_id=current_user_id,
            agent_id=new_agent.id,
            filename=f.filename,
            file_path=f.file_path,
            file_type=f.file_type,
            file_size=f.file_size,
            status="done",
            chunk_count=f.chunk_count,
        )
        db.add(new_file)
    db.commit()

    # 复制 Chroma 向量数据（失败不阻断）
    try:
        from .rag import copy_chroma_collection
        copy_chroma_collection(src_agent.id, new_agent.id)
    except Exception as e:
        logger.warning(f"复制向量数据失败: {e}")

    db.refresh(new_agent)
    return new_agent
