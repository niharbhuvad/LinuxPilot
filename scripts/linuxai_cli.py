#!/usr/bin/env python3
"""
LinuxAI — Standalone Terminal CLI Interface
Run AI commands directly from your terminal shell:
  python scripts/linuxai_cli.py "Why is my server disk full?"
  python scripts/linuxai_cli.py "Clean up package cache"
"""

import sys
import asyncio
import argparse
from pathlib import Path

# Ensure app package is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

from app.ai.agent import LinuxAIAgent
from app.config import get_settings


# ANSI Color Codes
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"


async def main():
    parser = argparse.ArgumentParser(description="LinuxAI Terminal CLI")
    parser.add_argument("prompt", nargs="*", help="Natural language command or question for LinuxAI")
    parser.add_argument("--provider", choices=["openai", "gemini", "ollama"], help="Override LLM provider")
    args = parser.parse_args()

    prompt_text = " ".join(args.prompt).strip()
    if not prompt_text:
        print(f"{CYAN}{BOLD}LinuxAI Terminal Interface{RESET}")
        print(f"Usage: linuxai <natural language prompt>")
        print(f"Example: linuxai \"Check disk usage and find large files\"")
        sys.exit(0)

    settings = get_settings()
    if args.provider:
        settings.llm_provider = args.provider

    provider_info = settings.llm_provider.upper()
    model_info = settings.ollama_model if settings.llm_provider == "ollama" else settings.openai_model

    print(f"\n{BOLD}{CYAN}🧠 LinuxAI Agent ({provider_info}: {model_info}){RESET}")
    print(f"{DIM}Input: \"{prompt_text}\"{RESET}\n")

    agent = LinuxAIAgent()
    response = await agent.chat(user_message=prompt_text)

    if response.error:
        print(f"{RED}❌ Error: {response.error}{RESET}")
        sys.exit(1)

    # Display tool execution steps
    if response.tool_steps:
        print(f"{BOLD}🛠️ Executed Tool Steps:{RESET}")
        for step in response.tool_steps:
            status_icon = "✅" if step.status == "success" else "❌"
            print(f"  {status_icon} {CYAN}{step.tool_name}{RESET} ({step.status})")
            if step.args:
                print(f"     {DIM}Args: {step.args}{RESET}")
        print()

    # Display final AI message
    print(f"{BOLD}{GREEN}🤖 Response:{RESET}")
    print(response.content)
    print()


if __name__ == "__main__":
    asyncio.run(main())
