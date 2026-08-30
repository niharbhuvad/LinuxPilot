"""
LinuxAI — Diagnostic Single-Flight Coalescing & Scoped TTL Cache
Prevents duplicate concurrent and rapid repeated SSH diagnostic probing across
/api/system, /api/system/health-score, /api/services/failed, and AI agent tools.
"""

import time
import asyncio
from typing import Any, Callable, Coroutine, Dict, Tuple, Optional


class DiagnosticCache:
    def __init__(self, default_ttl: float = 3.5):
        self.default_ttl = default_ttl
        self._cache: Dict[str, Tuple[float, Any]] = {}
        self._in_flight: Dict[str, asyncio.Future] = {}
        self._lock = asyncio.Lock()

    def get_target_scope(self) -> str:
        """Derive the cache scope key from active SSH settings or local."""
        try:
            from app.config import get_settings
            from app.api.ssh import _load_persistent_config
            _load_persistent_config()
            s = get_settings()
            if s.ssh_enabled and s.ssh_host:
                return f"ssh:{s.ssh_user}@{s.ssh_host}:{s.ssh_port}"
            return "local"
        except Exception:
            return "local"

    async def get_or_fetch(
        self,
        key: str,
        fetcher: Callable[[], Coroutine[Any, Any, Any]],
        ttl: Optional[float] = None,
    ) -> Any:
        """
        Single-flight coalescing with short TTL caching.
        If data is in cache and fresh, returns immediately.
        If a fetch is already in-flight for this target & key, waits and reuses the result.
        Otherwise, executes fetcher once and shares the result with all waiting callers.
        """
        scope = self.get_target_scope()
        cache_key = f"{scope}:{key}"
        effective_ttl = ttl if ttl is not None else self.default_ttl
        now = time.monotonic()

        async with self._lock:
            # 1. Fresh cache hit
            if cache_key in self._cache:
                cached_at, value = self._cache[cache_key]
                if now - cached_at < effective_ttl:
                    return value
                else:
                    del self._cache[cache_key]

            # 2. In-flight coalescing (another request is currently fetching this)
            if cache_key in self._in_flight:
                fut = self._in_flight[cache_key]
            else:
                loop = asyncio.get_running_loop()
                fut = loop.create_future()
                self._in_flight[cache_key] = fut

        if fut.done():
            return fut.result()

        async with self._lock:
            is_creator = (self._in_flight.get(cache_key) is fut and not fut.done())

        if is_creator:
            try:
                result = await fetcher()
                now_done = time.monotonic()
                async with self._lock:
                    self._cache[cache_key] = (now_done, result)
                    if not fut.done():
                        fut.set_result(result)
                    self._in_flight.pop(cache_key, None)
                return result
            except Exception as e:
                async with self._lock:
                    if not fut.done():
                        fut.set_exception(e)
                    self._in_flight.pop(cache_key, None)
                raise e
        else:
            return await fut

    def clear(self):
        """Invalidate all cached metrics (e.g. on host disconnect/switch)."""
        self._cache.clear()
        self._in_flight.clear()


diag_cache = DiagnosticCache(default_ttl=3.5)
