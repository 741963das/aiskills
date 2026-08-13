from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///../app.db"
    SECRET_KEY: str = ""  # 必须通过 .env 注入，不提供默认值
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    UPLOAD_DIR: str = "./uploads"
    OUTPUT_DIR: str = "./outputs"
    CHROMA_PERSIST_DIR: str = "./chroma_data"

    # CORS 允许的前端来源（逗号分隔）
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # SiliconFlow API (OpenAI 兼容)
    SILICONFLOW_API_KEY: str = ""
    SILICONFLOW_BASE_URL: str = "https://api.siliconflow.cn/v1"
    EMBEDDING_MODEL: str = "BAAI/bge-m3"
    CHAT_MODEL: str = "deepseek-ai/DeepSeek-V3.2"

    # 启动时一次性清理测试数据（本次交付专用）
    CLEANUP_TEST_DATA_ON_START: bool = False

    class Config:
        env_file = ".env"


settings = Settings()

# 启动时安全校验
_INSECURE_KEYS = {"", "your-secret-key-change-in-production", "changeme", "secret"}
if settings.SECRET_KEY in _INSECURE_KEYS:
    raise RuntimeError(
        "SECRET_KEY 未配置或使用了不安全的默认值。\n"
        "请在 backend/.env 文件中设置一个随机且足够长的 SECRET_KEY，例如：\n"
        'SECRET_KEY=<运行 python -c "import secrets; print(secrets.token_urlsafe(32))" 生成>'
    )
