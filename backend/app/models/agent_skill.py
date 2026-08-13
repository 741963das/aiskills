from sqlalchemy import Column, Integer, ForeignKey, DateTime
from sqlalchemy.sql import func

from ..database import Base


class AgentSkill(Base):
    __tablename__ = "agent_skills"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False, index=True)
    skill_file_id = Column(Integer, ForeignKey("skill_files.id"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
