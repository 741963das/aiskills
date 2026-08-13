from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
import os
import logging
import traceback

from ..database import get_db
from ..models.user import User
from ..models.agent import Agent
from ..models.knowledge import KnowledgeFile, KnowledgeChunk
from ..utils.auth import get_current_user
from ..services.knowledge import parse_document
from ..services.rag import (
    chunk_text_semantic,
    filter_chunks,
    store_chunks_to_chroma,
    delete_file_from_chroma,
)

router = APIRouter(prefix="/knowledge", tags=["knowledge"])

logger = logging.getLogger(__name__)

UPLOAD_DIR = "uploads/knowledge"
MAX_FILE_SIZE = 50 * 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md", ".docx"}

STAGE_LABELS = {
    "waiting": "等待处理",
    "parsing": "正在解析",
    "chunking": "正在分块",
    "embedding": "正在向量化",
    "done": "处理完成",
    "failed": "处理失败",
}


class TestSearchRequest(BaseModel):
    query: str
    top_k: int = 5


class TestSearchResult(BaseModel):
    chunk_index: int
    content: str
    similarity: float
    filename: str


def _update_file_status(db: Session, file_id: int, **kwargs):
    db_file = db.query(KnowledgeFile).filter(KnowledgeFile.id == file_id).first()
    if not db_file:
        return
    for key, value in kwargs.items():
        setattr(db_file, key, value)
    db.commit()
    db.refresh(db_file)


def _assert_agent_owned_by_user(db: Session, agent_id: int, user_id: int):
    """校验 agent_id 属于当前用户，或属于 SYSTEM 用户（内置助手）且当前用户是教师/管理员。返回 Agent 对象。"""
    from app.models.user import User

    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent 不存在")

    # 本人创建 → 直接放行
    if agent.user_id == user_id:
        return agent

    # 内置助手（SYSTEM 创建）→ 允许已登录的教师/管理员上传知识库
    system_user = db.query(User).filter(User.username == "SYSTEM").first()
    if system_user and agent.user_id == system_user.id:
        current_user = db.query(User).filter(User.id == user_id).first()
        if current_user and current_user.role in ("teacher", "admin", "super_admin"):
            return agent

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问该 Agent")


def _process_file_pipeline(file_id: int, agent_id: int):
    db = next(get_db())
    try:
        _update_file_status(db, file_id,
            status="parsing", progress=10, progress_stage="parsing", error_message=None)

        db_file = db.query(KnowledgeFile).filter(KnowledgeFile.id == file_id).first()
        if not db_file:
            return

        parsed = parse_document(db_file.file_path, db_file.file_type)
        cleaned_text = parsed["cleaned_text"]

        _update_file_status(db, file_id,
            status="chunking", progress=40, progress_stage="chunking")

        raw_chunks = chunk_text_semantic(cleaned_text, chunk_size=512, overlap=50)

        filtered_chunks, skipped = filter_chunks(raw_chunks)

        # Save chunks to SQLite (for metadata/preview)
        db.query(KnowledgeChunk).filter(KnowledgeChunk.file_id == file_id).delete()
        for idx, chunk in enumerate(filtered_chunks):
            chunk_obj = KnowledgeChunk(
                file_id=file_id,
                chunk_index=idx,
                content=chunk["text"],
                chunk_size=chunk["size"],
            )
            db.add(chunk_obj)
        db.commit()

        # Generate embeddings + store in Chroma (按 agent_id 隔离)
        _update_file_status(db, file_id,
            progress_stage="embedding", progress=70)

        store_chunks_to_chroma(
            agent_id=agent_id,
            file_id=file_id,
            filename=db_file.filename,
            chunks=filtered_chunks,
        )

        db_file = db.query(KnowledgeFile).filter(KnowledgeFile.id == file_id).first()
        db_file.chunk_count = len(filtered_chunks)
        db_file.status = "done"
        db_file.progress = 100
        db_file.progress_stage = "done"
        db.commit()

    except Exception as e:
        db_file = db.query(KnowledgeFile).filter(KnowledgeFile.id == file_id).first()
        if db_file:
            db_file.status = "failed"
            db_file.progress_stage = "failed"
            db_file.error_message = str(e)[:500]
            db.commit()
        logger.error(f"文件处理失败 {file_id}: {e}")
        traceback.print_exc()
    finally:
        db.close()


@router.post("/upload")
async def upload_knowledge_file(
    file: UploadFile = File(...),
    agent_id: int = Query(..., description="文件归属的 Agent ID"),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """上传知识库文件，必须指定 agent_id。文件将与该 Agent 关联，向量存入 agent_{agent_id} collection。"""
    _assert_agent_owned_by_user(db, agent_id, current_user.id)

    filename = file.filename
    file_ext = os.path.splitext(filename)[1].lower()

    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的文件类型，支持：pdf, txt, md, docx",
        )

    file_content = await file.read()
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="文件大小超过 50MB 限制",
        )

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    safe_filename = f"{current_user.id}_agent{agent_id}_{datetime.now().timestamp()}_{filename}"
    file_path = os.path.join(UPLOAD_DIR, safe_filename)

    with open(file_path, "wb") as f:
        f.write(file_content)

    file_size = len(file_content)

    knowledge_file = KnowledgeFile(
        user_id=current_user.id,
        agent_id=agent_id,
        filename=filename,
        file_path=file_path,
        file_type=file_ext.lstrip("."),
        file_size=file_size,
        status="uploading",
        progress=0,
        progress_stage="uploading",
    )
    db.add(knowledge_file)
    db.commit()
    db.refresh(knowledge_file)

    background_tasks.add_task(_process_file_pipeline, knowledge_file.id, agent_id)

    return {
        "id": knowledge_file.id,
        "agent_id": knowledge_file.agent_id,
        "filename": knowledge_file.filename,
        "status": knowledge_file.status,
        "progress": knowledge_file.progress,
        "progress_stage": knowledge_file.progress_stage,
        "file_type": knowledge_file.file_type,
        "file_size": knowledge_file.file_size,
        "chunk_count": knowledge_file.chunk_count,
        "created_at": knowledge_file.created_at.isoformat(),
    }


@router.get("/files")
def list_knowledge_files(
    agent_id: int = Query(..., description="按 Agent ID 过滤文件列表"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取指定 Agent 的知识库文件列表。"""
    _assert_agent_owned_by_user(db, agent_id, current_user.id)
    files = (
        db.query(KnowledgeFile)
        .filter(
            KnowledgeFile.user_id == current_user.id,
            KnowledgeFile.agent_id == agent_id,
        )
        .order_by(KnowledgeFile.created_at.desc())
        .all()
    )
    return [
        {
            "id": f.id,
            "agent_id": f.agent_id,
            "filename": f.filename,
            "status": f.status,
            "progress": f.progress,
            "progress_stage": f.progress_stage,
            "progress_stage_label": STAGE_LABELS.get(f.progress_stage, f.progress_stage),
            "file_type": f.file_type,
            "file_size": f.file_size,
            "chunk_count": f.chunk_count,
            "error_message": f.error_message,
            "created_at": f.created_at.isoformat(),
        }
        for f in files
    ]


@router.get("/files/{file_id}/status")
def get_file_status(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    file = db.query(KnowledgeFile).filter(KnowledgeFile.id == file_id).first()
    if not file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")
    if file.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问")

    return {
        "id": file.id,
        "agent_id": file.agent_id,
        "status": file.status,
        "progress": file.progress,
        "progress_stage": file.progress_stage,
        "progress_stage_label": STAGE_LABELS.get(file.progress_stage, file.progress_stage),
        "chunk_count": file.chunk_count,
        "error_message": file.error_message,
    }


@router.get("/info")
def get_knowledge_info(
    agent_id: int = Query(..., description="按 Agent ID 获取知识库统计"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _assert_agent_owned_by_user(db, agent_id, current_user.id)
    files = db.query(KnowledgeFile).filter(
        KnowledgeFile.user_id == current_user.id,
        KnowledgeFile.agent_id == agent_id,
    ).all()
    total_chunks = sum(f.chunk_count or 0 for f in files)
    done_count = sum(1 for f in files if f.status == "done")
    return {
        "embedding_model": "BAAI/bge-m3 (SiliconFlow)",
        "collection_name": f"agent_{agent_id}",
        "total_documents": len(files),
        "done_documents": done_count,
        "processing_documents": len(files) - done_count,
        "total_chunks": total_chunks,
    }


@router.delete("/files/{file_id}")
def delete_knowledge_file(
    file_id: int,
    agent_id: int = Query(..., description="文件所属的 Agent ID（用于定位 Chroma collection）"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """删除文件：同时清理 SQLite 元数据、Chroma 向量、磁盘文件。"""
    file = db.query(KnowledgeFile).filter(KnowledgeFile.id == file_id).first()
    if not file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")
    if file.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权删除")
    if file.agent_id != agent_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="agent_id 与文件不匹配")

    db.query(KnowledgeChunk).filter(KnowledgeChunk.file_id == file_id).delete()

    # 删除 Chroma agent_{agent_id} collection 中的向量
    delete_file_from_chroma(agent_id=agent_id, file_id=file_id)

    if os.path.exists(file.file_path):
        os.remove(file.file_path)

    db.delete(file)
    db.commit()

    return {"message": "删除成功"}


@router.post("/test-search")
def test_search(
    request: TestSearchRequest,
    agent_id: int = Query(..., description="在指定 Agent 的 collection 中检索"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """测试检索：不调用 LLM，仅返回向量召回结果（在 agent_{agent_id} collection 中检索）。"""
    from ..services.rag import generate_embedding, _get_collection

    _assert_agent_owned_by_user(db, agent_id, current_user.id)
    agent_files = (
        db.query(KnowledgeFile)
        .filter(
            KnowledgeFile.user_id == current_user.id,
            KnowledgeFile.agent_id == agent_id,
            KnowledgeFile.status == "done",
        )
        .all()
    )

    if not agent_files:
        return {"results": [], "total_chunks": 0}

    query_embedding = generate_embedding(request.query)
    collection = _get_collection(agent_id)
    file_ids = [f.id for f in agent_files]

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=request.top_k,
        where={"file_id": {"$in": file_ids}},
        include=["documents", "metadatas", "distances"],
    )

    if not results["ids"] or not results["ids"][0]:
        return {"results": [], "total_chunks": 0}

    search_results = []
    for i in range(len(results["ids"][0])):
        distance = results["distances"][0][i]
        similarity = 1.0 - distance
        metadata = results["metadatas"][0][i]
        document = results["documents"][0][i]
        search_results.append(
            TestSearchResult(
                chunk_index=metadata.get("chunk_index", 0),
                content=document,
                similarity=round(similarity, 4),
                filename=metadata.get("filename", "unknown"),
            )
        )

    total_chunks = sum(f.chunk_count or 0 for f in agent_files)
    return {
        "results": search_results,
        "total_chunks": total_chunks,
    }
