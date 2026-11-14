"""
Redis cache module for API responses.
Provides caching decorators and utilities.
"""
import redis
import json
import hashlib
import logging
from functools import wraps
from typing import Optional, Any, Callable
import os
from dotenv import load_dotenv

load_dotenv()

# Redis configuration
REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))
REDIS_DB = int(os.getenv('REDIS_DB', 0))
REDIS_PASSWORD = os.getenv('REDIS_PASSWORD', None)

# Cache TTL (Time To Live) in seconds
CACHE_TTL_SHORT = 300      # 5 minutes - for frequently changing data
CACHE_TTL_MEDIUM = 1800    # 30 minutes - for semi-static data
CACHE_TTL_LONG = 3600      # 1 hour - for static data
CACHE_TTL_VERY_LONG = 86400  # 24 hours - for rarely changing data

logger = logging.getLogger(__name__)

# Global Redis client
_redis_client: Optional[redis.Redis] = None


def get_redis_client() -> redis.Redis:
    """Get or create Redis client singleton."""
    global _redis_client

    if _redis_client is None:
        try:
            _redis_client = redis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                db=REDIS_DB,
                password=REDIS_PASSWORD,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True
            )
            # Test connection
            _redis_client.ping()
            logger.info(f"Redis connected: {REDIS_HOST}:{REDIS_PORT}")
        except redis.ConnectionError as e:
            logger.warning(f"Redis connection failed: {e}. Caching disabled.")
            _redis_client = None

    return _redis_client


def generate_cache_key(prefix: str, *args, **kwargs) -> str:
    """
    Generate a cache key from function arguments.

    Args:
        prefix: Key prefix (usually function name)
        *args: Positional arguments
        **kwargs: Keyword arguments

    Returns:
        Cache key string
    """
    # Create a string representation of all arguments
    key_parts = [str(arg) for arg in args]
    key_parts.extend(f"{k}={v}" for k, v in sorted(kwargs.items()))
    key_string = "|".join(key_parts)

    # Hash if too long
    if len(key_string) > 100:
        key_hash = hashlib.md5(key_string.encode()).hexdigest()
        return f"{prefix}:{key_hash}"

    return f"{prefix}:{key_string}" if key_string else prefix


def cache_response(ttl: int = CACHE_TTL_MEDIUM, key_prefix: Optional[str] = None):
    """
    Decorator to cache function responses in Redis.

    Args:
        ttl: Time to live in seconds
        key_prefix: Optional custom key prefix (defaults to function name)

    Usage:
        @cache_response(ttl=300, key_prefix="search")
        def search_words(query: str, limit: int):
            return expensive_operation()
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Get Redis client
            client = get_redis_client()
            if client is None:
                # Caching disabled, call function directly
                return func(*args, **kwargs)

            # Generate cache key
            prefix = key_prefix or f"cache:{func.__name__}"
            cache_key = generate_cache_key(prefix, *args, **kwargs)

            # Try to get from cache
            try:
                cached = client.get(cache_key)
                if cached is not None:
                    logger.debug(f"Cache HIT: {cache_key}")
                    return json.loads(cached)
            except (redis.RedisError, json.JSONDecodeError) as e:
                logger.warning(f"Cache read error: {e}")

            # Cache miss - call function
            logger.debug(f"Cache MISS: {cache_key}")
            result = func(*args, **kwargs)

            # Store in cache
            try:
                client.setex(
                    cache_key,
                    ttl,
                    json.dumps(result, default=str)
                )
            except (redis.RedisError, TypeError) as e:
                logger.warning(f"Cache write error: {e}")

            return result

        return wrapper
    return decorator


def invalidate_cache(pattern: str) -> int:
    """
    Invalidate cache keys matching a pattern.

    Args:
        pattern: Redis key pattern (e.g., "cache:search*")

    Returns:
        Number of keys deleted
    """
    client = get_redis_client()
    if client is None:
        return 0

    try:
        keys = client.keys(pattern)
        if keys:
            deleted = client.delete(*keys)
            logger.info(f"Invalidated {deleted} cache keys matching: {pattern}")
            return deleted
    except redis.RedisError as e:
        logger.error(f"Cache invalidation error: {e}")

    return 0


def clear_all_cache() -> bool:
    """
    Clear all cache entries.

    Returns:
        True if successful
    """
    client = get_redis_client()
    if client is None:
        return False

    try:
        client.flushdb()
        logger.info("All cache cleared")
        return True
    except redis.RedisError as e:
        logger.error(f"Cache clear error: {e}")
        return False


def get_cache_stats() -> dict:
    """
    Get cache statistics.

    Returns:
        Dictionary with cache stats
    """
    client = get_redis_client()
    if client is None:
        return {
            "status": "disabled",
            "connected": False
        }

    try:
        info = client.info()
        dbsize = client.dbsize()

        return {
            "status": "enabled",
            "connected": True,
            "total_keys": dbsize,
            "used_memory": info.get('used_memory_human', 'N/A'),
            "total_connections": info.get('total_connections_received', 0),
            "hits": info.get('keyspace_hits', 0),
            "misses": info.get('keyspace_misses', 0),
            "hit_rate": round(
                info.get('keyspace_hits', 0) /
                max(info.get('keyspace_hits', 0) + info.get('keyspace_misses', 0), 1) * 100,
                2
            )
        }
    except redis.RedisError as e:
        logger.error(f"Cache stats error: {e}")
        return {
            "status": "error",
            "connected": False,
            "error": str(e)
        }


# Convenience functions for common cache operations

def cache_set(key: str, value: Any, ttl: int = CACHE_TTL_MEDIUM) -> bool:
    """Set a cache value."""
    client = get_redis_client()
    if client is None:
        return False

    try:
        client.setex(key, ttl, json.dumps(value, default=str))
        return True
    except (redis.RedisError, TypeError) as e:
        logger.error(f"Cache set error: {e}")
        return False


def cache_get(key: str) -> Optional[Any]:
    """Get a cache value."""
    client = get_redis_client()
    if client is None:
        return None

    try:
        cached = client.get(key)
        if cached is not None:
            return json.loads(cached)
    except (redis.RedisError, json.JSONDecodeError) as e:
        logger.error(f"Cache get error: {e}")

    return None


def cache_delete(key: str) -> bool:
    """Delete a cache key."""
    client = get_redis_client()
    if client is None:
        return False

    try:
        client.delete(key)
        return True
    except redis.RedisError as e:
        logger.error(f"Cache delete error: {e}")
        return False
