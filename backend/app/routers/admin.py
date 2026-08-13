"""
管理类路由：数据清理、内置内容播种、系统状态查看。
⚠️ 这些 API 默认需要 SECRET_KEY 级别的鉴权，不用于学生端。
"""
from __future__ import annotations

import json
import logging
import os
import shutil
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import services
from ..config import settings
from ..database import get_db
from ..models.agent import Agent
from ..models.conversation import Conversation
from ..models.document import GeneratedDocument
from ..models.knowledge import KnowledgeChunk, KnowledgeFile
from ..models.message import Message
from ..models.reflection import Reflection
from ..models.skill_file import SkillFile
from ..models.user import User
from ..utils.auth import get_current_user
from .agent import _parse_agent_config
from ..services.builtins import (
    BUILTIN_MARKER_KEY,
    seed_builtins,
    SYSTEM_USERNAME,
)

router = APIRouter(prefix="/admin", tags=["admin"])

logger = logging.getLogger(__name__)

UPLOAD_DIR = settings.UPLOAD_DIR
CHROMA_DIR = settings.CHROMA_PERSIST_DIR


def _require_admin_or_internal(current_user: User, secret: str | None = None) -> None:
    """简单的鉴权：或者是超级管理员角色，或者提供环境变量中设置的 ADMIN_SECRET。"""
    # 1. 角色鉴权
    if current_user.role in ("admin", "super_admin"):
        return
    # 2. SYSTEM 内置用户也有权
    if current_user.username == SYSTEM_USERNAME:
        return
    # 3. Secret 兜底
    admin_secret = os.environ.get("ADMIN_SECRET") or settings.SECRET_KEY
    if secret and admin_secret and secret == admin_secret and len(secret) >= 16:
        return
    raise HTTPException(status_code=403, detail="需要管理员权限")


class CleanupRequest(BaseModel):
    secret: str | None = None
    clear_knowledge: bool = True
    unpublish_agents: bool = True
    unpublish_skill_files: bool = True
    clear_generated_documents: bool = True
    clear_uploads_folder: bool = True
    clear_conversations: bool = False
    clear_messages: bool = False
    keep_builtins: bool = True


class CleanupResponse(BaseModel):
    knowledge_files_deleted: int = 0
    knowledge_chunks_deleted: int = 0
    knowledge_files_removed: int = 0
    chroma_removed: bool = False
    unpublished_agents: int = 0
    unpublished_skill_files: int = 0
    generated_documents_deleted: int = 0
    uploads_files_removed: int = 0


class SeedResponse(BaseModel):
    system_user_id: int
    agents: dict[str, int]
    skill_files: dict[str, int]
    builtin_version: int


def _run_cleanup(db: Session, req: CleanupRequest) -> CleanupResponse:
    res = CleanupResponse()

    # 1. 知识库
    if req.clear_knowledge:
        files = db.query(KnowledgeFile).all()
        res.knowledge_files_deleted = len(files)
        for f in files:
            if f.file_path and os.path.exists(f.file_path):
                try:
                    os.remove(f.file_path)
                    res.knowledge_files_removed += 1
                except Exception as e:
                    logger.warning("删除文件失败 %s: %s", f.file_path, e)
        res.knowledge_chunks_deleted = db.query(KnowledgeChunk).count()
        db.query(KnowledgeChunk).delete()
        db.query(KnowledgeFile).delete()
        db.commit()
        # Chroma
        if os.path.exists(CHROMA_DIR):
            try:
                shutil.rmtree(CHROMA_DIR)
                res.chroma_removed = True
            except Exception as e:
                logger.warning("删除 Chroma 目录失败: %s", e)

    # 2. 取消发布助手
    if req.unpublish_agents:
        q = db.query(Agent).filter(Agent.status == "published")
        if req.keep_builtins:
            # 排除 SYSTEM 用户创建的 built-in
            system_user = db.query(User).filter(User.username == SYSTEM_USERNAME).first()
            if system_user:
                q = q.filter(Agent.user_id != system_user.id)
        published = q.all()
        for a in published:
            a.status = "draft"
            if isinstance(a.config, dict):
                a.config["published"] = False
                a.config.pop("publishScope", None)
        res.unpublished_agents = len(published)
        db.commit()

    # 3. 取消发布技能文件
    if req.unpublish_skill_files:
        q = db.query(SkillFile).filter(SkillFile.status == "published")
        if req.keep_builtins:
            system_user = db.query(User).filter(User.username == SYSTEM_USERNAME).first()
            if system_user:
                q = q.filter(SkillFile.user_id != system_user.id)
        published = q.all()
        for s in published:
            s.status = "draft"
        res.unpublished_skill_files = len(published)
        db.commit()

    # 4. 生成文档
    if req.clear_generated_documents:
        docs = db.query(GeneratedDocument).all()
        for d in docs:
            if d.file_path and os.path.exists(d.file_path):
                try:
                    os.remove(d.file_path)
                except Exception as e:
                    logger.warning("删除文档失败 %s: %s", d.file_path, e)
        res.generated_documents_deleted = len(docs)
        db.query(GeneratedDocument).delete()
        db.commit()

    # 5. uploads 文件夹
    if req.clear_uploads_folder and os.path.exists(UPLOAD_DIR):
        count = 0
        for root, dirs, files in os.walk(UPLOAD_DIR, topdown=False):
            for f in files:
                try:
                    os.remove(os.path.join(root, f))
                    count += 1
                except Exception as e:
                    logger.warning("删除 uploads 文件失败: %s", e)
        res.uploads_files_removed = count

    # 6. 可选删除对话/消息
    if req.clear_conversations:
        db.query(Message).delete() if req.clear_messages else None
        db.query(Conversation).delete()
        db.commit()

    return res


@router.post("/cleanup", response_model=CleanupResponse)
def admin_cleanup(
    req: CleanupRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """清理测试数据。默认保留平台 built-in 内容不被下架。需管理员权限。"""
    _require_admin_or_internal(current_user, req.secret)
    result = _run_cleanup(db, req)
    logger.info("【Admin】cleanup 执行: %s", json.dumps(result.__dict__, ensure_ascii=False))
    return result


@router.post("/seed-builtins", response_model=SeedResponse)
def admin_seed_builtins(
    secret: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """（重新）播种平台内置助手与技能。需管理员权限。"""
    _require_admin_or_internal(current_user, secret)
    result = seed_builtins(db)
    return SeedResponse(**result)


@router.get("/status")
def admin_status(
    secret: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """查看当前数据状态（调试用）。"""
    _require_admin_or_internal(current_user, secret)
    system_user = db.query(User).filter(User.username == SYSTEM_USERNAME).first()
    builtin_agents_count = 0
    if system_user:
        builtin_agents_count = (
            db.query(Agent)
            .filter(Agent.user_id == system_user.id, Agent.status == "published")
            .count()
        )
    return {
        "total_users": db.query(User).count(),
        "total_agents": db.query(Agent).count(),
        "published_agents": db.query(Agent).filter(Agent.status == "published").count(),
        "builtin_agents_published": builtin_agents_count,
        "total_skill_files": db.query(SkillFile).count(),
        "published_skill_files": db.query(SkillFile).filter(SkillFile.status == "published").count(),
        "knowledge_files": db.query(KnowledgeFile).count(),
        "knowledge_chunks": db.query(KnowledgeChunk).count(),
        "generated_documents": db.query(GeneratedDocument).count(),
        "conversations": db.query(Conversation).count(),
        "messages": db.query(Message).count(),
        "reflections": db.query(Reflection).count(),
    }
