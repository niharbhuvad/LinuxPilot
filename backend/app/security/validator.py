"""
LinuxAI — Command Validator
Validates all command parameters before constructing the command list.
Prevents injection, path traversal, and unsafe argument passing.
"""

import re
import os
from dataclasses import dataclass
from typing import Any


@dataclass
class ValidationResult:
    valid: bool
    reason: str = ""

    @classmethod
    def ok(cls) -> "ValidationResult":
        return cls(valid=True)

    @classmethod
    def fail(cls, reason: str) -> "ValidationResult":
        return cls(valid=False, reason=reason)


class CommandValidator:
    """
    Validates individual parameters before they are assembled into command lists.
    All validation is purely structural — no subprocess is invoked here.
    """

    # Patterns that must never appear in any user-supplied parameter
    INJECTION_PATTERNS: list[re.Pattern] = [
        re.compile(r"[;&|`$()]"),             # Shell metacharacters
        re.compile(r"\$\{"),                  # Variable expansion
        re.compile(r"\$\("),                  # Command substitution
        re.compile(r"\.\.[\\/]"),             # Path traversal
        re.compile(r"\n|\r"),                 # Newline injection
        re.compile(r"--.*=.*;"),              # Option injection via =
    ]

    # Valid service name: alphanumeric, dash, underscore, dot (e.g., nginx, sshd, crond.service)
    SERVICE_NAME_PATTERN = re.compile(r"^[a-zA-Z0-9_\-\.@]+$")

    # Valid package name: alphanumeric, dash, underscore, dot, plus
    PACKAGE_NAME_PATTERN = re.compile(r"^[a-zA-Z0-9_\-\.\+]+$")

    # Valid username
    USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_\-\.]+$")

    # Valid path characters (POSIX)
    PATH_PATTERN = re.compile(r"^[a-zA-Z0-9_\-\./]+$")

    # Valid PID
    PID_PATTERN = re.compile(r"^\d+$")

    # Max lengths
    MAX_SERVICE_NAME_LEN = 128
    MAX_PACKAGE_NAME_LEN = 128
    MAX_USERNAME_LEN = 32
    MAX_PATH_LEN = 512

    def validate_no_injection(self, value: str, field_name: str = "value") -> ValidationResult:
        """Check that a value contains no shell metacharacters or injection patterns."""
        for pattern in self.INJECTION_PATTERNS:
            if pattern.search(value):
                return ValidationResult.fail(
                    f"Invalid {field_name}: contains dangerous characters '{pattern.pattern}'"
                )
        return ValidationResult.ok()

    def validate_service_name(self, service: str) -> ValidationResult:
        """Validate a systemd service name."""
        if not service or not service.strip():
            return ValidationResult.fail("Service name cannot be empty")
        service = service.strip()
        if len(service) > self.MAX_SERVICE_NAME_LEN:
            return ValidationResult.fail(f"Service name too long (max {self.MAX_SERVICE_NAME_LEN})")
        if not self.SERVICE_NAME_PATTERN.match(service):
            return ValidationResult.fail(
                f"Invalid service name '{service}': only alphanumeric, dash, underscore, dot, @ allowed"
            )
        # Inject .service suffix if missing — prevents ambiguity
        return ValidationResult.ok()

    def validate_package_name(self, package: str) -> ValidationResult:
        """Validate a DNF/RPM package name."""
        if not package or not package.strip():
            return ValidationResult.fail("Package name cannot be empty")
        package = package.strip()
        if len(package) > self.MAX_PACKAGE_NAME_LEN:
            return ValidationResult.fail(f"Package name too long (max {self.MAX_PACKAGE_NAME_LEN})")
        if not self.PACKAGE_NAME_PATTERN.match(package):
            return ValidationResult.fail(
                f"Invalid package name '{package}': only alphanumeric, dash, underscore, dot, plus allowed"
            )
        return ValidationResult.ok()

    def validate_username(self, username: str) -> ValidationResult:
        """Validate a Linux username."""
        if not username or not username.strip():
            return ValidationResult.fail("Username cannot be empty")
        username = username.strip()
        if len(username) > self.MAX_USERNAME_LEN:
            return ValidationResult.fail(f"Username too long (max {self.MAX_USERNAME_LEN})")
        if not self.USERNAME_PATTERN.match(username):
            return ValidationResult.fail(
                f"Invalid username '{username}': only alphanumeric, dash, underscore, dot allowed"
            )
        return ValidationResult.ok()

    def validate_path(self, path: str, must_be_absolute: bool = False) -> ValidationResult:
        """Validate a filesystem path."""
        if not path or not path.strip():
            return ValidationResult.fail("Path cannot be empty")
        path = path.strip()
        if len(path) > self.MAX_PATH_LEN:
            return ValidationResult.fail(f"Path too long (max {self.MAX_PATH_LEN})")
        if ".." in path:
            return ValidationResult.fail("Path traversal (../) is not allowed")
        injection = self.validate_no_injection(path, "path")
        if not injection.valid:
            return injection
        if must_be_absolute and not path.startswith("/"):
            return ValidationResult.fail("Path must be absolute (start with /)")
        return ValidationResult.ok()

    def validate_pid(self, pid: Any) -> ValidationResult:
        """Validate a process ID."""
        pid_str = str(pid).strip()
        if not self.PID_PATTERN.match(pid_str):
            return ValidationResult.fail(f"Invalid PID '{pid_str}': must be a positive integer")
        pid_int = int(pid_str)
        if pid_int <= 0 or pid_int > 4_194_304:  # Linux max PID
            return ValidationResult.fail(f"PID {pid_int} out of valid range")
        return ValidationResult.ok()

    def validate_log_count(self, n: Any) -> ValidationResult:
        """Validate a line count for log retrieval."""
        try:
            n_int = int(n)
        except (ValueError, TypeError):
            return ValidationResult.fail(f"Invalid line count: must be an integer")
        if n_int < 1 or n_int > 10_000:
            return ValidationResult.fail(f"Line count must be between 1 and 10000")
        return ValidationResult.ok()

    def validate_search_query(self, query: str) -> ValidationResult:
        """Validate a log search query."""
        if not query or not query.strip():
            return ValidationResult.fail("Search query cannot be empty")
        if len(query) > 256:
            return ValidationResult.fail("Search query too long (max 256 chars)")
        # Check for shell injection in the query itself
        for pattern in self.INJECTION_PATTERNS:
            if pattern.search(query):
                return ValidationResult.fail(
                    f"Search query contains dangerous characters: {pattern.pattern}"
                )
        return ValidationResult.ok()


# Singleton validator instance
validator = CommandValidator()
