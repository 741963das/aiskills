import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

from .config import settings
from .database import engine, Base
from .models import (
    User,
    Agent,
    SkillFile,
    AgentSkill,
    KnowledgeFile,
    Conversation,
    Message,
    GeneratedDocument,
    LessonPlan,
    TeachingReflection,
)
from .routers.auth import router as auth_router
from .routers.agent import router as agent_router
from .routers.skill_file import router as skill_file_router
from .routers.knowledge import router as knowledge_router
from .routers.chat import router as chat_router
from .routers.messages import router as messages_router
from .routers.documents import router as documents_router
from .routers.student import router as student_router
from .routers.lesson_plan import router as lesson_plan_router
from .routers.reflection import router as reflection_router
from .routers.analytics import router as analytics_router
from .routers.admin import router as admin_router
from .services.builtins import seed_builtins

Base.metadata.create_all(bind=engine)


# 轻量级迁移：skill → agent 重命名 + 新增 skill_files / agent_skills 表（SQLite，幂等）
def _lightweight_migrate():
    """在启动时执行幂等迁移：
    1. agents 表不存在则从 skills 复制结构
    2. conversations/knowledge_files/generated_documents 的 skill_id 列 → agent_id
    3. 创建 skill_files 与 agent_skills 表（如不存在）
    """
    import sqlite3
    from .config import settings

    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    conn = sqlite3.connect(db_path)
    try:
        c = conn.cursor()

        def _table_exists(name: str) -> bool:
            row = c.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (name,)
            ).fetchone()
            return row is not None

        def _columns(table: str) -> list[str]:
            c.execute(f"PRAGMA table_info({table})")
            return [row[1] for row in c.fetchall()]

        # 1. agents 表：若不存在则基于 skills 创建并复制数据
        if not _table_exists("agents"):
            if _table_exists("skills"):
                c.execute("CREATE TABLE agents AS SELECT * FROM skills")
                conn.commit()
                logger.info("created agents table from skills")
            else:
                # 连 skills 都没有，则由 Base.metadata.create_all 处理
                logger.info("no skills table found, agents will be created by ORM")
        else:
            # agents 已存在但为空、skills 存在且有数据：补齐迁移
            if _table_exists("skills"):
                agents_count = c.execute("SELECT COUNT(*) FROM agents").fetchone()[0]
                skills_count = c.execute("SELECT COUNT(*) FROM skills").fetchone()[0]
                if agents_count == 0 and skills_count > 0:
                    c.execute("INSERT INTO agents SELECT * FROM skills")
                    conn.commit()
                    logger.info(f"copied {skills_count} rows from skills to agents")

        # 2. conversations: skill_id → agent_id
        if _table_exists("conversations"):
            cols = _columns("conversations")
            if "agent_id" not in cols:
                # 建新表复制数据再替换
                c.execute("ALTER TABLE conversations RENAME TO conversations_old")
                c.execute(
                    """
                    CREATE TABLE conversations (
                        id INTEGER PRIMARY KEY,
                        agent_id INTEGER,
                        user_id INTEGER,
                        title VARCHAR,
                        created_at DATETIME
                    )
                    """
                )
                if "skill_id" in cols:
                    c.execute(
                        "INSERT INTO conversations (id, agent_id, user_id, title, created_at) "
                        "SELECT id, skill_id, user_id, title, created_at FROM conversations_old"
                    )
                else:
                    c.execute(
                        "INSERT INTO conversations (id, agent_id, user_id, title, created_at) "
                        "SELECT id, NULL, user_id, title, created_at FROM conversations_old"
                    )
                c.execute("DROP TABLE conversations_old")
                conn.commit()
                logger.info("conversations.skill_id renamed to agent_id")

        # 3. knowledge_files: skill_id → agent_id
        if _table_exists("knowledge_files"):
            cols = _columns("knowledge_files")
            if "agent_id" not in cols:
                c.execute("ALTER TABLE knowledge_files RENAME TO knowledge_files_old")
                c.execute(
                    """
                    CREATE TABLE knowledge_files (
                        id INTEGER PRIMARY KEY,
                        user_id INTEGER,
                        agent_id INTEGER,
                        filename VARCHAR,
                        file_path VARCHAR,
                        file_type VARCHAR,
                        file_size FLOAT,
                        status VARCHAR,
                        progress INTEGER,
                        progress_stage VARCHAR,
                        error_message TEXT,
                        chunk_count INTEGER,
                        created_at DATETIME
                    )
                    """
                )
                if "skill_id" in cols:
                    c.execute(
                        "INSERT INTO knowledge_files (id, user_id, agent_id, filename, file_path, file_type, "
                        "file_size, status, progress, progress_stage, error_message, chunk_count, created_at) "
                        "SELECT id, user_id, skill_id, filename, file_path, file_type, file_size, status, "
                        "progress, progress_stage, error_message, chunk_count, created_at FROM knowledge_files_old"
                    )
                else:
                    c.execute(
                        "INSERT INTO knowledge_files (id, user_id, agent_id, filename, file_path, file_type, "
                        "file_size, status, progress, progress_stage, error_message, chunk_count, created_at) "
                        "SELECT id, user_id, NULL, filename, file_path, file_type, file_size, status, "
                        "progress, progress_stage, error_message, chunk_count, created_at FROM knowledge_files_old"
                    )
                c.execute("DROP TABLE knowledge_files_old")
                conn.commit()
                logger.info("knowledge_files.skill_id renamed to agent_id")

        # 4. generated_documents: skill_id → agent_id
        if _table_exists("generated_documents"):
            cols = _columns("generated_documents")
            if "agent_id" not in cols:
                c.execute("ALTER TABLE generated_documents RENAME TO generated_documents_old")
                c.execute(
                    """
                    CREATE TABLE generated_documents (
                        id INTEGER PRIMARY KEY,
                        user_id INTEGER,
                        agent_id INTEGER,
                        doc_type VARCHAR,
                        topic VARCHAR,
                        subject VARCHAR,
                        grade VARCHAR,
                        file_path VARCHAR,
                        file_name VARCHAR,
                        config JSON,
                        created_at DATETIME
                    )
                    """
                )
                if "skill_id" in cols:
                    c.execute(
                        "INSERT INTO generated_documents (id, user_id, agent_id, doc_type, topic, subject, grade, "
                        "file_path, file_name, config, created_at) "
                        "SELECT id, user_id, skill_id, doc_type, topic, subject, grade, file_path, file_name, "
                        "config, created_at FROM generated_documents_old"
                    )
                else:
                    c.execute(
                        "INSERT INTO generated_documents (id, user_id, agent_id, doc_type, topic, subject, grade, "
                        "file_path, file_name, config, created_at) "
                        "SELECT id, user_id, NULL, doc_type, topic, subject, grade, file_path, file_name, "
                        "config, created_at FROM generated_documents_old"
                    )
                c.execute("DROP TABLE generated_documents_old")
                conn.commit()
                logger.info("generated_documents.skill_id renamed to agent_id")

        # 5. skill_files 表
        if not _table_exists("skill_files"):
            c.execute(
                """
                CREATE TABLE skill_files (
                    id INTEGER PRIMARY KEY,
                    user_id INTEGER,
                    name VARCHAR,
                    description VARCHAR,
                    content TEXT,
                    source VARCHAR,
                    github_source JSON,
                    status VARCHAR,
                    version INTEGER,
                    created_at DATETIME,
                    updated_at DATETIME
                )
                """
            )
            conn.commit()
            logger.info("created skill_files table")

        # 6. agent_skills 表
        if not _table_exists("agent_skills"):
            c.execute(
                """
                CREATE TABLE agent_skills (
                    id INTEGER PRIMARY KEY,
                    agent_id INTEGER,
                    skill_file_id INTEGER,
                    created_at DATETIME
                )
                """
            )
            conn.commit()
            logger.info("created agent_skills table")

        # 7. 学生端表（幂等创建）
        from .models.student import StudentAgent, LearningRecord, MistakeRecord, StudentProfile
        for table_sql in [
            """CREATE TABLE IF NOT EXISTS student_agents (
                id INTEGER PRIMARY KEY,
                student_id INTEGER,
                agent_id INTEGER,
                status VARCHAR DEFAULT 'active',
                joined_at DATETIME,
                last_accessed_at DATETIME
            )""",
            """CREATE TABLE IF NOT EXISTS learning_records (
                id INTEGER PRIMARY KEY,
                student_id INTEGER,
                agent_id INTEGER,
                conversation_id INTEGER,
                activity_type VARCHAR,
                duration_seconds INTEGER,
                metadata_json TEXT,
                created_at DATETIME
            )""",
            """CREATE TABLE IF NOT EXISTS mistake_records (
                id INTEGER PRIMARY KEY,
                student_id INTEGER,
                agent_id INTEGER,
                conversation_id INTEGER,
                subject VARCHAR,
                knowledge_point VARCHAR,
                question TEXT,
                student_answer TEXT,
                correct_answer TEXT,
                explanation TEXT,
                error_type VARCHAR,
                difficulty VARCHAR,
                is_mastered BOOLEAN,
                review_count INTEGER,
                last_reviewed_at DATETIME,
                created_at DATETIME
            )""",
            """CREATE TABLE IF NOT EXISTS student_profiles (
                id INTEGER PRIMARY KEY,
                student_id INTEGER UNIQUE,
                grade VARCHAR,
                major VARCHAR,
                subjects_of_interest TEXT,
                learning_goal TEXT,
                preferred_time VARCHAR,
                created_at DATETIME,
                updated_at DATETIME
            )""",
        ]:
            c.execute(table_sql)
        conn.commit()
        logger.info("student tables ensured")

        # 7.1 补齐 student_agents.status 列（旧表可能缺少此列）
        if _table_exists("student_agents"):
            sa_cols = _columns("student_agents")
            if "status" not in sa_cols:
                c.execute("ALTER TABLE student_agents ADD COLUMN status VARCHAR DEFAULT 'active'")
                conn.commit()
                logger.info("added status column to student_agents")
            # 将旧记录的 NULL status 更新为 active
            c.execute("UPDATE student_agents SET status = 'active' WHERE status IS NULL")
            conn.commit()

        # 7.2 question_records 表（师生问答沉淀）
        c.execute("""CREATE TABLE IF NOT EXISTS question_records (
            id INTEGER PRIMARY KEY,
            agent_id INTEGER,
            student_id INTEGER,
            conversation_id INTEGER,
            question TEXT,
            ai_answer TEXT,
            teacher_reply TEXT,
            pain_point VARCHAR,
            subject VARCHAR,
            status VARCHAR DEFAULT 'open',
            created_at DATETIME,
            answered_at DATETIME
        )""")
        conn.commit()
        logger.info("question_records table ensured")

        # 8. lesson_plans 表
        c.execute("""CREATE TABLE IF NOT EXISTS lesson_plans (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            agent_id INTEGER,
            title VARCHAR,
            subject VARCHAR,
            grade VARCHAR,
            topic VARCHAR,
            duration VARCHAR,
            student_count INTEGER,
            content JSON,
            created_at DATETIME,
            updated_at DATETIME
        )""")

        # 9. teaching_reflections 表
        c.execute("""CREATE TABLE IF NOT EXISTS teaching_reflections (
            id INTEGER PRIMARY KEY,
            user_id INTEGER,
            agent_id INTEGER,
            input_text TEXT,
            report JSON,
            created_at DATETIME
        )""")

        conn.commit()
        logger.info("lesson_plans and teaching_reflections tables ensured")

    finally:
        conn.close()


_lightweight_migrate()

app = FastAPI(title="AI Skills Platform", version="1.0.0")

allowed_origins = [
    origin.strip()
    for origin in settings.CORS_ORIGINS.split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api")
app.include_router(agent_router, prefix="/api")
app.include_router(skill_file_router, prefix="/api")
app.include_router(knowledge_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(messages_router, prefix="/api")
app.include_router(documents_router, prefix="/api")
app.include_router(student_router, prefix="/api")
app.include_router(lesson_plan_router, prefix="/api")
app.include_router(reflection_router, prefix="/api")
app.include_router(analytics_router, prefix="/api")
app.include_router(admin_router, prefix="/api")

# ---------------------------------------------------------------------------
# 生产模式：托管前端静态文件（Docker 容器中启用）
# 当 static/ 目录存在时，自动挂载前端 SPA 并提供路由回退
# ---------------------------------------------------------------------------
import os as _stat_os
from fastapi.staticfiles import StaticFiles as _StaticFiles
from starlette.responses import FileResponse as _FileResponse

_STATIC_DIR = _stat_os.path.join(_stat_os.path.dirname(_stat_os.path.abspath(__file__)), "..", "static")
if _stat_os.path.isdir(_STATIC_DIR):
    # 挂载静态资源（JS/CSS/图片等）
    app.mount("/assets", _StaticFiles(directory=_stat_os.path.join(_STATIC_DIR, "assets")), name="assets")

    # SPA 回退：所有非 /api/ 非 /docs 的 GET 请求返回 index.html
    from fastapi import Request as _Request
    @app.get("/{full_path:path}")
    async def _serve_spa(full_path: str, request: _Request):
        """前端 SPA 路由回退：非 API 请求返回 index.html"""
        file_path = _stat_os.path.join(_STATIC_DIR, full_path)
        if _stat_os.path.isfile(file_path) and not full_path.startswith("api/"):
            return _FileResponse(file_path)
        return _FileResponse(_stat_os.path.join(_STATIC_DIR, "index.html"))

    logger.info("前端静态文件服务已启用（目录: %s）", _STATIC_DIR)


# ---------------------------------------------------------------------------
# 启动生命周期钩子：1) 可选一次性清理测试数据  2) 幂等播种内建内容
# ---------------------------------------------------------------------------
import os as _os
from fastapi import FastAPI as _FastAPI
from .database import SessionLocal as _SessionLocal
from .routers.admin import _run_cleanup, CleanupRequest as _CleanupRequest

_ONCE_MARKER_PATH = _os.path.join(
    _os.path.dirname(_os.path.abspath(__file__)), "..", "_cleanup_once_done.marker"
)


def _maybe_run_onetime_cleanup() -> dict | None:
    """如果环境变量 CLEANUP_TEST_DATA_ON_START=true 且标记文件不存在，则执行一次保留内建的清理。"""
    flag = (_os.environ.get("CLEANUP_TEST_DATA_ON_START") or "").strip().lower()
    if flag not in ("1", "true", "yes", "on"):
        return None
    if _os.path.exists(_ONCE_MARKER_PATH):
        logger.info("检测到清理标记文件，跳过一次性清理（如需再次清理请删除标记文件 %s）", _ONCE_MARKER_PATH)
        return None
    db = _SessionLocal()
    try:
        req = _CleanupRequest(
            secret=settings.SECRET_KEY,
            clear_knowledge=True,
            unpublish_agents=True,
            unpublish_skill_files=True,
            clear_generated_documents=True,
            clear_uploads_folder=True,
            keep_builtins=True,  # 关键：保留内建 SYSTEM 用户的内容
        )
        result = _run_cleanup(db, req)
        logger.info("【Startup】一次性清理测试数据完成: %s", result.__dict__)
        # 写入标记文件，防止下次启动重复清理
        try:
            with open(_ONCE_MARKER_PATH, "w", encoding="utf-8") as f:
                import datetime
                f.write(f"cleanup done at {datetime.datetime.now().isoformat()}\n")
                f.write("如需再次执行清理，请删除此文件并设置环境变量 CLEANUP_TEST_DATA_ON_START=true\n")
        except Exception:
            pass
        return result.__dict__
    finally:
        db.close()


@app.on_event("startup")
def on_startup_seed_and_cleanup():
    """启动时：(1) 可选一次性清理  (2) 播种/更新平台内建助手与技能。"""
    # 1) 可选一次性清理（通过环境变量触发一次）
    cleanup_result = _maybe_run_onetime_cleanup()
    if cleanup_result:
        logger.info("【Startup】on_startup 清理阶段结果: %s", cleanup_result)

    # 2) 幂等播种内建内容（每次启动都检查，版本落后时自动升级）
    try:
        seed_result = seed_builtins()
        logger.info("【Startup】内建内容播种完成: %s", seed_result)
    except Exception as e:
        logger.exception("内建内容播种失败（不影响服务启动）: %s", e)


@app.get("/")
def root():
    return {"message": "Welcome to AI Skills Platform API", "docs": "/docs"}


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "AI Skills Platform"}
