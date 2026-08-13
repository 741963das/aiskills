from pydantic import BaseModel
from datetime import datetime


class SkillFileBase(BaseModel):
    name: str
    description: str | None = None
    content: str


class SkillFileCreate(SkillFileBase):
    source: str = "manual"
    github_source: dict | None = None


class SkillFileUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    content: str | None = None
    status: str | None = None


class SkillFileResponse(SkillFileBase):
    id: int
    user_id: int
    source: str
    github_source: dict | None
    status: str
    version: int
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True


class MountSkillRequest(BaseModel):
    skill_file_id: int
