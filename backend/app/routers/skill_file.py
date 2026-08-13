from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User
from ..models.skill_file import SkillFile
from ..schemas.skill_file import (
    SkillFileCreate,
    SkillFileUpdate,
    SkillFileResponse,
)
from ..services.skill_file import (
    create_skill_file,
    update_skill_file,
    get_skill_file,
    get_user_skill_files,
    delete_skill_file,
    get_marketplace_skill_files,
    download_skill_file,
)
from ..utils.auth import get_current_user

router = APIRouter(prefix="/skill-files", tags=["skill-files"])


class ImportGithubRequest(BaseModel):
    """从 GitHub raw URL 导入技能文件。"""
    raw_url: str
    name: str | None = None
    description: str | None = None


def _serialize(skill_file: SkillFile) -> dict:
    """统一序列化 SkillFile 为响应字典。"""
    return {
        "id": skill_file.id,
        "user_id": skill_file.user_id,
        "name": skill_file.name,
        "description": skill_file.description,
        "content": skill_file.content,
        "source": skill_file.source,
        "github_source": skill_file.github_source,
        "status": skill_file.status,
        "version": skill_file.version,
        "created_at": skill_file.created_at.isoformat() if skill_file.created_at else None,
        "updated_at": skill_file.updated_at.isoformat() if skill_file.updated_at else None,
    }


# ---------------------------------------------------------------------------
# Marketplace 路由必须在 /{id} 之前声明
# ---------------------------------------------------------------------------

@router.get("/marketplace")
def list_marketplace(
    keyword: str | None = Query(None, description="按名称/描述搜索"),
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=60),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """技能市场列表（已发布的技能文件）。平台内建技能自动排前。"""
    from ..services.builtins import SYSTEM_USERNAME

    rows, _ = get_marketplace_skill_files(
        db,
        keyword=keyword,
        page=1,  # 先拿全量，再统一排序 + 分页（技能文件量级小）
        page_size=10000,
    )
    raw_items = []
    for skill_file, author in rows:
        item = _serialize(skill_file)
        item["author_id"] = author.id
        item["author_name"] = author.display_name or author.username
        item["author_department"] = author.department
        item["author_avatar"] = author.avatar_url
        is_builtin = author.username == SYSTEM_USERNAME
        item["is_builtin"] = is_builtin
        # 使用量暂用 version 做占位（SkillFile 暂无单独 usage_count 表）
        item["usage_count"] = item.get("usage_count", 0) or (skill_file.version or 1)
        raw_items.append((item, skill_file.updated_at, skill_file.created_at, is_builtin))

    # 排序：内建在前 → 更新时间倒序
    raw_items.sort(key=lambda t: (0 if t[3] else 1, -(t[1].timestamp() if t[1] else 0), -(t[2].timestamp() if t[2] else 0)))
    sorted_items = [t[0] for t in raw_items]
    total = len(sorted_items)
    start = (page - 1) * page_size
    paged = sorted_items[start : start + page_size]
    return {"items": paged, "total": total, "page": page, "page_size": page_size}


@router.get("/marketplace/{skill_file_id}")
def get_marketplace_skill_file(
    skill_file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """技能市场详情。"""
    from ..models.user import User

    row = (
        db.query(SkillFile, User)
        .join(User, User.id == SkillFile.user_id)
        .filter(SkillFile.id == skill_file_id, SkillFile.status == "published")
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="技能文件不存在或未发布")

    skill_file, author = row
    item = _serialize(skill_file)
    item["author_id"] = author.id
    item["author_name"] = author.display_name or author.username
    item["author_department"] = author.department
    item["author_avatar"] = author.avatar_url
    return item


# ---------------------------------------------------------------------------
# CRUD 路由
# ---------------------------------------------------------------------------

@router.post("/", response_model=SkillFileResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(
    data: SkillFileCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """创建技能文件。"""
    return create_skill_file(db, user_id=current_user.id, data=data)


@router.get("/", response_model=list[SkillFileResponse])
def list_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取当前用户的技能文件列表。"""
    return get_user_skill_files(db, user_id=current_user.id)


@router.get("/{skill_file_id}", response_model=SkillFileResponse)
def get_endpoint(
    skill_file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取单个技能文件（所有者或已发布均可访问）。"""
    skill_file = get_skill_file(db, skill_file_id)
    if not skill_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="技能文件不存在")
    # 非所有者仅能访问已发布
    if skill_file.user_id != current_user.id and skill_file.status != "published":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权访问")
    return skill_file


@router.put("/{skill_file_id}", response_model=SkillFileResponse)
def update_endpoint(
    skill_file_id: int,
    data: SkillFileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """更新技能文件。"""
    skill_file = update_skill_file(db, user_id=current_user.id, skill_file_id=skill_file_id, data=data)
    if not skill_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="技能文件不存在或无权修改")
    return skill_file


@router.delete("/{skill_file_id}")
def delete_endpoint(
    skill_file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """删除技能文件。"""
    ok = delete_skill_file(db, user_id=current_user.id, skill_file_id=skill_file_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="技能文件不存在或无权删除")
    return {"message": "删除成功"}


@router.put("/{skill_file_id}/publish", response_model=SkillFileResponse)
def publish_endpoint(
    skill_file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """发布技能文件到技能市场。"""
    skill_file = (
        db.query(SkillFile)
        .filter(SkillFile.id == skill_file_id, SkillFile.user_id == current_user.id)
        .first()
    )
    if not skill_file:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="技能文件不存在")

    skill_file.status = "published"
    skill_file.version = (skill_file.version or 1) + 1
    db.commit()
    db.refresh(skill_file)
    return skill_file


@router.post("/{skill_file_id}/download", response_model=SkillFileResponse)
def download_endpoint(
    skill_file_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """下载市场技能文件副本（复制 content，source 标记为 marketplace）。"""
    try:
        return download_skill_file(db, user_id=current_user.id, skill_file_id=skill_file_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/import-github", response_model=SkillFileResponse, status_code=status.HTTP_201_CREATED)
async def import_github_endpoint(
    request: ImportGithubRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """从 GitHub raw URL 导入技能文件内容。"""
    import httpx

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(request.raw_url)
            resp.raise_for_status()
            content = resp.text
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"GitHub 拉取失败: {str(e)[:200]}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)[:200]}")

    # 解析 GitHub raw URL 中的 owner/repo/branch/path 信息
    github_source = {"raw_url": request.raw_url}
    parts = request.raw_url.replace("https://raw.githubusercontent.com/", "").split("/", 3)
    if len(parts) >= 4:
        github_source["owner"] = parts[0]
        github_source["repo"] = parts[1]
        github_source["branch"] = parts[2]
        github_source["path"] = parts[3]

    # 名称：优先使用用户提供的，否则从 URL 路径推断
    name = request.name
    if not name:
        url_path = parts[3] if len(parts) >= 4 else request.raw_url.rsplit("/", 1)[-1]
        name = url_path.rsplit("/", 1)[-1].rsplit(".", 1)[0] or "github_skill"

    data = SkillFileCreate(
        name=name,
        description=request.description,
        content=content,
        source="github",
        github_source=github_source,
    )
    return create_skill_file(db, user_id=current_user.id, data=data)
