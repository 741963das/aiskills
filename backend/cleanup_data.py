"""清理测试数据脚本：清空知识库、取消发布非内建助手和技能文件。

默认保留 SYSTEM 用户下的平台内建助手与技能文件，避免把产品交付所需的
“原始助手”和平台自带技能一起下架。
"""
import os
import shutil
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine
from app.models.knowledge import KnowledgeFile, KnowledgeChunk
from app.models.agent import Agent
from app.models.skill_file import SkillFile
from app.models.document import GeneratedDocument
from app.models.conversation import Conversation
from app.models.message import Message
from app.models.reflection import Reflection
from app.models.lesson_plan import LessonPlan
from app.models.user import User
from app.config import settings
from app.services.builtins import SYSTEM_USERNAME, seed_builtins

UPLOAD_DIR = settings.UPLOAD_DIR
CHROMA_DIR = settings.CHROMA_PERSIST_DIR


def clear_knowledge(db):
    """清空知识库：删除SQLite记录 + 磁盘文件 + Chroma向量。"""
    print("=" * 60)
    print("【1/5】清理知识库数据...")

    files = db.query(KnowledgeFile).all()
    print(f"  找到 {len(files)} 个知识库文件记录")

    deleted_files = 0
    for f in files:
        # 删除磁盘文件
        if f.file_path and os.path.exists(f.file_path):
            try:
                os.remove(f.file_path)
                deleted_files += 1
            except Exception as e:
                print(f"  ⚠ 删除文件失败 {f.file_path}: {e}")

    print(f"  删除磁盘文件: {deleted_files}")

    # 删除Chroma向量库
    if os.path.exists(CHROMA_DIR):
        try:
            shutil.rmtree(CHROMA_DIR)
            print(f"  删除Chroma向量目录: {CHROMA_DIR}")
        except Exception as e:
            print(f"  ⚠ 删除Chroma目录失败: {e}")

    # 删除SQLite记录（会级联删除KnowledgeChunk）
    chunk_count = db.query(KnowledgeChunk).count()
    db.query(KnowledgeChunk).delete()
    db.query(KnowledgeFile).delete()
    db.commit()
    print(f"  删除KnowledgeChunk: {chunk_count} 条")
    print(f"  删除KnowledgeFile: {len(files)} 条")
    print("  ✅ 知识库清理完成")


def _get_system_user_id(db):
    system_user = db.query(User).filter(User.username == SYSTEM_USERNAME).first()
    return system_user.id if system_user else None


def clear_marketplace_agents(db, keep_builtins=True):
    """清空助手市场：将非内建已发布Agent改为草稿状态。"""
    print("=" * 60)
    print("【2/5】清理助手市场（取消发布非内建内容）...")

    query = db.query(Agent).filter(Agent.status == "published")
    system_user_id = _get_system_user_id(db)
    if keep_builtins and system_user_id:
        query = query.filter(Agent.user_id != system_user_id)

    published = query.all()
    print(f"  找到 {len(published)} 个已发布助手")

    for agent in published:
        agent.status = "draft"
        # 清除publishScope标记
        if isinstance(agent.config, dict):
            agent.config.pop("publishScope", None)
            agent.config["published"] = False

    db.commit()
    print(f"  已将 {len(published)} 个非内建助手改为 draft 状态")
    print("  ✅ 助手市场清理完成")


def clear_marketplace_skills(db, keep_builtins=True):
    """清空技能文件市场：将非内建已发布SkillFile改为草稿状态。"""
    print("=" * 60)
    print("【3/5】清理技能文件市场（取消发布非内建内容）...")

    query = db.query(SkillFile).filter(SkillFile.status == "published")
    system_user_id = _get_system_user_id(db)
    if keep_builtins and system_user_id:
        query = query.filter(SkillFile.user_id != system_user_id)

    published = query.all()
    print(f"  找到 {len(published)} 个已发布技能文件")

    for sf in published:
        sf.status = "draft"

    db.commit()
    print(f"  已将 {len(published)} 个非内建技能文件改为 draft 状态")
    print("  ✅ 技能文件市场清理完成")


def clear_generated_documents(db):
    """清空生成的文档记录和文件。"""
    print("=" * 60)
    print("【4/5】清理生成文档记录...")

    docs = db.query(GeneratedDocument).all()
    print(f"  找到 {len(docs)} 个生成文档记录")

    deleted_files = 0
    for d in docs:
        if d.file_path and os.path.exists(d.file_path):
            try:
                os.remove(d.file_path)
                deleted_files += 1
            except Exception as e:
                print(f"  ⚠ 删除文件失败 {d.file_path}: {e}")

    print(f"  删除磁盘文档文件: {deleted_files}")
    db.query(GeneratedDocument).delete()
    db.commit()
    print(f"  删除GeneratedDocument记录: {len(docs)} 条")
    print("  ✅ 生成文档清理完成")


def clear_uploads_folder():
    """清空uploads文件夹（保留目录结构）。"""
    print("=" * 60)
    print("【5/5】清理uploads文件夹...")

    if os.path.exists(UPLOAD_DIR):
        count = 0
        for root, dirs, files in os.walk(UPLOAD_DIR, topdown=False):
            for f in files:
                try:
                    os.remove(os.path.join(root, f))
                    count += 1
                except Exception as e:
                    print(f"  ⚠ 删除失败: {e}")
        print(f"  删除uploads下文件: {count} 个")
    else:
        print("  uploads文件夹不存在，跳过")
    print("  ✅ uploads清理完成")


def show_summary(db):
    system_user_id = _get_system_user_id(db)
    builtin_agent_count = 0
    builtin_skill_file_count = 0
    if system_user_id:
        builtin_agent_count = db.query(Agent).filter(
            Agent.user_id == system_user_id,
            Agent.status == "published",
        ).count()
        builtin_skill_file_count = db.query(SkillFile).filter(
            SkillFile.user_id == system_user_id,
            SkillFile.status == "published",
        ).count()

    print("\n" + "=" * 60)
    print("📊 清理后数据统计：")
    print(f"  知识库文件: {db.query(KnowledgeFile).count()}")
    print(f"  知识块: {db.query(KnowledgeChunk).count()}")
    print(f"  已发布助手: {db.query(Agent).filter(Agent.status == 'published').count()}")
    print(f"  其中平台内建助手: {builtin_agent_count}")
    print(f"  已发布技能文件: {db.query(SkillFile).filter(SkillFile.status == 'published').count()}")
    print(f"  其中平台内建技能文件: {builtin_skill_file_count}")
    print(f"  生成文档: {db.query(GeneratedDocument).count()}")
    print(f"  助手总数(含草稿): {db.query(Agent).count()}")
    print(f"  技能文件总数(含草稿): {db.query(SkillFile).count()}")
    print(f"  对话总数: {db.query(Conversation).count()}")
    print(f"  消息总数: {db.query(Message).count()}")
    print("=" * 60)


if __name__ == "__main__":
    print("🚀 开始清理测试数据（保留平台内建内容）...\n")
    db = SessionLocal()
    try:
        print("【0/5】确认平台内建助手与技能文件...")
        seed_builtins(db)
        print("  ✅ 内建内容已确认")
        clear_knowledge(db)
        clear_marketplace_agents(db, keep_builtins=True)
        clear_marketplace_skills(db, keep_builtins=True)
        clear_generated_documents(db)
        clear_uploads_folder()
        show_summary(db)
        print("\n🎉 清理完成！知识库已清空，市场仅保留平台内建助手与技能文件。")
    finally:
        db.close()
