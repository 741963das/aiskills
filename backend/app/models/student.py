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
