from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON, Text
from sqlalchemy.sql import func
from ..database import Base


class TeachingReflection(Base):
    __tablename__ = "teaching_reflections"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=True)
    input_text = Column(Text, nullable=False)
    report = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# 兼容别名：admin.py 等模块可能使用 Reflection 导入
Reflection = TeachingReflection
