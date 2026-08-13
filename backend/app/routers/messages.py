from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from ..database import get_db
from ..models.user import User
from ..models.message import Message
from ..utils.auth import get_current_user

router = APIRouter(prefix="/messages", tags=["messages"])


class FeedbackRequest(BaseModel):
    feedback_type: str
    comment: Optional[str] = None


@router.post("/{message_id}/feedback")
def submit_feedback(
    message_id: int,
    request: FeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="消息不存在")

    feedback_data = {
        "type": request.feedback_type,
        "comment": request.comment,
    }

    message.feedback = feedback_data
    db.commit()
    db.refresh(message)

    return {
        "id": message.id,
        "feedback": message.feedback,
    }


@router.get("/{message_id}")
def get_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="消息不存在")

    from ..models.conversation import Conversation
    conv = db.query(Conversation).filter(Conversation.id == message.conversation_id).first()
    if not conv or conv.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权访问")

    return {
        "id": message.id,
        "conversation_id": message.conversation_id,
        "role": message.role,
        "content": message.content,
        "sources": message.sources,
        "feedback": message.feedback,
        "created_at": message.created_at.isoformat(),
    }