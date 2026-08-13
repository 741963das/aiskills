"""
v2.3 文档生成路由：POST /generate, GET /{id}/download, GET /history。
"""
import os
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from ..database import get_db
from ..models.user import User
from ..models.agent import Agent
from ..models.document import GeneratedDocument
from ..utils.auth import get_current_user
from ..services.document_service import generate_ppt, generate_word

router = APIRouter(prefix="/documents", tags=["documents"])


# ---------------------------------------------------------------------------
# 请求模型
# ---------------------------------------------------------------------------

class GenerateDocumentRequest(BaseModel):
    doc_type: str  # "ppt" | "word"
    topic: str
    subject: str = ""
    grade: str = ""
    # PPT 专用
    slide_count: int = 8
    style: str = "专业严谨"
    # Word 专用
    duration: str = "45"
    # 关联 Agent（可选，用于注入 system_prompt）
    agent_id: Optional[int] = None


class GenerateDocumentResponse(BaseModel):
    id: int
    filename: str
    download_url: str


# ---------------------------------------------------------------------------
# POST /api/documents/generate
# ---------------------------------------------------------------------------

@router.post("/generate", response_model=GenerateDocumentResponse)
async def generate_document(
    request: GenerateDocumentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI 生成文档：LLM → JSON → python-pptx/python-docx 创建真实文件。"""

    # 如果关联了 Agent，获取 system_prompt
    skill_prompt = None
    agent_id = None
    if request.agent_id:
        agent = db.query(Agent).filter(
            Agent.id == request.agent_id,
            Agent.user_id == current_user.id,
        ).first()
        if agent:
            agent_id = agent.id
            config = agent.config or {}
            skill_prompt = config.get("system_prompt") if isinstance(config, dict) else None

    # 调用对应生成器
    try:
        if request.doc_type == "ppt":
            filepath = await generate_ppt(
                topic=request.topic,
                grade=request.grade,
                subject=request.subject,
                slide_count=request.slide_count,
                style=request.style,
                skill_prompt=skill_prompt,
            )
        elif request.doc_type == "word":
            filepath = await generate_word(
                topic=request.topic,
                subject=request.subject,
                grade=request.grade,
                duration=request.duration,
                skill_prompt=skill_prompt,
            )
        else:
            raise HTTPException(status_code=400, detail="doc_type 必须是 ppt 或 word")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"文档生成失败: {e}")

    # 保存记录到数据库
    filename = os.path.basename(filepath)
    doc = GeneratedDocument(
        user_id=current_user.id,
        agent_id=agent_id,
        doc_type=request.doc_type,
        topic=request.topic,
        subject=request.subject,
        grade=request.grade,
        file_path=filepath,
        file_name=filename,
        config={
            "slide_count": request.slide_count,
            "style": request.style,
            "duration": request.duration,
        },
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return GenerateDocumentResponse(
        id=doc.id,
        filename=filename,
        download_url=f"/api/documents/{doc.id}/download",
    )


# ---------------------------------------------------------------------------
# GET /api/documents/download/{filename}
# 对话内 PPT 生成专用下载（无 auth，filename 为随机 UUID）
# ---------------------------------------------------------------------------

@router.get("/download/{filename}")
async def download_by_filename(filename: str):
    """按文件名直接下载（对话内生成场景）。"""
    filepath = os.path.join("outputs", filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="文件不存在")
    media_type = (
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        if filename.endswith(".pptx")
        else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    return FileResponse(path=filepath, media_type=media_type, filename=filename)


# ---------------------------------------------------------------------------
# GET /api/documents/{id}/download
# ---------------------------------------------------------------------------

@router.get("/{doc_id}/download")
def download_document(
    doc_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """下载生成的文档文件。"""
    doc = db.query(GeneratedDocument).filter(
        GeneratedDocument.id == doc_id,
        GeneratedDocument.user_id == current_user.id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")

    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="文件已被删除")

    media_type = (
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        if doc.doc_type == "ppt"
        else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    return FileResponse(
        path=doc.file_path,
        media_type=media_type,
        filename=doc.file_name,
    )


# ---------------------------------------------------------------------------
# GET /api/documents/history
# ---------------------------------------------------------------------------

@router.get("/history")
def get_document_history(
    doc_type: Optional[str] = Query(None, description="按类型筛选: ppt/word"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取当前用户的文档生成历史（按时间倒序）。"""
    query = db.query(GeneratedDocument).filter(
        GeneratedDocument.user_id == current_user.id,
    )
    if doc_type:
        query = query.filter(GeneratedDocument.doc_type == doc_type)
    docs = query.order_by(GeneratedDocument.created_at.desc()).all()

    return [
        {
            "id": d.id,
            "doc_type": d.doc_type,
            "topic": d.topic,
            "subject": d.subject,
            "grade": d.grade,
            "file_name": d.file_name,
            "download_url": f"/api/documents/{d.id}/download",
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in docs
    ]
