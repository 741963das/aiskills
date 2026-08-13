from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Float, Text, Index
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..database import Base


class KnowledgeFile(Base):
    __tablename__ = "knowledge_files"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    agent_id = Column(Integer, ForeignKey("agents.id"), nullable=True, index=True)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_type = Column(String)
    file_size = Column(Float)
    status = Column(String, nullable=False, default="uploading")
    progress = Column(Integer, default=0)
    progress_stage = Column(String, default="waiting")
    error_message = Column(Text, nullable=True)
    chunk_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    chunks = relationship("KnowledgeChunk", back_populates="file", cascade="all, delete-orphan")


class KnowledgeChunk(Base):
    __tablename__ = "knowledge_chunks"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("knowledge_files.id"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    chunk_size = Column(Integer, default=0)

    file = relationship("KnowledgeFile", back_populates="chunks")

    __table_args__ = (
        Index("ix_chunks_file_id", "file_id"),
    )
