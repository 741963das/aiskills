# PRD 02：彻底清除测试助手与技能文件数据

> 项目：AI Skills 教育创新创作平台
> 位置：`e:\aiskills`
> 当前状态：`cleanup_data.py` 和 `admin.py` 的清理逻辑只是把非内置助手/技能文件改为 `draft` 状态，没有真正删除。这些测试数据仍留在数据库和"我的助手"列表中。
> 目标：非 SYSTEM 用户的所有测试助手、技能文件、知识库文件、对话记录**从数据库彻底删除**，upload 文件、Chroma 向量也一并清理。

---

## 一、当前问题分析

当前 `cleanup_data.py` 的清理逻辑：

```python
def clear_marketplace_agents(db, keep_builtins=True):
    # 问题：只改 status，不删除
    agent.status = "draft"  # ← 只下架，不删除
```

这导致：
- 测试助手仍然出现在"我的助手"页面（显示为草稿）
- 测试技能文件仍在"技能管理"页面
- 关联的对话记录、知识库文件、向量数据都没清理
- 数据库里残留大量无用数据

---

## 二、需要改的文件

### 2.1 `backend/cleanup_data.py`

**修改点：将 `clear_marketplace_agents` 和 `clear_marketplace_skills` 从"下架"改为"删除"**

修改后的逻辑：

```python
def delete_non_builtin_agents(db):
    """删除非内建助手：从数据库彻底删除 SYSTEM 用户以外的所有 Agent。
    同时级联删除：关联的知识库文件、知识库切片、Chroma 向量、
    对话记录、消息、教案、反思、生成文档。
    """
    print("=" * 60)
    print("【2/5】删除非内建测试助手...")

    system_user_id = _get_system_user_id(db)
    if not system_user_id:
        print("  ⚠ SYSTEM 用户不存在，跳过")
        return

    # 找到所有非 SYSTEM 用户的 Agent
    agents_to_delete = db.query(Agent).filter(
        Agent.user_id != system_user_id
    ).all()
    print(f"  找到 {len(agents_to_delete)} 个非内建助手")

    for agent in agents_to_delete:
        # 1. 删除关联的 Chroma 向量数据
        try:
            from app.services.rag import _get_chroma_client
            client = _get_chroma_client()
            collection_name = f"agent_{agent.id}"
            try:
                client.delete_collection(collection_name)
            except Exception:
                pass  # collection 可能不存在
        except Exception as e:
            print(f"  ⚠ 删除 Chroma collection agent_{agent.id} 失败: {e}")

        # 2. 删除关联的知识库磁盘文件
        kfiles = db.query(KnowledgeFile).filter(
            KnowledgeFile.agent_id == agent.id
        ).all()
        for kf in kfiles:
            if kf.file_path and os.path.exists(kf.file_path):
                try:
                    os.remove(kf.file_path)
                except Exception as e:
                    print(f"  ⚠ 删除知识库文件失败 {kf.file_path}: {e}")

        # 3. 删除关联的对话记录（级联删除消息）
        from app.models.conversation import Conversation
        from app.models.message import Message
        convs = db.query(Conversation).filter(
            Conversation.agent_id == agent.id
        ).all()
        for conv in convs:
            db.query(Message).filter(Message.conversation_id == conv.id).delete()
            db.delete(conv)

        # 4. 删除关联的教案
        from app.models.lesson_plan import LessonPlan
        db.query(LessonPlan).filter(LessonPlan.agent_id == agent.id).delete()

        # 5. 删除关联的反思
        from app.models.reflection import Reflection
        db.query(Reflection).filter(Reflection.agent_id == agent.id).delete()

        # 6. 删除关联的知识库记录（先删 chunk 再删 file）
        db.query(KnowledgeChunk).filter(
            KnowledgeChunk.file_id.in_(
                db.query(KnowledgeFile.id).filter(KnowledgeFile.agent_id == agent.id)
            )
        ).delete(synchronize_session=False)
        db.query(KnowledgeFile).filter(KnowledgeFile.agent_id == agent.id).delete()

        # 7. 删除关联的 AgentSkill 挂载关系
        from app.models.agent_skill import AgentSkill
        db.query(AgentSkill).filter(AgentSkill.agent_id == agent.id).delete()

        # 8. 删除关联的生成文档
        from app.models.document import GeneratedDocument
        docs = db.query(GeneratedDocument).filter(
            GeneratedDocument.agent_id == agent.id
        ).all()
        for doc in docs:
            if doc.file_path and os.path.exists(doc.file_path):
                try:
                    os.remove(doc.file_path)
                except Exception:
                    pass
        db.query(GeneratedDocument).filter(
            GeneratedDocument.agent_id == agent.id
        ).delete()

        # 9. 删除 Agent 本身
        db.delete(agent)

    db.commit()
    print(f"  已删除 {len(agents_to_delete)} 个非内建助手及其全部关联数据")
    print("  ✅ 非内建助手清理完成")


def delete_non_builtin_skill_files(db):
    """删除非内建技能文件：从数据库彻底删除 SYSTEM 用户以外的所有 SkillFile。
    同时清理 AgentSkill 挂载关系。
    """
    print("=" * 60)
    print("【3/5】删除非内建测试技能文件...")

    system_user_id = _get_system_user_id(db)
    if not system_user_id:
        print("  ⚠ SYSTEM 用户不存在，跳过")
        return

    # 先清理所有非内建技能文件的挂载关系
    non_builtin_ids = [
        sf.id for sf in db.query(SkillFile).filter(
            SkillFile.user_id != system_user_id
        ).all()
    ]
    if non_builtin_ids:
        from app.models.agent_skill import AgentSkill
        db.query(AgentSkill).filter(
            AgentSkill.skill_file_id.in_(non_builtin_ids)
        ).delete(synchronize_session=False)

    # 删除技能文件
    deleted = db.query(SkillFile).filter(
        SkillFile.user_id != system_user_id
    ).delete(synchronize_session=False)
    db.commit()
    print(f"  已删除 {deleted} 个非内建技能文件及其挂载关系")
    print("  ✅ 非内建技能文件清理完成")
```

### 2.2 同时修改 `clear_knowledge` 为只清除非内建助手的知识库

如果知识库已经在上面的 `delete_non_builtin_agents` 中随 Agent 级联删除了，则 `clear_knowledge` 可以简化，只做：
- 删除所有知识库磁盘文件
- 删除 Chroma 向量目录
- 删除 SQLite 中残留的 knowledge_files 和 knowledge_chunks（此时应该只剩 SYSTEM 用户的）

### 2.3 同时删除非 SYSTEM 用户

```python
def delete_non_system_users(db):
    """删除非 SYSTEM 测试用户。"""
    print("=" * 60)
    print("【6/5】删除非内建测试用户...")
    system_user_id = _get_system_user_id(db)
    if not system_user_id:
        print("  ⚠ SYSTEM 用户不存在，跳过")
        return
    deleted = db.query(User).filter(User.id != system_user_id).delete()
    db.commit()
    print(f"  已删除 {deleted} 个非内建用户")
    print("  ✅ 非内建用户清理完成")
```

### 2.4 更新 `main` 函数

```python
if __name__ == "__main__":
    print("🚀 开始彻底清除测试数据（仅保留平台内建内容）...\n")
    db = SessionLocal()
    try:
        print("【0/5】确认平台内建助手与技能文件...")
        seed_builtins(db)
        print("  ✅ 内建内容已确认")

        delete_non_builtin_agents(db)       # 新：彻底删除
        delete_non_builtin_skill_files(db)   # 新：彻底删除
        clear_generated_documents(db)        # 保留：清空生成文档
        clear_uploads_folder()               # 保留：清空 uploads
        delete_non_system_users(db)          # 新：删除测试用户
        show_summary(db)
        print("\n🎉 清理完成！仅保留平台内建助手与技能文件。")
    finally:
        db.close()
```

### 2.5 同步修改 `backend/app/routers/admin.py` 的 `_run_cleanup`

`admin.py` 的 `_run_cleanup` 函数也有同样的"只下架不删除"问题。需要给 `CleanupRequest` 增加一个 `delete_non_builtins: bool = False` 开关，当为 True 时执行彻底删除逻辑。

---

## 三、执行步骤

### 步骤 1：修改代码

按照上述方案修改 `backend/cleanup_data.py` 和 `backend/app/routers/admin.py`。

### 步骤 2：运行清理脚本

```bash
cd backend
python cleanup_data.py
```

### 步骤 3：验证清理结果

```sql
-- 确认只保留了 SYSTEM 用户
SELECT id, username, display_name FROM users;
-- 应只有 1 行：SYSTEM / AI Skills 平台

-- 确认只保留了 8 个内置助手
SELECT a.id, a.name, a.status, u.username
FROM agents a JOIN users u ON a.user_id = u.id;
-- 应只有 8 行，全部属于 SYSTEM，status=published

-- 确认只保留了 6 个内置技能文件
SELECT sf.id, sf.name, sf.status, u.username
FROM skill_files sf JOIN users u ON sf.user_id = u.id;
-- 应只有 6 行，全部属于 SYSTEM，status=published

-- 确认知识库已清空
SELECT COUNT(*) FROM knowledge_files;
-- 应为 0（如果 PRD 01 还没执行）
-- 或者只有 SYSTEM 用户的知识库文件（如果 PRD 01 已执行）

-- 确认对话和消息已清空
SELECT COUNT(*) FROM conversations;
SELECT COUNT(*) FROM messages;
-- 均应为 0

-- 确认教案和反思已清空
SELECT COUNT(*) FROM lesson_plans;
SELECT COUNT(*) FROM teaching_reflections;
-- 均应为 0
```

### 步骤 4：前端验证

- 启动前端，登录教师账号
- "我的助手"页面：应只显示 8 个内置助手（如果有 SYSTEM 用户关联）
- "助手市场"页面：应只显示 8 个内置助手
- "技能管理"页面：应只显示 6 个内置技能文件
- "知识库"页面：为空（如果 PRD 01 还没执行）

---

## 四、注意事项

1. **先执行 PRD 01 还是 PRD 02？**
   - 建议先执行 PRD 02（清除），再执行 PRD 01（填充知识库）
   - 这样清理后数据库干净，再填充知识库

2. **不要删除 SYSTEM 用户**
   - 清理脚本中明确排除 SYSTEM 用户

3. **不要删除内置助手的知识库**
   - 如果 PRD 01 已执行，知识库文件属于 SYSTEM 用户的内置助手
   - 清理时排除 SYSTEM 用户

4. **Chroma 向量数据清理**
   - 删除 Agent 后，对应的 Chroma collection 也应删除
   - 如果 Chroma 删除失败，不影响整体流程，只打印警告

5. **备份**
   - 执行前建议备份 `backend/app.db` 和 `backend/chroma_data/`

---

## 五、验收标准

- [ ] `cleanup_data.py` 的清理逻辑从"下架"改为"删除"
- [ ] 运行 `python cleanup_data.py` 后：
  - [ ] `users` 表只有 SYSTEM 用户
  - [ ] `agents` 表只有 8 个内置助手
  - [ ] `skill_files` 表只有 6 个内置技能文件
  - [ ] `knowledge_files` 和 `knowledge_chunks` 为空
  - [ ] `conversations` 和 `messages` 为空
  - [ ] `lesson_plans` 和 `teaching_reflections` 为空
- [ ] 前端"助手市场"页面只显示 8 个内置助手
- [ ] 前端"技能管理"页面只显示 6 个内置技能文件
- [ ] 前端"我的助手"页面只有内置助手
- [ ] 后端启动无报错