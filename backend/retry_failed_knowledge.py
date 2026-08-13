# -*- coding: utf-8 -*-
"""重试所有 status='failed' 的知识库文件的 RAG 处理流程（切分→嵌入→入库）"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal
from app.models.knowledge import KnowledgeFile
from app.routers.knowledge import _process_file_pipeline

db = SessionLocal()
try:
    failed = db.query(KnowledgeFile).filter(KnowledgeFile.status == "failed").all()
    if not failed:
        print("[OK] 没有失败的文件，无需重试。")
    else:
        print(f"[INFO] 找到 {len(failed)} 个失败文件，开始重试处理...")
        for f in failed:
            print(f"  → 重试 file_id={f.id}: {f.filename} (agent_id={f.agent_id})")
            # 先重置状态
            f.status = "uploading"
            f.progress = 0
            f.progress_stage = "retrying"
            f.error_message = None
            db.commit()
            # 同步执行处理管道（原设计是后台任务，但同步更易观察）
            try:
                _process_file_pipeline(f.id, f.agent_id)
                # 刷新查看结果
                db.refresh(f)
                if f.status == "done":
                    print(f"    ✅ 处理成功！分块数={f.chunk_count}")
                else:
                    print(f"    ❌ 仍然失败: {f.status} / {f.error_message[:120]}")
            except Exception as e:
                print(f"    ❌ 处理异常: {e}")

    # 再次打印总览
    print("\n" + "="*80)
    from app.models.agent import Agent
    results = (
        db.query(Agent.name, KnowledgeFile.filename, KnowledgeFile.status,
                 KnowledgeFile.chunk_count, KnowledgeFile.error_message)
        .join(KnowledgeFile, Agent.id == KnowledgeFile.agent_id)
        .order_by(Agent.id, KnowledgeFile.id)
        .all()
    )
    total = len(results)
    done = sum(1 for _, _, s, _, _ in results if s == "done")
    fail = sum(1 for _, _, s, _, _ in results if s == "failed")
    processing = total - done - fail
    print(f"统计结果: {total} 个文件 | done={done} | failed={fail} | 处理中={processing}")
    if fail:
        print("\n仍失败的文件:")
        for n, fn, s, c, e in results:
            if s == "failed":
                print(f"  ❌ {n} / {fn}: {e[:200]}")
    elif done == total and total == 16:
        print("\n✅ 全部 16 个知识库文件处理完成！")
finally:
    db.close()
