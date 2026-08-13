from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.sql import func

from ..database import Base


class StudentAgent(Base):
    __tablename__ = "student_agents"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    status = Column(String, default="active")  # "active" | "draft"
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    last_accessed_at = Column(DateTime(timezone=True))


class LearningRecord(Base):
    __tablename__ = "learning_records"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=True)
    activity_type = Column(String, nullable=False)
    duration_seconds = Column(Integer, default=0)
    metadata_json = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class MistakeRecord(Base):
    __tablename__ = "mistake_records"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=True)
    subject = Column(String)
    knowledge_point = Column(String)
    question = Column(Text)
    student_answer = Column(Text)
    correct_answer = Column(Text)
    explanation = Column(Text)
    error_type = Column(String)
    difficulty = Column(String, default="medium")
    is_mastered = Column(Boolean, default=False)
    review_count = Column(Integer, default=0)
    last_reviewed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class StudentProfile(Base):
    __tablename__ = "student_profiles"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    grade = Column(String)
    major = Column(String)
    subjects_of_interest = Column(Text)
    learning_goal = Column(Text)
    preferred_time = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


class QuestionRecord(Base):
    """学生疑问记录（待答疑池）。

    学生端学习时发布疑问 → 教师端看到真实疑问并解答 → 触发经验沉淀。
    status: "open"（待答疑）/ "answered"（已解答并沉淀）
    """
    __tablename__ = "question_records"
    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=False)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=True)
    question = Column(Text, nullable=False)          # 学生原始提问（痛点表述）
    ai_answer = Column(Text)                          # AI 初步回答（可选）
    teacher_reply = Column(Text)                      # 教师解决方案（空 = 待答疑）
    pain_point = Column(String)                       # 检测到的困惑/高频错误标签
    subject = Column(String)                          # 学科
    status = Column(String, default="open")           # open / answered
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    answered_at = Column(DateTime(timezone=True))
