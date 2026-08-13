import json
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import Optional

from ..database import get_db
from ..models.user import User
from ..models.agent import Agent

logger = logging.getLogger(__name__)
from ..models.knowledge import KnowledgeFile, KnowledgeChunk
from ..schemas.agent import (
    AgentCreate,
    AgentUpdate,
    AgentResponse,
    AgentMarketplaceItem,
    AgentMarketplacePage,
)
from ..schemas.skill_file import MountSkillRequest, SkillFileResponse, SkillFileCreate
from ..services.agent import (
    get_agents_by_user,
    get_agent_by_id,
    get_marketplace_agents,
    create_agent,
    update_agent,
    publish_agent,
    download_agent,
    _parse_agent_config,
)
from ..services.skill_file import (
    mount_skill_to_agent,
    unmount_skill_from_agent,
    get_agent_skills,
    create_skill_file,
)
from ..utils.auth import get_current_user

router = APIRouter(prefix="/agents", tags=["agents"])


# ---------------------------------------------------------------------------
# 功能一：v2.1 智能生成 System Prompt（双模板 + 双用途 + LLM 动态生成）
# ---------------------------------------------------------------------------

class GeneratePromptRequest(BaseModel):
    template: str = "higher_edu"  # higher_edu | vocational
    role: str
    subject: str = ""
    audience: str = ""
    major: str = ""
    target_job: str = ""
    core_skills: str = ""
    certifications: str = ""
    training_scenarios: str = ""
    core_need: str
    style: Optional[str] = None  # None → 按 template 取默认值
    publish_scope: str = "students"  # students | teachers


class GeneratePromptResponse(BaseModel):
    prompt: str


class OptimizePromptRequest(BaseModel):
    current_prompt: str
    feedback: str


class OptimizePromptResponse(BaseModel):
    optimized_prompt: str


def _build_higher_edu_meta_prompt(req: GeneratePromptRequest) -> str:
    """高等教育模板 Meta-Prompt。"""
    audience_label = "教师（备课辅助）" if req.publish_scope == "teachers" else "学生（答疑学习）"
    capability_hint = (
        "→聚焦教案生成、课件制作、出题等备课辅助"
        if req.publish_scope == "teachers"
        else "→聚焦概念讲解、习题辅导、实验指导"
    )
    answer_rule = (
        "直接输出可用教学材料，结构化格式"
        if req.publish_scope == "teachers"
        else "以学生为中心，结合实例，引导思考不直接给答案"
    )
    return f"""你是一位资深的 AI 教学助手设计师。请根据以下信息，直接生成一个完整的 System Prompt（800-1200字），让 AI 能够扮演这位教师的角色。

## 教师信息
- 角色：{req.role}
- 学科/领域：{req.subject}
- 目标学生：{req.audience}
- 核心需求：{req.core_need}
- 教学风格：{req.style}
- 面向用户：{audience_label}

## 你的任务
直接输出一段完整的 System Prompt 文本（800-1200字），包含以下内容：

### 1. 身份声明
第一句明确说明："你是{req.role}的 AI 教学助手，专注于{req.subject}领域的教学。"

### 2. 教学风格
根据"{req.style}"设定语气和互动方式。

### 3. 核心能力
根据"{req.subject}"和"{req.core_need}"，列出 3-5 个 AI 应具备的核心能力。
{capability_hint}

### 4. 回答规范
- {answer_rule}
- 始终用清晰易懂的语言解释概念
- 结合具体例子和实际应用场景
- 使用 Markdown 格式化回答

### 5. 知识库使用指南
- 当学生提问时，优先检索知识库中的相关内容
- 在回答中标注信息来源（文件名）
- 如果知识库内容不足，结合专业知识补充，但要说明

### 6. 边界约束
- 不编造信息，不确定时诚实告知
- 对于超出{req.subject}范围的问题，建议咨询相关专家
- 使用中文回答

### 7. PPT 课件生成能力
你有能力生成可下载的PPT课件。当用户请求生成PPT时，先简要说明内容，再在回复末尾用```doc_gen```代码块包裹JSON：
```doc_gen
{{"type":"ppt","title":"课件标题","slides":[{{"title":"页标题","bullets":["要点1","要点2"],"notes":"讲师备注"}}]}}
```
要求：slides数组10-15页，每页3-5个要点，每个要点15-30字。

## 输出要求
直接输出完整的 System Prompt 文本，不要 JSON 包裹，不要添加任何解释性前言或后记。"""


def _build_vocational_meta_prompt(req: GeneratePromptRequest) -> str:
    """职业教育模板 Meta-Prompt。"""
    audience_label = "教师（备课辅助）" if req.publish_scope == "teachers" else "学生（技能学习）"
    answer_rule = (
        "直接输出教案/实训方案/考核标准，结构化格式"
        if req.publish_scope == "teachers"
        else "以岗位能力为导向，结合企业案例，引导动手实践"
    )
    return f"""你是一位资深的 AI 教学助手设计师。请根据以下信息，直接生成一个完整的 System Prompt（800-1200字），让 AI 能够扮演这位导师的角色。

## 导师信息
- 角色：{req.role}
- 专业方向：{req.major}
- 目标岗位：{req.target_job}
- 核心技能：{req.core_skills}
- 行业认证：{req.certifications or "无特定认证要求"}
- 实训场景：{req.training_scenarios or "按核心技能灵活设计"}
- 核心需求：{req.core_need}
- 教学风格：{req.style}
- 面向用户：{audience_label}

## 你的任务
直接输出一段完整的 System Prompt 文本（800-1200字），包含以下内容：

### 1. 身份声明
第一句明确说明："你是{req.role}的 AI 技能导师，专注于{req.target_job}方向的技能培训。"

### 2. 教学风格
根据"{req.style}"设定语气和互动方式，默认"实战导向"。

### 3. 核心能力
根据"{req.major}"、"{req.core_skills}"和"{req.core_need}"，列出 3-5 个 AI 应具备的核心能力，例如：
- 讲解 {req.core_skills} 的最佳实践与常见坑点
- 模拟 {req.training_scenarios or "典型岗位场景"} 的实训场景
- 针对 {req.target_job} 的考核面试指导
- 结合行业认证 {req.certifications or "相关标准"} 进行能力评估

### 4. 回答规范
- {answer_rule}
- 善用真实企业案例、岗位工作流进行说明
- 提供可操作的步骤、检查清单或评估标准
- 使用 Markdown 格式化回答

### 5. 知识库使用指南
- 当学生提问时，优先检索技能文档中的相关内容
- 在回答中标注信息来源（文件名）
- 如果知识库内容不足，结合行业经验补充，但要说明

### 6. 边界约束
- 不编造信息，不确定时诚实告知
- 对于超出"{req.target_job}"岗位范围的问题，建议咨询相关行业专家
- 使用中文回答

### 7. PPT 课件生成能力
你有能力生成可下载的PPT课件。当用户请求生成PPT时，先简要说明内容，再在回复末尾用```doc_gen```代码块包裹JSON：
```doc_gen
{{"type":"ppt","title":"课件标题","slides":[{{"title":"页标题","bullets":["要点1","要点2"],"notes":"讲师备注"}}]}}
```
要求：slides数组10-15页，每页3-5个要点，每个要点15-30字。

## 输出要求
直接输出完整的 System Prompt 文本，不要 JSON 包裹，不要添加任何解释性前言或后记。"""


@router.post("/generate-prompt", response_model=GeneratePromptResponse)
async def generate_prompt(
    request: GeneratePromptRequest,
    current_user: User = Depends(get_current_user),
):
    """v2.1：根据 template 选择 Meta-Prompt，调用 DeepSeek-V3.2 生成完整 System Prompt（纯文本）。"""
    from openai import AsyncOpenAI
    import httpx
    from ..config import settings

    if not settings.SILICONFLOW_API_KEY or settings.SILICONFLOW_API_KEY.startswith("sk-your"):
        raise HTTPException(status_code=500, detail="SILICONFLOW_API_KEY 未配置")

    # 校验 template
    if request.template not in ("higher_edu", "vocational"):
        raise HTTPException(status_code=400, detail="template 必须为 higher_edu 或 vocational")

    # 校验必填字段
    if request.template == "higher_edu":
        missing = [k for k in ("role", "subject", "audience", "core_need") if not getattr(request, k)]
        if missing:
            raise HTTPException(status_code=400, detail=f"高等教育模板缺少必填字段: {', '.join(missing)}")
        # 默认教学风格
        if not request.style:
            request.style = "专业严谨"
        meta_prompt = _build_higher_edu_meta_prompt(request)
    else:
        missing = [k for k in ("role", "major", "target_job", "core_skills", "core_need") if not getattr(request, k)]
        if missing:
            raise HTTPException(status_code=400, detail=f"职业教育模板缺少必填字段: {', '.join(missing)}")
        if not request.style:
            request.style = "实战导向"
        meta_prompt = _build_vocational_meta_prompt(request)

    client = AsyncOpenAI(
        api_key=settings.SILICONFLOW_API_KEY,
        base_url=settings.SILICONFLOW_BASE_URL,
        timeout=httpx.Timeout(180.0, connect=10.0),
    )
    try:
        response = await client.chat.completions.create(
            model=settings.CHAT_MODEL,
            messages=[{"role": "user", "content": meta_prompt}],
            temperature=0.7,
            max_tokens=4096,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM 调用失败: {str(e)[:200]}")

    prompt_text = (response.choices[0].message.content or "").strip()
    if not prompt_text:
        raise HTTPException(status_code=502, detail="LLM 返回空内容")

    return GeneratePromptResponse(prompt=prompt_text)


@router.post("/optimize-prompt", response_model=OptimizePromptResponse)
async def optimize_prompt(
    request: OptimizePromptRequest,
    current_user: User = Depends(get_current_user),
):
    """根据教师反馈迭代优化 System Prompt，返回 optimized_prompt。"""
    from openai import AsyncOpenAI
    import httpx
    from ..config import settings

    if not settings.SILICONFLOW_API_KEY or settings.SILICONFLOW_API_KEY.startswith("sk-your"):
        raise HTTPException(status_code=500, detail="SILICONFLOW_API_KEY 未配置")

    optimize_meta = f"""请根据以下反馈，优化这个 System Prompt。

## 当前 Prompt
{request.current_prompt}

## 优化要求
{request.feedback}

## 输出要求
直接输出优化后的完整 System Prompt，不要添加任何解释性前言或后记。"""

    client = AsyncOpenAI(
        api_key=settings.SILICONFLOW_API_KEY,
        base_url=settings.SILICONFLOW_BASE_URL,
        timeout=httpx.Timeout(180.0, connect=10.0),
    )
    try:
        response = await client.chat.completions.create(
            model=settings.CHAT_MODEL,
            messages=[{"role": "user", "content": optimize_meta}],
            temperature=0.7,
            max_tokens=4096,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM 调用失败: {str(e)[:200]}")

    prompt_text = (response.choices[0].message.content or "").strip()
    if not prompt_text:
        raise HTTPException(status_code=502, detail="LLM 返回空内容")

    return OptimizePromptResponse(optimized_prompt=prompt_text)


# ---------------------------------------------------------------------------
# v3.0 结构化配置生成（6 模块 JSON 输出 + 三级降级）
# ---------------------------------------------------------------------------

PPT_GENERATION_INSTRUCTION = (
    "当用户请求生成PPT时，先简要说明内容，再在回复末尾用```doc_gen```代码块包裹JSON：\n"
    "```doc_gen\n"
    '{"type":"ppt","title":"课件标题","slides":[{"title":"页标题","bullets":["要点1","要点2"],"notes":"讲师备注"}]}\n'
    "```\n"
    "要求：slides数组10-15页，每页3-5个要点，每个要点15-30字。"
)


class GenerateStructuredConfigRequest(BaseModel):
    template: str = "higher_edu"
    publish_scope: str = "students"
    role: str
    subject: str = ""
    course_name: str = ""
    audience_level: str = ""
    audience_detail: list[str] = []
    core_tasks: list[str] = []
    style: str = "专业严谨"
    student_pain_points: str = ""
    major: str = ""
    target_job: str = ""
    core_skills: str = ""


class GenerateStructuredConfigResponse(BaseModel):
    fallback: bool = False
    modules: dict
    system_prompt: str


class RegenerateModuleRequest(BaseModel):
    module_name: str
    template: str = "higher_edu"
    publish_scope: str = "students"
    role: str
    subject: str = ""
    course_name: str = ""
    audience_level: str = ""
    core_tasks: list[str] = []
    style: str = "专业严谨"
    student_pain_points: str = ""
    major: str = ""
    target_job: str = ""
    core_skills: str = ""
    current_modules: dict = {}


class RegenerateModuleResponse(BaseModel):
    module: dict
    system_prompt: str


_MODULE_NAMES = {
    "identity", "capabilities", "answer_rules",
    "student_diagnosis", "knowledge_strategy", "boundaries",
}


def _build_structured_meta_prompt(req: GenerateStructuredConfigRequest) -> str:
    """构建结构化 Meta-Prompt，要求 LLM 返回 6 模块 JSON。"""
    if req.publish_scope == "teachers":
        capability_focus = "教案生成、课件制作、出题等备课辅助"
        answer_rule = "直接输出可用教学材料，结构化格式"
    else:
        capability_focus = "概念讲解、习题辅导、实验指导"
        answer_rule = "以学生为中心，结合实例，引导思考不直接给答案"

    if req.template == "vocational":
        role_info = (
            f"- 角色：{req.role}\n- 专业方向：{req.major}\n"
            f"- 目标岗位：{req.target_job}\n- 核心技能：{req.core_skills}"
        )
        subject_label = req.major or req.target_job or "职业技能"
    else:
        role_info = (
            f"- 角色：{req.role}\n- 学科/领域：{req.subject}\n"
            f"- 课程名称：{req.course_name}\n- 目标学生：{req.audience_level}"
        )
        subject_label = req.subject or "学科"

    core_tasks_str = "、".join(req.core_tasks) if req.core_tasks else "概念讲解、习题辅导"
    audience_detail_str = "、".join(req.audience_detail) if req.audience_detail else ""
    pain_points = req.student_pain_points or "暂无明确痛点信息，请基于学科特点生成常见学生诊断"

    return f"""你是一位资深的 AI 教学助手设计师。请根据以下教师信息，生成结构化的 AI 助手配置（JSON 格式）。

## 教师信息
{role_info}
- 核心任务：{core_tasks_str}
- 教学风格：{req.style}
- 面向用户：{"教师（备课辅助）" if req.publish_scope == "teachers" else "学生（答疑学习）"}
{f"- 学生特点：{audience_detail_str}" if audience_detail_str else ""}

## 学生痛点信息
{pain_points}

## 输出要求
输出一个 JSON 对象，包含 "modules" 字段，下设 6 个子模块。各模块结构：

{{
  "modules": {{
    "identity": {{
      "title": "身份声明",
      "content": "第一句明确说明身份，如：你是{req.role}的 AI 教学助手，专注于{subject_label}领域的教学。"
    }},
    "capabilities": {{
      "title": "核心能力",
      "content": "概述 AI 助手的核心能力方向，聚焦{capability_focus}",
      "items": ["能力1", "能力2", "能力3"]
    }},
    "answer_rules": {{
      "title": "回答规范",
      "content": "概述回答风格",
      "rules": ["{answer_rule}", "使用清晰易懂的语言解释概念", "结合具体例子和实际应用场景", "使用 Markdown 格式化回答"]
    }},
    "student_diagnosis": {{
      "title": "学生诊断",
      "content": "基于学生痛点信息，描述常见学生问题和诊断思路",
      "diagnosis": {{
        "pain_points": [
          {{
            "topic": "{subject_label}",
            "surface_error": "学生的表面错误表现",
            "teacher_diagnosis": "教师的深层判断",
            "root_cause": "根本原因",
            "solution": "解决方法"
          }}
        ]
      }}
    }},
    "knowledge_strategy": {{
      "title": "知识库使用指南",
      "content": "描述如何使用知识库检索，优先检索知识库相关内容，在回答中标注信息来源"
    }},
    "boundaries": {{
      "title": "边界约束",
      "content": "不编造信息，不确定时诚实告知；超出范围建议咨询专家；使用中文回答"
    }}
  }}
}}

## 重要说明
1. 所有 content 字段必须是完整的中文文本
2. capabilities.items 数组包含 3-5 个核心能力
3. answer_rules.rules 数组包含 3-5 条回答规范
4. student_diagnosis.diagnosis.pain_points 数组包含 1-3 个学生痛点
5. 内容要具体、可操作，不要泛泛而谈
6. 直接输出 JSON，不要添加任何解释性前言或后记
7. PPT 课件生成能力不需要包含，系统会自动注入"""


def _parse_and_validate_modules(content: str) -> dict | None:
    """解析 JSON 并验证 6 模块结构。返回 modules 字典或 None。"""
    import json as _json

    try:
        data = _json.loads(content)
    except (ValueError, TypeError):
        return None

    # 兼容外层有/无 "modules" 包裹
    modules = data.get("modules") if isinstance(data, dict) else None
    if not modules and isinstance(data, dict):
        # 尝试直接作为 modules
        if all(k in data for k in ("identity", "boundaries")):
            modules = data
    if not isinstance(modules, dict):
        return None

    # 确保至少包含核心模块
    required = {"identity", "capabilities", "answer_rules", "knowledge_strategy", "boundaries"}
    if not required.issubset(modules.keys()):
        return None

    # 补全缺失模块
    if "student_diagnosis" not in modules:
        modules["student_diagnosis"] = {
            "title": "学生诊断",
            "content": "暂无学生诊断信息",
            "diagnosis": {"pain_points": []},
        }

    # 规范化每个模块的字段
    for name, mod in modules.items():
        if not isinstance(mod, dict):
            continue
        mod.setdefault("title", name)
        mod.setdefault("content", "")
        if name == "capabilities" and "items" not in mod:
            mod["items"] = []
        if name == "answer_rules" and "rules" not in mod:
            mod["rules"] = []
        if name == "student_diagnosis" and "diagnosis" not in mod:
            mod["diagnosis"] = {"pain_points": []}

    return modules


def _build_system_prompt_from_modules(modules: dict) -> str:
    """从 6 模块拼接完整 system prompt，自动注入 PPT 生成指令。"""
    parts: list[str] = []

    identity = modules.get("identity", {})
    if identity.get("content"):
        parts.append(identity["content"])

    capabilities = modules.get("capabilities", {})
    if capabilities.get("content"):
        parts.append(f"## 核心能力\n{capabilities['content']}")
    items = capabilities.get("items", [])
    if items:
        parts.append("具体能力：\n" + "\n".join(f"- {it}" for it in items))

    answer_rules = modules.get("answer_rules", {})
    if answer_rules.get("content"):
        parts.append(f"## 回答规范\n{answer_rules['content']}")
    rules = list(answer_rules.get("rules", []))
    # 自动注入 PPT 生成指令
    rules.append(PPT_GENERATION_INSTRUCTION)
    parts.append("回答规则：\n" + "\n".join(f"- {r}" for r in rules))

    diagnosis = modules.get("student_diagnosis", {})
    if diagnosis.get("content"):
        parts.append(f"## 学生诊断\n{diagnosis['content']}")
    diag_data = diagnosis.get("diagnosis", {})
    pain_points = diag_data.get("pain_points", []) if isinstance(diag_data, dict) else []
    if pain_points:
        pp_lines = []
        for pp in pain_points:
            if isinstance(pp, dict):
                pp_lines.append(
                    f"- 主题：{pp.get('topic', '')}；表现：{pp.get('surface_error', '')}；"
                    f"诊断：{pp.get('teacher_diagnosis', '')}；原因：{pp.get('root_cause', '')}；"
                    f"对策：{pp.get('solution', '')}"
                )
        if pp_lines:
            parts.append("常见学生痛点：\n" + "\n".join(pp_lines))

    knowledge = modules.get("knowledge_strategy", {})
    if knowledge.get("content"):
        parts.append(f"## 知识库使用指南\n{knowledge['content']}")

    boundaries = modules.get("boundaries", {})
    if boundaries.get("content"):
        parts.append(f"## 边界约束\n{boundaries['content']}")

    return "\n\n".join(parts)


def _build_fallback_prompt(req: GenerateStructuredConfigRequest) -> str:
    """第三级降级：纯文本 System Prompt 生成。"""
    subject_label = req.major or req.target_job or req.subject or "学科"
    role_label = req.role or "教师"
    if req.publish_scope == "teachers":
        answer_rule = "直接输出可用教学材料，结构化格式"
    else:
        answer_rule = "以学生为中心，结合实例，引导思考不直接给答案"
    pain_info = req.student_pain_points or "暂无明确痛点信息"

    return f"""请直接生成一个完整的 System Prompt（800-1200字），让 AI 扮演以下教师的角色。

## 教师信息
- 角色：{role_label}
- 学科/领域：{subject_label}
- 教学风格：{req.style}
- 学生痛点：{pain_info}

## 需包含
1. 身份声明
2. 核心能力（3-5个）
3. 回答规范（{answer_rule}）
4. 学生诊断（基于痛点信息）
5. 知识库使用指南
6. 边界约束
7. PPT 课件生成能力

## 输出要求
直接输出完整的 System Prompt 文本，不要 JSON 包裹，不要添加任何解释性前言或后记。"""


@router.post("/generate-structured-config", response_model=GenerateStructuredConfigResponse)
async def generate_structured_config(
    request: GenerateStructuredConfigRequest,
    current_user: User = Depends(get_current_user),
):
    """v3.0：生成结构化配置（6 模块 JSON），支持三级降级。"""
    from openai import AsyncOpenAI
    import httpx
    import re
    from ..config import settings

    if not settings.SILICONFLOW_API_KEY or settings.SILICONFLOW_API_KEY.startswith("sk-your"):
        raise HTTPException(status_code=500, detail="SILICONFLOW_API_KEY 未配置")

    # 校验 template
    if request.template not in ("higher_edu", "vocational"):
        raise HTTPException(status_code=400, detail="template 必须为 higher_edu 或 vocational")
    if not request.role:
        raise HTTPException(status_code=400, detail="role 为必填字段")

    meta_prompt = _build_structured_meta_prompt(request)

    client = AsyncOpenAI(
        api_key=settings.SILICONFLOW_API_KEY,
        base_url=settings.SILICONFLOW_BASE_URL,
        timeout=httpx.Timeout(180.0, connect=10.0),
    )

    # 第一级：JSON Mode + Schema 校验
    try:
        response = await client.chat.completions.create(
            model=settings.CHAT_MODEL,
            messages=[{"role": "user", "content": meta_prompt}],
            temperature=0.7,
            max_tokens=4096,
            response_format={"type": "json_object"},
        )
        content = (response.choices[0].message.content or "").strip()
        modules = _parse_and_validate_modules(content)
        if modules:
            system_prompt = _build_system_prompt_from_modules(modules)
            return GenerateStructuredConfigResponse(
                fallback=False,
                modules=modules,
                system_prompt=system_prompt,
            )
    except Exception as e:
        logger.warning(f"LLM JSON Mode 解析失败，降级到正则提取: {e}")

    # 第二级：正则提取 JSON 片段
    try:
        response = await client.chat.completions.create(
            model=settings.CHAT_MODEL,
            messages=[{"role": "user", "content": meta_prompt}],
            temperature=0.7,
            max_tokens=4096,
        )
        content = (response.choices[0].message.content or "").strip()
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            modules = _parse_and_validate_modules(json_match.group())
            if modules:
                system_prompt = _build_system_prompt_from_modules(modules)
                return GenerateStructuredConfigResponse(
                    fallback=False,
                    modules=modules,
                    system_prompt=system_prompt,
                )
    except Exception as e:
        logger.warning(f"LLM 正则提取失败，降级到纯文本: {e}")

    # 第三级：降级纯文本 Prompt
    fallback_prompt = _build_fallback_prompt(request)
    try:
        response = await client.chat.completions.create(
            model=settings.CHAT_MODEL,
            messages=[{"role": "user", "content": fallback_prompt}],
            temperature=0.7,
            max_tokens=4096,
        )
        prompt_text = (response.choices[0].message.content or "").strip()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM 调用失败: {str(e)[:200]}")

    if not prompt_text:
        raise HTTPException(status_code=502, detail="LLM 返回空内容")

    return GenerateStructuredConfigResponse(
        fallback=True,
        modules={"fallback": {"title": "降级模式", "content": prompt_text}},
        system_prompt=prompt_text,
    )


@router.post("/regenerate-module", response_model=RegenerateModuleResponse)
async def regenerate_module(
    request: RegenerateModuleRequest,
    current_user: User = Depends(get_current_user),
):
    """v3.0：局部重新生成某个模块。"""
    from openai import AsyncOpenAI
    import httpx
    import json as _json
    from ..config import settings

    if request.module_name not in _MODULE_NAMES:
        raise HTTPException(
            status_code=400,
            detail=f"module_name 必须为: {', '.join(sorted(_MODULE_NAMES))}",
        )

    if not settings.SILICONFLOW_API_KEY or settings.SILICONFLOW_API_KEY.startswith("sk-your"):
        raise HTTPException(status_code=500, detail="SILICONFLOW_API_KEY 未配置")

    module_name = request.module_name
    subject_label = request.major or request.target_job or request.subject or "学科"

    # 模块中文标题与生成指令
    module_titles = {
        "identity": "身份声明",
        "capabilities": "核心能力",
        "answer_rules": "回答规范",
        "student_diagnosis": "学生诊断",
        "knowledge_strategy": "知识库使用指南",
        "boundaries": "边界约束",
    }

    module_specific = {
        "identity": f'content 字段第一句明确说明身份，如"你是{request.role}的 AI 教学助手，专注于{subject_label}领域"。',
        "capabilities": "包含 content 概述 + items 数组（3-5个核心能力）。",
        "answer_rules": "包含 content 概述 + rules 数组（3-5条回答规范），不要包含 PPT 生成指令。",
        "student_diagnosis": "包含 content 概述 + diagnosis.pain_points 数组（1-3个痛点，含 topic/surface_error/teacher_diagnosis/root_cause/solution）。",
        "knowledge_strategy": "content 描述如何使用知识库检索。",
        "boundaries": "content 描述能力边界与约束。",
    }

    # 构建当前上下文摘要
    context_lines = [f"- 角色：{request.role}", f"- 学科：{subject_label}", f"- 风格：{request.style}"]
    if request.student_pain_points:
        context_lines.append(f"- 学生痛点：{request.student_pain_points}")
    current_module = request.current_modules.get(module_name, {})
    if current_module:
        context_lines.append(f"- 当前模块内容（供参考改进）：{_json.dumps(current_module, ensure_ascii=False)[:300]}")
    context_str = "\n".join(context_lines)

    # 预先计算 JSON 模板行（f-string 表达式中不能使用反斜杠）
    items_line = '"items": [...],' if module_name == "capabilities" else ""
    rules_line = '"rules": [...],' if module_name == "answer_rules" else ""
    diagnosis_line = '"diagnosis": {"pain_points": [...]}' if module_name == "student_diagnosis" else ""

    meta = f"""请重新生成 AI 教学助手配置中的「{module_titles[module_name]}」模块。

## 上下文
{context_str}

## 输出要求
输出一个 JSON 对象，仅包含 "{module_name}" 字段，结构如下：
{{
  "{module_name}": {{
    "title": "{module_titles[module_name]}",
    "content": "...",
    {items_line}
    {rules_line}
    {diagnosis_line}
  }}
}}

{module_specific[module_name]}

直接输出 JSON，不要添加任何解释性前言或后记。"""

    client = AsyncOpenAI(
        api_key=settings.SILICONFLOW_API_KEY,
        base_url=settings.SILICONFLOW_BASE_URL,
        timeout=httpx.Timeout(180.0, connect=10.0),
    )

    # 第一级：JSON Mode
    try:
        response = await client.chat.completions.create(
            model=settings.CHAT_MODEL,
            messages=[{"role": "user", "content": meta}],
            temperature=0.7,
            max_tokens=2048,
            response_format={"type": "json_object"},
        )
        content = (response.choices[0].message.content or "").strip()
        data = _json.loads(content)
        module = data.get(module_name) or data.get("modules", {}).get(module_name)
        if isinstance(module, dict):
            module.setdefault("title", module_titles[module_name])
            module.setdefault("content", "")
            # 合并到现有 modules 重建 system prompt
            merged = dict(request.current_modules) if request.current_modules else {}
            merged[module_name] = module
            system_prompt = _build_system_prompt_from_modules(merged)
            return RegenerateModuleResponse(module=module, system_prompt=system_prompt)
    except Exception as e:
        logger.warning(f"模块重生成 JSON Mode 失败，降级到正则提取: {e}")
    try:
        response = await client.chat.completions.create(
            model=settings.CHAT_MODEL,
            messages=[{"role": "user", "content": meta}],
            temperature=0.7,
            max_tokens=2048,
        )
        content = (response.choices[0].message.content or "").strip()
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            data = _json.loads(json_match.group())
            module = data.get(module_name) or data.get("modules", {}).get(module_name)
            if isinstance(module, dict):
                module.setdefault("title", module_titles[module_name])
                module.setdefault("content", "")
                merged = dict(request.current_modules) if request.current_modules else {}
                merged[module_name] = module
                system_prompt = _build_system_prompt_from_modules(merged)
                return RegenerateModuleResponse(module=module, system_prompt=system_prompt)
    except Exception as e:
        logger.warning(f"模块重生成正则提取失败: {e}")

    raise HTTPException(status_code=502, detail="模块重新生成失败，请稍后重试")


@router.get("/", response_model=list[AgentResponse])
def list_agents(
    status_filter: str | None = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_agents_by_user(db, user_id=current_user.id, status=status_filter)


@router.get("/stats")
def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """教师工作台统计：基于真实数据聚合。"""
    from ..models.conversation import Conversation

    agents = db.query(Agent).filter(Agent.user_id == current_user.id).all()
    total_agents = len(agents)
    published_count = sum(1 for s in agents if s.status == "published")
    draft_count = sum(1 for s in agents if s.status == "draft")

    # 统计该用户所有 agent 的对话总数
    total_conversations = 0
    if agent_ids := [s.id for s in agents]:
        convs = db.query(Conversation).filter(Conversation.agent_id.in_(agent_ids)).all()
        total_conversations = len(convs)

    return {
        "total_agents": total_agents,
        "published_count": published_count,
        "draft_count": draft_count,
        "total_conversations": total_conversations,
    }


@router.post("/", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
def create_agent_endpoint(
    agent: AgentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return create_agent(db, user_id=current_user.id, agent=agent)


# ---------------------------------------------------------------------------
# Marketplace (public browsing of published agents)
# 注意：/marketplace 系列路由必须声明在 /{agent_id} 之前，避免被路径参数捕获
# ---------------------------------------------------------------------------

@router.get("/marketplace", response_model=AgentMarketplacePage)
def list_marketplace(
    keyword: str | None = Query(None, description="按名称/课程名搜索"),
    template: str | None = Query(None, description="模板：higher_edu / vocational"),
    subject: str | None = Query(None, description="学科筛选"),
    sort: str = Query("newest", description="排序：newest / popular / name"),
    scope: str | None = Query(None, description="发布范围：students / teachers，不传则返回全部"),
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=60),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items, total = get_marketplace_agents(
        db,
        keyword=keyword,
        template=template,
        subject=subject,
        sort=sort,
        scope=scope,
        page=page,
        page_size=page_size,
    )
    return AgentMarketplacePage(items=items, total=total, page=page, page_size=page_size)


@router.get("/marketplace/subjects", response_model=list[str])
def list_marketplace_subjects(
    scope: str | None = Query(None, description="发布范围：students / teachers"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """返回市场中出现的所有学科（用于筛选下拉），可选按发布范围过滤。"""
    agents = db.query(Agent).filter(Agent.status == "published").all()
    subjects: list[str] = []
    seen: set[str] = set()
    for s in agents:
        config = _parse_agent_config(s.config)
        if scope:
            item_scope = config.get("publishScope") or "students"
            if scope == "students" and item_scope == "teachers":
                continue
            if scope == "teachers" and item_scope != "teachers":
                continue
        course_info = config.get("course_info", {}) if isinstance(config, dict) else {}
        subj = course_info.get("subject") or config.get("subject")
        if subj and subj not in seen:
            seen.add(subj)
            subjects.append(subj)
    return subjects


@router.get("/marketplace/{agent_id}", response_model=AgentMarketplaceItem)
def get_marketplace_agent(
    agent_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """市场详情：查看任意已发布 Agent（不限作者）。"""
    from ..models.conversation import Conversation
    from sqlalchemy import func

    row = (
        db.query(Agent, User, func.count(Conversation.id).label("usage_count"))
        .join(User, User.id == Agent.user_id)
        .outerjoin(Conversation, and_(Conversation.agent_id == Agent.id, Conversation.user_id == Agent.user_id))
        .filter(Agent.id == agent_id, Agent.status == "published")
        .group_by(Agent.id, User.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent 不存在或未发布")

    agent, user, usage_count = row
    raw_config = agent.config
    if isinstance(raw_config, str):
        config = json.loads(raw_config) if raw_config else {}
    elif isinstance(raw_config, dict):
        config = raw_config
    else:
        config = {}
    course_info = config.get("course_info", {}) if isinstance(config, dict) else {}
    item_subject = course_info.get("subject") or config.get("subject")

    from ..services.builtins import SYSTEM_USERNAME, BUILTIN_MARKER_KEY
    from ..services.agent import _BUILTIN_CATEGORY_MAP  # type: ignore
    is_builtin = (
        user.username == SYSTEM_USERNAME
        or (isinstance(config, dict) and bool(config.get(BUILTIN_MARKER_KEY)))
    )
    fingerprint = config.get("fingerprint") if isinstance(config, dict) else None
    builtin_category = _BUILTIN_CATEGORY_MAP.get(fingerprint) if is_builtin else None

    return AgentMarketplaceItem(
        id=agent.id,
        name=agent.name,
        course_name=agent.course_name,
        template=agent.template,
        description=config.get("description"),
        subject=item_subject,
        department=course_info.get("department") or user.department,
        grade_level=course_info.get("grade_level"),
        core_chapters=config.get("core_chapters", []) or [],
        teaching_tools=config.get("teaching_tools", []) or [],
        llm_model=config.get("llmModel"),
        version=agent.version,
        created_at=agent.created_at,
        updated_at=agent.updated_at,
        author_id=user.id,
        author_name=user.display_name or user.username,
        author_department=user.department,
        author_avatar=user.avatar_url,
        usage_count=int(usage_count or 0),
        rating=None,
        rating_count=0,
        config=config,
        is_builtin=is_builtin,
        builtin_category=builtin_category,
    )


@router.get("/{agent_id}", response_model=AgentResponse)
def get_agent(
    agent_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # 作者可查看自己的 Agent（任意状态）
    agent = get_agent_by_id(db, agent_id=agent_id, user_id=current_user.id)
    if agent is not None:
        return agent
    # 非作者可查看已发布的 Agent（学生端"开始学习"需要获取助手详情）
    agent = db.query(Agent).filter(Agent.id == agent_id, Agent.status == "published").first()
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return agent


@router.put("/{agent_id}", response_model=AgentResponse)
def update_agent_endpoint(
    agent_id: int,
    updates: AgentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    agent = get_agent_by_id(db, agent_id=agent_id, user_id=current_user.id)
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return update_agent(db, agent=agent, updates=updates)


@router.put("/{agent_id}/publish", response_model=AgentResponse)
def publish_agent_endpoint(
    agent_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    agent = get_agent_by_id(db, agent_id=agent_id, user_id=current_user.id)
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    try:
        return publish_agent(db, agent=agent)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{agent_id}/download", response_model=AgentResponse)
def download_agent_endpoint(
    agent_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """下载市场 Agent 副本到当前用户的 Agents。"""
    try:
        return download_agent(db, src_agent_id=agent_id, current_user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"下载失败: {e}")


# ---------------------------------------------------------------------------
# Agent 挂载技能文件 (AgentSkill)
# ---------------------------------------------------------------------------

@router.post("/{agent_id}/skills/mount", response_model=SkillFileResponse)
def mount_skill_endpoint(
    agent_id: int,
    request: MountSkillRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """挂载技能文件到 Agent。"""
    agent = get_agent_by_id(db, agent_id=agent_id, user_id=current_user.id)
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    try:
        mount_skill_to_agent(db, agent_id=agent_id, skill_file_id=request.skill_file_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    from ..services.skill_file import get_skill_file
    skill_file = get_skill_file(db, request.skill_file_id)
    if not skill_file:
        raise HTTPException(status_code=404, detail="SkillFile not found")
    return skill_file


@router.post("/{agent_id}/skills/unmount")
def unmount_skill_endpoint(
    agent_id: int,
    request: MountSkillRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """卸载 Agent 上的技能文件。"""
    agent = get_agent_by_id(db, agent_id=agent_id, user_id=current_user.id)
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    ok = unmount_skill_from_agent(db, agent_id=agent_id, skill_file_id=request.skill_file_id)
    if not ok:
        raise HTTPException(status_code=404, detail="该技能文件未挂载到此 Agent")
    return {"message": "卸载成功"}


@router.get("/{agent_id}/skills", response_model=list[SkillFileResponse])
def list_agent_skills(
    agent_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """获取 Agent 已挂载的技能文件列表。"""
    agent = get_agent_by_id(db, agent_id=agent_id, user_id=current_user.id)
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return get_agent_skills(db, agent_id=agent_id)


# ---------------------------------------------------------------------------
# 功能五：AI 生成 Word / PPT 课件（基于 Agent 的 systemPrompt + 知识库）
# ---------------------------------------------------------------------------

from fastapi.responses import FileResponse
import os

class GenerateCoursewareRequest(BaseModel):
    topic: str
    format: str = "word"  # word | ppt
    audience: str = ""
    requirements: str = ""


class ExportTeachingStrategyRequest(BaseModel):
    layers: list[str] = ["knowledge", "diagnosis", "strategy", "interaction", "feedback"]


@router.post("/{agent_id}/generate-courseware")
async def generate_courseware(
    agent_id: int,
    request: GenerateCoursewareRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """AI 生成 Word 教案或 PPT 课件：基于 Agent 的 systemPrompt + RAG 知识库检索 + LLM 生成。"""
    from ..services.courseware_generator import generate_courseware_file

    agent = get_agent_by_id(db, agent_id=agent_id, user_id=current_user.id)
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    config = agent.config if isinstance(agent.config, dict) else {}
    system_prompt = config.get("systemPrompt", "")
    user_name = current_user.display_name or current_user.username

    try:
        file_path = await generate_courseware_file(
            db=db,
            agent_id=agent.id,
            skill_name=agent.name,
            course_name=agent.course_name,
            system_prompt=system_prompt,
            topic=request.topic,
            audience=request.audience,
            requirements=request.requirements,
            format_type=request.format,
            user_name=user_name,
            config=config,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成课件失败: {str(e)}")

    if not os.path.exists(file_path):
        raise HTTPException(status_code=500, detail="生成课件文件失败")

    ext = "docx" if request.format == "word" else "pptx"
    media_type = (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        if request.format == "word"
        else "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    )
    # 使用纯 ASCII 文件名避免 HTTP 头编码问题
    import time
    filename = f'courseware_{int(time.time() * 1000) % 100000000}.{ext}'

    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=filename,
    )


# v3.0 层名映射
_LAYER_KEYS = {
    "knowledge": "knowledge_layer",
    "diagnosis": "diagnosis_layer",
    "strategy": "strategy_layer",
    "interaction": "interaction_layer",
    "feedback": "feedback_layer",
}

_LAYER_TITLES = {
    "knowledge": "L1 知识体系层",
    "diagnosis": "L2 学生诊断层",
    "strategy": "L3 教学策略层",
    "interaction": "L4 课堂交互层",
    "feedback": "L5 效果反馈层",
}


def _format_layer_content(layer_key: str, layer_data: dict) -> str:
    """将单层五层数据格式化为 Markdown 文本。"""
    title = _LAYER_TITLES.get(layer_key, layer_key)
    lines = [f"## {title}"]

    if layer_key == "knowledge":
        topics = layer_data.get("topics", [])
        for t in topics:
            if not isinstance(t, dict):
                continue
            lines.append(f"### 知识点：{t.get('name', '')}")
            if t.get("chapter"):
                lines.append(f"- 章节：{t['chapter']}")
            for cc in t.get("core_concepts", [])[:5]:
                if isinstance(cc, dict):
                    lines.append(f"- 核心概念：{cc.get('term', '')} — {cc.get('definition', '')}")
            if t.get("key_points"):
                lines.append(f"- 重点：{'、'.join(t['key_points'])}")
            for d in t.get("difficulties", [])[:3]:
                if isinstance(d, dict):
                    lines.append(f"- 难点：{d.get('point', '')}（原因：{d.get('reason', '')}）")
    elif layer_key == "diagnosis":
        for pp in layer_data.get("pain_points", []):
            if not isinstance(pp, dict):
                continue
            lines.append(f"### 诊断：{pp.get('topic', '')}")
            lines.append(f"- 学生表现：{pp.get('surface_error', '')}")
            lines.append(f"- 教师判断：{pp.get('teacher_diagnosis', '')}")
            lines.append(f"- 根本原因：{pp.get('root_cause', '')}")
            lines.append(f"- 解决方案：{pp.get('solution', '')}")
        for ep in layer_data.get("error_patterns", []):
            if isinstance(ep, dict):
                lines.append(f"### 错误模式：{ep.get('pattern', '')}")
                lines.append(f"- 频率：{ep.get('frequency', '')}")
                lines.append(f"- 纠正策略：{ep.get('correction_strategy', '')}")
    elif layer_key == "strategy":
        for s in layer_data.get("strategies", []):
            if not isinstance(s, dict):
                continue
            lines.append(f"### 教学策略：{s.get('goal', '')}")
            lines.append(f"- 方法：{s.get('method', '')}")
            lines.append(f"- 理由：{s.get('reasoning', '')}")
            steps = s.get("steps", [])
            if steps:
                lines.append("- 步骤：")
                for i, st in enumerate(steps, 1):
                    lines.append(f"  {i}. {st}")
            if s.get("suitable_for"):
                lines.append(f"- 适用：{'、'.join(s['suitable_for'])}")
    elif layer_key == "interaction":
        for qt in layer_data.get("question_templates", []):
            if isinstance(qt, dict):
                lines.append(f"### 提问模板：{qt.get('scenario', '')}")
                lines.append(f"- 话术：{qt.get('prompt', '')}")
                lines.append(f"- 目的：{qt.get('purpose', '')}")
        for gf in layer_data.get("guidance_flows", []):
            if isinstance(gf, dict):
                lines.append(f"### 引导流程：{gf.get('trigger', '')}")
                steps = gf.get("steps", [])
                if steps:
                    lines.append("- 步骤：")
                    for i, st in enumerate(steps, 1):
                        lines.append(f"  {i}. {st}")
    elif layer_key == "feedback":
        for fr in layer_data.get("feedback_records", []):
            if isinstance(fr, dict):
                lines.append(f"### 反馈记录：{fr.get('applied_in', '')}")
                lines.append(f"- 策略：{fr.get('strategy_ref', '')}")
                lines.append(f"- 学生反应：{fr.get('student_response', '')}")
                lines.append(f"- 效果：{fr.get('effectiveness', '')}")
                lines.append(f"- 优化：{fr.get('optimization', '')}")

    return "\n".join(lines) if len(lines) > 1 else f"## {title}\n（暂无数据）"


@router.post("/{agent_id}/export-teaching-strategy", response_model=SkillFileResponse)
def export_teaching_strategy(
    agent_id: int,
    request: ExportTeachingStrategyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """v3.0：导出五层经验为技能包（SkillFile），支持按层次选择性导出。"""
    agent = get_agent_by_id(db, agent_id=agent_id, user_id=current_user.id)
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    config = agent.config if isinstance(agent.config, dict) else {}
    five_layer = config.get("fiveLayerKnowledge") or config.get("five_layer_knowledge") or {}

    # 校验请求的层次
    valid_layers = [l for l in request.layers if l in _LAYER_KEYS]
    if not valid_layers:
        raise HTTPException(status_code=400, detail="layers 必须包含至少一个有效层次")

    # 构建导出内容
    content_parts = [
        f"# 教学经验技能包 — {agent.name}",
        f"\n> 来源助手：{agent.name}（{agent.course_name}）",
        f"> 导出层次：{('、'.join(_LAYER_TITLES[l] for l in valid_layers))}",
        f"> 导出时间：{__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
    ]

    has_data = False
    for layer_key in valid_layers:
        data_key = _LAYER_KEYS[layer_key]
        layer_data = five_layer.get(data_key, {}) if isinstance(five_layer, dict) else {}
        if layer_data:
            has_data = True
            content_parts.append(_format_layer_content(layer_key, layer_data))
            content_parts.append("")
        else:
            content_parts.append(f"## {_LAYER_TITLES[layer_key]}\n（暂无数据）\n")

    if not has_data:
        content_parts.append("> 注意：当前助手尚未沉淀教学经验数据。使用助手进行对话、上传教学资料后，五层经验会自动积累。")

    content = "\n".join(content_parts)

    skill_data = SkillFileCreate(
        name=f"{agent.name} - 教学经验",
        description=f"五层教学经验导出（{'、'.join(_LAYER_TITLES[l] for l in valid_layers)}）",
        content=content,
        source="teaching_strategy_export",
    )
    skill_file = create_skill_file(db, user_id=current_user.id, data=skill_data)
    return skill_file


# ==================== v3.0 被动积累机制 ====================


class AnalyzeCorrectionRequest(BaseModel):
    original_answer: str
    corrected_answer: str
    student_question: str = ""
    subject_label: str = ""


class ExtractKnowledgeRequest(BaseModel):
    file_ids: list[int] = []  # 为空则提取该 Agent 所有已处理文件


def _get_five_layer(config: dict) -> dict:
    """从 agent config 获取 fiveLayerKnowledge，初始化为空结构。"""
    five_layer = config.get("fiveLayerKnowledge") or {}
    if not isinstance(five_layer, dict):
        five_layer = {}
    # 确保五层结构存在
    for key in ("knowledge_layer", "diagnosis_layer", "strategy_layer",
                "interaction_layer", "feedback_layer"):
        if key not in five_layer:
            five_layer[key] = {}
    return five_layer


def _save_five_layer(db: Session, agent: Agent, five_layer: dict):
    """保存 fiveLayerKnowledge 到 agent config。"""
    from sqlalchemy.orm.attributes import flag_modified
    config = agent.config if isinstance(agent.config, dict) else {}
    config["fiveLayerKnowledge"] = five_layer
    agent.config = config
    flag_modified(agent, "config")
    db.commit()


@router.get("/{agent_id}/five-layer-knowledge")
def get_five_layer_knowledge(
    agent_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """v3.0：查看五层经验沉淀数据 + 统计概览。"""
    agent = get_agent_by_id(db, agent_id=agent_id, user_id=current_user.id)
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    config = agent.config if isinstance(agent.config, dict) else {}
    five_layer = _get_five_layer(config)

    # 统计每层条目数
    stats = {}
    layer_counts = {
        "knowledge_layer": "topics",
        "diagnosis_layer": "pain_points",
        "strategy_layer": "strategies",
        "interaction_layer": "question_templates",
        "feedback_layer": "feedback_records",
    }
    for layer_key, count_field in layer_counts.items():
        layer_data = five_layer.get(layer_key, {})
        items = layer_data.get(count_field, []) if isinstance(layer_data, dict) else []
        stats[layer_key] = len(items) if isinstance(items, list) else 0

    return {"five_layer": five_layer, "stats": stats}


@router.post("/{agent_id}/extract-knowledge")
async def extract_knowledge(
    agent_id: int,
    request: ExtractKnowledgeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """v3.0 机制一：从已上传文件提取知识点到 L1 知识体系层。"""
    from ..services.knowledge_extractor import extract_knowledge_from_text, merge_knowledge_layer

    agent = get_agent_by_id(db, agent_id=agent_id, user_id=current_user.id)
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    # 获取要处理的文件
    query = db.query(KnowledgeFile).filter(
        KnowledgeFile.agent_id == agent_id,
        KnowledgeFile.status == "done",
    )
    if request.file_ids:
        query = query.filter(KnowledgeFile.id.in_(request.file_ids))
    files = query.all()

    if not files:
        raise HTTPException(status_code=400, detail="没有可提取的已处理文件")

    config = agent.config if isinstance(agent.config, dict) else {}
    five_layer = _get_five_layer(config)
    knowledge_layer = five_layer.get("knowledge_layer", {})
    extracted_count = 0

    for kf in files:
        # 从 KnowledgeChunk 表重建文档文本
        chunks = (
            db.query(KnowledgeChunk)
            .filter(KnowledgeChunk.file_id == kf.id)
            .order_by(KnowledgeChunk.chunk_index)
            .all()
        )
        if not chunks:
            continue
        doc_text = "\n\n".join(c.content for c in chunks if c.content)
        if len(doc_text) < 50:
            continue

        try:
            new_data = await extract_knowledge_from_text(
                db=db, agent_id=agent_id, filename=kf.filename, document_text=doc_text,
            )
            if new_data.get("topics"):
                knowledge_layer = merge_knowledge_layer(knowledge_layer, new_data)
                extracted_count += len(new_data["topics"])
        except Exception:
            continue

    five_layer["knowledge_layer"] = knowledge_layer
    _save_five_layer(db, agent, five_layer)

    return {
        "message": f"已从 {len(files)} 个文件提取 {extracted_count} 个知识点",
        "extracted_count": extracted_count,
        "file_count": len(files),
        "knowledge_layer": knowledge_layer,
    }


@router.post("/{agent_id}/analyze-correction")
async def analyze_correction(
    agent_id: int,
    request: AnalyzeCorrectionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """v3.0 机制二：分析教师对 AI 回答的纠正，提取 L2 诊断 + L3 策略。"""
    from ..services.correction_analyzer import analyze_correction as do_analyze, merge_correction_results

    agent = get_agent_by_id(db, agent_id=agent_id, user_id=current_user.id)
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    analysis = await do_analyze(
        original_answer=request.original_answer,
        corrected_answer=request.corrected_answer,
        student_question=request.student_question,
        subject_label=request.subject_label,
    )

    config = agent.config if isinstance(agent.config, dict) else {}
    five_layer = _get_five_layer(config)
    five_layer = merge_correction_results(five_layer, analysis)
    _save_five_layer(db, agent, five_layer)

    diagnosis_count = len(analysis.get("diagnosis", {}).get("pain_points", []))
    strategy_count = len(analysis.get("strategy", {}).get("strategies", []))

    return {
        "message": f"已提取 {diagnosis_count} 条诊断 + {strategy_count} 条策略",
        "diagnosis_count": diagnosis_count,
        "strategy_count": strategy_count,
        "analysis": analysis,
    }


@router.delete("/{agent_id}/five-layer-knowledge/{layer}/{index}")
def delete_five_layer_entry(
    agent_id: int,
    layer: str,
    index: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """v3.0：删除五层经验中某层的指定条目（教师可审核删除质量不高的提取结果）。"""
    agent = get_agent_by_id(db, agent_id=agent_id, user_id=current_user.id)
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    # 层名 → 数据键 + 列表字段
    layer_map = {
        "knowledge": ("knowledge_layer", "topics"),
        "diagnosis": ("diagnosis_layer", "pain_points"),
        "strategy": ("strategy_layer", "strategies"),
        "interaction": ("interaction_layer", "question_templates"),
        "feedback": ("feedback_layer", "feedback_records"),
    }
    if layer not in layer_map:
        raise HTTPException(status_code=400, detail=f"layer 必须为: {', '.join(layer_map.keys())}")

    data_key, list_field = layer_map[layer]
    config = agent.config if isinstance(agent.config, dict) else {}
    five_layer = _get_five_layer(config)
    layer_data = five_layer.get(data_key, {})
    if not isinstance(layer_data, dict):
        layer_data = {}
    items = layer_data.get(list_field, [])
    if not isinstance(items, list) or index < 0 or index >= len(items):
        raise HTTPException(status_code=404, detail="条目不存在")

    items.pop(index)
    layer_data[list_field] = items
    five_layer[data_key] = layer_data
    _save_five_layer(db, agent, five_layer)

    return {"message": "已删除", "remaining_count": len(items)}


# ---------------------------------------------------------------------------
# 师生问答沉淀：教师端待答疑池（学生疑问 → 教师解答 → 沉淀经验）
# ---------------------------------------------------------------------------

class QuestionItem(BaseModel):
    id: int
    agent_id: int
    student_id: int
    student_name: Optional[str] = None
    conversation_id: Optional[int] = None
    question: str
    ai_answer: Optional[str] = None
    teacher_reply: Optional[str] = None
    pain_point: Optional[str] = None
    subject: Optional[str] = None
    status: str
    created_at: Optional[str] = None
    answered_at: Optional[str] = None

    class Config:
        from_attributes = True


class AnswerQuestionRequest(BaseModel):
    reply: str


@router.get("/{agent_id}/questions")
def list_agent_questions(
    agent_id: int,
    status: Optional[str] = Query(None, description="open / answered"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """v4.1 教师待答疑池：查看自己助手下学生发布的疑问（可分 status 筛选）。"""
    agent = get_agent_by_id(db, agent_id=agent_id, user_id=current_user.id)
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    from ..models.student import QuestionRecord
    from ..models.user import User as UserModel

    query = db.query(QuestionRecord).filter(QuestionRecord.agent_id == agent_id)
    if status:
        query = query.filter(QuestionRecord.status == status)
    records = query.order_by(QuestionRecord.created_at.desc()).limit(200).all()

    student_ids = {r.student_id for r in records}
    name_map = {}
    if student_ids:
        users = db.query(UserModel).filter(UserModel.id.in_(student_ids)).all()
        name_map = {u.id: (u.display_name or u.username) for u in users}

    items = []
    for r in records:
        items.append(QuestionItem(
            id=r.id,
            agent_id=r.agent_id,
            student_id=r.student_id,
            student_name=name_map.get(r.student_id),
            conversation_id=r.conversation_id,
            question=r.question,
            ai_answer=r.ai_answer,
            teacher_reply=r.teacher_reply,
            pain_point=r.pain_point,
            subject=r.subject,
            status=r.status,
            created_at=r.created_at.isoformat() if r.created_at else None,
            answered_at=r.answered_at.isoformat() if r.answered_at else None,
        ))
    return {"items": items, "total": len(items)}


@router.post("/{agent_id}/questions/{question_id}/answer")
async def answer_question(
    agent_id: int,
    question_id: int,
    request: AnswerQuestionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """v4.1 教师解答学生疑问：写入 teacher_reply → 触发经验沉淀（后台异步）。

    这是师生问答沉淀的核心：教师对真实学生疑问给出针对性解答，
    后台从「学生问题 + 教师解答」问答对中提取教学经验，注入到五层知识。
    """
    from datetime import datetime, timezone as _tz
    from ..models.student import QuestionRecord

    agent = get_agent_by_id(db, agent_id=agent_id, user_id=current_user.id)
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")

    record = (
        db.query(QuestionRecord)
        .filter(QuestionRecord.id == question_id, QuestionRecord.agent_id == agent_id)
        .first()
    )
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="疑问不存在")

    if not request.reply or not request.reply.strip():
        raise HTTPException(status_code=400, detail="解答内容不能为空")

    record.teacher_reply = request.reply.strip()
    record.status = "answered"
    record.answered_at = datetime.now(_tz.utc)
    db.commit()

    # 后台异步：从问答对提取经验并沉淀到五层知识
    import threading
    _agent_id = agent_id
    _q = record.question
    _reply = request.reply.strip()
    thread = threading.Thread(
        target=_qa_deposit_task,
        args=(_agent_id, current_user.id, _q, _reply),
        daemon=True,
    )
    thread.start()

    return {
        "message": "已提交解答，后台正在沉淀教学经验",
        "question_id": question_id,
        "status": "answered",
    }


def _qa_deposit_task(agent_id: int, teacher_id: int, student_question: str, teacher_reply: str):
    """后台线程：从师生问答对提取教学经验并写入 fiveLayerKnowledge。"""
    from ..database import SessionLocal
    from ..services.experience_extractor import (
        extract_experience_from_qa,
        merge_experience_into_five_layer,
    )
    import asyncio
    import logging as _logging
    from sqlalchemy.orm.attributes import flag_modified

    _logger = _logging.getLogger(__name__)
    db = SessionLocal()
    try:
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        if agent is None:
            return

        experience = asyncio.run(
            extract_experience_from_qa(
                db=db,
                agent=agent,
                student_question=student_question,
                teacher_reply=teacher_reply,
            )
        )
        if not experience:
            _logger.info(f"问答沉淀：未提取到有价值经验（agent={agent_id}）")
            return

        config = agent.config
        if isinstance(config, str):
            config = json.loads(config) if config else {}
        if not isinstance(config, dict):
            config = {}
        five_layer = config.get("fiveLayerKnowledge") or {}
        if not isinstance(five_layer, dict):
            five_layer = {}

        five_layer = merge_experience_into_five_layer(
            five_layer, experience, source="qa"
        )
        config["fiveLayerKnowledge"] = five_layer
        agent.config = config
        flag_modified(agent, "config")
        db.commit()

        diag = len(experience.get("diagnosis", {}).get("pain_points", []))
        strat = len(experience.get("strategy", {}).get("strategies", []))
        inter = len(experience.get("interaction", {}).get("question_templates", []))
        fb = len(experience.get("feedback", {}).get("feedback_records", []))
        _logger.info(f"【问答沉淀】教师 {teacher_id} 解答学生疑问，沉淀 诊断{diag} 策略{strat} 交互{inter} 反馈{fb}")
    except Exception as e:
        import traceback as _tb
        _logger.warning(f"问答沉淀失败: {e}\n{''.join(_tb.format_exception(type(e), e, e.__traceback__))}")
    finally:
        db.close()
