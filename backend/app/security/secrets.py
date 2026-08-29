"""
LinuxAI — Secret Redaction Engine
Detects and masks passwords, API keys, tokens, and private key content
before sending any command output to the AI or storing it in logs.
"""

import re
from dataclasses import dataclass, field


REDACTED = "[REDACTED]"


@dataclass
class RedactionRule:
    name: str
    pattern: re.Pattern
    replacement: str = REDACTED


# ─── Redaction Rules ─────────────────────────────────────────────────────────
# Each rule matches a pattern and replaces the sensitive value with [REDACTED]

REDACTION_RULES: list[RedactionRule] = [
    # Password assignments: password=secret, passwd=xxx, PASS=...
    RedactionRule(
        name="password_assignment",
        pattern=re.compile(
            r"(?i)(password|passwd|pass|secret|pwd)\s*[=:]\s*\S+",
            re.IGNORECASE,
        ),
        replacement=r"\1=[REDACTED]",  # preserve the key name
    ),
    # API keys in env-var style: OPENAI_API_KEY=sk-...
    RedactionRule(
        name="api_key_env",
        pattern=re.compile(
            r"(?i)([A-Z_]*(API_KEY|SECRET|TOKEN|ACCESS_KEY|SECRET_KEY|AUTH_TOKEN)[A-Z_]*)\s*=\s*\S+",
        ),
        replacement=r"\1=[REDACTED]",
    ),
    # OpenAI API key format: sk-...
    RedactionRule(
        name="openai_key",
        pattern=re.compile(r"\bsk-[A-Za-z0-9]{20,}\b"),
    ),
    # AWS Access Key ID: AKIA...
    RedactionRule(
        name="aws_access_key",
        pattern=re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    ),
    # AWS Secret Key (40 char base64-ish)
    RedactionRule(
        name="aws_secret",
        pattern=re.compile(r"(?i)aws.{0,20}secret.{0,20}['\"]?([A-Za-z0-9/+=]{40})['\"]?"),
    ),
    # GitHub personal access tokens: ghp_...
    RedactionRule(
        name="github_token",
        pattern=re.compile(r"\bghp_[A-Za-z0-9]{36}\b"),
    ),
    # Private RSA/EC key block
    RedactionRule(
        name="private_key_block",
        pattern=re.compile(
            r"-----BEGIN (RSA|EC|OPENSSH|DSA|PGP) PRIVATE KEY-----.*?-----END \1 PRIVATE KEY-----",
            re.DOTALL,
        ),
        replacement="[PRIVATE KEY REDACTED]",
    ),
    # Generic high-entropy strings that look like tokens (32+ hex chars)
    RedactionRule(
        name="hex_token",
        pattern=re.compile(r"\b[0-9a-fA-F]{32,}\b"),
        replacement="[HEX-TOKEN REDACTED]",
    ),
    # Database connection strings with passwords
    RedactionRule(
        name="db_connection_string",
        pattern=re.compile(
            r"(?i)(postgresql|mysql|mongodb|redis)://[^:]+:[^@]+@",
        ),
        replacement=r"\1://[USER]:[REDACTED]@",
    ),
    # Basic Auth in URLs: https://user:password@host
    RedactionRule(
        name="basic_auth_url",
        pattern=re.compile(r"(https?://)([^:]+):([^@]+)@"),
        replacement=r"\1\2:[REDACTED]@",
    ),
]


class SecretRedactor:
    """
    Applies all redaction rules to text content.
    Used before sending command output to OpenAI or writing to logs.
    """

    def __init__(self, rules: list[RedactionRule] | None = None):
        self.rules = rules or REDACTION_RULES

    def redact(self, text: str) -> str:
        """Apply all redaction rules to the input text."""
        if not text:
            return text

        result = text
        for rule in self.rules:
            try:
                result = rule.pattern.sub(rule.replacement, result)
            except re.error:
                # If substitution fails, skip this rule rather than crash
                continue
        return result

    def redact_dict(self, data: dict) -> dict:
        """Recursively redact all string values in a dictionary."""
        redacted = {}
        for key, value in data.items():
            if isinstance(value, str):
                redacted[key] = self.redact(value)
            elif isinstance(value, dict):
                redacted[key] = self.redact_dict(value)
            elif isinstance(value, list):
                redacted[key] = [
                    self.redact(item) if isinstance(item, str)
                    else self.redact_dict(item) if isinstance(item, dict)
                    else item
                    for item in value
                ]
            else:
                redacted[key] = value
        return redacted

    def is_sensitive_key(self, key: str) -> bool:
        """Check if a dictionary key likely holds sensitive data."""
        sensitive_keywords = {
            "password", "passwd", "pass", "secret", "token",
            "api_key", "apikey", "auth", "credential", "private_key",
            "access_key", "secret_key", "signing_key",
        }
        key_lower = key.lower()
        return any(kw in key_lower for kw in sensitive_keywords)


# Singleton
secret_redactor = SecretRedactor()
