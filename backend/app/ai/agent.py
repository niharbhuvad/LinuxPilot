"""
LinuxAI — AI Agent
The central OpenAI tool-calling loop.

Flow:
  1. User message → add to conversation memory
  2. Call OpenAI with system prompt + conversation history + tool definitions
  3. Process tool calls (via dispatch table)
  4. Feed results back into conversation
  5. Repeat until assistant gives final response (no tool calls)
  6. Return final response + all tool execution steps

This agent NEVER calls shell directly — it only calls our validated tool dispatch.
"""

import json
import uuid
from dataclasses import dataclass, field
from typing import Optional, Any, cast


import openai

from app.ai.memory import ConversationMemory, memory_store
from app.ai.prompts import LINUX_AI_SYSTEM_PROMPT, build_system_context_prompt
from app.ai.tools import TOOL_DEFINITIONS, dispatch_tool
from app.config import get_settings
from app.security.secrets import secret_redactor

settings = get_settings()


@dataclass
class AgentToolStep:
    """Records one tool execution step for the frontend to display."""
    step_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    tool_name: str = ""
    args: dict = field(default_factory=dict)
    status: str = "running"  # running | success | failure | blocked | pending_approval
    result: Optional[dict] = None
    risk_level: str = "LOW"
    duration_ms: Optional[float] = None
    error: Optional[str] = None


@dataclass
class AgentResponse:
    """Final response from the AI agent."""
    conversation_id: str
    message_id: str
    content: str
    tool_steps: list[AgentToolStep] = field(default_factory=list)
    pending_approvals: list[dict] = field(default_factory=list)
    error: Optional[str] = None


class LinuxAIAgent:
    """
    The LinuxAI brain — OpenAI tool-calling agent with troubleshooting loop.
    """

    MAX_TOOL_ROUNDS = 10  # Maximum rounds of tool calling per request

    def __init__(self):
        # Allow lazy/fallback init if OPENAI_API_KEY is not set yet
        api_key = settings.openai_api_key or "sk-placeholder-set-your-key-in-env"
        self.client = openai.AsyncOpenAI(api_key=api_key)
        self.model = settings.openai_model

    def _get_client(self) -> openai.AsyncOpenAI:
        api_key = settings.openai_api_key or "sk-placeholder-set-your-key-in-env"
        return openai.AsyncOpenAI(api_key=api_key)

    def _resolve_client_and_model(
        self,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        ollama_base_url: Optional[str] = None,
    ) -> tuple[openai.AsyncOpenAI, str, str, bool]:
        """
        Returns (client, resolved_model, resolved_provider, is_configured).
        """
        prov = (provider or settings.llm_provider or "gemini").lower()
        
        if prov == "gemini":
            key = api_key or settings.gemini_api_key
            target_model = model or settings.gemini_model or "gemini-2.5-flash"
            is_configured = bool(key and len(key) > 10)
            client = openai.AsyncOpenAI(
                api_key=key or "dummy-key",
                base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
            )
            return client, target_model, "gemini", is_configured

        elif prov == "groq":
            key = api_key or settings.groq_api_key
            target_model = model or settings.groq_model or "openai/gpt-oss-120b"
            is_configured = bool(key and len(key) > 10)
            client = openai.AsyncOpenAI(
                api_key=key or "dummy-key",
                base_url="https://api.groq.com/openai/v1",
            )
            return client, target_model, "groq", is_configured

        elif prov == "ollama":
            url = base_url or ollama_base_url or settings.ollama_base_url or "http://localhost:11434/v1"
            target_model = model or settings.ollama_model or "qwen2.5-coder:7b"
            client = openai.AsyncOpenAI(
                api_key="ollama",
                base_url=url,
            )
            return client, target_model, "ollama", True

        elif prov == "custom":
            url = base_url or "http://localhost:8000/v1"
            key = api_key or "custom-key"
            target_model = model or "default"
            client = openai.AsyncOpenAI(
                api_key=key,
                base_url=url,
            )
            return client, target_model, "custom", True

        else:  # openai / default
            key = api_key or settings.openai_api_key
            target_model = model or settings.openai_model or "gpt-4o"
            is_configured = bool(key and not key.startswith("sk-placeholder") and not key.startswith("sk-your"))
            
            # If OpenAI is selected without a working key, but Gemini is available, fail over gracefully
            if not is_configured and settings.gemini_api_key and len(settings.gemini_api_key) > 10:
                client = openai.AsyncOpenAI(
                    api_key=settings.gemini_api_key,
                    base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
                )
                return client, settings.gemini_model, "gemini (auto-fallback)", True
            
            client = openai.AsyncOpenAI(api_key=key or "dummy-key")
            return client, target_model, "openai", is_configured

    async def chat(
        self,
        user_message: str,
        conversation_id: Optional[str] = None,
        user_id: Optional[str] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
    ) -> AgentResponse:
        """
        Main entry point — process a user message and return the agent's response.
        """
        conversation_id = conversation_id or str(uuid.uuid4())
        message_id = str(uuid.uuid4())

        client, current_model, resolved_provider, is_configured = self._resolve_client_and_model(
            provider=provider,
            model=model,
            api_key=api_key,
            base_url=base_url,
        )

        if not is_configured and resolved_provider != "ollama" and resolved_provider != "custom":
            return await self._fallback_diagnostic(user_message, conversation_id, message_id, "No valid API key configured")

        memory: ConversationMemory = memory_store.get_or_create(conversation_id)

        # Add user message
        memory.add_user_message(user_message)

        # Auto-fetch live connected system context if missing
        if not memory.system_identity:
            try:
                from app.diagnostics.system import get_system_info
                sys_info = await get_system_info()
                if sys_info:
                    memory.set_system_identity(sys_info)
            except Exception:
                pass

        # Try to get system context for enriched prompt
        system_context = ""
        if memory.system_identity:
            system_context = build_system_context_prompt(memory.system_identity)

        # Build system prompt
        system_prompt = LINUX_AI_SYSTEM_PROMPT
        if system_context:
            system_prompt += f"\n\n{system_context}"

        tool_steps: list[AgentToolStep] = []

        async def _fetch_completion(msgs):
            nonlocal client, current_model
            try:
                return await client.chat.completions.create(
                    model=current_model,
                    messages=msgs,
                    tools=cast(Any, TOOL_DEFINITIONS),
                    tool_choice="auto",
                    temperature=settings.openai_temperature,
                    max_tokens=settings.openai_max_tokens,
                )
            except Exception as err:
                err_str = str(err)
                is_rate_limit = "429" in err_str or "quota" in err_str.lower() or "resource_exhausted" in err_str.lower()

                # Attempt 1: Failover to Groq if key exists and we haven't tried Groq yet
                if settings.groq_api_key and len(settings.groq_api_key) > 10 and "groq" not in current_model:
                    try:
                        groq_client = openai.AsyncOpenAI(
                            api_key=settings.groq_api_key,
                            base_url="https://api.groq.com/openai/v1"
                        )
                        groq_model = settings.groq_model or "openai/gpt-oss-120b"
                        return await groq_client.chat.completions.create(
                            model=groq_model,
                            messages=msgs,
                            tools=cast(Any, TOOL_DEFINITIONS),
                            tool_choice="auto",
                            temperature=settings.openai_temperature,
                            max_tokens=settings.openai_max_tokens,
                        )
                    except Exception:
                        pass

                # Attempt 2: Failover to Gemini if key exists and we haven't tried Gemini yet
                if settings.gemini_api_key and len(settings.gemini_api_key) > 10 and "gemini" not in current_model and resolved_provider != "ollama":
                    try:
                        gem_client = openai.AsyncOpenAI(
                            api_key=settings.gemini_api_key,
                            base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
                        )
                        return await gem_client.chat.completions.create(
                            model=settings.gemini_model or "gemini-2.5-flash",
                            messages=msgs,
                            tools=cast(Any, TOOL_DEFINITIONS),
                            tool_choice="auto",
                            temperature=settings.openai_temperature,
                            max_tokens=settings.openai_max_tokens,
                        )
                    except Exception:
                        pass

                if is_rate_limit:
                    raise RuntimeError("API Rate Limit Exceeded (429 Quota Limit reached). Please try again shortly or switch AI provider in Settings.")
                raise err

        try:
            # ── Tool-Calling Loop ─────────────────────────────────────────────
            for round_num in range(self.MAX_TOOL_ROUNDS):
                messages = [
                    {"role": "system", "content": system_prompt},
                    *memory.get_openai_messages(),
                ]

                response = await _fetch_completion(messages)


                choice = response.choices[0]
                assistant_message = choice.message

                # Add assistant response to memory
                memory.messages.append(assistant_message.model_dump(exclude_none=True))

                # ── Check if we're done (no tool calls) ───────────────────────
                if not assistant_message.tool_calls:
                    content = assistant_message.content or "I've completed my analysis."
                    memory.add_assistant_message(content)
                    memory.messages.pop(-2)

                    return AgentResponse(
                        conversation_id=conversation_id,
                        message_id=message_id,
                        content=content,
                        tool_steps=tool_steps,
                    )

                # ── Process each tool call ────────────────────────────────────
                tool_results_for_memory: list[dict] = []

                for tool_call in assistant_message.tool_calls:
                    if not hasattr(tool_call, "function"):
                        continue
                    tool_func = getattr(tool_call, "function")
                    tool_name = tool_func.name
                    try:
                        tool_args = json.loads(tool_func.arguments or "{}")
                    except json.JSONDecodeError:
                        tool_args = {}


                    step = AgentToolStep(
                        tool_name=tool_name,
                        args=tool_args,
                        status="running",
                    )
                    tool_steps.append(step)

                    # Dispatch tool
                    try:
                        result = await dispatch_tool(tool_name, tool_args)
                        result_str = json.dumps(result) if isinstance(result, dict) else str(result)
                        result_str = secret_redactor.redact(result_str)

                        if len(result_str) > 8192:
                            result_str = result_str[:8192] + "\n... [TRUNCATED]"

                        step.status = "success"
                        step.result = result if isinstance(result, dict) else {"output": str(result)}

                    except Exception as e:
                        result_str = json.dumps({"error": str(e)})
                        step.status = "failure"
                        step.error = str(e)
                        memory.record_error(str(e), context=f"tool:{tool_name}")

                    tool_results_for_memory.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": result_str,
                    })

                memory.messages.extend(tool_results_for_memory)

            return AgentResponse(
                conversation_id=conversation_id,
                message_id=message_id,
                content="I've completed my investigation. Please review the tool execution steps above for the full analysis.",
                tool_steps=tool_steps,
            )

        except Exception as err:
            # Fallback to local rule-based diagnostic engine if LLM API is unreachable/unauthenticated
            return await self._fallback_diagnostic(user_message, conversation_id, message_id, str(err))

    async def _fallback_diagnostic(
        self,
        user_message: str,
        conversation_id: str,
        message_id: str,
        error_reason: str,
    ) -> AgentResponse:
        """
        Rule-based diagnostic fallback when LLM API is unavailable/unauthenticated.
        Executes standard diagnostic tools directly and generates a comprehensive Markdown report.
        """
        tool_steps: list[AgentToolStep] = []

        # 1. System Overview
        step1 = AgentToolStep(tool_name="get_system_info", args={}, status="running")
        tool_steps.append(step1)
        try:
            sys_info = await dispatch_tool("get_system_info", {})
            step1.status = "success"
            step1.result = sys_info if isinstance(sys_info, dict) else {"output": str(sys_info)}
        except Exception as e:
            step1.status = "failure"
            step1.error = str(e)
            sys_info = {}

        # 2. Failed Services
        step2 = AgentToolStep(tool_name="get_failed_services", args={}, status="running")
        tool_steps.append(step2)
        try:
            failed_svcs = await dispatch_tool("get_failed_services", {})
            step2.status = "success"
            step2.result = failed_svcs if isinstance(failed_svcs, dict) else {"output": str(failed_svcs)}
        except Exception as e:
            step2.status = "failure"
            step2.error = str(e)
            failed_svcs = {}

        # 3. Disk Usage
        step3 = AgentToolStep(tool_name="get_disk_usage", args={}, status="running")
        tool_steps.append(step3)
        try:
            disk_info = await dispatch_tool("get_disk_usage", {})
            step3.status = "success"
            step3.result = {"disks": disk_info} if isinstance(disk_info, list) else {"output": str(disk_info)}
        except Exception as e:
            step3.status = "failure"
            step3.error = str(e)
            disk_info = []

        # Build comprehensive summary text
        hostname = sys_info.get("hostname", "local-system") if isinstance(sys_info, dict) else "local-system"
        os_name = sys_info.get("os_name", "Linux") if isinstance(sys_info, dict) else "Linux"
        cpu_pct = sys_info.get("cpu", {}).get("percent", "N/A") if isinstance(sys_info, dict) else "N/A"
        mem_pct = sys_info.get("memory", {}).get("percent", "N/A") if isinstance(sys_info, dict) else "N/A"
        failed_count = failed_svcs.get("failed_count", 0) if isinstance(failed_svcs, dict) else 0

        report_lines = [
            f"### 🖥️ LinuxAI System Diagnostic Report for `{hostname}` ({os_name})",
            "",
            f"- **CPU Usage**: `{cpu_pct}%`",
            f"- **Memory Usage**: `{mem_pct}%`",
            f"- **Failed Services**: `{failed_count}`",
            "",
        ]

        if failed_count > 0 and isinstance(failed_svcs, dict) and "failed_services" in failed_svcs:
            report_lines.append("#### ⚠️ Failed Services Detected:")
            for svc in failed_svcs["failed_services"]:
                report_lines.append(f"- `{svc.get('name')}`: {svc.get('description', 'Service failed')}")
            report_lines.append("")

        if isinstance(disk_info, list) and disk_info:
            report_lines.append("#### 💾 Disk Usage Summary:")
            for d in disk_info:
                if isinstance(d, dict):
                    report_lines.append(f"- Mount `{d.get('mountpoint')}`: `{d.get('percent')}%` used ({d.get('used_gb')}GB / {d.get('size_gb')}GB)")
            report_lines.append("")

        clean_error = error_reason
        if "RESOURCE_EXHAUSTED" in clean_error or "429" in clean_error:
            clean_error = "API Quota Exceeded (429 Rate Limit)"

        report_lines.append(
            "> ℹ️ *Note: Executed via LinuxAI Fallback Diagnostic Engine because cloud/local LLM provider API was unavailable (" + clean_error + "). To enable interactive AI conversational mode, configure a valid OPENAI_API_KEY, GEMINI_API_KEY, GROQ_API_KEY, or run a local Ollama instance in Settings.*"
        )

        return AgentResponse(
            conversation_id=conversation_id,
            message_id=message_id,
            content="\n".join(report_lines),
            tool_steps=tool_steps,
        )

    async def test_connection(
        self,
        provider: Optional[str] = None,
        model: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        ollama_base_url: Optional[str] = None,
    ) -> dict:
        """
        Diagnostic probe to test AI model connectivity, latency, and data flow.
        Checks if data is coming from target LLM provider back to frontend/backend.
        """
        import time
        from datetime import datetime, timezone

        start_time = time.perf_counter()
        client, target_model, target_provider, key_configured = self._resolve_client_and_model(
            provider=provider,
            model=model,
            api_key=api_key,
            base_url=base_url,
            ollama_base_url=ollama_base_url,
        )

        if not key_configured and target_provider != "ollama":
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            return {
                "status": "fallback",
                "provider": target_provider,
                "model": target_model,
                "key_configured": False,
                "data_received": False,
                "latency_ms": round(elapsed_ms, 2),
                "response_sample": "Local Rule-Based Fallback Engine active. No cloud API key configured.",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "message": "AI Key missing or using fallback. Local diagnostic engine is operational.",
                "diagnostics": {
                    "reason": "Missing or placeholder API key",
                    "suggestion": "Configure a valid OPENAI_API_KEY, GEMINI_API_KEY, or local Ollama URL in Settings.",
                }
            }

        test_messages = [
            {"role": "system", "content": "You are a diagnostic health probe. Respond concisely."},
            {"role": "user", "content": "LinuxAI status check. Respond with 'STATUS: OK - AI Engine operational'."}
        ]

        try:
            res = await client.chat.completions.create(
                model=target_model,
                messages=test_messages,
                max_tokens=50,
                temperature=0.0,
            )
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            content = (res.choices[0].message.content or "").strip()
            data_received = len(content) > 0

            return {
                "status": "ok" if data_received else "error",
                "provider": target_provider,
                "model": target_model,
                "key_configured": True,
                "data_received": data_received,
                "latency_ms": round(elapsed_ms, 2),
                "response_sample": content if data_received else "No content returned",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "message": f"Successfully verified AI connectivity. {len(content)} chars received in {round(elapsed_ms, 1)}ms.",
                "diagnostics": {
                    "finish_reason": getattr(res.choices[0], "finish_reason", "stop"),
                    "prompt_tokens": res.usage.prompt_tokens if res.usage else None,
                    "completion_tokens": res.usage.completion_tokens if res.usage else None,
                    "total_tokens": res.usage.total_tokens if res.usage else None,
                }
            }
        except Exception as err:
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            err_str = str(err)
            
            if settings.gemini_api_key and "gemini" not in target_provider and target_provider != "ollama":
                try:
                    gem_client = openai.AsyncOpenAI(
                        api_key=settings.gemini_api_key,
                        base_url="https://generativelanguage.googleapis.com/v1beta/openai/",
                    )
                    res = await gem_client.chat.completions.create(
                        model=settings.gemini_model,
                        messages=test_messages,
                        max_tokens=50,
                        temperature=0.0,
                    )
                    content = (res.choices[0].message.content or "").strip()
                    return {
                        "status": "fallback",
                        "provider": "gemini (fallback)",
                        "model": settings.gemini_model,
                        "key_configured": True,
                        "data_received": True,
                        "latency_ms": round((time.perf_counter() - start_time) * 1000, 2),
                        "response_sample": content,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "message": f"Primary provider error ({err_str}). Successfully failed over to Gemini LLM.",
                        "diagnostics": {
                            "primary_error": err_str,
                            "finish_reason": getattr(res.choices[0], "finish_reason", "stop"),
                        }
                    }
                except Exception as fallback_err:
                    err_str = f"Primary: {err_str} | Fallback: {str(fallback_err)}"

            return {
                "status": "error",
                "provider": target_provider,
                "model": target_model,
                "key_configured": key_configured,
                "data_received": False,
                "latency_ms": round(elapsed_ms, 2),
                "response_sample": "",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "message": f"AI Engine Connection Failed: {err_str}",
                "diagnostics": {
                    "error_details": err_str,
                    "suggestion": "Check API key validity, network connectivity, or Ollama service status."
                }
            }


# Singleton agent
agent = LinuxAIAgent()
