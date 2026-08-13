import json
from pydantic import BaseModel, field_validator
from datetime import datetime


class AgentBase(BaseModel):
    name: str
    course_name: str


class AgentCreate(AgentBase):
    template: str = "higher_edu"
    config: dict = {}


class AgentUpdate(BaseModel):
    name: str | None = None
    course_name: str | None = None
    template: str | None = None
    status: str | None = None
    config: dict | None = None


class AgentResponse(AgentBase):
    id: int
    user_id: int
    template: str
    status: str
    config: dict
    version: int
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True

    @field_validator("config", mode="before")
    @classmethod
    def parse_config(cls, v):
        if isinstance(v, str):
            return json.loads(v) if v else {}
        return v if isinstance(v, dict) else {}


class AgentMarketplaceItem(BaseModel):
    """市场列表中的单个 Agent 卡片数据。"""
    id: int
    name: str
    course_name: str
    template: str
    description: str | None = None
    subject: str | None = None
    department: str | None = None
    grade_level: str | None = None
    core_chapters: list[str] = []
    teaching_tools: list[str] = []
    llm_model: str | None = None
    version: int
    created_at: datetime
    updated_at: datetime | None
    # 作者信息
    author_id: int
    author_name: str | None = None
    author_department: str | None = None
    author_avatar: str | None = None
    # 统计（占位，后续可接 conversations/feedback 表聚合）
    usage_count: int = 0
    rating: float | None = None
    rating_count: int = 0
    config: dict = {}
    # 平台标记
    is_builtin: bool = False
    builtin_category: str | None = None  # 如："学科助教" / "教师备课" / "职业技能"

    @field_validator("description", mode="before")
    @classmethod
    def coerce_description(cls, v):
        """兼容数据库中 list 类型存储的 description。"""
        if isinstance(v, list):
            return " ".join(str(x) for x in v if x is not None)
        return v


class AgentMarketplacePage(BaseModel):
    """市场分页响应。"""
    items: list[AgentMarketplaceItem]
    total: int
    page: int
    page_size: int
