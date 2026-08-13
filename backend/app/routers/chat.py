import json
import re
import logging
import threading
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from ..database import get_db, SessionLocal
from ..models.user import User
from ..models.agent import Agent
from ..models.conversation import Conversation
from ..models.message import Message
from ..models.student import LearningRecord, MistakeRecord, StudentAgent, QuestionRecord
from ..utils.auth import get_current_user
from ..services.rag import (
    retrieve_for_rag,
    build_context,
    generate_answer,
    stream_llm_answer,
)
from ..services.skill_file import get_agent_skills
from ..services.document_generator import extract_and_generate_ppt

router = APIRouter(prefix="/agents", tags=["chat"])

logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[int] = None


def _get_or_create_conversation(
    db: Session,
    user_id: int,
    agent_id: int,
    conversation_id: Optional[int] = None,
) -> Conversation:
    if conversation_id:
        conv = db.query(Conversation).filter(
            Conversation.id == conversation_id,
            Conversation.user_id == user_id,
        ).first()
        if conv:
            return conv

    conv = Conversation(
        agent_id=agent_id,
        user_id=user_id,
        title="新对话",
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def _save_messages(
    db: Session,
    conversation_id: int,
    user_message: str,
    assistant_message: str,
    sources: list,
) -> int:
    user_msg = Message(
        conversation_id=conversation_id,
        role="user",
        content=user_message,
    )
    assistant_msg = Message(
        conversation_id=conversation_id,
        role="assistant",
        content=assistant_message,
        sources=sources,
    )
    db.add(user_msg)
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if conv and conv.title == "新对话":
        title = user_message[:20] + ("..." if len(user_message) > 20 else "")
        conv.title = title
        db.commit()

    return assistant_msg.id


def _build_system_prompt(db: Session, agent: Agent, base_prompt: str) -> str:
    """构建 system_prompt：Agent 的 systemPrompt + 五层经验知识 + 已挂载的所有 SkillFile content。"""
    parts: list[str] = []
    if base_prompt:
        parts.append(base_prompt)

    # v4.0 注入五层经验知识（教师沉淀的教学经验）
    try:
        config = agent.config
        if isinstance(config, str):
            config = json.loads(config) if config else {}
        if isinstance(config, dict):
            five_layer = config.get("fiveLayerKnowledge") or {}
            if isinstance(five_layer, dict) and five_layer:
                from ..services.experience_extractor import build_five_layer_prompt_section
                experience_section = build_five_layer_prompt_section(five_layer)
                if experience_section:
                    parts.append(experience_section)
    except Exception as e:
        logger.warning(f"装载五层经验知识失败: {e}")

    try:
        skill_files = get_agent_skills(db, agent_id=agent.id)
        if skill_files:
            skill_section_parts = []
            for sf in skill_files:
                if sf.content:
                    skill_section_parts.append(
                        f"# 技能文件：{sf.name}\n{sf.content}"
                    )
            if skill_section_parts:
                parts.append(
                    "\n\n## 以下是挂载到当前 Agent 的技能文件内容，请严格遵循：\n\n"
                    + "\n\n---\n\n".join(skill_section_parts)
                )
    except Exception as e:
        logger.warning(f"装载 SkillFile 失败: {e}")

    return "\n\n".join(parts) if parts else "你是一位经验丰富的教师助手。"


# ---------------------------------------------------------------------------
# v4.0 学生端对话增强：学习记录 + 错题检测（后台线程，不阻塞响应）
# ---------------------------------------------------------------------------

def _record_learning_activity(
    db: Session,
    student_id: int,
    agent_id: int,
    conversation_id: int,
    activity_type: str = "chat",
    duration_seconds: int = 0,
):
    """写入学习记录，并更新 StudentAgent.last_accessed_at。"""
    record = LearningRecord(
        student_id=student_id,
        agent_id=agent_id,
        conversation_id=conversation_id,
        activity_type=activity_type,
        duration_seconds=duration_seconds,
    )
    db.add(record)

    # 更新 StudentAgent 的最近访问时间
    sa = db.query(StudentAgent).filter(
        StudentAgent.student_id == student_id,
        StudentAgent.agent_id == agent_id,
    ).first()
    if sa:
        sa.last_accessed_at = datetime.utcnow()

    db.commit()


def _detect_and_record_mistakes(
    db: Session,
    student_id: int,
    agent_id: int,
    conversation_id: int,
    user_message: str,
    assistant_answer: str,
    agent_config: dict,
):
    """调用 LLM 分析学生提问，检测是否包含知识错误，写入 MistakeRecord。"""
    from openai import AsyncOpenAI
    import httpx
    import asyncio
    from ..config import settings

    if not settings.SILICONFLOW_API_KEY or settings.SILICONFLOW_API_KEY.startswith("sk-your"):
        return

    subject = agent_config.get("subject", "") or agent_config.get("course_name", "")

    prompt = f"""请分析以下学生与 AI 辅导的对话，判断学生的提问是否暴露了知识错误或误解。

## 学生提问
{user_message[:500]}

## AI 回答
{assistant_answer[:1000]}

## 输出要求
输出一个 JSON 对象，格式如下：
{{
  "has_mistake": true/false,
  "mistakes": [
    {{
      "question": "学生的问题或错误表述",
      "student_answer": "学生的错误答案或理解（如能从提问中推断）",
      "correct_answer": "正确的答案或理解",
      "explanation": "为什么学生错了，如何纠正",
      "error_type": "概念错误|计算错误|审题错误|思路错误",
      "knowledge_point": "涉及的知识点",
      "subject": "{subject}"
    }}
  ]
}}

判断标准：
- 仅当学生明确表现出对概念的误解、计算错误、或思路偏差时才标记 has_mistake=true
- 学生只是提问而不清楚答案，不算错误
- 最多提取 1 个最明显的错误
- 如果无法判断，返回 has_mistake=false

直接输出 JSON，不要添加任何解释。"""

    client = AsyncOpenAI(
        api_key=settings.SILICONFLOW_API_KEY,
        base_url=settings.SILICONFLOW_BASE_URL,
        timeout=httpx.Timeout(30.0, connect=10.0),
    )

    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        response = loop.run_until_complete(
            client.chat.completions.create(
                model=settings.CHAT_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=1024,
            )
        )
        loop.close()
    except Exception as e:
        logger.warning(f"错题检测 LLM 调用失败: {e}")
        return

    raw = (response.choices[0].message.content or "").strip()
    # 提取 JSON
    try:
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0].strip()
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0].strip()
        result = json.loads(raw)
    except (json.JSONDecodeError, IndexError):
        logger.warning(f"错题检测 JSON 解析失败: {raw[:200]}")
        return

    if not result.get("has_mistake"):
        return

    for m in result.get("mistakes", []):
        mistake = MistakeRecord(
            student_id=student_id,
            agent_id=agent_id,
            conversation_id=conversation_id,
            subject=m.get("subject", subject) or "",
            knowledge_point=m.get("knowledge_point", ""),
            question=m.get("question", user_message[:200]),
            student_answer=m.get("student_answer", ""),
            correct_answer=m.get("correct_answer", ""),
            explanation=m.get("explanation", ""),
            error_type=m.get("error_type", "概念错误"),
            difficulty="medium",
        )
        db.add(mistake)

    db.commit()
    logger.info(f"学生 {student_id} 检测到 {len(result.get('mistakes', []))} 个错题")


def _detect_and_record_question(
    db: Session,
    student_id: int,
    agent_id: int,
    conversation_id: int,
    user_message: str,
    assistant_answer: str,
    agent_config: dict,
):
    """检测学生提问是否为"疑问/困惑"，若是则写入 QuestionRecord（待答疑池）。

    这是经验沉淀的触发源：学生真实提问暴露痛点 → 写入待答疑池 → 教师解答 → 沉淀经验。
    仅当提问达到一定长度且 LLM 判定为学习困惑时才入库，避免刷屏。
    """
    from openai import AsyncOpenAI
    import httpx
    import asyncio
    from ..config import settings

    # 过短的提问（闲聊/问候）不进入待答疑池
    if len(user_message) < 12:
        return

    if not settings.SILICONFLOW_API_KEY or settings.SILICONFLOW_API_KEY.startswith("sk-your"):
        return

    subject = agent_config.get("subject", "") or agent_config.get("course_name", "")

    prompt = f"""请分析以下学生与 AI 辅导的对话，判断学生的提问是否暴露了学习困惑或痛点（需要教师介入解答）。
不判断对错，只判断是否"困惑/卡壳/经常出错/理解不了"。

## 学生提问
{user_message[:500]}

## AI 回答
{assistant_answer[:600]}

## 输出要求
输出 JSON 对象，格式如下：
{{
  "has_confusion": true/false,
  "pain_point": "一句话概括学生的困惑/痛点；若无则空字符串"
}}

判断标准：
- true：学生明确表达困惑（如"搞不清、分不清、总出错、老是漏、不会做、理解不了、经常丢分"等）
- false：学生只是常规提问、请求讲解、或表达感谢，没有明显困惑
- 直接输出 JSON，不要添加任何解释。"""

    client = AsyncOpenAI(
        api_key=settings.SILICONFLOW_API_KEY,
        base_url=settings.SILICONFLOW_BASE_URL,
        timeout=httpx.Timeout(30.0, connect=10.0),
    )

    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        response = loop.run_until_complete(
            client.chat.completions.create(
                model=settings.CHAT_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=256,
            )
        )
        loop.close()
    except Exception as e:
        logger.warning(f"疑问检测 LLM 调用失败: {e}")
        return

    raw = (response.choices[0].message.content or "").strip()
    try:
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0].strip()
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0].strip()
        result = json.loads(raw)
    except (json.JSONDecodeError, IndexError):
        logger.warning(f"疑问检测 JSON 解析失败: {raw[:200]}")
        return

    if not result.get("has_confusion"):
        return

    # 避免重复：同一学生同一 agent 已有未解答的同主题疑问则不重复入库
    existing = (
        db.query(QuestionRecord)
        .filter(
            QuestionRecord.student_id == student_id,
            QuestionRecord.agent_id == agent_id,
            QuestionRecord.status == "open",
        )
        .all()
    )
    pain_point = (result.get("pain_point") or "").strip()
    for rec in existing:
        if rec.question and pain_point and rec.question[:20] == user_message[:20]:
            return

    record = QuestionRecord(
        student_id=student_id,
        agent_id=agent_id,
        conversation_id=conversation_id,
        question=user_message,
        ai_answer=assistant_answer,
        pain_point=pain_point or None,
        subject=subject or None,
        status="open",
    )
    db.add(record)
    db.commit()
    logger.info(f"学生 {student_id} 疑问已进入待答疑池（agent={agent_id}）: {pain_point[:30]}")


def _student_post_chat_tasks(
    student_id: int,
    agent_id: int,
    conversation_id: int,
    user_message: str,
    assistant_answer: str,
    agent_config: dict,
):
    """学生端对话后后台任务：记录学习行为 + 错题检测 + 疑问入库（独立 DB session）。"""
    db = SessionLocal()
    try:
        # 1. 写入学习记录
        _record_learning_activity(
            db=db,
            student_id=student_id,
            agent_id=agent_id,
            conversation_id=conversation_id,
            activity_type="chat",
        )

        # 2. 错题检测（仅分析较短的消息，避免过长文本）
        if len(user_message) > 10:
            _detect_and_record_mistakes(
                db=db,
                student_id=student_id,
                agent_id=agent_id,
                conversation_id=conversation_id,
                user_message=user_message,
                assistant_answer=assistant_answer,
                agent_config=agent_config,
            )

        # 3. 疑问检测 → 写入待答疑池（经验沉淀触发源）
        _detect_and_record_question(
            db=db,
            student_id=student_id,
            agent_id=agent_id,
            conversation_id=conversation_id,
            user_message=user_message,
            assistant_answer=assistant_answer,
            agent_config=agent_config,
        )
    except Exception as e:
        logger.warning(f"学生端后台任务失败: {e}")
    finally:
        db.close()


# ---------------------------------------------------------------------------
# v4.0 教师端对话增强：自动提取教学经验（后台线程，不阻塞响应）
# ---------------------------------------------------------------------------

def _teacher_post_chat_tasks(
    teacher_id: int,
    agent_id: int,
    conversation_id: int,
    user_message: str,
    assistant_answer: str,
):
    """教师端对话后后台任务：自动分析对话，提取教学经验沉淀到五层知识（独立 DB session）。"""
    db = SessionLocal()
    try:
        agent = db.query(Agent).filter(Agent.id == agent_id).first()
        if agent is None or agent.user_id != teacher_id:
            return

        # 仅分析有一定长度的对话（太短的对话价值不大）
        if len(user_message) < 15:
            return

        from ..services.experience_extractor import (
            extract_experience_from_conversation,
            merge_experience_into_five_layer,
        )
        import asyncio

        experience = asyncio.run(
            extract_experience_from_conversation(
                db=db,
                agent=agent,
                conversation_id=conversation_id,
                user_message=user_message,
                assistant_answer=assistant_answer,
            )
        )

        if not experience:
            return

        # 合并到五层知识
        config = agent.config
        if isinstance(config, str):
            config = json.loads(config) if config else {}
        if not isinstance(config, dict):
            config = {}

        five_layer = config.get("fiveLayerKnowledge") or {}
        if not isinstance(five_layer, dict):
            five_layer = {}

        five_layer = merge_experience_into_five_layer(
            five_layer, experience, source="conversation"
        )

        config["fiveLayerKnowledge"] = five_layer
        # SQLAlchemy JSON 列对原地修改不感知，必须用 flag_modified 显式标记
        from sqlalchemy.orm.attributes import flag_modified
        agent.config = config
        flag_modified(agent, "config")
        db.commit()

        # 统计提取数量
        diag_count = len(experience.get("diagnosis", {}).get("pain_points", []))
        strat_count = len(experience.get("strategy", {}).get("strategies", []))
        inter_count = len(experience.get("interaction", {}).get("question_templates", []))
        fb_count = len(experience.get("feedback", {}).get("feedback_records", []))
        total = diag_count + strat_count + inter_count + fb_count
        logger.info(f"教师 {teacher_id} 对话提取经验：诊断{diag_count} 策略{strat_count} 交互{inter_count} 反馈{fb_count}（共{total}条）")

    except Exception as e:
        import traceback as _tb
        logger.warning(f"教师端经验提取失败: {e}\n{''.join(_tb.format_exception(type(e), e, e.__traceback__))}")
    finally:
        db.close()


@router.post("/{agent_id}/chat")
def chat_stream(
    agent_id: int,
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    agent = db.query(Agent).filter(Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    # 作者可访问任意状态；非作者仅能访问已发布
    if agent.user_id != current_user.id and agent.status != "published":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="该 Agent 未发布，暂不可对话")

    # 安全快照：把 ORM 对象需要用于后台线程/生成器的属性提前转为原始类型，
    # 避免生成器异步迭代时原始 DB Session 已关闭导致 "Instance not bound to Session"。
    _user_id: int = int(current_user.id)
    _user_role: str = str(current_user.role or "")
    _agent_owner_id: int = int(agent.user_id)
    _is_teacher_owner: bool = (_user_role == "teacher" and _agent_owner_id == _user_id)
    _is_student: bool = (_user_role == "student")

    raw_config = agent.config
    if isinstance(raw_config, str):
        config = json.loads(raw_config) if raw_config else {}
    elif isinstance(raw_config, dict):
        config = raw_config
    else:
        config = {}
    base_system_prompt = config.get("systemPrompt", "你是一位经验丰富的教师助手。")
    # 关键：将 Agent 已挂载的 SkillFile 内容拼接到 systemPrompt 之后
    system_prompt = _build_system_prompt(db, agent, base_system_prompt)
    top_k = config.get("topK", 5)
    similarity_threshold = config.get("similarityThreshold", 0.45)
    llm_model = config.get("llmModel")

    # 1. Vector retrieval via Chroma（始终用作者的知识库检索）
    retrieved = retrieve_for_rag(
        db=db,
        user_id=agent.user_id,
        agent_id=agent_id,
        query=request.message,
        top_k=top_k,
        similarity_threshold=similarity_threshold,
    )

    context = build_context(retrieved)

    sources = [
        {
            "file": chunk["filename"],
            "chunk": chunk["chunk_index"],
            "similarity": chunk["similarity"],
        }
        for chunk in retrieved
    ]

    conversation = _get_or_create_conversation(
        db, _user_id, agent_id, request.conversation_id
    )
    _conversation_id: int = int(conversation.id)

    sources_data = json.dumps(sources, ensure_ascii=False)

    def event_stream():
        # 生成器在请求上下文退出后仍可能被迭代，必须使用独立 DB session。
        stream_db = SessionLocal()
        try:
            # Push sources first
            yield f"event: sources\ndata: {sources_data}\n\n"

            # Stream LLM tokens directly from the LLM API
            full_answer = ""
            try:
                for token in stream_llm_answer(
                    system_prompt=system_prompt,
                    context=context,
                    query=request.message,
                    retrieved_chunks=retrieved,
                    model=llm_model,
                ):
                    full_answer += token
                    token_json = json.dumps(token, ensure_ascii=False)
                    yield f"event: token\ndata: {token_json}\n\n"
            except Exception as llm_error:
                # If LLM fails, return a graceful fallback
                if not full_answer:
                    fallback = f"抱歉，AI 服务暂时不可用（{str(llm_error)[:100]}），请稍后重试。"
                    full_answer = fallback
                    token_json = json.dumps(fallback, ensure_ascii=False)
                    yield f"event: token\ndata: {token_json}\n\n"

            # 对话内 PPT 生成：检测 ```doc_gen``` 块
            file_result = extract_and_generate_ppt(full_answer)
            if file_result:
                clean_answer = re.sub(
                    r'```doc_gen\s*\n.*?\n```', '', full_answer, flags=re.DOTALL
                ).strip()
                file_json = json.dumps(file_result, ensure_ascii=False)
                yield f"event: file_ready\ndata: {file_json}\n\n"
            else:
                clean_answer = full_answer

            # Save messages after streaming completes
            saved_msg_id = _save_messages(
                stream_db,
                _conversation_id,
                request.message,
                clean_answer,
                sources,
            )

            done_data = json.dumps({
                "message_id": saved_msg_id,
                "conversation_id": _conversation_id,
            })
            yield f"event: done\ndata: {done_data}\n\n"

            # v4.0 学生端：后台记录学习行为 + 错题检测（不阻塞响应）
            if _is_student:
                thread = threading.Thread(
                    target=_student_post_chat_tasks,
                    args=(_user_id, agent_id, _conversation_id, request.message, clean_answer, config),
                    daemon=True,
                )
                thread.start()

            # v4.0 教师端：后台自动提取教学经验（仅 Agent 作者触发）
            if _is_teacher_owner:
                thread = threading.Thread(
                    target=_teacher_post_chat_tasks,
                    args=(_user_id, agent_id, _conversation_id, request.message, clean_answer),
                    daemon=True,
                )
                thread.start()
        except Exception as e:
            import traceback as _tb
            tb_text = "".join(_tb.format_exception(type(e), e, e.__traceback__))
            logger.error(f"event_stream 异常: {e}\n{tb_text}")
            error_data = json.dumps({"error": str(e), "traceback": tb_text[-1500:]})
            yield f"event: error\ndata: {error_data}\n\n"
        finally:
            stream_db.close()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{agent_id}/conversations")
def list_conversations(
    agent_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conversations = (
        db.query(Conversation)
        .filter(
            Conversation.agent_id == agent_id,
            Conversation.user_id == current_user.id,
        )
        .order_by(Conversation.created_at.desc())
        .all()
    )
    return [
        {
            "id": c.id,
            "title": c.title or "未命名对话",
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in conversations
    ]


@router.get("/conversations/{conversation_id}/messages")
def get_conversation_messages(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="对话不存在")
    if conv.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问")

    messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
        .all()
    )
    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "sources": m.sources,
            "feedback": m.feedback,
            "created_at": m.created_at.isoformat(),
        }
        for m in messages
    ]


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="对话不存在")
    if conv.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权删除")

    db.query(Message).filter(Message.conversation_id == conversation_id).delete()
    db.delete(conv)
    db.commit()
    return {"message": "删除成功"}
