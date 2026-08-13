# -*- coding: utf-8 -*-
"""知识库上传脚本：获取 agent 列表 + 上传所有 16 个知识库文件"""
import os
import sys
import requests
import time

BASE = "http://localhost:8000"
MATERIALS = r"e:\aiskills\backend\knowledge_materials"

# ============================================================
# 第一部分：检查后端服务是否运行，并尝试登录
# ============================================================
print("=" * 60)
print("[INFO] 检查后端服务状态...")
try:
    resp = requests.get(f"{BASE}/docs", timeout=5)
    if resp.status_code == 200:
        print("[OK] 后端服务正常运行")
    else:
        print(f"[WARN] 后端响应异常: {resp.status_code}")
except Exception as e:
    print(f"[ERROR] 无法连接后端: {e}")
    print("请先启动后端服务: cd e:\\aiskills\\backend ; python -m uvicorn app.main:app --reload --port 8000")
    sys.exit(1)

# 登录获取 token
print("\n[INFO] 登录账号获取 token...")
login_resp = requests.post(f"{BASE}/api/auth/login", json={
    "username": "testuser1",
    "password": "123456"
})
if login_resp.status_code != 200:
    print(f"[ERROR] 登录失败: {login_resp.status_code} {login_resp.text}")
    # 尝试注册
    print("[INFO] 尝试注册账号...")
    reg_resp = requests.post(f"{BASE}/api/auth/register", json={
        "username": "testuser1",
        "password": "123456",
        "email": "test1@test.com",
        "role": "teacher"
    })
    if reg_resp.status_code in (200, 201):
        print("[OK] 注册成功，再次登录...")
        login_resp = requests.post(f"{BASE}/api/auth/login", json={
            "username": "testuser1",
            "password": "123456"
        })
    else:
        print(f"[ERROR] 注册也失败: {reg_resp.status_code} {reg_resp.text}")
        sys.exit(1)

token = login_resp.json().get("access_token")
if not token:
    print(f"[ERROR] 无法获取 token: {login_resp.json()}")
    sys.exit(1)
print("[OK] 登录成功，获取 token")
headers = {"Authorization": f"Bearer {token}"}

# ============================================================
# 第二部分：获取所有内置助手（agent 列表）
# 直接通过数据库查询 SYSTEM 用户下 published 状态的内置助手
# ============================================================
print("\n" + "=" * 60)
print("[INFO] 获取内置助手列表（直接查询数据库）...")

from app.database import SessionLocal
from app.models.agent import Agent
from app.models.user import User

_db = SessionLocal()
try:
    _system_user = _db.query(User).filter(User.username == 'SYSTEM').first()
    if not _system_user:
        print("[ERROR] 未找到 SYSTEM 用户，内置助手尚未创建")
        sys.exit(1)
    agents = _db.query(Agent).filter(
        Agent.user_id == _system_user.id,
        Agent.status == 'published'
    ).all()
    # 转为 dict 便于后续处理
    agents = [{"id": a.id, "name": a.name, "course_name": a.course_name, "status": a.status} for a in agents]
finally:
    _db.close()

print(f"\n共获取到 {len(agents)} 个助手：")
for a in agents:
    print(f"  ID {a.get('id'):>3}: {a.get('name')}  [{a.get('course_name')}]  status={a.get('status')}")

# ============================================================
# 第三部分：助手名称 -> 文件名映射
# ============================================================
agent_file_map = {
    "高等数学助教": ["高等数学第一章函数与极限讲义.md", "高等数学常见习题与易错点.md"],
    "Python 编程导师": ["Python基础语法速查手册.md", "Python常见错误与调试指南.md"],
    "大学英语读写助手": ["四级英语写作模板与技巧.md", "英语语法常见错误精讲.md"],
    "大学物理（力学）助教": ["力学第一章质点运动学讲义.md", "力学典型例题与解题思路.md"],
    "教案设计专家": ["布卢姆教学目标分类法详解.md", "各学科优质教案范例.md"],
    "试卷与题目生成器": ["命题规范与双向细目表指南.md", "各题型设计方法与示例.md"],
    "机电一体化实训导师": ["机电一体化系统概述.md", "机电设备常见故障排查手册.md"],
    "思政课学习助手": ["思想道德与法治第一章要点梳理.md", "思政课常见论述题答题思路.md"],
}

# ============================================================
# 第四部分：循环上传
# ============================================================
print("\n" + "=" * 60)
print("[INFO] 开始上传知识库文件...")
print("=" * 60)

total_ok = 0
total_fail = 0
upload_results = []  # (agent_name, filename, status_code, result_text)

for agent in agents:
    name = agent.get("name", "")
    agent_id = agent.get("id")
    files = agent_file_map.get(name, [])

    if not files:
        continue

    print(f"\n▶ 上传到助手: {name} (ID: {agent_id})")

    for fname in files:
        fpath = os.path.join(MATERIALS, fname)
        if not os.path.exists(fpath):
            print(f"    ⚠ 文件不存在: {fpath}")
            total_fail += 1
            upload_results.append((name, fname, 404, "文件不存在"))
            continue

        # 检查文件大小
        fsize = os.path.getsize(fpath)
        if fsize > 2 * 1024 * 1024:
            print(f"    ❌ 文件过大 ({fsize/1024/1024:.2f} MB > 2MB): {fname}")
            total_fail += 1
            upload_results.append((name, fname, 413, "文件超 2MB"))
            continue

        with open(fpath, "rb") as f:
            try:
                resp = requests.post(
                    f"{BASE}/api/knowledge/upload",
                    headers=headers,
                    files={"file": (fname, f, "text/markdown")},
                    params={"agent_id": agent_id},  # agent_id 必须作为 URL query 参数
                    timeout=30
                )
            except Exception as e:
                print(f"    ❌ 上传异常: {fname} -> {e}")
                total_fail += 1
                upload_results.append((name, fname, 0, str(e)))
                continue

        if resp.status_code in (200, 201):
            print(f"    ✅ 上传成功: {fname}  ({fsize} bytes)")
            total_ok += 1
            try:
                rdata = resp.json()
                upload_results.append((name, fname, resp.status_code, f"OK file_id={rdata.get('id','?')}"))
            except:
                upload_results.append((name, fname, resp.status_code, resp.text[:80]))
        else:
            print(f"    ❌ 上传失败: {fname} -> HTTP {resp.status_code}  {resp.text[:200]}")
            total_fail += 1
            upload_results.append((name, fname, resp.status_code, resp.text[:200]))

# ============================================================
# 第五部分：总结
# ============================================================
print("\n" + "=" * 60)
print(f"[DONE] 上传结束: 成功 {total_ok} 个，失败 {total_fail} 个，合计 {total_ok + total_fail} 个")
print("=" * 60)

if total_fail > 0:
    print("\n失败详情:")
    for name, fn, code, msg in upload_results:
        if code not in (200, 201):
            print(f"  {name} / {fn}: HTTP {code} -> {msg}")

print("\n[INFO] 知识库文件已提交到后端，RAG 处理（切分/嵌入/入库）需要 30-60 秒。")
print("[INFO] 请等待 60 秒后，运行验证脚本检查处理状态。")
print("       验证脚本: check_knowledge_status.py")
