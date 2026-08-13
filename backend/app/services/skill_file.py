from sqlalchemy.orm import Session

from ..models.skill_file import SkillFile
from ..models.agent_skill import AgentSkill
from ..models.agent import Agent
from ..schemas.skill_file import SkillFileCreate, SkillFileUpdate


def create_skill_file(db: Session, user_id: int, data: SkillFileCreate) -> SkillFile:
    """创建技能文件。"""
    skill_file = SkillFile(
        user_id=user_id,
        name=data.name,
        description=data.description,
        content=data.content,
        source=data.source,
        github_source=data.github_source,
        status="draft",
        version=1,
    )
    db.add(skill_file)
    db.commit()
    db.refresh(skill_file)
    return skill_file


def update_skill_file(db: Session, user_id: int, skill_file_id: int, data: SkillFileUpdate) -> SkillFile | None:
    """更新技能文件（仅所有者可更新）。"""
    skill_file = (
        db.query(SkillFile)
        .filter(SkillFile.id == skill_file_id, SkillFile.user_id == user_id)
        .first()
    )
    if not skill_file:
        return None

    if data.name is not None:
        skill_file.name = data.name
    if data.description is not None:
        skill_file.description = data.description
    if data.content is not None:
        skill_file.content = data.content
    if data.status is not None:
        skill_file.status = data.status

    db.commit()
    db.refresh(skill_file)
    return skill_file


def get_skill_file(db: Session, skill_file_id: int) -> SkillFile | None:
    """获取单个技能文件。"""
    return db.query(SkillFile).filter(SkillFile.id == skill_file_id).first()


def get_user_skill_files(db: Session, user_id: int) -> list[SkillFile]:
    """获取用户的技能文件列表。"""
    return (
        db.query(SkillFile)
        .filter(SkillFile.user_id == user_id)
        .order_by(SkillFile.updated_at.desc().nullslast(), SkillFile.created_at.desc())
        .all()
    )


def delete_skill_file(db: Session, user_id: int, skill_file_id: int) -> bool:
    """删除技能文件（仅所有者可删除，同时清理挂载关系）。"""
    skill_file = (
        db.query(SkillFile)
        .filter(SkillFile.id == skill_file_id, SkillFile.user_id == user_id)
        .first()
    )
    if not skill_file:
        return False

    # 清理所有挂载关系
    db.query(AgentSkill).filter(AgentSkill.skill_file_id == skill_file_id).delete()
    db.delete(skill_file)
    db.commit()
    return True


def mount_skill_to_agent(db: Session, agent_id: int, skill_file_id: int) -> AgentSkill:
    """挂载技能文件到 Agent（幂等：已挂载则直接返回现有记录）。"""
    # 校验 Agent 存在
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise ValueError("Agent 不存在")

    skill_file = db.query(SkillFile).filter(SkillFile.id == skill_file_id).first()
    if not skill_file:
        raise ValueError("SkillFile 不存在")

    existing = (
        db.query(AgentSkill)
        .filter(
            AgentSkill.agent_id == agent_id,
            AgentSkill.skill_file_id == skill_file_id,
        )
        .first()
    )
    if existing:
        return existing

    link = AgentSkill(agent_id=agent_id, skill_file_id=skill_file_id)
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


def unmount_skill_from_agent(db: Session, agent_id: int, skill_file_id: int) -> bool:
    """卸载 Agent 上的技能文件。"""
    link = (
        db.query(AgentSkill)
        .filter(
            AgentSkill.agent_id == agent_id,
            AgentSkill.skill_file_id == skill_file_id,
        )
        .first()
    )
    if not link:
        return False
    db.delete(link)
    db.commit()
    return True


def get_agent_skills(db: Session, agent_id: int) -> list[SkillFile]:
    """获取 Agent 已挂载的技能文件列表。"""
    return (
        db.query(SkillFile)
        .join(AgentSkill, AgentSkill.skill_file_id == SkillFile.id)
        .filter(AgentSkill.agent_id == agent_id)
        .order_by(AgentSkill.created_at.asc())
        .all()
    )


def get_marketplace_skill_files(
    db: Session,
    keyword: str | None = None,
    page: int = 1,
    page_size: int = 12,
) -> tuple[list[SkillFile], int]:
    """获取技能市场列表（已发布的技能文件）。"""
    from ..models.user import User

    query = (
        db.query(SkillFile, User)
        .join(User, User.id == SkillFile.user_id)
        .filter(SkillFile.status == "published")
    )
    if keyword:
        from sqlalchemy import or_
        like = f"%{keyword}%"
        query = query.filter(
            or_(
                SkillFile.name.ilike(like),
                SkillFile.description.ilike(like),
            )
        )

    rows = query.order_by(SkillFile.updated_at.desc().nullslast(), SkillFile.created_at.desc()).all()
    total = len(rows)
    start = (page - 1) * page_size
    paged = rows[start : start + page_size]
    return paged, total


def download_skill_file(db: Session, user_id: int, skill_file_id: int) -> SkillFile:
    """下载市场技能文件副本：复制 content，source 标记为 marketplace。"""
    src = (
        db.query(SkillFile)
        .filter(SkillFile.id == skill_file_id, SkillFile.status == "published")
        .first()
    )
    if not src:
        raise ValueError("SkillFile 不存在或未发布")

    new_file = SkillFile(
        user_id=user_id,
        name=src.name,
        description=src.description,
        content=src.content,
        source="marketplace",
        github_source=src.github_source,
        status="draft",
        version=1,
    )
    db.add(new_file)
    db.commit()
    db.refresh(new_file)
    return new_file
