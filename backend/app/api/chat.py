"""
LinuxAI — Chat API
The main AI assistant endpoint.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete


from app.api.auth import get_current_user
from app.database.session import get_db
from app.models.user import User
from app.models.conversation import Conversation, Message
from app.schemas import (
    ChatRequest,
    ChatResponse,
    ToolExecutionStep,
    ApprovalOut,
    AITestRequest,
    AITestResponse,
)
from app.ai.agent import agent

router = APIRouter()


@router.post("", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Send a message to the LinuxAI agent and get a response.
    The agent will investigate, use tools, and return findings.
    """
    # Create or get conversation
    conv_id = request.conversation_id
    if conv_id:
        result = await db.execute(
            select(Conversation).where(Conversation.id == conv_id, Conversation.user_id == user.id)
        )
        conversation = result.scalar_one_or_none()
        if not conversation:
            # Client-side ID not in DB — create a new conversation seamlessly
            conversation = Conversation(
                user_id=user.id,
                title=request.message[:80],
            )
            db.add(conversation)
            await db.flush()
            conv_id = conversation.id
    else:
        conversation = Conversation(
            user_id=user.id,
            title=request.message[:80],
        )
        db.add(conversation)
        await db.flush()
        conv_id = conversation.id

    # Save user message
    user_msg = Message(
        conversation_id=conv_id,
        role="user",
        content=request.message,
    )
    db.add(user_msg)

    # Call AI agent
    response = await agent.chat(
        user_message=request.message,
        conversation_id=conv_id,
        user_id=user.id,
        provider=request.provider,
        model=request.model,
        api_key=request.api_key,
        base_url=request.base_url,
    )

    if response.error:
        raise HTTPException(status_code=500, detail=response.error)

    # Save assistant message
    assistant_msg = Message(
        id=response.message_id,
        conversation_id=conv_id,
        role="assistant",
        content=response.content,
        tool_calls=[step.__dict__ for step in response.tool_steps] if response.tool_steps else None,
    )
    db.add(assistant_msg)
    await db.commit()

    # Build response
    tool_steps = [
        ToolExecutionStep(
            tool_name=step.tool_name,
            args=step.args,
            status=step.status,
            result=step.result,
            risk_level=step.risk_level,
            duration_ms=step.duration_ms,
        )
        for step in response.tool_steps
    ]

    return ChatResponse(
        conversation_id=conv_id,
        message_id=response.message_id,
        content=response.content,
        tool_steps=tool_steps,
        pending_approvals=[
            ApprovalOut.model_validate(appr) if isinstance(appr, dict) else appr
            for appr in response.pending_approvals
        ],

        created_at=datetime.now(timezone.utc),
    )


@router.get("/history/{conversation_id}")
async def get_history(
    conversation_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full message history for a conversation."""
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == user.id,
        )
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msgs_result = await db.execute(
        select(Message).where(Message.conversation_id == conversation_id)
    )
    messages = msgs_result.scalars().all()

    return {
        "conversation_id": conversation_id,
        "title": conversation.title,
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "tool_calls": m.tool_calls,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
    }


@router.get("/conversations")
async def list_conversations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all conversations for the current user."""
    result = await db.execute(
        select(Conversation)
        .where(Conversation.user_id == user.id)
        .order_by(Conversation.updated_at.desc())
        .limit(50)
    )
    conversations = result.scalars().all()
    return [
        {
            "id": c.id,
            "title": c.title,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
        }
        for c in conversations
    ]


@router.delete("/conversations/{conversation_id}")

async def delete_conversation(
    conversation_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a specific conversation and all its messages permanently."""
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.user_id == user.id,
        )
    )
    conversation = result.scalar_one_or_none()
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    await db.execute(
        delete(Message).where(Message.conversation_id == conversation_id)
    )
    await db.delete(conversation)
    await db.commit()
    return {"message": "Conversation deleted permanently"}


@router.delete("/conversations")
async def clear_all_conversations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete all conversations and messages for the current user permanently."""
    result = await db.execute(
        select(Conversation).where(Conversation.user_id == user.id)
    )
    conversations = result.scalars().all()
    conv_ids = [c.id for c in conversations]

    if conv_ids:
        await db.execute(
            delete(Message).where(Message.conversation_id.in_(conv_ids))
        )
        for c in conversations:
            await db.delete(c)
        await db.commit()

    return {"message": "All conversations deleted permanently"}


@router.post("/test-connection", response_model=AITestResponse)
async def test_ai_connection(
    request: AITestRequest = AITestRequest(),
    user: User = Depends(get_current_user),
):
    """
    Test AI model connectivity, latency, and data flow.
    Verifies whether cloud/local AI engine is working and returning data to backend/frontend.
    """
    from app.ai.agent import agent
    result = await agent.test_connection(
        provider=request.provider,
        model=request.model,
        api_key=request.api_key,
        base_url=request.base_url,
        ollama_base_url=request.ollama_base_url,
    )
    return result


@router.get("/status")
async def get_ai_status(
    user: User = Depends(get_current_user),
):
    """Quick status check of configured AI engine provider."""
    from app.config import get_settings
    settings = get_settings()
    
    provider = (settings.llm_provider or "gemini").lower()
    has_gemini = bool(settings.gemini_api_key and len(settings.gemini_api_key) > 10)
    has_groq = bool(settings.groq_api_key and len(settings.groq_api_key) > 10)
    has_openai = bool(settings.openai_api_key and not settings.openai_api_key.startswith("sk-placeholder"))
    
    return {
        "active_provider": provider,
        "openai_model": settings.openai_model,
        "gemini_model": settings.gemini_model,
        "groq_model": settings.groq_model,
        "ollama_model": settings.ollama_model,
        "ollama_base_url": settings.ollama_base_url,
        "has_openai_key": has_openai,
        "has_gemini_key": has_gemini,
        "has_groq_key": has_groq,
        "fallback_available": True,
    }


