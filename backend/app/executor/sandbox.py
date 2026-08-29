"""
LinuxAI — Output Sandbox
Sanitizes and limits command output before use.
"""

import re

MAX_OUTPUT_BYTES = 65_536   # 64 KB hard limit
TRUNCATION_NOTICE = "\n... [OUTPUT TRUNCATED BY LINUXAI — use targeted queries for full output] ..."


class OutputSandbox:
    """
    Sanitizes command output:
    - Enforces size limits
    - Strips control characters (except newlines/tabs)
    - Removes ANSI escape sequences
    - Adds truncation notices
    """

    ANSI_ESCAPE = re.compile(r"\x1b\[[0-9;]*[A-Za-z]|\x1b\][^\x07]*\x07|\x1b[()][AB012]")
    CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

    def __init__(self, max_bytes: int = MAX_OUTPUT_BYTES):
        self.max_bytes = max_bytes

    def sanitize(self, text: str) -> str:
        """Strip ANSI codes, control chars, enforce size limit."""
        if not text:
            return ""

        # Strip ANSI escape sequences
        text = self.ANSI_ESCAPE.sub("", text)

        # Strip dangerous control characters (keep \t and \n)
        text = self.CONTROL_CHARS.sub("", text)

        # Enforce size limit
        encoded = text.encode("utf-8", errors="replace")
        if len(encoded) > self.max_bytes:
            truncated = encoded[: self.max_bytes].decode("utf-8", errors="replace")
            text = truncated + TRUNCATION_NOTICE

        return text

    def sanitize_for_ai(self, text: str, max_bytes: int | None = None) -> str:
        """
        Stricter sanitization for content going to the AI.
        Applies a tighter limit to avoid wasting tokens.
        """
        ai_limit = max_bytes or min(self.max_bytes, 16_384)  # 16 KB for AI context
        sandbox = OutputSandbox(max_bytes=ai_limit)
        return sandbox.sanitize(text)


# Singleton
sandbox = OutputSandbox()
