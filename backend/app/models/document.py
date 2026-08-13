from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..database import Base


class GeneratedDocument(Base):
    """AI 生成的文档（PPT/Word）记录。"""
    __tablename__ = "generated_documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=True)
    doc_type = Column(String, nullable=False)  # ppt | word
    topic = Column(String, nullable=False)
    subject = Column(String, default="")
    grade = Column(String, default="")
    file_path = Column(String, nullable=False)
    file_name = Column(String, nullable=False)
    config = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
    agent = relationship("Agent")
