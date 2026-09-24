import redis

from app.core.config import settings


redis_client = redis.from_url(
    settings.REDIS_URL,
    encoding="utf-8",
    decode_responses=True,
)


def check_redis_connection():
    try:
        return redis_client.ping()
    except Exception:
        return False